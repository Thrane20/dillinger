#!/bin/bash

# Dillinger End-to-End Test Script
# This script demonstrates launching the core and creating a runner session

set -e

echo "🎮 Dillinger End-to-End Demo"
echo "=============================="
echo

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Step 1: Check if core services are running${NC}"
echo "Checking backend health..."

if curl -s http://localhost:3001/api/health > /dev/null; then
    echo -e "${GREEN}✓ Backend is running${NC}"
else
    echo -e "${RED}✗ Backend is not running. Please start with: pnpm run dev${NC}"
    exit 1
fi

if curl -s http://localhost:3000 > /dev/null; then
    echo -e "${GREEN}✓ Frontend is running${NC}"
else
    echo -e "${YELLOW}⚠ Frontend may not be running, but continuing...${NC}"
fi

echo
echo -e "${BLUE}Step 2: Check runner service status${NC}"

if curl -s http://localhost:3002/health > /dev/null; then
    echo -e "${GREEN}✓ Runner service is running${NC}"
    RUNNER_STATUS=$(curl -s http://localhost:3002/health | jq -r '.status')
    echo "  Status: $RUNNER_STATUS"
else
    echo -e "${RED}✗ Runner service is not running.${NC}"
    echo "To start runner:"
    echo "  Local: pnpm run dev:runner"
    echo "  Docker: pnpm run docker:runner"
    exit 1
fi

echo
echo -e "${BLUE}Step 3: Test runner integration via backend${NC}"

RUNNER_HEALTH=$(curl -s http://localhost:3001/api/runner/health | jq -r '.runner.healthy')
if [ "$RUNNER_HEALTH" = "true" ]; then
    echo -e "${GREEN}✓ Backend can reach runner service${NC}"
else
    echo -e "${RED}✗ Backend cannot reach runner service${NC}"
    exit 1
fi

echo
echo -e "${BLUE}Step 4: Create an example game session${NC}"

echo "Creating session for example game..."
SESSION_RESPONSE=$(curl -s -X POST http://localhost:3001/api/runner/launch \
  -H "Content-Type: application/json" \
  -d '{
    "gameId": "example-game-001",
    "userId": "demo-user",
    "gameConfig": {
      "type": "example",
      "name": "Demo Game Session"
    }
  }')

if echo "$SESSION_RESPONSE" | jq -e '.success' > /dev/null; then
    SESSION_ID=$(echo "$SESSION_RESPONSE" | jq -r '.session.id')
    STREAM_URL=$(echo "$SESSION_RESPONSE" | jq -r '.session.streamUrl')
    echo -e "${GREEN}✓ Session created successfully!${NC}"
    echo "  Session ID: $SESSION_ID"
    echo "  Stream URL: $STREAM_URL"
    echo "  Status: $(echo "$SESSION_RESPONSE" | jq -r '.session.status')"
else
    echo -e "${RED}✗ Failed to create session${NC}"
    echo "Response: $SESSION_RESPONSE"
    exit 1
fi

echo
echo -e "${BLUE}Step 5: Monitor session for 10 seconds${NC}"

for i in {1..10}; do
    echo -n "Checking session status ($i/10)... "
    STATUS=$(curl -s http://localhost:3001/api/runner/sessions/$SESSION_ID | jq -r '.status')
    echo -e "${GREEN}$STATUS${NC}"
    sleep 1
done

echo
echo -e "${BLUE}Step 6: View active sessions${NC}"

SESSIONS=$(curl -s http://localhost:3001/api/runner/sessions)
SESSION_COUNT=$(echo "$SESSIONS" | jq -r '.count')
echo "Active sessions: $SESSION_COUNT"

if [ "$SESSION_COUNT" -gt 0 ]; then
    echo "Session details:"
    echo "$SESSIONS" | jq '.sessions[] | {id: .id, gameId: .gameId, status: .status, created: .created}'
fi

echo
echo -e "${BLUE}Step 7: View container status directly${NC}"

echo "Docker containers created by runner:"
if docker ps --filter "label=dillinger.type=game-session" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"; then
    echo -e "${GREEN}✓ Container information retrieved${NC}"
else
    echo -e "${YELLOW}⚠ Could not retrieve container info (may need Docker access)${NC}"
fi

echo
echo -e "${BLUE}Step 8: Cleanup (optional)${NC}"

read -p "Stop the created session? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Stopping session $SESSION_ID..."
    STOP_RESPONSE=$(curl -s -X DELETE http://localhost:3001/api/runner/sessions/$SESSION_ID)
    if echo "$STOP_RESPONSE" | jq -e '.success' > /dev/null; then
        echo -e "${GREEN}✓ Session stopped successfully${NC}"
    else
        echo -e "${RED}✗ Failed to stop session${NC}"
        echo "Response: $STOP_RESPONSE"
    fi
fi

echo
echo -e "${GREEN}🎉 Demo completed!${NC}"
echo
echo "Summary:"
echo "- Core web services are running (backend + frontend)"
echo "- Runner service is operational" 
echo "- Successfully created and managed a game session"
echo "- Game container was launched and monitored"
echo
echo "Next steps:"
echo "1. Visit http://localhost:3000 to see the web interface"
echo "2. Visit http://localhost:3001/api/health for backend status"
echo "3. Visit http://localhost:3002/health for runner status"
echo "4. Use the API endpoints to create more sessions"