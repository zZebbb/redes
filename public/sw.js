// Service worker mínimo: só permite instalar o site como app (tela cheia no tablet).
// Não guarda nada em cache: tudo vem da rede, como num site normal.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (ev) { ev.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (ev) {
  if (ev.request.method !== 'GET') return;
  ev.respondWith(fetch(ev.request));
});
