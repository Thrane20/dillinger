#!/bin/bash
# GUI Test Game - Opens an actual X11 window to verify display forwarding

echo "╔════════════════════════════════════╗"
echo "║   DILLINGER GUI TEST GAME          ║"
echo "║   Display Forwarding Test          ║"
echo "╚════════════════════════════════════╝"
echo ""

# Check if display is available
if [ -z "$DISPLAY" ] && [ -z "$WAYLAND_DISPLAY" ]; then
    echo "❌ ERROR: No display available!"
    echo "   DISPLAY and WAYLAND_DISPLAY are both unset"
    echo "   Display forwarding is not configured."
    exit 1
fi

if [ -n "$DISPLAY" ]; then
    echo "✓ X11 Display: $DISPLAY"
    
    # Test X11 connection
    if command -v xdpyinfo >/dev/null 2>&1; then
        if xdpyinfo >/dev/null 2>&1; then
            echo "✓ X11 connection successful!"
            xdpyinfo | head -20
        else
            echo "❌ Cannot connect to X11 display"
            exit 1
        fi
    fi
fi

if [ -n "$WAYLAND_DISPLAY" ]; then
    echo "✓ Wayland Display: $WAYLAND_DISPLAY"
fi

echo ""
echo "Launching GUI test window..."
echo ""

# Try to open a simple GUI window using xterm (simplest X11 app)
# We launch it in a way that keeps the container running
if command -v xterm >/dev/null 2>&1; then
    echo "Opening xterm window..."
    echo "The window will stay open until you close it or stop the game."
    
    # Launch xterm and wait for it to exit
    # This keeps the container alive as long as the window is open
    exec xterm -geometry 80x24+100+100 -title "Dillinger Test Game" -e bash -c '
        echo "╔════════════════════════════════════════╗"
        echo "║  DILLINGER GUI TEST - SUCCESS! ✓       ║"
        echo "╚════════════════════════════════════════╝"
        echo ""
        echo "If you can see this window, display"
        echo "forwarding is working correctly!"
        echo ""
        echo "Display: $DISPLAY"
        echo "Host: $(hostname)"
        echo ""
        echo "This window will stay open until you:"
        echo "  - Close the window (X button)"
        echo "  - Press Ctrl+D or type \"exit\""
        echo "  - Stop the game from Dillinger UI"
        echo ""
        bash
    '
elif command -v xeyes >/dev/null 2>&1; then
    echo "Opening xeyes (X11 test application)..."
    echo "Close the window to exit."
    # exec replaces the shell process with xeyes, keeping container alive
    exec xeyes
elif command -v xmessage >/dev/null 2>&1; then
    echo "Opening xmessage dialog..."
    exec xmessage -center "Dillinger Display Test - SUCCESS!\n\nDisplay forwarding is working!\n\nDisplay: $DISPLAY\n\nClose this window to stop the game."
elif command -v zenity >/dev/null 2>&1; then
    echo "Opening zenity dialog..."
    exec zenity --info --text="Dillinger Display Test - SUCCESS!\n\nDisplay forwarding is working!" --title="Dillinger Test"
else
    echo "❌ No GUI applications available (xterm, xmessage, zenity, xeyes)"
    echo "   But display forwarding is configured correctly!"
    echo ""
    echo "   Try installing one of these in the container:"
    echo "   - xterm (best for testing)"
    echo "   - xmessage (minimal dialog)"
    echo "   - xeyes (classic X11 demo)"
    exit 0
fi
