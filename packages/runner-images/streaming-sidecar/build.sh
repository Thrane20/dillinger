#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ -f "../../versioning.env" ]; then
    source "../../versioning.env"
fi

VERSION="${DILLINGER_STREAMING_SIDECAR_VERSION:-latest}"
IMAGE="ghcr.io/thrane20/dillinger/streaming-sidecar:${VERSION}"

DOCKER_BUILDKIT=1 docker buildx build --load \
    --progress="${DOCKER_PROGRESS:-plain}" \
    -t "$IMAGE" .

echo "Built $IMAGE"
