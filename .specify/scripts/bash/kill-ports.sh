#!/bin/bash
# Kill processes using Dillinger development ports
# Run this on your HOST machine if ports are already in use

echo "Checking for processes using Dillinger ports..."
echo ""

PORTS=(3010 3011 3002 3003 8080)
FOUND=0

for PORT in "${PORTS[@]}"; do
    # Check if port is in use
    if sudo lsof -i:$PORT -t >/dev/null 2>&1; then
        echo "Port $PORT is in use:"
        sudo lsof -i:$PORT
        FOUND=1
    fi
done

if [ $FOUND -eq 0 ]; then
    echo "✓ All Dillinger ports are free!"
    exit 0
fi

echo ""
echo "═══════════════════════════════════════════════"
read -p "Kill all processes on these ports? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    for PORT in "${PORTS[@]}"; do
        if sudo lsof -i:$PORT -t >/dev/null 2>&1; then
            echo "Killing processes on port $PORT..."
            sudo fuser -k $PORT/tcp 2>/dev/null || sudo lsof -ti:$PORT | xargs -r sudo kill -9
        fi
    done
    
    echo ""
    echo "✓ Ports cleared!"
    echo ""
    echo "Now you can:"
    echo "  1. Rebuild devcontainer: F1 → 'Dev Containers: Rebuild Container'"
    echo "  2. Or run: pnpm dev"
else
    echo "Cancelled."
fi
