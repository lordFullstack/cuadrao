// Caja del Día — service worker. Subir VERSION en cada entrega para no quedar con caché vieja.
const VERSION = 'cajadia-v1.0.0';
const ARCHIVOS = ['./', './index.html', './manifest.webmanifest', './icon.svg'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Red primero (para traer la versión nueva), caché si no hay internet
  e.respondWith(
    fetch(e.request).then((r) => {
      const copia = r.clone();
      if (r.ok && (e.request.url.startsWith(self.location.origin) || e.request.url.includes('cdnjs.cloudflare.com') || e.request.url.includes('fonts.g'))) {
        caches.open(VERSION).then((c) => c.put(e.request, copia));
      }
      return r;
    }).catch(() => caches.match(e.request))
  );
});
