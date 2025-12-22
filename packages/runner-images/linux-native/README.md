# Linux Native Game Runner

Docker image for running native Linux games and applications.

## Features

- **Arch Linux** base (rolling release, latest packages)
- X11 display support
- PulseAudio audio
- OpenGL and Vulkan graphics with 32-bit support
- SDL2 for input/gamepad support
- Comprehensive gaming libraries (both 64-bit and 32-bit)
- Pre-configured for optimal gaming performance

## Usage

### Build the Image

```bash
docker build -t ghcr.io/thrane20/dillinger/runner-linux-native:latest .
```

### Run a Game

```bash
docker run -it --rm \
  -v /path/to/game:/game:ro \
  -v /path/to/saves:/saves:rw \
  -e GAME_EXECUTABLE="/game/start.sh" \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  --device /dev/dri \
  --device /dev/snd \
  ghcr.io/thrane20/dillinger/runner-linux-native:latest
```

### Example: SuperTuxKart

```bash
# Download and extract SuperTuxKart
mkdir -p ~/games/supertuxkart
cd ~/games/supertuxkart
wget https://github.com/supertuxkart/stk-code/releases/download/1.4/SuperTuxKart-1.4-linux-x86_64.tar.xz
tar xf SuperTuxKart-1.4-linux-x86_64.tar.xz

# Run via Docker
docker run -it --rm \
  -v ~/games/supertuxkart/SuperTuxKart-1.4-linux-x86_64:/game:ro \
  -v ~/games/supertuxkart/saves:/saves:rw \
  -e GAME_EXECUTABLE="/game/bin/supertuxkart" \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  --device /dev/dri \
  --device /dev/snd \
  ghcr.io/thrane20/dillinger/runner-linux-native:latest
```

## Environment Variables

- `GAME_EXECUTABLE` (required) - Full path to the game executable
- `GAME_ARGS` (optional) - Command line arguments for the game
- `SAVE_DIR` (optional) - Save directory, defaults to `/saves`
- `DISPLAY` (required) - X11 display for GUI applications

## Volume Mounts

- `/game` - Game installation directory (mount as read-only)
- `/saves` - Directory for save games and user data (read-write)
- `/config` - Optional configuration directory (read-write)

## Testing

A simple test game (bash script) is included for testing the runner:

```bash
docker run -it --rm \
  -e GAME_EXECUTABLE="/usr/local/bin/test-game.sh" \
  ghcr.io/thrane20/dillinger/runner-linux-native:latest
```
