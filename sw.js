/**
 * Foss Kulli - Service Worker
 * Provides offline functionality and caching for PWA
 */

const CACHE_NAME = 'foss-kulli-v1';
const STATIC_CACHE = 'foss-kulli-static-v1';
const DYNAMIC_CACHE = 'foss-kulli-dynamic-v1';

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/services/srv-local-storage.js',
  '/js/viewmodels/vm-dom.js',
  '/js/viewmodels/vm-sticky-note.js',
  '/js/viewmodels/vm-white-board.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// External resources to cache
const EXTERNAL_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500&display=swap',
  'https://fonts.googleapis.com/icon?family=Material+Icons'
];

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        // Cache static assets, but don't fail if some are missing
        return Promise.allSettled(
          STATIC_ASSETS.map(url => 
            cache.add(url).catch(err => console.log(`[SW] Failed to cache ${url}:`, err))
          )
        );
      })
      .then(() => {
        // Try to cache external assets separately
        return caches.open(DYNAMIC_CACHE).then((cache) => {
          return Promise.allSettled(
            EXTERNAL_ASSETS.map(url =>
              fetch(url, { mode: 'cors' })
                .then(response => {
                  if (response.ok) {
                    return cache.put(url, response);
                  }
                })
                .catch(err => console.log(`[SW] Failed to cache external ${url}:`, err))
            )
          );
        });
      })
      .then(() => {
        console.log('[SW] Installation complete');
        return self.skipWaiting();
      })
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              // Delete old versions of our caches
              return name.startsWith('foss-kulli-') && 
                     name !== STATIC_CACHE && 
                     name !== DYNAMIC_CACHE;
            })
            .map((name) => {
              console.log(`[SW] Deleting old cache: ${name}`);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activation complete');
        return self.clients.claim();
      })
  );
});

/**
 * Fetch event - serve from cache, fallback to network
 * Strategy: Cache First with Network Fallback
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Handle Google Fonts specially (cache with network fallback)
  if (url.hostname.includes('fonts.googleapis.com') || 
      url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(request)
            .then((networkResponse) => {
              // Clone and cache the response
              const responseClone = networkResponse.clone();
              caches.open(DYNAMIC_CACHE)
                .then((cache) => cache.put(request, responseClone));
              return networkResponse;
            });
        })
        .catch(() => {
          // Return empty response for fonts if offline
          return new Response('', { status: 408, statusText: 'Offline' });
        })
    );
    return;
  }

  // Handle Tailwind CDN (network first, cache fallback)
  if (url.hostname.includes('cdn.tailwindcss.com')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          const responseClone = networkResponse.clone();
          caches.open(DYNAMIC_CACHE)
            .then((cache) => cache.put(request, responseClone));
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  // For local assets: Cache first, network fallback
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached version but also update cache in background
          fetchAndCache(request);
          return cachedResponse;
        }
        
        // Not in cache, try network
        return fetchAndCache(request);
      })
      .catch(() => {
        // If both cache and network fail, show offline page for navigation
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      })
  );
});

/**
 * Fetch from network and update cache
 */
async function fetchAndCache(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Only cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Try to return from cache as last resort
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

/**
 * Handle messages from the main thread
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => caches.delete(name))
        );
      })
    );
  }
});

/**
 * Background sync for offline note creation (future enhancement)
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-notes') {
    console.log('[SW] Syncing notes...');
    // Future: sync notes with a backend server
  }
});

/**
 * Push notifications (future enhancement)
 */
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || 'You have a new notification',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: data.primaryKey || 1
      }
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'Foss Kulli', options)
    );
  }
});

/**
 * Notification click handler
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
