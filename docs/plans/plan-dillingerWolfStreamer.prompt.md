# Plan: Dynamic Streaming Sidecar Architecture

Create a dedicated `dillinger-wolf-streamer` sidecar with Sway compositor, user-defined profiles, and comprehensive test modes. Test patterns can output to streaming (Moonlight) or X11 host display for local verification. Sine wave audio for test mode.

## Architecture Overview

```
┌───────────────────────────────────────────────────────────────────┐
│                    Sidecar Streaming Architecture                  │
├───────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Streamer Sidecar                                            │  │
│  │  • Sway compositor (user profiles, restart on change)       │  │
│  │  • Wolf server (VA-API / NVENC encoding)                    │  │
│  │  • Test modes: Stream test / X11 host test                  │  │
│  │  • Audio: PulseAudio capture / Sine wave for tests          │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  Settings → Streaming:                                             │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  GPU: [AMD VA-API ▼]        Idle Timeout: [15] min          │  │
│  │  Wayland Socket: [/run/user/1000/wayland-dillinger]         │  │
│  │  Codec: [H264 ▼]  Quality: [High ▼]                         │  │
│  │                                                              │  │
│  │  ┌─ Streaming Profiles ─────────────────────────────────┐   │  │
│  │  │ ● 1080p60 (default)  [Edit] [Clone] [Delete]         │   │  │
│  │  │ ○ 1440p60            [Edit] [Clone] [Delete]         │   │  │
│  │  │ ○ 4K30               [Edit] [Clone] [Delete]         │   │  │
│  │  │ ○ Ultrawide          [Edit] [Clone] [Delete]         │   │  │
│  │  │                      [+ New Profile]                 │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  │                                                              │  │
│  │  ┌─ Test Streaming ─────────────────────────────────────┐   │  │
│  │  │ Profile: [1080p60 ▼]                                 │   │  │
│  │  │ Pattern: [SMPTE bars ▼]                              │   │  │
│  │  │ Audio:   ● Sine wave (440Hz)                         │   │  │
│  │  │                                                      │   │  │
│  │  │ [▶ Test to Stream]    [▶ Test to Host Display]       │   │  │
│  │  │ [■ Stop Test]                                        │   │  │
│  │  │                                                      │   │  │
│  │  │ Status: ● Streaming - Connect Moonlight to verify    │   │  │
│  │  │         ○ Host Display - Check your monitor          │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  │                                                              │  │
│  │  Paired Clients: 2 devices  [Manage...]                     │  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### 1. Create streaming sidecar image
**Location:** `packages/runner-images/streaming-sidecar/`

Dockerfile with Sway, Wolf, GStreamer (VA-API + NVENC + test sources), PulseAudio. Three modes via `SIDECAR_MODE`:
- `game` - Wayland capture from game runners
- `test-stream` - Test pattern to Wolf/Moonlight
- `test-x11` - Test pattern to host X11 display

### 2. Implement test pattern modes in sidecar entrypoint
- `test-stream`: `videotestsrc pattern={p} ! waylandsink` → Sway → Wolf → Moonlight
- `test-x11`: `videotestsrc pattern={p} ! xvimagesink display=$DISPLAY` → Host X11 window
- Both include: `audiotestsrc wave=sine freq=440 ! pulsesink` (440Hz A note)

### 3. Implement Sway config management API
**Location:** `packages/dillinger-core/app/api/settings/sway-configs/route.ts`

CRUD for configs in `dillinger_root/sway-configs/`. Seed defaults: 1080p60, 1440p60, 4K30, Ultrawide.

### 4. Add Sway profile editor UI in settings
List profiles with edit/clone/delete, create modal with resolution presets, refresh rate, custom Sway directives, set-as-default toggle.

### 5. Add streaming settings section
**Location:** `packages/dillinger-core/app/settings/page.tsx`

GPU selector, idle timeout, Wayland socket path, codec/quality, default profile, paired clients, and test panel.

### 6. Create streaming settings API
**Location:** `packages/dillinger-core/app/api/settings/streaming/route.ts`

Persist streaming config (GPU, timeout, socket path, codec, default profile).

### 7. Create streaming test API
**Location:** `packages/dillinger-core/app/api/streaming/test/route.ts`

- `POST {mode: 'stream' | 'x11', profile, pattern}` - Start test
- `GET` - Return test status (running, mode, pattern)
- `DELETE` - Stop test

### 8. Implement test streaming UI in settings
Profile dropdown, pattern selector, two test buttons ("Test to Stream" and "Test to Host Display"), stop button, status with mode-specific instructions.

### 9. Extend game schema
**Location:** `packages/shared/src/types/`

Add `streamingProfile?: string` field to game type.

### 10. Add profile selector to game edit UI
Dropdown in game details: "Default" + user profiles.

### 11. Implement sidecar lifecycle in DockerService
- `ensureStreamerSidecar(configName, mode)` - Start/restart with config
- Compare running state, restart if config or mode changed
- For `test-x11` mode: mount host X11 socket and set `DISPLAY`

### 12. Implement audio capture in sidecar
- Game mode: PulseAudio null sink + monitor source for Wolf capture
- Test modes: `audiotestsrc wave=sine freq=440`

### 13. Implement idle auto-stop
Sway IPC client monitoring, user-configured timeout (minutes), graceful shutdown.

### 14. Slim runner base for streaming mode
**Location:** `packages/runner-images/base/entrypoint.sh`

`STREAMING_MODE=sidecar` skips Wolf setup, expects external Wayland/PulseAudio.

### 15. Modify DockerService.launchGame()
**Location:** `packages/dillinger-core/lib/services/dockerService.ts`

Resolve game's profile, ensure sidecar in `game` mode, mount sockets, set env vars.

## Reference Tables

### Test Modes

| Mode | Output | Use Case | GStreamer Pipeline |
|------|--------|----------|-------------------|
| `test-stream` | Sway → Wolf → Moonlight | Verify streaming to client works | `videotestsrc ! waylandsink` |
| `test-x11` | Host X11 display window | Verify GStreamer/GPU locally | `videotestsrc ! xvimagesink` |

Both modes include `audiotestsrc wave=sine freq=440` (440Hz sine wave).

### Default Sway Profiles

| Name | Resolution | Refresh | Notes |
|------|------------|---------|-------|
| 1080p60 | 1920×1080 | 60 Hz | Default, broad compatibility |
| 1440p60 | 2560×1440 | 60 Hz | Higher quality |
| 4K30 | 3840×2160 | 30 Hz | 4K, bandwidth limited |
| Ultrawide | 3440×1440 | 60 Hz | 21:9 displays |

### Test Patterns

| Pattern | GStreamer Value | Description |
|---------|-----------------|-------------|
| SMPTE bars | `smpte` | Standard TV test |
| Color bars | `bar` | Simple colors |
| Checkerboard | `checkers-8` | Motion clarity test |
| Ball | `ball` | Bouncing animation |
| Snow | `snow` | Random noise |

## Key Design Decisions

1. **GPU Selection**: User selects in settings (AMD VA-API or NVIDIA NVENC)
2. **Sidecar Lifecycle**: Start on first stream request, auto-stop after idle timeout (user-configured minutes)
3. **Wayland Compositor**: Sway (more features than Cage), runs in sidecar
4. **Audio Capture**: Captured in sidecar from runner's PulseAudio output
5. **Config Changes**: Restart sidecar when different Sway profile needed
6. **Default Configs**: Provide sensible presets users can clone and modify
7. **Test Audio**: 440Hz sine wave tone
