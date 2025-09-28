#!/bin/bash

# Cross-platform timeout script
# Usage: ./scripts/timeout.sh <seconds> <command>

TIMEOUT_DURATION=$1
shift
COMMAND="$@"

if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - use Perl-based timeout
    perl -e "alarm $TIMEOUT_DURATION; exec @ARGV" -- "$@" 2>/dev/null
elif command -v timeout >/dev/null 2>&1; then
    # Linux - use native timeout command
    timeout "$TIMEOUT_DURATION" "$@"
elif command -v gtimeout >/dev/null 2>&1; then
    # GNU coreutils timeout (if installed via brew)
    gtimeout "$TIMEOUT_DURATION" "$@"
else
    # Fallback - run command without timeout
    echo "Warning: No timeout command available, running without timeout limit"
    "$@"
fi
