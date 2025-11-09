#!/bin/bash
# Dillinger VICE Commodore Emulator Runner - Entrypoint Wrapper
# Calls base entrypoint first, then sets up VICE environment
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  VICE Runner - Initializing...${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Set up basic environment variables that base entrypoint would set
UNAME="${UNAME:-gameuser}"
PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

# Export display and audio variables if they exist
export DISPLAY="${DISPLAY:-:0}"
export PULSE_SERVER="${PULSE_SERVER:-unix:/run/user/1000/pulse/native}"
export PULSE_COOKIE="${PULSE_COOKIE:-/home/${UNAME}/.config/pulse/cookie}"

# Set XAUTHORITY if xauth file is mounted
if [ -f "/home/${UNAME}/.Xauthority" ]; then
    export XAUTHORITY="/home/${UNAME}/.Xauthority"
fi

echo -e "${GREEN}Display configured: ${DISPLAY}${NC}"
if [ -n "$XAUTHORITY" ]; then
    echo -e "${GREEN}X11 auth configured: ${XAUTHORITY}${NC}"
fi
echo ""

#######################################################
# VICE-Specific Setup
#######################################################

echo -e "${BLUE}Configuring VICE environment...${NC}"

# Set VICE defaults if not already set
VICE_ROM_PATH="${VICE_ROM_PATH:-/usr/lib/vice}"
VICE_CONFIG_DIR="${VICE_CONFIG_DIR:-/config/vice}"

export VICE_ROM_PATH
export VICE_CONFIG_DIR

echo "  VICE ROM Path: $VICE_ROM_PATH"
echo "  VICE Config Dir: $VICE_CONFIG_DIR"

# Create VICE configuration directory if it doesn't exist
if [ ! -d "$VICE_CONFIG_DIR" ]; then
    echo -e "${BLUE}Creating VICE configuration directory...${NC}"
    mkdir -p "$VICE_CONFIG_DIR"
    chown -R ${UNAME:-gameuser}:${UNAME:-gameuser} "$VICE_CONFIG_DIR"
    echo -e "${GREEN}✓ VICE configuration directory created${NC}"
else
    echo -e "${GREEN}✓ VICE configuration directory exists${NC}"
fi

# Verify VICE emulator availability
echo -e "${BLUE}Verifying VICE emulators...${NC}"
VICE_EMULATORS=(x64sc x128 xvic xplus4 xpet xcbm2 xcbm5x0)
for emu in "${VICE_EMULATORS[@]}"; do
    if command -v "$emu" >/dev/null 2>&1; then
        echo -e "${GREEN}  ✓ $emu available${NC}"
    else
        echo -e "${YELLOW}  ⚠ $emu not found${NC}"
    fi
done

# Configure VICE settings based on environment variables
# These can be overridden by the user via environment variables

# Video settings
VICE_VIDEO_FULLSCREEN="${VICE_VIDEO_FULLSCREEN:-0}"
VICE_VIDEO_VSYNC="${VICE_VIDEO_VSYNC:-1}"
VICE_VIDEO_DOUBLESCAN="${VICE_VIDEO_DOUBLESCAN:-1}"
VICE_VIDEO_DOUBLESIZE="${VICE_VIDEO_DOUBLESIZE:-1}"

# Audio settings
VICE_AUDIO_ENABLED="${VICE_AUDIO_ENABLED:-1}"
VICE_AUDIO_FRAGMENT_SIZE="${VICE_AUDIO_FRAGMENT_SIZE:-medium}"

# Input settings
VICE_MOUSE_GRAB="${VICE_MOUSE_GRAB:-0}"

# Performance settings
VICE_TRUE_DRIVE_EMULATION="${VICE_TRUE_DRIVE_EMULATION:-1}"
VICE_WARP_MODE="${VICE_WARP_MODE:-0}"

echo -e "${BLUE}VICE Configuration:${NC}"
echo "  Fullscreen: $VICE_VIDEO_FULLSCREEN"
echo "  VSync: $VICE_VIDEO_VSYNC"
echo "  Double Scan: $VICE_VIDEO_DOUBLESCAN"
echo "  Double Size: $VICE_VIDEO_DOUBLESIZE"
echo "  Audio: $VICE_AUDIO_ENABLED"
echo "  True Drive Emulation: $VICE_TRUE_DRIVE_EMULATION"
echo "  Warp Mode: $VICE_WARP_MODE"

# Build VICE command line options based on configuration
VICE_COMMON_OPTS=""

if [ "$VICE_VIDEO_FULLSCREEN" = "1" ]; then
    VICE_COMMON_OPTS="$VICE_COMMON_OPTS -fullscreen"
fi

if [ "$VICE_VIDEO_VSYNC" = "1" ]; then
    VICE_COMMON_OPTS="$VICE_COMMON_OPTS +VSync"
fi

if [ "$VICE_VIDEO_DOUBLESCAN" = "1" ]; then
    VICE_COMMON_OPTS="$VICE_COMMON_OPTS +DoubleScan"
fi

if [ "$VICE_VIDEO_DOUBLESIZE" = "1" ]; then
    VICE_COMMON_OPTS="$VICE_COMMON_OPTS +DoubleSize"
fi

if [ "$VICE_AUDIO_ENABLED" = "0" ]; then
    VICE_COMMON_OPTS="$VICE_COMMON_OPTS -sound"
fi

if [ "$VICE_TRUE_DRIVE_EMULATION" = "0" ]; then
    VICE_COMMON_OPTS="$VICE_COMMON_OPTS +VirtualDevices"
else
    VICE_COMMON_OPTS="$VICE_COMMON_OPTS -VirtualDevices"
fi

if [ "$VICE_WARP_MODE" = "1" ]; then
    VICE_COMMON_OPTS="$VICE_COMMON_OPTS +warp"
fi

export VICE_COMMON_OPTS

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  VICE Runner Ready${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Execute command as game user if provided
if [ "$#" -gt 0 ]; then
    echo -e "${BLUE}Executing command: $@${NC}"
    echo ""
    exec gosu ${UNAME:-gameuser} "$@"
else
    echo -e "${BLUE}No command provided, starting shell...${NC}"
    echo ""
    exec gosu ${UNAME:-gameuser} /bin/bash
fi
