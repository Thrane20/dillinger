#!/bin/bash
# Dillinger Core Entrypoint
# Handles PUID/PGID permission setup before starting the application

set -e

# Default to uid/gid 1000 if not specified
PUID=${PUID:-1000}
PGID=${PGID:-1000}
APP_USER="dillinger"
DATA_DIR="${DILLINGER_CORE_PATH:-/data}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Dillinger Core - Starting"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PUID: $PUID"
echo "  PGID: $PGID"
echo "  Data: $DATA_DIR"

# Only do permission fixup if running as root
if [ "$(id -u)" = "0" ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Setting up permissions..."
    
    # Get current uid/gid of the app user
    CURRENT_UID=$(id -u $APP_USER 2>/dev/null || echo "1001")
    CURRENT_GID=$(id -g $APP_USER 2>/dev/null || echo "1001")
    
    # Update group if needed
    if [ "$CURRENT_GID" != "$PGID" ]; then
        echo "  Updating $APP_USER group to GID $PGID"
        groupmod -o -g "$PGID" nodejs 2>/dev/null || groupmod -o -g "$PGID" $APP_USER 2>/dev/null || true
    fi
    
    # Update user if needed
    if [ "$CURRENT_UID" != "$PUID" ]; then
        echo "  Updating $APP_USER user to UID $PUID"
        usermod -o -u "$PUID" $APP_USER 2>/dev/null || true
    fi
    
    # Fix ownership of data directory (only top-level to avoid long startup)
    # Deep directories will inherit permissions when created
    if [ -d "$DATA_DIR" ]; then
        echo "  Fixing ownership of $DATA_DIR..."
        # Fix ownership of immediate children only (fast)
        chown $PUID:$PGID "$DATA_DIR" 2>/dev/null || true
        find "$DATA_DIR" -maxdepth 2 -exec chown $PUID:$PGID {} \; 2>/dev/null || true
    fi
    
    # Fix ownership of app directory
    chown -R $PUID:$PGID /app 2>/dev/null || true
    
    echo "  ✓ Permissions configured"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Drop privileges and run the command as the app user
    # Using gosu for proper signal handling
    exec gosu $PUID:$PGID "$@"
else
    # Already running as non-root, just exec
    echo "  Running as UID $(id -u)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exec "$@"
fi
