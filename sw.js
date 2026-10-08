// Offline support. Network-first for the app's own files so updates show up on the next load;
// cache is the fallback when offline. Fonts: stale-while-revalidate.
const VERSION = 'bdc-v5';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/favicon.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    const key = req.mode === 'navigate' ? 'index.html' : url.pathname;
    e.respondWith(
      fetch(req, { cache: 'no-cache' }).then(r => {
        if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(key, copy)); }
        return r;
      }).catch(async () => (await caches.match(key)) || (await caches.match(req, { ignoreSearch: true })) || caches.match('index.html'))
    );
    return;
  }
  if (url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com') {
    e.respondWith(caches.open(VERSION).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
  }
});
