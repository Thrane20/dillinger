# Wine Game Runner

Docker image for running Windows games and applications via Wine on Arch Linux.

## Features

- **Arch Linux** base (rolling release, latest packages)
- **Wine** with full Windows compatibility
- X11 display support
- PulseAudio audio
- OpenGL and Vulkan graphics with 32-bit support
- NVIDIA GPU support (auto-detection)
- Installer support for Windows executables
- Comprehensive Windows gaming libraries (both 64-bit and 32-bit)
- Pre-configured Wine environment

## Architecture

This runner is based on the Arch Linux architecture and incorporates best practices learned from Games on Whales (GoW):

- **PulseAudio Setup**: Auto-starting PulseAudio for audio support
- **NVIDIA Detection**: Runtime detection and configuration of NVIDIA drivers
- **Multilib Support**: Full 32-bit library support for legacy Windows games

## Usage

### Build the Image

```bash
./build.sh
# or manually:
docker build -t dillinger/runner-wine:latest .
```

### Mode 1: Run a Windows Game

Run an already-installed Windows game:

```bash
docker run -it --rm \
  -v /path/to/windows/game:/game:ro \
  -v /path/to/wineprefix:/wineprefix:rw \
  -v /path/to/saves:/saves:rw \
  -e GAME_EXECUTABLE="/game/game.exe" \
  -e WINEPREFIX=/wineprefix \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  --device /dev/dri \
  --device /dev/snd \
  dillinger/runner-wine:latest
```

### Mode 2: Run a Windows Installer

Install a Windows game or application:

```bash
docker run -it --rm \
  -v /path/to/installer:/installers:ro \
  -v /path/to/wineprefix:/wineprefix:rw \
  -e INSTALLER_MODE=true \
  -e INSTALLER_PATH="/installers/setup.exe" \
  -e WINEPREFIX=/wineprefix \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  --device /dev/dri \
  --device /dev/snd \
  dillinger/runner-wine:latest
```

To keep the container running after installation:

```bash
docker run -it --rm \
  -v /path/to/installer:/installers:ro \
  -v /path/to/wineprefix:/wineprefix:rw \
  -e INSTALLER_MODE=true \
  -e INSTALLER_PATH="/installers/setup.exe" \
  -e KEEP_ALIVE=true \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  --device /dev/dri \
  --device /dev/snd \
  dillinger/runner-wine:latest
```

### Example: Installing a Windows Game

```bash
# 1. Download a Windows installer
mkdir -p ~/windows-installers
cd ~/windows-installers
# ... download your installer ...

# 2. Run installer in Wine container
mkdir -p ~/wine-prefixes/mygame
docker run -it --rm \
  -v ~/windows-installers:/installers:ro \
  -v ~/wine-prefixes/mygame:/wineprefix:rw \
  -e INSTALLER_MODE=true \
  -e INSTALLER_PATH="/installers/setup.exe" \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  --device /dev/dri \
  dillinger/runner-wine:latest

# 3. After installation, find the game executable
ls ~/wine-prefixes/mygame/drive_c/Program\ Files/

# 4. Launch the game
docker run -it --rm \
  -v ~/wine-prefixes/mygame:/wineprefix:rw \
  -e GAME_EXECUTABLE="/wineprefix/drive_c/Program Files/MyGame/game.exe" \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  --device /dev/dri \
  dillinger/runner-wine:latest
```

## Environment Variables

### Common Variables

- `DISPLAY` (required for GUI) - X11 display for graphical applications
- `WINEPREFIX` (optional) - Wine prefix directory, defaults to `/wineprefix`
- `WINEARCH` (optional) - Wine architecture: `win32` or `win64`, defaults to `win64`
- `WINEDEBUG` (optional) - Wine debug level, defaults to `-all` (no debug output)
- `SAVE_DIR` (optional) - Save directory, defaults to `/saves`

### Game Launch Mode

- `GAME_EXECUTABLE` (required) - Full path to the Windows executable
- `GAME_ARGS` (optional) - Command line arguments for the game

### Installer Mode

- `INSTALLER_MODE` (required) - Set to `true` to enable installer mode
- `INSTALLER_PATH` (required) - Full path to the Windows installer executable
- `INSTALLER_ARGS` (optional) - Command line arguments for the installer
- `KEEP_ALIVE` (optional) - Set to `true` to keep container running after installation

## Volume Mounts

- `/game` - Game installation directory (mount as read-only for games)
- `/installers` - Windows installer files (mount as read-only for installers)
- `/wineprefix` - Wine prefix (Windows environment) (read-write, persistent)
- `/saves` - Directory for save games and user data (read-write)
- `/config` - Optional configuration directory (read-write)

## Wine Prefix

The Wine prefix is the Windows environment where games are installed. It simulates a Windows directory structure:

```
/wineprefix/
├── drive_c/           # Simulated C: drive
│   ├── Program Files/
│   ├── Program Files (x86)/
│   ├── users/
│   └── windows/
├── dosdevices/        # Drive mappings
└── ...
```

**Important**: Always use a persistent volume for `/wineprefix` to preserve installations between container runs.

## GPU Support

### NVIDIA

The runner automatically detects NVIDIA GPUs and configures Wine accordingly. Make sure to:

1. Install NVIDIA drivers on the host
2. Mount GPU devices: `--device /dev/dri`
3. Optionally pass `--gpus all` for full GPU access

### AMD/Intel

Mesa drivers are included for AMD and Intel GPUs. The runner will work with integrated graphics as well.

## Audio Support

PulseAudio is configured and will auto-start if not already running. Make sure to mount audio devices:

```bash
--device /dev/snd
```

For advanced audio configuration, you can set `PULSE_SERVER` environment variable.

## Troubleshooting

### Game doesn't start

1. Check that the executable path is correct
2. Verify X11 connection: `xdpyinfo` should work inside the container
3. Check Wine prefix is initialized: Look for `$WINEPREFIX/drive_c`

### No audio

1. Ensure audio devices are mounted: `--device /dev/snd`
2. Check PulseAudio is running: `pulseaudio --check`
3. Test with `paplay` if available

### Graphics issues

1. Verify GPU access: `ls -l /dev/dri`
2. For NVIDIA: Check `nvidia-smi` works
3. Check Wine debug output by setting `WINEDEBUG=+all`

### Installer doesn't show up

1. Make sure X11 display is working
2. Check the installer path is correct
3. Try with `WINEDEBUG=+all` to see what Wine is doing

## Testing

A test script is included to verify the Wine installation:

```bash
docker run -it --rm \
  -e GAME_EXECUTABLE="/usr/local/bin/test-installer.sh" \
  dillinger/runner-wine:latest
```

## Future Enhancements

- Proton support (Valve's Wine fork with additional Windows compatibility)
- DXVK configuration (DirectX to Vulkan translation)
- VKD3D for DirectX 12 support
- Multiple Wine versions support
- Gamescope integration for improved gaming experience
- Save game synchronization

## Platform Integration

To use this runner with Dillinger, create a platform definition:

```json
{
  "id": "windows-wine",
  "name": "Windows (Wine)",
  "type": "wine",
  "description": "Windows games via Wine compatibility layer",
  "configuration": {
    "containerImage": "dillinger/runner-wine:latest",
    "supportedExtensions": [".exe", ".msi", ".bat"],
    "defaultSettings": {
      "environment": {
        "WINEPREFIX": "/wineprefix",
        "WINEARCH": "win64"
      }
    }
  },
  "displayStreaming": {
    "method": "x11"
  },
  "isActive": true
}
```

## License

MIT License - See main Dillinger project for details.
