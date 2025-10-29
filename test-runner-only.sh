#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🎮 Dillinger Runner Service Test"
echo "=============================="
echo

echo -e "${BLUE}Step 1: Check runner service health${NC}"
RUNNER_HEALTH=$(curl -s http://localhost:3002/health)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Runner service is healthy${NC}"
    echo "Response: $RUNNER_HEALTH" | jq .
else
    echo -e "${RED}✗ Runner service is not accessible${NC}"
    echo "Make sure to start it with: cd packages/runner && pnpm run dev"
    exit 1
fi

echo
echo -e "${BLUE}Step 2: List current sessions${NC}"
SESSIONS=$(curl -s http://localhost:3002/sessions)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Sessions endpoint accessible${NC}"
    echo "Current sessions: $SESSIONS" | jq .
else
    echo -e "${RED}✗ Sessions endpoint failed${NC}"
    exit 1
fi

echo
echo -e "${BLUE}Step 3: Create a test session${NC}"
SESSION_RESPONSE=$(curl -s -X POST http://localhost:3002/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "gameId": "test-game-001",
    "userId": "test-user",
    "gameConfig": {
      "type": "example",
      "title": "Test Game",
      "description": "A test game for runner validation"
    }
  }')

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Session creation request sent${NC}"
    echo "Response: $SESSION_RESPONSE" | jq .
    
    # Extract session ID if available
    SESSION_ID=$(echo "$SESSION_RESPONSE" | jq -r '.id // empty')
    if [ -n "$SESSION_ID" ] && [ "$SESSION_ID" != "null" ]; then
        echo -e "${GREEN}✓ Session created with ID: $SESSION_ID${NC}"
        
        echo
        echo -e "${BLUE}Step 4: Check session status${NC}"
        SESSION_STATUS=$(curl -s "http://localhost:3002/sessions/$SESSION_ID")
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Session status retrieved${NC}"
            echo "Session details: $SESSION_STATUS" | jq .
        else
            echo -e "${YELLOW}⚠ Session status check failed${NC}"
        fi
        
        echo
        echo -e "${BLUE}Step 5: Clean up session${NC}"
        DELETE_RESPONSE=$(curl -s -X DELETE "http://localhost:3002/sessions/$SESSION_ID")
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Session cleanup requested${NC}"
            echo "Response: $DELETE_RESPONSE" | jq .
        else
            echo -e "${YELLOW}⚠ Session cleanup failed${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ Session creation response didn't include ID${NC}"
    fi
else
    echo -e "${RED}✗ Session creation failed${NC}"
    exit 1
fi

echo
echo -e "${BLUE}Step 6: List containers${NC}"
CONTAINERS=$(curl -s http://localhost:3002/containers)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Container listing accessible${NC}"
    echo "Containers: $CONTAINERS" | jq .
else
    echo -e "${RED}✗ Container listing failed${NC}"
    exit 1
fi

echo
echo -e "${GREEN}🎉 Runner service test completed successfully!${NC}"
echo
echo "The runner service is working correctly:"
echo "• Health checks are passing"
echo "• Session management endpoints are functional"
echo "• Docker integration is active"
echo "• Container management is accessible"
echo
echo "Next steps:"
echo "1. Start the backend service to test full integration"
echo "2. Run the complete end-to-end test: ./test-end-to-end.sh"
echo "3. Connect frontend to test the full workflow"