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

# Call base entrypoint script to set up display, GPU, audio, etc.
# But don't execute the final command yet - just source the environment
source /usr/local/bin/entrypoint.sh "$@" 2>&1 | head -50 &
BASE_PID=$!

# Wait for base setup to complete
wait $BASE_PID || true

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

# Check if DXVK should be installed
if [ "$INSTALL_DXVK" = "true" ] && [ ! -d "$WINEPREFIX/drive_c/windows/system32/dxvk" ]; then
    echo -e "${BLUE}Installing DXVK...${NC}"
    gosu ${UNAME:-gameuser} winetricks -q dxvk 2>&1 | tail -10 || echo "DXVK installation skipped or failed"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Wine Runner Ready${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Execute command as game user if provided
if [ "$#" -gt 0 ]; then
    echo -e "${BLUE}Executing command: $@${NC}"
    echo ""
    exec gosu ${UNAME:-gameuser} "$@"
else
    echo -e "${BLUE}No command provided, starting shell...${NC}"
    echo ""
    exec gosu ${UNAME:-gameuser} /bin/bash
fi
