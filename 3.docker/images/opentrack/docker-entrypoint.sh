#!/bin/bash

# Start the process in the background
tail -f /dev/null &

# Save the process ID
PID=$!

# Set up a trap to kill the background process when this script receives a SIGTERM signal
trap "kill $PID" SIGTERM

# Wait for the background process to finish
wait $PID