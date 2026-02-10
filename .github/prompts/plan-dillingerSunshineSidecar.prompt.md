## Plan: Sunshine Streaming Sidecar — Full Implementation

**TL;DR** — Replace the existing Wolf-based streaming sidecar with a Sunshine-based architecture using `sway + seatd + gamescope + sunshine` on Arch Linux. This is a ground-up rebuild of the streaming server component across 6 phases: minimal E2E stream → gamescope integration → runner integration → input → audio (PipeWire) → hardening. The existing Wolf sidecar code is archived to `sidecar-wolf/`. Wolf is also removed from the base runner image (clean break). Health endpoints are served by a small Node.js HTTP server inside the container. All streaming API routes and the `DockerService` sidecar methods are updated from Wolf APIs to Sunshine APIs.

---

### Pre-work: Archive & Cleanup

1. **Archive existing Wolf sidecar** — Move `packages/runner-images/streaming-sidecar/` to `packages/runner-images/sidecar-wolf/`. Preserve git history with `git mv`.

2. **Remove Wolf from base runner image** — Clean break per decision:
   - `packages/runner-images/base/Dockerfile`: Remove Stage 6 (Wolf runtime deps, lines ~268–287), Stage 6b (Wolf binary COPY from GOW image, lines ~293–314), Stage 7 system GStreamer lines that are Wolf-specific, and Moonlight port EXPOSEs (lines ~385–398).
   - `packages/runner-images/base/entrypoint.sh`: Remove `setup_moonlight()` (lines ~382–480) and `start_wolf_server()` (lines ~571–627). Remove `ENABLE_MOONLIGHT` env var handling throughout. Keep Gamescope and display setup intact since gamescope will still be used by runners for local rendering.
   - Update all runner entrypoints that reference `start_wolf_server` or `ENABLE_MOONLIGHT`: `retroarch-entrypoint.sh`, `vice-entrypoint.sh`, `wine-entrypoint.sh`, `fs-uae-entrypoint.sh`, `native-entrypoint.sh`.

3. **Add `docker:build:streaming-sidecar` script** to `package.json` alongside existing runner build scripts. Also add `docker:build:streaming-sidecar:no-cache` variant.

4. **Bump version** — Update `DILLINGER_STREAMING_SIDECAR_VERSION` in `versioning.env` from `0.4.0` to `1.0.0` to signify the architecture change.

---

### Phase 1: Minimal E2E Stream (Sway + Sunshine wlr capture)

5. **Create new sidecar Dockerfile** at `packages/runner-images/streaming-sidecar/Dockerfile`:
   - Base: `archlinux:latest`
   - Install: `sway`, `seatd`, `sunshine` (from AUR or chaotic-aur; if unavailable, build from source via `makepkg`), `wlroots`, Mesa/Vulkan drivers (`mesa`, `vulkan-radeon`, `vulkan-icd-loader`, `libva-mesa-driver`), `xorg-xwayland`, Node.js 18+ (for health server)
   - Do NOT install gamescope yet (Phase 2)
   - Do NOT install PipeWire yet (Phase 5)
   - Copy `streaming-sidecar-entrypoint.sh`, `sunshine.conf.template`, `sway-config-template`, `health-server/` directory
   - EXPOSE: Sunshine Moonlight ports (47984–48010 range), health port (9999)

6. **Create Sunshine config template** at `packages/runner-images/streaming-sidecar/sunshine.conf.template`:
   - Capture method: `wlr` (wlroots screen capture, avoids KMS complexity)
   - Encoder: auto-detect (VA-API for AMD, NVENC for NVIDIA, software fallback)
   - Resolution/FPS: templated with `${RESOLUTION_WIDTH}`, `${RESOLUTION_HEIGHT}`, `${REFRESH_RATE}`
   - No audio initially (Phase 5)
   - Sunshine web UI port, Moonlight protocol ports
   - PIN/pairing config

7. **Create Sway headless config template** at `packages/runner-images/streaming-sidecar/sway-config-template`:
   - Reuse the existing template structure — `output HEADLESS-1` with resolution/refresh substitution, `xwayland disable` (Phase 1), `default_border none`, solid black background
   - Include directory for custom overrides: `include /config/sway-configs/include.d/*.conf`

8. **Create supervisor entrypoint** at `packages/runner-images/streaming-sidecar/streaming-sidecar-entrypoint.sh`:
   - **Stage 1**: Start `seatd` (container-local, `-g video`), export `SEATD_SOCK`
   - **Stage 2**: Generate sway config from template (substitute resolution/refresh vars), start `sway` with `WLR_BACKENDS=headless`, verify Wayland socket is created (poll `$XDG_RUNTIME_DIR/$WAYLAND_DISPLAY`)
   - **Stage 3**: Generate `sunshine.conf` from template, start Sunshine pointing at the sway Wayland display, verify Sunshine HTTP API is responding (poll `https://localhost:47990/api/...` or equivalent)
   - **Stage 4**: Start health server (`node /opt/health-server/index.js`)
   - Process supervision: trap signals, propagate SIGTERM to children, wait on all background processes, log process crashes with restart logic

9. **Create Node.js health server** at `packages/runner-images/streaming-sidecar/health-server/index.js`:
   - Lightweight HTTP server on port 9999 (no framework, use `http.createServer`)
   - `GET /healthz` — returns 200 if the health server process is up (liveness)
   - `GET /readyz` — returns 200 only if both sway socket exists AND Sunshine API responds; 503 otherwise (readiness)
   - `GET /streamz` — returns 200 + JSON with connected client count from Sunshine API; 503 if no active stream
   - `GET /status` — returns full JSON status: `{ mode, resolution, gpu, sway: up/down, sunshine: up/down, clients: [...] }` (backward compat with existing netcat endpoint)

10. **Create `packages/runner-images/streaming-sidecar/build.sh`** — Standard build script matching the existing pattern, reading version from `versioning.env`.

11. **Validation**: Build the image, run it with `--device /dev/dri` on the AMD host, verify:
    - `seatd` starts and creates socket
    - Sway starts headless with correct resolution
    - Sunshine starts and serves its web UI
    - `/healthz` returns 200, `/readyz` returns 200
    - Moonlight client can discover and pair with the Sunshine instance
    - Moonlight client sees a stream (black screen with cursor is success at this stage)

---

### Phase 2: Add Gamescope

12. **Add gamescope to Dockerfile** — `pacman -S gamescope`

13. **Update entrypoint for gamescope mode** — Between sway start and sunshine start, add optional gamescope launch:
    - `gamescope -W ${WIDTH} -H ${HEIGHT} -r ${FPS} --backend wayland -- <test_app>` running nested inside the sway session
    - Environment: `WAYLAND_DISPLAY` set to sway's socket so gamescope auto-nests
    - Controlled by env var `ENABLE_GAMESCOPE=true` (default false for Phase 1 compat)
    - Gamescope creates its own nested Wayland — Sunshine continues to capture the outer sway display (gamescope renders into sway's output)

14. **Test app for validation** — Use `weston-terminal` or `glxgears` inside gamescope to verify:
    - Gamescope launches within sway
    - Sunshine captures the gamescope rendering on sway's headless output
    - Moonlight client sees the test app rendered through gamescope

---

### Phase 3: Runner Integration

15. **Define `JobSpec` TypeScript interface** in `packages/shared/src/types/streaming.ts`:
    - `gameCommand: string[]` (argv)
    - `resolution: { width: number, height: number }`
    - `fps: number`
    - `bitrate: number | StreamingQuality`
    - `encoder: 'vaapi' | 'nvenc' | 'amf' | 'software' | 'auto'`
    - `audio: { enabled: boolean }`
    - `env: Record<string, string>`
    - `mounts: Array<{ source: string, target: string, readonly?: boolean }>`
    - `network: { ports: number[] }`
    - `input: { enableController: boolean, enableMouse: boolean, enableKeyboard: boolean }`
    - Add Zod schema for runtime validation alongside the type

16. **Option A — Game inside sidecar** (implement first):
    - Extend entrypoint to accept `GAME_COMMAND` env var
    - After Sunshine is ready, launch the game command inside gamescope: `gamescope -W ... -- ${GAME_COMMAND}`
    - Monitor game process — when game exits, optionally keep sidecar alive or shut down (controlled by `ON_GAME_EXIT=keep|stop`)
    - Update `DockerService.ensureStreamerSidecar()` to accept a `JobSpec` and pass game command + mounts + env to the sidecar container

17. **Option B — Game in separate runner container** (implement second):
    - Sidecar exports its Wayland socket via a shared Docker volume (`dillinger_streaming_wayland`)
    - Runner container mounts the same volume, sets `WAYLAND_DISPLAY` to the sidecar's socket
    - Runner launches game targeting the sidecar's sway display
    - Update `DockerService.launchGame()` to: (a) ensure sidecar is running, (b) launch runner container with shared Wayland volume, (c) link lifecycle — when runner container stops, optionally stop sidecar
    - This parallels the existing `dillinger_streaming_wayland:/run/dillinger:rw` volume bind

18. **Update `DockerService` sidecar methods** in `packages/dillinger-core/lib/services/docker-service.ts`:
    - `ensureStreamerSidecar()` (lines ~3700+): Update image reference, env vars (remove `WOLF_PIN`, add Sunshine-specific vars like `SUNSHINE_USERNAME`, `SUNSHINE_PASSWORD`, `ENABLE_GAMESCOPE`), volume mounts (remove `dillinger_wolf_state`, add Sunshine state volume), port mappings (Sunshine uses same Moonlight ports but different internal APIs), health check (poll `/readyz` instead of the old netcat endpoint)
    - `getStreamerSidecarStatus()`: Query `/status` health endpoint instead of old JSON endpoint
    - `stopStreamerSidecar()`: Same container stop/remove logic, updated labels

---

### Phase 4: Input

19. **Add `/dev/uinput` device access** to sidecar:
    - Dockerfile: ensure `uinput` kernel module is loadable (it's host-side), install `libevdev`
    - Container launch: add `--device /dev/uinput` to `HostConfig.Devices` in `ensureStreamerSidecar()`
    - Add capability `CAP_SYS_ADMIN` or use `--privileged` if uinput requires it (test minimal caps first)
    - Sunshine handles uinput natively for keyboard/mouse/controller — verify it works in containerized wlroots

20. **Controller mapping** — Sunshine supports gamepad passthrough. Ensure `/dev/input/event*` devices are bind-mounted or available. Add `--device /dev/input` to container config or selectively mount joystick devices.

21. **Test input chain**: Moonlight client → Sunshine → uinput → sway/gamescope → game. Validate keyboard, mouse, and gamepad with a test application (e.g., `jstest` for gamepad, a simple SDL app for keyboard/mouse).

---

### Phase 5: Audio (PipeWire)

22. **Add PipeWire + WirePlumber to Dockerfile**:
    - `pacman -S pipewire wireplumber pipewire-pulse` (PulseAudio compat layer for games that use PulseAudio)
    - Remove any PulseAudio references from the sidecar image

23. **Update entrypoint audio stage**:
    - Start PipeWire daemon: `pipewire &`
    - Start WirePlumber: `wireplumber &`
    - Start `pipewire-pulse` for PulseAudio compat: `pipewire-pulse &`
    - Verify PipeWire is ready: poll `pw-cli info 0`
    - Sunshine captures audio from PipeWire natively (configure in `sunshine.conf`)

24. **Update Sunshine config template** — Set audio capture source to PipeWire (Sunshine's `audio_sink` config)

25. **Test audio**: Launch a game/app that produces audio, verify Moonlight client receives audio stream alongside video.

---

### Phase 6: Hardening & Ops

26. **Structured logging** in the entrypoint:
    - All log lines as JSON: `{ "ts": "...", "level": "info|warn|error", "component": "sway|sunshine|gamescope|supervisor", "msg": "..." }`
    - Log rotation or size limits for container stdout

27. **Crash policy & restart logic** in the supervisor:
    - Define restart policy per component: sway crash = fatal (restart container), Sunshine crash = restart Sunshine, game crash = report via health endpoint
    - Exponential backoff for repeated crashes (max 3 retries, then give up)
    - Emit structured log on each crash/restart

28. **Health endpoint enhancements**:
    - `/healthz` includes uptime, restart count
    - `/readyz` includes component-level detail: `{ sway: "ready", sunshine: "ready", gamescope: "ready|n/a", audio: "ready|disabled" }`
    - `/streamz` includes stream quality metrics if available from Sunshine API (bitrate, fps, latency, codec)

29. **Timeout / idle shutdown** — If no Moonlight client connects within `IDLE_TIMEOUT_MINUTES`, the sidecar exits cleanly. Reuse logic from existing implementation but query Sunshine's client API instead of Wolf's.

30. **Metrics endpoint** (optional) — `GET /metrics` in Prometheus format for future observability.

---

### Phase 7: API & Frontend Integration

31. **Update streaming status route** at `packages/dillinger-core/app/api/streaming/status/route.ts`:
    - Replace Wolf API calls (`localhost:47989/api/v1/pair/pending`, `/api/v1/clients`) with sidecar health endpoint queries (`localhost:9999/status`, `localhost:9999/streamz`)
    - Update container detection — filter by new image name/labels
    - Return Sunshine-specific fields (connected clients, stream quality)

32. **Update pairing route** at `packages/dillinger-core/app/api/streaming/pair/route.ts`:
    - Replace Wolf TOML config parsing with Sunshine's pairing mechanism (Sunshine uses its web UI or API for PIN pairing — `https://localhost:47990/api/pin`)
    - Replace `[[paired_clients]]` TOML manipulation with Sunshine's client management API
    - Update credential model — Sunshine uses username/password for its web UI + Moonlight PIN for client pairing

33. **Update test stream route** at `packages/dillinger-core/app/api/streaming/test/route.ts`:
    - Update container creation to use new sidecar image
    - Remove Wolf-specific env vars, add Sunshine vars
    - Update readiness check to use `/readyz` health endpoint

34. **Update streaming types** in `packages/shared/src/types/streaming.ts`:
    - Add `JobSpec` interface (per step 15)
    - Update `SidecarStatus` to include Sunshine-specific fields
    - Add `SunshineClientInfo` type for connected client data
    - Deprecate/remove Wolf-specific types if any exist

35. **Update streaming settings UI** — The streaming page should reflect that the backend is now Sunshine. Update any Wolf-specific labels, help text, or configuration options in the streaming settings components.

36. **Update streaming graph default preset** — The default graph in `packages/shared/src/types/streaming-graph.ts` already references `SunshineSink`. Verify node definitions match the actual Sunshine pipeline and update if needed.

---

### Verification

- **Phase 1**: `pnpm docker:build:streaming-sidecar`, `docker run --rm --device /dev/dri -p 47984-48010:47984-48010 -p 9999:9999 streaming-sidecar:1.0.0` → Moonlight client can discover, pair, and see a black screen stream. `curl localhost:9999/healthz` returns 200.
- **Phase 2**: Same as above but with `ENABLE_GAMESCOPE=true` and a test app → Moonlight client sees the test app rendered through gamescope.
- **Phase 3**: `pnpm dev`, use the Dillinger UI to launch a game → sidecar starts, game renders, stream is visible in Moonlight.
- **Phase 4**: In the Moonlight client, keyboard/mouse/gamepad input controls the game.
- **Phase 5**: Game audio is audible in the Moonlight client.
- **Phase 6**: `curl localhost:9999/readyz` returns component-level status JSON. Killing Sunshine results in auto-restart with structured log output. Idle timeout works.
- **Full regression**: `pnpm test && pnpm lint` passes. All existing runner builds succeed (`pnpm docker:build:all`). Test stream from UI works end-to-end.

---

### Decisions

- **Arch Linux over Ubuntu**: Consistent with base runner, rolling release, better package freshness for Sunshine/gamescope/Mesa
- **Clean Wolf removal**: No dual-path maintenance burden; all streaming goes through sidecar
- **Node.js health server over bash/Go**: Matches project stack (TypeScript/Node everywhere), no build step, richer HTTP handling than netcat
- **wlr capture over KMS**: Simpler containerization (no DRM master needed), spec recommendation for prototype
- **PipeWire over PulseAudio**: Modern audio stack, better integration with Sunshine, spec requirement (Phase 5)
- **Version bump to 1.0.0**: Signals breaking architectural change from Wolf to Sunshine
