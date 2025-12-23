#!/bin/bash
# Dillinger RetroArch Runner - Entrypoint
# Sources base runner setup and adds RetroArch-specific configuration
set -e

# Source base entrypoint functions
source /usr/local/bin/entrypoint.sh

# Run base setup
run_base_setup

#######################################################
# RetroArch-Specific Setup
#######################################################

log_section "Configuring RetroArch environment..."

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
input_joypad_driver = "udev"
menu_driver = "ozone"
EOF
    chown "${UNAME}:${UNAME}" "$RETROARCH_CONFIG_FILE"
fi

# Enforce critical drivers to match known working config
log_section "Enforcing RetroArch drivers..."
set_config "input_driver" "sdl2" "$RETROARCH_CONFIG_FILE"
set_config "input_joypad_driver" "udev" "$RETROARCH_CONFIG_FILE"
set_config "video_driver" "gl" "$RETROARCH_CONFIG_FILE"
set_config "audio_driver" "pulse" "$RETROARCH_CONFIG_FILE"

# Configure Joystick if specified
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
        echo "  Found joystick at index $MATCHED_INDEX"
        set_config "input_player1_joypad_index" "$MATCHED_INDEX" "$RETROARCH_CONFIG_FILE"
    else
        log_warning "Could not find joystick index for '$TARGET_NAME'"
    fi
fi

# Determine Core path
CORE_PATH=""
if [ -n "$RETROARCH_CORE" ]; then
    # Check common locations
    if [ -f "/usr/lib/libretro/${RETROARCH_CORE}_libretro.so" ]; then
        CORE_PATH="/usr/lib/libretro/${RETROARCH_CORE}_libretro.so"
    elif [ -f "/usr/lib/libretro/${RETROARCH_CORE}.so" ]; then
        CORE_PATH="/usr/lib/libretro/${RETROARCH_CORE}.so"
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

#######################################################
# Launch RetroArch
#######################################################

log_header "Launching RetroArch"

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

echo -e "${BLUE}Command: $CMD ${ARGS[*]}${NC}"
echo ""

exec gosu "${UNAME}" "$CMD" "${ARGS[@]}"

set_config "input_driver" "sdl2" "$RETROARCH_CONFIG_FILE"
set_config "input_joypad_driver" "udev" "$RETROARCH_CONFIG_FILE"
set_config "video_driver" "gl" "$RETROARCH_CONFIG_FILE"
set_config "audio_driver" "pulse" "$RETROARCH_CONFIG_FILE"

# Configure Joystick if specified
if [ -n "$JOYSTICK_DEVICE_NAME" ]; then
    echo -e "${BLUE}Configuring Joystick: $JOYSTICK_DEVICE_NAME${NC}"
    
    # Find index of the joystick with the matching name
    # We assume RetroArch enumerates devices with 'js' handlers in order
    
    TARGET_NAME="$JOYSTICK_DEVICE_NAME"
    CURRENT_INDEX=0
    MATCHED_INDEX=""
    CURRENT_NAME=""
    
    # Determine where to read input devices from
    # We prefer the mounted host file if available to avoid /proc restrictions
    INPUT_DEVICES_FILE="/proc/bus/input/devices"
    if [ -f "/tmp/host-input-devices" ]; then
        INPUT_DEVICES_FILE="/tmp/host-input-devices"
    fi
    
    # Read input devices block by block
    # We use a loop that parses the file
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
        echo "  Found joystick at index $MATCHED_INDEX"
        set_config "input_player1_joypad_index" "$MATCHED_INDEX" "$RETROARCH_CONFIG_FILE"
    else
        echo "  Could not find joystick index for '$TARGET_NAME'"
    fi
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
# Only default if we are NOT in menu mode (checked by presence of arguments)
if [ -z "$CORE_PATH" ] && [ "$#" -gt 0 ]; then
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
