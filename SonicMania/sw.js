const OLD_CACHE_NAME = 'sonicmania-local-rsdk-v6';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.delete(OLD_CACHE_NAME).then(() => self.clients.claim())
  );
});
