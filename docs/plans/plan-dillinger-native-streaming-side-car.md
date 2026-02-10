# Dillinger Streaming Sidecar Build Plan (wlroots + sway + gamescope + sunshine)

Goal: A single “streaming sidecar” container that boots a headless wlroots compositor (sway), runs games via gamescope into that Wayland session, and streams the result to Moonlight via Sunshine.

Pipeline:
1) sidecar starts
2) sway (wlroots) headless session starts
3) runner launches game via gamescope targeting the sway Wayland display
4) Sunshine captures via wlroots (wlr) and serves Moonlight clients

---

## Backing out current work

Dillinger has previously attempted to port games-on-whales/wolf over to be the streaming sidecar, but this proved difficult to integrate with gamescope and had some GPU compatibility issues. For the sake of progress, we will pivot to a new implementation focused on sway + gamescope + sunshine, and archive the previous work for reference. To this end, we will:

- [ ] Create a new branch for the new implementation (e.g., `plan-dillinger-native-streaming-side-car`)
- [ ] Move the existing wolf-based sidecar code to a new directory (e.g., `sidecar-wolf/`) for archival
- [ ] Update documentation to reflect the new plan
- [ ] Focus on the new implementation in the main branch moving forward

## 0. Success Criteria

### Functional
- Moonlight connects and displays a stable video stream.
- Input (keyboard/mouse/controller) from Moonlight reaches the game.
- Audio is streamed (or at minimum locally produced and capturable).
- Game resolution and refresh are controllable via configuration.
- Sidecar can start/stop cleanly and re-run without manual cleanup.

### Operational
- Works headless (no physical display required).
- Runs as a container (Docker/Podman), with predictable required device mounts/caps.
- Logs clearly show each stage (sway / gamescope / sunshine) readiness + failures.

---

## 1. Architecture & Responsibilities

### Sidecar container (single container)
Processes:
- `seatd` (optional, if not using logind) for wlroots seat management
- `sway` (wlroots compositor) in headless mode
- `sunshine` streaming server (wlr capture)
- A **Runner Supervisor** (your code) that:
  - waits for the Wayland socket to exist
  - launches and monitors the “runner command” (gamescope + game)
  - exposes health/metrics to Dillinger
  - terminates child processes on shutdown

Data/control:
- Dillinger passes a job spec (game ID, resolution, fps, bitrate preset, env, mounts)
- Sidecar returns:
  - ready state (Moonlight pairing available)
  - streaming endpoint details
  - error states with actionable diagnostics

---

## 2. Key Decisions (Lock These Early)

### 2.1 Capture method
- Use Sunshine **wlroots “wlr” capture** (preferred for sway).
- Avoid KMS capture initially to reduce privilege requirements.

### 2.2 Seat / input strategy
Choose one:
- **A: host seat**: mount `/run/seatd.sock` or use logind integration (harder in containers)
- **B: container-local seatd**: run `seatd` inside the container and mount required devices
Recommended for prototype: **B (container-local seatd)**

### 2.3 GPU access
- Bind mount `/dev/dri` (render + card nodes as needed)
- Ensure container matches host driver stack (NVIDIA vs AMD vs Intel) expectations.

### 2.4 Audio strategy
Initial plan options:
- **PipeWire** in container + Sunshine audio capture, or
- Host audio forwarded into container (more complex), or
- Start with “video first”, then add audio once video/input stable.
Recommended: video + input first, then add PipeWire.

---

## 3. Implementation Phases

## Phase 1 — Minimal E2E Stream (No Gamescope Yet)
Objective: prove sway headless + Sunshine wlr capture + Moonlight connects.

Deliverables:
- Container image that boots sway headless
- Sunshine starts and can be paired by Moonlight
- Sunshine captures a simple test surface (e.g., `weston-info` equivalent, or a basic Wayland test app)

Steps:
1. Build container with:
   - sway
   - seatd
   - sunshine
   - basic utilities: `bash`, `jq`, `procps`, `iproute2`
2. Sidecar entrypoint:
   - start `seatd`
   - start `sway` headless session
   - start `sunshine`
3. Validate:
   - Sunshine web UI reachable
   - Moonlight pairs and starts stream
   - Stream shows at least a basic rendered surface

Exit criteria:
- Moonlight shows a stable image captured via wlr.

---

## Phase 2 — Add Gamescope (Compositor-in-Compositor)
Objective: run gamescope as the “Steam-like” presentation layer within sway, still captured by Sunshine.

Deliverables:
- Runner launches:
  - `gamescope` targeting the sway Wayland socket
  - a trivial test app inside gamescope (e.g., `glxgears`, `vkcube`, or a simple SDL demo)

Steps:
1. Ensure sway session exports:
   - `WAYLAND_DISPLAY`
   - `XDG_RUNTIME_DIR`
2. Runner command pattern:
   - `gamescope [opts] -- <game command>`
3. Add job spec support:
   - desired resolution (e.g., 1920x1080)
   - fps cap (e.g., 60)
   - fullscreen/borderless toggles
4. Validate:
   - gamescope starts reliably without a physical display
   - Sunshine captures the gamescope output (should appear as a normal Wayland surface)

Exit criteria:
- Moonlight shows gamescope surface rendering smoothly.

---

## Phase 3 — Real Game Runner Integration
Objective: run an actual runner container/process (Wine/Proton/RetroArch/etc.) projecting into the sidecar’s sway display via gamescope.

Two integration options:

### Option A: Game runs inside the same sidecar container (simplest)
- Sidecar contains the game runtime or mounts it
- Lowest cross-container Wayland complexity

### Option B: Game runs in a separate runner container (more “Dillinger-like”)
- Share the Wayland socket into the runner container:
  - bind mount `XDG_RUNTIME_DIR`/Wayland socket path
  - align UID/GID permissions
- Share GPU `/dev/dri`
- Potentially share input devices or rely on Sunshine input injection into the compositor

Recommended sequence:
- Start with Option A to validate gamescope behavior.
- Then implement Option B once stable.

Exit criteria:
- Runner games display via gamescope and stream via Moonlight.
- Start/stop for multiple games in sequence works without reboot.

---

## Phase 4 — Input (Keyboard/Mouse/Controller)
Objective: Moonlight input reaches the game.

Requirements (typical):
- `/dev/uinput` available to Sunshine (or equivalent input injection path)
- correct Linux capabilities and device permissions inside container
- correct compositor permissions for injected devices

Steps:
1. Add device mounts:
   - `/dev/uinput`
   - possibly `/dev/input` (only if required; prefer uinput injection)
2. Validate in stream:
   - mouse moves cursor in a test app
   - keyboard typing works
   - controller recognized by game (if required)

Exit criteria:
- Full control in Moonlight with no manual host input.

---

## Phase 5 — Audio
Objective: audio is captured and streamed.

Steps (recommended):
1. Add PipeWire (and likely WirePlumber) inside container.
2. Start PipeWire before Sunshine.
3. Route game audio to PipeWire sink.
4. Configure Sunshine to capture audio from PipeWire.

Exit criteria:
- Moonlight receives audio reliably.

---

## Phase 6 — Hardening & Ops
Objective: production behavior for Dillinger orchestration.

Add:
- Health endpoints:
  - `/healthz` (process up)
  - `/readyz` (sway socket ready, Sunshine serving)
  - `/streamz` (client connected or streaming started)
- Structured logs with stage markers.
- Crash policy:
  - if sway dies → restart sidecar
  - if gamescope dies → restart runner only
- Config layering:
  - defaults baked into image
  - job-level overrides via env/json
- Metrics:
  - encoder stats, FPS, dropped frames, latency

Exit criteria:
- Reliable repeated sessions, clear diagnostics, automated recovery paths.

---

## 4. Container Requirements (Baseline)

### Devices to mount
- GPU: `/dev/dri` (minimum)
- Input injection: `/dev/uinput` (for Sunshine)
- Optional (avoid if possible): `/dev/input` (only if you need raw devices)

### Capabilities (minimize; add only if needed)
- Likely none for wlr capture itself
- Input injection may require additional permissions depending on host policy
- Avoid `cap_sys_admin` by not using KMS capture initially

### Environment variables (typical)
- `XDG_RUNTIME_DIR=/tmp/xdg` (or `/run/user/<uid>`)
- `WAYLAND_DISPLAY=wayland-1` (or set by sway)
- `WLR_BACKENDS=headless` (or sway headless config)
- `WLR_RENDERER=vulkan|gles2` (depending on GPU/driver)
- Sunshine config path (mounted or generated)

---

## 5. Sidecar Entrypoint & Supervisor Flow

Startup sequence:
1. Prepare runtime dirs:
   - create `XDG_RUNTIME_DIR` with correct perms
2. Start `seatd` (if using it)
3. Start `sway` (headless) and wait for Wayland socket
4. Start `sunshine` and wait for port ready
5. Mark sidecar “ready”
6. Await Dillinger job commands:
   - `start_game(jobSpec)`
   - `stop_game()`
   - `status()`

Shutdown sequence:
1. Stop runner process group (gamescope + game)
2. Stop sunshine
3. Stop sway
4. Stop seatd

---

## 6. Configuration Model (Suggested)

### JobSpec (input from Dillinger)
- `gameCommand`: string / argv list
- `resolution`: `{ width, height }`
- `fps`: number
- `bitrate`: number or preset
- `encoder`: `vaapi|nvenc|amf|software`
- `audio`: enabled/disabled
- `env`: map
- `mounts`: list
- `network`: ports (Sunshine, web UI)
- `input`: enable controller mapping, etc.

### Sidecar internal config
- sway config template
- sunshine config template
- gamescope options template
- log verbosity levels

---

## 7. Test Plan

### Smoke tests
- Sidecar boots: sway socket exists
- Sunshine reachable
- Moonlight pairs
- Stream starts (shows known test pattern/app)

### Gamescope tests
- Run `gamescope -- <simple app>`
- Verify resolution/fps
- Verify no black screen

### Runner tests
- Run a real game / emulator
- Verify stream stability 10+ minutes
- Restart game without restarting sidecar

### Input tests
- Mouse/keyboard
- Controller mapping in at least one SDL-based title

### Performance tests
- Encode latency
- Frame pacing
- CPU/GPU utilization
- Bitrate stability over LAN

---

## 8. Known Risks & Mitigations

### Risk: Wayland socket permissions across containers
Mitigation:
- prototype in single container first
- if separating runner later: align UID/GID, bind mount `XDG_RUNTIME_DIR`, and keep ownership consistent

### Risk: NVIDIA + Wayland headless quirks
Mitigation:
- test early on your target GPU
- consider explicit renderer flags (vulkan vs gles2)
- keep a fallback path (VKMS + KMS capture) if needed later

### Risk: input injection reliability
Mitigation:
- focus on `/dev/uinput` approach
- avoid raw `/dev/input` unless necessary
- document exact required perms/caps per distro

### Risk: gamescope headless issues
Mitigation:
- validate with trivial apps first
- keep a “no gamescope” fallback mode for diagnostics

---

## 9. Deliverables Checklist

- [ ] Sidecar Dockerfile (or Containerfile) builds sway+seatd+gamescope+sunshine
- [ ] Entrypoint supervisor script/app with staged readiness
- [ ] Sway headless config template
- [ ] Sunshine config template (wlr capture)
- [ ] JobSpec schema + parser
- [ ] Health endpoints + structured logs
- [ ] Minimal integration in Dillinger to start/stop sidecar + runner
- [ ] Test scripts for local validation
- [ ] Ops docs: required device mounts, capabilities, troubleshooting guide

---

## 10. Next Implementation Output (What to build first)
1. A minimal sidecar image + entrypoint that starts:
   - seatd → sway(headless) → sunshine(wlr)
2. A single test “runner” command:
   - `gamescope -- <simple app>`
3. A short validation runbook:
   - how to pair Moonlight
   - how to confirm capture method is wlr
   - how to confirm input injection readiness

Once that works, extend to runner containers and full Dillinger orchestration.
