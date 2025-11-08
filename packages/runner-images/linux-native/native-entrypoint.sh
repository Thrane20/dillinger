#!/bin/bash
# Dillinger Linux Native Game Runner - Entrypoint Wrapper
# Calls base entrypoint first, then sets up native Linux environment
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Linux Native Runner - Initializing...${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Call base entrypoint script to set up display, GPU, audio, etc.
# But don't execute the final command yet - just source the environment
source /usr/local/bin/entrypoint.sh "$@" 2>&1 | head -50 &
BASE_PID=$!

# Wait for base setup to complete
wait $BASE_PID || true

#######################################################
# Linux Native-Specific Setup
#######################################################

echo -e "${BLUE}Configuring native Linux game environment...${NC}"

# Set LD_LIBRARY_PATH for game libraries
export LD_LIBRARY_PATH="/usr/local/lib:/usr/lib:/usr/lib/x86_64-linux-gnu:${LD_LIBRARY_PATH}"

# Check for Steam Runtime if mounted
if [ -d "/opt/steam-runtime" ] && [ "$(ls -A /opt/steam-runtime)" ]; then
    echo -e "${GREEN}✓ Steam Runtime detected${NC}"
    export STEAM_RUNTIME="/opt/steam-runtime"
fi

# Set SDL environment for better game compatibility
export SDL_VIDEO_MINIMIZE_ON_FOCUS_LOSS=0
export SDL_AUDIODRIVER="${SDL_AUDIODRIVER:-pulseaudio}"

echo "  LD_LIBRARY_PATH configured"
echo "  SDL environment configured"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Linux Native Runner Ready${NC}"
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
