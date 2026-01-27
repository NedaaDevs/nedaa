#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Running full clean..."

"$SCRIPT_DIR/clean-cache.sh"
"$SCRIPT_DIR/clean-derived.sh"
"$SCRIPT_DIR/clean-pods.sh"

echo "All clean!"
