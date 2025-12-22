#!/usr/bin/env bash
set -euo pipefail

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info() { printf "%b%s%b\n" "$BLUE" "$1" "$NC"; }
ok() { printf "%b%s%b\n" "$GREEN" "$1" "$NC"; }
warn() { printf "%b%s%b\n" "$YELLOW" "$1" "$NC"; }
err() { printf "%b%s%b\n" "$RED" "$1" "$NC" >&2; }

CONTAINER_NAME=${CONTAINER_NAME:-dillinger-core}
IMAGE_NAME=${IMAGE_NAME:-dillinger-core:latest}
CORE_PORT=${CORE_PORT:-3010}
KEEP_CONTAINER=${KEEP_CONTAINER:-false}

usage() {
  cat <<'USAGE'
Usage: start_core.sh [options]

Options:
  -p, --port <port>       Host port to expose Dillinger Core on (default: 3010)
  -n, --name <name>       Container name (default: dillinger-core)
  -i, --image <image>     Docker image to run (default: dillinger-core:latest)
  --keep                  Do not enable --restart unless-stopped
  -h, --help              Show this help message

Environment overrides:
  CORE_PORT, CONTAINER_NAME, IMAGE_NAME, PUID, PGID, KEEP_CONTAINER
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -p|--port)
      CORE_PORT="$2"
      shift 2
      ;;
    -n|--name)
      CONTAINER_NAME="$2"
      shift 2
      ;;
    -i|--image)
      IMAGE_NAME="$2"
      shift 2
      ;;
    --keep)
      KEEP_CONTAINER=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      err "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  err "Docker CLI is required but not available"
  exit 1
fi

PUID=${PUID:-$(id -u)}
PGID=${PGID:-$(id -g)}

HOST_XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR:-/run/user/$PUID}

info "Using PUID=$PUID, PGID=$PGID"
info "Container: $CONTAINER_NAME"
info "Image: $IMAGE_NAME"
info "Host Port: $CORE_PORT -> Container 3010"

info "Ensuring core volumes exist"
docker volume create dillinger_root >/dev/null
ok "dillinger_root"
docker volume create dillinger_installed >/dev/null
ok "dillinger_installed"
docker volume create dillinger_installers >/dev/null
ok "dillinger_installers"

# Ensure core volumes are writable by the user we're going to run as.
# This avoids permission issues when running with --user and also helps with PulseAudio.
info "Ensuring core volumes are owned by PUID:PGID ($PUID:$PGID)"
docker run --rm \
  -v dillinger_root:/data \
  -v dillinger_installed:/mnt/linuxfast/dillinger_installed \
  -v dillinger_installers:/installers \
  alpine:3.20 \
  sh -lc "chown -R $PUID:$PGID /data /mnt/linuxfast/dillinger_installed /installers" >/dev/null
ok "volume ownership updated"

if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  warn "Container $CONTAINER_NAME already exists - removing"
  docker rm -f "$CONTAINER_NAME" >/dev/null || true
fi

DOCKER_ARGS=(-e PUID="$PUID" -e PGID="$PGID" -p "$CORE_PORT:3010" \
  -v dillinger_root:/data \
  -v dillinger_installed:/mnt/linuxfast/dillinger_installed \
  -v dillinger_installers:/installers \
  -v /var/run/docker.sock:/var/run/docker.sock)

# X11 forwarding
if [[ -n "${DISPLAY:-}" ]]; then
  info "Configuring X11 for display $DISPLAY"
  DOCKER_ARGS+=( -e DISPLAY="$DISPLAY" -v /tmp/.X11-unix:/tmp/.X11-unix:rw )
  XAUTH=${XAUTHORITY:-$HOME/.Xauthority}
  if [[ -f "$XAUTH" ]]; then
    DOCKER_ARGS+=( -e XAUTHORITY="$XAUTH" -v "$XAUTH":"$XAUTH":ro )
  else
    warn "No Xauthority file at $XAUTH"
  fi
fi

# Wayland forwarding
if [[ -n "${WAYLAND_DISPLAY:-}" && -d "${HOST_XDG_RUNTIME_DIR}" ]]; then
  info "Configuring Wayland display $WAYLAND_DISPLAY"
  DOCKER_ARGS+=( -e WAYLAND_DISPLAY="$WAYLAND_DISPLAY" -e XDG_RUNTIME_DIR="$HOST_XDG_RUNTIME_DIR" -v "$HOST_XDG_RUNTIME_DIR":"$HOST_XDG_RUNTIME_DIR":rw )
fi

# PulseAudio
if [[ -S "$HOST_XDG_RUNTIME_DIR/pulse/native" ]]; then
  info "Mounting PulseAudio socket"
  DOCKER_ARGS+=( \
    -e XDG_RUNTIME_DIR="$HOST_XDG_RUNTIME_DIR" \
    -e PULSE_SERVER="unix:$HOST_XDG_RUNTIME_DIR/pulse/native" \
    -v "$HOST_XDG_RUNTIME_DIR/pulse":"$HOST_XDG_RUNTIME_DIR/pulse":rw )
fi

mkdir -p "$HOME/.config/pulse"
DOCKER_ARGS+=( -v "$HOME/.config/pulse":/home/dillinger/.config/pulse:rw )

# Input + sound devices
if [[ -d /dev/dri ]]; then
  DOCKER_ARGS+=( --device /dev/dri:/dev/dri )
fi
if [[ -d /dev/snd ]]; then
  DOCKER_ARGS+=( --device /dev/snd:/dev/snd )
fi
if [[ -d /dev/input ]]; then
  DOCKER_ARGS+=( --device /dev/input:/dev/input )
  if [[ -f /proc/bus/input/devices ]]; then
    DOCKER_ARGS+=( -v /proc/bus/input/devices:/tmp/host-input-devices:ro )
  fi
fi
if [[ -e /dev/uinput ]]; then
  DOCKER_ARGS+=( --device /dev/uinput:/dev/uinput )
fi

# Optional joystick nodes (/dev/input/js*)
for js in /dev/input/js*; do
  [[ -e "$js" ]] || continue
  DOCKER_ARGS+=( --device "$js":"$js" )
done

# Optional GPU passthrough for NVIDIA
if command -v nvidia-smi >/dev/null 2>&1; then
  info "NVIDIA GPU detected - enabling --gpus all"
  DOCKER_ARGS+=( --gpus all )
fi

RESTART_FLAG=(--restart unless-stopped)
if [[ "$KEEP_CONTAINER" == true ]]; then
  RESTART_FLAG=()
fi

info "Starting Dillinger Core container"
docker run -d \
  --name "$CONTAINER_NAME" \
  "${RESTART_FLAG[@]}" \
  --user "$PUID:$PGID" \
  "${DOCKER_ARGS[@]}" \
  "$IMAGE_NAME"

ok "Dillinger Core is running on http://localhost:$CORE_PORT"

