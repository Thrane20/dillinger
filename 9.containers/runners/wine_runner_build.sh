#!/bin/bash

# Check if Dockerfile path is provided
if [ -z "$1" ]; then
    echo "Usage: $0 /path/to/Dockerfile"
    exit 1
fi

# Set variables
DOCKERFILE_PATH="$1"
IMAGE_NAME="dillinger-wine"

# Build the image
echo "Building the Podman image: $IMAGE_NAME using Dockerfile at $DOCKERFILE_PATH"
podman build -t $IMAGE_NAME -f $DOCKERFILE_PATH .

echo "Build completed for image: $IMAGE_NAME"
