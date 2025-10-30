#!/bin/bash
# Dillinger Linux Native Game Runner - Entrypoint Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}==================================${NC}"
echo -e "${GREEN}Dillinger Linux Native Game Runner${NC}"
echo -e "${GREEN}==================================${NC}"

# Check required environment variables
if [ -z "$GAME_EXECUTABLE" ]; then
    echo -e "${RED}ERROR: GAME_EXECUTABLE environment variable is required${NC}"
    echo "Example: docker run -e GAME_EXECUTABLE='/game/start.sh' ..."
    exit 1
fi

# Verify the game executable exists
if [ ! -e "$GAME_EXECUTABLE" ]; then
    echo -e "${RED}ERROR: Game executable not found: $GAME_EXECUTABLE${NC}"
    echo "Make sure the game volume is mounted correctly"
    exit 1
fi

# Make executable if it's a file and not already executable
if [ -f "$GAME_EXECUTABLE" ] && [ ! -x "$GAME_EXECUTABLE" ]; then
    echo -e "${YELLOW}Making game executable: $GAME_EXECUTABLE${NC}"
    chmod +x "$GAME_EXECUTABLE" 2>/dev/null || {
        echo -e "${YELLOW}Warning: Could not make file executable (read-only mount?)${NC}"
    }
fi

# Set up save directory
SAVE_DIR="${SAVE_DIR:-/saves}"
if [ ! -d "$SAVE_DIR" ]; then
    echo -e "${YELLOW}Creating save directory: $SAVE_DIR${NC}"
    mkdir -p "$SAVE_DIR"
fi

# Export common paths for games
export HOME=/home/gameuser
export XDG_DATA_HOME=/saves/data
export XDG_CONFIG_HOME=/saves/config
export XDG_CACHE_HOME=/saves/cache

# Create XDG directories
mkdir -p "$XDG_DATA_HOME" "$XDG_CONFIG_HOME" "$XDG_CACHE_HOME"

# Display configuration info
echo ""
echo -e "${GREEN}Configuration:${NC}"
echo "  Executable: $GAME_EXECUTABLE"
echo "  Arguments: ${GAME_ARGS:-<none>}"
echo "  Save Directory: $SAVE_DIR"
echo "  Display: ${DISPLAY:-<not set>}"
echo "  User: $(whoami)"
echo ""

# Check for display (X11)
if [ -n "$DISPLAY" ]; then
    echo -e "${GREEN}Checking X11 connection...${NC}"
    if xdpyinfo >/dev/null 2>&1; then
        echo -e "${GREEN}✓ X11 connection successful${NC}"
    else
        echo -e "${YELLOW}⚠ Warning: Cannot connect to X11 display${NC}"
        echo "  Make sure you mounted /tmp/.X11-unix and set DISPLAY"
    fi
fi

# Check for audio (PulseAudio)
if command -v pulseaudio >/dev/null 2>&1; then
    echo -e "${GREEN}Checking audio...${NC}"
    if pulseaudio --check 2>/dev/null; then
        echo -e "${GREEN}✓ PulseAudio is running${NC}"
    else
        echo -e "${YELLOW}⚠ PulseAudio not running, starting in background...${NC}"
        pulseaudio --start --exit-idle-time=-1 2>/dev/null || true
    fi
fi

# Check for GPU access
if [ -d "/dev/dri" ]; then
    echo -e "${GREEN}✓ GPU device access available${NC}"
else
    echo -e "${YELLOW}⚠ No GPU device access (software rendering only)${NC}"
fi

echo ""
echo -e "${GREEN}Starting game...${NC}"
echo -e "${GREEN}==================================${NC}"
echo ""

# Launch the game
cd "$(dirname "$GAME_EXECUTABLE")" || true

if [ -n "$GAME_ARGS" ]; then
    exec "$GAME_EXECUTABLE" $GAME_ARGS
else
    exec "$GAME_EXECUTABLE"
fi
