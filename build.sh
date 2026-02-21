#!/bin/bash
# Pre-create the icon in every location zeus looks for it
# before the Qs post-processing step runs.

TARGET="dist/amazfit-bip-6-MHS-390x450/device/assets"
mkdir -p "$TARGET"
cp assets/icon.png "$TARGET/icon.png"
cp assets/icon.png "$TARGET/icon.png_origin"

echo "[setup] Icon placed in dist assets — running zeus build..."
zeus build
