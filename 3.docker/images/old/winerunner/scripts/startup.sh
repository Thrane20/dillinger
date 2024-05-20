#!/bin/bash
set -e

source /opt/gow/bash-lib/utils.sh

gow_log "Starting winerunner (courtesy of Game On Whales)"

# Start Steam. Use `sudo` to make sure that group membership gets reloaded
exec /bin/bash