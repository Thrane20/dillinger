#!/bin/bash
# Build script for Linux Native Runner

set -e

IMAGE_NAME="${IMAGE_NAME:-dillinger/runner-linux-native}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

echo "Building Dillinger Linux Native Runner..."
echo "Image: ${IMAGE_NAME}:${IMAGE_TAG}"
echo ""

docker build \
    --tag "${IMAGE_NAME}:${IMAGE_TAG}" \
    --file Dockerfile \
    .

echo ""
echo "✓ Build complete!"
echo ""
echo "Test the runner with:"
echo "  docker run -it --rm -e GAME_EXECUTABLE=/usr/local/bin/test-game.sh ${IMAGE_NAME}:${IMAGE_TAG}"
