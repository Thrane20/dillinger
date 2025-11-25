#!/bin/bash
set -e

# Ensure we are running from the project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
cd "$PROJECT_ROOT"

echo "Working directory: $(pwd)"

# Build the Docker image
echo "Building Dillinger Core Docker image..."
docker build -t dillinger-core:latest -f docker/dillinger-core/Dockerfile .

# Run the container
echo "Starting Dillinger Core..."
# Check if container exists and remove it
if [ "$(docker ps -aq -f name=dillinger-core)" ]; then
    docker rm -f dillinger-core
fi

# Ensure volumes exist

docker volume create dillinger_root
docker volume create dillinger_installed
docker volume create dillinger_installers

# ...existing code...
# Stop and remove existing container if it exists
if [ "$(docker ps -aq -f name=dillinger-core)" ]; then
    echo "Stopping and removing existing dillinger-core container..."
    docker stop dillinger-core
    docker rm dillinger-core
fi

# Prepare display environment variables and mounts
DOCKER_ARGS=""

# 1. Handle X11 Display
if [ -n "$DISPLAY" ]; then
    echo "Detected X11 display: $DISPLAY"
    DOCKER_ARGS="$DOCKER_ARGS -e DISPLAY=$DISPLAY"
    DOCKER_ARGS="$DOCKER_ARGS -v /tmp/.X11-unix:/tmp/.X11-unix:rw"
    
    # Handle Xauthority
    if [ -n "$XAUTHORITY" ]; then
        echo "Detected Xauthority: $XAUTHORITY"
        DOCKER_ARGS="$DOCKER_ARGS -e XAUTHORITY=$XAUTHORITY"
        DOCKER_ARGS="$DOCKER_ARGS -v $XAUTHORITY:$XAUTHORITY:ro"
    elif [ -f "$HOME/.Xauthority" ]; then
        echo "Detected default Xauthority: $HOME/.Xauthority"
        DOCKER_ARGS="$DOCKER_ARGS -e XAUTHORITY=$HOME/.Xauthority"
        DOCKER_ARGS="$DOCKER_ARGS -v $HOME/.Xauthority:$HOME/.Xauthority:ro"
    fi
fi

# 2. Handle Wayland Display
if [ -n "$WAYLAND_DISPLAY" ]; then
    echo "Detected Wayland display: $WAYLAND_DISPLAY"
    DOCKER_ARGS="$DOCKER_ARGS -e WAYLAND_DISPLAY=$WAYLAND_DISPLAY"
    
    if [ -n "$XDG_RUNTIME_DIR" ]; then
        echo "Detected XDG_RUNTIME_DIR: $XDG_RUNTIME_DIR"
        DOCKER_ARGS="$DOCKER_ARGS -e XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR"
        DOCKER_ARGS="$DOCKER_ARGS -v $XDG_RUNTIME_DIR:$XDG_RUNTIME_DIR:rw"
    fi
fi

# 3. Handle Audio (PulseAudio)
if [ -n "$XDG_RUNTIME_DIR" ] && [ -S "$XDG_RUNTIME_DIR/pulse/native" ]; then
    echo "Detected PulseAudio socket"
    DOCKER_ARGS="$DOCKER_ARGS -v $XDG_RUNTIME_DIR/pulse:$XDG_RUNTIME_DIR/pulse:rw"
    # Pass PULSE_SERVER env var if it's not standard, but usually the socket mount is enough if we set the env var
    # We'll set the env var to point to the mounted socket path
    # Note: The backend code expects PULSE_SERVER to be set or defaults to unix:/run/user/1000/pulse/native
    # Since we are mounting the host XDG_RUNTIME_DIR, we should pass that path
fi

# 4. Handle GPU (DRI)
if [ -d "/dev/dri" ]; then
    echo "Detected GPU devices"
    DOCKER_ARGS="$DOCKER_ARGS --device /dev/dri:/dev/dri"
fi

# 5. Handle Input Devices
if [ -d "/dev/input" ]; then
    echo "Detected Input devices"
    DOCKER_ARGS="$DOCKER_ARGS --device /dev/input:/dev/input"
fi

# Run the container
# We mount dillinger_installed to /mnt/linuxfast/dillinger_installed to match legacy paths
# We mount dillinger_installers to /installers to match runner conventions
echo "Starting dillinger-core..."
docker run -d \
  --name dillinger-core \
  -p 4000:4000 \
  -p 4001:4001 \
  -v dillinger_root:/data \
  -v dillinger_installed:/mnt/linuxfast/dillinger_installed \
  -v dillinger_installers:/installers \
  -v /var/run/docker.sock:/var/run/docker.sock \
  $DOCKER_ARGS \
  --restart unless-stopped \
  dillinger-core:latest

echo "Dillinger Core is running at http://localhost:4000"

