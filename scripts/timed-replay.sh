#!/bin/bash

# Timed replay script with custom duration
# Usage: ./scripts/timed-replay.sh [seconds] [additional args]

# Set default timeout duration (30 seconds)
DEFAULT_TIMEOUT=30

if [ $# -eq 0 ]; then
    # No arguments provided, use default
    TIMEOUT_DURATION=$DEFAULT_TIMEOUT
elif [[ "$1" =~ ^[0-9]+$ ]]; then
    # First argument is a number (timeout duration)
    TIMEOUT_DURATION=$1
    shift
else
    # First argument is not a number, use default timeout and pass all args
    TIMEOUT_DURATION=$DEFAULT_TIMEOUT
fi

echo "🔄 Starting timed log replay for ${TIMEOUT_DURATION} seconds..."
./scripts/timeout.sh "$TIMEOUT_DURATION" sh -c "npm run replay -- $*"
