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

# Source the base entrypoint setup functions but don't execute final command
# The base entrypoint expects to be executed, not sourced, so we need to handle this carefully

# Set up basic environment variables that base entrypoint would set
UNAME="${UNAME:-gameuser}"
PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

# Export display and audio variables if they exist
export DISPLAY="${DISPLAY:-:0}"
export PULSE_SERVER="${PULSE_SERVER:-unix:/run/user/1000/pulse/native}"
export PULSE_COOKIE="${PULSE_COOKIE:-/home/${UNAME}/.config/pulse/cookie}"

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

gosu ${UNAME:-gameuser} wine reg add "HKCU\\Software\\Wine\\Direct3D" /v "renderer" /t REG_SZ /d "vulkan" /f 2>/dev/null || true
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

# Execute command as game user if provided
if [ "$#" -gt 0 ]; then
    # Check if MangoHUD is enabled
    ENABLE_MANGOHUD="${ENABLE_MANGOHUD:-false}"
    
    if [ "$USE_GAMESCOPE" = "true" ]; then
        if [ "$ENABLE_MANGOHUD" = "true" ]; then
            echo -e "${BLUE}Executing with Gamescope + MangoHUD: mangohud $GAMESCOPE_CMD -- $@${NC}"
            echo ""
            gosu ${UNAME:-gameuser} mangohud $GAMESCOPE_CMD -- "$@"
        else
            echo -e "${BLUE}Executing with Gamescope: $GAMESCOPE_CMD -- $@${NC}"
            echo ""
            gosu ${UNAME:-gameuser} $GAMESCOPE_CMD -- "$@"
        fi
    else
        if [ "$ENABLE_MANGOHUD" = "true" ]; then
            echo -e "${BLUE}Executing with MangoHUD: mangohud $@${NC}"
            echo ""
            gosu ${UNAME:-gameuser} mangohud "$@"
        else
            echo -e "${BLUE}Executing command: $@${NC}"
            echo ""
            gosu ${UNAME:-gameuser} "$@"
        fi
    fi
    
    # Capture exit code
    EXIT_CODE=$?
    
    # Wait for Wine to finish writing registry and other files
    echo ""
    echo -e "${BLUE}Waiting for Wine to finish...${NC}"
    gosu ${UNAME:-gameuser} wineserver -w 2>/dev/null || true
    echo -e "${GREEN}✓ Wine shutdown complete${NC}"
    
    # Exit with the game's exit code
    exit $EXIT_CODE
else
    echo -e "${BLUE}No command provided, starting shell...${NC}"
    echo ""
    exec gosu ${UNAME:-gameuser} /bin/bash
fi
