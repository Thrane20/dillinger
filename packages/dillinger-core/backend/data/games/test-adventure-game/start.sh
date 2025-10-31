#!/bin/bash
# Simple test game for the Linux Native Runner
# This is a text-based adventure game that demonstrates the runner works

# Ensure proper terminal settings
stty sane 2>/dev/null || true

echo "╔════════════════════════════════════╗"
echo "║   DILLINGER TEST GAME v1.0         ║"
echo "║   A Simple Text Adventure          ║"
echo "╚════════════════════════════════════╝"
echo ""
echo "This test game proves the runner is working correctly."
echo ""

# Check if save directory exists
SAVE_FILE="${SAVE_DIR:-/saves}/test-game-progress.txt"

if [ -f "$SAVE_FILE" ]; then
    echo "Welcome back! Loading your progress..."
    SCORE=$(cat "$SAVE_FILE")
    echo "Your previous score: $SCORE"
else
    echo "New game started!"
    SCORE=0
fi

echo ""
echo "═══════════════════════════════════"
echo " THE ADVENTURE BEGINS"
echo "═══════════════════════════════════"
echo ""
echo "You find yourself in a mysterious digital realm."
echo "The legendary Dillinger system has awakened you."
echo ""

# Simple game loop without select (more compatible with containers)
while true; do
    echo ""
    echo "What would you like to do?"
    echo "  1) Explore the area"
    echo "  2) Check inventory"
    echo "  3) Rest at campfire"
    echo "  4) Save and quit"
    echo ""
    read -p "Enter your choice (1-4): " choice
    
    case $choice in
        1)
            echo ""
            echo "You venture forth and discover a hidden treasure!"
            SCORE=$((SCORE + 10))
            echo "★ +10 points! Current score: $SCORE"
            ;;
        2)
            echo ""
            echo "═══════════════"
            echo " INVENTORY"
            echo "═══════════════"
            echo " • Dillinger Key"
            echo " • Map Fragment"
            echo " • Score: $SCORE points"
            ;;
        3)
            echo ""
            echo "You rest by the warm fire and regain your strength."
            echo "Current score: $SCORE"
            ;;
        4)
            echo ""
            echo "Saving your progress..."
            mkdir -p "$(dirname "$SAVE_FILE")" 2>/dev/null || true
            echo "$SCORE" > "$SAVE_FILE"
            echo "Game saved! Final score: $SCORE"
            echo ""
            echo "Thanks for testing the Dillinger Runner!"
            echo "Your save file is at: $SAVE_FILE"
            exit 0
            ;;
        *)
            echo ""
            echo "Invalid option. Please enter 1-4."
            ;;
    esac
done
