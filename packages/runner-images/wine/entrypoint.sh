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

# Configure Wine virtual desktop if requested
if [ -n "$WINE_VIRTUAL_DESKTOP" ]; then
    echo -e "${BLUE}Configuring Wine virtual desktop: $WINE_VIRTUAL_DESKTOP${NC}"
    
    # Parse resolution (e.g., "1920x1080")
    IFS='x' read -r WIDTH HEIGHT <<< "$WINE_VIRTUAL_DESKTOP"
    
    # Set registry values for virtual desktop
    # This ensures the window stays in virtual desktop mode
    # Use || true to prevent script exit if registry commands fail
    wine reg add 'HKCU\Software\Wine\Explorer' /v Desktop /t REG_SZ /d Dillinger /f >/dev/null 2>&1 || true
    wine reg add 'HKCU\Software\Wine\Explorer\Desktops' /v Dillinger /t REG_SZ /d "${WIDTH}x${HEIGHT}" /f >/dev/null 2>&1 || true
    
    echo -e "${GREEN}✓ Virtual desktop configured in registry${NC}"
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

# Set display resolution via xrandr if requested
if [ -n "$XRANDR_MODE" ]; then
    echo -e "${BLUE}Setting display resolution via xrandr...${NC}"
    echo "  Resolution: $XRANDR_MODE"
    
    # Get the primary display
    PRIMARY_DISPLAY=$(xrandr | grep " connected" | grep "primary" | awk '{print $1}')
    if [ -z "$PRIMARY_DISPLAY" ]; then
        # If no primary, use first connected display
        PRIMARY_DISPLAY=$(xrandr | grep " connected" | awk '{print $1}' | head -1)
    fi
    
    if [ -n "$PRIMARY_DISPLAY" ]; then
        echo "  Display: $PRIMARY_DISPLAY"
        # Try to set the mode
        if xrandr --output "$PRIMARY_DISPLAY" --mode "$XRANDR_MODE" 2>/dev/null; then
            echo -e "${GREEN}✓ Display resolution set to $XRANDR_MODE${NC}"
        else
            echo -e "${YELLOW}⚠ Failed to set resolution, trying to add mode...${NC}"
            # Calculate modeline for the resolution
            MODELINE=$(cvt ${XRANDR_MODE//x/ } | grep Modeline | sed 's/Modeline //' | tr -d '"')
            MODE_NAME=$(echo "$MODELINE" | awk '{print $1}')
            
            # Add the new mode
            xrandr --newmode $MODELINE 2>/dev/null || true
            xrandr --addmode "$PRIMARY_DISPLAY" "$MODE_NAME" 2>/dev/null || true
            xrandr --output "$PRIMARY_DISPLAY" --mode "$MODE_NAME" 2>/dev/null || echo -e "${YELLOW}⚠ Could not set custom resolution${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ No display found${NC}"
    fi
    echo ""
fi

# Change to game directory
cd "$(dirname "$GAME_EXECUTABLE")" || true

# Launch the game via Wine
if [ -n "$WINE_VIRTUAL_DESKTOP" ]; then
    # Use Wine virtual desktop for fullscreen/windowed mode
    # Wine needs to launch the game directly, the registry settings will handle the virtual desktop
    if [ -n "$GAME_ARGS" ]; then
        wine "$GAME_EXECUTABLE" $GAME_ARGS &
    else
        wine "$GAME_EXECUTABLE" &
    fi
    
    # Get the PID of the wine process
    WINE_PID=$!
    
    # Wait a moment for the window to appear
    sleep 2
    
    # Try to make the window fullscreen using xdotool
    # Find the window by searching for any window (the game should be the newest)
    WINDOW_ID=$(xdotool search --name ".*" | tail -1)
    if [ -n "$WINDOW_ID" ]; then
        echo "Making window $WINDOW_ID fullscreen..."
        xdotool windowactivate "$WINDOW_ID"
        xdotool key F11 || xdotool windowstate --add FULLSCREEN "$WINDOW_ID" || true
    fi
    
    # Wait for the wine process to finish
    wait $WINE_PID
else
    # Standard Wine launch
    if [ -n "$GAME_ARGS" ]; then
        exec wine "$GAME_EXECUTABLE" $GAME_ARGS
    else
        exec wine "$GAME_EXECUTABLE"
    fi
fi
