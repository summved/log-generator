#!/bin/bash

# Timed demo script with custom duration
# Usage: ./scripts/timed-demo.sh [seconds]

# Set default timeout duration (45 seconds)
DEFAULT_TIMEOUT=45

if [ $# -eq 0 ]; then
    # No arguments provided, use default
    TIMEOUT_DURATION=$DEFAULT_TIMEOUT
elif [[ "$1" =~ ^[0-9]+$ ]]; then
    # First argument is a number (timeout duration)
    TIMEOUT_DURATION=$1
else
    # First argument is not a number, use default timeout
    TIMEOUT_DURATION=$DEFAULT_TIMEOUT
fi

echo "🎬 Starting timed demo for ${TIMEOUT_DURATION} seconds..."
./scripts/timeout.sh "$TIMEOUT_DURATION" sh -c "node examples/basic-usage.js"
