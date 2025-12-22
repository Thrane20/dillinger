# Wine Runner - Usage Examples

This document provides practical examples for using the Wine runner with various scenarios.

## Prerequisites

- Docker installed and running
- X11 server available (for GUI applications)
- Wine runner image built: `docker build -t ghcr.io/thrane20/dillinger/runner-wine:latest .`

## Example 1: Installing a Windows Game

### Step 1: Prepare your installer

```bash
mkdir -p ~/dillinger-installers
# Copy your Windows installer to this directory
cp /path/to/game-installer.exe ~/dillinger-installers/
```

### Step 2: Create a Wine prefix

```bash
mkdir -p ~/wine-prefixes/mygame
```

### Step 3: Run the installer

```bash
docker run -it --rm \
  -v ~/dillinger-installers:/installers:ro \
  -v ~/wine-prefixes/mygame:/wineprefix:rw \
  -e INSTALLER_MODE=true \
  -e INSTALLER_PATH="/installers/game-installer.exe" \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  --device /dev/dri \
  --device /dev/snd \
  ghcr.io/thrane20/dillinger/runner-wine:latest
```

### Step 4: Find the installed game

```bash
ls -R ~/wine-prefixes/mygame/drive_c/Program\ Files/
```

### Step 5: Launch the game

```bash
docker run -it --rm \
  -v ~/wine-prefixes/mygame:/wineprefix:rw \
  -v ~/game-saves:/saves:rw \
  -e GAME_EXECUTABLE="/wineprefix/drive_c/Program Files/MyGame/game.exe" \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  --device /dev/dri \
  --device /dev/snd \
  ghcr.io/thrane20/dillinger/runner-wine:latest
```

## Example 2: Running a Portable Windows Game

For games that don't require installation (portable/extracted):

```bash
# Create directories
mkdir -p ~/windows-games/portable-game
mkdir -p ~/wine-prefixes/portable
mkdir -p ~/game-saves/portable

# Extract/copy your game to ~/windows-games/portable-game
# Assuming the game executable is game.exe

# Run the game
docker run -it --rm \
  -v ~/windows-games/portable-game:/game:ro \
  -v ~/wine-prefixes/portable:/wineprefix:rw \
  -v ~/game-saves/portable:/saves:rw \
  -e GAME_EXECUTABLE="/game/game.exe" \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  --device /dev/dri \
  --device /dev/snd \
  ghcr.io/thrane20/dillinger/runner-wine:latest
```

## Example 3: Installing and Configuring a Game

Some games require post-installation configuration:

```bash
# Step 1: Install the game
docker run -it --rm \
  -v ~/dillinger-installers:/installers:ro \
  -v ~/wine-prefixes/game:/wineprefix:rw \
  -e INSTALLER_MODE=true \
  -e INSTALLER_PATH="/installers/setup.exe" \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  --device /dev/dri \
  ghcr.io/thrane20/dillinger/runner-wine:latest

# Step 2: Run winecfg to adjust settings
docker run -it --rm \
  -v ~/wine-prefixes/game:/wineprefix:rw \
  -e GAME_EXECUTABLE="winecfg" \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  ghcr.io/thrane20/dillinger/runner-wine:latest

# Step 3: Launch the game
docker run -it --rm \
  -v ~/wine-prefixes/game:/wineprefix:rw \
  -e GAME_EXECUTABLE="/wineprefix/drive_c/Program Files/Game/game.exe" \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  --device /dev/dri \
  --device /dev/snd \
  ghcr.io/thrane20/dillinger/runner-wine:latest
```

## Example 4: Using winetricks

Install additional Windows components:

```bash
# Interactive winetricks
docker run -it --rm \
  -v ~/wine-prefixes/game:/wineprefix:rw \
  -e GAME_EXECUTABLE="winetricks" \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  ghcr.io/thrane20/dillinger/runner-wine:latest

# Or install specific components
docker run -it --rm \
  -v ~/wine-prefixes/game:/wineprefix:rw \
  -e GAME_EXECUTABLE="winetricks" \
  -e GAME_ARGS="d3dx9 vcrun2015" \
  ghcr.io/thrane20/dillinger/runner-wine:latest
```

## Example 5: 32-bit Windows Application

For 32-bit applications, use win32 architecture:

```bash
# Create 32-bit Wine prefix
mkdir -p ~/wine-prefixes/game32

docker run -it --rm \
  -v ~/dillinger-installers:/installers:ro \
  -v ~/wine-prefixes/game32:/wineprefix:rw \
  -e INSTALLER_MODE=true \
  -e INSTALLER_PATH="/installers/setup32.exe" \
  -e WINEARCH=win32 \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  --device /dev/dri \
  ghcr.io/thrane20/dillinger/runner-wine:latest
```

## Example 6: Running with GPU Acceleration (NVIDIA)

For NVIDIA GPU support:

```bash
docker run -it --rm \
  -v ~/wine-prefixes/game:/wineprefix:rw \
  -e GAME_EXECUTABLE="/wineprefix/drive_c/Program Files/Game/game.exe" \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  --device /dev/dri \
  --device /dev/snd \
  --gpus all \
  --runtime=nvidia \
  ghcr.io/thrane20/dillinger/runner-wine:latest
```

## Example 7: Silent Installation

For installers that support silent mode:

```bash
docker run -it --rm \
  -v ~/dillinger-installers:/installers:ro \
  -v ~/wine-prefixes/game:/wineprefix:rw \
  -e INSTALLER_MODE=true \
  -e INSTALLER_PATH="/installers/setup.exe" \
  -e INSTALLER_ARGS="/S /D=C:\Program Files\MyGame" \
  ghcr.io/thrane20/dillinger/runner-wine:latest
```

## Example 8: Debugging Wine Issues

Enable Wine debug output:

```bash
docker run -it --rm \
  -v ~/wine-prefixes/game:/wineprefix:rw \
  -e GAME_EXECUTABLE="/wineprefix/drive_c/Program Files/Game/game.exe" \
  -e WINEDEBUG="+all" \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  --device /dev/dri \
  ghcr.io/thrane20/dillinger/runner-wine:latest 2>&1 | tee wine-debug.log
```

## Example 9: Multiple Game Installations

Organize multiple games with separate prefixes:

```bash
# Game 1
mkdir -p ~/wine-prefixes/game1 ~/game-saves/game1
docker run -it --rm \
  -v ~/wine-prefixes/game1:/wineprefix:rw \
  -v ~/game-saves/game1:/saves:rw \
  -e GAME_EXECUTABLE="/wineprefix/drive_c/Program Files/Game1/game1.exe" \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  --device /dev/dri \
  --device /dev/snd \
  ghcr.io/thrane20/dillinger/runner-wine:latest

# Game 2
mkdir -p ~/wine-prefixes/game2 ~/game-saves/game2
docker run -it --rm \
  -v ~/wine-prefixes/game2:/wineprefix:rw \
  -v ~/game-saves/game2:/saves:rw \
  -e GAME_EXECUTABLE="/wineprefix/drive_c/Program Files/Game2/game2.exe" \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  --device /dev/dri \
  --device /dev/snd \
  ghcr.io/thrane20/dillinger/runner-wine:latest
```

## Example 10: Testing the Runner

Use the included test script:

```bash
docker run -it --rm \
  -e GAME_EXECUTABLE="/usr/local/bin/test-installer.sh" \
  ghcr.io/thrane20/dillinger/runner-wine:latest
```

## Common Issues and Solutions

### Issue: "Cannot connect to X11 display"

**Solution**: Make sure X11 socket is mounted and DISPLAY is set:

```bash
xhost +local:docker
docker run ... -e DISPLAY=$DISPLAY -v /tmp/.X11-unix:/tmp/.X11-unix:rw ...
```

### Issue: "No sound in game"

**Solution**: Ensure audio devices are mounted:

```bash
docker run ... --device /dev/snd ...
```

### Issue: "Game crashes on startup"

**Solutions**:
1. Install missing Windows components with winetricks
2. Check GPU drivers are available
3. Try different Wine architecture (win32 vs win64)
4. Enable debug output with `WINEDEBUG=+all`

### Issue: "Installer window doesn't appear"

**Solutions**:
1. Verify X11 connection
2. Try `KEEP_ALIVE=true` to keep container running
3. Check if installer supports silent mode

### Issue: "Poor game performance"

**Solutions**:
1. Ensure GPU passthrough is working (`--device /dev/dri` or `--gpus all`)
2. Check NVIDIA drivers are detected (check container logs)
3. Install DXVK via winetricks for DirectX games

## Integration with Dillinger

When using with the Dillinger platform:

1. Games are automatically launched with the correct Wine prefix
2. Save directories are persisted
3. Platform settings are applied from `windows-wine.json`
4. Container lifecycle is managed by Dillinger core

## Next Steps

- Explore [Wine documentation](https://www.winehq.org/documentation)
- Learn about [winetricks](https://github.com/Winetricks/winetricks)
- Check [Wine AppDB](https://appdb.winehq.org/) for game compatibility
