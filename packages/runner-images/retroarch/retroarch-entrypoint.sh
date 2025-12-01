#!/bin/bash
# Dillinger RetroArch Runner - Entrypoint Wrapper
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  RetroArch Runner - Initializing...${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Set up basic environment variables
UNAME="${UNAME:-gameuser}"
PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

# Export display and audio variables
export DISPLAY="${DISPLAY:-:0}"
export PULSE_SERVER="${PULSE_SERVER:-unix:/run/user/1000/pulse/native}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/1000}"

# Handle PulseAudio cookie
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

# Ensure XDG_RUNTIME_DIR exists and has correct permissions
if [ ! -d "$XDG_RUNTIME_DIR" ]; then
    mkdir -p "$XDG_RUNTIME_DIR"
    chown "${UNAME}:${UNAME}" "$XDG_RUNTIME_DIR"
    chmod 700 "$XDG_RUNTIME_DIR"
fi

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

# Fix permissions for /dev/input/* to ensure controller access
if [ -d "/dev/input" ]; then
    echo -e "${BLUE}Checking input device permissions...${NC}"
    # Get GID of /dev/input/event0 or similar
    INPUT_DEV=$(find /dev/input -name "event*" | head -n1)
    if [ -n "$INPUT_DEV" ]; then
        INPUT_GID=$(stat -c '%g' "$INPUT_DEV")
        if ! id -G "${UNAME:-gameuser}" | grep -qw "$INPUT_GID"; then
            echo "  Adding ${UNAME:-gameuser} to input group GID $INPUT_GID"
            
            # Check if group with this GID exists
            if getent group "$INPUT_GID" >/dev/null; then
                EXISTING_GROUP=$(getent group "$INPUT_GID" | cut -d: -f1)
                usermod -aG "$EXISTING_GROUP" "${UNAME:-gameuser}"
            else
                groupadd -g "$INPUT_GID" host_input
                usermod -aG host_input "${UNAME:-gameuser}"
            fi
        else
            echo "  User already has access to input group GID $INPUT_GID"
        fi
    fi
fi

# Set XAUTHORITY if xauth file is mounted
if [ -f "/home/${UNAME}/.Xauthority" ]; then
    export XAUTHORITY="/home/${UNAME}/.Xauthority"
fi

echo -e "${GREEN}Display configured: ${DISPLAY}${NC}"

#######################################################
# RetroArch Setup
#######################################################

echo -e "${BLUE}Configuring RetroArch environment...${NC}"

# Default paths
# Use the home directory for config so it persists (mounted volume)
RETROARCH_CONFIG_DIR="/home/${UNAME}/.config/retroarch"
RETROARCH_CONFIG_FILE="$RETROARCH_CONFIG_DIR/retroarch.cfg"

# Create config directory if it doesn't exist
if [ ! -d "$RETROARCH_CONFIG_DIR" ]; then
    mkdir -p "$RETROARCH_CONFIG_DIR"
    chown -R "${UNAME}:${UNAME}" "$RETROARCH_CONFIG_DIR"
fi

# Generate default config if missing
if [ ! -f "$RETROARCH_CONFIG_FILE" ]; then
    echo -e "${BLUE}Generating default RetroArch config...${NC}"
    # We can let RetroArch generate it, or write a minimal one
    # For now, let's write some defaults
    cat > "$RETROARCH_CONFIG_FILE" <<EOF
system_directory = "/system"
savefile_directory = "/saves"
savestate_directory = "/states"
video_driver = "gl"
audio_driver = "pulse"
input_driver = "udev"
menu_driver = "ozone"
EOF
    chown "${UNAME}:${UNAME}" "$RETROARCH_CONFIG_FILE"
fi

# Determine Core
# The backend should pass the core name via env var RETROARCH_CORE
# or we can try to guess based on the file extension or platform
CORE_PATH=""
if [ -n "$RETROARCH_CORE" ]; then
    # Check common locations
    if [ -f "/usr/lib/libretro/${RETROARCH_CORE}_libretro.so" ]; then
        CORE_PATH="/usr/lib/libretro/${RETROARCH_CORE}_libretro.so"
    elif [ -f "/usr/lib/libretro/${RETROARCH_CORE}.so" ]; then
        CORE_PATH="/usr/lib/libretro/${RETROARCH_CORE}.so"
    fi
fi

# Default to mame if not specified (since this was requested for arcade)
if [ -z "$CORE_PATH" ]; then
    if [ -f "/usr/lib/libretro/mame_libretro.so" ]; then
        CORE_PATH="/usr/lib/libretro/mame_libretro.so"
        echo -e "${YELLOW}No core specified, defaulting to MAME${NC}"
    fi
fi

echo "  Core: $CORE_PATH"

# Build command
CMD="retroarch"
ARGS=("-c" "$RETROARCH_CONFIG_FILE")

if [ -n "$CORE_PATH" ]; then
    ARGS+=("-L" "$CORE_PATH")
fi

# Add ROM path if provided as argument
if [ "$#" -gt 0 ]; then
    ARGS+=("$@")
fi

echo -e "${BLUE}Executing: $CMD ${ARGS[*]}${NC}"
echo ""

exec gosu "${UNAME:-gameuser}" "$CMD" "${ARGS[@]}"
