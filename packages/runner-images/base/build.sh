#!/bin/bash
# Build script for Dillinger Base Runner image
set -e

IMAGE_NAME="ghcr.io/thrane20/dillinger/runner-base"
IMAGE_TAG="${1:-latest}"

echo "Building Dillinger Base Runner image: ${IMAGE_NAME}:${IMAGE_TAG}"
echo ""

docker build \
    --tag "${IMAGE_NAME}:${IMAGE_TAG}" \
    --file Dockerfile \
    .

echo ""
echo "✓ Build complete: ${IMAGE_NAME}:${IMAGE_TAG}"
echo ""
echo "To test the image, run:"
echo "  docker run --rm -it ${IMAGE_NAME}:${IMAGE_TAG}"
