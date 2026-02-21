#!/bin/bash
# Pre-create the icon in every location zeus looks for it
# before the Qs post-processing step runs.

TARGET="dist/gtr-3-pro/device/assets"
mkdir -p "$TARGET"
cp assets/gtr-3-pro.r/icon.png "$TARGET/icon.png"
cp assets/gtr-3-pro.r/icon.png "$TARGET/icon.png_origin"

echo "[setup] Icon placed in dist assets — running zeus build..."
zeus build
