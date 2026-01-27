#!/bin/bash
set -e

echo "Cleaning Metro/Expo cache..."
rm -rf node_modules/.cache
rm -rf .expo
watchman watch-del-all 2>/dev/null || true

echo "Cache cleared!"
