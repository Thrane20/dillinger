#!/bin/bash
set -e

# Ensure we are in the directory of the script
cd "$(dirname "$0")"

IMAGE_NAME="dillinger/runner-retroarch"
TAG="latest"

echo "Building $IMAGE_NAME:$TAG..."

docker buildx build --load -t "$IMAGE_NAME:$TAG" .

echo "Build complete!"
