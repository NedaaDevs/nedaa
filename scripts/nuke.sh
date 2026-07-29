#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Nuking everything..."

"$SCRIPT_DIR/clean-all.sh"

# Gradle's up-to-date state lives apart from the compiled output it describes. Leaving
# either side behind yields a build that succeeds with an empty output directory, which
# only surfaces later as a runtime NoClassDefFoundError.
echo "Removing local native module build output..."
rm -rf "$PROJECT_DIR"/modules/*/android/build
rm -rf "$PROJECT_DIR"/modules/*/android/.cxx

echo "Removing CMake and Kotlin build state..."
rm -rf "$PROJECT_DIR/android/app/.cxx"
rm -rf "$PROJECT_DIR/android/.kotlin"

# Third-party module build output and .cxx dirs go with node_modules itself.
echo "Removing node_modules..."
rm -rf "$PROJECT_DIR/node_modules"

echo "Nuke complete. Run 'bun install' next."
