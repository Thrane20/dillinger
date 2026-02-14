#!/bin/bash
set -euo pipefail

log() {
    printf '{"ts":"%s","level":"info","msg":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1"
}

warn() {
    printf '{"ts":"%s","level":"warn","msg":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1"
}

log "starting dillinger streaming sidecar"

export DILLINGER_MODE=1

# Defaults for persistence: when /data is a volume (dillinger_root), keep Wolf's
# identity (cert/key/uuid) + pairing database + per-client state under /data/wolf.
if [[ -z "${WOLF_CFG_FOLDER:-}" && -d "/data" ]]; then
    export WOLF_CFG_FOLDER="/data/wolf"
fi

if [[ -z "${HOST_APPS_STATE_FOLDER:-}" && -n "${WOLF_CFG_FOLDER:-}" ]]; then
    export HOST_APPS_STATE_FOLDER="$WOLF_CFG_FOLDER/apps"
fi

if [[ -n "${WOLF_CFG_FOLDER:-}" ]]; then
    mkdir -p "$WOLF_CFG_FOLDER"
    export WOLF_CFG_FILE="${WOLF_CFG_FILE:-$WOLF_CFG_FOLDER/config.toml}"
    export WOLF_PRIVATE_KEY_FILE="${WOLF_PRIVATE_KEY_FILE:-$WOLF_CFG_FOLDER/key.pem}"
    export WOLF_PRIVATE_CERT_FILE="${WOLF_PRIVATE_CERT_FILE:-$WOLF_CFG_FOLDER/cert.pem}"
    log "using WOLF_CFG_FOLDER=$WOLF_CFG_FOLDER"

    key_status="missing"
    cert_status="missing"
    paired_status="missing"
    uuid_status="missing"

    [[ -f "$WOLF_PRIVATE_KEY_FILE" ]] && key_status="present"
    [[ -f "$WOLF_PRIVATE_CERT_FILE" ]] && cert_status="present"
    [[ -f "$WOLF_CFG_FOLDER/paired_clients.json" ]] && paired_status="present"
    [[ -f "$WOLF_CFG_FOLDER/dillinger_uuid.txt" ]] && uuid_status="present"

    log "persistence check: key=$key_status cert=$cert_status paired_clients=$paired_status uuid=$uuid_status"
fi

if [[ -n "${HOST_APPS_STATE_FOLDER:-}" ]]; then
    mkdir -p "$HOST_APPS_STATE_FOLDER" || true
fi

if [[ -n "${XDG_RUNTIME_DIR:-}" ]]; then
    mkdir -p "$XDG_RUNTIME_DIR"
    chmod 700 "$XDG_RUNTIME_DIR" || true
fi

if [[ -z "${GST_PLUGIN_PATH:-}" ]]; then
    export GST_PLUGIN_PATH="/usr/local/lib/x86_64-linux-gnu/gstreamer-1.0"
    log "defaulted GST_PLUGIN_PATH=$GST_PLUGIN_PATH"
fi

if [[ -z "${GST_PLUGIN_SCANNER:-}" ]]; then
    export GST_PLUGIN_SCANNER="/usr/local/libexec/gstreamer-1.0/gst-plugin-scanner"
    log "defaulted GST_PLUGIN_SCANNER=$GST_PLUGIN_SCANNER"
fi

if [[ -z "${GST_PLUGIN_SYSTEM_PATH:-}" ]]; then
    export GST_PLUGIN_SYSTEM_PATH=""
    log "isolated GStreamer plugin system path"
fi

if [[ -d "/dev/dri" ]]; then
    for node in /dev/dri/renderD* /dev/dri/card*; do
        if [[ -e "$node" ]]; then
            if getent group render >/dev/null 2>&1; then
                chgrp render "$node" || true
            elif getent group video >/dev/null 2>&1; then
                chgrp video "$node" || true
            fi
            chmod g+rw "$node" || true
        fi
    done
    log "updated DRM device permissions"
else
    warn "/dev/dri not found; GPU devices may be unavailable"
fi

if [[ -z "${WOLF_RENDER_NODE:-}" ]]; then
    render_node=""
    for candidate in /dev/dri/renderD*; do
        if [[ -e "$candidate" ]]; then
            render_node="$candidate"
            break
        fi
    done

    if [[ -n "$render_node" ]]; then
        export WOLF_RENDER_NODE="$render_node"
        log "auto-detected WOLF_RENDER_NODE=$WOLF_RENDER_NODE"
    else
        warn "no /dev/dri/renderD* device found; GPU zero-copy will be disabled"
    fi
else
    log "using configured WOLF_RENDER_NODE=$WOLF_RENDER_NODE"
fi

card_node=""
for candidate in /dev/dri/card*; do
    if [[ -e "$candidate" ]]; then
        card_node="$candidate"
        break
    fi
done

if [[ -n "$card_node" ]]; then
    log "detected drm card node: $card_node"
else
    warn "no /dev/dri/card* device found; direct scanout may be unavailable"
fi

if [[ -z "${PULSE_SERVER:-}" ]]; then
    pulse_socket=""
    if [[ -n "${XDG_RUNTIME_DIR:-}" && -S "$XDG_RUNTIME_DIR/pulse/native" ]]; then
        pulse_socket="$XDG_RUNTIME_DIR/pulse/native"
    else
        for candidate in /run/user/*/pulse/native; do
            if [[ -S "$candidate" ]]; then
                pulse_socket="$candidate"
                break
            fi
        done
    fi

    if [[ -n "$pulse_socket" ]]; then
        export PULSE_SERVER="unix:$pulse_socket"
        log "auto-detected PULSE_SERVER=$PULSE_SERVER"
    else
        if command -v pulseaudio >/dev/null 2>&1; then
            log "starting PulseAudio daemon"
            pulseaudio --start --exit-idle-time=-1 || true
            if [[ -n "${XDG_RUNTIME_DIR:-}" && -S "$XDG_RUNTIME_DIR/pulse/native" ]]; then
                export PULSE_SERVER="unix:$XDG_RUNTIME_DIR/pulse/native"
                log "started PulseAudio; PULSE_SERVER=$PULSE_SERVER"
            else
                warn "PulseAudio started but socket not found"
            fi
        else
            warn "no PulseAudio socket found; audio capture may be unavailable"
        fi
    fi
else
    log "using configured PULSE_SERVER=$PULSE_SERVER"
fi

exec /wolf/wolf
