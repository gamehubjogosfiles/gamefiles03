const CACHE_NAME = 'sonicmania-local-rsdk-v2';
const STATIC_FILES = [
  'index.html',
  'RSDKv5.html',
  'RSDKv5.js',
  'RSDKv5.wasm',
  'rsdk-manifest.json',
  'card.png',
  'favicon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function streamRSDK(request) {
  const manifestResponse = await fetch(new URL('rsdk-manifest.json', request.url), { cache: 'no-store' });
  if (!manifestResponse.ok) throw new Error('Unable to load rsdk-manifest.json');
  const manifest = await manifestResponse.json();
  let partIndex = 0;
  let reader = null;
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        while (true) {
          if (!reader) {
            if (partIndex >= manifest.parts.length) {
              controller.close();
              return;
            }
            const partUrl = new URL(manifest.parts[partIndex].url, request.url);
            const response = await fetch(partUrl, { cache: 'no-store' });
            if (!response.ok || !response.body) throw new Error('Unable to load ' + partUrl.pathname);
            reader = response.body.getReader();
          }
          const item = await reader.read();
          if (!item.done) {
            controller.enqueue(item.value);
            return;
          }
          reader = null;
          partIndex += 1;
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
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  });
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
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
