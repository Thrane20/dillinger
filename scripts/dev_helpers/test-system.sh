#!/bin/bash
# Dillinger Test Script - Simplified Architecture
# Tests: Core webapp/backend + Docker runner containers

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Dillinger System Test               ║${NC}"
echo -e "${BLUE}║   Simplified Runner Architecture      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Track what we start so we can clean up
STARTED_BACKEND=false
STARTED_FRONTEND=false
RUNNER_CONTAINER=""

cleanup() {
    echo ""
    echo -e "${YELLOW}Cleaning up...${NC}"
    
    if [ "$RUNNER_CONTAINER" != "" ]; then
        echo "Stopping runner container: $RUNNER_CONTAINER"
        docker stop "$RUNNER_CONTAINER" 2>/dev/null || true
        docker rm "$RUNNER_CONTAINER" 2>/dev/null || true
    fi
    
    if [ "$STARTED_BACKEND" = true ]; then
        echo "Stopping backend (port 3011)..."
        lsof -ti :3011 | xargs -r kill 2>/dev/null || true
    fi
    
    if [ "$STARTED_FRONTEND" = true ]; then
        echo "Stopping frontend (port 3010)..."
        lsof -ti :3010 | xargs -r kill 2>/dev/null || true
    fi
    
    echo -e "${GREEN}✓ Cleanup complete${NC}"
}

trap cleanup EXIT

# ============================================================================
# Step 1: Check Prerequisites
# ============================================================================
echo -e "${BLUE}[1/6] Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker available${NC}"

if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}✗ pnpm not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ pnpm available${NC}"

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠ Dependencies not installed, running pnpm install...${NC}"
    pnpm install
fi
echo -e "${GREEN}✓ Dependencies installed${NC}"

# ============================================================================
# Step 2: Build Runner Image
# ============================================================================
echo ""
echo -e "${BLUE}[2/6] Building Linux Native Runner image...${NC}"

cd packages/runner-images/linux-native
if [ ! -f "Dockerfile" ]; then
    echo -e "${RED}✗ Runner Dockerfile not found${NC}"
    exit 1
fi

echo "Building dillinger/runner-linux-native:latest..."
docker build -t dillinger/runner-linux-native:latest . -q
echo -e "${GREEN}✓ Runner image built${NC}"

cd - > /dev/null

# ============================================================================
# Step 3: Start Backend API
# ============================================================================
echo ""
echo -e "${BLUE}[3/6] Starting backend API (port 3011)...${NC}"

# Check if already running
if lsof -ti :3011 > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠ Backend already running on port 3011${NC}"
    read -p "Use existing backend? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Stopping existing backend..."
        lsof -ti :3011 | xargs -r kill
        sleep 2
    fi
fi

if ! lsof -ti :3011 > /dev/null 2>&1; then
    echo "Starting backend in background..."
    cd packages/dillinger-core/backend
    PORT=3011 pnpm run dev > /tmp/dillinger-backend.log 2>&1 &
    BACKEND_PID=$!
    STARTED_BACKEND=true
    cd - > /dev/null
    
    echo "Waiting for backend to start..."
    for i in {1..30}; do
        if curl -s http://localhost:3011/api/health > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Backend started successfully${NC}"
            break
        fi
        if [ $i -eq 30 ]; then
            echo -e "${RED}✗ Backend failed to start${NC}"
            echo "Check logs: tail /tmp/dillinger-backend.log"
            exit 1
        fi
        sleep 1
        echo -n "."
    done
else
    echo -e "${GREEN}✓ Backend available${NC}"
fi

# ============================================================================
# Step 4: Test Backend API
# ============================================================================
echo ""
echo -e "${BLUE}[4/6] Testing backend API...${NC}"

HEALTH=$(curl -s http://localhost:3011/api/health)
if echo "$HEALTH" | grep -q "healthy\|ok"; then
    echo -e "${GREEN}✓ Backend health check passed${NC}"
    echo "  Response: $HEALTH"
else
    echo -e "${RED}✗ Backend health check failed${NC}"
    exit 1
fi

# ============================================================================
# Step 5: Launch Runner Container
# ============================================================================
echo ""
echo -e "${BLUE}[5/6] Launching Linux Native Runner...${NC}"

# Create temporary save directory
TEST_SAVES="/tmp/dillinger-test-saves"
mkdir -p "$TEST_SAVES"

echo "Starting runner container with test game..."
RUNNER_CONTAINER=$(docker run -d \
    -e GAME_EXECUTABLE=/usr/local/bin/test-game.sh \
    -v "$TEST_SAVES:/saves:rw" \
    --name dillinger-test-runner-$$ \
    dillinger/runner-linux-native:latest \
    sh -c "sleep 10")

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Runner container started${NC}"
    echo "  Container ID: $RUNNER_CONTAINER"
    echo "  Saves directory: $TEST_SAVES"
else
    echo -e "${RED}✗ Failed to start runner container${NC}"
    exit 1
fi

# Check container is running
sleep 2
if docker ps | grep -q "$RUNNER_CONTAINER"; then
    echo -e "${GREEN}✓ Runner container is running${NC}"
else
    echo -e "${RED}✗ Runner container stopped unexpectedly${NC}"
    echo "Container logs:"
    docker logs "$RUNNER_CONTAINER"
    exit 1
fi

# ============================================================================
# Step 6: Verify System Status
# ============================================================================
echo ""
echo -e "${BLUE}[6/6] System status summary...${NC}"
echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  All Systems Operational ✓            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo "Services:"
echo "  • Backend API:  http://localhost:3011/api/health"
echo "  • Frontend:     http://localhost:3010 (manual start needed)"
echo ""
echo "Runner:"
echo "  • Container:    $RUNNER_CONTAINER"
echo "  • Image:        dillinger/runner-linux-native:latest"
echo "  • Saves:        $TEST_SAVES"
echo ""
echo "Docker Containers:"
docker ps --filter "name=dillinger-test-runner" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
echo ""

# ============================================================================
# Interactive Menu
# ============================================================================
echo -e "${BLUE}What would you like to do?${NC}"
echo "  1) Stop runner container"
echo "  2) View runner logs"
echo "  3) Run interactive test game in runner"
echo "  4) Keep everything running and exit"
echo "  5) Stop all services and exit"
echo ""
read -p "Choice (1-5): " -n 1 -r
echo ""

case $REPLY in
    1)
        echo "Stopping runner container..."
        docker stop "$RUNNER_CONTAINER"
        docker rm "$RUNNER_CONTAINER"
        RUNNER_CONTAINER=""
        echo -e "${GREEN}✓ Runner stopped${NC}"
        ;;
    2)
        echo "Runner container logs:"
        docker logs "$RUNNER_CONTAINER"
        ;;
    3)
        echo ""
        echo -e "${BLUE}Launching interactive test game...${NC}"
        echo "(This will run a text adventure game - choose 'Save and quit' when done)"
        echo ""
        docker stop "$RUNNER_CONTAINER" 2>/dev/null || true
        docker rm "$RUNNER_CONTAINER" 2>/dev/null || true
        docker run -it --rm \
            -e GAME_EXECUTABLE=/usr/local/bin/test-game.sh \
            -v "$TEST_SAVES:/saves:rw" \
            dillinger/runner-linux-native:latest
        RUNNER_CONTAINER=""
        ;;
    4)
        echo -e "${YELLOW}Keeping services running...${NC}"
        echo "To stop later:"
        echo "  docker stop $RUNNER_CONTAINER"
        echo "  lsof -ti :3011 | xargs kill"
        trap - EXIT
        exit 0
        ;;
    5)
        echo "Stopping all services..."
        ;;
esac

echo ""
echo -e "${GREEN}✓ Test complete!${NC}"
