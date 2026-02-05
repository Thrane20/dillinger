#!/bin/bash
# Dillinger Base Game Runner - Entrypoint Script
# Handles X11/Wayland display setup, GPU configuration, PulseAudio, and Moonlight streaming
# Can be sourced by runner entrypoints or executed standalone

# Colors for output
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export NC='\033[0m' # No Color

# Global defaults
export PUID="${PUID:-1000}"
export PGID="${PGID:-1000}"
export UNAME="${UNAME:-gameuser}"
export SAVE_DIR="${SAVE_DIR:-/saves}"
export USE_GAMESCOPE="${USE_GAMESCOPE:-false}"
export ENABLE_MOONLIGHT="${ENABLE_MOONLIGHT:-false}"
export GAMESCOPE_WIDTH="${GAMESCOPE_WIDTH:-1920}"
export GAMESCOPE_HEIGHT="${GAMESCOPE_HEIGHT:-1080}"
export GAMESCOPE_REFRESH="${GAMESCOPE_REFRESH:-60}"
export GAMESCOPE_FULLSCREEN="${GAMESCOPE_FULLSCREEN:-false}"
export GAMESCOPE_UPSCALER="${GAMESCOPE_UPSCALER:-auto}"
export KEEP_ALIVE="${KEEP_ALIVE:-false}"

# XDG directories
export XDG_RUNTIME_DIR="/run/user/${UNAME}"
export XDG_DATA_HOME="${SAVE_DIR}/data"
export XDG_CONFIG_HOME="${SAVE_DIR}/config"
export XDG_CACHE_HOME="${SAVE_DIR}/cache"

#######################################################
# Logging Functions
#######################################################

log_header() {
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  $1${NC}"
    echo -e "${GREEN}========================================${NC}"
}

log_section() {
    echo -e "${BLUE}$1${NC}"
}

log_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

log_error() {
    echo -e "${RED}✗ $1${NC}"
}

#######################################################
# Device Permission Functions
#######################################################

fix_audio_device_permissions() {
    if [ ! -d "/dev/snd" ]; then
        return 0
    fi
    
    log_section "Checking audio device permissions..."
    local AUDIO_DEV=$(find /dev/snd -name "seq" -o -name "timer" 2>/dev/null | head -n1)
    if [ -n "$AUDIO_DEV" ]; then
        local AUDIO_GID=$(stat -c '%g' "$AUDIO_DEV")
        if ! id -G "${UNAME}" 2>/dev/null | grep -qw "$AUDIO_GID"; then
            echo "  Adding ${UNAME} to audio group GID $AUDIO_GID"
            if getent group "$AUDIO_GID" >/dev/null 2>&1; then
                local EXISTING_GROUP=$(getent group "$AUDIO_GID" | cut -d: -f1)
                usermod -aG "$EXISTING_GROUP" "${UNAME}" 2>/dev/null || true
            else
                groupadd -g "$AUDIO_GID" host_audio 2>/dev/null || true
                usermod -aG host_audio "${UNAME}" 2>/dev/null || true
            fi
        else
            echo "  User already has access to audio group GID $AUDIO_GID"
        fi
    fi
}

fix_input_device_permissions() {
    if [ ! -d "/dev/input" ]; then
        return 0
    fi
    
    log_section "Checking input device permissions..."
    local INPUT_DEV=$(find /dev/input -name "event*" 2>/dev/null | head -n1)
    if [ -n "$INPUT_DEV" ]; then
        local INPUT_GID=$(stat -c '%g' "$INPUT_DEV")
        if ! id -G "${UNAME}" 2>/dev/null | grep -qw "$INPUT_GID"; then
            echo "  Adding ${UNAME} to input group GID $INPUT_GID"
            if getent group "$INPUT_GID" >/dev/null 2>&1; then
                local EXISTING_GROUP=$(getent group "$INPUT_GID" | cut -d: -f1)
                usermod -aG "$EXISTING_GROUP" "${UNAME}" 2>/dev/null || true
            else
                groupadd -g "$INPUT_GID" host_input 2>/dev/null || true
                usermod -aG host_input "${UNAME}" 2>/dev/null || true
            fi
        else
            echo "  User already has access to input group GID $INPUT_GID"
        fi
    fi
}

#######################################################
# PulseAudio Setup
#######################################################

setup_pulseaudio_cookie() {
    local ORIGINAL_PULSE_COOKIE="${PULSE_COOKIE:-/home/${UNAME}/.config/pulse/cookie}"
    if [ -f "$ORIGINAL_PULSE_COOKIE" ]; then
        # Create a writable copy in /tmp
        cp "$ORIGINAL_PULSE_COOKIE" /tmp/pulse-cookie 2>/dev/null || true
        chown "${UNAME}:${UNAME}" /tmp/pulse-cookie 2>/dev/null || true
        chmod 600 /tmp/pulse-cookie 2>/dev/null || true
        export PULSE_COOKIE=/tmp/pulse-cookie
        log_success "PulseAudio cookie copied to writable location: $PULSE_COOKIE"
    else
        export PULSE_COOKIE="$ORIGINAL_PULSE_COOKIE"
    fi
}

#######################################################
# Signal Handlers
#######################################################

cleanup_on_exit() {
    log_section "Cleaning up..."
    # Runner-specific cleanup can be added by runners
    exit 0
}

setup_signal_handlers() {
    trap cleanup_on_exit SIGTERM SIGINT SIGHUP SIGQUIT
}

#######################################################
# User and Group Management
#######################################################

setup_user() {
    # Create necessary directories first
    mkdir -p "$SAVE_DIR" "$XDG_RUNTIME_DIR" "$XDG_DATA_HOME" "$XDG_CONFIG_HOME" "$XDG_CACHE_HOME" 2>/dev/null || true
    
    # Update user UID/GID if needed
    local CURRENT_UID=$(id -u $UNAME 2>/dev/null || echo "1000")
    local CURRENT_GID=$(id -g $UNAME 2>/dev/null || echo "1000")

    local CURRENT_UID=$(id -u $UNAME 2>/dev/null || echo "1000")
    local CURRENT_GID=$(id -g $UNAME 2>/dev/null || echo "1000")

    if [ "$CURRENT_UID" != "$PUID" ] || [ "$CURRENT_GID" != "$PGID" ]; then
        log_section "Updating user $UNAME to UID:$PUID GID:$PGID..."
        
        # Update group ID
        if [ "$CURRENT_GID" != "$PGID" ]; then
            groupmod -o -g "$PGID" $UNAME 2>/dev/null || true
        fi
        
        # Update user ID
        if [ "$CURRENT_UID" != "$PUID" ]; then
            usermod -o -u "$PUID" $UNAME 2>/dev/null || true
        fi
        
        log_success "User updated"
    fi

    # Fix ownership of important directories
    chown -R $PUID:$PGID "$XDG_RUNTIME_DIR" "$SAVE_DIR" /home/$UNAME 2>/dev/null || true
    chmod 700 "$XDG_RUNTIME_DIR" 2>/dev/null || true
    
    # Fix device permissions
    fix_audio_device_permissions
    fix_input_device_permissions
}

#######################################################
# GPU and Graphics Setup
#######################################################

setup_gpu() {
    log_section "Checking GPU access..."

    # Allow caller to force a specific vendor stack.
    # Values: auto | amd | nvidia
    GPU_VENDOR="${GPU_VENDOR:-auto}"

    # Best-effort hardware detection (may not work in minimal containers).
    local HAS_NVIDIA_DEV="false"
    if [ -e "/dev/nvidia0" ] || [ -e "/dev/nvidiactl" ]; then
        HAS_NVIDIA_DEV="true"
    fi

    local HAS_AMD_PCI="false"
    if command -v lspci >/dev/null 2>&1 && lspci 2>/dev/null | grep -Ei "VGA|3D" | grep -i "AMD" >/dev/null; then
        HAS_AMD_PCI="true"
    fi

    if [ "$GPU_VENDOR" = "nvidia" ] || { [ "$GPU_VENDOR" = "auto" ] && [ "$HAS_NVIDIA_DEV" = "true" ]; }; then
        log_success "NVIDIA GPU selected"
        export __NV_PRIME_RENDER_OFFLOAD=1
        export __GLX_VENDOR_LIBRARY_NAME=nvidia
        if [ -f "/usr/share/vulkan/icd.d/nvidia_icd.json" ]; then
            export VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json
        fi
    fi

    if [ "$GPU_VENDOR" = "amd" ] || { [ "$GPU_VENDOR" = "auto" ] && [ "$HAS_AMD_PCI" = "true" ] && [ "$HAS_NVIDIA_DEV" != "true" ]; }; then
        log_success "AMD GPU selected"
        export RADV_PERFTEST=aco
        if [ -f "/usr/share/vulkan/icd.d/radeon_icd.x86_64.json" ]; then
            export VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/radeon_icd.x86_64.json
        fi
        # Disable NVIDIA/CUDA entirely when using AMD
        # This prevents GStreamer nvcodec plugin from trying to initialize CUDA
        export CUDA_VISIBLE_DEVICES=""
        # Disable NVIDIA GStreamer plugins by setting their rank to 0
        export GST_PLUGIN_FEATURE_RANK="nvh264dec:0,nvh265dec:0,nvh264enc:0,nvh265enc:0,nvcodecvideosink:0,cudaupload:0,cudadownload:0,cudaconvert:0,cudascale:0"
    fi

    # Check for Intel GPU
    if lspci 2>/dev/null | grep -i "VGA.*Intel" >/dev/null; then
        log_success "Intel GPU detected"
    fi

    # Check for DRI devices
    if [ -d "/dev/dri" ]; then
        log_success "GPU device access available (DRI)"
        ls -la /dev/dri/ 2>/dev/null || true
    else
        log_warning "No GPU device access (software rendering only)"
    fi
}

#######################################################
# Display Server Setup (X11/Wayland)
#######################################################

setup_display() {
    log_section "Setting up display server..."

    # Set XAUTHORITY if xauth file is mounted
    if [ -f "/home/${UNAME}/.Xauthority" ]; then
        export XAUTHORITY="/home/${UNAME}/.Xauthority"
    fi

    # Check for X11 connection
    if [ -n "$DISPLAY" ]; then
        log_section "Checking X11 connection..."
        if command -v xdpyinfo >/dev/null 2>&1 && xdpyinfo >/dev/null 2>&1; then
            log_success "X11 connection successful"
            echo "  Display: $DISPLAY"
        else
            log_warning "Cannot connect to X11 display"
            echo "  Make sure you mounted /tmp/.X11-unix and set DISPLAY"
        fi
    else
        log_warning "No DISPLAY variable set"
        echo "  You may need to set up X11 forwarding or use a virtual display"
    fi

    # Check for Wayland
    if [ -n "$WAYLAND_DISPLAY" ]; then
        log_success "Wayland display detected: $WAYLAND_DISPLAY"
    fi
}

#######################################################
# Audio Setup (PulseAudio)
#######################################################

setup_audio() {
    log_section "Setting up audio..."

    # Setup PulseAudio cookie for host connection
    setup_pulseaudio_cookie

    # Check for host PulseAudio connection
    if [ -n "$PULSE_SERVER" ]; then
        echo "  Using host PulseAudio server: $PULSE_SERVER"
        
        if command -v pactl >/dev/null 2>&1 && pactl info >/dev/null 2>&1; then
            log_success "PulseAudio connection successful"
        else
            log_warning "Cannot connect to PulseAudio server"
        fi
    elif command -v pulseaudio >/dev/null 2>&1; then
        echo "  Starting container-local PulseAudio..."
        
        # Start PulseAudio as the game user
        gosu $UNAME pulseaudio --start --exit-idle-time=-1 2>/dev/null || true
        sleep 1
        
        if gosu $UNAME pulseaudio --check 2>/dev/null; then
            log_success "PulseAudio started successfully"
            export PULSE_SERVER="unix:$XDG_RUNTIME_DIR/pulse/native"
        else
            log_warning "PulseAudio failed to start"
        fi
    else
        log_warning "PulseAudio not available"
    fi
}

#######################################################
# Gamescope Setup
#######################################################

setup_gamescope() {
    if [ "$USE_GAMESCOPE" != "true" ]; then
        return 0
    fi
    
    log_section "Setting up Gamescope compositor..."
    
    if command -v gamescope >/dev/null 2>&1; then
        log_success "Gamescope is available"
        
        # Build gamescope command
        GAMESCOPE_CMD="gamescope"
        GAMESCOPE_CMD="$GAMESCOPE_CMD -W $GAMESCOPE_WIDTH -H $GAMESCOPE_HEIGHT"
        GAMESCOPE_CMD="$GAMESCOPE_CMD -r $GAMESCOPE_REFRESH"
        
        if [ "$GAMESCOPE_FULLSCREEN" = "true" ]; then
            GAMESCOPE_CMD="$GAMESCOPE_CMD -f"
        fi
        
        if [ "$GAMESCOPE_UPSCALER" != "auto" ]; then
            GAMESCOPE_CMD="$GAMESCOPE_CMD -U $GAMESCOPE_UPSCALER"
        fi
        
        export GAMESCOPE_CMD
        echo "  Gamescope command: $GAMESCOPE_CMD"
    else
        log_warning "Gamescope not found, disabling"
        export USE_GAMESCOPE="false"
    fi
}

#######################################################
# Moonlight Streaming Setup
#######################################################

setup_moonlight() {
    if [ "$ENABLE_MOONLIGHT" != "true" ]; then
        return 0
    fi
    
    log_section "Setting up Moonlight streaming via Wolf..."
    
    # Check if Wolf binary is available
    if [ ! -f "/wolf/wolf" ]; then
        log_warning "Wolf binary not found at /wolf/wolf, streaming disabled"
        export ENABLE_MOONLIGHT="false"
        return 0
    fi
    
    log_success "Wolf server binary found"
    
    # Set up Wolf configuration directory (persisted via volume mount)
    # Note: docker-service.ts sets WOLF_CFG_FOLDER=/data/wolf for persistence
    export WOLF_CFG_FOLDER="${WOLF_CFG_FOLDER:-/data/wolf}"
    mkdir -p "$WOLF_CFG_FOLDER"
    
    # Wolf environment variables
    export WOLF_LOG_LEVEL="${WOLF_LOG_LEVEL:-INFO}"
    export WOLF_RENDER_NODE="${WOLF_RENDER_NODE:-/dev/dri/renderD128}"
    export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/1000}"
    export WOLF_PULSE_IMAGE="${WOLF_PULSE_IMAGE:-ghcr.io/games-on-whales/pulseaudio:master}"
    export WOLF_STOP_CONTAINER_ON_EXIT="${WOLF_STOP_CONTAINER_ON_EXIT:-true}"
    export WOLF_DOCKER_SOCKET="${WOLF_DOCKER_SOCKET:-/var/run/docker.sock}"
    
    # Get game title from environment (set by docker-service.ts)
    local GAME_TITLE="${GAME_TITLE:-Dillinger Game}"
    local WOLF_UUID="${WOLF_UUID:-$(cat /proc/sys/kernel/random/uuid)}"
    
    # Config file path
    local CONFIG_FILE="$WOLF_CFG_FOLDER/config.toml"
    
    # The launch command should be passed via WOLF_RUN_CMD environment variable
    # This is set by the runner-specific entrypoint before sourcing this file
    local RUN_CMD="${WOLF_RUN_CMD:-echo 'No game command configured'}"
    
    # We always regenerate the config to ensure it has our game
    # But we preserve [[paired_clients]] blocks to avoid needing to re-pair
    local EXISTING_PAIRED=""
    if [ -f "$CONFIG_FILE" ]; then
        # Extract [[paired_clients]] blocks to preserve pairings
        # We extract from [[paired_clients]] to end of file since it's the last section
        # Note: Don't strip any lines - the closing ''' for multi-line strings is essential
        if grep -q '^\[\[paired_clients\]\]' "$CONFIG_FILE" 2>/dev/null; then
            log_success "Found existing paired_clients, preserving pairings..."
            EXISTING_PAIRED=$(sed -n '/^\[\[paired_clients\]\]/,$p' "$CONFIG_FILE" 2>/dev/null || true)
        fi
        # Delete old config - we'll regenerate with our game
        rm -f "$CONFIG_FILE"
    fi
    
    log_section "Generating Wolf configuration..."
    
    # Generate config.toml with the current game using Wolf's config_version 2 format
    # Note: We use type = "process" with run_cmd to launch the game
    # Wolf will create a virtual Wayland compositor and run our command with WAYLAND_DISPLAY set
    cat > "$CONFIG_FILE" << 'WOLF_CONFIG_EOF'
# Wolf Moonlight Streaming Configuration
# Generated by Dillinger Runner
# See: https://games-on-whales.github.io/wolf/

WOLF_CONFIG_EOF

    # Add dynamic values
    cat >> "$CONFIG_FILE" << EOF
# A unique identifier for this host
uuid = "$WOLF_UUID"

# The name that will be displayed in Moonlight
hostname = "Dillinger"

# The version of this config file
config_version = 4

# Enable HEVC (x265 library installed in container)
support_hevc = true

EOF

    # If we DON'T have existing paired clients, add the empty array
    # (If we DO have them, we'll append [[paired_clients]] blocks later, which is different syntax)
    if [ -z "$EXISTING_PAIRED" ]; then
        cat >> "$CONFIG_FILE" << 'EOF'
# A list of paired clients that will be allowed to stream
paired_clients = []
EOF
    else
        echo "" >> "$CONFIG_FILE"
        echo "# paired_clients will be appended at end of config (array-of-tables format)" >> "$CONFIG_FILE"
    fi

    # Continue with apps configuration
    # Using top-level [[apps]] format (Wolf's default config format)
    cat >> "$CONFIG_FILE" << EOF

# Apps available for streaming
[[apps]]
title = "$GAME_TITLE"
start_virtual_compositor = true

[apps.runner]
type = "process"
run_cmd = "$RUN_CMD"

EOF

    # Add GStreamer encoder config
    # VA (newer) is preferred for AMD GPUs (hardware encoding)
    # OpenH264 as fallback (software encoding)
    cat >> "$CONFIG_FILE" << 'WOLF_GSTREAMER_EOF'

# GStreamer encoder configuration
# VA hardware encoding for AMD GPUs, with OpenH264 fallback
[gstreamer]

[gstreamer.video]
default_source = """
interpipesrc listen-to={session_id}_video is-live=true stream-sync=restart-ts max-buffers=1 block=false\
"""

default_sink = """
rtpmoonlightpay_video name=moonlight_pay payload_size={payload_size} fec_percentage={fec_percentage} min_required_fec_packets={min_required_fec_packets} !
udpsink bind-port={host_port} host={client_ip} port={client_port} sync=true\
"""

# H264 encoders - VA first (newer hardware encoding API for AMD/Intel)
[[gstreamer.video.h264_encoders]]
plugin_name = "va"
check_elements = ["vah264enc"]
video_params = """
queue leaky=downstream max-size-buffers=1 !
videoconvertscale !
video/x-raw, width={width}, height={height}, format=NV12, chroma-site={color_range}, colorimetry={color_space}\
"""
encoder_pipeline = """
vah264enc rate-control=cbr bitrate={bitrate} ref-frames=1 !
h264parse !
video/x-h264, profile=high, stream-format=byte-stream\
"""

# OpenH264 as fallback (software encoding)
[[gstreamer.video.h264_encoders]]
plugin_name = "openh264"
check_elements = ["openh264enc"]
video_params = """
queue leaky=downstream max-size-buffers=1 !
videoconvertscale !
video/x-raw, width={width}, height={height}, format=I420, chroma-site={color_range}, colorimetry={color_space}\
"""
encoder_pipeline = """
openh264enc complexity=low bitrate={bitrate} rate-control=buffer !
h264parse !
video/x-h264, profile=main, stream-format=byte-stream\
"""

# x264 as last resort (software encoding, higher quality)
[[gstreamer.video.h264_encoders]]
plugin_name = "x264"
check_elements = ["x264enc"]
video_params = """
queue leaky=downstream max-size-buffers=1 !
videoconvertscale !
video/x-raw, width={width}, height={height}, format=I420, chroma-site={color_range}, colorimetry={color_space}\
"""
encoder_pipeline = """
x264enc tune=zerolatency bitrate={bitrate} speed-preset=superfast threads=4 bframes=0 b-adapt=false !
h264parse !
video/x-h264, profile=high, stream-format=byte-stream\
"""

# Audio config
[gstreamer.audio]
default_source = """
interpipesrc listen-to={session_id}_audio is-live=true stream-sync=restart-ts max-bytes=0 max-buffers=3 block=false\
"""

default_audio_params = "queue max-size-buffers=3 leaky=downstream ! audiorate ! audioconvert"

default_opus_encoder = """
opusenc bitrate={bitrate} bitrate-type=cbr frame-size={packet_duration} bandwidth=fullband audio-type=restricted-lowdelay max-payload-size=1400\
"""

default_sink = """
rtpmoonlightpay_audio name=moonlight_pay packet_duration={packet_duration} encrypt={encrypt} aes_key="{aes_key}" aes_iv="{aes_iv}" !
udpsink bind-port={host_port} host={client_ip} port={client_port} sync=true\
"""
WOLF_GSTREAMER_EOF

    # If we have existing paired clients, append them
    if [ -n "$EXISTING_PAIRED" ]; then
        echo "" >> "$CONFIG_FILE"
        echo "# Preserved paired clients from previous session" >> "$CONFIG_FILE"
        echo "$EXISTING_PAIRED" >> "$CONFIG_FILE"
    fi

    log_success "Wolf configuration written to: $CONFIG_FILE"
    
    # Export config path for later use by start_wolf_server()
    export WOLF_CONFIG_FILE="$CONFIG_FILE"
}

#######################################################
# Start Wolf Streaming Server
# Call this AFTER building the game launch command
# The runner entrypoint should set WOLF_RUN_CMD before calling this
#######################################################

start_wolf_server() {
    if [ "$ENABLE_MOONLIGHT" != "true" ]; then
        return 0
    fi
    
    if [ -z "$WOLF_CONFIG_FILE" ] || [ ! -f "$WOLF_CONFIG_FILE" ]; then
        log_error "Wolf config not found. Call setup_moonlight() first."
        return 1
    fi
    
    # Update the config with the actual run command if WOLF_RUN_CMD is set
    if [ -n "$WOLF_RUN_CMD" ]; then
        log_section "Updating Wolf config with game command..."
        # Escape special characters in the command for TOML
        local ESCAPED_CMD=$(echo "$WOLF_RUN_CMD" | sed 's/"/\\"/g')
        sed -i "s|run_cmd = \".*\"|run_cmd = \"$ESCAPED_CMD\"|" "$WOLF_CONFIG_FILE"
        log_success "Wolf run command updated"
    fi
    
    # Start Wolf server in background
    log_section "Starting Wolf streaming server..."
    
    # Create sockets directory
    mkdir -p /tmp/wolf-sockets
    chown -R "${PUID}:${PGID}" /tmp/wolf-sockets 2>/dev/null || true
    
    # Create log file for Wolf output (world-writable so tee can write to it)
    WOLF_LOG="/tmp/wolf.log"
    touch "$WOLF_LOG"
    chmod 666 "$WOLF_LOG"
    
    # Debug: show what config file we're using
    log_section "Wolf config debug:"
    echo "  WOLF_CONFIG_FILE=$WOLF_CONFIG_FILE"
    echo "  Config file exists: $([ -f "$WOLF_CONFIG_FILE" ] && echo "yes" || echo "no")"
    if [ -f "$WOLF_CONFIG_FILE" ]; then
        echo "  Config version in file: $(grep config_version "$WOLF_CONFIG_FILE" | head -1)"
    fi
    
    # Start Wolf with proper environment, capturing output to both console and log
    # Use only Wolf's bundled GStreamer plugins to avoid version conflicts with system plugins
    WOLF_CFG_FILE="$WOLF_CONFIG_FILE" \
    XDG_RUNTIME_DIR="$XDG_RUNTIME_DIR" \
    GST_PLUGIN_PATH="/usr/local/lib/x86_64-linux-gnu/gstreamer-1.0" \
    GST_PLUGIN_SYSTEM_PATH="" \
    /wolf/wolf 2>&1 | tee "$WOLF_LOG" &
    
    WOLF_PID=$!
    echo "$WOLF_PID" > /tmp/wolf.pid
    
    # Give Wolf a moment to initialize
    sleep 2
    
    if kill -0 "$WOLF_PID" 2>/dev/null; then
        log_success "Wolf server started (PID: $WOLF_PID)"
        echo "  Moonlight ports: 47984 (HTTPS), 47989 (HTTP), 47999 (Control), 48010 (RTSP)"
        echo "  Wolf configuration: $WOLF_CFG_FOLDER"
        echo "  Wolf log: $WOLF_LOG"
        echo "  Connect with Moonlight client to this host's IP"
    else
        log_error "Wolf server failed to start"
        echo "  Check Wolf log: $WOLF_LOG"
        if [ -f "$WOLF_LOG" ]; then
            echo "  Last 20 lines of Wolf log:"
            tail -20 "$WOLF_LOG" | sed 's/^/    /'
        fi
        export ENABLE_MOONLIGHT="false"
    fi
}

#######################################################
# Main Setup Function
#######################################################

run_base_setup() {
    log_header "Dillinger Base Game Runner"
    
    echo ""
    log_section "Configuration:"
    echo "  User: $UNAME (UID: $PUID, GID: $PGID)"
    echo "  Save Directory: $SAVE_DIR"
    echo "  Display: ${DISPLAY:-<not set>}"
    echo "  Use Gamescope: $USE_GAMESCOPE"
    echo "  Enable Moonlight: $ENABLE_MOONLIGHT"
    if [ "$USE_GAMESCOPE" = "true" ]; then
        echo "  Gamescope Resolution: ${GAMESCOPE_WIDTH}x${GAMESCOPE_HEIGHT}@${GAMESCOPE_REFRESH}"
        echo "  Gamescope Fullscreen: $GAMESCOPE_FULLSCREEN"
        echo "  Gamescope Upscaler: $GAMESCOPE_UPSCALER"
    fi
    echo ""
    
    # Run all setup functions
    setup_user
    setup_gpu
    setup_display
    setup_audio
    setup_gamescope
    setup_moonlight
    setup_signal_handlers
    
    echo ""
    log_header "Base Runner Ready"
    echo ""
}

#######################################################
# Execute or Source Logic
#######################################################

# If sourced, export functions and return
if [[ "${BASH_SOURCE[0]}" != "${0}" ]]; then
    # Being sourced - export all functions
    export -f log_header log_section log_success log_warning log_error
    export -f fix_audio_device_permissions fix_input_device_permissions
    export -f setup_pulseaudio_cookie setup_signal_handlers cleanup_on_exit
    export -f setup_user setup_gpu setup_display setup_audio setup_gamescope setup_moonlight
    export -f start_wolf_server
    export -f run_base_setup
    return 0
fi

# Being executed - run setup and launch command
set -e
run_base_setup

if [ "$KEEP_ALIVE" = "true" ]; then
    log_section "KEEP_ALIVE mode enabled - starting shell..."
    exec gosu $UNAME /bin/bash
fi

if [ "$KEEP_ALIVE" = "true" ]; then
    log_section "KEEP_ALIVE mode enabled - starting shell..."
    exec gosu $UNAME /bin/bash
fi

# If command provided, execute it as the game user
if [ "$#" -gt 0 ]; then
    log_section "Executing command: $@"
    echo ""
    exec gosu $UNAME "$@"
else
    # No command provided, drop to shell
    log_section "No command provided, starting shell..."
    echo ""
    exec gosu $UNAME /bin/bash
fi
