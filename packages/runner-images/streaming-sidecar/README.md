# Dillinger Streaming Sidecar

A dedicated streaming sidecar that runs Sway compositor and Wolf server, allowing dynamic game streaming without pre-configured apps.

## Overview

Unlike the embedded Wolf approach where each game container runs its own streaming server, this sidecar architecture separates concerns:

- **Sidecar Container**: Runs Sway compositor + Wolf server + PulseAudio capture
- **Game Runners**: Connect to sidecar's Wayland display and PulseAudio sink
- **Moonlight Clients**: Connect to Wolf on the sidecar

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Streaming Sidecar Container                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │   Sway   │  │   Wolf   │  │   GStreamer          │  │
│  │ Headless │──│  Server  │──│  VA-API / NVENC      │  │
│  │Compositor│  │          │  │                      │  │
│  └────┬─────┘  └────┬─────┘  └──────────────────────┘  │
│       │             │                                   │
│  Wayland Socket     │ Captures display + audio         │
│  /run/dillinger/    │                                   │
│  wayland-dillinger  │ Ports: 47984, 47989,             │
│       │             │        47999, 48010              │
│       │             │                                   │
│  PulseAudio Socket  │                                   │
│  /run/dillinger/    │                                   │
│  pulse-socket       │                                   │
└───────┼─────────────┼───────────────────────────────────┘
        │             │
        ▼             ▼
┌─────────────┐  ┌─────────────┐
│ Game Runner │  │  Moonlight  │
│ Container   │  │   Client    │
└─────────────┘  └─────────────┘
```

## Modes

### Game Mode (`SIDECAR_MODE=game`)
Normal operation - Sway waits for game runners to connect.
- Idle timeout auto-stops sidecar when no clients connected
- Games render to Sway, Wolf captures and streams

### Test Stream Mode (`SIDECAR_MODE=test-stream`)
Displays a GStreamer test pattern through the streaming pipeline.
- Verify Moonlight connectivity
- Test encoder performance
- 440Hz sine wave audio

### Test X11 Mode (`SIDECAR_MODE=test-x11`)
Displays test pattern on host X11 display.
- Verify GStreamer and GPU work locally
- Debug display issues
- Requires mounting `/tmp/.X11-unix` and setting `DISPLAY`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SIDECAR_MODE` | `game` | Operating mode: `game`, `test-stream`, `test-x11` |
| `SWAY_CONFIG_NAME` | `default` | Name of Sway profile to load |
| `IDLE_TIMEOUT_MINUTES` | `15` | Auto-stop after idle (0 = disabled) |
| `RESOLUTION_WIDTH` | `1920` | Output width |
| `RESOLUTION_HEIGHT` | `1080` | Output height |
| `REFRESH_RATE` | `60` | Refresh rate in Hz |
| `GPU_TYPE` | `auto` | Encoder: `auto`, `amd`, `nvidia` |
| `TEST_PATTERN` | `smpte` | Test pattern: `smpte`, `bar`, `checkerboard`, `ball`, `snow` |
| `WAYLAND_SOCKET_PATH` | `/run/dillinger/wayland-dillinger` | Wayland socket location |
| `WOLF_CFG_FOLDER` | `/data/wolf` | Wolf configuration directory |

## Exposed Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 47984 | TCP/UDP | Wolf HTTPS |
| 47989 | TCP/UDP | Wolf HTTP |
| 47999 | TCP/UDP | Wolf Control |
| 48010 | TCP/UDP | Wolf RTSP |
| 9999 | TCP | Sidecar control API |

## Volumes

- `/data/wolf` - Wolf configuration and paired clients
- `/data/sway-configs` - User Sway profiles
- `/run/dillinger` - Runtime sockets (Wayland, PulseAudio)

## Building

```bash
# From project root
pnpm docker:build:streaming-sidecar

# Or directly
cd packages/runner-images/streaming-sidecar
./build.sh
```

## Usage

### Start Sidecar for Streaming
```bash
docker run -d \
  --name dillinger-streamer \
  -v dillinger_root:/data \
  -v /run/dillinger:/run/dillinger \
  -p 47984:47984 -p 47989:47989 -p 47999:47999 -p 48010:48010 \
  --device /dev/dri \
  -e GPU_TYPE=amd \
  -e SIDECAR_MODE=game \
  -e IDLE_TIMEOUT_MINUTES=15 \
  ghcr.io/thrane20/dillinger/streaming-sidecar:0.3.1
```

### Run Test Pattern
```bash
docker run -d \
  --name dillinger-test \
  -v dillinger_root:/data \
  -p 47984:47984 -p 47989:47989 -p 47999:47999 -p 48010:48010 \
  --device /dev/dri \
  -e SIDECAR_MODE=test-stream \
  -e TEST_PATTERN=smpte \
  ghcr.io/thrane20/dillinger/streaming-sidecar:0.3.1
```

### Connect Game Runner
```bash
docker run -it \
  --name my-game \
  -v /run/dillinger:/run/dillinger \
  -e WAYLAND_DISPLAY=wayland-dillinger \
  -e XDG_RUNTIME_DIR=/run/dillinger \
  -e PULSE_SERVER=unix:/run/dillinger/pulse-socket \
  -e STREAMING_MODE=sidecar \
  ghcr.io/thrane20/dillinger/runner-wine:0.3.1
```

## Sway Profiles

Sway profiles are stored as `.conf` files in `/data/sway-configs/`.
The sidecar loads the profile specified by `SWAY_CONFIG_NAME`.

### Default Profiles (seeded by Dillinger):

- **1080p60** - 1920×1080 @ 60Hz (default)
- **1440p60** - 2560×1440 @ 60Hz
- **4K30** - 3840×2160 @ 30Hz
- **Ultrawide** - 3440×1440 @ 60Hz

### Custom Profile Example

Create `/data/sway-configs/custom.conf`:
```
output HEADLESS-1 {
    resolution 2560x1440@144Hz
    position 0 0
    bg #1a1a2e solid_color
}

default_border none
gaps inner 0
gaps outer 0

for_window [class=".*"] fullscreen enable
for_window [app_id=".*"] fullscreen enable
```

## Control API

Simple HTTP API on port 9999 for status queries:

```bash
curl http://localhost:9999
# {"status":"running","mode":"game","profile":"1080p60","resolution":"1920x1080","gpu":"amd"}
```
