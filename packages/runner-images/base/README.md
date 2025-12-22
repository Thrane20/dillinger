# Dillinger Base Game Runner

Base Docker image providing shared infrastructure for all Dillinger game runners.

## Features

### Display & Graphics
- **X11 Server**: Full X11 support for game rendering
- **Wayland Support**: Modern Wayland compositor support
- **GPU Drivers**: NVIDIA, AMD, and Intel GPU support with hardware acceleration
- **Mesa & Vulkan**: Latest graphics libraries for optimal performance

### Audio
- **PulseAudio**: Full audio support with both host forwarding and container-local modes
- **ALSA**: Low-level audio interface support

### Compositing & Upscaling
- **Gamescope**: Compositor with upscaling and performance optimization
  - Fullscreen mode
  - Custom resolution support
  - Multiple upscaling filters (FSR, NIS, etc.)
  - Frame rate limiting

### Streaming
- **Moonlight/Wolf**: Game streaming over the network using the Moonlight protocol
- **GStreamer**: Video/audio encoding and streaming pipeline
- **Low Latency**: Optimized for minimal latency streaming

## Usage

This is a base image meant to be extended by specific runner types (Wine, Linux Native, emulators, etc.).

### Build

```bash
./build.sh [tag]
```

### Run Standalone

```bash
docker run --rm -it \
    --device /dev/dri \
    -v /tmp/.X11-unix:/tmp/.X11-unix \
    -e DISPLAY=$DISPLAY \
    ghcr.io/thrane20/dillinger/runner-base:latest
```

### Extending This Image

Create a new Dockerfile for your specific runner:

```dockerfile
FROM ghcr.io/thrane20/dillinger/runner-base:latest

# Add your specific runtime (Wine, emulator, etc.)
RUN apt-get update && apt-get install -y wine

# Copy your entrypoint
COPY entrypoint.sh /usr/local/bin/game-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["/usr/local/bin/game-entrypoint.sh"]
```

## Environment Variables

### User Management
- `PUID`: User ID (default: 1000)
- `PGID`: Group ID (default: 1000)
- `UNAME`: Username (default: gameuser)

### Display
- `DISPLAY`: X11 display (e.g., :0)
- `WAYLAND_DISPLAY`: Wayland display socket

### Audio
- `PULSE_SERVER`: PulseAudio server address

### Gamescope
- `USE_GAMESCOPE`: Enable gamescope compositor (true/false, default: false)
- `GAMESCOPE_WIDTH`: Output width (default: 1920)
- `GAMESCOPE_HEIGHT`: Output height (default: 1080)
- `GAMESCOPE_REFRESH`: Refresh rate (default: 60)
- `GAMESCOPE_FULLSCREEN`: Fullscreen mode (true/false, default: false)
- `GAMESCOPE_UPSCALER`: Upscaling filter (auto/fsr/nis/linear, default: auto)

### Moonlight Streaming
- `ENABLE_MOONLIGHT`: Enable Moonlight streaming server (true/false, default: false)
- `WOLF_CFG_FOLDER`: Wolf configuration directory (default: /etc/wolf/cfg)
- `WOLF_LOG_LEVEL`: Log level (DEBUG/INFO/WARN/ERROR, default: INFO)
- `WOLF_RENDER_NODE`: GPU render node (default: /dev/dri/renderD128)

## Volumes

- `/game`: Game files and executables
- `/saves`: Save games and user data
- `/config`: Configuration files
- `/wineprefix`: Wine prefix for Windows games (Wine runners)
- `/installers`: Game installers
- `/run/user/gameuser`: XDG runtime directory

## Exposed Ports

### Moonlight/Wolf Streaming
- `47984/tcp`: HTTPS
- `47989/tcp`: HTTP
- `47999/udp`: Control
- `48010/tcp`: RTSP
- `48100/udp`: Video
- `48200/udp`: Audio

## GPU Access

To enable GPU acceleration:

```bash
docker run --rm -it \
    --device /dev/dri \
    --gpus all \  # For NVIDIA GPUs
    ghcr.io/thrane20/dillinger/runner-base:latest
```

## Architecture

This base image follows the Games on Whales (GoW) architecture patterns:

1. **Multi-stage build** for minimal runtime size
2. **gosu** for proper user privilege management
3. **Environment-based configuration** over config files
4. **Modular component installation** for maintainability

## Derived Runners

The following runners extend from this base:

- **Wine Runner** (`ghcr.io/thrane20/dillinger/runner-wine`): For Windows games
- **Linux Native Runner** (`ghcr.io/thrane20/dillinger/runner-linux-native`): For native Linux games
- **Future runners**: PS1, PS2, Amiga, etc.

## Version

- Base Image: Ubuntu 25.04
- Gamescope: 3.15.14
- GStreamer: 1.26.2
- gosu: 1.14

## License

MIT License - see main Dillinger repository for details.
