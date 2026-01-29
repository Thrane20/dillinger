# RetroArch Runner Image

A Docker container for running RetroArch and libretro cores with full GPU acceleration, audio support, and gamepad input.

## Overview

This runner extends the Dillinger base image to provide RetroArch emulation capabilities for various retro gaming platforms through libretro cores.

## Features

- **GPU Acceleration**: OpenGL and Vulkan support for hardware-accelerated rendering
- **Audio**: PulseAudio passthrough to host
- **Input**: SDL2 joystick/gamepad support with autoconfig profiles
- **Display**: X11/Wayland support with optional xrandr resolution switching
- **Cores**: Pre-installed cores for MAME, NES, SNES, and PlayStation 1
- **MangoHUD**: Optional performance overlay
- **KEEP_ALIVE**: Debug mode to keep container running after game exit

## Pre-installed Libretro Cores

| Core | Platform | Path |
|------|----------|------|
| MAME | Arcade | `/usr/lib/libretro/mame_libretro.so` |
| Nestopia | NES/Famicom | `/usr/lib/libretro/nestopia_libretro.so` |
| Snes9x | SNES/Super Famicom | `/usr/lib/libretro/snes9x_libretro.so` |
| Beetle PSX HW | PlayStation 1 | `/usr/lib/libretro/mednafen_psx_hw_libretro.so` |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RETROARCH_CORE` | Core name (e.g., `mame`, `nestopia`, `snes9x`, `beetle_psx_hw`) | `mame` |
| `JOYSTICK_DEVICE_NAME` | Name of joystick device to configure | - |
| `DISPLAY` | X11 display for video output | `:0` |
| `PULSE_SERVER` | PulseAudio server address | Host socket |
| `XRANDR_MODE` | Resolution to set (e.g., `1920x1080`) | - |
| `XRANDR_OUTPUT` | Specific output to target | Auto-detect |
| `ENABLE_MANGOHUD` | Enable performance overlay | `false` |
| `KEEP_ALIVE` | Keep container running after exit | `false` |
| `PUID` | User ID for the game process | `1000` |
| `PGID` | Group ID for the game process | `1000` |

## Volume Mounts

| Container Path | Purpose |
|----------------|---------|
| `/roms` | ROM files |
| `/saves` | Save files |
| `/states` | Save states |
| `/system` | BIOS files |
| `/dev/dri` | GPU device access |
| `/dev/input` | Input device access |

## Usage Examples

### Basic Usage (MAME)

```bash
docker run --rm -it \
  --device=/dev/dri \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  -v /path/to/roms:/roms:ro \
  ghcr.io/thrane20/dillinger/runner-retroarch:latest \
  /roms/game.zip
```

### NES Game with Nestopia

```bash
docker run --rm -it \
  --device=/dev/dri \
  --device=/dev/input \
  -e DISPLAY=$DISPLAY \
  -e RETROARCH_CORE=nestopia \
  -e PULSE_SERVER=unix:/run/user/1000/pulse/native \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  -v /run/user/1000/pulse:/run/user/1000/pulse:ro \
  -v /path/to/roms:/roms:ro \
  ghcr.io/thrane20/dillinger/runner-retroarch:latest \
  /roms/game.nes
```

### SNES with Gamepad and Audio

```bash
docker run --rm -it \
  --device=/dev/dri \
  --device=/dev/input \
  -e DISPLAY=$DISPLAY \
  -e RETROARCH_CORE=snes9x \
  -e JOYSTICK_DEVICE_NAME="Xbox Wireless Controller" \
  -e PULSE_SERVER=unix:/run/user/1000/pulse/native \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  -v /run/user/1000/pulse:/run/user/1000/pulse:ro \
  -v /proc/bus/input/devices:/tmp/host-input-devices:ro \
  -v /path/to/roms:/roms:ro \
  -v /path/to/saves:/saves \
  ghcr.io/thrane20/dillinger/runner-retroarch:latest \
  /roms/game.sfc
```

### PlayStation 1 Game with Beetle PSX HW

```bash
docker run --rm -it \
  --device=/dev/dri \
  --device=/dev/input \
  -e DISPLAY=$DISPLAY \
  -e RETROARCH_CORE=beetle_psx_hw \
  -e JOYSTICK_DEVICE_NAME="Xbox Wireless Controller" \
  -e PULSE_SERVER=unix:/run/user/1000/pulse/native \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  -v /run/user/1000/pulse:/run/user/1000/pulse:ro \
  -v /proc/bus/input/devices:/tmp/host-input-devices:ro \
  -v /path/to/roms:/roms:ro \
  -v /path/to/saves:/saves \
  -v /path/to/bios:/system:ro \
  ghcr.io/thrane20/dillinger/runner-retroarch:latest \
  /roms/game.chd
```

> **Note:** PlayStation 1 emulation requires BIOS files (scph5500.bin, scph5501.bin, scph5502.bin) in the `/system` directory. CHD format is recommended for disc images.

### Menu Mode (No ROM)

Launch RetroArch menu to browse and configure:

```bash
docker run --rm -it \
  --device=/dev/dri \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  ghcr.io/thrane20/dillinger/runner-retroarch:latest
```

### Debug Mode

Keep container running after game exit for troubleshooting:

```bash
docker run --rm -it \
  --device=/dev/dri \
  -e DISPLAY=$DISPLAY \
  -e KEEP_ALIVE=true \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  ghcr.io/thrane20/dillinger/runner-retroarch:latest \
  /roms/game.zip

# Then in another terminal:
docker exec -it <container_id> /bin/bash
```

### With MangoHUD Performance Overlay

```bash
docker run --rm -it \
  --device=/dev/dri \
  -e DISPLAY=$DISPLAY \
  -e ENABLE_MANGOHUD=true \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  ghcr.io/thrane20/dillinger/runner-retroarch:latest \
  /roms/game.zip
```

## Building

```bash
cd packages/runner-images/retroarch
./build.sh
```

The build script sources `versioning.env` from the repository root for version tags.

## Configuration

RetroArch configuration is stored at `/home/gameuser/.config/retroarch/retroarch.cfg`. The entrypoint enforces these critical settings:

- `video_driver = "gl"` - OpenGL video driver
- `audio_driver = "pulse"` - PulseAudio for audio
- `input_driver = "sdl2"` - SDL2 for input handling
- `input_joypad_driver = "sdl2"` - SDL2 for gamepads

### Joypad Autoconfig

The image includes joypad autoconfig profiles from the [libretro/retroarch-joypad-autoconfig](https://github.com/libretro/retroarch-joypad-autoconfig) repository. Most common controllers should be automatically configured.

## Architecture

```
┌─────────────────────────────────────────────┐
│             RetroArch Runner                │
│  ┌───────────────────────────────────────┐  │
│  │  retroarch-entrypoint.sh              │  │
│  │  - xrandr resolution switching        │  │
│  │  - Signal handlers (cleanup)          │  │
│  │  - Graphics diagnostics               │  │
│  │  - MangoHUD integration               │  │
│  │  - KEEP_ALIVE support                 │  │
│  └───────────────────────────────────────┘  │
│                    │                        │
│                    ▼                        │
│  ┌───────────────────────────────────────┐  │
│  │  Base Runner (entrypoint.sh)          │  │
│  │  - User setup (PUID/PGID)             │  │
│  │  - GPU detection & permissions        │  │
│  │  - Display (X11/Wayland) setup        │  │
│  │  - PulseAudio configuration           │  │
│  └───────────────────────────────────────┘  │
│                    │                        │
│                    ▼                        │
│  ┌───────────────────────────────────────┐  │
│  │  RetroArch + Libretro Cores           │  │
│  │  - MAME, Nestopia, Snes9x             │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## Troubleshooting

### No Display

1. Ensure X11 socket is mounted: `-v /tmp/.X11-unix:/tmp/.X11-unix`
2. Check DISPLAY is set: `-e DISPLAY=$DISPLAY`
3. Run `xhost +local:docker` on host if needed

### No Audio

1. Mount PulseAudio socket: `-v /run/user/1000/pulse:/run/user/1000/pulse:ro`
2. Set PULSE_SERVER: `-e PULSE_SERVER=unix:/run/user/1000/pulse/native`

### Gamepad Not Detected

1. Pass input devices: `--device=/dev/input`
2. Mount device info: `-v /proc/bus/input/devices:/tmp/host-input-devices:ro`
3. Set device name: `-e JOYSTICK_DEVICE_NAME="Your Controller Name"`

### Black Screen / No GPU

1. Pass GPU device: `--device=/dev/dri`
2. Check GPU permissions on host
3. Look for Vulkan/OpenGL diagnostics in startup logs

## Version History

See [versioning.env](../../../versioning.env) for current version.
