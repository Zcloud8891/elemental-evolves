/* Elemental Evolves service worker
 * - Hashed assets / images: cache-first
 * - HTML / ship shell / navigations: network-first (so Pages deploys win over stale shells)
 * Bump CACHE whenever the shell or asset filenames change.
 */
var CACHE = 'ee-shell-v2';
var PRECACHE = [
  './manifest.webmanifest',
  './ship.css',
  './assets/styles-Cx26EWNc.css',
  './assets/index-BZl0-dnr.js',
  './assets/routes-D8ZwckNV.js',
  './assets/login-C6uVTkaF.js',
  './elemental-evolves-keyart.jpg',
  './realm-floor.jpg',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/icon-1024.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(PRECACHE);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (k) {
          if (k !== CACHE) return caches.delete(k);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function isShellDoc(url) {
  var p = url.pathname;
  // Project Pages live under /elemental-evolves/
  if (p.endsWith('/') || p.endsWith('/index.html') || /\/index\.html$/.test(p)) return true;
  if (p.endsWith('/ship.js') || p.endsWith('/sw.js') || p.endsWith('/ship.css')) return true;
  return false;
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigations + HTML/ship shell: network-first, cache fallback for offline
  if (req.mode === 'navigate' || isShellDoc(url)) {
    event.respondWith(
      fetch(req)
        .then(function (res) {
          if (res && res.ok) {
            var copy = res.clone();
            caches.open(CACHE).then(function (cache) {
              try {
                cache.put(req, copy);
              } catch (e) {}
            });
          }
          return res;
        })
        .catch(function () {
          return caches.open(CACHE).then(function (cache) {
            return cache.match(req).then(function (hit) {
              if (hit) return hit;
              if (req.mode === 'navigate') return cache.match('./index.html');
              return undefined;
            });
          });
        })
    );
    return;
  }

  // Hashed assets / icons / art: cache-first
  event.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (res) {
          if (res && res.ok && (url.pathname.indexOf('/assets/') !== -1 || url.pathname.match(/\.(js|css|png|jpg|webmanifest)$/))) {
            try {
              cache.put(req, res.clone());
            } catch (e) {}
          }
          return res;
        });
      });
    })
  );
});
