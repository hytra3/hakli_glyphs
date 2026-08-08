// Hakli Glyph Recognizer - Service Worker
// Version 260808a - Network First for same-origin app code (no more stale .js)

const CACHE_VERSION = 'v260808a';
const CACHE_NAME = `hakli-${CACHE_VERSION}`;
const RUNTIME_CACHE = `hakli-runtime-${CACHE_VERSION}`;

// Critical files to cache on install
const CORE_ASSETS = [
  './',
  './index.html',
  './favicon.svg',
  './favicon.png',
  './hh-logo.png',
  './chart-hakli.json',
  './manifest.json'
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing service worker ${CACHE_VERSION}...`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching core assets');
        return cache.addAll(CORE_ASSETS);
      })
      .then(() => {
        console.log('[SW] Core assets cached successfully');
        // Don't skip waiting - let users choose when to update
      })
      .catch((error) => {
        console.error('[SW] Failed to cache core assets:', error);
      })
  );
});

// Activate event - clean up old caches and notify about update
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating service worker ${CACHE_VERSION}...`);
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              // Delete any cache that doesn't match current version
              return cacheName.startsWith('hakli-') && 
                     cacheName !== CACHE_NAME && 
                     cacheName !== RUNTIME_CACHE;
            })
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - Network First for HTML, Cache First for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip Chrome extensions
  if (url.protocol === 'chrome-extension:') return;

  // Skip Google APIs (Drive, OAuth, etc.) - always use network
  if (url.hostname.includes('googleapis.com') || 
      url.hostname.includes('google.com') ||
      url.hostname.includes('gstatic.com') ||
      url.hostname.includes('accounts.google')) {
    return;
  }

  // Network First strategy for HTML (to get updates)
  if (request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // Cache the new version
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline - serve from cache
          return caches.match(request);
        })
    );
    return;
  }

  // Same-origin app code & assets (our own .js, .json, etc.) → Network First.
  // Always fetch the latest when online; fall back to cache only when offline.
  // THIS is what prevents stale .js modules after a deploy, regardless of
  // whether CACHE_VERSION was bumped.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cross-origin CDN libraries (React, Babel, OpenCV, jsPDF...) → Cache First.
  // These are pinned by URL/version, so caching them is safe and fast.
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(RUNTIME_CACHE).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return networkResponse;
          });
      })
  );
});

// Message event - handle messages from the main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Skip waiting requested');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
  
  if (event.data && event.data.type === 'CACHE_GLYPH_IMAGES') {
    const imageUrls = event.data.urls;
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(imageUrls))
      .then(() => console.log('[SW] Cached', imageUrls.length, 'glyph images'))
      .catch((error) => console.error('[SW] Failed to cache glyph images:', error));
  }
});

console.log(`[SW] Service worker script loaded - ${CACHE_VERSION}`);