#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

"$SCRIPT_DIR/clean-pods.sh"

echo "Reinstalling Pods..."
cd "$PROJECT_DIR/ios" && pod install

echo "iOS reinstall complete!"
