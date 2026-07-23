// Service worker mínimo — necessário para o navegador considerar o site "instalável".
const CACHE_NAME = "controle-financeiro-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Passa direto para a rede; não faz cache agressivo para não mostrar dados desatualizados.
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
