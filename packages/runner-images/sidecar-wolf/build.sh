#!/bin/bash
# Build script for Dillinger Streaming Sidecar image
# Ubuntu-based with Wolf binary for Moonlight streaming

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGISTRY="${REGISTRY:-ghcr.io/thrane20}"
VERSION="${VERSION:-0.4.0}"
NO_CACHE="${NO_CACHE:-false}"

IMAGE_NAME="dillinger/streaming-sidecar"
FULL_TAG="${REGISTRY}/${IMAGE_NAME}:${VERSION}"

echo "========================================"
echo "Building Dillinger Streaming Sidecar..."
echo "Tag: $FULL_TAG"
echo "Base: Ubuntu 24.04 + Wolf binary"
echo "========================================"

BUILD_ARGS=""
if [ "$NO_CACHE" = "true" ]; then
    BUILD_ARGS="--no-cache"
fi

docker build $BUILD_ARGS \
    -t "$FULL_TAG" \
    -t "${REGISTRY}/${IMAGE_NAME}:latest" \
    -f "$SCRIPT_DIR/Dockerfile" \
    "$SCRIPT_DIR"

echo "✓ Streaming Sidecar built successfully"
echo "  Image: $FULL_TAG"
echo "  Also tagged: ${REGISTRY}/${IMAGE_NAME}:latest"
echo "  Tagged as: $FULL_TAG"
