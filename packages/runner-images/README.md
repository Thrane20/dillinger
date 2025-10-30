# Dillinger Runner Images

This package contains Docker images for running various types of games and applications.

## Architecture

Each runner is a Docker image built on **Arch Linux** that:
1. Mounts a volume pointing to a game installation or ROM directory
2. Locks onto that volume for the session duration
3. Executes the necessary run commands for that specific game/application

### Why Arch Linux?

- **Rolling release** - Always up-to-date packages
- **Performance** - Optimized for gaming
- **Multilib support** - Easy 32-bit library management for legacy games
- **Comprehensive packages** - All gaming libraries available
- **AUR access** - Community packages for specialized needs

## Available Runners

### Linux Native (`linux-native/`)
Runs native Linux games and applications.

**Base:** Arch Linux (latest)

**Features:**
- X11 display support
- PulseAudio for audio
- OpenGL and Vulkan support (64-bit and 32-bit)
- SDL2 with full extension support
- Gamepad/controller support
- Comprehensive gaming library stack

**Example games:**
- Native Linux builds (e.g., SuperTuxKart, 0 A.D.)
- AppImage games
- Flatpak games

### Wine/Proton (`wine-proton/`)
Runs Windows games via Wine or Proton.

**Features:**
- Wine Staging latest
- DXVK for DirectX to Vulkan translation
- Proton compatibility layer
- Windows game launcher support

## Usage

### Building Images

```bash
# Build Linux native runner
docker build -t dillinger/runner-linux-native:latest ./packages/runner-images/linux-native

# Build Wine/Proton runner
docker build -t dillinger/runner-wine-proton:latest ./packages/runner-images/wine-proton
```

### Running a Game

```bash
# Example: Run a Linux native game
docker run -it --rm \
  -v /path/to/game:/game:ro \
  -v /path/to/game/saves:/saves:rw \
  -e GAME_EXECUTABLE="/game/start.sh" \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  --device /dev/dri \
  dillinger/runner-linux-native:latest

# Example: Run a Windows game via Wine
docker run -it --rm \
  -v /path/to/windows/game:/game:ro \
  -v /path/to/wine/prefix:/wineprefix:rw \
  -e GAME_EXECUTABLE="/game/game.exe" \
  -e WINEPREFIX=/wineprefix \
  dillinger/runner-wine-proton:latest
```

## Environment Variables

### Common Variables (All Runners)

- `GAME_EXECUTABLE` - Path to the game executable or launch script (required)
- `GAME_ARGS` - Arguments to pass to the game executable (optional)
- `SAVE_DIR` - Directory for save files (default: `/saves`)

### Linux Native Specific

- `DISPLAY` - X11 display (required for GUI games)
- `PULSE_SERVER` - PulseAudio server (optional)

### Wine/Proton Specific

- `WINEPREFIX` - Wine prefix directory (default: `/wineprefix`)
- `WINEARCH` - Wine architecture: win32 or win64 (default: win64)
- `PROTON_VERSION` - Specific Proton version to use (optional)

## Volume Mounts

Each runner expects specific volume mounts:

- `/game` - Game installation directory (read-only recommended)
- `/saves` - Save game directory (read-write)
- `/config` - Configuration files (read-write, optional)

## Future Runners

Planned runner images:
- RetroArch (emulation)
- DOSBox
- ScummVM
- Amiga emulator (UAE)
- PlayStation emulators
