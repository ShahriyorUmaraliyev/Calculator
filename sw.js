'use strict';

var CACHE   = 'kalkulyator-v35';
var STATIC  = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

/* Currency endpointlar — hech qachon cache qilinmaydi (network-only) */
var CURRENCY_HOSTS = [
  'cbu.uz',
  'allorigins.win',
  'corsproxy.io',
  'jsdelivr.net',
  'currency-api.pages.dev',
  'open.er-api.com',
  'codetabs.com'
];

function isCurrency(url) {
  return CURRENCY_HOSTS.some(function(h){ return url.indexOf(h) !== -1; });
}

/* Install — static fayllarni yuklab olish */
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return Promise.allSettled(
        STATIC.map(function(f){ return cache.add(f); })
      );
    })
  );
  self.skipWaiting();
});

/* Activate — eski keshlarni o'chirish */
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE; })
            .map(function(k){ return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

/* Fetch */
self.addEventListener('fetch', function(e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  /* Currency — network-only, SW dan o'tkazmaymiz */
  if (isCurrency(req.url)) return;

  /* Static — cache-first + background update */
  e.respondWith(
    caches.match(req).then(function(cached) {
      var networkFetch = fetch(req).then(function(r) {
        if (r && r.status === 200) {
          caches.open(CACHE).then(function(c){ c.put(req, r.clone()); });
        }
        return r;
      }).catch(function(){});

      return cached
        ? (networkFetch.catch(function(){}), cached)
        : networkFetch.then(function(r){
            return r || caches.match('/index.html');
          });
    })
  );
});
