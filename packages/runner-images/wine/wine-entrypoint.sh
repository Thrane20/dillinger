#!/bin/bash
# Dillinger Wine Game Runner - Entrypoint Wrapper
# Calls base entrypoint first, then sets up Wine environment
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Wine Runner - Initializing...${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

#######################################################
# Optional: xrandr display resolution switching
#######################################################

# When XRANDR_MODE is set (e.g. "1920x1080"), attempt to change the host display
# resolution before launching the game, then restore the original mode on exit.
#
# IMPORTANT: This affects the *host* X11 display (because we connect to host X).
# Therefore it's crucial to restore the original mode when the container exits
# or is stopped.

XRANDR_MODE="${XRANDR_MODE:-}"
XRANDR_OUTPUT="${XRANDR_OUTPUT:-}"

ORIG_XRANDR_OUTPUT=""
ORIG_XRANDR_MODE=""
CHILD_PID=""

detect_xrandr_output() {
    if [ -n "$XRANDR_OUTPUT" ]; then
        echo "$XRANDR_OUTPUT"
        return 0
    fi

    # Prefer primary output; otherwise take first connected output.
    xrandr --query 2>/dev/null | awk '
        / connected primary/ { print $1; exit }
        / connected/ { print $1; exit }
    '
}

detect_current_mode_for_output() {
    # Prints the currently active mode (the one with a '*') for the given output.
    local out="$1"
    xrandr --query 2>/dev/null | awk -v out="$out" '
        $1 == out { found=1; next }
        found && $1 ~ /^[0-9]+x[0-9]+$/ && $0 ~ /\*/ { print $1; exit }
        found && NF==0 { exit }
    '
}

apply_xrandr_mode() {
    if [ -z "$XRANDR_MODE" ]; then
        return 0
    fi
    if ! command -v xrandr >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠ XRANDR_MODE requested but xrandr not installed${NC}"
        return 0
    fi
    if [ -z "$DISPLAY" ]; then
        echo -e "${YELLOW}⚠ XRANDR_MODE requested but DISPLAY is not set${NC}"
        return 0
    fi

    echo -e "${BLUE}Attempting to set display resolution via xrandr...${NC}"
    echo "  DISPLAY=$DISPLAY"
    
    # List available modes for debugging
    echo "  Available outputs and modes:"
    xrandr --query 2>&1 | head -30 | while read line; do
        echo "    $line"
    done
    
    local out
    out="$(detect_xrandr_output)"
    if [ -z "$out" ]; then
        echo -e "${YELLOW}⚠ XRANDR_MODE requested but no connected outputs were detected${NC}"
        echo "  This may happen if:"
        echo "    - The container doesn't have access to the host X11 display"
        echo "    - The display output name doesn't match expected patterns"
        echo "    - xrandr can't query the display (permission issue)"
        return 0
    fi

    local current
    current="$(detect_current_mode_for_output "$out")"

    ORIG_XRANDR_OUTPUT="$out"
    ORIG_XRANDR_MODE="$current"

    echo "  Output: $out"
    if [ -n "$current" ]; then
        echo "  Current: $current"
    else
        echo "  Current: <unknown>"
    fi
    echo "  Target:  $XRANDR_MODE"
    
    # Check if the requested mode is available
    if ! xrandr --query 2>/dev/null | grep -q "$XRANDR_MODE"; then
        echo -e "${YELLOW}⚠ Mode $XRANDR_MODE may not be available. Available modes:${NC}"
        xrandr --query 2>/dev/null | grep -E "^\s+[0-9]+x[0-9]+" | head -10
    fi

    local xrandr_output
    if xrandr_output=$(xrandr --output "$out" --mode "$XRANDR_MODE" 2>&1); then
        echo -e "${GREEN}✓ Display resolution set to $XRANDR_MODE${NC}"
    else
        echo -e "${YELLOW}⚠ Failed to set resolution to $XRANDR_MODE${NC}"
        echo "  xrandr error: $xrandr_output"
        # If we couldn't set it, don't attempt restore (we didn't change it).
        ORIG_XRANDR_OUTPUT=""
        ORIG_XRANDR_MODE=""
    fi
    echo ""
}

restore_xrandr_mode() {
    if [ -z "$ORIG_XRANDR_OUTPUT" ] || [ -z "$ORIG_XRANDR_MODE" ]; then
        return 0
    fi
    if ! command -v xrandr >/dev/null 2>&1; then
        return 0
    fi

    echo -e "${BLUE}Restoring original display resolution...${NC}"
    echo "  Output: $ORIG_XRANDR_OUTPUT"
    echo "  Mode:   $ORIG_XRANDR_MODE"
    xrandr --output "$ORIG_XRANDR_OUTPUT" --mode "$ORIG_XRANDR_MODE" >/dev/null 2>&1 || true
    echo -e "${GREEN}✓ Display resolution restored${NC}"
    echo ""

    ORIG_XRANDR_OUTPUT=""
    ORIG_XRANDR_MODE=""
}

on_term() {
    echo -e "${YELLOW}Received termination signal; stopping game and restoring display...${NC}"
    if [ -n "$CHILD_PID" ]; then
        kill -TERM "$CHILD_PID" 2>/dev/null || true
        # Give the child a moment to exit cleanly
        sleep 1 || true
        kill -KILL "$CHILD_PID" 2>/dev/null || true
    fi
    restore_xrandr_mode
    exit 143
}

trap on_term TERM INT HUP QUIT
trap restore_xrandr_mode EXIT

# Source the base entrypoint setup functions but don't execute final command
# The base entrypoint expects to be executed, not sourced, so we need to handle this carefully

# Set up basic environment variables that base entrypoint would set
UNAME="${UNAME:-gameuser}"
PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

# Export display and audio variables if they exist
export DISPLAY="${DISPLAY:-:0}"
export PULSE_SERVER="${PULSE_SERVER:-unix:/run/user/1000/pulse/native}"

# Set up PulseAudio cookie path
# The cookie might be mounted from host, or might be a mis-created directory
PULSE_COOKIE_PATH="/home/${UNAME}/.config/pulse/cookie"
if [ -d "$PULSE_COOKIE_PATH" ] && ! mountpoint -q "$PULSE_COOKIE_PATH" 2>/dev/null; then
    # It's a directory but not a mount point - safe to remove
    rm -rf "$PULSE_COOKIE_PATH" 2>/dev/null || true
fi
# Only create if it doesn't exist (don't mess with mounted files/dirs)
if [ ! -e "$PULSE_COOKIE_PATH" ]; then
    mkdir -p "$(dirname "$PULSE_COOKIE_PATH")" 2>/dev/null || true
    touch "$PULSE_COOKIE_PATH" 2>/dev/null || true
fi
chown -R "${UNAME}:${UNAME}" "/home/${UNAME}/.config/pulse" 2>/dev/null || true
export PULSE_COOKIE="$PULSE_COOKIE_PATH"

# Set XAUTHORITY if xauth file is mounted
if [ -f "/home/${UNAME}/.Xauthority" ]; then
    export XAUTHORITY="/home/${UNAME}/.Xauthority"
fi

echo -e "${GREEN}Display configured: ${DISPLAY}${NC}"
if [ -n "$XAUTHORITY" ]; then
    echo -e "${GREEN}X11 auth configured: ${XAUTHORITY}${NC}"
fi
echo ""

#######################################################
# Installation Context (from Docker environment)
#######################################################
echo -e "${BLUE}Installation Context:${NC}"
if [ -n "$INSTALLER_PATH" ]; then
    echo -e "  INSTALLER_PATH: $INSTALLER_PATH"
    if [ -e "$INSTALLER_PATH" ]; then
        echo -e "    ✓ File exists"
        ls -la "$INSTALLER_PATH" 2>/dev/null || true
        file "$INSTALLER_PATH" 2>/dev/null || true
    else
        echo -e "    ${RED}✗ File NOT FOUND!${NC}"
    fi
else
    echo -e "  INSTALLER_PATH: (not set)"
fi
if [ -n "$INSTALL_TARGET" ]; then
    echo -e "  INSTALL_TARGET: $INSTALL_TARGET"
else
    echo -e "  INSTALL_TARGET: (not set)"
fi
if [ -n "$INSTALLER_ARGS" ]; then
    echo -e "  INSTALLER_ARGS: $INSTALLER_ARGS"
fi
echo ""

#######################################################
# Wine-Specific Setup
#######################################################

echo -e "${BLUE}Configuring Wine environment...${NC}"

#######################################################
# Wine Version Selection
# 
# Environment Variables:
#   WINE_VERSION_ID - ID of the Wine version to use (e.g., "system", "ge-proton-10-27")
#   WINE_VERSION_PATH - Direct path to Wine installation (overrides WINE_VERSION_ID)
#   WINE_VERSIONS_DIR - Directory containing installed Wine versions (default: /data/storage/wine-versions)
#   UMU_GAME_ID - UMU Game ID for protonfixes (used with GE-Proton)
#   GAME_SLUG - Game slug fallback for UMU_GAME_ID
#######################################################

# Wine versions storage
WINE_VERSIONS_DIR="${WINE_VERSIONS_DIR:-/data/storage/wine-versions}"
WINE_VERSION_ID="${WINE_VERSION_ID:-system}"
WINE_VERSION_PATH="${WINE_VERSION_PATH:-}"

# Function to select Wine binary based on version
select_wine_version() {
    local version_id="$1"
    local version_path="$2"
    
    # If direct path is provided, use it
    if [ -n "$version_path" ] && [ -d "$version_path" ]; then
        echo -e "${BLUE}Using Wine version from path: ${version_path}${NC}"
        export WINE_BINARY="${version_path}/bin/wine"
        export WINE64_BINARY="${version_path}/bin/wine64"
        export WINESERVER_BINARY="${version_path}/bin/wineserver"
        export PROTON_PATH="$version_path"
        return 0
    fi
    
    # System Wine (default)
    if [ "$version_id" = "system" ]; then
        echo -e "${BLUE}Using System Wine (built-in)${NC}"
        export WINE_BINARY="wine"
        export WINE64_BINARY="wine64"
        export WINESERVER_BINARY="wineserver"
        export PROTON_PATH=""
        return 0
    fi
    
    # Check for installed version in versions directory
    local installed_path="${WINE_VERSIONS_DIR}/${version_id}"
    
    if [ -d "$installed_path" ]; then
        echo -e "${BLUE}Using installed Wine version: ${version_id}${NC}"
        echo "  Path: ${installed_path}"
        
        # Detect if this is a GE-Proton version
        if [[ "$version_id" == ge-proton* ]]; then
            # GE-Proton structure
            export WINE_BINARY="${installed_path}/files/bin/wine"
            export WINE64_BINARY="${installed_path}/files/bin/wine64"
            export WINESERVER_BINARY="${installed_path}/files/bin/wineserver"
            export PROTON_PATH="$installed_path"
            export USE_UMU="true"
        else
            # Standard Wine structure
            export WINE_BINARY="${installed_path}/bin/wine"
            export WINE64_BINARY="${installed_path}/bin/wine64"
            export WINESERVER_BINARY="${installed_path}/bin/wineserver"
            export PROTON_PATH=""
        fi
        return 0
    fi
    
    # Version not found, fall back to system
    echo -e "${YELLOW}⚠ Wine version '${version_id}' not found, falling back to System Wine${NC}"
    export WINE_BINARY="wine"
    export WINE64_BINARY="wine64"
    export WINESERVER_BINARY="wineserver"
    export PROTON_PATH=""
    return 1
}

# Select Wine version
select_wine_version "$WINE_VERSION_ID" "$WINE_VERSION_PATH"

# Display selected version
if [ -n "$PROTON_PATH" ]; then
    echo "  Wine type: GE-Proton"
    echo "  Proton path: $PROTON_PATH"
    if [ -x "$WINE_BINARY" ]; then
        WINE_VER=$("$WINE_BINARY" --version 2>/dev/null || echo "unknown")
        echo "  Wine version: $WINE_VER"
    fi
else
    echo "  Wine type: System"
    WINE_VER=$(wine --version 2>/dev/null || echo "unknown")
    echo "  Wine version: $WINE_VER"
fi

#######################################################
# UMU Launcher Configuration (for GE-Proton)
# https://github.com/Open-Wine-Components/umu-launcher
#######################################################

USE_UMU="${USE_UMU:-false}"
UMU_GAME_ID="${UMU_GAME_ID:-}"
GAME_SLUG="${GAME_SLUG:-}"

# Configure UMU if using GE-Proton
if [ "$USE_UMU" = "true" ] && command -v umu-run &> /dev/null; then
    echo -e "${BLUE}Configuring UMU Launcher for GE-Proton...${NC}"
    
    # Set UMU Game ID (for protonfixes)
    if [ -z "$UMU_GAME_ID" ] && [ -n "$GAME_SLUG" ]; then
        UMU_GAME_ID="umu-${GAME_SLUG}"
    fi
    
    if [ -n "$UMU_GAME_ID" ]; then
        export GAMEID="$UMU_GAME_ID"
        echo "  UMU Game ID: $GAMEID"
    else
        export GAMEID="0"
        echo "  UMU Game ID: 0 (no protonfixes)"
    fi
    
    # Set Proton path for UMU
    export PROTONPATH="$PROTON_PATH"
    echo "  Proton path: $PROTONPATH"
    
    # Configure UMU data directories
    # Store UMU runtime in dillinger_root for persistence across containers
    # IMPORTANT: We use /data/storage as XDG_DATA_HOME so UMU puts its data at /data/storage/umu
    # This avoids symlinks which don't work inside pressure-vessel (Steam Runtime container)
    UMU_DATA_DIR="/data/storage/umu"
    mkdir -p "$UMU_DATA_DIR"
    
    # CRITICAL: Ensure UMU directory is owned by gameuser
    # The Steam Runtime creates files that UMU needs to write to (lock files, shims)
    chown -R gameuser:gameuser "$UMU_DATA_DIR" 2>/dev/null || true
    
    # Set XDG_DATA_HOME to /data/storage so UMU uses /data/storage/umu directly
    # This path is accessible from both the host container and pressure-vessel
    export XDG_DATA_HOME="/data/storage"
    export XDG_CACHE_HOME="/home/gameuser/.cache"
    export HOME="/home/gameuser"
    
    # Create cache directory
    mkdir -p /home/gameuser/.cache
    chown -R gameuser:gameuser /home/gameuser/.cache 2>/dev/null || true
    
    # Check if Steam Runtime needs to be downloaded (first run)
    if [ ! -f "$UMU_DATA_DIR/steamrt3/toolmanifest.vdf" ]; then
        echo -e "${BLUE}Downloading Steam Runtime for UMU (first run)...${NC}"
        echo "  This may take several minutes (~500MB download)..."
        
        # Bootstrap using Python to call setup_umu directly
        # This bypasses the bug in umu-run where resolve_runtime is called before setup_umu
        python3 << 'PYEOF'
import os
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from urllib3 import PoolManager, Timeout
from urllib3.util.retry import Retry

os.environ['HOME'] = '/home/gameuser'
os.environ['XDG_DATA_HOME'] = '/data/storage'

from umu.umu_runtime import setup_umu, RUNTIME_VERSIONS

# Get steamrt3/sniper runtime info (required by GE-Proton)
runtime_info = RUNTIME_VERSIONS['1628350']
runtime_version = runtime_info.as_tuple()
print(f"  Runtime: {runtime_version[0]} ({runtime_version[1]})")

local = Path('/data/storage/umu') / runtime_version[1]
local.mkdir(parents=True, exist_ok=True)

thread_pool = ThreadPoolExecutor()
http_pool = PoolManager(
    timeout=Timeout(connect=60.0, read=120.0),
    retries=Retry(total=3, redirect=True),
)

try:
    with thread_pool, http_pool:
        session_pools = (thread_pool, http_pool)
        setup_umu(local, runtime_version, session_pools)
    print("  Runtime download complete!")
except Exception as e:
    print(f"  Runtime download failed: {e}")
    exit(1)
PYEOF
        
        if [ $? -eq 0 ] && [ -f "$UMU_DATA_DIR/steamrt3/toolmanifest.vdf" ]; then
            # CRITICAL: Fix ownership of downloaded files so gameuser can write lock files/shims
            chown -R gameuser:gameuser "$UMU_DATA_DIR" 2>/dev/null || true
            echo -e "${GREEN}✓ Steam Runtime downloaded successfully${NC}"
        else
            echo -e "${YELLOW}⚠ Steam Runtime download failed, falling back to direct Wine${NC}"
            USE_UMU="false"
        fi
    else
        echo "  Steam Runtime already available"
        # Ensure ownership is correct even for existing runtime
        chown -R gameuser:gameuser "$UMU_DATA_DIR" 2>/dev/null || true
    fi
    
    # Verify UMU is working
    if [ "$USE_UMU" = "true" ] && [ -f "$UMU_DATA_DIR/steamrt3/toolmanifest.vdf" ]; then
        # UMU-specific wrapper function
        umu_wine() {
            umu-run "$@"
        }
        
        # Override wine commands to use UMU
        wine() {
            umu-run "$@"
        }
        
        export -f wine umu_wine
        echo -e "${GREEN}✓ UMU Launcher configured${NC}"
    elif [ "$USE_UMU" = "true" ]; then
        echo -e "${YELLOW}⚠ UMU Steam Runtime not available, using GE-Proton directly${NC}"
        USE_UMU="false"
        
        # Set up direct GE-Proton wine binaries
        if [ -x "$WINE_BINARY" ]; then
            echo "  Using GE-Proton Wine directly: $WINE_BINARY"
            wine() {
                "$WINE_BINARY" "$@"
            }
            export -f wine
        else
            echo -e "${YELLOW}⚠ GE-Proton wine binary not found, falling back to system Wine${NC}"
            export WINE_BINARY="wine"
        fi
    fi
elif [ "$USE_UMU" = "true" ]; then
    echo -e "${YELLOW}⚠ UMU requested but umu-run not found, using standard Wine${NC}"
    USE_UMU="false"
fi

echo ""

# Set Wine defaults if not already set
WINEPREFIX="${WINEPREFIX:-/wineprefix}"
WINEDEBUG="${WINEDEBUG:--all}"

export WINEPREFIX
export WINEDEBUG
export WINE_LARGE_ADDRESS_AWARE="${WINE_LARGE_ADDRESS_AWARE:-1}"

# Check if Wine is running in WoW64 mode (Wine 9.x+ default)
# In WoW64 mode, WINEARCH is ignored and Wine can run both 32-bit and 64-bit apps
WINE_WOW64_MODE="false"
if command -v wine64 >/dev/null 2>&1; then
    # Wine 9.x+ with WoW64: wine64 exists and is the default
    WINE_VERSION_OUTPUT=$($WINE_BINARY --version 2>/dev/null || echo "")
    if echo "$WINE_VERSION_OUTPUT" | grep -qE "wine-[89]\.|wine-[1-9][0-9]"; then
        WINE_WOW64_MODE="true"
    fi
fi

# Handle WINEARCH for prefix creation
# In WoW64 mode (Wine 9.x+), WINEARCH is not supported - Wine handles both 32-bit and 64-bit natively
if [ "$WINE_WOW64_MODE" = "true" ]; then
    if [ -n "$WINEARCH" ] && [ "$WINEARCH" = "win32" ]; then
        echo -e "${YELLOW}⚠ WINEARCH=win32 requested but Wine is running in WoW64 mode${NC}"
        echo -e "${YELLOW}  WoW64 mode (Wine 9.x+) handles 32-bit apps natively - no separate prefix needed${NC}"
        echo -e "${YELLOW}  Ignoring WINEARCH setting...${NC}"
    fi
    # Don't export WINEARCH in WoW64 mode - it will cause errors
    unset WINEARCH
    echo "  Wine Mode: WoW64 (handles both 32-bit and 64-bit apps)"
else
    # Legacy Wine without WoW64 - use WINEARCH as specified
    WINEARCH="${WINEARCH:-win64}"
    export WINEARCH
    echo "  Wine Architecture: $WINEARCH"
fi

echo "  Wine Prefix: $WINEPREFIX"
echo "  Wine Debug: $WINEDEBUG"

# Ensure prefix directory exists and is owned by the runtime user.
# When /wineprefix is a bind mount, build-time ownership in the image does not apply.
if [ ! -d "$WINEPREFIX" ]; then
    mkdir -p "$WINEPREFIX" || true
fi

# Ensure INSTALL_TARGET directory exists (used by Lutris installers for $INSTALL substitution)
# Default to /install if not set
INSTALL_TARGET="${INSTALL_TARGET:-/install}"
export INSTALL_TARGET
if [ ! -d "$INSTALL_TARGET" ]; then
    echo "  Creating install target directory: $INSTALL_TARGET"
    mkdir -p "$INSTALL_TARGET" || true
fi

# Best-effort ownership fix: requires entrypoint to run as root.
if [ "$(id -u)" = "0" ]; then
    if [ -n "$PUID" ] && [ -n "$PGID" ]; then
        chown -R "$PUID:$PGID" "$WINEPREFIX" 2>/dev/null || true
        chown -R "$PUID:$PGID" "$INSTALL_TARGET" 2>/dev/null || true
    else
        chown -R "${UNAME:-gameuser}:${UNAME:-gameuser}" "$WINEPREFIX" 2>/dev/null || true
        chown -R "${UNAME:-gameuser}:${UNAME:-gameuser}" "$INSTALL_TARGET" 2>/dev/null || true
    fi
fi

if [ -e "$WINEPREFIX" ]; then
    PREFIX_OWNER_UID=$(stat -c "%u" "$WINEPREFIX" 2>/dev/null || echo "?")
    PREFIX_OWNER_GID=$(stat -c "%g" "$WINEPREFIX" 2>/dev/null || echo "?")
    CURRENT_UID=$(id -u)
    TARGET_UID="${PUID:-1000}"
    
    # Note: entrypoint runs as root for setup, but gosu switches to gameuser (PUID) for Wine
    if [ "$PREFIX_OWNER_UID" != "?" ] && [ "$PREFIX_OWNER_UID" != "$TARGET_UID" ]; then
        echo -e "${YELLOW}⚠ Wine prefix owned by uid=${PREFIX_OWNER_UID}:${PREFIX_OWNER_GID}, gameuser is uid=${TARGET_UID}${NC}"
        
        # Try to fix ownership if running as root
        if [ "$CURRENT_UID" = "0" ]; then
            echo -e "${BLUE}  Attempting to fix Wine prefix ownership...${NC}"
            if chown -R "$TARGET_UID:${PGID:-1000}" "$WINEPREFIX" 2>/dev/null; then
                echo -e "${GREEN}  ✓ Wine prefix ownership fixed to ${TARGET_UID}:${PGID:-1000}${NC}"
            else
                echo -e "${YELLOW}  ⚠ Could not fix ownership - Wine may fail if prefix is not accessible${NC}"
            fi
        else
            echo -e "${YELLOW}  Tip: ensure the host prefix dir is owned by uid=${TARGET_UID} gid=${PGID:-1000}${NC}"
        fi
    fi
fi

# Initialize Wine prefix if it doesn't exist
if [ ! -d "$WINEPREFIX/drive_c" ]; then
    echo ""
    echo -e "${YELLOW}Initializing Wine prefix (first run)...${NC}"
    echo -e "${YELLOW}This may take a minute...${NC}"
    
    # Run wineboot as the game user
    gosu ${UNAME:-gameuser} wineboot --init 2>&1 | head -20 || true
    
    # Wait for wineserver to finish
    gosu ${UNAME:-gameuser} wineserver -w || true
    
    echo -e "${GREEN}✓ Wine prefix initialized${NC}"
else
    echo -e "${GREEN}✓ Wine prefix already exists${NC}"
fi

# Configure Wine registry for gaming optimizations
echo -e "${BLUE}Applying Wine gaming optimizations...${NC}"

# Allow per-game override of the Direct3D renderer.
# Supported values: 
#   - "opengl" (default, most compatible, best for old games)
#   - "vulkan" (WineD3D Vulkan backend - newer but buggy, NOT the same as DXVK)
#   - "gdi" (software rendering, slowest but most compatible for ancient games)
#
# NOTE: For DirectX 9/10/11 games that need performance, use DXVK instead
#       (set INSTALL_DXVK=true). DXVK replaces the DLLs entirely and bypasses
#       this WineD3D renderer setting.
#
# For DirectDraw games (like Commandos, 1998), use "opengl" - these games
# predate Direct3D and neither DXVK nor WineD3D-Vulkan handles them well.
WINE_D3D_RENDERER="${WINE_D3D_RENDERER:-opengl}"
if [ "$WINE_D3D_RENDERER" != "vulkan" ] && [ "$WINE_D3D_RENDERER" != "opengl" ] && [ "$WINE_D3D_RENDERER" != "gdi" ]; then
    echo -e "${YELLOW}⚠ Invalid WINE_D3D_RENDERER='$WINE_D3D_RENDERER' (expected 'vulkan', 'opengl', or 'gdi'); defaulting to 'opengl'${NC}"
    WINE_D3D_RENDERER="opengl"
fi

# If Vulkan is requested but not available, fall back to OpenGL.
# This prevents hard crashes during device enumeration.
if [ "$WINE_D3D_RENDERER" = "vulkan" ]; then
    if [ ! -c /dev/dri/renderD128 ] && [ ! -c /dev/dri/renderD129 ] && [ ! -c /dev/dri/renderD130 ]; then
        echo -e "${YELLOW}⚠ Vulkan requested but no /dev/dri/renderD* device found; falling back to OpenGL${NC}"
        WINE_D3D_RENDERER="opengl"
    else
        echo -e "${YELLOW}⚠ WineD3D Vulkan backend selected. This is experimental and may cause black screens.${NC}"
        echo -e "${YELLOW}  For DirectX 9/10/11 games, consider using DXVK instead (enable in game settings).${NC}"
        echo -e "${YELLOW}  For old DirectDraw games, switch to 'opengl' renderer.${NC}"
    fi
fi

echo "  Direct3D renderer: $WINE_D3D_RENDERER"
gosu ${UNAME:-gameuser} wine reg add "HKCU\\Software\\Wine\\Direct3D" /v "renderer" /t REG_SZ /d "$WINE_D3D_RENDERER" /f 2>/dev/null || true
gosu ${UNAME:-gameuser} wine reg add "HKCU\\Software\\Wine\\DirectSound" /v "DefaultSampleRate" /t REG_DWORD /d 44100 /f 2>/dev/null || true

# Apply Wine virtual desktop if specified via WINE_VIRTUAL_DESKTOP environment variable
# Format: "WIDTHxHEIGHT" (e.g., "1920x1080")
if [ -n "$WINE_VIRTUAL_DESKTOP" ]; then
    echo -e "${BLUE}Configuring Wine virtual desktop: ${WINE_VIRTUAL_DESKTOP}${NC}"
    # Enable virtual desktop
    gosu ${UNAME:-gameuser} wine reg add "HKCU\\Software\\Wine\\Explorer" /v "Desktop" /t REG_SZ /d "Default" /f 2>/dev/null || true
    gosu ${UNAME:-gameuser} wine reg add "HKCU\\Software\\Wine\\Explorer\\Desktops" /v "Default" /t REG_SZ /d "$WINE_VIRTUAL_DESKTOP" /f 2>/dev/null || true
    # Improve input handling for virtual desktop
    echo -e "  Configuring input capture for virtual desktop..."
    gosu ${UNAME:-gameuser} wine reg add "HKCU\\Software\\Wine\\X11 Driver" /v "Managed" /t REG_SZ /d "N" /f 2>/dev/null || true
    gosu ${UNAME:-gameuser} wine reg add "HKCU\\Software\\Wine\\X11 Driver" /v "GrabFullscreen" /t REG_SZ /d "Y" /f 2>/dev/null || true
    gosu ${UNAME:-gameuser} wine reg add "HKCU\\Software\\Wine\\X11 Driver" /v "UseTakeFocus" /t REG_SZ /d "N" /f 2>/dev/null || true
    gosu ${UNAME:-gameuser} wine reg add "HKCU\\Software\\Wine\\DirectInput" /v "MouseWarpOverride" /t REG_SZ /d "force" /f 2>/dev/null || true
    echo -e "${GREEN}✓ Wine virtual desktop configured${NC}"
fi

# Apply DLL overrides if specified via WINE_DLL_OVERRIDES environment variable
# Format: "dll1=mode1;dll2=mode2" (e.g., "ddraw=native;d3d9=native,builtin")
if [ -n "$WINE_DLL_OVERRIDES" ]; then
    echo -e "${BLUE}Applying DLL overrides: ${WINE_DLL_OVERRIDES}${NC}"
    IFS=';' read -ra OVERRIDES <<< "$WINE_DLL_OVERRIDES"
    for override in "${OVERRIDES[@]}"; do
        if [ -n "$override" ]; then
            dll=$(echo "$override" | cut -d'=' -f1 | xargs)
            mode=$(echo "$override" | cut -d'=' -f2 | xargs)
            if [ -n "$dll" ] && [ -n "$mode" ]; then
                echo -e "  Setting ${dll} = ${mode}"
                gosu ${UNAME:-gameuser} wine reg add "HKCU\\Software\\Wine\\DllOverrides" /v "$dll" /t REG_SZ /d "$mode" /f 2>/dev/null || true
            fi
        fi
    done
fi

# Apply Windows compatibility mode if specified via WINE_COMPAT_MODE
# Options: win98, winxp, win7, win10, legacy (optimized for old games)
if [ -n "$WINE_COMPAT_MODE" ] && [ "$WINE_COMPAT_MODE" != "none" ]; then
    echo -e "${BLUE}Applying Windows compatibility mode: ${WINE_COMPAT_MODE}${NC}"
    
    case "$WINE_COMPAT_MODE" in
        legacy)
            # Optimized for games from 1995-2000 (DirectDraw era)
            echo -e "  Configuring for legacy games (DirectDraw, Win98 era)..."
            gosu ${UNAME:-gameuser} wine reg add "HKCU\\Software\\Wine\\DllOverrides" /v "ddraw" /t REG_SZ /d "native,builtin" /f 2>/dev/null || true
            gosu ${UNAME:-gameuser} wine reg add "HKCU\\Software\\Wine\\DllOverrides" /v "dsound" /t REG_SZ /d "native,builtin" /f 2>/dev/null || true
            gosu ${UNAME:-gameuser} wine reg add "HKCU\\Software\\Wine\\Direct3D" /v "DirectDrawRenderer" /t REG_SZ /d "opengl" /f 2>/dev/null || true
            gosu ${UNAME:-gameuser} wine reg add "HKCU\\Software\\Wine\\Version" /v "Windows" /t REG_SZ /d "win98" /f 2>/dev/null || true
            ;;
        win98)
            echo -e "  Setting Windows 98 compatibility..."
            gosu ${UNAME:-gameuser} wine reg add "HKCU\\Software\\Wine\\Version" /v "Windows" /t REG_SZ /d "win98" /f 2>/dev/null || true
            ;;
        winxp)
            echo -e "  Setting Windows XP compatibility..."
            gosu ${UNAME:-gameuser} wine reg add "HKCU\\Software\\Wine\\Version" /v "Windows" /t REG_SZ /d "winxp" /f 2>/dev/null || true
            ;;
        win7)
            echo -e "  Setting Windows 7 compatibility..."
            gosu ${UNAME:-gameuser} wine reg add "HKCU\\Software\\Wine\\Version" /v "Windows" /t REG_SZ /d "win7" /f 2>/dev/null || true
            ;;
        win10)
            echo -e "  Setting Windows 10 compatibility..."
            gosu ${UNAME:-gameuser} wine reg add "HKCU\\Software\\Wine\\Version" /v "Windows" /t REG_SZ /d "win10" /f 2>/dev/null || true
            ;;
    esac
fi

# Apply WINEDLLOVERRIDES environment variable if specified
# This sets the environment variable for Wine to use DLL overrides without touching registry
# Format: "dll1=mode1;dll2=mode2" (e.g., "quartz=disabled;wmvcore=disabled")
# This is different from WINE_DLL_OVERRIDES which sets registry values
# WINEDLLOVERRIDES is the official Wine environment variable for runtime DLL configuration
if [ -n "$WINEDLLOVERRIDES" ]; then
    echo -e "${BLUE}Using WINEDLLOVERRIDES: ${WINEDLLOVERRIDES}${NC}"
    export WINEDLLOVERRIDES
fi

#######################################################
# Lutris Script Execution Support
# These environment variables allow executing Lutris
# installer script operations during installation
#######################################################

# LUTRIS_EXTRACT_STEPS - Extract archives
# Format: JSON array of { src, dst, format? }
# format can be: "innoextract", "7z", "zip", "tar", or auto-detect
if [ -n "$LUTRIS_EXTRACT_STEPS" ] && command -v python3 >/dev/null 2>&1; then
    echo -e "${BLUE}Executing Lutris extract steps...${NC}"
    python3 << 'PYEOF'
import json
import subprocess
import os

steps = json.loads(os.environ.get('LUTRIS_EXTRACT_STEPS', '[]'))
user = os.environ.get('UNAME', 'gameuser')
gamedir = os.environ.get('WINEPREFIX', '/wineprefix')
install_target = os.environ.get('INSTALL_TARGET', '/install')
cache = '/tmp/lutris_cache'

# Ensure cache directory exists
os.makedirs(cache, exist_ok=True)

for step in steps:
    src = step.get('src', '')
    dst = step.get('dst', '')
    fmt = step.get('format', 'auto')
    
    # Variable substitution
    src = src.replace('$GAMEDIR', gamedir).replace('$CACHE', cache).replace('$INSTALL', install_target)
    dst = dst.replace('$GAMEDIR', gamedir).replace('$CACHE', cache).replace('$INSTALL', install_target)
    
    if not src or not dst:
        continue
        
    print(f'  Extracting: {src} -> {dst}')
    
    # Create destination directory
    os.makedirs(dst, exist_ok=True)
    
    try:
        if fmt == 'innoextract':
            subprocess.run(['innoextract', '-d', dst, src], check=True, capture_output=True)
        elif fmt == '7z' or src.endswith('.7z'):
            subprocess.run(['7z', 'x', f'-o{dst}', src, '-y'], check=True, capture_output=True)
        elif fmt == 'zip' or src.endswith('.zip'):
            subprocess.run(['unzip', '-o', src, '-d', dst], check=True, capture_output=True)
        elif fmt == 'tar' or any(src.endswith(ext) for ext in ['.tar', '.tar.gz', '.tgz', '.tar.bz2', '.tar.xz']):
            subprocess.run(['tar', '-xf', src, '-C', dst], check=True, capture_output=True)
        else:
            # Auto-detect format
            if '.exe' in src.lower() or 'setup' in src.lower():
                # Likely an Inno Setup installer
                subprocess.run(['innoextract', '-d', dst, src], check=True, capture_output=True)
            else:
                # Try 7z as fallback (handles most formats)
                subprocess.run(['7z', 'x', f'-o{dst}', src, '-y'], check=True, capture_output=True)
        print(f'    ✓ Extracted successfully')
    except subprocess.CalledProcessError as e:
        print(f'    ✗ Extract failed: {e}')
    except Exception as e:
        print(f'    ✗ Error: {e}')
PYEOF
    echo -e "${GREEN}✓ Lutris extract steps complete${NC}"
fi

# LUTRIS_MOVE_STEPS - Move or merge files/directories
# Format: JSON array of { src, dst, operation? }
# operation can be: "move", "merge" (copy), "rename"
if [ -n "$LUTRIS_MOVE_STEPS" ] && command -v python3 >/dev/null 2>&1; then
    echo -e "${BLUE}Executing Lutris move/merge steps...${NC}"
    python3 << 'PYEOF'
import json
import shutil
import os

steps = json.loads(os.environ.get('LUTRIS_MOVE_STEPS', '[]'))
gamedir = os.environ.get('WINEPREFIX', '/wineprefix')
install_target = os.environ.get('INSTALL_TARGET', '/install')
cache = '/tmp/lutris_cache'

for step in steps:
    src = step.get('src', '')
    dst = step.get('dst', '')
    op = step.get('operation', 'move')
    
    # Variable substitution
    src = src.replace('$GAMEDIR', gamedir).replace('$CACHE', cache).replace('$INSTALL', install_target)
    dst = dst.replace('$GAMEDIR', gamedir).replace('$CACHE', cache).replace('$INSTALL', install_target)
    
    if not src or not dst:
        continue
        
    print(f'  {op.capitalize()}: {src} -> {dst}')
    
    try:
        # Create parent directory
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        
        if op == 'move' or op == 'rename':
            shutil.move(src, dst)
        elif op == 'merge':
            if os.path.isdir(src):
                shutil.copytree(src, dst, dirs_exist_ok=True)
            else:
                shutil.copy2(src, dst)
        print(f'    ✓ {op.capitalize()} successful')
    except Exception as e:
        print(f'    ✗ Error: {e}')
PYEOF
    echo -e "${GREEN}✓ Lutris move/merge steps complete${NC}"
fi

# LUTRIS_EXECUTE_STEPS - Execute shell commands
# Format: JSON array of { command?, file?, args?, description? }
if [ -n "$LUTRIS_EXECUTE_STEPS" ] && command -v python3 >/dev/null 2>&1; then
    echo -e "${BLUE}Executing Lutris shell commands...${NC}"
    python3 << 'PYEOF'
import json
import subprocess
import os

steps = json.loads(os.environ.get('LUTRIS_EXECUTE_STEPS', '[]'))
user = os.environ.get('UNAME', 'gameuser')
gamedir = os.environ.get('WINEPREFIX', '/wineprefix')
install_target = os.environ.get('INSTALL_TARGET', '/install')
cache = '/tmp/lutris_cache'

for step in steps:
    command = step.get('command', '')
    file = step.get('file', '')
    args = step.get('args', '')
    desc = step.get('description', command or file)
    
    # Variable substitution
    command = command.replace('$GAMEDIR', gamedir).replace('$CACHE', cache).replace('$INSTALL', install_target)
    file = file.replace('$GAMEDIR', gamedir).replace('$CACHE', cache).replace('$INSTALL', install_target)
    args = args.replace('$GAMEDIR', gamedir).replace('$CACHE', cache).replace('$INSTALL', install_target)
    
    print(f'  Executing: {desc}')
    
    try:
        if command:
            subprocess.run(['gosu', user, 'bash', '-c', command], check=True)
        elif file:
            cmd = [file]
            if args:
                cmd.extend(args.split())
            subprocess.run(['gosu', user] + cmd, check=True)
        print(f'    ✓ Command successful')
    except subprocess.CalledProcessError as e:
        print(f'    ✗ Command failed with exit code: {e.returncode}')
    except Exception as e:
        print(f'    ✗ Error: {e}')
PYEOF
    echo -e "${GREEN}✓ Lutris shell commands complete${NC}"
fi

# LUTRIS_WINEEXEC_STEPS - Execute Windows programs via Wine
# Format: JSON array of { executable, args?, prefix?, arch?, blocking? }
if [ -n "$LUTRIS_WINEEXEC_STEPS" ] && command -v python3 >/dev/null 2>&1; then
    echo -e "${BLUE}Executing Lutris Wine commands...${NC}"
    python3 << 'PYEOF'
import json
import subprocess
import os

steps = json.loads(os.environ.get('LUTRIS_WINEEXEC_STEPS', '[]'))
user = os.environ.get('UNAME', 'gameuser')
gamedir = os.environ.get('WINEPREFIX', '/wineprefix')
install_target = os.environ.get('INSTALL_TARGET', '/install')
cache = '/tmp/lutris_cache'
wine_binary = os.environ.get('WINE_BINARY', 'wine')

for step in steps:
    executable = step.get('executable', '')
    args = step.get('args', '')
    prefix = step.get('prefix', gamedir)
    blocking = step.get('blocking', True)
    
    # Variable substitution
    executable = executable.replace('$GAMEDIR', gamedir).replace('$CACHE', cache).replace('$INSTALL', install_target)
    args = args.replace('$GAMEDIR', gamedir).replace('$CACHE', cache).replace('$INSTALL', install_target)
    
    if not executable:
        continue
        
    print(f'  Wine exec: {executable} {args}')
    
    try:
        env = os.environ.copy()
        env['WINEPREFIX'] = prefix
        
        cmd = ['gosu', user, wine_binary, executable]
        if args:
            cmd.extend(args.split())
        
        if blocking:
            subprocess.run(cmd, env=env, check=True)
        else:
            subprocess.Popen(cmd, env=env)
        print(f'    ✓ Wine exec successful')
    except subprocess.CalledProcessError as e:
        print(f'    ✗ Wine exec failed with exit code: {e.returncode}')
    except Exception as e:
        print(f'    ✗ Error: {e}')
PYEOF
    echo -e "${GREEN}✓ Lutris Wine commands complete${NC}"
fi

# Run winetricks verbs if specified via WINE_WINETRICKS environment variable
# Format: "verb1;verb2;verb3" (e.g., "vcrun2019;dxvk;d3dcompiler_47")
if [ -n "$WINE_WINETRICKS" ]; then
    echo -e "${BLUE}Running winetricks verbs: ${WINE_WINETRICKS}${NC}"
    IFS=';' read -ra VERBS <<< "$WINE_WINETRICKS"
    for verb in "${VERBS[@]}"; do
        if [ -n "$verb" ]; then
            verb=$(echo "$verb" | xargs) # Trim whitespace
            echo -e "  Installing winetricks verb: ${verb}"
            gosu ${UNAME:-gameuser} winetricks -q "$verb" 2>&1 | tail -10 || echo "  Warning: winetricks '$verb' may have failed"
        fi
    done
    echo -e "${GREEN}✓ Winetricks verbs processed${NC}"
fi

# Apply custom registry settings if specified via WINE_REGISTRY_SETTINGS
# Format: JSON array string: '[{"path":"HKCU\\Software\\MyGame","name":"NoVideos","type":"REG_DWORD","value":"0x0"}]'
if [ -n "$WINE_REGISTRY_SETTINGS" ]; then
    echo -e "${BLUE}Applying custom registry settings...${NC}"
    
    # Parse JSON array and apply each setting
    # Use python for reliable JSON parsing if available, otherwise try jq
    if command -v python3 >/dev/null 2>&1; then
        python3 -c "
import json
import sys
import subprocess
import os

settings = json.loads('''$WINE_REGISTRY_SETTINGS''')
user = os.environ.get('UNAME', 'gameuser')

for setting in settings:
    path = setting.get('path', '')
    name = setting.get('name', '')
    reg_type = setting.get('type', 'REG_SZ')
    value = setting.get('value', '')
    
    if path and name:
        # Convert path for Wine reg command (double backslashes)
        wine_path = path.replace('\\\\\\\\', '\\\\')
        
        # Map type to Wine reg type
        type_map = {
            'REG_SZ': 'REG_SZ',
            'REG_DWORD': 'REG_DWORD', 
            'REG_BINARY': 'REG_BINARY',
            'REG_MULTI_SZ': 'REG_MULTI_SZ',
            'REG_EXPAND_SZ': 'REG_EXPAND_SZ'
        }
        wine_type = type_map.get(reg_type, 'REG_SZ')
        
        # For DWORD values, Wine expects decimal, so convert hex if needed
        if wine_type == 'REG_DWORD' and value.startswith('0x'):
            value = str(int(value, 16))
        
        print(f'  Setting {wine_path}\\\\{name} = {value} ({wine_type})')
        
        cmd = ['gosu', user, 'wine', 'reg', 'add', wine_path, '/v', name, '/t', wine_type, '/d', value, '/f']
        subprocess.run(cmd, capture_output=True)
" 2>/dev/null || echo -e "${YELLOW}  Warning: Failed to parse registry settings${NC}"
    elif command -v jq >/dev/null 2>&1; then
        # Fallback to jq if python not available
        echo "$WINE_REGISTRY_SETTINGS" | jq -c '.[]' 2>/dev/null | while read -r setting; do
            path=$(echo "$setting" | jq -r '.path // ""')
            name=$(echo "$setting" | jq -r '.name // ""')
            reg_type=$(echo "$setting" | jq -r '.type // "REG_SZ"')
            value=$(echo "$setting" | jq -r '.value // ""')
            
            if [ -n "$path" ] && [ -n "$name" ]; then
                # Convert hex DWORD to decimal
                if [ "$reg_type" = "REG_DWORD" ] && [[ "$value" == 0x* ]]; then
                    value=$((value))
                fi
                echo -e "  Setting ${path}\\${name} = ${value} (${reg_type})"
                gosu ${UNAME:-gameuser} wine reg add "$path" /v "$name" /t "$reg_type" /d "$value" /f 2>/dev/null || true
            fi
        done
    else
        echo -e "${YELLOW}  Warning: Neither python3 nor jq available for registry parsing${NC}"
    fi
    echo -e "${GREEN}✓ Custom registry settings applied${NC}"
fi

#######################################################
# DXVK / Vulkan Setup and Diagnostics
#######################################################

# Always show Vulkan/GPU info for diagnostics
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Graphics Stack Diagnostics${NC}"
echo -e "${BLUE}========================================${NC}"

# Check Vulkan availability
if command -v vulkaninfo >/dev/null 2>&1; then
    VULKAN_GPU=$(vulkaninfo 2>/dev/null | grep -m1 "deviceName" | cut -d'=' -f2 | xargs || echo "unknown")
    VULKAN_DRIVER=$(vulkaninfo 2>/dev/null | grep -m1 "driverInfo" | cut -d'=' -f2 | xargs || echo "unknown")
    VULKAN_API=$(vulkaninfo 2>/dev/null | grep -m1 "apiVersion" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "unknown")
    
    if [ "$VULKAN_GPU" != "unknown" ] && [ -n "$VULKAN_GPU" ]; then
        echo -e "${GREEN}✓ Vulkan available${NC}"
        echo -e "  GPU:     $VULKAN_GPU"
        echo -e "  Driver:  $VULKAN_DRIVER"
        echo -e "  API:     Vulkan $VULKAN_API"
        VULKAN_AVAILABLE=true
    else
        echo -e "${YELLOW}⚠ Vulkan not detected (vulkaninfo returned no GPU)${NC}"
        echo "  This may happen if:"
        echo "    - No GPU is passed to the container (--device=/dev/dri)"
        echo "    - Vulkan drivers aren't installed for your GPU"
        echo "    - Running in a VM without GPU passthrough"
        VULKAN_AVAILABLE=false
    fi
else
    echo -e "${YELLOW}⚠ vulkaninfo not available - cannot verify Vulkan support${NC}"
    VULKAN_AVAILABLE=false
fi

# Check OpenGL as fallback info
if command -v glxinfo >/dev/null 2>&1 && [ -n "$DISPLAY" ]; then
    OPENGL_RENDERER=$(glxinfo 2>/dev/null | grep "OpenGL renderer" | cut -d':' -f2 | xargs || echo "unknown")
    OPENGL_VERSION=$(glxinfo 2>/dev/null | grep "OpenGL version" | cut -d':' -f2 | xargs || echo "unknown")
    echo -e "  OpenGL:  $OPENGL_VERSION"
    echo -e "  Renderer: $OPENGL_RENDERER"
fi
echo ""

# Check if DXVK should be installed
if [ "$INSTALL_DXVK" = "true" ]; then
    echo -e "${BLUE}DXVK Mode: ENABLED (DirectX → Vulkan translation)${NC}"
    
    if [ "$VULKAN_AVAILABLE" = "false" ]; then
        echo -e "${RED}✗ WARNING: DXVK requires Vulkan but Vulkan is not available!${NC}"
        echo -e "${RED}  Games will likely fail or fall back to software rendering.${NC}"
        echo -e "${RED}  Consider switching to OpenGL mode in game settings.${NC}"
        echo ""
    fi
    
    # Check if a specific DXVK version is requested
    DXVK_VERSION_ID="${DXVK_VERSION_ID:-}"
    DXVK_VERSIONS_DIR="/data/storage/dxvk-versions"
    
    if [ -n "$DXVK_VERSION_ID" ] && [ -d "$DXVK_VERSIONS_DIR/$DXVK_VERSION_ID" ]; then
        # Use specific downloaded DXVK version
        echo -e "  Using DXVK version: ${GREEN}$DXVK_VERSION_ID${NC}"
        DXVK_PATH="$DXVK_VERSIONS_DIR/$DXVK_VERSION_ID"
        
        # Install DXVK DLLs to the Wine prefix
        install_dxvk_from_path() {
            local src_arch="$1"
            local dest_dir="$2"
            local dll_count=0
            
            if [ -d "$DXVK_PATH/$src_arch" ]; then
                mkdir -p "$dest_dir"
                for dll in "$DXVK_PATH/$src_arch"/*.dll; do
                    if [ -f "$dll" ]; then
                        dll_name=$(basename "$dll")
                        # Backup original if not already backed up
                        if [ -f "$dest_dir/$dll_name" ] && [ ! -f "$dest_dir/$dll_name.orig" ]; then
                            mv "$dest_dir/$dll_name" "$dest_dir/$dll_name.orig"
                        fi
                        cp "$dll" "$dest_dir/"
                        ((dll_count++)) || true
                    fi
                done
                echo -e "    Installed $dll_count DLLs to ${dest_dir##*/}"
            fi
        }
        
        # Determine Wine arch
        if [ "$WINEARCH" = "win32" ]; then
            echo -e "  Installing 32-bit DXVK DLLs..."
            install_dxvk_from_path "x32" "$WINEPREFIX/drive_c/windows/system32"
        else
            echo -e "  Installing 64-bit DXVK DLLs..."
            install_dxvk_from_path "x64" "$WINEPREFIX/drive_c/windows/system32"
            # Also install 32-bit DLLs to syswow64 for 32-bit game compatibility
            if [ -d "$DXVK_PATH/x32" ]; then
                echo -e "  Installing 32-bit DXVK DLLs (for WoW64)..."
                install_dxvk_from_path "x32" "$WINEPREFIX/drive_c/windows/syswow64"
            fi
        fi
        
        # Set DLL overrides for DXVK
        echo -e "  Setting DLL overrides for DXVK..."
        gosu ${UNAME:-gameuser} wine reg add 'HKCU\Software\Wine\DllOverrides' /v d3d9 /t REG_SZ /d native /f >/dev/null 2>&1 || true
        gosu ${UNAME:-gameuser} wine reg add 'HKCU\Software\Wine\DllOverrides' /v d3d10core /t REG_SZ /d native /f >/dev/null 2>&1 || true
        gosu ${UNAME:-gameuser} wine reg add 'HKCU\Software\Wine\DllOverrides' /v d3d11 /t REG_SZ /d native /f >/dev/null 2>&1 || true
        gosu ${UNAME:-gameuser} wine reg add 'HKCU\Software\Wine\DllOverrides' /v dxgi /t REG_SZ /d native /f >/dev/null 2>&1 || true
        echo -e "${GREEN}✓ DXVK $DXVK_VERSION_ID installed from local cache${NC}"
    else
        # Fallback to winetricks installation
        if [ -n "$DXVK_VERSION_ID" ]; then
            echo -e "${YELLOW}⚠ DXVK version $DXVK_VERSION_ID not found, falling back to winetricks${NC}"
        fi
        
        # Check if DXVK DLL overrides are configured in the registry
        if ! grep -q "d3d11.*native" "$WINEPREFIX/user.reg" 2>/dev/null; then
            echo -e "${BLUE}Installing/Configuring DXVK via winetricks...${NC}"
            # Force reinstall by removing winetricks cache marker
            rm -f "$WINEPREFIX/.winetricks_cache/dxvk"
            # Install DXVK (will configure DLL overrides)
            if gosu ${UNAME:-gameuser} winetricks -f dxvk 2>&1 | tail -20; then
                echo -e "${GREEN}✓ DXVK installed successfully via winetricks${NC}"
            else
                echo -e "${YELLOW}⚠ DXVK installation may have failed${NC}"
            fi
        else
            echo -e "${GREEN}✓ DXVK already configured in prefix${NC}"
        fi
    fi
    
    # Show DXVK DLLs in prefix
    if [ -d "$WINEPREFIX/drive_c/windows/system32" ]; then
        DXVK_DLLS=$(ls -la "$WINEPREFIX/drive_c/windows/system32/"d3d*.dll 2>/dev/null | wc -l || echo "0")
        echo -e "  DXVK DLLs in system32: $DXVK_DLLS"
    fi
    
    # Log DXVK_HUD setting
    if [ -n "$DXVK_HUD" ]; then
        echo -e "  DXVK_HUD: $DXVK_HUD (will show overlay in-game)"
    else
        echo -e "  DXVK_HUD: not set (no overlay)"
    fi
else
    echo -e "${BLUE}DXVK Mode: DISABLED (using Wine's OpenGL/WineD3D)${NC}"
    echo -e "  DirectX games will use WineD3D (OpenGL-based translation)"
    echo -e "  This is more compatible but may have lower performance"
fi

# VKD3D-Proton for DirectX 12 support
INSTALL_VKD3D="${INSTALL_VKD3D:-false}"
if [ "$INSTALL_VKD3D" = "true" ]; then
    echo -e "${BLUE}VKD3D-Proton Mode: ENABLED (DirectX 12 → Vulkan translation)${NC}"
    
    VKD3D_VERSION_ID="${VKD3D_VERSION_ID:-}"
    VKD3D_VERSIONS_DIR="/data/storage/dxvk-versions"
    
    if [ -n "$VKD3D_VERSION_ID" ] && [ -d "$VKD3D_VERSIONS_DIR/$VKD3D_VERSION_ID" ]; then
        echo -e "  Using VKD3D-Proton version: ${GREEN}$VKD3D_VERSION_ID${NC}"
        VKD3D_PATH="$VKD3D_VERSIONS_DIR/$VKD3D_VERSION_ID"
        
        # Install VKD3D DLLs similar to DXVK
        if [ "$WINEARCH" = "win32" ]; then
            if [ -d "$VKD3D_PATH/x86" ]; then
                cp "$VKD3D_PATH/x86"/*.dll "$WINEPREFIX/drive_c/windows/system32/" 2>/dev/null || true
            fi
        else
            if [ -d "$VKD3D_PATH/x64" ]; then
                cp "$VKD3D_PATH/x64"/*.dll "$WINEPREFIX/drive_c/windows/system32/" 2>/dev/null || true
            fi
            if [ -d "$VKD3D_PATH/x86" ]; then
                mkdir -p "$WINEPREFIX/drive_c/windows/syswow64"
                cp "$VKD3D_PATH/x86"/*.dll "$WINEPREFIX/drive_c/windows/syswow64/" 2>/dev/null || true
            fi
        fi
        
        # Set DLL overrides for VKD3D
        gosu ${UNAME:-gameuser} wine reg add 'HKCU\Software\Wine\DllOverrides' /v d3d12 /t REG_SZ /d native /f >/dev/null 2>&1 || true
        gosu ${UNAME:-gameuser} wine reg add 'HKCU\Software\Wine\DllOverrides' /v d3d12core /t REG_SZ /d native /f >/dev/null 2>&1 || true
        echo -e "${GREEN}✓ VKD3D-Proton $VKD3D_VERSION_ID installed${NC}"
    else
        # Fallback to winetricks if available
        if [ -n "$VKD3D_VERSION_ID" ]; then
            echo -e "${YELLOW}⚠ VKD3D version $VKD3D_VERSION_ID not found${NC}"
        fi
        echo -e "  VKD3D-Proton installation from winetricks..."
        gosu ${UNAME:-gameuser} winetricks -f vkd3d 2>&1 | tail -10 || echo -e "${YELLOW}⚠ VKD3D installation may have issues${NC}"
    fi
fi
echo ""

#######################################################
# Gamescope Setup
#######################################################

USE_GAMESCOPE="${USE_GAMESCOPE:-false}"

if [ "$USE_GAMESCOPE" = "true" ]; then
    echo -e "${BLUE}Setting up Gamescope compositor...${NC}"
    
    if command -v gamescope >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Gamescope is available${NC}"
        
        # Set defaults for gamescope parameters
        GAMESCOPE_WIDTH="${GAMESCOPE_WIDTH:-1920}"
        GAMESCOPE_HEIGHT="${GAMESCOPE_HEIGHT:-1080}"
        GAMESCOPE_REFRESH="${GAMESCOPE_REFRESH:-60}"
        GAMESCOPE_FULLSCREEN="${GAMESCOPE_FULLSCREEN:-false}"
        GAMESCOPE_UPSCALER="${GAMESCOPE_UPSCALER:-auto}"
        
        # Build gamescope command
        GAMESCOPE_CMD="gamescope"

        # Prefer Wayland backend if available, otherwise fall back to X11
        if [ -n "$WAYLAND_DISPLAY" ]; then
            echo -e "${GREEN}✓ Wayland display $WAYLAND_DISPLAY detected${NC}"
            GAMESCOPE_CMD="$GAMESCOPE_CMD --backend wayland --xwayland-count 1"
            export GAMESCOPE_WAYLAND_DISPLAY="gamescope-0"
        else
            # Standard nested X11 mode for local display
            if [ -n "$DISPLAY" ] && xdpyinfo >/dev/null 2>&1; then
                echo -e "${GREEN}✓ X11 display $DISPLAY accessible${NC}"
                # Use SDL backend which handles X11 better in nested mode
                GAMESCOPE_CMD="$GAMESCOPE_CMD --backend sdl --xwayland-count 1 --nested-refresh $GAMESCOPE_REFRESH"
            else
                echo -e "${YELLOW}⚠ X11 display not accessible, Gamescope may fail${NC}"
                echo -e "  Ensure xhost +local:docker has been run on the host"
                echo -e "  Or that XAUTHORITY is properly mounted"
                # Still try - maybe it will work
                GAMESCOPE_CMD="$GAMESCOPE_CMD --backend sdl --xwayland-count 1 --nested-refresh $GAMESCOPE_REFRESH"
            fi
            
            # Export Gamescope's wayland display for child processes
            export GAMESCOPE_WAYLAND_DISPLAY="gamescope-0"
        fi
        
        # Output resolution (what appears in the window/stream)
        GAMESCOPE_CMD="$GAMESCOPE_CMD -W $GAMESCOPE_WIDTH -H $GAMESCOPE_HEIGHT"
        GAMESCOPE_CMD="$GAMESCOPE_CMD -r $GAMESCOPE_REFRESH"
        
        # Add input resolution if specified (game internal resolution)
        if [ -n "$GAMESCOPE_INPUT_WIDTH" ] && [ -n "$GAMESCOPE_INPUT_HEIGHT" ]; then
            GAMESCOPE_CMD="$GAMESCOPE_CMD -w $GAMESCOPE_INPUT_WIDTH -h $GAMESCOPE_INPUT_HEIGHT"
        fi
        
        # Add FPS limit if specified
        if [ -n "$GAMESCOPE_FPS_LIMIT" ]; then
            GAMESCOPE_CMD="$GAMESCOPE_CMD -o $GAMESCOPE_FPS_LIMIT"
        fi
        
        # Fullscreen/windowed mode (only relevant for non-headless)
        if [ "$GAMESCOPE_FULLSCREEN" = "true" ]; then
            GAMESCOPE_CMD="$GAMESCOPE_CMD -f"
        else
            # Use borderless windowed mode for better compatibility
            GAMESCOPE_CMD="$GAMESCOPE_CMD -b"
        fi
        
        # Force grab cursor for better game control
        GAMESCOPE_CMD="$GAMESCOPE_CMD --force-grab-cursor"
        
        # Upscaler
        if [ "$GAMESCOPE_UPSCALER" != "auto" ]; then
            GAMESCOPE_CMD="$GAMESCOPE_CMD -U $GAMESCOPE_UPSCALER"
        fi
        
        if [ -n "$WAYLAND_DISPLAY" ]; then
            echo "  Gamescope mode: wayland"
        else
            echo "  Gamescope mode: nested X11"
        fi
        echo "  Gamescope resolution: ${GAMESCOPE_WIDTH}x${GAMESCOPE_HEIGHT}@${GAMESCOPE_REFRESH}Hz"
        if [ -n "$GAMESCOPE_INPUT_WIDTH" ] && [ -n "$GAMESCOPE_INPUT_HEIGHT" ]; then
            echo "  Gamescope input: ${GAMESCOPE_INPUT_WIDTH}x${GAMESCOPE_INPUT_HEIGHT}"
        fi
        echo "  Gamescope upscaler: $GAMESCOPE_UPSCALER"
        if [ -n "$GAMESCOPE_FPS_LIMIT" ]; then
            echo "  Gamescope FPS limit: $GAMESCOPE_FPS_LIMIT"
        fi
        echo "  Gamescope command: $GAMESCOPE_CMD"
    else
        echo -e "${YELLOW}⚠ Gamescope not found, disabling${NC}"
        USE_GAMESCOPE="false"
    fi
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Wine Runner Ready${NC}"
echo -e "${GREEN}========================================${NC}"

# Summary of graphics configuration
echo ""
echo -e "${BLUE}Graphics Configuration Summary:${NC}"
if [ "$INSTALL_DXVK" = "true" ]; then
    echo -e "  Renderer:  ${GREEN}DXVK (Vulkan)${NC}"
    echo -e "  DirectX → Vulkan translation active"
    if [ -n "$DXVK_HUD" ]; then
        echo -e "  HUD:       Enabled ($DXVK_HUD)"
        echo -e "             Look for overlay in top-left showing GPU/FPS"
    fi
else
    echo -e "  Renderer:  ${YELLOW}WineD3D (OpenGL)${NC}"
    echo -e "  DirectX → OpenGL translation (slower but more compatible)"
fi
echo ""

# Apply xrandr mode *after* display has been set up and *before* launching anything.
apply_xrandr_mode

# Execute command as game user if provided
if [ "$#" -gt 0 ]; then
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  Command Analysis${NC}"
    echo -e "${BLUE}========================================${NC}"
    
    # Show the resolved GAME_EXECUTABLE
    if [ -n "$GAME_EXECUTABLE" ]; then
        echo -e "  GAME_EXECUTABLE: $GAME_EXECUTABLE"
        if [ -f "$GAME_EXECUTABLE" ]; then
            echo -e "    ${GREEN}✓ File exists${NC}"
            file "$GAME_EXECUTABLE" 2>/dev/null | head -1 || true
        else
            echo -e "    ${RED}✗ FILE NOT FOUND!${NC}"
            # Try to help debug by showing the parent directory
            PARENT_DIR=$(dirname "$GAME_EXECUTABLE")
            if [ -d "$PARENT_DIR" ]; then
                echo -e "    Parent directory exists. Contents:"
                ls -la "$PARENT_DIR" 2>/dev/null | head -10 || true
            else
                echo -e "    Parent directory also doesn't exist: $PARENT_DIR"
                # Go up one more level
                GRANDPARENT=$(dirname "$PARENT_DIR")
                if [ -d "$GRANDPARENT" ]; then
                    echo -e "    Grandparent directory contents:"
                    ls -la "$GRANDPARENT" 2>/dev/null | head -10 || true
                fi
            fi
        fi
        echo ""
    fi
    
    echo -e "  Raw command: $@"
    echo -e "  Number of args: $#"
    for i in $(seq 1 $#); do
        eval arg=\$$i
        echo -e "    Arg $i: '$arg'"
        # If it looks like a path, check if it exists
        if [[ "$arg" == /* ]]; then
            if [ -e "$arg" ]; then
                echo -e "      ✓ Path exists"
                file "$arg" 2>/dev/null | head -1 || true
            else
                echo -e "      ✗ Path NOT FOUND!"
                # Try to find similar files
                parent=$(dirname "$arg")
                if [ -d "$parent" ]; then
                    echo -e "      Parent dir exists, contents:"
                    ls -la "$parent" 2>/dev/null | head -10 || true
                fi
            fi
        fi
    done
    echo -e "${BLUE}========================================${NC}"
    echo ""
    
    # Check if MangoHUD is enabled
    ENABLE_MANGOHUD="${ENABLE_MANGOHUD:-false}"
    
    # Check if this is a wine command and virtual desktop is requested
    # NOTE: Wine virtual desktop does NOT work with Proton/GE-Proton (UMU launcher)
    # NOTE: Wine virtual desktop should NOT be used with Gamescope (they conflict)
    # For Proton or Gamescope, skip Wine virtual desktop
    if [ -n "$WINE_VIRTUAL_DESKTOP" ]; then
        # Check if Gamescope is enabled - don't use both
        if [ "$USE_GAMESCOPE" = "true" ]; then
            echo -e "${YELLOW}⚠ Wine virtual desktop disabled - Gamescope handles window management${NC}"
            echo -e "${YELLOW}  Gamescope will provide fullscreen/upscaling instead.${NC}"
            echo ""
        # Check if we're using Proton (UMU launcher or GE-Proton)
        elif [ -n "$WINE_VERSION_ID" ] && echo "$WINE_VERSION_ID" | grep -qi "proton\|umu\|ge-"; then
            echo -e "${YELLOW}⚠ Wine virtual desktop is not supported with Proton/GE-Proton${NC}"
            echo -e "${YELLOW}  Skipping virtual desktop. Use Gamescope for fullscreen support.${NC}"
            echo ""
        else
            # Extract resolution for virtual desktop (only for regular Wine)
            VD_RES="${WINE_VIRTUAL_DESKTOP}"
            
            echo -e "${BLUE}Wine virtual desktop requested: ${VD_RES}${NC}"
            echo -e "  Command \$1: '$1'"
            
            # Check if the command starts with 'wine ' or 'bash' - we need to wrap it with explorer
            case "$1" in
                wine)
                    # Remove 'wine' from the start and wrap with explorer /desktop=
                    shift
                    echo -e "${GREEN}✓ Using Wine virtual desktop: ${VD_RES}${NC}"
                    set -- wine explorer /desktop=Default,${VD_RES} "$@"
                    ;;
                bash)
                    # If it's a bash command containing wine, we need to modify the inner command
                    # This is typically: bash -lc 'wine "${GAME_EXECUTABLE}"'
                    # $1=bash, $2=-lc, $3='wine "${GAME_EXECUTABLE}"'
                    if [ "$2" = "-lc" ] || [ "$2" = "-c" ]; then
                        BASH_FLAG="$2"
                        WINE_CMD="$3"
                        shift 3  # Remove bash, -lc, and the wine command
                        
                        echo -e "  Original inner command: $WINE_CMD"
                        
                        # Modify the wine command to include explorer /desktop=
                        # Handle both 'wine ...' and 'wine "...' patterns
                        if echo "$WINE_CMD" | grep -q '^wine '; then
                            MODIFIED_CMD=$(echo "$WINE_CMD" | sed "s/^wine /wine explorer \\/desktop=Default,${VD_RES} /")
                        elif echo "$WINE_CMD" | grep -q '^wine"'; then
                            # Handle case like: wine"${GAME_EXECUTABLE}" (no space)
                            MODIFIED_CMD=$(echo "$WINE_CMD" | sed "s/^wine/wine explorer \\/desktop=Default,${VD_RES} /")
                        else
                            # Just prepend explorer to whatever follows wine
                            MODIFIED_CMD=$(echo "$WINE_CMD" | sed "s/^wine/wine explorer \\/desktop=Default,${VD_RES}/")
                        fi
                        
                        echo -e "${GREEN}✓ Using Wine virtual desktop: ${VD_RES}${NC}"
                        echo -e "  Modified inner command: $MODIFIED_CMD"
                        set -- bash "$BASH_FLAG" "$MODIFIED_CMD" "$@"
                    else
                        echo -e "${YELLOW}⚠ Bash command format not recognized, virtual desktop not applied${NC}"
                        echo -e "  \$2='$2' (expected -lc or -c)"
                    fi
                    ;;
                *)
                    echo -e "${YELLOW}⚠ Command doesn't start with 'wine' or 'bash', virtual desktop not applied${NC}"
                    echo -e "  First arg: '$1'"
                    ;;
            esac
        fi
    fi
    
    if [ "$USE_GAMESCOPE" = "true" ]; then
        if [ "$ENABLE_MANGOHUD" = "true" ]; then
            echo -e "${BLUE}Executing with Gamescope + MangoHUD: mangohud $GAMESCOPE_CMD -- $@${NC}"
            echo ""
            gosu ${UNAME:-gameuser} mangohud $GAMESCOPE_CMD -- "$@" &
        else
            echo -e "${BLUE}Executing with Gamescope: $GAMESCOPE_CMD -- $@${NC}"
            echo ""
            gosu ${UNAME:-gameuser} $GAMESCOPE_CMD -- "$@" &
        fi
    else
        if [ "$ENABLE_MANGOHUD" = "true" ]; then
            echo -e "${BLUE}Executing with MangoHUD: mangohud $@${NC}"
            echo ""
            gosu ${UNAME:-gameuser} mangohud "$@" &
        else
            echo -e "${BLUE}Executing command: $@${NC}"
            echo ""
            gosu ${UNAME:-gameuser} "$@" &
        fi
    fi

    CHILD_PID=$!
    echo -e "${BLUE}Process started with PID: $CHILD_PID${NC}"
    echo -e "${BLUE}Waiting for process to complete...${NC}"
    wait "$CHILD_PID"
    EXIT_CODE=$?
    
    echo ""
    if [ $EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}✓ Command completed successfully (exit code: 0)${NC}"
    else
        echo -e "${YELLOW}⚠ Command exited with code: $EXIT_CODE${NC}"
    fi
    
    # Wait for Wine to finish writing registry and other files
    echo ""
    echo -e "${BLUE}Waiting for Wine to finish...${NC}"
    gosu ${UNAME:-gameuser} wineserver -w 2>/dev/null || true
    echo -e "${GREEN}✓ Wine shutdown complete${NC}"

    # Restore display mode before optionally keeping the container alive.
    restore_xrandr_mode

    # Optional: keep container alive for debugging (even on failure)
    if [ "${KEEP_ALIVE}" = "true" ]; then
        echo ""
        echo -e "${YELLOW}KEEP_ALIVE=true - container will remain running for inspection${NC}"
        echo -e "${YELLOW}Exit code was: ${EXIT_CODE}${NC}"
        exec tail -f /dev/null
    fi

    # Exit with the game's exit code
    exit $EXIT_CODE
else
    echo -e "${BLUE}No command provided, starting shell...${NC}"
    echo ""
    exec gosu ${UNAME:-gameuser} /bin/bash
fi
