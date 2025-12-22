#!/bin/bash
# Build script for Wine runner Docker image
set -e

IMAGE_NAME="ghcr.io/thrane20/dillinger/runner-wine"
IMAGE_TAG="latest"

echo "Building Wine runner Docker image..."
echo "Image: ${IMAGE_NAME}:${IMAGE_TAG}"
echo ""

# Build the Docker image
docker build -t "${IMAGE_NAME}:${IMAGE_TAG}" .

echo ""
echo "✓ Build complete!"
echo ""
echo "Image: ${IMAGE_NAME}:${IMAGE_TAG}"
echo ""
echo "To test the image, run:"
echo "  ./test-wine.sh"
echo ""
