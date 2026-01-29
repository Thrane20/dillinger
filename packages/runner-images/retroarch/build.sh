#!/bin/bash
# Build script for RetroArch runner Docker image
set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

cd "$(dirname "$0")"

# Load version from versioning.env
if [ -f "../../versioning.env" ]; then
    source "../../versioning.env"
fi

# Resolve to project root versioning.env if relative path failed
if [ -z "$DILLINGER_RUNNER_BASE_VERSION" ] && [ -f "../../../versioning.env" ]; then
    source "../../../versioning.env"
fi

IMAGE_NAME="${IMAGE_NAME:-ghcr.io/thrane20/dillinger/runner-retroarch}"
VERSION="${DILLINGER_RUNNER_RETROARCH_VERSION:-0.1.0}"
BASE_VERSION="${DILLINGER_RUNNER_BASE_VERSION:-0.2.1}"
IMAGE_TAG="${IMAGE_TAG:-${1:-$VERSION}}"
NO_CACHE=""

# Check for --no-cache flag
if [ "$1" = "--no-cache" ] || [ "$2" = "--no-cache" ]; then
    NO_CACHE="--no-cache"
fi

PROGRESS_MODE="${DOCKER_PROGRESS:-plain}"

echo -e "${BLUE}Building RetroArch runner Docker image: ${IMAGE_NAME}:${IMAGE_TAG}${NC}"
echo -e "${BLUE}Base image version: ${BASE_VERSION}${NC}"
echo -e "${BLUE}Progress mode: ${PROGRESS_MODE}${NC}"
echo ""

BUILD_START=$(date +%s)

DOCKER_BUILDKIT=1 docker buildx build --network=host --progress="${PROGRESS_MODE}" --load $NO_CACHE \
    --build-arg BASE_VERSION="${BASE_VERSION}" \
    -t "${IMAGE_NAME}:${IMAGE_TAG}" \
    -t "${IMAGE_NAME}:latest" \
    .

BUILD_END=$(date +%s)
BUILD_DURATION=$((BUILD_END - BUILD_START))
MINUTES=$((BUILD_DURATION / 60))
SECONDS=$((BUILD_DURATION % 60))

echo ""
echo -e "${GREEN}✓ Build complete: ${IMAGE_NAME}:${IMAGE_TAG} (${MINUTES}m ${SECONDS}s)${NC}"
echo -e "${GREEN}✓ Also tagged as: ${IMAGE_NAME}:latest${NC}"
echo "To push: docker push ${IMAGE_NAME}:${IMAGE_TAG} && docker push ${IMAGE_NAME}:latest"
