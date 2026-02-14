#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

if [ -f "../../versioning.env" ]; then
    source "../../versioning.env"
fi

VERSION="${DILLINGER_STREAMING_SIDECAR_VERSION:-latest}"
IMAGE="ghcr.io/thrane20/dillinger/streaming-sidecar:${VERSION}"

NO_CACHE=""
for arg in "$@"; do
    if [ "$arg" = "--no-cache" ]; then
        NO_CACHE="--no-cache"
    fi
done

DOCKER_BUILDKIT=1 docker buildx build --load --network=host \
    --progress="${DOCKER_PROGRESS:-plain}" \
    $NO_CACHE \
    -f "${SCRIPT_DIR}/Dockerfile" \
    -t "$IMAGE" \
    "$REPO_ROOT"

echo "Built $IMAGE"
