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
        $1 == out { in=1; next }
        in && $1 ~ /^[0-9]+x[0-9]+$/ && $0 ~ /\*/ { print $1; exit }
        in && NF==0 { exit }
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

    local out
    out="$(detect_xrandr_output)"
    if [ -z "$out" ]; then
        echo -e "${YELLOW}⚠ XRANDR_MODE requested but no connected outputs were detected${NC}"
        return 0
    fi

    local current
    current="$(detect_current_mode_for_output "$out")"

    ORIG_XRANDR_OUTPUT="$out"
    ORIG_XRANDR_MODE="$current"

    echo -e "${BLUE}Setting display resolution via xrandr...${NC}"
    echo "  Output: $out"
    if [ -n "$current" ]; then
        echo "  Current: $current"
    else
        echo "  Current: <unknown>"
    fi
    echo "  Target:  $XRANDR_MODE"

    if xrandr --output "$out" --mode "$XRANDR_MODE" >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Display resolution set to $XRANDR_MODE${NC}"
    else
        echo -e "${YELLOW}⚠ Failed to set resolution to $XRANDR_MODE (continuing)${NC}"
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
WINEARCH="${WINEARCH:-win64}"
WINEDEBUG="${WINEDEBUG:--all}"

export WINEPREFIX
export WINEARCH
export WINEDEBUG
export WINE_LARGE_ADDRESS_AWARE="${WINE_LARGE_ADDRESS_AWARE:-1}"

echo "  Wine Prefix: $WINEPREFIX"
echo "  Wine Architecture: $WINEARCH"
echo "  Wine Debug: $WINEDEBUG"

# Ensure prefix directory exists and is owned by the runtime user.
# When /wineprefix is a bind mount, build-time ownership in the image does not apply.
if [ ! -d "$WINEPREFIX" ]; then
    mkdir -p "$WINEPREFIX" || true
fi

# Best-effort ownership fix: requires entrypoint to run as root.
if [ "$(id -u)" = "0" ]; then
    if [ -n "$PUID" ] && [ -n "$PGID" ]; then
        chown -R "$PUID:$PGID" "$WINEPREFIX" 2>/dev/null || true
    else
        chown -R "${UNAME:-gameuser}:${UNAME:-gameuser}" "$WINEPREFIX" 2>/dev/null || true
    fi
fi

if [ -e "$WINEPREFIX" ]; then
    PREFIX_OWNER_UID=$(stat -c "%u" "$WINEPREFIX" 2>/dev/null || echo "?")
    PREFIX_OWNER_GID=$(stat -c "%g" "$WINEPREFIX" 2>/dev/null || echo "?")
    CURRENT_UID=$(id -u)
    if [ "$PREFIX_OWNER_UID" != "?" ] && [ "$PREFIX_OWNER_UID" != "$CURRENT_UID" ]; then
        echo -e "${YELLOW}⚠ Wine prefix ownership mismatch: owner=${PREFIX_OWNER_UID}:${PREFIX_OWNER_GID} current=${CURRENT_UID} (Wine may refuse to run)${NC}"
        echo -e "${YELLOW}  Tip: ensure the host prefix dir is owned by uid=${PUID:-1000} gid=${PGID:-1000}, or run the container entrypoint as root so it can chown.${NC}"
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
# Supported values: vulkan | opengl
WINE_D3D_RENDERER="${WINE_D3D_RENDERER:-vulkan}"
if [ "$WINE_D3D_RENDERER" != "vulkan" ] && [ "$WINE_D3D_RENDERER" != "opengl" ]; then
    echo -e "${YELLOW}⚠ Invalid WINE_D3D_RENDERER='$WINE_D3D_RENDERER' (expected 'vulkan' or 'opengl'); defaulting to 'vulkan'${NC}"
    WINE_D3D_RENDERER="vulkan"
fi

# If Vulkan is requested but not available, fall back to OpenGL.
# This prevents hard crashes during device enumeration.
if [ "$WINE_D3D_RENDERER" = "vulkan" ]; then
    if [ ! -c /dev/dri/renderD128 ] && [ ! -c /dev/dri/renderD129 ] && [ ! -c /dev/dri/renderD130 ]; then
        echo -e "${YELLOW}⚠ Vulkan requested but no /dev/dri/renderD* device found; falling back to OpenGL${NC}"
        WINE_D3D_RENDERER="opengl"
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

# Check if DXVK should be installed
if [ "$INSTALL_DXVK" = "true" ]; then
    # Check if DXVK DLL overrides are configured in the registry
    if ! grep -q "d3d11.*native" "$WINEPREFIX/user.reg" 2>/dev/null; then
        echo -e "${BLUE}Installing/Configuring DXVK...${NC}"
        # Force reinstall by removing winetricks cache marker
        rm -f "$WINEPREFIX/.winetricks_cache/dxvk"
        # Install DXVK (will configure DLL overrides)
        gosu ${UNAME:-gameuser} winetricks -f dxvk 2>&1 | tail -20 || echo "DXVK installation skipped or failed"
    else
        echo -e "${GREEN}✓ DXVK already configured${NC}"
    fi
fi

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
        
        # Check if Moonlight streaming is enabled - use headless mode
        ENABLE_MOONLIGHT="${ENABLE_MOONLIGHT:-false}"
        if [ "$ENABLE_MOONLIGHT" = "true" ]; then
            echo -e "${BLUE}  Moonlight streaming detected - using headless mode${NC}"
            # Headless mode: render without creating a window
            # Perfect for streaming scenarios where frames are captured by Wolf/Moonlight
            GAMESCOPE_CMD="$GAMESCOPE_CMD --headless"
            GAMESCOPE_CMD="$GAMESCOPE_CMD --xwayland-count 1"
            
            # Use backend that works best for capture
            GAMESCOPE_CMD="$GAMESCOPE_CMD --backend drm"
            
            # Prefer hardware encoding path
            if [ -n "$WOLF_RENDER_NODE" ]; then
                GAMESCOPE_CMD="$GAMESCOPE_CMD --drm-device $WOLF_RENDER_NODE"
            fi
        else
            # Standard nested X11 mode for local display
            GAMESCOPE_CMD="$GAMESCOPE_CMD --xwayland-count 1 --nested-refresh $GAMESCOPE_REFRESH"
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
        if [ "$ENABLE_MOONLIGHT" != "true" ]; then
            if [ "$GAMESCOPE_FULLSCREEN" = "true" ]; then
                GAMESCOPE_CMD="$GAMESCOPE_CMD -f"
            else
                # Use borderless windowed mode for better compatibility
                GAMESCOPE_CMD="$GAMESCOPE_CMD -b"
            fi
            
            # Force grab cursor for better game control (local mode)
            GAMESCOPE_CMD="$GAMESCOPE_CMD --force-grab-cursor"
        fi
        
        # Upscaler
        if [ "$GAMESCOPE_UPSCALER" != "auto" ]; then
            GAMESCOPE_CMD="$GAMESCOPE_CMD -U $GAMESCOPE_UPSCALER"
        fi
        
        echo "  Gamescope mode: $([ "$ENABLE_MOONLIGHT" = "true" ] && echo "headless (streaming)" || echo "nested X11 (local)")"
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
echo ""

# Apply xrandr mode *after* display has been set up and *before* launching anything.
apply_xrandr_mode

# Execute command as game user if provided
if [ "$#" -gt 0 ]; then
    # Check if MangoHUD is enabled
    ENABLE_MANGOHUD="${ENABLE_MANGOHUD:-false}"
    
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
    wait "$CHILD_PID"
    EXIT_CODE=$?
    
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
