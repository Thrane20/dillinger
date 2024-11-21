#!/bin/bash

# Check if a Wayland display is available by seeing if WAYLAND_DISPLAY is set and if the socket exists
if [ -n "$WAYLAND_DISPLAY" ] && [ -S "/run/user/1000/$WAYLAND_DISPLAY" ]; then
    echo "Running in Wayland mode with display $WAYLAND_DISPLAY"
    export DISPLAY=""
    export WAYLAND_DISPLAY="$WAYLAND_DISPLAY"
else
    echo "Running in X11 mode"
    export DISPLAY=:0
    unset WAYLAND_DISPLAY  # Unset WAYLAND_DISPLAY to avoid any conflicts
fi

# Run Wine with the specified command
exec "$@"
