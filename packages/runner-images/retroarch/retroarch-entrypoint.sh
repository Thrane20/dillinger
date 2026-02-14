#!/bin/bash
# Dillinger RetroArch Runner - Entrypoint
# Sources base runner setup and adds RetroArch-specific configuration
set -e

# Colors for output (also defined in base, but we need them before sourcing)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  RetroArch Runner - Initializing...${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

#######################################################
# Optional: xrandr display resolution switching
#######################################################

# When XRANDR_MODE is set (e.g. "1920x1080"), attempt to change the host display
# resolution before launching the game, then restore the original mode on exit.
XRANDR_MODE="${XRANDR_MODE:-}"
XRANDR_OUTPUT="${XRANDR_OUTPUT:-}"

ORIG_XRANDR_OUTPUT=""
ORIG_XRANDR_MODE=""
CHILD_PID=""

detect_xrandr_output() {
    if [ -n "$XRANDR_OUTPUT" ]; then
        echo "$XRANDR_OUTPUT"
        return 0
    fi
    # Prefer primary output; otherwise take first connected output.
    xrandr --query 2>/dev/null | awk '
        / connected primary/ { print $1; exit }
        / connected/ { print $1; exit }
    '
}

detect_current_mode_for_output() {
    local out="$1"
    xrandr --query 2>/dev/null | awk -v out="$out" '
        $1 == out { found=1; next }
        found && $1 ~ /^[0-9]+x[0-9]+$/ && $0 ~ /\*/ { print $1; exit }
        found && NF==0 { exit }
    '
}

apply_xrandr_mode() {
    if [ -z "$XRANDR_MODE" ]; then
        return 0
    fi
    if ! command -v xrandr >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠ XRANDR_MODE requested but xrandr not installed${NC}"
        return 0
    fi
    if [ -z "$DISPLAY" ]; then
        echo -e "${YELLOW}⚠ XRANDR_MODE requested but DISPLAY is not set${NC}"
        return 0
    fi

    echo -e "${BLUE}Attempting to set display resolution via xrandr...${NC}"
    local out
    out="$(detect_xrandr_output)"
    if [ -z "$out" ]; then
        echo -e "${YELLOW}⚠ XRANDR_MODE requested but no connected outputs were detected${NC}"
        return 0
    fi

    local current
    current="$(detect_current_mode_for_output "$out")"

    ORIG_XRANDR_OUTPUT="$out"
    ORIG_XRANDR_MODE="$current"

    echo "  Output: $out"
    echo "  Current: ${current:-<unknown>}"
    echo "  Target:  $XRANDR_MODE"

    if xrandr --output "$out" --mode "$XRANDR_MODE" 2>&1; then
        echo -e "${GREEN}✓ Display resolution set to $XRANDR_MODE${NC}"
    else
        echo -e "${YELLOW}⚠ Failed to set resolution to $XRANDR_MODE${NC}"
        ORIG_XRANDR_OUTPUT=""
        ORIG_XRANDR_MODE=""
    fi
    echo ""
}

restore_xrandr_mode() {
    if [ -z "$ORIG_XRANDR_OUTPUT" ] || [ -z "$ORIG_XRANDR_MODE" ]; then
        return 0
    fi
    if ! command -v xrandr >/dev/null 2>&1; then
        return 0
    fi

    echo -e "${BLUE}Restoring original display resolution...${NC}"
    xrandr --output "$ORIG_XRANDR_OUTPUT" --mode "$ORIG_XRANDR_MODE" >/dev/null 2>&1 || true
    echo -e "${GREEN}✓ Display resolution restored${NC}"

    ORIG_XRANDR_OUTPUT=""
    ORIG_XRANDR_MODE=""
}

on_term() {
    echo -e "${YELLOW}Received termination signal; stopping game and restoring display...${NC}"
    if [ -n "$CHILD_PID" ]; then
        kill -TERM "$CHILD_PID" 2>/dev/null || true
        sleep 1 || true
        kill -KILL "$CHILD_PID" 2>/dev/null || true
    fi
    restore_xrandr_mode
    exit 143
}

trap on_term TERM INT HUP QUIT
trap restore_xrandr_mode EXIT

#######################################################
# Source base entrypoint functions
#######################################################

source /usr/local/bin/entrypoint.sh

# Run base setup (user, GPU, display, audio)
run_base_setup

#######################################################
# RetroArch-Specific Setup
#######################################################

log_section "Configuring RetroArch environment"

# Default paths (use home directory for config persistence)
RETROARCH_CONFIG_DIR="/home/${UNAME}/.config/retroarch"
RETROARCH_CONFIG_FILE="$RETROARCH_CONFIG_DIR/retroarch.cfg"

# Create config directory if it doesn't exist
if [ ! -d "$RETROARCH_CONFIG_DIR" ]; then
    mkdir -p "$RETROARCH_CONFIG_DIR"
    chown -R "${UNAME}:${UNAME}" "$RETROARCH_CONFIG_DIR"
fi

# Helper function to set config value
set_config() {
    local key="$1"
    local value="$2"
    local file="$3"
    if grep -q "^$key =" "$file" 2>/dev/null; then
        sed -i "s|^$key = .*|$key = \"$value\"|" "$file"
    else
        echo "$key = \"$value\"" >> "$file"
    fi
}

# Generate default config if missing
if [ ! -f "$RETROARCH_CONFIG_FILE" ]; then
    log_section "Generating default RetroArch config..."
    cat > "$RETROARCH_CONFIG_FILE" <<EOF
system_directory = "/system"
savefile_directory = "/saves"
savestate_directory = "/states"
video_driver = "gl"
audio_driver = "pulse"
input_driver = "sdl2"
input_joypad_driver = "sdl2"
menu_driver = "ozone"
EOF
    chown "${UNAME}:${UNAME}" "$RETROARCH_CONFIG_FILE"
    echo -e "${GREEN}✓ Default config created${NC}"
fi

# Enforce critical drivers to match known working config
log_section "Enforcing RetroArch drivers"
set_config "input_driver" "sdl2" "$RETROARCH_CONFIG_FILE"
# Use sdl2 joypad driver since udev daemon isn't running in containers
# SDL2 can detect joysticks directly from /dev/input/js* without udev
set_config "input_joypad_driver" "sdl2" "$RETROARCH_CONFIG_FILE"

VIDEO_DRIVER="${RETROARCH_VIDEO_DRIVER:-}"
if [ -z "$VIDEO_DRIVER" ]; then
    if [ -n "${WAYLAND_DISPLAY:-}" ] && [ -z "${DISPLAY:-}" ]; then
        VIDEO_DRIVER="sdl2"
    else
        VIDEO_DRIVER="gl"
    fi
fi

set_config "video_driver" "$VIDEO_DRIVER" "$RETROARCH_CONFIG_FILE"

AUDIO_DRIVER="pulse"
if [ -n "${PULSE_SERVER:-}" ]; then
    if command -v pactl >/dev/null 2>&1 && pactl info >/dev/null 2>&1; then
        AUDIO_DRIVER="pulse"
    else
        log_warning "PulseAudio unavailable; falling back to ALSA"
        AUDIO_DRIVER="alsa"
        unset PULSE_SERVER
    fi
else
    log_warning "PulseAudio not configured; falling back to ALSA"
    AUDIO_DRIVER="alsa"
fi

set_config "audio_driver" "$AUDIO_DRIVER" "$RETROARCH_CONFIG_FILE"

# Fullscreen mode (set RETROARCH_FULLSCREEN=true to enable)
FULLSCREEN="${RETROARCH_FULLSCREEN:-false}"
if [ "$FULLSCREEN" = "true" ]; then
    set_config "video_fullscreen" "true" "$RETROARCH_CONFIG_FILE"
    echo "  Fullscreen: enabled"
else
    set_config "video_fullscreen" "false" "$RETROARCH_CONFIG_FILE"
    echo "  Fullscreen: disabled (set RETROARCH_FULLSCREEN=true to enable)"
fi

# Enforce system directory for BIOS files
# Use RETROARCH_SYSTEM_DIR env var if set (e.g., /data/bios/psx for PSX games)
# Otherwise default to /system (for backwards compatibility)
SYSTEM_DIR="${RETROARCH_SYSTEM_DIR:-/system}"
set_config "system_directory" "$SYSTEM_DIR" "$RETROARCH_CONFIG_FILE"

# Enforce save directories - use env vars if set for per-game isolation
SAVES_DIR="${RETROARCH_SAVES_DIR:-/saves}"
STATES_DIR="${RETROARCH_STATES_DIR:-/states}"
set_config "savefile_directory" "$SAVES_DIR" "$RETROARCH_CONFIG_FILE"
set_config "savestate_directory" "$STATES_DIR" "$RETROARCH_CONFIG_FILE"

# Enforce screenshot directory - keep per-game screenshots in emulator home
SCREENSHOTS_DIR="${RETROARCH_SCREENSHOTS_DIR:-/home/${UNAME}/.config/retroarch/screenshots}"
mkdir -p "$SCREENSHOTS_DIR"
chown -R "${UNAME}:${UNAME}" "$SCREENSHOTS_DIR"
set_config "screenshot_directory" "$SCREENSHOTS_DIR" "$RETROARCH_CONFIG_FILE"
set_config "screenshots_in_content_dir" "false" "$RETROARCH_CONFIG_FILE"

# Aspect handling for arcade (4:3 with black bars)
if [ "$RETROARCH_CORE" = "mame" ] || [ "$RETROARCH_CORE" = "mame2003" ] || [ "$RETROARCH_CORE" = "mame2003_plus" ]; then
    MAME_ASPECT="${RETROARCH_MAME_ASPECT:-auto}"
    if [ "$MAME_ASPECT" = "auto" ]; then
        set_config "video_aspect_ratio_auto" "true" "$RETROARCH_CONFIG_FILE"
        echo "  Aspect ratio: auto"
    else
        set_config "video_aspect_ratio_auto" "false" "$RETROARCH_CONFIG_FILE"
        set_config "aspect_ratio_index" "1" "$RETROARCH_CONFIG_FILE"
        echo "  Aspect ratio: 4:3"
    fi
    set_config "video_fullscreen" "true" "$RETROARCH_CONFIG_FILE"
    MAME_BORDERLESS="${RETROARCH_MAME_BORDERLESS:-true}"
    if [ "$MAME_BORDERLESS" = "true" ]; then
        set_config "video_windowed_fullscreen" "true" "$RETROARCH_CONFIG_FILE"
        echo "  Fullscreen: borderless"
    else
        set_config "video_windowed_fullscreen" "false" "$RETROARCH_CONFIG_FILE"
        echo "  Fullscreen: exclusive"
    fi
    MAME_INTEGER_SCALE="${RETROARCH_MAME_INTEGER_SCALE:-${RETROARCH_INTEGER_SCALE:-true}}"
    if [ "$MAME_INTEGER_SCALE" = "true" ]; then
        set_config "video_integer_scale" "true" "$RETROARCH_CONFIG_FILE"
        echo "  Integer scale: enabled"
    else
        set_config "video_integer_scale" "false" "$RETROARCH_CONFIG_FILE"
        echo "  Integer scale: disabled"
    fi
fi

# Optional logging to file for troubleshooting
LOG_FILE="${RETROARCH_LOG_FILE:-}"
if [ -n "$LOG_FILE" ]; then
    mkdir -p "$(dirname "$LOG_FILE")"
    touch "$LOG_FILE" 2>/dev/null || true
    chown "${UNAME}:${UNAME}" "$LOG_FILE" 2>/dev/null || true
    set_config "log_to_file" "true" "$RETROARCH_CONFIG_FILE"
    set_config "log_to_file_timestamp" "true" "$RETROARCH_CONFIG_FILE"
    set_config "log_level" "${RETROARCH_LOG_LEVEL:-1}" "$RETROARCH_CONFIG_FILE"
    set_config "log_file" "$LOG_FILE" "$RETROARCH_CONFIG_FILE"
    echo "  Log file: $LOG_FILE"
    STDOUT_LOG="/tmp/retroarch-stdout.log"
    touch "$STDOUT_LOG" 2>/dev/null || true
fi

# Configure joypad autoconfig directory (contains pre-made button mappings for common controllers)
set_config "joypad_autoconfig_dir" "/usr/share/libretro/autoconfig" "$RETROARCH_CONFIG_FILE"
set_config "input_autodetect_enable" "true" "$RETROARCH_CONFIG_FILE"

echo "  Video driver: $VIDEO_DRIVER"
echo "  Audio driver: $AUDIO_DRIVER"
echo "  Input driver: sdl2"
echo "  Joypad driver: sdl2"
echo "  System directory: $SYSTEM_DIR"
echo "  Saves directory: $SAVES_DIR"
echo "  States directory: $STATES_DIR"
echo "  Screenshots directory: $SCREENSHOTS_DIR"
echo ""

#######################################################
# Graphics Stack Diagnostics (matching Wine runner)
#######################################################

log_section "Graphics Stack Diagnostics"

# Check Vulkan availability (some cores use it)
VULKAN_OK="false"
if command -v vulkaninfo >/dev/null 2>&1; then
    VULKAN_GPU=$(vulkaninfo --summary 2>/dev/null | grep -i "deviceName" | head -1 | cut -d'=' -f2 | xargs || echo "")
    if [ -n "$VULKAN_GPU" ]; then
        echo -e "${GREEN}✓ Vulkan detected: $VULKAN_GPU${NC}"
        VULKAN_OK="true"
    else
        echo -e "${YELLOW}⚠ Vulkan not detected (vulkaninfo returned no GPU)${NC}"
        echo "  This may happen if:"
        echo "    - No GPU is passed to the container (--device=/dev/dri)"
        echo "    - Vulkan drivers aren't installed for your GPU"
        echo "    - Running in a VM without GPU passthrough"
    fi
else
    echo -e "${YELLOW}⚠ vulkaninfo not available${NC}"
fi

# Check OpenGL
GL_RENDERER=""
if command -v glxinfo >/dev/null 2>&1; then
    GL_RENDERER=$(glxinfo 2>/dev/null | grep "OpenGL renderer" | cut -d':' -f2 | xargs || echo "")
fi
if [ -n "$GL_RENDERER" ]; then
    echo -e "  OpenGL: ${GREEN}$GL_RENDERER${NC}"
else
    echo "  OpenGL: (could not detect)"
fi
echo ""

#######################################################
# Joystick Configuration
#######################################################

if [ -n "$JOYSTICK_DEVICE_NAME" ]; then
    log_section "Configuring Joystick: $JOYSTICK_DEVICE_NAME"
    
    TARGET_NAME="$JOYSTICK_DEVICE_NAME"
    CURRENT_INDEX=0
    MATCHED_INDEX=""
    CURRENT_NAME=""
    
    # Prefer mounted host file to avoid /proc restrictions
    INPUT_DEVICES_FILE="/proc/bus/input/devices"
    if [ -f "/tmp/host-input-devices" ]; then
        INPUT_DEVICES_FILE="/tmp/host-input-devices"
    fi
    
    # Parse input devices block by block
    while read -r line; do
        if [[ "$line" =~ ^N:\ Name=\"(.*)\"$ ]]; then
            CURRENT_NAME="${BASH_REMATCH[1]}"
        fi
        
        if [[ "$line" =~ ^H:\ Handlers=.*(js[0-9]+).*$ ]]; then
            # This is a joystick
            if [[ "$CURRENT_NAME" == "$TARGET_NAME" ]]; then
                MATCHED_INDEX=$CURRENT_INDEX
                break
            fi
            CURRENT_INDEX=$((CURRENT_INDEX + 1))
        fi
    done < "$INPUT_DEVICES_FILE"
    
    if [ -n "$MATCHED_INDEX" ]; then
        echo -e "  ${GREEN}✓ Found joystick at index $MATCHED_INDEX${NC}"
        set_config "input_player1_joypad_index" "$MATCHED_INDEX" "$RETROARCH_CONFIG_FILE"
    else
        log_warning "Could not find joystick index for '$TARGET_NAME'"
    fi
    echo ""
fi

#######################################################
# MangoHUD Configuration (for performance overlay)
#######################################################

ENABLE_MANGOHUD="${ENABLE_MANGOHUD:-false}"
if [ "$ENABLE_MANGOHUD" = "true" ]; then
    if command -v mangohud >/dev/null 2>&1; then
        echo -e "MangoHUD: ${GREEN}ENABLED${NC}"
        # Configure MangoHUD for RetroArch
        export MANGOHUD=1
        export MANGOHUD_CONFIG="cpu_temp,gpu_temp,vram,ram,fps,frametime,frame_timing"
    else
        echo -e "${YELLOW}⚠ MangoHUD requested but not installed${NC}"
        ENABLE_MANGOHUD="false"
    fi
else
    echo "MangoHUD: disabled (set ENABLE_MANGOHUD=true to enable)"
fi
echo ""

#######################################################
# BIOS / System Files Check
#######################################################

log_section "Checking BIOS/System Directory"
# Use RETROARCH_SYSTEM_DIR if set, otherwise check /system
BIOS_CHECK_DIR="${RETROARCH_SYSTEM_DIR:-/system}"
if [ -d "$BIOS_CHECK_DIR" ]; then
    BIOS_COUNT=$(find "$BIOS_CHECK_DIR" -type f 2>/dev/null | wc -l)
    if [ "$BIOS_COUNT" -gt 0 ]; then
        echo -e "  ${GREEN}✓ $BIOS_CHECK_DIR has $BIOS_COUNT file(s)${NC}"
        echo "  Contents:"
        ls -la "$BIOS_CHECK_DIR" 2>/dev/null | head -20 | while read line; do
            echo "    $line"
        done
    else
        echo -e "  ${YELLOW}⚠ $BIOS_CHECK_DIR directory is empty${NC}"
    fi
else
    echo -e "  ${YELLOW}⚠ $BIOS_CHECK_DIR directory not found${NC}"
    echo "  BIOS files may not be available for cores that require them"
fi
echo ""

#######################################################
# Core Selection
#######################################################

CORE_PATH=""
if [ -n "$RETROARCH_CORE" ]; then
    log_section "Resolving RetroArch core: $RETROARCH_CORE"
    
    # Handle common core aliases
    CORE_NAME="$RETROARCH_CORE"
    case "$RETROARCH_CORE" in
        beetle_psx_hw|beetle-psx-hw|psx_hw)
            CORE_NAME="mednafen_psx_hw"
            ;;
        beetle_psx|beetle-psx|psx)
            CORE_NAME="mednafen_psx"
            ;;
    esac
    
    # Check common locations
    if [ -f "/usr/lib/libretro/${CORE_NAME}_libretro.so" ]; then
        CORE_PATH="/usr/lib/libretro/${CORE_NAME}_libretro.so"
    elif [ -f "/usr/lib/libretro/${RETROARCH_CORE}_libretro.so" ]; then
        CORE_PATH="/usr/lib/libretro/${RETROARCH_CORE}_libretro.so"
    elif [ -f "/usr/lib/libretro/${RETROARCH_CORE}.so" ]; then
        CORE_PATH="/usr/lib/libretro/${RETROARCH_CORE}.so"
    fi
    
    if [ -n "$CORE_PATH" ]; then
        echo -e "  ${GREEN}✓ Found: $CORE_PATH${NC}"
    else
        echo -e "  ${YELLOW}⚠ Core not found in /usr/lib/libretro/${NC}"
        echo "  Tried: ${CORE_NAME}_libretro.so, ${RETROARCH_CORE}_libretro.so"
    fi
fi

# Default to MAME if not specified and we have arguments
if [ -z "$CORE_PATH" ] && [ "$#" -gt 0 ]; then
    if [ -f "/usr/lib/libretro/mame_libretro.so" ]; then
        CORE_PATH="/usr/lib/libretro/mame_libretro.so"
        log_warning "No core specified, defaulting to MAME"
    fi
fi

echo "  Core: ${CORE_PATH:-<menu mode>}"
echo ""

#######################################################
# Apply xrandr mode if requested
#######################################################

apply_xrandr_mode

#######################################################
# Build Launch Command
#######################################################

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

#######################################################
# Launch RetroArch
#######################################################

log_header "Launching RetroArch"

# Wrap with MangoHUD if enabled
if [ "$ENABLE_MANGOHUD" = "true" ]; then
    echo -e "${BLUE}Executing with MangoHUD: mangohud $CMD ${ARGS[*]}${NC}"
    echo ""
    
    # Launch in background to capture PID for signal handling
    if [ -n "$LOG_FILE" ]; then
        gosu "${UNAME}" mangohud "$CMD" "${ARGS[@]}" >>"$STDOUT_LOG" 2>&1 &
    else
        gosu "${UNAME}" mangohud "$CMD" "${ARGS[@]}" &
    fi
    CHILD_PID=$!
else
    echo -e "${BLUE}Executing: $CMD ${ARGS[*]}${NC}"
    echo ""
    
    if [ -n "$LOG_FILE" ]; then
        gosu "${UNAME}" "$CMD" "${ARGS[@]}" >>"$STDOUT_LOG" 2>&1 &
    else
        gosu "${UNAME}" "$CMD" "${ARGS[@]}" &
    fi
    CHILD_PID=$!
fi

echo -e "${BLUE}Process started with PID: $CHILD_PID${NC}"
echo -e "${BLUE}Waiting for process to complete...${NC}"

# Wait for process and capture exit code without exiting on failure
set +e
wait $CHILD_PID
EXIT_CODE=$?
set -e

echo ""
echo -e "${BLUE}RetroArch exited with code: $EXIT_CODE${NC}"

if [ -n "$LOG_FILE" ] && [ -n "$STDOUT_LOG" ]; then
    if [ ! -s "$LOG_FILE" ] && [ -s "$STDOUT_LOG" ]; then
        cp "$STDOUT_LOG" "$LOG_FILE" 2>/dev/null || true
        chown "${UNAME}:${UNAME}" "$LOG_FILE" 2>/dev/null || true
    fi
    if [ "$EXIT_CODE" -ne 0 ]; then
        if [ -s "$LOG_FILE" ]; then
            echo ""
            echo -e "${YELLOW}RetroArch log (tail)${NC}"
            tail -n 200 "$LOG_FILE" 2>/dev/null || true
        fi
        if [ -s "$STDOUT_LOG" ]; then
            echo ""
            echo -e "${YELLOW}RetroArch stdout/stderr (tail)${NC}"
            tail -n 200 "$STDOUT_LOG" 2>/dev/null || true
        fi
    elif [ ! -s "$LOG_FILE" ] && [ -s "$STDOUT_LOG" ]; then
        echo ""
        echo -e "${YELLOW}RetroArch stdout/stderr (no log file content)${NC}"
        tail -n 200 "$STDOUT_LOG" 2>/dev/null || true
    fi
fi

# Restore display if changed
restore_xrandr_mode

# Handle KEEP_ALIVE mode for debugging
KEEP_ALIVE="${KEEP_ALIVE:-false}"
if [ "$KEEP_ALIVE" = "true" ]; then
    echo ""
    echo -e "${YELLOW}KEEP_ALIVE is enabled - container will stay running${NC}"
    echo -e "${YELLOW}You can exec into it for debugging: docker exec -it <container> /bin/bash${NC}"
    echo ""
    tail -f /dev/null
fi

exit $EXIT_CODE
