#!/bin/bash
# Build script for Dillinger Streaming Sidecar image

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGISTRY="${REGISTRY:-ghcr.io/thrane20}"
VERSION="${VERSION:-0.3.1}"
NO_CACHE="${NO_CACHE:-false}"

IMAGE_NAME="dillinger/streaming-sidecar"
FULL_TAG="${REGISTRY}/${IMAGE_NAME}:${VERSION}"

echo "========================================"
echo "Building Streaming Sidecar Runner..."
echo "Tag: $FULL_TAG"
echo "========================================"

BUILD_ARGS=""
if [ "$NO_CACHE" = "true" ]; then
    BUILD_ARGS="--no-cache"
fi

docker build $BUILD_ARGS \
    --build-arg BASE_IMAGE="${REGISTRY}/dillinger/runner-base:${VERSION}" \
    -t "$FULL_TAG" \
    -f "$SCRIPT_DIR/Dockerfile" \
    "$SCRIPT_DIR"

echo "✓ Streaming Sidecar built successfully"
echo "  Tagged as: $FULL_TAG"
