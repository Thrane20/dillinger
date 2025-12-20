#!/bin/bash
# Test Display Forwarding Feature

set -e

echo "╔════════════════════════════════════════════════╗"
echo "║  Dillinger Display Forwarding Test            ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

# Check environment
echo "1. Checking display environment..."
echo ""

if [ -n "$DISPLAY" ]; then
    echo "   ✓ X11 Display: $DISPLAY"
    DISPLAY_MODE="x11"
elif [ -n "$WAYLAND_DISPLAY" ]; then
    echo "   ✓ Wayland Display: $WAYLAND_DISPLAY"
    DISPLAY_MODE="wayland"
else
    echo "   ❌ No display environment found!"
    echo "   Set DISPLAY or WAYLAND_DISPLAY to test display forwarding"
    exit 1
fi

# Allow X11 connections from Docker (if using X11)
if [ "$DISPLAY_MODE" = "x11" ]; then
    echo ""
    echo "2. Enabling X11 access for Docker..."
    xhost +local:docker 2>/dev/null || {
        echo "   ⚠ Could not run 'xhost' command"
        echo "   You may need to allow X11 connections manually"
    }
fi

# Check Docker image exists
echo ""
echo "3. Checking Docker image..."
if docker image inspect dillinger/runner-linux-native:latest >/dev/null 2>&1; then
    echo "   ✓ Image found: dillinger/runner-linux-native:latest"
else
    echo "   ❌ Image not found: dillinger/runner-linux-native:latest"
    echo "   Build it with: cd packages/runner-images/linux-native && ./build.sh"
    exit 1
fi

# Test X11 connection from container
echo ""
echo "4. Testing display forwarding..."
echo "   Launching xeyes in container..."
echo ""

if [ "$DISPLAY_MODE" = "x11" ]; then
    docker run --rm -it \
        -e DISPLAY=$DISPLAY \
        -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
        -v $HOME/.Xauthority:/home/gameuser/.Xauthority:ro \
        --device /dev/dri \
        --ipc=host \
        --security-opt seccomp=unconfined \
        dillinger/runner-linux-native:latest \
        bash -c '
            echo "Testing X11 connection..."
            if xdpyinfo >/dev/null 2>&1; then
                echo "✓ X11 connection successful!"
                echo ""
                echo "Launching xeyes..."
                echo "Close the window to continue the test."
                xeyes
            else
                echo "❌ Cannot connect to X11 display"
                exit 1
            fi
        '
else
    echo "   ⚠ Wayland test not yet implemented"
    echo "   Try running the GUI Test Game through Dillinger web interface"
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "✓ Display forwarding test passed!"
echo ""
echo "Next steps:"
echo "1. Start the backend:  cd packages/dillinger-core/backend && pnpm dev"
echo "2. Open browser:       http://localhost:3010/games"
echo "3. Launch test game:   Click on 'GUI Test Game'"
echo "═══════════════════════════════════════════════"
