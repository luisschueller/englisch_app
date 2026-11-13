// Network-first, damit Updates sofort ankommen; Cache nur als Offline-Reserve.
const CACHE = 'englisch-app-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const { origin, pathname } = new URL(req.url);
  const sdk = origin === 'https://www.gstatic.com' && pathname.startsWith('/firebasejs/');
  if (req.method !== 'GET' || (origin !== location.origin && !sdk)) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
