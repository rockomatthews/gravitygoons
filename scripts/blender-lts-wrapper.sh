#!/bin/bash
set -e

# The installed 5.x builds crash in Metal device detection on this Apple M5.
# Mount the checksum-verified 4.5.1 LTS image read-only at a deterministic path.
DMG='/Users/rob/Documents/Codex/.tools/blender-4.5.1-macos-arm64.dmg'
MOUNTPOINT='/private/tmp/gravity-goons-blender-4.5.1'
BLENDER="$MOUNTPOINT/Blender.app/Contents/MacOS/Blender"
NATIVE_VOLUME_BLENDER='/Volumes/Blender/Blender.app/Contents/MacOS/Blender'

if [[ -x "$NATIVE_VOLUME_BLENDER" ]]; then
  BLENDER="$NATIVE_VOLUME_BLENDER"
elif [[ ! -x "$BLENDER" ]]; then
  mkdir -p "$MOUNTPOINT"
  hdiutil attach -quiet -nobrowse -readonly -mountpoint "$MOUNTPOINT" "$DMG"
fi

exec "$BLENDER" "$@"
