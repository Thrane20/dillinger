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

# Detect script directory and repository root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNNER_DIR="$SCRIPT_DIR"
# Find git root
REPO_ROOT="$(cd "$SCRIPT_DIR" && git rev-parse --show-toplevel 2>/dev/null || echo "")"
if [ -z "$REPO_ROOT" ]; then
    echo -e "${RED}Error: Could not find git repository root${NC}"
    exit 1
fi
PLATFORM_DIR="$REPO_ROOT/packages/dillinger-core/data/storage/platforms"

echo "Script directory: $SCRIPT_DIR"
echo "Repository root: $REPO_ROOT"
echo ""

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
check_dir "$RUNNER_DIR" "Wine runner directory"

# Check Dockerfile
check_file "$RUNNER_DIR/Dockerfile" "Dockerfile"

# Check scripts
check_file "$RUNNER_DIR/entrypoint.sh" "Entrypoint script"
check_executable "$RUNNER_DIR/entrypoint.sh" "Entrypoint script"

check_file "$RUNNER_DIR/build.sh" "Build script"
check_executable "$RUNNER_DIR/build.sh" "Build script"

check_file "$RUNNER_DIR/test-installer.sh" "Test installer script"
check_executable "$RUNNER_DIR/test-installer.sh" "Test installer script"

check_dir "$RUNNER_DIR/scripts" "Scripts directory"
check_file "$RUNNER_DIR/scripts/nvidia-check.sh" "NVIDIA check script"

# Check documentation
check_file "$RUNNER_DIR/README.md" "README"

# Check platform definition
check_file "$PLATFORM_DIR/windows-wine.json" "Platform definition"

echo ""
echo "Checking Dockerfile contents..."
echo ""

# Validate Dockerfile has key components
if grep -q "FROM archlinux:latest" "$RUNNER_DIR/Dockerfile"; then
    echo -e "${GREEN}✓${NC} Dockerfile uses Arch Linux base"
else
    echo -e "${RED}✗${NC} Dockerfile does not use Arch Linux base"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "multilib" "$RUNNER_DIR/Dockerfile"; then
    echo -e "${GREEN}✓${NC} Dockerfile enables multilib (32-bit support)"
else
    echo -e "${YELLOW}⚠${NC} Dockerfile may be missing multilib support"
    WARNINGS=$((WARNINGS + 1))
fi

if grep -q "wine" "$RUNNER_DIR/Dockerfile"; then
    echo -e "${GREEN}✓${NC} Dockerfile installs Wine"
else
    echo -e "${RED}✗${NC} Dockerfile does not install Wine"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "pulseaudio" "$RUNNER_DIR/Dockerfile"; then
    echo -e "${GREEN}✓${NC} Dockerfile includes PulseAudio support"
else
    echo -e "${YELLOW}⚠${NC} Dockerfile may be missing PulseAudio support"
    WARNINGS=$((WARNINGS + 1))
fi

if grep -q "nvidia" "$RUNNER_DIR/Dockerfile"; then
    echo -e "${GREEN}✓${NC} Dockerfile includes NVIDIA support"
else
    echo -e "${YELLOW}⚠${NC} Dockerfile may be missing NVIDIA support"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "Checking entrypoint script..."
echo ""

if grep -q "INSTALLER_MODE" "$RUNNER_DIR/entrypoint.sh"; then
    echo -e "${GREEN}✓${NC} Entrypoint supports installer mode"
else
    echo -e "${RED}✗${NC} Entrypoint does not support installer mode"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "WINEPREFIX" "$RUNNER_DIR/entrypoint.sh"; then
    echo -e "${GREEN}✓${NC} Entrypoint configures Wine prefix"
else
    echo -e "${RED}✗${NC} Entrypoint does not configure Wine prefix"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "pulseaudio" "$RUNNER_DIR/entrypoint.sh"; then
    echo -e "${GREEN}✓${NC} Entrypoint configures PulseAudio"
else
    echo -e "${YELLOW}⚠${NC} Entrypoint may not configure PulseAudio"
    WARNINGS=$((WARNINGS + 1))
fi

if grep -q "nvidia-check.sh" "$RUNNER_DIR/entrypoint.sh"; then
    echo -e "${GREEN}✓${NC} Entrypoint includes NVIDIA detection"
else
    echo -e "${YELLOW}⚠${NC} Entrypoint may not include NVIDIA detection"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "Checking platform definition..."
echo ""

if jq -e '.type == "wine"' "$PLATFORM_DIR/windows-wine.json" >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Platform type is 'wine'"
else
    echo -e "${RED}✗${NC} Platform type is not 'wine'"
    ERRORS=$((ERRORS + 1))
fi

if jq -e '.configuration.containerImage == "ghcr.io/thrane20/runner-wine:latest"' "$PLATFORM_DIR/windows-wine.json" >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Platform uses correct container image"
else
    echo -e "${RED}✗${NC} Platform does not use correct container image"
    ERRORS=$((ERRORS + 1))
fi

if jq -e '.configuration.supportedExtensions | index(".exe")' "$PLATFORM_DIR/windows-wine.json" >/dev/null 2>&1; then
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
