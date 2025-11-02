#!/bin/bash
# Validation script for Wine runner
# This validates the structure and configuration without building the Docker image

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "========================================="
echo "  Wine Runner Validation"
echo "========================================="
echo ""

ERRORS=0
WARNINGS=0

# Function to check file exists
check_file() {
    local file=$1
    local desc=$2
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $desc exists"
    else
        echo -e "${RED}✗${NC} $desc missing: $file"
        ERRORS=$((ERRORS + 1))
    fi
}

# Function to check directory exists
check_dir() {
    local dir=$1
    local desc=$2
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓${NC} $desc exists"
    else
        echo -e "${RED}✗${NC} $desc missing: $dir"
        ERRORS=$((ERRORS + 1))
    fi
}

# Function to check executable
check_executable() {
    local file=$1
    local desc=$2
    if [ -x "$file" ]; then
        echo -e "${GREEN}✓${NC} $desc is executable"
    else
        echo -e "${YELLOW}⚠${NC} $desc is not executable: $file"
        WARNINGS=$((WARNINGS + 1))
    fi
}

echo "Checking Wine runner structure..."
echo ""

# Check main directory
check_dir "/home/runner/work/dillinger/dillinger/packages/runner-images/wine" "Wine runner directory"

# Check Dockerfile
check_file "/home/runner/work/dillinger/dillinger/packages/runner-images/wine/Dockerfile" "Dockerfile"

# Check scripts
check_file "/home/runner/work/dillinger/dillinger/packages/runner-images/wine/entrypoint.sh" "Entrypoint script"
check_executable "/home/runner/work/dillinger/dillinger/packages/runner-images/wine/entrypoint.sh" "Entrypoint script"

check_file "/home/runner/work/dillinger/dillinger/packages/runner-images/wine/build.sh" "Build script"
check_executable "/home/runner/work/dillinger/dillinger/packages/runner-images/wine/build.sh" "Build script"

check_file "/home/runner/work/dillinger/dillinger/packages/runner-images/wine/test-installer.sh" "Test installer script"
check_executable "/home/runner/work/dillinger/dillinger/packages/runner-images/wine/test-installer.sh" "Test installer script"

check_dir "/home/runner/work/dillinger/dillinger/packages/runner-images/wine/scripts" "Scripts directory"
check_file "/home/runner/work/dillinger/dillinger/packages/runner-images/wine/scripts/nvidia-check.sh" "NVIDIA check script"

# Check documentation
check_file "/home/runner/work/dillinger/dillinger/packages/runner-images/wine/README.md" "README"

# Check platform definition
check_file "/home/runner/work/dillinger/dillinger/packages/dillinger-core/backend/data/storage/platforms/windows-wine.json" "Platform definition"

echo ""
echo "Checking Dockerfile contents..."
echo ""

# Validate Dockerfile has key components
if grep -q "FROM archlinux:latest" /home/runner/work/dillinger/dillinger/packages/runner-images/wine/Dockerfile; then
    echo -e "${GREEN}✓${NC} Dockerfile uses Arch Linux base"
else
    echo -e "${RED}✗${NC} Dockerfile does not use Arch Linux base"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "multilib" /home/runner/work/dillinger/dillinger/packages/runner-images/wine/Dockerfile; then
    echo -e "${GREEN}✓${NC} Dockerfile enables multilib (32-bit support)"
else
    echo -e "${YELLOW}⚠${NC} Dockerfile may be missing multilib support"
    WARNINGS=$((WARNINGS + 1))
fi

if grep -q "wine" /home/runner/work/dillinger/dillinger/packages/runner-images/wine/Dockerfile; then
    echo -e "${GREEN}✓${NC} Dockerfile installs Wine"
else
    echo -e "${RED}✗${NC} Dockerfile does not install Wine"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "pulseaudio" /home/runner/work/dillinger/dillinger/packages/runner-images/wine/Dockerfile; then
    echo -e "${GREEN}✓${NC} Dockerfile includes PulseAudio support"
else
    echo -e "${YELLOW}⚠${NC} Dockerfile may be missing PulseAudio support"
    WARNINGS=$((WARNINGS + 1))
fi

if grep -q "nvidia" /home/runner/work/dillinger/dillinger/packages/runner-images/wine/Dockerfile; then
    echo -e "${GREEN}✓${NC} Dockerfile includes NVIDIA support"
else
    echo -e "${YELLOW}⚠${NC} Dockerfile may be missing NVIDIA support"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "Checking entrypoint script..."
echo ""

if grep -q "INSTALLER_MODE" /home/runner/work/dillinger/dillinger/packages/runner-images/wine/entrypoint.sh; then
    echo -e "${GREEN}✓${NC} Entrypoint supports installer mode"
else
    echo -e "${RED}✗${NC} Entrypoint does not support installer mode"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "WINEPREFIX" /home/runner/work/dillinger/dillinger/packages/runner-images/wine/entrypoint.sh; then
    echo -e "${GREEN}✓${NC} Entrypoint configures Wine prefix"
else
    echo -e "${RED}✗${NC} Entrypoint does not configure Wine prefix"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "pulseaudio" /home/runner/work/dillinger/dillinger/packages/runner-images/wine/entrypoint.sh; then
    echo -e "${GREEN}✓${NC} Entrypoint configures PulseAudio"
else
    echo -e "${YELLOW}⚠${NC} Entrypoint may not configure PulseAudio"
    WARNINGS=$((WARNINGS + 1))
fi

if grep -q "nvidia-check.sh" /home/runner/work/dillinger/dillinger/packages/runner-images/wine/entrypoint.sh; then
    echo -e "${GREEN}✓${NC} Entrypoint includes NVIDIA detection"
else
    echo -e "${YELLOW}⚠${NC} Entrypoint may not include NVIDIA detection"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "Checking platform definition..."
echo ""

if jq -e '.type == "wine"' /home/runner/work/dillinger/dillinger/packages/dillinger-core/backend/data/storage/platforms/windows-wine.json >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Platform type is 'wine'"
else
    echo -e "${RED}✗${NC} Platform type is not 'wine'"
    ERRORS=$((ERRORS + 1))
fi

if jq -e '.configuration.containerImage == "dillinger/runner-wine:latest"' /home/runner/work/dillinger/dillinger/packages/dillinger-core/backend/data/storage/platforms/windows-wine.json >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Platform uses correct container image"
else
    echo -e "${RED}✗${NC} Platform does not use correct container image"
    ERRORS=$((ERRORS + 1))
fi

if jq -e '.configuration.supportedExtensions | index(".exe")' /home/runner/work/dillinger/dillinger/packages/dillinger-core/backend/data/storage/platforms/windows-wine.json >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Platform supports .exe files"
else
    echo -e "${RED}✗${NC} Platform does not support .exe files"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "========================================="
echo "  Validation Summary"
echo "========================================="
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "The Wine runner is properly configured and ready to build."
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ $WARNINGS warning(s) found${NC}"
    echo ""
    echo "The Wine runner should work but may need minor adjustments."
    exit 0
else
    echo -e "${RED}✗ $ERRORS error(s) and $WARNINGS warning(s) found${NC}"
    echo ""
    echo "Please fix the errors before building the Wine runner."
    exit 1
fi
