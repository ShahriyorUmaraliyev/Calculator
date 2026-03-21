var CACHE = 'kalkulyator-v23';
var FILES = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

/* Tashqi so'rovlar — hech qachon cache qilinmaydi */
function isExternal(url) {
  return url.indexOf('cbu.uz')        !== -1
      || url.indexOf('allorigins.win') !== -1
      || url.indexOf('corsproxy.io')   !== -1
      || url.indexOf('codetabs.com')   !== -1;
}

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return Promise.allSettled(
        FILES.map(function(f){ return cache.add(f); })
      );
    })
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
  var req = e.request;
  if (req.method !== 'GET') return;
  if (isExternal(req.url)) return; /* API lar — SW dan o'tkazmaymiz */

  e.respondWith(
    caches.match(req).then(function(cached) {
      /* Har doim tarmoqdan ham yuklab, cache ni yangilaymiz */
      var networkFetch = fetch(req).then(function(r) {
        if (r && r.status === 200) {
          caches.open(CACHE).then(function(c){ c.put(req, r.clone()); });
        }
        return r;
      }).catch(function(){});

      /* Cache bor — darhol ber, fonda yangilash */
      if (cached) {
        networkFetch.catch(function(){});
        return cached;
      }
      /* Cache yo'q — tarmoqdan yuk */
      return networkFetch.then(function(r){
        return r || caches.match('/index.html');
      });
    })
  );
});
