#!/bin/bash
# Build script for Dillinger Docker image

set -e

echo "Building Dillinger Docker image..."
echo "Image tag: thrane20/dillinger:1.0"
echo ""

# Build the Docker image using the dillinger-core Dockerfile
docker build \
  --progress=plain \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
  -t thrane20/dillinger:1.0 \
  -f packages/dillinger-core/Dockerfile \
  .

echo ""
echo "Build completed successfully!"
echo ""
echo "To run the container:"
echo "  docker-compose up -d"
echo ""
echo "Or manually with:"
echo "  docker volume create dillinger_library"
echo "  docker run -d -p 3010:3010 -v dillinger_library:/data --name dillinger-core thrane20/dillinger:1.0"
