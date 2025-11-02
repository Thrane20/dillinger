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

### Wine (`wine/`)
Runs Windows games and applications via Wine.

**Base:** Arch Linux (latest)

**Features:**
- Wine latest with Wine Mono and Gecko
- X11 display support
- PulseAudio for audio
- OpenGL and Vulkan support (64-bit and 32-bit)
- NVIDIA GPU auto-detection and configuration
- Installer support for Windows executables (.exe, .msi)
- Winetricks for additional Windows components
- Comprehensive Windows gaming libraries

**Example use cases:**
- Install Windows games via setup.exe
- Run pre-installed Windows games
- Windows applications
- Legacy Windows games

### Wine/Proton (`wine-proton/`) - Coming Soon
Future runner with Proton support for enhanced Windows game compatibility.

## Usage

### Building Images

```bash
# Build Linux native runner
docker build -t dillinger/runner-linux-native:latest ./packages/runner-images/linux-native

# Build Wine runner
docker build -t dillinger/runner-wine:latest ./packages/runner-images/wine
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
  -v /path/to/wine/prefix:/wineprefix:rw \
  -v /path/to/saves:/saves:rw \
  -e GAME_EXECUTABLE="/wineprefix/drive_c/Program Files/MyGame/game.exe" \
  -e WINEPREFIX=/wineprefix \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  --device /dev/dri \
  dillinger/runner-wine:latest

# Example: Install a Windows game
docker run -it --rm \
  -v /path/to/installer:/installers:ro \
  -v /path/to/wine/prefix:/wineprefix:rw \
  -e INSTALLER_MODE=true \
  -e INSTALLER_PATH="/installers/setup.exe" \
  -e WINEPREFIX=/wineprefix \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  --device /dev/dri \
  dillinger/runner-wine:latest
```

## Environment Variables

### Common Variables (All Runners)

- `GAME_EXECUTABLE` - Path to the game executable or launch script (required)
- `GAME_ARGS` - Arguments to pass to the game executable (optional)
- `SAVE_DIR` - Directory for save files (default: `/saves`)

### Linux Native Specific

- `DISPLAY` - X11 display (required for GUI games)
- `PULSE_SERVER` - PulseAudio server (optional)

### Wine Specific

- `WINEPREFIX` - Wine prefix directory (default: `/wineprefix`)
- `WINEARCH` - Wine architecture: win32 or win64 (default: win64)
- `WINEDEBUG` - Wine debug level (default: `-all` for no debug output)
- `DISPLAY` - X11 display (required for GUI games)

#### Installer Mode

- `INSTALLER_MODE` - Set to `true` to run an installer instead of a game
- `INSTALLER_PATH` - Path to the Windows installer executable (required when INSTALLER_MODE=true)
- `INSTALLER_ARGS` - Arguments to pass to the installer (optional)
- `KEEP_ALIVE` - Set to `true` to keep container running after installation (optional)

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
