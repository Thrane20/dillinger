#!/bin/bash

# Dillinger Development Startup Script
# Starts the complete development environment:
# - Backend API (port 3001)
# - Frontend (port 3000)
# - Runner Service (port 3002)

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
PORTS_IN_USE=$(lsof -ti :3000,3001,3002 2>/dev/null || true)
echo $PORTS_IN_USE

if [ ! -z "$PORTS_IN_USE" ]; then
    echo -e "${YELLOW}⚠️  Services already running on ports 3000, 3001, or 3002${NC}"
    echo "   PIDs: $PORTS_IN_USE"
    read -p "Kill existing processes and continue? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Stopping existing services...${NC}"
        lsof -ti :3000,3001,3002 | xargs -r kill -9 2>/dev/null || true
        sleep 2
        echo -e "${GREEN}✓ Existing services stopped${NC}"
    else
        echo -e "${RED}Aborting...${NC}"
        exit 1
    fi
fi

# Confirm before proceeding
echo -e "${BLUE}Continue starting the development environment?${NC}"
read -p "Proceed? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Aborting...${NC}"
    exit 1
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
echo "  • Frontend:  http://localhost:3000"
echo "  • Backend:   http://localhost:3001/api/health"
echo "  • Runner:    http://localhost:3002/health"
echo

# Start all services in parallel using pnpm
# The --parallel flag runs them simultaneously
pnpm run dev:all

# If the command above exits (e.g., user presses Ctrl+C), clean up
echo
echo -e "${YELLOW}Shutting down services...${NC}"
lsof -ti :3000,3001,3002 | xargs -r kill -9 2>/dev/null || true
echo -e "${GREEN}✓ All services stopped${NC}"
