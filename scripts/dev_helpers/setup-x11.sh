#!/bin/bash
# Setup X11 forwarding for Dillinger devcontainer
# Run this on your HOST machine before opening devcontainer

echo "═══════════════════════════════════════════════"
echo "  Dillinger DevContainer X11 Setup"
echo "═══════════════════════════════════════════════"
echo ""

# Check if running as host (not in container)
if [ -f "/.dockerenv" ]; then
    echo "❌ ERROR: This script must run on the HOST, not in a container!"
    echo ""
    echo "Please run this on your Arch Linux host machine."
    exit 1
fi

# Check if X11 is running
if [ -z "$DISPLAY" ]; then
    echo "❌ ERROR: No X11 display found!"
    echo "   DISPLAY environment variable is not set."
    echo ""
    echo "   Make sure X11 is running:"
    echo "   - If using a desktop environment, it should already be running"
    echo "   - If using startx, run 'startx' first"
    exit 1
fi

echo "✓ X11 Display detected: $DISPLAY"

# Check if xhost is available
if ! command -v xhost >/dev/null 2>&1; then
    echo "❌ ERROR: 'xhost' command not found!"
    echo ""
    echo "   Install it with:"
    echo "   sudo pacman -S xorg-xhost    # Arch Linux"
    exit 1
fi

echo "✓ xhost command available"

# Check if X11 socket exists
if [ ! -d "/tmp/.X11-unix" ]; then
    echo "❌ ERROR: X11 socket directory not found!"
    echo "   /tmp/.X11-unix does not exist"
    exit 1
fi

echo "✓ X11 socket found: /tmp/.X11-unix"

# Enable X11 access for Docker
echo ""
echo "Enabling X11 access for Docker containers..."
xhost +local:docker

if [ $? -eq 0 ]; then
    echo "✓ X11 access enabled for Docker"
else
    echo "❌ Failed to enable X11 access"
    exit 1
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "✓ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Open this project in VSCode"
echo "  2. When prompted, click 'Reopen in Container'"
echo "  3. Wait for container to rebuild"
echo "  4. Run: pnpm dev"
echo "  5. Open: http://localhost:3000/games"
echo "  6. Launch GUI Test Game - window will appear!"
echo ""
echo "Note: You'll need to run this script again after"
echo "      each reboot to re-enable X11 access."
echo "═══════════════════════════════════════════════"
