const CACHE = 'ewcards-v4';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];
// CDN libraries needed for barcode/QR rendering, scanning and transfer (NOT tesseract — its model is ~10MB).
const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.5.0/lz-string.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(SHELL);
    // cache libs individually so one failure doesn't abort install
    await Promise.allSettled(LIBS.map((u) => c.add(new Request(u, { mode: 'cors' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  const isCDNlib = url.hostname === 'cdnjs.cloudflare.com';

  // Immutable CDN libraries -> cache-first (reliable offline)
  if (isCDNlib) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res && res.ok) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); }
        return res;
      }))
    );
    return;
  }

  // Everything else -> network, then cache; fall back to cache offline.
  const opts = sameOrigin ? { cache: 'reload' } : undefined;
  e.respondWith(
    fetch(req, opts)
      .then((res) => {
        if (res && res.ok) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('/index.html') : undefined)))
  );
});
