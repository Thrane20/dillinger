#!/bin/bash
# Quick test script for the Linux Native Runner

set -e

echo "════════════════════════════════════════════"
echo "  Dillinger Linux Native Runner Test"
echo "════════════════════════════════════════════"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNNER_DIR="$SCRIPT_DIR/packages/runner-images/linux-native"

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed or not in PATH"
    exit 1
fi

echo "✓ Docker is available"
echo ""

# Build the runner image
echo "Building Linux Native Runner image..."
cd "$RUNNER_DIR"

docker build -t dillinger/runner-linux-native:latest . 

echo ""
echo "✓ Image built successfully"
echo ""

# Create test saves directory
TEST_SAVES_DIR="$SCRIPT_DIR/test-saves"
mkdir -p "$TEST_SAVES_DIR"

echo "Running test game..."
echo "(This will launch an interactive text-based game)"
echo ""
echo "Press Enter to continue..."
read -r

# Run the test game
docker run -it --rm \
    -e GAME_EXECUTABLE=/usr/local/bin/test-game.sh \
    -v "$TEST_SAVES_DIR:/saves:rw" \
    dillinger/runner-linux-native:latest

echo ""
echo "════════════════════════════════════════════"
echo "✓ Test complete!"
echo ""
echo "Your save file is at: $TEST_SAVES_DIR/test-game-progress.txt"
echo ""
echo "To run again:"
echo "  docker run -it --rm \\"
echo "    -e GAME_EXECUTABLE=/usr/local/bin/test-game.sh \\"
echo "    -v $TEST_SAVES_DIR:/saves:rw \\"
echo "    dillinger/runner-linux-native:latest"
echo ""
echo "════════════════════════════════════════════"
