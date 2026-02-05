#!/bin/bash
# Dillinger Streaming Sidecar - Entrypoint Script
# Manages Sway compositor, Wolf streaming server, and PulseAudio
# Modes: game (capture from Wayland clients), test-stream (test pattern to Moonlight), test-x11 (test pattern to host X11)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_header() {
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  $1${NC}"
    echo -e "${GREEN}========================================${NC}"
}

log_section() {
    echo -e "${BLUE}► $1${NC}"
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

log_info() {
    echo -e "${CYAN}  $1${NC}"
}

#######################################################
# Configuration
#######################################################

# Sidecar mode: game, test-stream, test-x11
SIDECAR_MODE="${SIDECAR_MODE:-game}"

# Sway profile name (maps to config file in /data/sway-configs/)
SWAY_CONFIG_NAME="${SWAY_CONFIG_NAME:-default}"

# Idle timeout in minutes (0 = never auto-stop)
IDLE_TIMEOUT_MINUTES="${IDLE_TIMEOUT_MINUTES:-15}"

# Wayland socket path for clients to connect
WAYLAND_SOCKET_PATH="${WAYLAND_SOCKET_PATH:-/run/dillinger/wayland-dillinger}"

# Test pattern for test modes
TEST_PATTERN="${TEST_PATTERN:-smpte}"

# GPU type for encoder selection
GPU_TYPE="${GPU_TYPE:-auto}"

# Resolution (from Sway profile or defaults)
RESOLUTION_WIDTH="${RESOLUTION_WIDTH:-1920}"
RESOLUTION_HEIGHT="${RESOLUTION_HEIGHT:-1080}"
REFRESH_RATE="${REFRESH_RATE:-60}"

# Wolf configuration folder
WOLF_CFG_FOLDER="${WOLF_CFG_FOLDER:-/data/wolf}"

# User configuration
PUID="${PUID:-1000}"
PGID="${PGID:-1000}"
UNAME="${UNAME:-gameuser}"

# XDG directories
export XDG_RUNTIME_DIR="/run/user/${PUID}"
export XDG_CONFIG_HOME="/config"
export XDG_DATA_HOME="/config/data"
export XDG_CACHE_HOME="/config/cache"

# Tracking variables
SWAY_PID=""
WOLF_PID=""
PULSEAUDIO_PID=""
TEST_GSTREAMER_PID=""
IDLE_MONITOR_PID=""
LAST_CLIENT_COUNT=0
IDLE_COUNTDOWN=0

#######################################################
# Cleanup on exit
#######################################################

cleanup() {
    log_section "Cleaning up..."
    
    # Kill test GStreamer pipeline if running
    if [ -n "$TEST_GSTREAMER_PID" ] && kill -0 "$TEST_GSTREAMER_PID" 2>/dev/null; then
        log_info "Stopping test GStreamer pipeline..."
        kill "$TEST_GSTREAMER_PID" 2>/dev/null || true
    fi
    
    # Kill idle monitor
    if [ -n "$IDLE_MONITOR_PID" ] && kill -0 "$IDLE_MONITOR_PID" 2>/dev/null; then
        kill "$IDLE_MONITOR_PID" 2>/dev/null || true
    fi
    
    # Stop Wolf gracefully
    if [ -n "$WOLF_PID" ] && kill -0 "$WOLF_PID" 2>/dev/null; then
        log_info "Stopping Wolf server..."
        kill -TERM "$WOLF_PID" 2>/dev/null || true
        wait "$WOLF_PID" 2>/dev/null || true
    fi
    
    # Stop Sway gracefully
    if [ -n "$SWAY_PID" ] && kill -0 "$SWAY_PID" 2>/dev/null; then
        log_info "Stopping Sway compositor..."
        kill -TERM "$SWAY_PID" 2>/dev/null || true
        wait "$SWAY_PID" 2>/dev/null || true
    fi
    
    # Stop PulseAudio
    if [ -n "$PULSEAUDIO_PID" ] && kill -0 "$PULSEAUDIO_PID" 2>/dev/null; then
        log_info "Stopping PulseAudio..."
        kill "$PULSEAUDIO_PID" 2>/dev/null || true
    fi
    
    # Clean up Wayland socket
    rm -f "${WAYLAND_SOCKET_PATH}" "${WAYLAND_SOCKET_PATH}.lock" 2>/dev/null || true
    
    log_success "Cleanup complete"
    exit 0
}

trap cleanup SIGTERM SIGINT EXIT

#######################################################
# Setup Functions
#######################################################

setup_user() {
    log_section "Setting up user (UID=$PUID, GID=$PGID)..."
    
    # Ensure gameuser exists with correct UID/GID
    if ! id "$UNAME" &>/dev/null; then
        groupadd -g "$PGID" "$UNAME" 2>/dev/null || true
        useradd -u "$PUID" -g "$PGID" -m -s /bin/bash "$UNAME" 2>/dev/null || true
    fi
    
    # Create runtime directories
    mkdir -p "$XDG_RUNTIME_DIR"
    chmod 700 "$XDG_RUNTIME_DIR"
    chown -R "$PUID:$PGID" "$XDG_RUNTIME_DIR"
    
    mkdir -p /run/dillinger
    chmod 755 /run/dillinger
    chown "$PUID:$PGID" /run/dillinger
    
    mkdir -p /config/sway-configs
    chown -R "$PUID:$PGID" /config
    
    log_success "User setup complete"
}

setup_pulseaudio() {
    log_section "Setting up PulseAudio for audio capture..."
    
    # Create PulseAudio config directory
    mkdir -p /config/pulse
    chown -R "$PUID:$PGID" /config/pulse
    
    # Create PulseAudio config for streaming capture
    cat > /config/pulse/default.pa << 'EOF'
#!/usr/bin/pulseaudio -nF

# Load necessary modules
load-module module-native-protocol-unix auth-anonymous=1 socket=/run/dillinger/pulse-socket
load-module module-native-protocol-tcp auth-anonymous=1

# Null sink for capturing game audio
load-module module-null-sink sink_name=game_audio sink_properties=device.description="Game_Audio_Capture"

# Set as default
set-default-sink game_audio
set-default-source game_audio.monitor
EOF

    # Start PulseAudio as gameuser
    log_info "Starting PulseAudio..."
    su - "$UNAME" -c "PULSE_CONFIG_PATH=/config/pulse pulseaudio --daemonize=yes --exit-idle-time=-1 --log-target=stderr --log-level=warning" &
    PULSEAUDIO_PID=$!
    
    sleep 1
    
    if pgrep -u "$UNAME" pulseaudio > /dev/null; then
        log_success "PulseAudio running"
    else
        log_warning "PulseAudio may not have started correctly"
    fi
}

setup_sway_config() {
    log_section "Setting up Sway configuration..."
    
    local config_file="/config/sway-configs/${SWAY_CONFIG_NAME}.conf"
    local sway_config="/config/sway/config"
    
    # Check if custom config exists
    if [ -f "$config_file" ]; then
        log_info "Using custom Sway config: $SWAY_CONFIG_NAME"
        cp "$config_file" "$sway_config"
    else
        log_info "Generating default Sway config (${RESOLUTION_WIDTH}x${RESOLUTION_HEIGHT}@${REFRESH_RATE}Hz)"
        
        cat > "$sway_config" << EOF
# Dillinger Streaming Sidecar - Sway Configuration
# Profile: ${SWAY_CONFIG_NAME}
# Generated automatically

# Disable XWayland (avoid X11 socket conflicts with host)
xwayland disable

# Headless output configuration
output HEADLESS-1 {
    resolution ${RESOLUTION_WIDTH}x${RESOLUTION_HEIGHT}@${REFRESH_RATE}Hz
    position 0 0
    bg #000000 solid_color
}

# Enable headless backend
# Note: WLR_BACKENDS=headless must be set in environment

# Basic settings for streaming
default_border none
default_floating_border none
titlebar_border_thickness 0
titlebar_padding 0

# Disable gaps (maximise screen usage)
gaps inner 0
gaps outer 0

# Auto-focus new windows
focus_on_window_activation focus

# Fullscreen any new window
for_window [class=".*"] fullscreen enable
for_window [app_id=".*"] fullscreen enable

# Float windows by default (simple layout)
for_window [class=".*"] floating enable
for_window [app_id=".*"] floating enable

# Keyboard bindings (for debugging)
bindsym Mod4+Return exec foot
bindsym Mod4+d exec wofi --show drun
bindsym Mod4+Shift+q kill
bindsym Mod4+Shift+e exec swaynag -t warning -m 'Exit sway?' -B 'Yes' 'swaymsg exit'

# Include any additional user configuration
include /config/sway-configs/include.d/*.conf
EOF
    fi
    
    chown "$PUID:$PGID" "$sway_config"
    log_success "Sway config ready"
}

start_sway() {
    log_section "Starting Sway compositor..."
    
    # Set up environment for headless Sway
    export WLR_BACKENDS=headless
    export WLR_LIBINPUT_NO_DEVICES=1
    export XDG_SESSION_TYPE=wayland
    export XDG_CURRENT_DESKTOP=sway
    # Disable XWayland to avoid X11 socket conflicts with host
    export WLR_XWAYLAND=
    
    # Start Sway as gameuser
    log_info "Launching Sway (headless mode)..."
    su - "$UNAME" -c "
        export WLR_BACKENDS=headless
        export WLR_LIBINPUT_NO_DEVICES=1
        export XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR
        export XDG_CONFIG_HOME=$XDG_CONFIG_HOME
        export XDG_SESSION_TYPE=wayland
        export XDG_CURRENT_DESKTOP=sway
        export WLR_XWAYLAND=
        exec sway --config /config/sway/config 2>&1 | tee /var/log/dillinger/sway.log
    " &
    SWAY_PID=$!
    
    # Wait for Sway to create its socket (it creates wayland-0, wayland-1, etc.)
    local retries=30
    local wayland_socket=""
    
    while [ $retries -gt 0 ]; do
        # Look for any wayland socket in XDG_RUNTIME_DIR
        wayland_socket=$(find "$XDG_RUNTIME_DIR" -maxdepth 1 -name "wayland-*" -type s 2>/dev/null | head -1)
        
        if [ -n "$wayland_socket" ] && [ -S "$wayland_socket" ]; then
            local socket_name=$(basename "$wayland_socket")
            export WAYLAND_DISPLAY="$socket_name"
            log_success "Sway started (socket: $wayland_socket)"
            
            # Create symlink at configured path for external access
            if [ "$WAYLAND_SOCKET_PATH" != "$wayland_socket" ]; then
                ln -sf "$wayland_socket" "$WAYLAND_SOCKET_PATH"
                log_info "Symlinked to: $WAYLAND_SOCKET_PATH"
            fi
            
            return 0
        fi
        sleep 0.5
        retries=$((retries - 1))
    done
    
    log_error "Sway failed to start (no socket after 15s)"
    return 1
}

#######################################################
# Wolf Configuration
#######################################################

generate_wolf_config() {
    log_section "Generating Wolf configuration..."
    
    mkdir -p "$WOLF_CFG_FOLDER"
    
    # Determine encoder based on GPU type
    local encoder_config=""
    
    case "$GPU_TYPE" in
        nvidia)
            log_info "Configuring NVENC encoder (NVIDIA)"
            encoder_config='
[[gstreamer.video.h264_encoders]]
plugin_name = "nvcodec"
check_elements = ["nvh264enc"]
video_params = """
queue leaky=downstream max-size-buffers=1 !
videoconvertscale !
video/x-raw, width={width}, height={height}, format=NV12, chroma-site={color_range}, colorimetry={color_space}\
"""
encoder_pipeline = """
nvh264enc preset=low-latency-hq rc-mode=cbr bitrate={bitrate} gop-size=30 !
h264parse !
video/x-h264, profile=high, stream-format=byte-stream\
"""
'
            ;;
        amd|auto|*)
            log_info "Configuring VA-API encoder (AMD/Intel)"
            encoder_config='
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
'
            ;;
    esac
    
    # Preserve existing paired clients
    local paired_clients=""
    if [ -f "$WOLF_CFG_FOLDER/config.toml" ]; then
        paired_clients=$(grep -A 100 '^\[\[paired_clients\]\]' "$WOLF_CFG_FOLDER/config.toml" 2>/dev/null || true)
    fi
    
    # Generate Wolf config
    cat > "$WOLF_CFG_FOLDER/config.toml" << EOF
# Wolf Streaming Server Configuration
# Generated by Dillinger Streaming Sidecar
# Mode: $SIDECAR_MODE

config_version = 4
uuid = "streaming-sidecar"
hostname = "dillinger-stream"

[gstreamer]
$encoder_config

# Software H264 fallback
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

# Audio encoding
[[gstreamer.audio.opus_encoders]]
plugin_name = "opus"
check_elements = ["opusenc"]
encoder_pipeline = "opusenc bitrate={bitrate} bandwidth=fullband frame-size=10"

# Single app configuration - Sway compositor capture
[[apps]]
title = "Dillinger Stream"
start_virtual_compositor = false

# Capture from Sway display
[apps.video]
source = "wayland"

# Capture from PulseAudio monitor
[apps.audio]
source = "pulse"
sink = "game_audio.monitor"

# Paired clients (preserved)
$paired_clients
EOF

    chown -R "$PUID:$PGID" "$WOLF_CFG_FOLDER"
    log_success "Wolf config generated"
}

start_wolf() {
    log_section "Starting Wolf streaming server..."
    
    # Check Wolf binary
    if [ ! -x "/wolf/wolf" ]; then
        log_error "Wolf binary not found at /wolf/wolf"
        return 1
    fi
    
    # Set GStreamer plugin paths for Wolf's bundled GStreamer 1.25
    export LD_LIBRARY_PATH="/usr/local/lib/x86_64-linux-gnu:$LD_LIBRARY_PATH"
    export GST_PLUGIN_PATH="/usr/local/lib/x86_64-linux-gnu/gstreamer-1.0"
    export GST_PLUGIN_SCANNER="/usr/local/libexec/gstreamer-1.0/gst-plugin-scanner"
    export GST_PLUGIN_SYSTEM_PATH=""
    
    # Start Wolf as gameuser with Wayland display
    log_info "Launching Wolf..."
    su - "$UNAME" -c "
        export WAYLAND_DISPLAY=wayland-dillinger
        export XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR
        export LD_LIBRARY_PATH=/usr/local/lib/x86_64-linux-gnu:\$LD_LIBRARY_PATH
        export GST_PLUGIN_PATH=/usr/local/lib/x86_64-linux-gnu/gstreamer-1.0
        export GST_PLUGIN_SCANNER=/usr/local/libexec/gstreamer-1.0/gst-plugin-scanner
        export GST_PLUGIN_SYSTEM_PATH=
        export WOLF_CFG_FOLDER=$WOLF_CFG_FOLDER
        export PULSE_SERVER=unix:/run/dillinger/pulse-socket
        /wolf/wolf 2>&1 | tee /var/log/dillinger/wolf.log
    " &
    WOLF_PID=$!
    
    # Wait for Wolf to start
    sleep 2
    
    if kill -0 "$WOLF_PID" 2>/dev/null; then
        log_success "Wolf server started (PID: $WOLF_PID)"
        log_info "Moonlight ports: 47984, 47989, 47999, 48010"
        return 0
    else
        log_error "Wolf failed to start"
        return 1
    fi
}

#######################################################
# Test Pattern Functions
#######################################################

start_test_pattern_stream() {
    log_section "Starting test pattern (streaming mode)..."
    
    log_info "Pattern: terminal info display"
    log_info "Resolution: ${RESOLUTION_WIDTH}x${RESOLUTION_HEIGHT}"
    
    # Use foot terminal as a simple Wayland client for test mode
    # Wolf will capture this from the Sway compositor
    # This avoids needing waylandsink which Wolf doesn't bundle
    su - "$UNAME" -c "
        export WAYLAND_DISPLAY=$WAYLAND_DISPLAY
        export XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR
        
        # Start foot terminal with test info displayed
        foot -f 'monospace:size=24' -e sh -c '
            clear
            echo \"\"
            echo \"========================================\"
            echo \"   Dillinger Streaming Test Pattern\"
            echo \"========================================\"
            echo \"\"
            echo \"   Resolution: ${RESOLUTION_WIDTH}x${RESOLUTION_HEIGHT}\"
            echo \"   Refresh:    ${REFRESH_RATE}Hz\"
            echo \"   GPU:        $GPU_TYPE\"
            echo \"\"
            echo \"   If you can see this in Moonlight,\"
            echo \"   streaming is working correctly!\"
            echo \"\"
            echo \"   Wolf ports: 47984, 47989, 47999, 48010\"
            echo \"\"
            echo \"========================================\"
            echo \"\"
            echo \"   Press Ctrl+C to exit test mode\"
            echo \"\"
            # Keep running
            while true; do
                sleep 1
            done
        '
    " &
    TEST_GSTREAMER_PID=$!
    
    sleep 1
    
    if kill -0 "$TEST_GSTREAMER_PID" 2>/dev/null; then
        log_success "Test pattern running (PID: $TEST_GSTREAMER_PID)"
        log_info "Connect with Moonlight to see the test pattern"
    else
        log_warning "Test pattern may not have started (foot terminal)"
        log_info "Streaming should still work - connect with Moonlight"
    fi
}

start_test_pattern_x11() {
    log_section "Starting test pattern (X11 host mode)..."
    
    if [ -z "$DISPLAY" ]; then
        log_error "DISPLAY environment variable not set"
        log_info "Mount /tmp/.X11-unix and set DISPLAY to use X11 test mode"
        return 1
    fi
    
    local pattern_value=""
    case "$TEST_PATTERN" in
        smpte) pattern_value="smpte" ;;
        bar|colorbars) pattern_value="bar" ;;
        checkerboard|checkers) pattern_value="checkers-8" ;;
        ball) pattern_value="ball" ;;
        snow) pattern_value="snow" ;;
        *) pattern_value="smpte" ;;
    esac
    
    log_info "Pattern: $TEST_PATTERN (gst: $pattern_value)"
    log_info "Display: $DISPLAY"
    
    # Determine PulseAudio server - use host's pulse for X11 mode
    local pulse_server="${PULSE_SERVER:-unix:/run/user/1000/pulse/native}"
    log_info "PulseAudio: $pulse_server"
    
    # Video test pattern to X11 + Audio sine wave
    # Use Wolf's bundled GStreamer with autovideosink
    su - "$UNAME" -c "
        export DISPLAY=$DISPLAY
        export PULSE_SERVER=$pulse_server
        export LD_LIBRARY_PATH=/usr/local/lib/x86_64-linux-gnu:\$LD_LIBRARY_PATH
        export GST_PLUGIN_PATH=/usr/local/lib/x86_64-linux-gnu/gstreamer-1.0
        export GST_PLUGIN_SCANNER=/usr/local/libexec/gstreamer-1.0/gst-plugin-scanner
        
        # Start audio in background
        /usr/local/bin/gst-launch-1.0 audiotestsrc wave=sine freq=440 ! \
            audio/x-raw,rate=48000,channels=2 ! \
            pulsesink &
        AUDIO_PID=\$!
        
        # Start video (foreground - controls the process)
        /usr/local/bin/gst-launch-1.0 -v \
            videotestsrc pattern=$pattern_value ! \
            video/x-raw,width=${RESOLUTION_WIDTH},height=${RESOLUTION_HEIGHT},framerate=${REFRESH_RATE}/1 ! \
            autovideosink
        
        # Kill audio when video exits
        kill \$AUDIO_PID 2>/dev/null
    " &
    TEST_GSTREAMER_PID=$!
    
    sleep 1
    
    if kill -0 "$TEST_GSTREAMER_PID" 2>/dev/null; then
        log_success "Test pattern running on X11 (PID: $TEST_GSTREAMER_PID)"
        log_info "Check your host display for the test pattern window"
        log_info "Audio: 440Hz sine wave"
    else
        log_error "Test pattern failed to start"
    fi
}

#######################################################
# Idle Monitor
#######################################################

start_idle_monitor() {
    if [ "$IDLE_TIMEOUT_MINUTES" -eq 0 ]; then
        log_info "Idle timeout disabled"
        return
    fi
    
    log_section "Starting idle monitor (timeout: ${IDLE_TIMEOUT_MINUTES}m)..."
    
    (
        local idle_seconds=$((IDLE_TIMEOUT_MINUTES * 60))
        local check_interval=10
        local idle_counter=0
        
        while true; do
            sleep $check_interval
            
            # Count Wayland clients (via swaymsg)
            local client_count=0
            if command -v swaymsg &>/dev/null; then
                client_count=$(su - "$UNAME" -c "WAYLAND_DISPLAY=wayland-dillinger XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR swaymsg -t get_tree 2>/dev/null | grep -c 'app_id\|class'" || echo "0")
            fi
            
            if [ "$client_count" -eq 0 ]; then
                idle_counter=$((idle_counter + check_interval))
                if [ $((idle_counter % 60)) -eq 0 ]; then
                    local remaining=$((idle_seconds - idle_counter))
                    log_info "No clients connected. Auto-stop in ${remaining}s"
                fi
                
                if [ "$idle_counter" -ge "$idle_seconds" ]; then
                    log_warning "Idle timeout reached. Shutting down..."
                    kill -TERM $$ 2>/dev/null || exit 0
                fi
            else
                if [ "$idle_counter" -gt 0 ]; then
                    log_info "Client connected. Resetting idle timer."
                fi
                idle_counter=0
            fi
        done
    ) &
    IDLE_MONITOR_PID=$!
    log_success "Idle monitor started (PID: $IDLE_MONITOR_PID)"
}

#######################################################
# Control API (Simple HTTP)
#######################################################

start_control_api() {
    log_section "Starting control API on port 9999..."
    
    # Simple HTTP server using netcat for sidecar status/control
    (
        while true; do
            echo -e "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{\"status\":\"running\",\"mode\":\"$SIDECAR_MODE\",\"profile\":\"$SWAY_CONFIG_NAME\",\"resolution\":\"${RESOLUTION_WIDTH}x${RESOLUTION_HEIGHT}\",\"gpu\":\"$GPU_TYPE\"}" | nc -l -p 9999 -q 1 2>/dev/null || sleep 1
        done
    ) &
    
    log_success "Control API listening on port 9999"
}

#######################################################
# Main
#######################################################

main() {
    log_header "Dillinger Streaming Sidecar"
    log_info "Mode: $SIDECAR_MODE"
    log_info "Profile: $SWAY_CONFIG_NAME"
    log_info "Resolution: ${RESOLUTION_WIDTH}x${RESOLUTION_HEIGHT}@${REFRESH_RATE}Hz"
    log_info "GPU: $GPU_TYPE"
    log_info "Idle timeout: ${IDLE_TIMEOUT_MINUTES} minutes"
    
    # Setup
    setup_user
    setup_pulseaudio
    
    case "$SIDECAR_MODE" in
        test-x11)
            # X11 test mode - no Sway needed
            log_info "X11 test mode - Sway not started"
            start_test_pattern_x11
            ;;
        test-stream|game|*)
            # Start Sway compositor
            setup_sway_config
            start_sway
            
            # Start Wolf for streaming
            generate_wolf_config
            start_wolf
            
            # Start test pattern if in test mode
            if [ "$SIDECAR_MODE" = "test-stream" ]; then
                start_test_pattern_stream
            fi
            
            # Start idle monitor for game mode
            if [ "$SIDECAR_MODE" = "game" ]; then
                start_idle_monitor
            fi
            ;;
    esac
    
    # Start control API
    start_control_api
    
    log_header "Sidecar Ready"
    log_info "Wayland socket: $WAYLAND_SOCKET_PATH"
    log_info "PulseAudio socket: /run/dillinger/pulse-socket"
    log_info "Wolf ports: 47984, 47989, 47999, 48010"
    log_info "Control API: http://localhost:9999"
    
    # Wait for any process to exit
    wait -n $SWAY_PID $WOLF_PID $TEST_GSTREAMER_PID 2>/dev/null || true
    
    log_warning "A critical process exited. Shutting down..."
    cleanup
}

main "$@"
