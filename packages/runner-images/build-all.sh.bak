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
echo -e "${GREEN}[1/5] Building base image...${NC}"
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
echo -e "${GREEN}[2/5] Building linux-native runner...${NC}"
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
echo -e "${GREEN}[3/5] Building wine runner...${NC}"
cd ../wine
docker build -t dillinger/runner-wine:latest .
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Wine runner built successfully${NC}"
else
    echo -e "${RED}✗ Wine runner build failed${NC}"
    exit 1
fi
echo ""

# Build VICE runner
echo -e "${GREEN}[4/5] Building VICE runner...${NC}"
cd ../vice
docker build -t dillinger/runner-vice:latest .
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ VICE runner built successfully${NC}"
else
    echo -e "${RED}✗ VICE runner build failed${NC}"
    exit 1
fi
echo ""

# Build FS-UAE runner
echo -e "${GREEN}[5/5] Building FS-UAE runner...${NC}"
cd ../fs-uae
docker build -t dillinger/runner-fs-uae:latest .
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ FS-UAE runner built successfully${NC}"
else
    echo -e "${RED}✗ FS-UAE runner build failed${NC}"
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
echo "  - dillinger/runner-vice:latest"
echo "  - dillinger/runner-fs-uae:latest"
