#!/bin/bash
# Dillinger MAME Arcade Emulator Runner - Entrypoint Wrapper
# Calls base entrypoint first, then sets up MAME environment
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  MAME Runner - Initializing...${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Set up basic environment variables that base entrypoint would set
UNAME="${UNAME:-gameuser}"
PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

# Export display and audio variables if they exist
export DISPLAY="${DISPLAY:-:0}"
export PULSE_SERVER="${PULSE_SERVER:-unix:/run/user/1000/pulse/native}"
# Handle PulseAudio cookie
# If the cookie is mounted read-only, copy it to a writable location
ORIGINAL_PULSE_COOKIE="${PULSE_COOKIE:-/home/${UNAME}/.config/pulse/cookie}"
if [ -f "$ORIGINAL_PULSE_COOKIE" ]; then
    # Create a writable copy in /tmp
    cp "$ORIGINAL_PULSE_COOKIE" /tmp/pulse-cookie
    chown "${UNAME}:${UNAME}" /tmp/pulse-cookie
    chmod 600 /tmp/pulse-cookie
    export PULSE_COOKIE=/tmp/pulse-cookie
    echo -e "${GREEN}PulseAudio cookie copied to writable location: $PULSE_COOKIE${NC}"
else
    export PULSE_COOKIE="$ORIGINAL_PULSE_COOKIE"
fi

export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/1000}"

# Ensure XDG_RUNTIME_DIR exists and has correct permissions
if [ ! -d "$XDG_RUNTIME_DIR" ]; then
    mkdir -p "$XDG_RUNTIME_DIR"
    chown "${UNAME}:${UNAME}" "$XDG_RUNTIME_DIR"
    chmod 700 "$XDG_RUNTIME_DIR"
fi

# Set XAUTHORITY if xauth file is mounted
if [ -f "/home/${UNAME}/.Xauthority" ]; then
    export XAUTHORITY="/home/${UNAME}/.Xauthority"
fi

echo -e "${GREEN}Display configured: ${DISPLAY}${NC}"
if [ -n "$XAUTHORITY" ]; then
    echo -e "${GREEN}X11 auth configured: ${XAUTHORITY}${NC}"
fi
echo ""

# Fix permissions for /dev/snd/* to ensure audio access
if [ -d "/dev/snd" ]; then
    echo -e "${BLUE}Checking audio device permissions...${NC}"
    # Get GID of /dev/snd/seq or /dev/snd/timer
    AUDIO_DEV=$(find /dev/snd -name "seq" -o -name "timer" | head -n1)
    if [ -n "$AUDIO_DEV" ]; then
        AUDIO_GID=$(stat -c '%g' "$AUDIO_DEV")
        if ! id -G "${UNAME:-gameuser}" | grep -qw "$AUDIO_GID"; then
            echo "  Adding ${UNAME:-gameuser} to audio group GID $AUDIO_GID"
            
            # Check if group with this GID exists
            if getent group "$AUDIO_GID" >/dev/null; then
                EXISTING_GROUP=$(getent group "$AUDIO_GID" | cut -d: -f1)
                usermod -aG "$EXISTING_GROUP" "${UNAME:-gameuser}"
            else
                groupadd -g "$AUDIO_GID" host_audio
                usermod -aG host_audio "${UNAME:-gameuser}"
            fi
        else
            echo "  User already has access to audio group GID $AUDIO_GID"
        fi
    fi
fi

#######################################################
# MAME-Specific Setup
#######################################################

echo -e "${BLUE}Configuring MAME environment...${NC}"

# Set MAME defaults if not already set
MAME_CONFIG_DIR="${MAME_CONFIG_DIR:-/config/mame}"
MAME_ROM_PATH="${MAME_ROM_PATH:-/roms}"
MAME_SAMPLE_PATH="${MAME_SAMPLE_PATH:-/samples}"
MAME_ARTWORK_PATH="${MAME_ARTWORK_PATH:-/artwork}"

export MAME_CONFIG_DIR
export MAME_ROM_PATH
export MAME_SAMPLE_PATH
export MAME_ARTWORK_PATH

echo "  MAME Config Dir: $MAME_CONFIG_DIR"
echo "  MAME ROM Path: $MAME_ROM_PATH"

# Create MAME configuration directory if it doesn't exist
if [ ! -d "$MAME_CONFIG_DIR" ]; then
    echo -e "${BLUE}Creating MAME configuration directory...${NC}"
    mkdir -p "$MAME_CONFIG_DIR"
    chown -R "${UNAME:-gameuser}":"${UNAME:-gameuser}" "$MAME_CONFIG_DIR"
    echo -e "${GREEN}✓ MAME configuration directory created${NC}"
else
    echo -e "${GREEN}✓ MAME configuration directory exists${NC}"
fi

# Verify MAME availability
echo -e "${BLUE}Verifying MAME...${NC}"
if command -v mame >/dev/null 2>&1; then
    echo -e "${GREEN}  ✓ mame available${NC}"
else
    echo -e "${YELLOW}  ⚠ mame not found${NC}"
fi

# Configure MAME settings based on environment variables
# These can be overridden by the user via environment variables

# Video settings
MAME_VIDEO_MODE="${MAME_VIDEO_MODE:-opengl}" # opengl, bgfx, soft
MAME_WINDOW="${MAME_WINDOW:-0}" # 0 = fullscreen, 1 = windowed

# Audio settings
MAME_SOUND="${MAME_SOUND:-auto}"

echo -e "${BLUE}MAME Configuration:${NC}"
echo "  Video Mode: $MAME_VIDEO_MODE"
echo "  Windowed: $MAME_WINDOW"
echo "  Sound: $MAME_SOUND"

# Build MAME command line options based on configuration
MAME_COMMON_OPTS=""

if [ "$MAME_WINDOW" = "1" ]; then
    MAME_COMMON_OPTS="$MAME_COMMON_OPTS -window"
else
    MAME_COMMON_OPTS="$MAME_COMMON_OPTS -nowindow"
fi

MAME_COMMON_OPTS="$MAME_COMMON_OPTS -video $MAME_VIDEO_MODE"
MAME_COMMON_OPTS="$MAME_COMMON_OPTS -sound $MAME_SOUND"

# Add paths
MAME_COMMON_OPTS="$MAME_COMMON_OPTS -rompath $MAME_ROM_PATH"
MAME_COMMON_OPTS="$MAME_COMMON_OPTS -samplepath $MAME_SAMPLE_PATH"
MAME_COMMON_OPTS="$MAME_COMMON_OPTS -artpath $MAME_ARTWORK_PATH"
MAME_COMMON_OPTS="$MAME_COMMON_OPTS -cfg_directory $MAME_CONFIG_DIR"

export MAME_COMMON_OPTS

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  MAME Runner Ready${NC}"
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
