#!/bin/bash
# Test the game launching system

set -e

echo "🎮 Dillinger Game Launch Test"
echo "=============================="
echo ""

# Check if backend is running
echo "1️⃣  Checking backend health..."
if curl -s http://localhost:3011/api/health > /dev/null 2>&1; then
    echo "✅ Backend is running"
else
    echo "❌ Backend is not running on port 3011"
    echo "   Start it with: cd packages/dillinger-core/backend && pnpm run dev"
    exit 1
fi

# Check if runner image exists
echo ""
echo "2️⃣  Checking Docker runner image..."
if docker images | grep -q "dillinger/runner-linux-native"; then
    echo "✅ Runner image found"
else
    echo "❌ Runner image not found"
    echo "   Build it with: cd packages/runner-images/linux-native && ./build.sh"
    exit 1
fi

# Launch the test game
echo ""
echo "3️⃣  Launching test game..."
RESPONSE=$(curl -s -X POST http://localhost:3011/api/games/test-adventure-game/launch)

if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "✅ Game launched successfully!"
    echo ""
    echo "Response:"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    
    # Extract session ID
    SESSION_ID=$(echo "$RESPONSE" | jq -r '.session.id' 2>/dev/null)
    CONTAINER_ID=$(echo "$RESPONSE" | jq -r '.session.containerId' 2>/dev/null)
    
    echo ""
    echo "4️⃣  Container information:"
    echo "   Session ID: $SESSION_ID"
    echo "   Container ID: ${CONTAINER_ID:0:12}"
    
    echo ""
    echo "5️⃣  Checking container status..."
    if docker ps | grep -q "${CONTAINER_ID:0:12}"; then
        echo "✅ Container is running"
        docker ps --filter "id=${CONTAINER_ID:0:12}" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
    else
        echo "⚠️  Container not found (may have already stopped)"
    fi
    
    echo ""
    echo "6️⃣  Container logs (last 20 lines):"
    echo "----------------------------------------"
    docker logs "${CONTAINER_ID:0:12}" 2>&1 | tail -20
    echo "----------------------------------------"
    
    echo ""
    echo "✅ Test completed!"
    echo ""
    echo "To stop the game:"
    echo "  curl -X POST http://localhost:3011/api/games/test-adventure-game/stop \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -d '{\"sessionId\":\"$SESSION_ID\"}'"
    
else
    echo "❌ Failed to launch game"
    echo ""
    echo "Error response:"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    exit 1
fi
