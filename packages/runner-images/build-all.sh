#!/bin/bash

# Master build script for Dillinger runner images
# Builds base image first, then dependent images

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Color output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Dillinger Runner Images Build Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Build base image first (dependency for all others)
echo -e "${GREEN}[1/3] Building base image...${NC}"
cd base
docker build -t dillinger/runner-base:latest .
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Base image built successfully${NC}"
else
    echo -e "${RED}✗ Base image build failed${NC}"
    exit 1
fi
echo ""

# Build linux-native runner
echo -e "${GREEN}[2/3] Building linux-native runner...${NC}"
cd ../linux-native
docker build -t dillinger/runner-linux-native:latest .
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Linux-native runner built successfully${NC}"
else
    echo -e "${RED}✗ Linux-native runner build failed${NC}"
    exit 1
fi
echo ""

# Build wine runner
echo -e "${GREEN}[3/3] Building wine runner...${NC}"
cd ../wine
docker build -t dillinger/runner-wine:latest .
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Wine runner built successfully${NC}"
else
    echo -e "${RED}✗ Wine runner build failed${NC}"
    exit 1
fi
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}All images built successfully!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Built images:"
echo "  - dillinger/runner-base:latest"
echo "  - dillinger/runner-linux-native:latest"
echo "  - dillinger/runner-wine:latest"
