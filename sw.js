/* Monthly Sales Forecast Assistant — service worker.
 *
 * Change VERSION on every release, in BOTH this file and js/pwa.js, and add
 * any new file to APP_FILES.
 *
 * Files the user chooses (the Express CSV reports) never pass through this
 * worker: they are read from a File object in the page.
 */
const VERSION = '1.1.0';
const CACHE = `monthly-forecast-${VERSION}`;

const APP_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/engine.js',
  './js/import-express.js',
  './js/predictions.js',
  './js/app.js',
  './js/pwa.js',
  './assets/client-logo.png',
  './assets/fonts/chakra-petch-400.ttf',
  './assets/fonts/chakra-petch-500.ttf',
  './assets/fonts/chakra-petch-600.ttf',
  './assets/fonts/chakra-petch-700.ttf',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

/* cache: 'reload' makes install fetch every file from the network, bypassing
   the browser's HTTP cache, so a new version is never precached with files
   still held from the previous release. */
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) =>
    cache.addAll(APP_FILES.map((url) => new Request(url, { cache: 'reload' })))
  ));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith('monthly-forecast-') && key !== CACHE)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

/* The page asks for the new worker only when the user taps Reload. */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  /* Navigations: serve the cached shell so the app opens offline. */
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cached = await caches.match('./index.html', { cacheName: CACHE });
      return cached || fetch(request);
    })());
    return;
  }

  /* App files: cache first, then network, storing the copy. */
  event.respondWith((async () => {
    const cached = await caches.match(request, { cacheName: CACHE, ignoreSearch: true });
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  })());
});
