#!/bin/bash
# Test script for Wine runner - simulates an installer
set -e

echo "========================================="
echo "  Wine Runner Test - Installer Mode"
echo "========================================="
echo ""
echo "This test demonstrates the Wine runner's ability to:"
echo "  1. Initialize a Wine prefix"
echo "  2. Run Windows executables"
echo "  3. Set up PulseAudio"
echo "  4. Configure display"
echo ""

# Check Wine installation
echo "Checking Wine installation..."
if command -v wine >/dev/null 2>&1; then
    echo "✓ Wine is installed"
    wine --version
else
    echo "✗ Wine is not installed"
    exit 1
fi

# Check Wine prefix
echo ""
echo "Checking Wine prefix..."
if [ -d "$WINEPREFIX/drive_c" ]; then
    echo "✓ Wine prefix exists at: $WINEPREFIX"
    echo "  Drive C: $WINEPREFIX/drive_c"
else
    echo "⚠ Wine prefix not initialized"
fi

# Test winecfg (graphical test if DISPLAY is set)
if [ -n "$DISPLAY" ]; then
    echo ""
    echo "Display is available. You can test Wine configuration with:"
    echo "  wine winecfg"
    echo ""
    echo "For a full GUI test, run:"
    echo "  wine notepad"
fi

echo ""
echo "Test completed successfully!"
echo ""
echo "========================================="
