/* Ultimate Connect service worker — lets the installed web app start without a connection.
 *
 * Only same-origin GET requests are handled. Calls to Supabase go to another origin and are
 * never touched here.
 * Bump CACHE when this file's strategy changes; old caches are deleted on activate.
 */
const CACHE = 'uc-web-v2';
const SHELL = '/index.html';
const SLOW_NETWORK_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function storeShell(res) {
  // A redirected response can't be replayed for a navigation, so never keep one.
  if (res.ok && !res.redirected) {
    const copy = res.clone();
    caches.open(CACHE).then((cache) => cache.put(SHELL, copy));
  }
  return res;
}

// Opening the app: network first, so a new deploy shows up right away. The cached shell is
// used when the network fails, or when it hasn't answered after a few seconds (bad hotel
// wifi) — in which case the request keeps going so the next open is fresh.
function openApp(event) {
  const network = fetch(event.request).then(storeShell);
  event.waitUntil(network.catch(() => {}));
  const slow = new Promise((resolve) => setTimeout(() => resolve(null), SLOW_NETWORK_MS));
  return Promise.race([network, slow])
    .then((res) => res || caches.match(SHELL).then((hit) => hit || network))
    .catch(() => caches.match(SHELL));
}

// Hashed build files, fonts and images never change under the same URL: cache first.
function staticAsset(req) {
  return caches.match(req).then(
    (hit) =>
      hit ||
      fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(openApp(event));
  } else if (url.pathname.startsWith('/_expo/static/') || url.pathname.startsWith('/assets/')) {
    event.respondWith(staticAsset(req));
  }
});
