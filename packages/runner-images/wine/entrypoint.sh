#!/bin/bash
# Dillinger Wine Game Runner - Entrypoint Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Dillinger Wine Game Runner${NC}"
echo -e "${GREEN}========================================${NC}"

# Set default values
WINEPREFIX="${WINEPREFIX:-/wineprefix}"
WINEARCH="${WINEARCH:-win64}"
SAVE_DIR="${SAVE_DIR:-/saves}"
INSTALLER_MODE="${INSTALLER_MODE:-false}"

# Export Wine environment variables
export WINEPREFIX
export WINEARCH
export WINEDEBUG="${WINEDEBUG:--all}"

# XDG directories for Wine
export XDG_DATA_HOME=/saves/data
export XDG_CONFIG_HOME=/saves/config
export XDG_CACHE_HOME=/saves/cache

# Create necessary directories
mkdir -p "$SAVE_DIR" "$XDG_DATA_HOME" "$XDG_CONFIG_HOME" "$XDG_CACHE_HOME"

echo ""
echo -e "${BLUE}Configuration:${NC}"
echo "  Wine Prefix: $WINEPREFIX"
echo "  Wine Arch: $WINEARCH"
echo "  Save Directory: $SAVE_DIR"
echo "  Display: ${DISPLAY:-<not set>}"
echo "  User: $(whoami)"
echo "  Installer Mode: $INSTALLER_MODE"
echo ""

# Check for NVIDIA GPU (learned from GoW)
if [ -f /usr/local/bin/nvidia-check.sh ]; then
    echo -e "${BLUE}Checking for NVIDIA GPU...${NC}"
    /usr/local/bin/nvidia-check.sh || true
fi

# Check for display (X11)
if [ -n "$DISPLAY" ]; then
    echo -e "${BLUE}Checking X11 connection...${NC}"
    if xdpyinfo >/dev/null 2>&1; then
        echo -e "${GREEN}✓ X11 connection successful${NC}"
    else
        echo -e "${YELLOW}⚠ Warning: Cannot connect to X11 display${NC}"
        echo "  Make sure you mounted /tmp/.X11-unix and set DISPLAY"
    fi
fi

# Configure PulseAudio
if [ -n "$PULSE_SERVER" ]; then
    echo -e "${BLUE}Configuring audio (using host PulseAudio)...${NC}"
    echo "  PULSE_SERVER: $PULSE_SERVER"
    
    # Test connection to PulseAudio
    if pactl info >/dev/null 2>&1; then
        echo -e "${GREEN}✓ PulseAudio connection successful${NC}"
    else
        echo -e "${YELLOW}⚠ Cannot connect to PulseAudio server${NC}"
        echo "  Make sure the PulseAudio socket is mounted"
    fi
elif command -v pulseaudio >/dev/null 2>&1; then
    echo -e "${BLUE}Configuring audio (container-local)...${NC}"
    if pulseaudio --check 2>/dev/null; then
        echo -e "${GREEN}✓ PulseAudio is running${NC}"
    else
        echo -e "${YELLOW}⚠ PulseAudio not running, starting in background...${NC}"
        pulseaudio --start --exit-idle-time=-1 2>/dev/null || true
        sleep 1
        if pulseaudio --check 2>/dev/null; then
            echo -e "${GREEN}✓ PulseAudio started successfully${NC}"
        fi
    fi
fi

# Check for GPU access
if [ -d "/dev/dri" ]; then
    echo -e "${GREEN}✓ GPU device access available${NC}"
else
    echo -e "${YELLOW}⚠ No GPU device access (software rendering only)${NC}"
fi

# Initialize Wine prefix if it doesn't exist
if [ ! -d "$WINEPREFIX/drive_c" ]; then
    echo ""
    echo -e "${BLUE}Initializing Wine prefix...${NC}"
    echo -e "${YELLOW}This may take a minute on first run...${NC}"
    wineboot --init 2>&1 | head -20
    echo -e "${GREEN}✓ Wine prefix initialized${NC}"
else
    echo -e "${GREEN}✓ Wine prefix already initialized${NC}"
fi

# Check if we're in installer mode
if [ "$INSTALLER_MODE" = "true" ]; then
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  INSTALLER MODE${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    
    if [ -z "$INSTALLER_PATH" ]; then
        echo -e "${RED}ERROR: INSTALLER_PATH environment variable is required in installer mode${NC}"
        echo "Example: docker run -e INSTALLER_MODE=true -e INSTALLER_PATH='/installers/setup.exe' ..."
        exit 1
    fi
    
    if [ ! -e "$INSTALLER_PATH" ]; then
        echo -e "${RED}ERROR: Installer not found: $INSTALLER_PATH${NC}"
        echo "Make sure the installer volume is mounted correctly"
        exit 1
    fi
    
    echo -e "${BLUE}Installing from: $INSTALLER_PATH${NC}"
    echo -e "${BLUE}Working directory: $(dirname "$INSTALLER_PATH")${NC}"
    echo ""
    
    cd "$(dirname "$INSTALLER_PATH")" || true
    
    # Run the installer
    echo -e "${GREEN}Starting installer...${NC}"
    wine "$(basename "$INSTALLER_PATH")" ${INSTALLER_ARGS}
    
    echo ""
    echo -e "${GREEN}Installer completed.${NC}"
    echo -e "${YELLOW}The game should now be installed in the Wine prefix.${NC}"
    echo -e "${YELLOW}You can find installed programs in:${NC}"
    echo "  $WINEPREFIX/drive_c/Program Files"
    echo "  $WINEPREFIX/drive_c/Program Files (x86)"
    
    # Keep container running if requested
    if [ "$KEEP_ALIVE" = "true" ]; then
        echo ""
        echo -e "${BLUE}Container will stay alive. Press Ctrl+C to exit.${NC}"
        tail -f /dev/null
    fi
    
    exit 0
fi

# Regular game launch mode
if [ -z "$GAME_EXECUTABLE" ]; then
    echo -e "${RED}ERROR: GAME_EXECUTABLE environment variable is required${NC}"
    echo "Example: docker run -e GAME_EXECUTABLE='/game/game.exe' ..."
    echo ""
    echo -e "${BLUE}For installer mode, use:${NC}"
    echo "  docker run -e INSTALLER_MODE=true -e INSTALLER_PATH='/installers/setup.exe' ..."
    exit 1
fi

# Verify the game executable exists
if [ ! -e "$GAME_EXECUTABLE" ]; then
    echo -e "${RED}ERROR: Game executable not found: $GAME_EXECUTABLE${NC}"
    echo "Make sure the game volume is mounted correctly"
    exit 1
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Starting Game${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "  Executable: $GAME_EXECUTABLE"
echo "  Arguments: ${GAME_ARGS:-<none>}"

# Check for Wine virtual desktop mode
if [ -n "$WINE_VIRTUAL_DESKTOP" ]; then
    echo "  Virtual Desktop: $WINE_VIRTUAL_DESKTOP"
fi

echo ""

# Change to game directory
cd "$(dirname "$GAME_EXECUTABLE")" || true

# Launch the game via Wine
if [ -n "$WINE_VIRTUAL_DESKTOP" ]; then
    # Use Wine virtual desktop for fullscreen/windowed mode
    if [ -n "$GAME_ARGS" ]; then
        exec wine explorer /desktop=Dillinger,"$WINE_VIRTUAL_DESKTOP" "$GAME_EXECUTABLE" $GAME_ARGS
    else
        exec wine explorer /desktop=Dillinger,"$WINE_VIRTUAL_DESKTOP" "$GAME_EXECUTABLE"
    fi
else
    # Standard Wine launch
    if [ -n "$GAME_ARGS" ]; then
        exec wine "$GAME_EXECUTABLE" $GAME_ARGS
    else
        exec wine "$GAME_EXECUTABLE"
    fi
fi
