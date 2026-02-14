#!/bin/bash
# Dillinger VICE Commodore Emulator Runner - Entrypoint Wrapper
# Calls base entrypoint first, then sets up VICE environment
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  VICE Runner - Initializing...${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Set up basic environment variables
UNAME="${UNAME:-gameuser}"
PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

# Source base entrypoint functions and run base setup (display, audio, GPU)
source /usr/local/bin/entrypoint.sh

# Best-effort Wayland detection when DISPLAY is not set
if [ -z "${DISPLAY:-}" ] && [ -z "${WAYLAND_DISPLAY:-}" ]; then
    for candidate in /run/user/*/wayland-*; do
        if [ -S "$candidate" ]; then
            export XDG_RUNTIME_DIR="$(dirname "$candidate")"
            export WAYLAND_DISPLAY="$(basename "$candidate")"
            export GDK_BACKEND="${GDK_BACKEND:-wayland}"
            export SDL_VIDEODRIVER="${SDL_VIDEODRIVER:-wayland}"
            export QT_QPA_PLATFORM="${QT_QPA_PLATFORM:-wayland}"
            break
        fi
    done
fi

run_base_setup

# Ensure Wayland socket and runtime directory are aligned for GTK apps
if [ -n "${WAYLAND_DISPLAY:-}" ]; then
    WAYLAND_SOCKET="${XDG_RUNTIME_DIR:-}/${WAYLAND_DISPLAY}"
    if [ ! -S "$WAYLAND_SOCKET" ]; then
        for candidate in /run/user/*/wayland-*; do
            if [ -S "$candidate" ]; then
                export XDG_RUNTIME_DIR="$(dirname "$candidate")"
                export WAYLAND_DISPLAY="$(basename "$candidate")"
                WAYLAND_SOCKET="$candidate"
                break
            fi
        done
    fi

    if [ -S "$WAYLAND_SOCKET" ]; then
        export GDK_BACKEND="${GDK_BACKEND:-wayland}"
    fi
fi

#######################################################
# VICE-Specific Setup
#######################################################

echo -e "${BLUE}Configuring VICE environment...${NC}"

# Set VICE defaults if not already set
VICE_ROM_PATH="${VICE_ROM_PATH:-/usr/lib/vice}"
VICE_CONFIG_DIR="${VICE_CONFIG_DIR:-/config/vice}"
XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-/home/${UNAME}/.config}"
XDG_STATE_HOME="${XDG_STATE_HOME:-/home/${UNAME}/.local/state}"

export VICE_ROM_PATH
export VICE_CONFIG_DIR
export XDG_CONFIG_HOME
export XDG_STATE_HOME

echo "  VICE ROM Path: $VICE_ROM_PATH"
echo "  VICE Config Dir: $VICE_CONFIG_DIR"

# Create VICE configuration directory if it doesn't exist
if [ ! -d "$VICE_CONFIG_DIR" ]; then
    echo -e "${BLUE}Creating VICE configuration directory...${NC}"
    mkdir -p "$VICE_CONFIG_DIR"
    chown -R "${UNAME:-gameuser}":"${UNAME:-gameuser}" "$VICE_CONFIG_DIR"
    echo -e "${GREEN}✓ VICE configuration directory created${NC}"
else
    echo -e "${GREEN}✓ VICE configuration directory exists${NC}"
fi

# Ensure user config directory exists for VICE
VICE_USER_CONFIG_DIR="${XDG_CONFIG_HOME}/vice"
if [ ! -d "$VICE_USER_CONFIG_DIR" ]; then
    mkdir -p "$VICE_USER_CONFIG_DIR"
    chown -R "${UNAME}:${UNAME}" "${XDG_CONFIG_HOME}"
fi

# Ensure user state directory exists for VICE
VICE_USER_STATE_DIR="${XDG_STATE_HOME}/vice"
if [ ! -d "$VICE_USER_STATE_DIR" ]; then
    mkdir -p "$VICE_USER_STATE_DIR"
    chown -R "${UNAME}:${UNAME}" "/home/${UNAME}/.local"
fi

# Ensure VICE cache directory exists (prevents startup errors)
VICE_CACHE_DIR="/home/${UNAME}/.cache/vice"
if [ ! -d "$VICE_CACHE_DIR" ]; then
    mkdir -p "$VICE_CACHE_DIR"
    chown -R "${UNAME}:${UNAME}" "/home/${UNAME}/.cache"
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

#######################################################
# Joystick Discovery for SDL2
#######################################################
#
# VICE uses SDL2 for joystick input. Inside a container there is no udevd
# running, so SDL2 cannot enumerate joystick devices on its own.  We scan
# /dev/input/event* for devices that have joystick capabilities and tell
# SDL2 about them via SDL_JOYSTICK_DEVICE.
#######################################################

echo ""
echo -e "${BLUE}Configuring joystick input...${NC}"

# Ensure event devices are readable by gameuser
for evdev in /dev/input/event*; do
    [ -c "$evdev" ] || continue
    if ! gosu "${UNAME}" test -r "$evdev" 2>/dev/null; then
        chmod a+r "$evdev" 2>/dev/null || true
    fi
done

# Discover joystick event devices.
# We check each /dev/input/event* for joystick-related capabilities via
# /proc/bus/input/devices (mounted at /tmp/host-input-devices by
# docker-service).  Fallback: if that file isn't available, enumerate
# /dev/input/js* and find their matching event devices.
SDL_JOY_DEVS=""
INPUT_DEVICES_FILE="/tmp/host-input-devices"
[ -f "$INPUT_DEVICES_FILE" ] || INPUT_DEVICES_FILE="/proc/bus/input/devices"

if [ -f "$INPUT_DEVICES_FILE" ]; then
    CURRENT_NAME=""
    while IFS= read -r line; do
        if [[ "$line" =~ ^N:\ Name=\"(.*)\"$ ]]; then
            CURRENT_NAME="${BASH_REMATCH[1]}"
        fi
        if [[ "$line" =~ ^H:\ Handlers= ]] && [[ "$line" =~ js[0-9]+ ]]; then
            # This handler line belongs to a joystick — extract its eventN
            EVENT_DEV=""
            if [[ "$line" =~ (event[0-9]+) ]]; then
                EVENT_DEV="${BASH_REMATCH[1]}"
            fi
            if [ -n "$EVENT_DEV" ] && [ -c "/dev/input/$EVENT_DEV" ]; then
                echo "  ✓ Joystick: $CURRENT_NAME -> /dev/input/$EVENT_DEV"
                [ -n "$SDL_JOY_DEVS" ] && SDL_JOY_DEVS="$SDL_JOY_DEVS,"
                SDL_JOY_DEVS="$SDL_JOY_DEVS/dev/input/$EVENT_DEV"
            fi
        fi
    done < "$INPUT_DEVICES_FILE"
else
    # Fallback: try sysfs to map jsN → eventN
    for js in /dev/input/js*; do
        [ -c "$js" ] || continue
        JS_NUM="${js#/dev/input/js}"
        # Find the parent input device in sysfs and its eventN sibling
        for sysdev in /sys/class/input/js"${JS_NUM}"/device/event*; do
            if [ -d "$sysdev" ]; then
                EV_NAME=$(basename "$sysdev")
                if [ -c "/dev/input/$EV_NAME" ]; then
                    echo "  ✓ Joystick: js${JS_NUM} -> /dev/input/$EV_NAME"
                    [ -n "$SDL_JOY_DEVS" ] && SDL_JOY_DEVS="$SDL_JOY_DEVS,"
                    SDL_JOY_DEVS="$SDL_JOY_DEVS/dev/input/$EV_NAME"
                fi
            fi
        done
    done
fi

if [ -n "$SDL_JOY_DEVS" ]; then
    export SDL_JOYSTICK_DEVICE="$SDL_JOY_DEVS"
    echo -e "  ${GREEN}SDL_JOYSTICK_DEVICE=$SDL_JOYSTICK_DEVICE${NC}"
else
    echo -e "  ${YELLOW}⚠ No joystick devices found${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  VICE Runner Ready${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Final display enforcement for GTK apps
if [ -z "${DISPLAY:-}" ]; then
    if [ -z "${WAYLAND_DISPLAY:-}" ] || [ -z "${XDG_RUNTIME_DIR:-}" ] || [ ! -S "${XDG_RUNTIME_DIR}/${WAYLAND_DISPLAY}" ]; then
        for runtime_dir in /run/user/1000 "/run/user/${UNAME}"; do
            if [ -d "$runtime_dir" ]; then
                for socket in "$runtime_dir"/wayland-*; do
                    if [ -S "$socket" ]; then
                        export XDG_RUNTIME_DIR="$runtime_dir"
                        export WAYLAND_DISPLAY="$(basename "$socket")"
                        break 2
                    fi
                done
            fi
        done
    fi

    if [ -n "${WAYLAND_DISPLAY:-}" ] && [ -n "${XDG_RUNTIME_DIR:-}" ]; then
        export GDK_BACKEND="${GDK_BACKEND:-wayland}"
        export SDL_VIDEODRIVER="${SDL_VIDEODRIVER:-wayland}"
        export QT_QPA_PLATFORM="${QT_QPA_PLATFORM:-wayland}"
        echo "  Using Wayland: $WAYLAND_DISPLAY (XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR)"
        WAYLAND_SOCKET="${XDG_RUNTIME_DIR}/${WAYLAND_DISPLAY}"
        if [ -S "$WAYLAND_SOCKET" ]; then
            echo "  Wayland socket: $WAYLAND_SOCKET"
        else
            echo "  ⚠ Wayland socket missing: $WAYLAND_SOCKET"
            ls -la "$XDG_RUNTIME_DIR" | head -n 10 || true
        fi
    fi
fi

# If X11 socket exists, allow GTK to fall back to X11 when needed
if [ -z "${DISPLAY:-}" ] && [ -S "/tmp/.X11-unix/X0" ]; then
    export DISPLAY=":0"
    export GDK_BACKEND="${GDK_BACKEND:-wayland,x11}"
    echo "  X11 fallback enabled: DISPLAY=$DISPLAY"
fi

# Execute command as game user
if [ "$#" -gt 0 ]; then
    echo -e "${BLUE}Executing command: $*${NC}"
    echo ""
    exec gosu "${UNAME:-gameuser}" "$@"
else
    echo -e "${BLUE}No command provided, starting shell...${NC}"
    echo ""
    exec gosu "${UNAME:-gameuser}" /bin/bash
fi
