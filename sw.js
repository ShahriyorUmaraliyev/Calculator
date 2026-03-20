var CACHE = 'kalkulyator-v10';
var FILES = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(FILES);
    }).catch(function(){})
  );
  self.skipWaiting();
});

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

self.addEventListener('fetch', function(e) {
  var url = e.request.url;
  /* Tashqi API lar — cache qilmaymiz */
  if (url.indexOf('cbu.uz')!==-1 || url.indexOf('allorigins.win')!==-1) return;
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) {
        /* Fon da yangilash */
        fetch(e.request).then(function(r) {
          if (r && r.status===200) {
            caches.open(CACHE).then(function(c){ c.put(e.request, r); });
          }
        }).catch(function(){});
        return cached;
      }
      return fetch(e.request).then(function(r) {
        if (!r || r.status!==200) return r;
        caches.open(CACHE).then(function(c){ c.put(e.request, r.clone()); });
        return r;
      }).catch(function(){
        return caches.match('/index.html');
      });
    })
  );
});
