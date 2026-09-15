/* Elemental Evolves service worker — cache-first shell, network for the rest */
var CACHE = 'ee-shell-v1';
var PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './ship.js',
  './ship.css',
  './sw.js',
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

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  // Same-origin only
  if (url.origin !== self.location.origin) return;

  // Cache-first for precached shell / hashed assets / icons / keyart
  event.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req).then(function (hit) {
        if (hit) return hit;
        return fetch(req)
          .then(function (res) {
            // Opportunistically cache successful GETs under our origin for assets
            if (res && res.ok && (url.pathname.indexOf('/assets/') !== -1 || url.pathname.match(/\.(js|css|png|jpg|webmanifest)$/))) {
              try {
                cache.put(req, res.clone());
              } catch (e) {}
            }
            return res;
          })
          .catch(function () {
            // Offline navigation fallback
            if (req.mode === 'navigate') return cache.match('./index.html');
            return cache.match(req);
          });
      });
    })
  );
});
