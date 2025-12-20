#!/bin/bash

# Dillinger Development Startup Script
# Starts the development environment:
# - Backend API (port 3011)
# - Frontend (port 3010)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🎮 Starting Dillinger Development Environment${NC}"
echo "=============================================="
echo

# Check if any services are already running
echo -e "${BLUE}Checking for existing services...${NC}"
PORTS_IN_USE=$(lsof -ti :3010,3011 2>/dev/null || true)

if [ ! -z "$PORTS_IN_USE" ]; then
    echo -e "${YELLOW}⚠️  Services already running on ports 3010 or 3011${NC}"
    echo "   PIDs: $PORTS_IN_USE"
    read -p "Kill existing processes and continue? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Stopping existing services...${NC}"
        lsof -ti :3010,3011 | xargs -r kill -9 2>/dev/null || true
        sleep 2
        echo -e "${GREEN}✓ Existing services stopped${NC}"
    else
        echo -e "${RED}Aborting...${NC}"
        exit 1
    fi
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  Dependencies not installed${NC}"
    echo "Running pnpm install..."
    pnpm install
    echo
fi

echo -e "${GREEN}Starting services in parallel...${NC}"
echo
echo -e "${BLUE}Services will be available at:${NC}"
echo "  • Frontend:  http://localhost:3010"
echo "  • Backend:   http://localhost:3011/api/health"
echo
echo -e "${BLUE}Note:${NC} Runners are now Docker containers, not a service."
echo "      Use './test-system.sh' to launch runner containers."
echo

# Start core services (backend + frontend)
pnpm run dev

# If the command above exits (e.g., user presses Ctrl+C), clean up
echo
echo -e "${YELLOW}Shutting down services...${NC}"
lsof -ti :3010,3011 | xargs -r kill -9 2>/dev/null || true
echo -e "${GREEN}✓ All services stopped${NC}"
