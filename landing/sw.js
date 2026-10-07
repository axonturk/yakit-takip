// The app moved to /app/ and has its own service worker there.
// This replaces the old root worker so it stops handling hisapo.com pages.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('yakit-takip-')).map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
  );
});
