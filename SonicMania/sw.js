const CACHE_NAME = 'sonicmania-local-rsdk-v6';
const STATIC_FILES = [
  'index.html',
  'RSDKv5.html',
  'RSDKv5.js',
  'RSDKv5.wasm',
  'card.png',
  'favicon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function streamRSDK(request) {
  const manifestResponse = await fetch(new URL('rsdk-manifest.json', request.url), { cache: 'no-store' });
  if (!manifestResponse.ok) throw new Error('Unable to load rsdk-manifest.json: HTTP ' + manifestResponse.status);
  const manifest = await manifestResponse.json();
  if (!manifest || !Number.isSafeInteger(manifest.size) || !Array.isArray(manifest.parts) || !manifest.parts.length) {
    throw new Error('Invalid rsdk-manifest.json');
  }
  const partTotal = manifest.parts.reduce((sum, part) => {
    if (!part || !Number.isSafeInteger(part.size) || part.size < 0) throw new Error('Invalid RSDK part size');
    return sum + part.size;
  }, 0);
  if (partTotal !== manifest.size) throw new Error('RSDK manifest size does not match the sum of its parts');

  let partIndex = 0;
  let totalBytes = 0;
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        if (partIndex >= manifest.parts.length) {
          if (totalBytes !== manifest.size) throw new Error('RSDK stream size mismatch');
          controller.close();
          return;
        }

        const part = manifest.parts[partIndex];
        if (typeof part.url !== 'string' || !/^rsdk\/part-\d{3}\.bin$/.test(part.url)) {
          throw new Error('Invalid RSDK part URL at part ' + (partIndex + 1));
        }
        const partUrl = new URL(part.url, request.url);
        if (partUrl.origin !== new URL(request.url).origin) throw new Error('RSDK part is not hosted on this game site');

        let bytes = null;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            const response = await fetch(partUrl, { cache: 'no-store' });
            if (!response.ok) {
              const error = new Error('Unable to load ' + part.url + ': HTTP ' + response.status);
              error.retryable = response.status === 429 || response.status >= 500;
              throw error;
            }
            const buffer = await response.arrayBuffer();
            if (buffer.byteLength !== part.size) {
              const error = new Error(part.url + ': expected ' + part.size + ' bytes, received ' + buffer.byteLength);
              error.retryable = true;
              throw error;
            }
            bytes = new Uint8Array(buffer);
            break;
          } catch (error) {
            if (attempt >= 2 || !(error.retryable || error.name === 'TypeError')) throw error;
            await delay(400 * (attempt + 1));
          }
        }
        if (!bytes) throw new Error('Unable to load RSDK part ' + (partIndex + 1));

        totalBytes += bytes.byteLength;
        controller.enqueue(bytes);
        partIndex += 1;
        if (partIndex === manifest.parts.length) {
          if (totalBytes !== manifest.size) throw new Error('RSDK stream size mismatch');
          controller.close();
        }
      } catch (error) {
        controller.error(error);
      }
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(manifest.size),
      'Cache-Control': 'no-store'
    }
  });
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.endsWith('/rsdk-manifest.json') || /\/rsdk\/part-\d{3}\.bin$/.test(url.pathname)) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }
  if (url.pathname.endsWith('/RSDKv5.rsdk')) {
    event.respondWith(streamRSDK(event.request));
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok && event.request.method === 'GET') {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }))
  );
});
