#!/bin/bash
# Dillinger Base Game Runner - Entrypoint Script
# Handles X11/Wayland display setup, GPU configuration, PulseAudio, and Moonlight streaming
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Dillinger Base Game Runner${NC}"
echo -e "${GREEN}========================================${NC}"

# Set defaults
PUID="${PUID:-1000}"
PGID="${PGID:-1000}"
UNAME="${UNAME:-gameuser}"
SAVE_DIR="${SAVE_DIR:-/saves}"
USE_GAMESCOPE="${USE_GAMESCOPE:-false}"
ENABLE_MOONLIGHT="${ENABLE_MOONLIGHT:-false}"
GAMESCOPE_WIDTH="${GAMESCOPE_WIDTH:-1920}"
GAMESCOPE_HEIGHT="${GAMESCOPE_HEIGHT:-1080}"
GAMESCOPE_REFRESH="${GAMESCOPE_REFRESH:-60}"
GAMESCOPE_FULLSCREEN="${GAMESCOPE_FULLSCREEN:-false}"
GAMESCOPE_UPSCALER="${GAMESCOPE_UPSCALER:-auto}"

# XDG directories
export XDG_RUNTIME_DIR="/run/user/${UNAME}"
export XDG_DATA_HOME="${SAVE_DIR}/data"
export XDG_CONFIG_HOME="${SAVE_DIR}/config"
export XDG_CACHE_HOME="${SAVE_DIR}/cache"

# Create necessary directories
mkdir -p "$SAVE_DIR" "$XDG_RUNTIME_DIR" "$XDG_DATA_HOME" "$XDG_CONFIG_HOME" "$XDG_CACHE_HOME"

echo ""
echo -e "${BLUE}Configuration:${NC}"
echo "  User: $UNAME (UID: $PUID, GID: $PGID)"
echo "  Save Directory: $SAVE_DIR"
echo "  Display: ${DISPLAY:-<not set>}"
echo "  Use Gamescope: $USE_GAMESCOPE"
echo "  Enable Moonlight: $ENABLE_MOONLIGHT"
if [ "$USE_GAMESCOPE" = "true" ]; then
    echo "  Gamescope Resolution: ${GAMESCOPE_WIDTH}x${GAMESCOPE_HEIGHT}@${GAMESCOPE_REFRESH}"
    echo "  Gamescope Fullscreen: $GAMESCOPE_FULLSCREEN"
    echo "  Gamescope Upscaler: $GAMESCOPE_UPSCALER"
fi
echo ""

#######################################################
# User and Group Management
#######################################################

# Update user UID/GID if needed
CURRENT_UID=$(id -u $UNAME 2>/dev/null || echo "1000")
CURRENT_GID=$(id -g $UNAME 2>/dev/null || echo "1000")

if [ "$CURRENT_UID" != "$PUID" ] || [ "$CURRENT_GID" != "$PGID" ]; then
    echo -e "${BLUE}Updating user $UNAME to UID:$PUID GID:$PGID...${NC}"
    
    # Update group ID
    if [ "$CURRENT_GID" != "$PGID" ]; then
        groupmod -o -g "$PGID" $UNAME 2>/dev/null || true
    fi
    
    # Update user ID
    if [ "$CURRENT_UID" != "$PUID" ]; then
        usermod -o -u "$PUID" $UNAME 2>/dev/null || true
    fi
    
    echo -e "${GREEN}✓ User updated${NC}"
fi

# Fix ownership of important directories
chown -R $PUID:$PGID "$XDG_RUNTIME_DIR" "$SAVE_DIR" /home/$UNAME 2>/dev/null || true
chmod 700 "$XDG_RUNTIME_DIR"

#######################################################
# GPU and Graphics Setup
#######################################################

echo -e "${BLUE}Checking GPU access...${NC}"

# Allow caller to force a specific vendor stack.
# Values: auto | amd | nvidia
GPU_VENDOR="${GPU_VENDOR:-auto}"

# Best-effort hardware detection (may not work in minimal containers).
HAS_NVIDIA_DEV="false"
if [ -e "/dev/nvidia0" ] || [ -e "/dev/nvidiactl" ]; then
    HAS_NVIDIA_DEV="true"
fi

HAS_AMD_PCI="false"
if command -v lspci >/dev/null 2>&1 && lspci 2>/dev/null | grep -Ei "VGA|3D" | grep -i "AMD" >/dev/null; then
    HAS_AMD_PCI="true"
fi

if [ "$GPU_VENDOR" = "nvidia" ] || { [ "$GPU_VENDOR" = "auto" ] && [ "$HAS_NVIDIA_DEV" = "true" ]; }; then
    echo -e "${GREEN}✓ NVIDIA GPU selected${NC}"
    export __NV_PRIME_RENDER_OFFLOAD=1
    export __GLX_VENDOR_LIBRARY_NAME=nvidia
    if [ -f "/usr/share/vulkan/icd.d/nvidia_icd.json" ]; then
        export VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json
    fi
fi

if [ "$GPU_VENDOR" = "amd" ] || { [ "$GPU_VENDOR" = "auto" ] && [ "$HAS_AMD_PCI" = "true" ] && [ "$HAS_NVIDIA_DEV" != "true" ]; }; then
    echo -e "${GREEN}✓ AMD GPU selected${NC}"
    export RADV_PERFTEST=aco
    if [ -f "/usr/share/vulkan/icd.d/radeon_icd.x86_64.json" ]; then
        export VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/radeon_icd.x86_64.json
    fi
fi

# Check for Intel GPU
if lspci 2>/dev/null | grep -i "VGA.*Intel" >/dev/null; then
    echo -e "${GREEN}✓ Intel GPU detected${NC}"
fi

# Check for DRI devices
if [ -d "/dev/dri" ]; then
    echo -e "${GREEN}✓ GPU device access available (DRI)${NC}"
    ls -la /dev/dri/ 2>/dev/null || true
else
    echo -e "${YELLOW}⚠ No GPU device access (software rendering only)${NC}"
fi

#######################################################
# Display Server Setup (X11/Wayland)
#######################################################

echo -e "${BLUE}Setting up display server...${NC}"

# Check for X11 connection
if [ -n "$DISPLAY" ]; then
    echo -e "${BLUE}Checking X11 connection...${NC}"
    if command -v xdpyinfo >/dev/null 2>&1 && xdpyinfo >/dev/null 2>&1; then
        echo -e "${GREEN}✓ X11 connection successful${NC}"
        echo "  Display: $DISPLAY"
    else
        echo -e "${YELLOW}⚠ Warning: Cannot connect to X11 display${NC}"
        echo "  Make sure you mounted /tmp/.X11-unix and set DISPLAY"
    fi
else
    echo -e "${YELLOW}⚠ No DISPLAY variable set${NC}"
    echo "  You may need to set up X11 forwarding or use a virtual display"
fi

# Check for Wayland
if [ -n "$WAYLAND_DISPLAY" ]; then
    echo -e "${GREEN}✓ Wayland display detected: $WAYLAND_DISPLAY${NC}"
fi

#######################################################
# Audio Setup (PulseAudio)
#######################################################

echo -e "${BLUE}Setting up audio...${NC}"

# Check for host PulseAudio connection
if [ -n "$PULSE_SERVER" ]; then
    echo "  Using host PulseAudio server: $PULSE_SERVER"
    
    if command -v pactl >/dev/null 2>&1 && pactl info >/dev/null 2>&1; then
        echo -e "${GREEN}✓ PulseAudio connection successful${NC}"
    else
        echo -e "${YELLOW}⚠ Cannot connect to PulseAudio server${NC}"
    fi
elif command -v pulseaudio >/dev/null 2>&1; then
    echo "  Starting container-local PulseAudio..."
    
    # Start PulseAudio as the game user
    gosu $UNAME pulseaudio --start --exit-idle-time=-1 2>/dev/null || true
    sleep 1
    
    if gosu $UNAME pulseaudio --check 2>/dev/null; then
        echo -e "${GREEN}✓ PulseAudio started successfully${NC}"
        export PULSE_SERVER="unix:$XDG_RUNTIME_DIR/pulse/native"
    else
        echo -e "${YELLOW}⚠ PulseAudio failed to start${NC}"
    fi
else
    echo -e "${YELLOW}⚠ PulseAudio not available${NC}"
fi

#######################################################
# Gamescope Setup
#######################################################

if [ "$USE_GAMESCOPE" = "true" ]; then
    echo -e "${BLUE}Setting up Gamescope compositor...${NC}"
    
    if command -v gamescope >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Gamescope is available${NC}"
        
        # Build gamescope command
        GAMESCOPE_CMD="gamescope"
        GAMESCOPE_CMD="$GAMESCOPE_CMD -W $GAMESCOPE_WIDTH -H $GAMESCOPE_HEIGHT"
        GAMESCOPE_CMD="$GAMESCOPE_CMD -r $GAMESCOPE_REFRESH"
        
        if [ "$GAMESCOPE_FULLSCREEN" = "true" ]; then
            GAMESCOPE_CMD="$GAMESCOPE_CMD -f"
        fi
        
        if [ "$GAMESCOPE_UPSCALER" != "auto" ]; then
            GAMESCOPE_CMD="$GAMESCOPE_CMD -U $GAMESCOPE_UPSCALER"
        fi
        
        export GAMESCOPE_CMD
        echo "  Gamescope command: $GAMESCOPE_CMD"
    else
        echo -e "${YELLOW}⚠ Gamescope not found, disabling${NC}"
        export USE_GAMESCOPE="false"
    fi
fi

#######################################################
# Moonlight Streaming Setup
#######################################################

if [ "$ENABLE_MOONLIGHT" = "true" ]; then
    echo -e "${BLUE}Setting up Moonlight streaming...${NC}"
    
    # Check if Wolf/Moonlight binary is available
    if [ -f "/wolf/wolf" ] || command -v wolf >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Moonlight server is available${NC}"
        
        # Set up Wolf configuration directory
        export WOLF_CFG_FOLDER="${WOLF_CFG_FOLDER:-/etc/wolf/cfg}"
        mkdir -p "$WOLF_CFG_FOLDER"
        
        # Wolf environment variables
        export WOLF_LOG_LEVEL="${WOLF_LOG_LEVEL:-INFO}"
        export WOLF_RENDER_NODE="${WOLF_RENDER_NODE:-/dev/dri/renderD128}"
        
        echo "  Moonlight ports: 47984 (HTTPS), 47989 (HTTP), 47999 (Control), 48010 (RTSP)"
        echo "  Wolf configuration: $WOLF_CFG_FOLDER"
    else
        echo -e "${YELLOW}⚠ Moonlight server not found, streaming disabled${NC}"
        export ENABLE_MOONLIGHT="false"
    fi
fi

#######################################################
# Launch Command
#######################################################

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Base Runner Ready${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# If command provided, execute it as the game user
if [ "$#" -gt 0 ]; then
    echo -e "${BLUE}Executing command: $@${NC}"
    echo ""
    exec gosu $UNAME "$@"
else
    # No command provided, drop to shell
    echo -e "${BLUE}No command provided, starting shell...${NC}"
    echo ""
    exec gosu $UNAME /bin/bash
fi
