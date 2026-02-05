# Dillinger Streaming Graph Spec

## 0) Goals
- Provide a **node graph model** that can represent:
  - App/game launch and lifecycle
  - Input routing (keyboard/mouse/gamepad/touch)
  - Virtual compositor outputs (headless Wayland, virtual monitors)
  - Gamescope integration/mappings (nested/headless, Xwayland, scaling)
  - Audio capture/mix (Pulse/PipeWire/ALSA) and routing
  - Visual/audio processing pipeline (scale/convert/encode/tee)
  - Multiple simultaneous sinks: Sunshine/Moonlight, WebRTC, OBS, Twitch/RTMP, file recording
- Support **power user composition** while allowing **one‑click presets**.

## 1) Core constraints
- All pipelines must be **expressible as a directed graph** with typed ports.
- Graph validation must prevent invalid wiring (e.g., audio → video port).
- Nodes must declare:
  - `id`, `type`, `displayName`
  - `inputs[]`, `outputs[]` with typed media contracts
  - `attributes` with schema + defaults + validation
  - `runtime` hints (container/host, privileges, devices)
- Graph must compile into:
  - a) a Wolf‑style compositor session and app runtime
  - b) a concrete media graph (typically GStreamer, but allow other backends)
  - c) a control plane (start/stop, reconnect, hot reload safe changes)

## 2) System architecture narrative (concise)
Dillinger will model streaming as a typed node graph that is **compiled** into a runtime plan. The graph treats the **session lifecycle**, **compositor/display**, **input**, **media capture/transform/encode**, and **sink delivery** as explicit nodes. This allows complex flows (e.g., one capture feeding Sunshine + WebRTC + OBS + file recording) while keeping the default preset simple and reliable.

The graph is stored in `/data/storage/streaming-graph.json` and referenced by `settings.json`. Presets are global and represented as named graph variants with unique IDs. Each game can explicitly select a preset; otherwise the system uses the default preset. The factory default preset is shipped and editable; a **reset to factory** action is provided with confirmation.

During editing, the canvas UI runs **warning‑level validation** (inline edge badges + summary panel). However, **Run is blocked** until all blocking issues are resolved. Blocking issues include: invalid port wiring, missing required attributes, and failing runtime prerequisites (e.g., no DRM device, missing uinput access, unavailable audio backend, or occupied ports).

The compiler performs five phases: Normalize → Validate → Plan → Generate → Execute. Planning chooses container/host placement and selects encoder/capture methods based on device checks (DRM/VAAPI/NVENC, uinput, audio stack). Generation outputs the compositor config, runner command lines, concrete media pipelines (GStreamer by default), and the control‑plane wiring. Execution starts components in dependency order and enables partial restarts for hot‑swappable attributes (e.g., bitrate) while requiring restart for non‑hot‑swappable attributes (e.g., resolution, monitor layout).

Critically, Dillinger **does not run Wolf directly**; it reconstructs a compatible sidecar (`ghcr.io/thrane20/dillinger/streaming-sidecar`) using the same GStreamer dependencies and behavior. The node graph compiler emits the configuration artifacts required for this sidecar so the runtime can be fully owned by Dillinger.

## 3) Node taxonomy (required)

### A. Session & lifecycle
#### SessionRoot
- Role: root container for a graph (single instance)
- Inputs: `control`
- Outputs: `control`, `timing`
- Runtime: host
- Attributes (summary): `name`, `presetId`, `description`

#### GameLaunch / AppLaunch
- Role: start a game/app process (Steam, native, emulator, custom cmd)
- Inputs: `control`
- Outputs: `control`
- Runtime: runner container or host
- Attributes: `launcherType`, `appId`, `command`, `args`, `env`, `workingDir`, `waitForReady`

#### RunnerContainer
- Role: container runtime wrapper (devices, mounts, env)
- Inputs: `control`
- Outputs: `control`
- Runtime: host (manages container)
- Attributes: `image`, `mounts`, `devices`, `capabilities`, `networkMode`, `userId`, `groupId`

### B. Compositor & display
#### VirtualCompositor
- Role: headless Wayland compositor (Wolf‑like)
- Inputs: `control`, `timing`
- Outputs: `video/raw`, `control`
- Runtime: sidecar container
- Attributes: `backend` (wlroots), `xwaylandEnabled`, `idleTimeout`, `socketPath`, `gpuPreference`

#### VirtualMonitor
- Role: virtual output definition
- Inputs: `control`
- Outputs: `video/raw`
- Runtime: sidecar container
- Attributes: `width`, `height`, `refreshRate`, `colorDepth`, `hdr`, `name`

#### GamescopeSession
- Role: optional nested or headless Gamescope
- Inputs: `video/raw`, `control`
- Outputs: `video/raw`, `control`
- Runtime: runner container or sidecar
- Attributes: `mode` (headless/nested), `scale`, `xwayland`, `fullscreen`, `hdr`

#### XwaylandBridge
- Role: X11 compatibility layer
- Inputs: `control`
- Outputs: `control`
- Runtime: sidecar container
- Attributes: `enabled`, `displayNumber`, `x11SocketPath`

### C. Input plane
#### InputSource
- Role: input stream source (Moonlight, local devices, virtual)
- Inputs: `control`
- Outputs: `input/events`
- Runtime: host or sidecar
- Attributes: `sourceType`, `deviceFilters`, `clientId`

#### InputMapper
- Role: remap, deadzones, sensitivity
- Inputs: `input/events`
- Outputs: `input/events`
- Runtime: host or sidecar
- Attributes: `layout`, `deadzone`, `sensitivity`, `inversion`, `profiles`

#### InputInjector
- Role: inject events into compositor/Wayland/uinput
- Inputs: `input/events`, `control`
- Outputs: `control`
- Runtime: sidecar or runner container
- Attributes: `backend` (uinput/wayland), `focusPolicy`, `captureMode`

#### CursorComposer
- Role: cursor rendering/capture mode
- Inputs: `video/raw`, `input/events`
- Outputs: `video/raw`
- Runtime: sidecar
- Attributes: `cursorMode` (hw/sw/hidden), `scale`, `theme`

### D. Video pipeline
#### VideoCapture
- Role: capture compositor output (wlroots screencopy or dmabuf)
- Inputs: `video/raw`, `control`
- Outputs: `video/raw`
- Runtime: sidecar
- Attributes: `captureMethod` (screencopy/dmabuf), `monitorId`, `framePacing`

#### VideoTransform
- Role: scale/crop/convert
- Inputs: `video/raw`
- Outputs: `video/raw`
- Runtime: sidecar
- Attributes: `scale`, `crop`, `colorspace`, `hdrToSdr`, `framerate`

#### VideoEncoder
- Role: encode to H264/H265/AV1
- Inputs: `video/raw`, `control`
- Outputs: `video/encoded`
- Runtime: sidecar or runner container
- Attributes: `codec`, `bitrate`, `profile`, `level`, `rateControl`, `gopSize`, `preset`, `maxBitrate`

#### VideoTee
- Role: fan‑out video
- Inputs: `video/raw` or `video/encoded`
- Outputs: `video/raw` or `video/encoded` (multiple)
- Runtime: sidecar
- Attributes: `mode` (raw/encoded), `maxBranches`

#### VideoStats
- Role: fps, dropped frames, latency
- Inputs: `video/raw` or `video/encoded`
- Outputs: `control`
- Runtime: sidecar
- Attributes: `sampleIntervalMs`, `emitTo` (metrics/logs)

### E. Audio pipeline
#### AudioCapture
- Role: capture audio (PipeWire/Pulse/ALSA)
- Inputs: `control`
- Outputs: `audio/raw`
- Runtime: sidecar or runner container
- Attributes: `backend`, `device`, `channels`, `rate`

#### AudioMixer
- Role: mix game + mic + system
- Inputs: `audio/raw` (multiple)
- Outputs: `audio/raw`
- Runtime: sidecar
- Attributes: `levels`, `ducking`, `limiter`

#### AudioEncoder
- Role: encode audio
- Inputs: `audio/raw`, `control`
- Outputs: `audio/encoded`
- Runtime: sidecar
- Attributes: `codec` (opus/aac), `bitrate`, `frameSize`, `complexity`

#### AudioTee
- Role: fan‑out audio
- Inputs: `audio/raw` or `audio/encoded`
- Outputs: `audio/raw` or `audio/encoded` (multiple)
- Runtime: sidecar
- Attributes: `mode`, `maxBranches`

#### AudioStats
- Role: audio level/latency stats
- Inputs: `audio/raw` or `audio/encoded`
- Outputs: `control`
- Runtime: sidecar
- Attributes: `sampleIntervalMs`, `emitTo`

### F. Sinks / outputs
#### SunshineSink
- Role: Moonlight compatible sink
- Inputs: `video/encoded` (preferred) or `video/raw` (requires internal encoder), `audio/encoded` or `audio/raw`, `control`
- Outputs: `control`
- Runtime: sidecar
- Attributes: `mode` (encoded/raw), `pairing`, `ports`, `networkBind`

#### WebRTCSink
- Role: WHIP/WHEP, ICE/STUN/TURN
- Inputs: `video/encoded` and `audio/encoded`, `control`
- Outputs: `control`
- Runtime: sidecar or host
- Attributes: `whipUrl`, `stunServers`, `turnServers`, `codecPrefs`, `bitrate`

#### OBSSink
- Role: NDI/RTMP/Virtual Camera/PipeWire output
- Inputs: `video/raw` or `video/encoded`, `audio/raw` or `audio/encoded`, `control`
- Outputs: `control`
- Runtime: host or sidecar
- Attributes: `mode` (NDI/RTMP/VC/PipeWire), `target`, `format`

#### RTMPTwitchSink
- Role: Twitch RTMP(S)
- Inputs: `video/encoded`, `audio/encoded`, `control`
- Outputs: `control`
- Runtime: sidecar
- Attributes: `endpoint`, `streamKeyRef`, `reconnect`

#### FileRecordingSink
- Role: local recording
- Inputs: `video/encoded` and `audio/encoded` (or raw with internal encoder), `control`
- Outputs: `control`
- Runtime: sidecar or host
- Attributes: `container` (mkv/mp4), `path`, `segmentDuration`, `maxSize`

#### PreviewSink
- Role: local preview thumbnail or debug
- Inputs: `video/raw`, `control`
- Outputs: `control`
- Runtime: host
- Attributes: `fps`, `size`, `enableInEditor`

### G. Observability & control
#### GraphMetrics
- Inputs: `control`
- Outputs: `control`
- Runtime: host
- Attributes: `exporter` (prom/otlp), `endpoint`, `labels`

#### LogSink
- Inputs: `control`
- Outputs: `control`
- Runtime: host
- Attributes: `level`, `target`

#### HealthCheck
- Inputs: `control`
- Outputs: `control`
- Runtime: host
- Attributes: `interval`, `timeout`, `dependencies`

#### BandwidthController
- Inputs: `control`
- Outputs: `control`
- Runtime: host
- Attributes: `policy`, `minBitrate`, `maxBitrate`, `probeInterval`

## 4) Port typing system (required)

### Port contracts
- `video/raw` with caps: `{ width, height, fps, format, colorspace, hdr }`
- `video/encoded` with codec info: `{ codec, profile, level, bitrate }`
- `audio/raw`: `{ rate, channels, layout }`
- `audio/encoded`: `{ codec, bitrate, frameSize }`
- `input/events`: `{ devices, layout }`
- `control`: `{ rpcVersion, topic }`
- `clock`/`timing`: `{ rate, jitterTolerance }`

### Compatibility rules
- Audio → video or video → audio is always invalid.
- `video/raw` → `video/encoded` requires a `VideoEncoder` (auto‑insert if missing).
- `audio/raw` → `audio/encoded` requires `AudioEncoder` (auto‑insert if missing).
- Mismatched resolution or framerate requires `VideoTransform`.
- Encoded codec mismatch (e.g., AV1 into H264‑only sink) requires re‑encode or is invalid.
- Graph editor shows warnings; compile step blocks on any incompatible link.

## 5) Attribute schema format (required)
Each node exposes a JSON‑schema‑like descriptor:
- `label`, `description`, `type`, `default`, `constraints`, `visibility`, `advanced`
- `validation` errors and suggested fixes

### Example schema fragment
```json
{
  "id": "VideoEncoder",
  "attributes": {
    "codec": {
      "label": "Codec",
      "type": "enum",
      "default": "h264",
      "constraints": {"enum": ["h264", "h265", "av1"]}
    },
    "bitrate": {
      "label": "Bitrate (kbps)",
      "type": "number",
      "default": 12000,
      "constraints": {"min": 1000, "max": 100000},
      "advanced": false
    },
    "rateControl": {
      "label": "Rate Control",
      "type": "enum",
      "default": "cbr",
      "constraints": {"enum": ["cbr", "vbr"]},
      "advanced": true
    }
  }
}
```

## 6) Graph compilation model (required)

### Phase 1: Normalize
- Apply defaults to all nodes and edges.
- Expand presets into full graphs.
- Resolve environment variables/secrets references.

### Phase 2: Validate
- Port type checking and attribute validation.
- Device‑check gating (DRM, VAAPI/NVENC, uinput, Pulse/PipeWire/ALSA, ports).
- Block compilation if invalid.

### Phase 3: Plan
- Assign nodes to host vs runner container vs sidecar container.
- Choose capture method (wlroots screencopy vs dmabuf).
- Select encoders based on GPU availability.

### Phase 4: Generate
- Compositor config (virtual monitors, refresh rates).
- Runner launch commands.
- Media pipeline graphs (GStreamer by default).
- Control RPC wiring.
- Explicit reconstruction of the sidecar (not Wolf directly), using Wolf’s known capabilities but Dillinger’s own image and config.

### Phase 5: Execute
- Start in dependency order.
- Hot‑swap attributes (e.g., bitrate) without restart.
- Restart required for resolution/compositor changes.

### Hot‑swap vs restart matrix (example)
- Hot‑swap: bitrate, rateControl, audio levels, sink destinations.
- Restart: resolution, refresh rate, compositor backend, capture method.

## 7) Canvas UI behavior (required)
- Node palette grouped by category.
- Drag/drop creation.
- Wire creation with port highlighting and compatibility hints.
- Selection inspector panel with schema‑driven editors.
- Inline errors/warnings on nodes and edges + summary panel.
- Graph‑level actions: Run / Stop / Restart changed nodes.
- Presets: save, apply to game, clone (new ID), reset to factory (confirm).
- Versioning: save/load graphs; export/import JSON.
- Validation: warnings during edit; Run blocked until resolved.

## 8) Graph JSON format (required)
Stored at `/data/storage/streaming-graph.json` and referenced from `settings.json`.

### Example graph (Game → VirtualCompositor → Capture → Tee → Sunshine + WebRTC + OBS, plus Input)
```json
{
  "schemaVersion": "1.0.0",
  "nodeSchemaVersions": {
    "VirtualCompositor": "1.0.0",
    "VideoEncoder": "1.0.0"
  },
  "validation": {
    "lastRunAt": "2026-02-05T12:00:00Z",
    "status": "ok",
    "issues": []
  },
  "presets": [
    {
      "id": "preset-default",
      "name": "Moonlight Gaming",
      "isFactory": true,
      "updatedAt": "2026-02-05T12:00:00Z",
      "graph": {
        "nodes": [
          {"id":"session","type":"SessionRoot","displayName":"Session"},
          {"id":"runner","type":"RunnerContainer","displayName":"Runner"},
          {"id":"launch","type":"GameLaunch","displayName":"Launch"},
          {"id":"comp","type":"VirtualCompositor","displayName":"Compositor"},
          {"id":"mon","type":"VirtualMonitor","displayName":"Monitor"},
          {"id":"capture","type":"VideoCapture","displayName":"Capture"},
          {"id":"venc","type":"VideoEncoder","displayName":"Video Encode"},
          {"id":"aenc","type":"AudioEncoder","displayName":"Audio Encode"},
          {"id":"vtee","type":"VideoTee","displayName":"Video Tee"},
          {"id":"atee","type":"AudioTee","displayName":"Audio Tee"},
          {"id":"sun","type":"SunshineSink","displayName":"Sunshine"},
          {"id":"rtc","type":"WebRTCSink","displayName":"WebRTC"},
          {"id":"obs","type":"OBSSink","displayName":"OBS"},
          {"id":"input","type":"InputSource","displayName":"Input"},
          {"id":"map","type":"InputMapper","displayName":"Mapper"},
          {"id":"inject","type":"InputInjector","displayName":"Injector"}
        ],
        "edges": [
          {"from":"session","out":"control","to":"runner","in":"control"},
          {"from":"runner","out":"control","to":"launch","in":"control"},
          {"from":"session","out":"control","to":"comp","in":"control"},
          {"from":"comp","out":"video/raw","to":"capture","in":"video/raw"},
          {"from":"capture","out":"video/raw","to":"venc","in":"video/raw"},
          {"from":"venc","out":"video/encoded","to":"vtee","in":"video/encoded"},
          {"from":"vtee","out":"video/encoded#1","to":"sun","in":"video/encoded"},
          {"from":"vtee","out":"video/encoded#2","to":"rtc","in":"video/encoded"},
          {"from":"vtee","out":"video/encoded#3","to":"obs","in":"video/encoded"},
          {"from":"aenc","out":"audio/encoded","to":"atee","in":"audio/encoded"},
          {"from":"atee","out":"audio/encoded#1","to":"sun","in":"audio/encoded"},
          {"from":"atee","out":"audio/encoded#2","to":"rtc","in":"audio/encoded"},
          {"from":"atee","out":"audio/encoded#3","to":"obs","in":"audio/encoded"},
          {"from":"input","out":"input/events","to":"map","in":"input/events"},
          {"from":"map","out":"input/events","to":"inject","in":"input/events"}
        ]
      }
    }
  ]
}
```

## 9) Compilation pseudocode (required)
```pseudo
function compileGraph(graph, presetId):
  normalized = normalize(graph, presetId)
  validation = validate(normalized)
  if validation.hasBlockingIssues:
     return error(validation)

  plan = planExecution(normalized)
  artifacts = generateArtifacts(plan)
  return execute(plan, artifacts)

function validate(graph):
  issues = []
  for edge in graph.edges:
    if !portCompatible(edge): issues.push(blocking)
  for node in graph.nodes:
    if missingRequiredAttributes(node): issues.push(blocking)
  deviceIssues = runDeviceChecks(graph)
  issues += deviceIssues
  return {status, issues}

function runDeviceChecks(graph):
  checks = [DRM, VAAPI/NVENC, uinput, audioBackend, ports]
  return checks.filter(failed).map(blockingIssue)
```

## 10) UI interaction spec (required)
- Canvas only (custom implementation).
- Palette groups: Session, Compositor, Input, Video, Audio, Sinks, Observability.
- Drag/drop nodes onto canvas; snap/align guides.
- Wire creation with port highlighting; incompatible ports show red hints.
- Inspector panel shows schema‑driven fields with basic/advanced toggles.
- Inline edge warnings + global validation panel.
- Run blocked until all blocking issues resolved.
- Preset management: create, edit, clone (new ID), delete, reset to factory (confirm).
- Apply preset to game explicitly; default preset applies otherwise.
- Export/import JSON with schema version validation.

## 11) Security & secrets
- Secrets (RTMP keys, TURN creds, Sunshine pairing) stored encrypted.
- Graph JSON references secrets by ID only.
- Node runtime declares privileges: uinput, DRM, network ports, container caps.
- Validation blocks if required privileges are unavailable.

## 12) Non‑goals and future extensions
### Non‑goals
- Third‑party node plugins (core only for now).
- Cross‑platform support outside Linux/Wayland.
- Automatic “fix‑up” of invalid graphs without user confirmation.

### Future extensions
- Multi‑user preset namespaces.
- Advanced template generator with hardware‑specific recommendations.
- Dynamic graph reconfiguration without any restarts.
