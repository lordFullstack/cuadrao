// Cuadrao — service worker. El build reemplaza VERSION y ARCHIVOS en cada entrega.
// Guarda toda la app al instalarse, así abre sin internet; al publicar una versión nueva
// cambia VERSION, el celular baja la nueva y borra la vieja.
const VERSION = '__VERSION__';
const ARCHIVOS = __ARCHIVOS__;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;
  // Abrir la app (navegación): siempre la página guardada
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html').then((r) => r || fetch(req)));
    return;
  }
  // Lo demás: primero lo guardado, si no está, internet
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((r) => r || fetch(req)));
});
