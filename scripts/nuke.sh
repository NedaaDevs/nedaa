#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Nuking everything..."

"$SCRIPT_DIR/clean-all.sh"

echo "Removing node_modules..."
rm -rf "$PROJECT_DIR/node_modules"

echo "Reinstalling dependencies..."
cd "$PROJECT_DIR" && bun install

# "$SCRIPT_DIR/reinstall-ios.sh"

echo "Nuke complete! Fresh start ready."
