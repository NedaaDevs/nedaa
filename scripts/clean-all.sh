#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Running full clean..."

"$SCRIPT_DIR/clean-cache.sh"
"$SCRIPT_DIR/clean-derived.sh"
"$SCRIPT_DIR/clean-pods.sh"

ANDROID_DIR="$(dirname "$SCRIPT_DIR")/android"
if [ -d "$ANDROID_DIR" ]; then
  echo "Cleaning Android build..."
  cd "$ANDROID_DIR" && ./gradlew clean 2>/dev/null || true
fi

echo "All clean!"
