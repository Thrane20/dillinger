#!/bin/bash
# Dillinger FS-UAE Amiga Emulator Runner - Entrypoint Wrapper
# Calls base entrypoint first, then sets up FS-UAE environment
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  FS-UAE Runner - Initializing...${NC}"
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
# FS-UAE-Specific Setup
#######################################################

echo -e "${BLUE}Configuring FS-UAE environment...${NC}"

# Set FS-UAE defaults if not already set
FSUAE_CONFIG_DIR="${FSUAE_CONFIG_DIR:-/config/fs-uae}"
FSUAE_KICKSTARTS_DIR="${FSUAE_KICKSTARTS_DIR:-/bios}"

export FSUAE_CONFIG_DIR
export FSUAE_KICKSTARTS_DIR

echo "  FS-UAE Config Dir: $FSUAE_CONFIG_DIR"
echo "  FS-UAE Kickstarts Dir: $FSUAE_KICKSTARTS_DIR"

# Create FS-UAE configuration directory if it doesn't exist
if [ ! -d "$FSUAE_CONFIG_DIR" ]; then
    echo -e "${BLUE}Creating FS-UAE configuration directory...${NC}"
    mkdir -p "$FSUAE_CONFIG_DIR"
    chown -R "${UNAME:-gameuser}":"${UNAME:-gameuser}" "$FSUAE_CONFIG_DIR"
    echo -e "${GREEN}✓ FS-UAE configuration directory created${NC}"
else
    echo -e "${GREEN}✓ FS-UAE configuration directory exists${NC}"
fi

# Create kickstarts directory if it doesn't exist
if [ ! -d "$FSUAE_KICKSTARTS_DIR" ]; then
    echo -e "${BLUE}Creating FS-UAE kickstarts directory...${NC}"
    mkdir -p "$FSUAE_KICKSTARTS_DIR"
    chown -R "${UNAME:-gameuser}":"${UNAME:-gameuser}" "$FSUAE_KICKSTARTS_DIR"
    echo -e "${GREEN}✓ FS-UAE kickstarts directory created${NC}"
else
    echo -e "${GREEN}✓ FS-UAE kickstarts directory exists${NC}"
fi

# Verify FS-UAE emulator availability
echo -e "${BLUE}Verifying FS-UAE emulator...${NC}"
if command -v fs-uae >/dev/null 2>&1; then
    FS_UAE_VERSION=$(fs-uae --version 2>&1 | head -n 1 || echo "Unknown")
    echo -e "${GREEN}  ✓ fs-uae available: $FS_UAE_VERSION${NC}"
else
    echo -e "${YELLOW}  ⚠ fs-uae not found${NC}"
fi

# Configure FS-UAE settings based on environment variables
# These can be overridden by the user via environment variables

# Video settings
FSUAE_FULLSCREEN="${FSUAE_FULLSCREEN:-0}"
FSUAE_VSYNC="${FSUAE_VSYNC:-1}"
FSUAE_VIDEO_SYNC="${FSUAE_VIDEO_SYNC:-1}"

# Audio settings
FSUAE_AUDIO_FREQUENCY="${FSUAE_AUDIO_FREQUENCY:-44100}"
FSUAE_AUDIO_BUFFER_SIZE="${FSUAE_AUDIO_BUFFER_SIZE:-2048}"

# Performance settings
FSUAE_ACCURACY="${FSUAE_ACCURACY:-1}"  # 0=Fast, 1=Compatible (default)

echo -e "${BLUE}FS-UAE Configuration:${NC}"
echo "  Fullscreen: $FSUAE_FULLSCREEN"
echo "  VSync: $FSUAE_VSYNC"
echo "  Video Sync: $FSUAE_VIDEO_SYNC"
echo "  Audio Frequency: $FSUAE_AUDIO_FREQUENCY Hz"
echo "  Accuracy: $FSUAE_ACCURACY"

# Build FS-UAE command line options based on configuration
FSUAE_COMMON_OPTS=""

if [ "$FSUAE_FULLSCREEN" = "1" ]; then
    FSUAE_COMMON_OPTS="$FSUAE_COMMON_OPTS --fullscreen"
fi

if [ "$FSUAE_VIDEO_SYNC" = "1" ]; then
    FSUAE_COMMON_OPTS="$FSUAE_COMMON_OPTS --video_sync=1"
fi

export FSUAE_COMMON_OPTS

# Check for kickstart ROMs
echo -e "${BLUE}Checking for Kickstart ROMs...${NC}"
KICKSTART_COUNT=$(find "$FSUAE_KICKSTARTS_DIR" -type f \( -name "*.rom" -o -name "*.ROM" \) 2>/dev/null | wc -l)
if [ "$KICKSTART_COUNT" -gt 0 ]; then
    echo -e "${GREEN}  ✓ Found $KICKSTART_COUNT kickstart ROM(s)${NC}"
else
    echo -e "${YELLOW}  ⚠ No kickstart ROMs found in $FSUAE_KICKSTARTS_DIR${NC}"
    echo -e "${YELLOW}    Kickstart ROMs are required for Amiga emulation${NC}"
    echo -e "${YELLOW}    Place your kickstart ROMs (e.g., kick*.rom) in the BIOS directory${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  FS-UAE Runner Ready${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Execute command as game user if provided
if [ "$#" -gt 0 ]; then
    echo -e "${BLUE}Executing command: $*${NC}"
    echo ""
    exec gosu "${UNAME:-gameuser}" "$@"
else
    echo -e "${BLUE}No command provided, starting shell...${NC}"
    echo ""
    exec gosu "${UNAME:-gameuser}" /bin/bash
fi
