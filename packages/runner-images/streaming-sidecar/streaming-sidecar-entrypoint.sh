#!/usr/bin/env bash
set -euo pipefail

log_json() {
    local level="$1"
    local component="$2"
    local message="$3"
    printf '{"ts":"%s","level":"%s","component":"%s","msg":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$level" "$component" "$message"
}

log_info() { log_json "info" "$1" "$2"; }
log_warn() { log_json "warn" "$1" "$2"; }
log_error() { log_json "error" "$1" "$2"; }

SIDECAR_MODE="${SIDECAR_MODE:-game}"
GPU_TYPE="${GPU_TYPE:-auto}"
RESOLUTION_WIDTH="${RESOLUTION_WIDTH:-1920}"
RESOLUTION_HEIGHT="${RESOLUTION_HEIGHT:-1080}"
REFRESH_RATE="${REFRESH_RATE:-60}"
ENABLE_GAMESCOPE="${ENABLE_GAMESCOPE:-true}"
AUDIO_ENABLED="${AUDIO_ENABLED:-true}"
IDLE_TIMEOUT_MINUTES="${IDLE_TIMEOUT_MINUTES:-0}"
WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-wayland-dillinger}"
XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/dillinger}"
LOG_DIR="${LOG_DIR:-/run/dillinger/logs}"
SUNSHINE_CONFIG="/etc/sunshine/sunshine.conf"
SUNSHINE_STATE_DIR="/var/lib/sunshine"
SUNSHINE_WEB_PORT="${SUNSHINE_WEB_PORT:-47990}"
SUNSHINE_ENCODER="${SUNSHINE_ENCODER:-auto}"
SUNSHINE_AUDIO_SINK="${SUNSHINE_AUDIO_SINK:-pipewire}"
SUNSHINE_NAME="${SUNSHINE_NAME:-Dillinger}"
SUNSHINE_USERNAME="${SUNSHINE_USERNAME:-dillinger}"
SUNSHINE_PASSWORD="${SUNSHINE_PASSWORD:-}"
SUNSHINE_RESTART_DELAY="${SUNSHINE_RESTART_DELAY:-2}"
SUNSHINE_FLAGS="${SUNSHINE_FLAGS:-}"
GAME_COMMAND="${GAME_COMMAND:-}"
TEST_PATTERN="${TEST_PATTERN:-smpte}"
SWAY_CUSTOM_CONFIG="${SWAY_CUSTOM_CONFIG:-}"

export WAYLAND_DISPLAY
export XDG_RUNTIME_DIR
export WLR_BACKENDS=headless
export WLR_RENDERER=pixman
export WLR_LIBINPUT_NO_DEVICES=1
export LD_LIBRARY_PATH="/usr/lib/icu76:${LD_LIBRARY_PATH:-}"

if [ -z "$SUNSHINE_PASSWORD" ]; then
    if [ "$SIDECAR_MODE" = "test-stream" ]; then
        SUNSHINE_PASSWORD="sunshine"
    else
        set +o pipefail
        SUNSHINE_PASSWORD="$(tr -dc A-Za-z0-9 </dev/urandom | head -c 16)"
        set -o pipefail
    fi
fi

if [ "$SIDECAR_MODE" = "test-stream" ] && [ "$SUNSHINE_ENCODER" = "auto" ]; then
    case "$GPU_TYPE" in
        amd) SUNSHINE_ENCODER="h264_vaapi" ;;
        nvidia) SUNSHINE_ENCODER="h264_nvenc" ;;
        *) SUNSHINE_ENCODER="h264_vaapi" ;;
    esac
fi

if [ "$SIDECAR_MODE" = "test-stream" ] && [ -z "$SUNSHINE_FLAGS" ]; then
    SUNSHINE_FLAGS="-1"
fi


run_as_streamer() {
    su -m -s /bin/bash -c "env HOME=/home/streamer USER=streamer LOGNAME=streamer XDG_CONFIG_HOME=/home/streamer/.config XDG_STATE_HOME=/home/streamer/.local/state $1" streamer
}

run_as_streamer_wayland() {
    su -m -s /bin/bash -c "env HOME=/home/streamer USER=streamer LOGNAME=streamer XDG_CONFIG_HOME=/home/streamer/.config XDG_STATE_HOME=/home/streamer/.local/state WAYLAND_DISPLAY=$WAYLAND_DISPLAY XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR WLR_BACKENDS=$WLR_BACKENDS WLR_RENDERER=$WLR_RENDERER WLR_LIBINPUT_NO_DEVICES=$WLR_LIBINPUT_NO_DEVICES $1" streamer
}

write_sway_config() {
    mkdir -p /etc/sway
    if [ -f /etc/sway/sway-config-template ]; then
        envsubst < /etc/sway/sway-config-template > /etc/sway/config
    fi

    if [ -n "$SWAY_CUSTOM_CONFIG" ]; then
        echo "" >> /etc/sway/config
        echo "# Custom config appended by Dillinger" >> /etc/sway/config
        printf "%s" "$SWAY_CUSTOM_CONFIG" | base64 -d >> /etc/sway/config 2>/dev/null || true
    fi
}

write_sunshine_config() {
    mkdir -p /etc/sunshine
    if [ -f /etc/sunshine/sunshine.conf.template ]; then
        export SUNSHINE_ENCODER
        export SUNSHINE_AUDIO_SINK
        export SUNSHINE_NAME
        export RESOLUTION_WIDTH
        export RESOLUTION_HEIGHT
        export REFRESH_RATE
        envsubst < /etc/sunshine/sunshine.conf.template > "$SUNSHINE_CONFIG"
    fi
}

start_seatd() {
    log_info "seatd" "Starting seatd"
    seatd -g video -u streamer >"$LOG_DIR/seatd.log" 2>&1 &
    echo $! > /tmp/seatd.pid
}

start_pipewire() {
    if [ "$AUDIO_ENABLED" != "true" ]; then
        log_info "audio" "Audio disabled"
        return 0
    fi
    log_info "audio" "Starting PipeWire and WirePlumber"
    run_as_streamer "pipewire >$LOG_DIR/pipewire.log 2>&1 &"
    run_as_streamer "wireplumber >$LOG_DIR/wireplumber.log 2>&1 &"
    run_as_streamer "pipewire-pulse >$LOG_DIR/pipewire-pulse.log 2>&1 &"
}

start_sway() {
    log_info "sway" "Starting sway headless compositor"
    run_as_streamer_wayland "sway -d -c /etc/sway/config >$LOG_DIR/sway.log 2>&1 &"
}

wait_for_wayland() {
    local socket_path=""
    for _ in $(seq 1 100); do
        socket_path="$XDG_RUNTIME_DIR/$WAYLAND_DISPLAY"
        if [ -S "$socket_path" ]; then
            log_info "sway" "Wayland socket ready at $socket_path"
            return 0
        fi
        for candidate in "$XDG_RUNTIME_DIR"/wayland-*; do
            if [ -S "$candidate" ]; then
                WAYLAND_DISPLAY="$(basename "$candidate")"
                export WAYLAND_DISPLAY
                log_info "sway" "Detected Wayland socket at $candidate (using $WAYLAND_DISPLAY)"
                return 0
            fi
        done
        sleep 0.1
    done
    log_error "sway" "Wayland socket not found at $socket_path"
    return 1
}

dump_sway_logs() {
    if [ -f "$LOG_DIR/sway.log" ]; then
        log_error "sway" "Sway log follows"
        cat "$LOG_DIR/sway.log"
    fi
    if [ -f "$LOG_DIR/seatd.log" ]; then
        log_error "seatd" "Seatd log follows"
        cat "$LOG_DIR/seatd.log"
    fi
}

start_test_pattern() {
    local color="#000000"
    case "$TEST_PATTERN" in
        smpte) color="#444444" ;;
        bar) color="#0044aa" ;;
        checkerboard) color="#222222" ;;
        ball) color="#880000" ;;
        snow) color="#666666" ;;
    esac
    log_info "test" "Starting test pattern: $TEST_PATTERN"
    run_as_streamer_wayland "swaymsg exec 'swaybg -c $color'" >/dev/null 2>&1 || true
}

start_game_or_test() {
    if [ -z "$GAME_COMMAND" ]; then
        start_test_pattern
        return 0
    fi

    local base_cmd=""
    if [ "$ENABLE_GAMESCOPE" = "true" ]; then
        base_cmd="gamescope -W $RESOLUTION_WIDTH -H $RESOLUTION_HEIGHT -r $REFRESH_RATE --backend wayland --"
    fi

    log_info "runner" "Launching game command"
    if [ -n "$base_cmd" ]; then
        run_as_streamer_wayland "swaymsg exec '$base_cmd $GAME_COMMAND'" >/dev/null 2>&1 || true
    else
        run_as_streamer_wayland "swaymsg exec '$GAME_COMMAND'" >/dev/null 2>&1 || true
    fi
}

start_sunshine_process() {
    export SUNSHINE_CONFIG
    export SUNSHINE_STATE_DIR
    export SUNSHINE_USERNAME
    export SUNSHINE_PASSWORD
    run_as_streamer "LD_LIBRARY_PATH=/usr/lib/icu76${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH} sunshine --creds $SUNSHINE_USERNAME $SUNSHINE_PASSWORD $SUNSHINE_CONFIG >/dev/null 2>&1 || true"
    su -m -s /bin/bash -c "exec env HOME=/home/streamer USER=streamer LOGNAME=streamer XDG_CONFIG_HOME=/home/streamer/.config XDG_STATE_HOME=/home/streamer/.local/state LD_LIBRARY_PATH=/usr/lib/icu76${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH} sunshine $SUNSHINE_FLAGS $SUNSHINE_CONFIG" streamer >"$LOG_DIR/sunshine.log" 2>&1 &
    echo $! > /tmp/sunshine.pid
}

start_sunshine() {
    log_info "sunshine" "Starting Sunshine"
    start_sunshine_process
}

monitor_sunshine() {
    while true; do
        if [ -f /tmp/sunshine.pid ]; then
            local pid
            pid="$(cat /tmp/sunshine.pid 2>/dev/null || true)"
            if [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null; then
                log_warn "sunshine" "Sunshine exited; restarting in ${SUNSHINE_RESTART_DELAY}s"
                sleep "$SUNSHINE_RESTART_DELAY"
                start_sunshine_process
            fi
        fi
        sleep 1
    done
}

write_test_apps_config() {
    if [ "$SIDECAR_MODE" != "test-stream" ]; then
        return 0
    fi

    local apps_dir="/home/streamer/.config/sunshine"
    local apps_file="$apps_dir/apps.json"

    mkdir -p "$apps_dir"
    cat >"$apps_file" <<'EOF'
{
    "env": {
        "PATH": "$(PATH):$(HOME)/.local/bin"
    },
    "apps": [
        {
            "name": "DESKTOP MAIN",
            "image-path": "desktop.png"
        },
        {
            "name": "STEAM BIG PICTURE",
            "detached": [
                "setsid steam steam://open/bigpicture"
            ],
            "prep-cmd": [
                {
                    "do": "",
                    "undo": "setsid steam steam://close/bigpicture"
                }
            ],
            "image-path": "steam.png"
        },
        {
            "name": "DILLINGER TEST",
            "cmd": [
                "/usr/bin/sleep",
                "infinity"
            ],
            "auto-detach": true,
            "wait-all": true,
            "image-path": "desktop.png"
        },
        {
            "name": "TEST STREAM",
            "cmd": [
                "/usr/bin/sleep",
                "infinity"
            ],
            "auto-detach": true,
            "wait-all": true,
            "image-path": "desktop.png"
        }
    ]
}
EOF
    chown -R streamer:streamer "$apps_dir"
    cp -f "$apps_file" /usr/share/sunshine/apps.json
    log_info "sunshine" "Wrote test-stream apps.json with Dillinger entry"
}

start_health_server() {
    log_info "health" "Starting health server"
    node /opt/health-server/index.js >"$LOG_DIR/health.log" 2>&1 &
}

shutdown_all() {
    log_warn "supervisor" "Shutting down"
    pkill -TERM -u streamer || true
    if [ -f /tmp/seatd.pid ]; then
        kill -TERM "$(cat /tmp/seatd.pid)" 2>/dev/null || true
    fi
    if [ -n "${SUNSHINE_MONITOR_PID:-}" ]; then
        kill -TERM "$SUNSHINE_MONITOR_PID" 2>/dev/null || true
    fi
    sleep 1
}

trap shutdown_all TERM INT HUP QUIT

log_info "supervisor" "Booting sidecar mode=$SIDECAR_MODE gpu=$GPU_TYPE res=${RESOLUTION_WIDTH}x${RESOLUTION_HEIGHT}@${REFRESH_RATE}"

mkdir -p "$XDG_RUNTIME_DIR" "$SUNSHINE_STATE_DIR" "$LOG_DIR" /home/streamer/.config /home/streamer/.local/state
chown -R streamer:streamer "$XDG_RUNTIME_DIR" "$SUNSHINE_STATE_DIR" "$LOG_DIR" /home/streamer/.config /home/streamer/.local/state
chmod 0700 "$XDG_RUNTIME_DIR"

write_sway_config
write_sunshine_config
write_test_apps_config

start_seatd
start_pipewire
start_sway
if ! wait_for_wayland; then
    dump_sway_logs
    exit 1
fi
start_game_or_test
start_sunshine
monitor_sunshine &
SUNSHINE_MONITOR_PID=$!
start_health_server

if [ "$IDLE_TIMEOUT_MINUTES" != "0" ]; then
    log_info "supervisor" "Idle timeout set to ${IDLE_TIMEOUT_MINUTES} minutes"
fi

wait "$SUNSHINE_MONITOR_PID" || true
shutdown_all
exit 0
