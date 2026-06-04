const CACHE_NAME = 'voleybol-panel-v3';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './icon.svg',
  './manifest.json',
  './logo.png',
  './background.jpg'
];

// Install Event - Pre-cache Assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate Event - Clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch Event - Cache First, fallback to Network
self.addEventListener('fetch', (e) => {
  // Do not intercept cloud database API calls, let them fetch live data!
  if (e.request.url.includes('immanuel.co') || e.request.url.includes('extendsclass') || e.request.url.includes('api')) {
    return;
  }
  
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request).then((response) => {
        // Cache new successful requests dynamically
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return response;
      });
    }).catch(() => {
      // Offline fallback
      return caches.match('./index.html');
    })
  );
});
