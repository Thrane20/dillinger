#!/bin/bash
# NVIDIA GPU Detection and Configuration
# Learned from Games on Whales (GoW) architecture

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if NVIDIA GPU is present
if lspci 2>/dev/null | grep -i nvidia >/dev/null 2>&1; then
    echo -e "${GREEN}✓ NVIDIA GPU detected${NC}"
    
    # Check if nvidia-smi is available
    if command -v nvidia-smi >/dev/null 2>&1; then
        echo -e "${GREEN}✓ NVIDIA drivers are available${NC}"
        
        # Show GPU info
        GPU_INFO=$(nvidia-smi --query-gpu=name,driver_version --format=csv,noheader 2>/dev/null || echo "Unknown")
        echo "  GPU: $GPU_INFO"
        
        # Set NVIDIA-specific Wine environment variables
        export __GL_SHADER_DISK_CACHE=1
        export __GL_SHADER_DISK_CACHE_PATH=/saves/cache/nvidia
        mkdir -p /saves/cache/nvidia
        
    else
        echo -e "${YELLOW}⚠ NVIDIA GPU detected but drivers not available${NC}"
        echo "  Container may fall back to software rendering"
    fi
else
    # No NVIDIA GPU detected, probably using integrated graphics or AMD
    if lspci 2>/dev/null | grep -i 'vga\|3d' | grep -i amd >/dev/null 2>&1; then
        echo -e "${GREEN}✓ AMD GPU detected${NC}"
    elif lspci 2>/dev/null | grep -i 'vga\|3d' | grep -i intel >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Intel GPU detected${NC}"
    else
        echo "  Using available GPU drivers"
    fi
fi

exit 0
