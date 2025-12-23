#!/bin/bash
# Build script for Dillinger Base Runner image
set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load version from versioning.env
if [ -f "../../versioning.env" ]; then
    source "../../versioning.env"
fi

IMAGE_NAME="${IMAGE_NAME:-ghcr.io/thrane20/dillinger/runner-base}"
VERSION="${DILLINGER_RUNNER_BASE_VERSION:-0.1.0}"
IMAGE_TAG="${IMAGE_TAG:-${1:-$VERSION}}"
NO_CACHE=""

# Check for --no-cache flag
if [ "$1" = "--no-cache" ] || [ "$2" = "--no-cache" ]; then
    NO_CACHE="--no-cache"
fi

# Progress mode: auto (default), plain (verbose), or tty (compact)
PROGRESS_MODE="${DOCKER_PROGRESS:-plain}"

echo -e "${BLUE}Building Dillinger Base Runner image: ${IMAGE_NAME}:${IMAGE_TAG}${NC}"
echo -e "${BLUE}Progress mode: ${PROGRESS_MODE}${NC}"
echo ""

# Record start time
BUILD_START=$(date +%s)

DOCKER_BUILDKIT=1 docker buildx build \
    --network=host \
    --progress="${PROGRESS_MODE}" \
    --load \
    $NO_CACHE \
    --tag "${IMAGE_NAME}:${IMAGE_TAG}" \
    --tag "${IMAGE_NAME}:latest" \
    --file Dockerfile \
    .

# Calculate and display build time
BUILD_END=$(date +%s)
BUILD_DURATION=$((BUILD_END - BUILD_START))
MINUTES=$((BUILD_DURATION / 60))
SECONDS=$((BUILD_DURATION % 60))

echo ""
echo -e "${GREEN}✓ Build completed in ${MINUTES}m ${SECONDS}s${NC}"

echo ""
echo -e "${GREEN}✓ Build complete: ${IMAGE_NAME}:${IMAGE_TAG}${NC}"
echo -e "${GREEN}✓ Also tagged as: ${IMAGE_NAME}:latest${NC}"
echo "To push: docker push ${IMAGE_NAME}:${IMAGE_TAG} && docker push ${IMAGE_NAME}:latest"
