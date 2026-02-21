#!/bin/bash
# Pre-create the icon in every location zeus looks for it
# before the Qs post-processing step runs.

TARGET="dist/gtr-4/device/assets"
mkdir -p "$TARGET"
cp assets/gtr-4.r/icon.png "$TARGET/icon.png"
cp assets/gtr-4.r/icon.png "$TARGET/icon.png_origin"

echo "[setup] Icon placed in dist assets — running zeus build..."
zeus build
