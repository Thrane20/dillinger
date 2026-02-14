# Tasks: Dillinger-Native Wolf Streaming Sidecar

Feature: Build Wolf and gst-wayland-display from source in a multi-stage Docker image, modify Wolf to operate as a single-app "Dillinger" streaming server with a custom REST API for game launch/swap, eliminating Sway and config.toml dependencies.

---

## Phase 1: Setup & Cleanup

> **Goal**: Deprecate old sidecar implementations, prepare build infrastructure, create branch structure, and set up the devcontainer with required build tools.

- [x] T001 Audit `packages/runner-images/sidecar-wolf/` for reusable code (especially pairing logic in `streaming-sidecar-entrypoint.sh`, Wolf config template in `wolf-config.toml`, and encoder chain definitions) and document findings in a comment or scratch notes before deletion
- [x] T002 Remove `packages/runner-images/sidecar-wolf/` directory entirely (Dockerfile, build.sh, streaming-sidecar-entrypoint.sh, sway-config-template, wolf-config.toml, README.md)
- [x] T003 Remove Sunshine-based files from `packages/runner-images/streaming-sidecar/` (sunshine.conf.template, sway-config-template, health-server/index.js, current streaming-sidecar-entrypoint.sh, current Dockerfile) — preserve the directory and build.sh for the new implementation
- [x] T004 Create git branch `dillinger` in `third_party/wolf` for all Wolf source modifications
- [x] T005 Create git branch `dillinger` in `third_party/gst-wayland-display` for any gst-wayland-display adjustments
- [x] T006 [P] Update `.devcontainer/devcontainer.json` to add build tools needed for local Wolf/GStreamer development (cmake, ninja-build, meson, clang, libboost-dev, wayland-dev, rustup) if not already present — these are needed for reproducible builds on any checkout
- [x] T007 [P] Remove old sidecar-wolf build scripts from root `package.json` if any exist (e.g., `docker:build:sidecar-wolf` variants) and ensure `docker:build:streaming-sidecar` scripts point to the new implementation

### Phase 1 Metadata

- T001 references: [packages/runner-images/sidecar-wolf/streaming-sidecar-entrypoint.sh](packages/runner-images/sidecar-wolf/streaming-sidecar-entrypoint.sh), [packages/runner-images/sidecar-wolf/wolf-config.toml](packages/runner-images/sidecar-wolf/wolf-config.toml), [packages/runner-images/sidecar-wolf/Dockerfile](packages/runner-images/sidecar-wolf/Dockerfile)
- T003 references: [packages/runner-images/streaming-sidecar/streaming-sidecar-entrypoint.sh](packages/runner-images/streaming-sidecar/streaming-sidecar-entrypoint.sh), [packages/runner-images/streaming-sidecar/sunshine.conf.template](packages/runner-images/streaming-sidecar/sunshine.conf.template), [packages/runner-images/streaming-sidecar/health-server/index.js](packages/runner-images/streaming-sidecar/health-server/index.js)
- T006 references: [/.devcontainer/devcontainer.json](.devcontainer/devcontainer.json), [/.devcontainer/Dockerfile](.devcontainer/Dockerfile)

---

## Phase 2: Foundational — Multi-Stage Docker Build

> **Goal**: Create the four-stage Dockerfile that builds GStreamer, GPU drivers, Wolf, and the runtime image entirely from local `third_party/` sources. This is the blocking prerequisite for all subsequent work.

- [x] T008 Create Stage 1 (`gstreamer-builder`) in `packages/runner-images/streaming-sidecar/Dockerfile` — Ubuntu 25.04 base, build GStreamer 1.26.7 from source following the pattern in `third_party/wolf/docker/gstreamer.Dockerfile` (meson build with VA-API, nvcodec, QSV, pulse, interpipe, GL wayland/egl/gbm/surfaceless)
- [x] T009 Create Stage 2 (`gpu-drivers`) in `packages/runner-images/streaming-sidecar/Dockerfile` — Install VA-API drivers (`va-driver-all`, `intel-media-va-driver-non-free`, `libmfx-gen1.2`), build `libmfx` from source (Intel MediaSDK), add NVIDIA NVRTC libraries, following `third_party/wolf/docker/gpu-drivers.Dockerfile`
- [x] T010 Create Stage 3 (`wolf-builder`) in `packages/runner-images/streaming-sidecar/Dockerfile` — Install Rust 1.91+, build `gst-wayland-display` from `COPY third_party/gst-wayland-display /build/gst-wayland-display` via `cargo cinstall`, install C++ build deps (cmake, ninja, clang, boost, wayland-dev, etc.), build Wolf from `COPY third_party/wolf /build/wolf` via CMake+Ninja, output `/wolf/wolf`, `/wolf/fake-udev`, GStreamer plugin `.so` files
- [x] T011 Create Stage 4 (`runtime`) in `packages/runner-images/streaming-sidecar/Dockerfile` — From `gpu-drivers` stage, COPY Wolf binaries + GStreamer plugins + gst-wayland-display libs from builder stages, install runtime-only deps (libssl, libwayland, mesa, xwayland, pulseaudio, libcurl), add Dillinger entrypoint and agent script, expose Moonlight ports (47984, 47989, 47999, 48010, 48100, 48200) + Dillinger API port (9999)
- [x] T012 Update `packages/runner-images/streaming-sidecar/build.sh` to set Docker build context to repo root (`/workspaces/dillinger`) with `-f packages/runner-images/streaming-sidecar/Dockerfile`, source `versioning.env` for image tagging, support `--no-cache` flag
- [x] T013 Validate that `docker build` completes for all four stages by running `packages/runner-images/streaming-sidecar/build.sh` — fix any missing deps or build errors

### Phase 2 Metadata

- T008 references: [packages/runner-images/streaming-sidecar/Dockerfile](packages/runner-images/streaming-sidecar/Dockerfile), [third_party/wolf/docker/gstreamer.Dockerfile](third_party/wolf/docker/gstreamer.Dockerfile)
- T009 references: [packages/runner-images/streaming-sidecar/Dockerfile](packages/runner-images/streaming-sidecar/Dockerfile), [third_party/wolf/docker/gpu-drivers.Dockerfile](third_party/wolf/docker/gpu-drivers.Dockerfile)
- T010 references: [packages/runner-images/streaming-sidecar/Dockerfile](packages/runner-images/streaming-sidecar/Dockerfile), [third_party/wolf/docker/wolf.Dockerfile](third_party/wolf/docker/wolf.Dockerfile), [third_party/gst-wayland-display](third_party/gst-wayland-display)
- T011 references: [packages/runner-images/streaming-sidecar/Dockerfile](packages/runner-images/streaming-sidecar/Dockerfile), [packages/runner-images/streaming-sidecar/streaming-sidecar-entrypoint.sh](packages/runner-images/streaming-sidecar/streaming-sidecar-entrypoint.sh), [packages/runner-images/streaming-sidecar/dillinger-agent.sh](packages/runner-images/streaming-sidecar/dillinger-agent.sh)
- T012 references: [packages/runner-images/streaming-sidecar/build.sh](packages/runner-images/streaming-sidecar/build.sh), [versioning.env](versioning.env)

---

## Phase 3: User Story 1 — Hardcoded Single-App Config (DILLINGER_MODE)

> **Goal**: When `DILLINGER_MODE=1` env var is set, Wolf bypasses TOML config loading and programmatically creates a single-app "Dillinger" config. Moonlight discovers exactly one app.
>
> **Independent test**: Start Wolf with `DILLINGER_MODE=1`, verify `GET /serverinfo` and `GET /applist` return a single "Dillinger" app. No config.toml file needed.

- [x] T014 [US1] Modify `third_party/wolf/src/moonlight-server/state/configTOML.cpp` `load_or_default()` to add `DILLINGER_MODE=1` code path — skip TOML file loading, programmatically create `Config` with one profile (`id = "moonlight-profile-id"`) containing one app titled "Dillinger" with `start_virtual_compositor = true`, `start_audio_server = true`
- [x] T015 [US1] In the Dillinger mode config path in `third_party/wolf/src/moonlight-server/state/configTOML.cpp`, set runner type to `AppCMD` with `run_cmd` pointing to the Dillinger agent script (`/opt/dillinger/dillinger-agent.sh`), keep existing `pick_encoder()` auto-detect logic (va → vaapi → nvcodec → x264 fallback)
- [x] T016 [US1] Ensure `paired_clients` persistence still works in Dillinger mode — load/save paired clients from a simple file (`paired_clients.json` or equivalent in `WOLF_CFG_FOLDER`) even when config.toml is not used
- [x] T017 [US1] Modify `third_party/wolf/src/moonlight-server/rest/endpoints.hpp` `applist()` — when `DILLINGER_MODE=1`, always return exactly one app "Dillinger" in the XML response, skip icon fetching (use empty or baked-in icon)
- [x] T018 [US1] Modify `third_party/wolf/src/moonlight-server/rest/endpoints.hpp` `serverinfo()` — when `DILLINGER_MODE=1`, set hostname to "Dillinger" in mDNS/discovery responses

### Phase 3 Metadata

- T014 references: [third_party/wolf/src/moonlight-server/state/configTOML.cpp](third_party/wolf/src/moonlight-server/state/configTOML.cpp), [third_party/wolf/src/moonlight-server/state/default/config.include.toml](third_party/wolf/src/moonlight-server/state/default/config.include.toml)
- T015 references: [third_party/wolf/src/moonlight-server/state/configTOML.cpp](third_party/wolf/src/moonlight-server/state/configTOML.cpp), [packages/runner-images/streaming-sidecar/dillinger-agent.sh](packages/runner-images/streaming-sidecar/dillinger-agent.sh)
- T016 references: [third_party/wolf/src/moonlight-server/state/configTOML.cpp](third_party/wolf/src/moonlight-server/state/configTOML.cpp)
- T017 references: [third_party/wolf/src/moonlight-server/rest/endpoints.hpp](third_party/wolf/src/moonlight-server/rest/endpoints.hpp)
- T018 references: [third_party/wolf/src/moonlight-server/rest/endpoints.hpp](third_party/wolf/src/moonlight-server/rest/endpoints.hpp)

---

## Phase 4: User Story 2 — Dillinger REST API for Game Control

> **Goal**: Add a custom HTTP REST API on port 9999 inside Wolf that allows Dillinger to launch, stop, and monitor games inside the active Wayland compositor without restarting the stream.
>
> **Independent test**: With Wolf running and a Moonlight stream active, `POST /launch` with a test command → process starts as Wayland client inside compositor. `POST /stop` → process killed. `GET /status` → returns current state. `GET /health` → returns 200.

- [x] T019 [US2] Create `third_party/wolf/src/moonlight-server/api/dillinger_api.hpp` — declare `DillingerAPI` class with methods: `start(port)`, `stop()`, and endpoint handlers for `/health`, `/status`, `/launch`, `/stop`, `/pair/status`, `/pair/accept`
- [x] T020 [US2] Create `third_party/wolf/src/moonlight-server/api/dillinger_api.cpp` — implement HTTP server on configurable port (env `DILLINGER_API_PORT`, default 9999) using Boost.Beast or Wolf's existing HTTP server pattern
- [x] T021 [US2] Implement `GET /health` endpoint in `third_party/wolf/src/moonlight-server/api/dillinger_api.cpp` — return `{"status": "ok", "version": "..."}` simple health check
- [x] T022 [US2] Implement `GET /status` endpoint in `third_party/wolf/src/moonlight-server/api/dillinger_api.cpp` — return session state (compositor active, encoder type, connected clients count, current running game command, uptime)
- [x] T023 [US2] Implement `POST /launch` endpoint in `third_party/wolf/src/moonlight-server/api/dillinger_api.cpp` — accept JSON body `{"cmd": "...", "env": {"KEY": "val"}}`, kill any existing game process, fire `StartRunner` event on Wolf's event bus with the command, inject `WAYLAND_DISPLAY` and `PULSE_SERVER` env vars pointing to Wolf's compositor and PulseAudio
- [x] T024 [US2] Implement `POST /stop` endpoint in `third_party/wolf/src/moonlight-server/api/dillinger_api.cpp` — stop the current game process (send SIGTERM then SIGKILL), keep stream alive (compositor shows blank/cursor)
- [x] T025 [US2] Implement `GET /pair/status` endpoint in `third_party/wolf/src/moonlight-server/api/dillinger_api.cpp` — return list of currently paired clients and any pending pairing requests
- [x] T026 [US2] Implement `POST /pair/accept` endpoint in `third_party/wolf/src/moonlight-server/api/dillinger_api.cpp` — accept a pending pairing request by providing the PIN displayed on the Moonlight client
- [x] T027 [US2] Wire `DillingerAPI` into `third_party/wolf/src/moonlight-server/wolf.cpp` `run()` — start the API server as another thread alongside HTTP/HTTPS/RTSP/Control servers, only when `DILLINGER_MODE=1`
- [x] T028 [US2] Update `third_party/wolf/CMakeLists.txt` to include the new `api/dillinger_api.cpp` source file in the moonlight-server build target

### Phase 4 Metadata

- T019 references: [third_party/wolf/src/moonlight-server/api/dillinger_api.hpp](third_party/wolf/src/moonlight-server/api/dillinger_api.hpp)
- T020 references: [third_party/wolf/src/moonlight-server/api/dillinger_api.cpp](third_party/wolf/src/moonlight-server/api/dillinger_api.cpp)
- T021 references: [third_party/wolf/src/moonlight-server/api/dillinger_api.cpp](third_party/wolf/src/moonlight-server/api/dillinger_api.cpp)
- T022 references: [third_party/wolf/src/moonlight-server/api/dillinger_api.cpp](third_party/wolf/src/moonlight-server/api/dillinger_api.cpp)
- T023 references: [third_party/wolf/src/moonlight-server/api/dillinger_api.cpp](third_party/wolf/src/moonlight-server/api/dillinger_api.cpp), [third_party/wolf/src/moonlight-server/runners/process.cpp](third_party/wolf/src/moonlight-server/runners/process.cpp), [third_party/wolf/src/moonlight-server/sessions/common.cpp](third_party/wolf/src/moonlight-server/sessions/common.cpp)
- T024 references: [third_party/wolf/src/moonlight-server/api/dillinger_api.cpp](third_party/wolf/src/moonlight-server/api/dillinger_api.cpp), [third_party/wolf/src/moonlight-server/runners/process.cpp](third_party/wolf/src/moonlight-server/runners/process.cpp)
- T025 references: [third_party/wolf/src/moonlight-server/api/dillinger_api.cpp](third_party/wolf/src/moonlight-server/api/dillinger_api.cpp), [third_party/wolf/src/moonlight-server/api/api.cpp](third_party/wolf/src/moonlight-server/api/api.cpp)
- T026 references: [third_party/wolf/src/moonlight-server/api/dillinger_api.cpp](third_party/wolf/src/moonlight-server/api/dillinger_api.cpp), [third_party/wolf/src/moonlight-server/rest/servers.cpp](third_party/wolf/src/moonlight-server/rest/servers.cpp)
- T027 references: [third_party/wolf/src/moonlight-server/wolf.cpp](third_party/wolf/src/moonlight-server/wolf.cpp)
- T029 references: [third_party/wolf/src/moonlight-server/sessions/moonlight.cpp](third_party/wolf/src/moonlight-server/sessions/moonlight.cpp)
- T030 references: [third_party/wolf/src/moonlight-server/runners/process.cpp](third_party/wolf/src/moonlight-server/runners/process.cpp)
- T031 references: [third_party/wolf/src/moonlight-server/sessions/common.cpp](third_party/wolf/src/moonlight-server/sessions/common.cpp)

---

## Phase 5: User Story 3 — Runner Lifecycle Decoupled from Stream

> **Goal**: The stream (compositor + encoder pipeline) lives as long as Moonlight is connected. Games are launched and stopped independently within the compositor. `POST /launch` while a game is running kills the old game and starts the new one without interrupting the Moonlight stream.
>
> **Independent test**: Connect Moonlight → stream starts → `POST /launch` with `/opt/dillinger/gst-video-test.sh` → see output → `POST /launch` with `/opt/dillinger/gst-av-test.sh` → old process dies, new one starts, Moonlight continues without reconnection → `POST /stop` → blank screen, stream still active.

- [x] T029 [US3] Modify `third_party/wolf/src/moonlight-server/sessions/moonlight.cpp` `setup_moonlight_handlers()` — when Moonlight connects and launches "Dillinger" app, start compositor + encoder pipeline as normal, but configure runner with `stop_stream_when_over = false` so the stream survives runner process exits
- [x] T030 [US3] Modify `third_party/wolf/src/moonlight-server/runners/process.cpp` `RunProcess` — add support for replacing the running process: when a new `StartRunner` event fires while a process is already running, terminate the old process cleanly (SIGTERM → wait → SIGKILL) before starting the new one
- [x] T031 [US3] Ensure `third_party/wolf/src/moonlight-server/sessions/common.cpp` `start_runner()` correctly injects `WAYLAND_DISPLAY` and `PULSE_SERVER` env vars for each new runner process launch, including on runner replacement (not just initial launch)
- [ ] T032 [US3] Verify the `waylanddisplaysrc` compositor in `third_party/gst-wayland-display/gst-plugin-wayland-display/` handles Wayland client disconnect/reconnect gracefully — when a game process exits and a new one connects, the compositor should accept the new client without restarting the GStreamer pipeline (deferred; pending validation)

---

## Phase 6: User Story 4 — Strip Unnecessary Wolf Features

> **Goal**: Remove Docker runner support, UI profile management, and other features not needed for the single-user Dillinger sidecar use case. This reduces binary size, attack surface, and maintenance burden.
>
> **Independent test**: Wolf compiles and starts successfully with the stripped features. Docker runner code is not present. Profile management endpoints are simplified.

- [x] T033 [P] [US4] Remove Docker runner from Wolf build — delete or `#ifdef` out `third_party/wolf/src/moonlight-server/runners/docker.cpp` and `third_party/wolf/src/moonlight-server/runners/docker.hpp`, remove Docker introspection code from `third_party/wolf/src/moonlight-server/wolf.cpp` `initialize()` (the `detect_host_paths()` and Docker socket usage)
- [x] T034 [P] [US4] Update `third_party/wolf/CMakeLists.txt` to remove `runners/docker.cpp` from the source file list, remove Docker/libcurl-based introspection dependencies that are no longer needed
- [x] T035 [P] [US4] Simplify `third_party/wolf/src/moonlight-server/rest/endpoints.hpp` — when `DILLINGER_MODE=1`, remove or short-circuit profile management endpoints that handle multi-profile CRUD (keep only serverinfo, pair, applist, launch, resume, cancel)
- [x] T036 [P] [US4] Remove Wolf-UI profile management code paths from `third_party/wolf/src/moonlight-server/state/configTOML.cpp` that handle multi-profile creation/editing (keep paired_clients handling)

---

## Phase 7: User Story 5 — gst-wayland-display Build Verification

> **Goal**: Ensure gst-wayland-display builds reproducibly from `third_party/gst-wayland-display` with the current Rust toolchain, and the forked Smithay dependency is accessible and pinned.
>
> **Independent test**: `cargo build` in `third_party/gst-wayland-display` succeeds. `cargo cinstall` produces the expected `.so` plugin and C headers. Smithay fork at `games-on-whales/smithay` rev `a166cf4c` is reachable.

- [x] T037 [US5] Verify `third_party/gst-wayland-display` builds with `cargo build --release` using Rust 1.91+ toolchain — fix any dependency resolution or compilation errors
- [x] T038 [US5] Verify `cargo cinstall` for `third_party/gst-wayland-display/c-bindings/` produces the expected `libwayland_display.so` and C header files needed by Wolf's CMake build
- [x] T039 [US5] Verify the Smithay fork dependency in `third_party/gst-wayland-display/wayland-display-core/Cargo.toml` (`github.com/games-on-whales/smithay` rev `a166cf4c`) is accessible — if not, fork to `thrane20/smithay` or vendor the dependency in `third_party/`
- [ ] T040 [US5] Pin the `gst-wayland-display` workspace in `third_party/gst-wayland-display/Cargo.lock` to ensure reproducible builds — commit the lock file on the `dillinger` branch

---

## Phase 8: User Story 6 — Entrypoint & Runtime Agent

> **Goal**: Create a simplified entrypoint that starts Wolf directly (no Sway, no config.toml generation) and a Dillinger agent script that serves as the initial runner placeholder.
>
> **Independent test**: Container starts, entrypoint sets up GPU permissions + PulseAudio + GStreamer env vars, execs Wolf. Wolf initializes, mDNS broadcasts "Dillinger", Moonlight discovers the server.

- [x] T041 [US6] Create new `packages/runner-images/streaming-sidecar/streaming-sidecar-entrypoint.sh` — simplified entrypoint that: (1) sets up DRI device permissions (add user to video/render groups, chmod /dev/dri/*), (2) starts PulseAudio daemon or connects to existing, (3) sets GStreamer env vars (`GST_PLUGIN_PATH=/usr/local/lib/x86_64-linux-gnu/gstreamer-1.0`, `GST_PLUGIN_SCANNER`, `GST_PLUGIN_SYSTEM_PATH=""`), (4) sets `DILLINGER_MODE=1`, (5) execs `/wolf/wolf`
- [x] T042 [US6] Create `packages/runner-images/streaming-sidecar/dillinger-agent.sh` — simple runner placeholder script that Wolf launches when Moonlight connects: stays alive via `while true; do sleep 60; done` loop, handles SIGTERM gracefully for clean shutdown
- [x] T043 [US6] Ensure the entrypoint in `packages/runner-images/streaming-sidecar/streaming-sidecar-entrypoint.sh` handles structured JSON logging (matching the pattern from the old Sunshine-based entrypoint) for consistent log parsing by Dillinger core
- [x] T044 [US6] Remove all Sway-related configuration from `packages/runner-images/streaming-sidecar/` — no sway-config-template, no `WLR_BACKENDS`, no `WLR_RENDERER`, no Sway binary installation in Dockerfile

---

## Phase 9: User Story 7 — Dillinger Core Integration

> **Goal**: Update Dillinger's Docker service and streaming API routes to work with the new Wolf-based sidecar — launching the container, health checking, and sending game launch/stop commands via the REST API.
>
> **Independent test**: From the Dillinger UI, click "Test Stream" → sidecar container starts → Wolf initializes → health check passes → test pattern launches via `POST /launch` → Moonlight sees video. Click "Play" on a game → `POST /launch` with emulator command → game streams.

- [x] T045 [US7] Update `packages/dillinger-core/lib/services/docker-service.ts` — modify sidecar container launch to remove `SIDECAR_MODE`, `SWAY_CONFIG_NAME`, `TEST_PATTERN`, Sunshine-specific env vars; add `DILLINGER_MODE=1`, `DILLINGER_API_PORT=9999`; ensure GPU devices + PulseAudio socket + `dillinger_root` volume are mounted; expose ports 47984, 47989, 47999, 48010, 48100, 48200 (Moonlight) + 9999 (API)
- [x] T046 [US7] Update `packages/dillinger-core/lib/services/docker-service.ts` — add helper method `callSidecarAPI(endpoint, method, body?)` that makes HTTP requests to `http://localhost:9999` (or container IP:9999) for communicating with the Dillinger REST API
- [x] T047 [US7] Update `packages/dillinger-core/lib/services/docker-service.ts` — modify game launch flow to use `callSidecarAPI('/launch', 'POST', {cmd, env})` instead of creating a new container per game; modify stop flow to use `callSidecarAPI('/stop', 'POST')`
- [x] T048 [US7] Update `packages/dillinger-core/app/api/streaming/test/route.ts` — simplify to: start sidecar container, poll `GET http://sidecar:9999/health` until ready, call `POST http://sidecar:9999/launch` with test pattern command (`weston-simple-egl` or `glmark2-wayland`), return connection info (Moonlight ports + hostname)
- [x] T049 [P] [US7] Add pairing integration in `packages/dillinger-core/lib/services/docker-service.ts` or a new `streaming-service.ts` — expose methods to check paired clients via `GET /pair/status` and accept pairing via `POST /pair/accept` with PIN, wire these into the Dillinger UI streaming settings
- [x] T050 [P] [US7] Update any streaming-related UI components in `packages/dillinger-core/app/streaming/` to remove references to Sunshine, Sway, and old sidecar modes; update to reflect the new Wolf-based architecture (single "Dillinger" app model)

---

## Phase 10: Polish & Cross-Cutting Concerns

> **Goal**: Clean up references, update documentation, ensure build scripts are consistent, and validate the full end-to-end flow.

- [x] T051 [P] Update `packages/runner-images/build.sh` (root runner images build script) to include the streaming-sidecar build with correct context path
- [x] T052 [P] Update root `package.json` to ensure `docker:build:streaming-sidecar` and `docker:build:streaming-sidecar:no-cache` scripts use the new build.sh with repo-root context
- [x] T053 [P] Update `packages/runner-images/streaming-sidecar/README.md` with new architecture documentation — no Sway, no Sunshine, Wolf built from source, REST API endpoints, port mappings, env vars
- [x] T054 [P] Update `.github/copilot-instructions.md` and `AGENTS.md` to reflect the new streaming-sidecar architecture (Wolf from source, no config.toml, REST API on 9999, no Sway)
- [x] T055 Remove any remaining references to `streaming-sidecar` Sunshine mode or `sidecar-wolf` across the codebase — grep for `sunshine`, `SUNSHINE_`, `SIDECAR_MODE`, `sidecar-wolf`, `wolf-config.toml` in `packages/dillinger-core/` and update/remove
- [x] T056 Update `versioning.env` to bump `DILLINGER_STREAMING_SIDECAR_VERSION` to a new major version reflecting the architecture change
- [x] T057 End-to-end validation: build streaming-sidecar image, start container, verify Wolf starts with mDNS, pair with Moonlight, launch "Dillinger" app, call `POST /launch` with test app, verify video streams, call `POST /launch` with different app to verify game swap, call `POST /stop`, verify stream stays alive

---

## Dependencies

```
Phase 1 (Setup) ──────► Phase 2 (Docker Build) ──────► Phase 3 (US1: Config)
                                                           │
                                                           ├──► Phase 4 (US2: REST API)
                                                           │       │
                                                           │       ▼
                                                           ├──► Phase 5 (US3: Runner Lifecycle)
                                                           │
                                                           └──► Phase 6 (US4: Strip Features)
                                                           
Phase 2 ──► Phase 7 (US5: gst-wayland-display) [parallel with Phase 3-6]

Phase 3 + Phase 8 (US6: Entrypoint) ──► Phase 9 (US7: Core Integration)

All Phases ──► Phase 10 (Polish)
```

### Critical Path
```
T001-T007 → T008-T013 → T014-T018 → T019-T028 → T029-T032 → T041-T044 → T045-T050 → T057
```

### Parallel Opportunities

**Within Phase 1**: T006 and T007 can run in parallel (devcontainer vs package.json updates).

**Within Phase 2**: T008 and T009 are sequential (Stage 2 depends on Stage 1), but T012 (build.sh update) can be done in parallel with Dockerfile stages.

**Phases 3–6**: After Phase 2 completes:
- US1 (Phase 3: config) and US5 (Phase 7: gst-wayland-display) can run in parallel
- US4 (Phase 6: strip features) can run in parallel with US2 (Phase 4: REST API)
- US3 (Phase 5: runner lifecycle) depends on US2

**Within Phase 9**: T049 and T050 can run in parallel with each other and in parallel with T045-T048.

**Within Phase 10**: T051, T052, T053, T054 are all parallelizable.

---

## Implementation Strategy

### MVP Scope (Minimum Viable Streaming)
**Phases 1–3 + Phase 7 + Phase 8** — Setup, Docker build, hardcoded single-app config, gst-wayland-display verification, and entrypoint. This gets Wolf starting with `DILLINGER_MODE=1` and broadcasting via mDNS. Moonlight can discover and pair.

### Increment 2: Game Control
**Phase 4 (US2)** — REST API enables Dillinger to launch/stop games inside the compositor.

### Increment 3: Seamless Game Swap  
**Phase 5 (US3)** — Runner lifecycle decoupling enables game swapping without stream interruption.

### Increment 4: Cleanup & Integration
**Phases 6, 9, 10** — Strip unused features, integrate with Dillinger Core UI, polish.

---

## Summary

| Metric | Count |
|--------|-------|
| **Total tasks** | 57 |
| **Phase 1 (Setup)** | 7 |
| **Phase 2 (Foundational)** | 6 |
| **US1 (Single-App Config)** | 5 |
| **US2 (REST API)** | 10 |
| **US3 (Runner Lifecycle)** | 4 |
| **US4 (Strip Features)** | 4 |
| **US5 (gst-wayland-display)** | 4 |
| **US6 (Entrypoint & Agent)** | 4 |
| **US7 (Core Integration)** | 6 |
| **Phase 10 (Polish)** | 7 |
| **Parallel opportunities** | 16 tasks marked [P] |
| **MVP scope** | Phases 1–3, 7–8 (26 tasks) |
