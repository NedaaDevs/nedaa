#!/bin/bash
set -e

echo "Cleaning iOS Pods..."
rm -rf ios/Pods
rm -rf ios/Podfile.lock
rm -rf ios/build

echo "Pods cleaned!"
