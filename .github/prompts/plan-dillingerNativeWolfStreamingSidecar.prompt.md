# Plan: Dillinger-Native Wolf Streaming Sidecar

## TL;DR

Already forked Wolf and gst-wayland-display from third_party, build everything from source in a multi-stage Docker build, and modify Wolf to operate as a single-app "Dillinger" streaming server with no config.toml dependency. Wolf's `waylanddisplaysrc` already IS a Wayland compositor (via Smithay) — games connect to it as Wayland clients. We add a custom REST API so Dillinger can dynamically launch/swap games inside the running compositor without restarting Wolf. The Moonlight experience is: connect → see "Dillinger" → click → stream starts → Dillinger controls what's on screen.

## Architecture

Wolf's existing flow is actually close to what we need:

1. **Moonlight discovers** Wolf via mDNS (`_nvstream._tcp.local.`)
2. **User clicks "Dillinger"** → Wolf creates a `waylanddisplaysrc` GStreamer pipeline (which is a Smithay-based Wayland compositor)
3. **Compositor ready** → exposes a `WAYLAND_DISPLAY` socket → starts encoder pipeline (`interpipe` → `vah264enc` → `appsink` → UDP)
4. **Runner starts** → currently this launches a Docker container or process. We replace this with a Dillinger agent that listens for game launch commands
5. **Dillinger sends game launch command** via new REST API → agent starts emulator/game as Wayland client → game renders into compositor → frames stream to Moonlight

The key insight: **no Sway needed**. Wolf's `waylanddisplaysrc` (from gst-wayland-display) already provides a headless Wayland compositor. Games/emulators connect directly to it.

## Steps

### Phase 1: Build Infrastructure

Important: any necessary build tools must be added to the .devcontainer - this needs to be repeatable on any computer where this source is checked out.

0. **Deprecate sidecar-wolf and streaming-sidecar** -- the existing /packages/runner-images/sidecar-wolf and streaming-sidecar needs to be removed. Just get rid of them, but first check if there is any existing code that may be useful (especially around pairing)

1. **Create a branch in each forked repo** — `third_party/wolf` gets branch `dillinger`, `third_party/gst-wayland-display` gets branch `dillinger`. All changes go on these branches.

2. **Create the multi-stage Dockerfile** at `packages/runner-images/streaming-sidecar/Dockerfile` with four stages:
   - **Stage 1 (`gstreamer-builder`)**: Ubuntu 25.04 base. Build GStreamer 1.26.7 from source (clone gitlab.freedesktop.org, meson build with VA-API, nvcodec, QSV, pulse, interpipe). Follow the pattern in `third_party/wolf/docker/gstreamer.Dockerfile`.
   - **Stage 2 (`gpu-drivers`)**: Install VA-API drivers, Intel MSDK, NVIDIA NVRTC on top of GStreamer. Follow `third_party/wolf/docker/gpu-drivers.Dockerfile`.
   - **Stage 3 (`wolf-builder`)**: Install Rust 1.91+, build `gst-wayland-display` from `third_party/gst-wayland-display` via `cargo cinstall`. Install C++ build deps (cmake, ninja, clang, boost, wayland-dev, etc.). Build Wolf from `third_party/wolf` via CMake+Ninja. Output: `/wolf/wolf`, `/wolf/fake-udev`, GStreamer plugin `.so` files.
   - **Stage 4 (`runtime`)**: From `gpu-drivers` stage. Copy Wolf binaries, GStreamer plugins, gst-wayland-display libs. Install runtime deps only (libssl, libwayland, mesa, xwayland, pulseaudio). Add the Dillinger entrypoint.

3. **Use Docker `COPY` with local context** for third_party sources instead of `git clone` inside Docker:
   ```dockerfile
   COPY third_party/gst-wayland-display /build/gst-wayland-display
   COPY third_party/wolf /build/wolf
   ```
   This ensures we always build from our local fork, and the Docker build context includes third_party.

4. **Update `packages/runner-images/streaming-sidecar/build.sh`** to set the Docker build context to the repo root (`/workspaces/dillinger`) so `COPY third_party/...` works, with `-f packages/runner-images/streaming-sidecar/Dockerfile`.

### Phase 2: Wolf Source Modifications

All changes in `third_party/wolf/src/moonlight-server/` on the `dillinger` branch:

5. **Hardcode single-app config** — Modify `state/configTOML.cpp` `load_or_default()`:
   - Add a new code path: when env var `DILLINGER_MODE=1` is set, skip TOML file loading entirely
   - Programmatically create a `Config` with one profile (`id = "moonlight-profile-id"`) containing one app titled "Dillinger"
   - The app has `start_virtual_compositor = true`, `start_audio_server = true`
   - Runner type is `AppCMD` with `run_cmd` set to the Dillinger agent script (a long-running process that accepts game launch commands)
   - GStreamer encoder chain: auto-detect (va → vaapi → nvcodec → x264 fallback) — keep existing `pick_encoder()` logic
   - Be prepared for additional encoder chains to be presented at a later time - this is currently built in the UI, but there may be a time when a game is launched expecting a bespoke encoder chaing
   - Still load/save `paired_clients` from a simple file for pairing persistence

6. **Add Dillinger REST API** — Create new file `api/dillinger_api.hpp` and `api/dillinger_api.cpp`:
   - Runs on a configurable port (env `DILLINGER_API_PORT`, default `9999`)
   - Endpoints:
     - `GET /status` — Returns session state, connected clients, running game info
     - `POST /launch` — Body: `{ "cmd": "retroarch -L /cores/snes9x.so /games/smw.sfc", "env": {"KEY": "val"} }`. Launches a process as a Wayland client inside the active compositor. Kills any existing game process first.
     - `POST /stop` — Stops the current game process (but keeps the stream alive — Moonlight sees a blank compositor)
     - `GET /health` — Simple health check
   - This API talks to the existing Wolf event bus. When `POST /launch` is called:
     - Fires a `StartRunner` event with the specified command
     - The runner gets `WAYLAND_DISPLAY` and `PULSE_SERVER` env vars injected (pointing to Wolf's compositor and PulseAudio)
     - The game renders into the compositor → frames flow to Moonlight
   - An API for pairing - allowing dillinger to check any paired clients, and an ability to accept a paring request with PIN 
   - Wire this into `wolf.cpp` `run()` as another thread

7. **Simplify applist** — In `rest/endpoints.hpp` `applist()`:
   - When `DILLINGER_MODE=1`, always return exactly one app: "Dillinger"
   - Remove any icon fetching complexity — use a baked-in Dillinger logo or no icon

8. **Auto-launch on connect** — Modify the session handler in `sessions/handlers.hpp` / `moonlight.cpp`:
   - When Moonlight client connects and launches the "Dillinger" app, Wolf starts the compositor + encoder pipeline as normal
   - The runner starts the Dillinger agent (a small bash script or Node process that stays alive and serves as a placeholder)
   - The compositor remains running with a blank screen until Dillinger sends a `POST /launch` command

9. **Support runner restart without stream restart** — Modify runner handling:
   - When `POST /launch` is called while a game is already running, kill the old runner process and start the new one
   - The `waylanddisplaysrc` compositor and encoder pipeline stay alive — only the Wayland client (the game) changes
   - This is already partially supported by Wolf's `SwitchStreamProducerEvents` in `streaming/streaming.cpp`, but we need to ensure the runner lifecycle supports it
   - Key change: the runner should NOT call `stop_stream_when_over = true`. The stream lives independently of the runner.

10. **Strip unnecessary features** — Remove from the Wolf build:
    - Docker runner support (we don't launch Docker containers from inside the sidecar) — remove `runners/docker.cpp` and Docker introspection
    - Wolf-UI profile management (no multi-profile) — simplify API endpoints
    - Lobby system (not needed for single-user streaming) — can be removed later if desired
    - Keep: pairing, Moonlight protocol, GStreamer pipelines, input handling, mDNS, RTSP, control

### Phase 3: gst-wayland-display Adjustments

11. **Verify gst-wayland-display builds** from `third_party/gst-wayland-display` with current Rust toolchain. The `wayland-display-core` depends on a forked Smithay — ensure the fork is accessible or vendor the dependency.

12. **Pin Smithay fork** — The `wayland-display-core/Cargo.toml` depends on `smithay` from `https://github.com/games-on-whales/smithay` at a specific revision. Ensure this is reproducible. Consider forking this to `thrane20/smithay` or vendoring.

### Phase 4: Entrypoint & Runtime

13. **Rewrite `streaming-sidecar-entrypoint.sh`** — Dramatically simplified since Wolf handles the compositor:
    - Setup DRI device permissions (add user to GPU groups)
    - Start PulseAudio (or connect to existing)
    - Set GStreamer env vars (`GST_PLUGIN_PATH`, `GST_PLUGIN_SCANNER`, `GST_PLUGIN_SYSTEM_PATH=""`)
    - Set `DILLINGER_MODE=1`
    - Exec `/wolf/wolf` directly — Wolf starts the compositor when Moonlight connects
    - No Sway, no config.toml generation, no test pattern mode

14. **Create Dillinger agent script** at `packages/runner-images/streaming-sidecar/dillinger-agent.sh`:
    - This is the "runner" process Wolf launches when Moonlight connects
    - It's a simple loop that stays alive and serves as a placeholder
    - The actual game launching happens via the Dillinger REST API (step 6), not through this agent
    - When Dillinger calls `POST /launch`, Wolf spawns a child process with the game command, inheriting `WAYLAND_DISPLAY` and `PULSE_SERVER`

15. **Remove old sidecar files** — Delete `packages/runner-images/sidecar-wolf/` (the old Wolf sidecar) and the Sunshine-based files that are being replaced. Keep the new implementation in `streaming-sidecar/`.

### Phase 5: Dillinger Core Integration

16. **Update Docker service** in `packages/dillinger-core/lib/services/docker-service.ts`:
    - Launch streaming-sidecar container with GPU devices + PulseAudio socket + volume for pairing persistence
    - Expose ports: 47984, 47989, 47999, 48010, 48100, 48200 (Moonlight) + 9999 (Dillinger API)
    - No `SIDECAR_MODE`, no `SWAY_CONFIG_NAME`, no `TEST_PATTERN` — just start and go

17. **Update streaming test route** at `packages/dillinger-core/app/api/streaming/test/route.ts`:
    - Simplify: start sidecar container, wait for health check, return connection info
    - After sidecar is running, call `POST http://sidecar:9999/launch` with a test pattern command (e.g. `weston-simple-egl` or `glmark2-wayland`) to verify video is flowing

18. **Add game launch integration** — When a user clicks "Play" on a game in the Dillinger UI:
    - Dillinger calls `POST http://sidecar:9999/launch` with the emulator command + ROM path
    - The emulator starts inside Wolf's compositor → video streams to Moonlight
    - When the user stops → `POST http://sidecar:9999/stop` → emulator killed → blank compositor (or Dillinger wallpaper)

## Verification

1. **Build test**: `docker build` completes for the streaming-sidecar (all four stages)
2. **Wolf starts**: Container launches, Wolf initializes GStreamer, listens on Moonlight ports, mDNS broadcasts "Dillinger"
3. **Moonlight pairing**: Moonlight discovers "Dillinger", pairing succeeds, app list shows single "Dillinger" app
4. **Stream test**: Click "Dillinger" in Moonlight → see blank compositor (or cursor) → call `POST /launch` with `weston-simple-egl` → see rendered output in Moonlight
5. **Game swap**: While streaming, call `POST /launch` with a different command → old process dies, new one starts → Moonlight continues without reconnection
6. **GPU encoding**: Verify `vah264enc` is used on AMD, `nvh264enc` on NVIDIA, `x264enc` as fallback

## Decisions

- **No Sway**: Wolf's `waylanddisplaysrc` (Smithay compositor) replaces Sway entirely. Games are direct Wayland clients of Wolf's compositor.
- **No config.toml**: When `DILLINGER_MODE=1`, Wolf builds its config programmatically. Only paired_clients persist to disk.
- **Build from source**: GStreamer, gst-wayland-display, and Wolf all built from local third_party repos. Full control, no external image dependencies at runtime.
- **Custom REST API over Unix socket API**: New HTTP API on port 9999 for game control, simpler than Unix socket for cross-container communication.
- **Full fork**: Wolf is treated as our own project on the `dillinger` branch. We can remove features, rename, restructure freely.
- **Runner lifecycle decoupled from stream**: The stream (compositor + encoder) lives as long as Moonlight is connected. Games are launched/stopped independently within the compositor.
