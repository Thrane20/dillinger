# Gamescope and Moonlight Streaming Features

This document describes the new Gamescope compositor and Moonlight streaming features added to Dillinger.

## Overview

Dillinger now supports:

1. **Gamescope Compositor**: A micro-compositor for upscaling, FPS limiting, and window management
2. **Moonlight Streaming**: Network game streaming using the Moonlight protocol (from Games on Whales/Wolf)

These features are built into the base runner image and can be enabled per-game through the API or UI.

## Architecture

### Base Runner Image

The new `dillinger/runner-base:latest` image provides:

- **X11/Wayland Display**: Full display server support
- **GPU Drivers**: NVIDIA, AMD, Intel hardware acceleration
- **PulseAudio**: Audio system with host forwarding
- **Gamescope**: Compositor with upscaling (v3.15.14)
- **Wolf/Moonlight**: Streaming server components
- **GStreamer**: Media encoding/decoding pipeline

### Runner Images

Both `dillinger/runner-wine` and `dillinger/runner-linux-native` now extend from the base image, inheriting all its capabilities.

## Gamescope Configuration

Gamescope can be configured per-game in the game settings:

```json
{
  "settings": {
    "gamescope": {
      "enabled": true,
      "width": 1920,
      "height": 1080,
      "refreshRate": 60,
      "fullscreen": true,
      "upscaler": "fsr",
      "inputWidth": 1280,
      "inputHeight": 720,
      "limitFps": 60
    }
  }
}
```

### Options

- **enabled** (boolean): Enable gamescope for this game
- **width** (number): Output resolution width (default: 1920)
- **height** (number): Output resolution height (default: 1080)
- **refreshRate** (number): Refresh rate in Hz (default: 60)
- **fullscreen** (boolean): Launch in fullscreen mode
- **upscaler** (string): Upscaling filter - `auto`, `fsr`, `nis`, `linear`, `nearest`
- **inputWidth** (number): Input resolution width for upscaling
- **inputHeight** (number): Input resolution height for upscaling
- **limitFps** (number): Frame rate limit

### Use Cases

1. **Upscaling older games**: Run at 720p, upscale to 1080p or 4K
2. **Frame rate limiting**: Prevent games from running at uncapped FPS
3. **Fullscreen management**: Better fullscreen handling than native games
4. **Integer scaling**: Pixel-perfect scaling for retro games

## Moonlight Streaming

Moonlight streaming allows you to stream games over the network to any Moonlight client (desktop, mobile, etc.).

```json
{
  "settings": {
    "moonlight": {
      "enabled": true,
      "quality": "high",
      "framerate": 60,
      "resolution": "1920x1080",
      "codec": "h265",
      "audioCodec": "opus"
    }
  }
}
```

### Options

- **enabled** (boolean): Enable Moonlight streaming
- **quality** (string): Quality preset - `low`, `medium`, `high`, `ultra`
- **bitrate** (number): Custom bitrate in Mbps (overrides quality preset)
- **framerate** (number): Target FPS - `30`, `60`, `120`
- **resolution** (string): Streaming resolution (e.g., "1920x1080")
- **codec** (string): Video codec - `h264`, `h265`, `av1`
- **audioCodec** (string): Audio codec - `opus`, `aac`

### Quality Presets

- **low**: 5Mbps, good for slow networks
- **medium**: 10Mbps, balanced quality/bandwidth
- **high**: 20Mbps, high quality (default)
- **ultra**: 50Mbps, maximum quality

### Ports

When Moonlight is enabled, the following ports are exposed:

- **47984/tcp**: HTTPS
- **47989/tcp**: HTTP
- **47999/udp**: Control
- **48010/tcp**: RTSP
- **48100/udp**: Video
- **48200/udp**: Audio

Make sure these ports are accessible if streaming over a network.

## API Usage

### Update Game Settings

Use the new PATCH endpoint to update game settings:

```bash
PATCH /api/games/:id/settings
Content-Type: application/json

{
  "gamescope": {
    "enabled": true,
    "width": 2560,
    "height": 1440,
    "upscaler": "fsr"
  },
  "moonlight": {
    "enabled": true,
    "quality": "ultra",
    "framerate": 60
  }
}
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "game-uuid",
    "title": "My Game",
    "settings": {
      "gamescope": { ... },
      "moonlight": { ... }
    }
  },
  "message": "Game settings updated successfully"
}
```

### Launch Game

When launching a game, the docker-service automatically reads the gamescope and moonlight settings and configures the container accordingly.

```bash
POST /api/games/:id/launch
```

The container will be launched with appropriate environment variables:

```bash
# Gamescope
USE_GAMESCOPE=true
GAMESCOPE_WIDTH=2560
GAMESCOPE_HEIGHT=1440
GAMESCOPE_UPSCALER=fsr

# Moonlight
ENABLE_MOONLIGHT=true
MOONLIGHT_QUALITY=ultra
MOONLIGHT_FPS=60
```

## Building Runner Images

### Build All Images

```bash
pnpm run docker:build:runners
```

This will build:
1. Base runner image
2. Linux native runner
3. Wine runner

### Build Individual Images

```bash
# Base image
pnpm run docker:build:base

# Linux native
pnpm run docker:build:runner:linux-native

# Wine
pnpm run docker:build:runner:wine
```

### Build Without Cache

```bash
pnpm run docker:build:runners:no-cache
```

## Frontend Integration

The frontend should provide UI elements for:

1. **Gamescope Settings Panel**:
   - Enable/disable toggle
   - Resolution dropdown (common presets)
   - Upscaler selection
   - Fullscreen checkbox
   - FPS limit slider

2. **Moonlight Settings Panel**:
   - Enable/disable toggle
   - Quality preset dropdown
   - Advanced settings (codec, bitrate, resolution)

3. **Game Launch Dialog**:
   - Show if gamescope is enabled
   - Show if moonlight streaming is available
   - Display moonlight connection URL

## Testing

### Test Gamescope

1. Enable gamescope for a game
2. Launch the game
3. Check logs for gamescope initialization
4. Verify upscaling and performance

### Test Moonlight

1. Enable moonlight for a game
2. Launch the game
3. Open Moonlight client on another device
4. Connect to host:47989
5. Select and stream the game

## Troubleshooting

### Gamescope Not Starting

- Check if gamescope binary is available: `which gamescope`
- Verify GPU access: `ls -la /dev/dri`
- Check logs: `docker logs <container-id>`

### Moonlight Connection Failed

- Verify ports are exposed: `docker ps`
- Check firewall settings
- Ensure wolf binary is present
- Check Wolf logs in container

### Poor Streaming Quality

- Increase bitrate or quality preset
- Use h265 codec for better compression
- Reduce resolution if network is slow
- Check network latency

## Future Enhancements

- Platform-level default settings
- UI for pairing Moonlight clients
- Wolf configuration management
- Streaming analytics and monitoring
- Multi-game streaming sessions
