podman run --rm \
    -e PULSE_SERVER=unix:/run/user/$(id -u)/pulse/native \
    -v /run/user/$(id -u)/pulse:/run/user/1000/pulse \
    -v ~/.config/pulse/cookie:/run/user/1000/pulse/cookie:ro \
    -v game-root-data:/root \
    -e WAYLAND_DISPLAY=$WAYLAND_DISPLAY \
    -e XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR \
    -v /run/user/$(id -u)/$WAYLAND_DISPLAY:/run/user/1000/$WAYLAND_DISPLAY \
    --device /dev/dri \
    dillinger-wine \
    gamescope -W 1920 -H 1080 -f -- \
    supertuxkart

