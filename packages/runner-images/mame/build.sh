#!/bin/bash
# Build script for MAME runner image

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Building MAME Runner Image${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Parse arguments
NO_CACHE=""
if [ "$1" = "--no-cache" ]; then
    NO_CACHE="--no-cache"
    echo "Building without cache..."
fi

# Build the image
docker build $NO_CACHE -t ghcr.io/thrane20/dillinger/runner-mame:latest .

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}MAME Runner Image Built Successfully${NC}"
echo -e "${BLUE}Tag: ghcr.io/thrane20/dillinger/runner-mame:latest${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
