#!/usr/bin/env bash
set -euo pipefail

# Build a Cloudflare Pages-compatible copy without changing the Vercel source tree.
# Usage: tools/prepare-cloudflare-pages.sh [OUTPUT_DIR]
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
OUTPUT=${1:-"$ROOT/.cloudflare-pages"}
CHUNK_BYTES=$((24 * 1024 * 1024))
rm -rf "$OUTPUT"
mkdir -p "$OUTPUT"

tar -C "$ROOT" --exclude='./.git' --exclude='./.cloudflare-pages' --exclude='./tools' -cf - . | tar -C "$OUTPUT" -xf -

find "$OUTPUT" -type f -size +24M -print0 | while IFS= read -r -d '' file; do
  prefix="$file.part"
  split -b "$CHUNK_BYTES" -d -a 3 -- "$file" "$prefix"
  rm -f -- "$file"
done

# One worker is placed beside every affected game entrypoint. It reconstructs
# FILE from FILE.part000, FILE.part001, ... on demand.
find "$OUTPUT" -type f -name '*.part000' -printf '%h\n' | sort -u | while IFS= read -r dir; do
  cat > "$dir/sw.js" <<'WORKER'
const VERSION = 'gamehub-parts-v1';
self.addEventListener('install', event => { self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url);
  if (/\.part\d{3}$/.test(url.pathname)) return;
  event.respondWith(reassembleOrFetch(request));
});
async function reassembleOrFetch(request) {
  const url = new URL(request.url);
  const firstUrl = new URL(url.href);
  firstUrl.pathname += '.part000';
  const first = await fetch(firstUrl.href, { cache: 'force-cache' });
  if (!first.ok) return fetch(request);
  const buffers = [await first.arrayBuffer()];
  for (let index = 1; index < 10000; index += 1) {
    const partUrl = new URL(url.href);
    partUrl.pathname += `.part${String(index).padStart(3, '0')}`;
    const response = await fetch(partUrl.href, { cache: 'force-cache' });
    if (response.status === 404) break;
    if (!response.ok) throw new Error(`Unable to load ${partUrl.pathname}`);
    buffers.push(await response.arrayBuffer());
  }
  const headers = new Headers();
  const contentType = first.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  return new Response(new Blob(buffers), { status: 200, headers });
}
WORKER
  if [ -f "$dir/index.html" ] && ! grep -q 'gamehub-parts-sw' "$dir/index.html"; then
    sed -i 's#</head>#<script id="gamehub-parts-sw">navigator.serviceWorker\&\&navigator.serviceWorker.register("./sw.js");</script></head>#i' "$dir/index.html"
  fi
done
printf 'Cloudflare Pages copy prepared at %s\n' "$OUTPUT"
