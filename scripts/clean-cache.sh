#!/bin/bash
set -e

echo "Cleaning Metro/Expo/Tamagui cache..."
rm -rf node_modules/.cache
rm -rf .expo
rm -rf .tamagui
watchman watch-del-all 2>/dev/null || true

echo "Cache cleared!"
