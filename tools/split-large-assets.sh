#!/usr/bin/env bash
set -euo pipefail

# Split one file into parts accepted by Cloudflare Pages (25 MiB max).
# Usage: tools/split-large-assets.sh path/to/file [output-prefix]
# The original is kept; use join-large-asset.sh to reconstruct it at runtime/build time.
CHUNK_BYTES=$((24 * 1024 * 1024))
INPUT=${1:?usage: $0 FILE [PREFIX]}
PREFIX=${2:-"$INPUT.part"}

[ -f "$INPUT" ] || { echo "File not found: $INPUT" >&2; exit 1; }
rm -f "$PREFIX"[0-9][0-9][0-9]
split -b "$CHUNK_BYTES" -d -a 3 -- "$INPUT" "$PREFIX"
printf 'Created parts for %s using %s-byte chunks (suffixes start at 000)\n' "$INPUT" "$CHUNK_BYTES"
