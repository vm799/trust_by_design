/**
 * JobProof Service Worker - Bunker Mode
 *
 * Enables full offline functionality for the app.
 * Caches all critical assets and API responses.
 *
 * Strategy:
 * - Static assets: Cache-first (fast loads)
 * - API requests: Network-first with cache fallback
 * - Photos/Media: Cache-first (large files)
 */

// Cache version - increment to force cache refresh on deployment
// v2.0.0: Added CSP fix, database error handling
const CACHE_VERSION = 'bunker-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const MEDIA_CACHE = `${CACHE_VERSION}-media`;

// Track if we've done a fresh install/update
let isNewInstall = false;

// Assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  // Add your JS/CSS bundles here after build
  // '/assets/index.js',
  // '/assets/index.css',
];

// ============================================================================
// INSTALL EVENT - Pre-cache static assets
// ============================================================================

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Pre-caching static assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        console.log('[SW] Install complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Install failed:', error);
      })
  );
});

// ============================================================================
// ACTIVATE EVENT - Clean up old caches
// ============================================================================

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        // Find and delete ALL old caches (not just bunker- prefix)
        const cachesToDelete = cacheNames.filter((name) => {
          // Delete any cache that doesn't match current version
          const isOldBunkerCache = name.startsWith('bunker-') &&
            name !== STATIC_CACHE &&
            name !== DYNAMIC_CACHE &&
            name !== MEDIA_CACHE;

          // Also delete any other caches that might be stale
          const isUnknownCache = !name.startsWith('bunker-v2');

          return isOldBunkerCache || isUnknownCache;
        });

        if (cachesToDelete.length > 0) {
          console.log('[SW] Purging old caches:', cachesToDelete);
          isNewInstall = true;
        }

        return Promise.all(
          cachesToDelete.map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
        );
      })
      .then(() => {
        console.log('[SW] Activation complete');
        return self.clients.claim();
      })
      .then(() => {
        // Notify all clients about the update
        if (isNewInstall) {
          return self.clients.matchAll().then((clients) => {
            clients.forEach((client) => {
              client.postMessage({
                type: 'SW_UPDATED',
                version: CACHE_VERSION,
                message: 'Service worker updated - caches cleared'
              });
            });
          });
        }
      })
  );
});

// ============================================================================
// FETCH EVENT - Handle all network requests
// ============================================================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Handle different request types
  if (isApiRequest(url)) {
    event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE));
  } else if (isMediaRequest(url)) {
    event.respondWith(cacheFirstStrategy(request, MEDIA_CACHE));
  } else {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
  }
});

// ============================================================================
// CACHING STRATEGIES
// ============================================================================

/**
 * Cache-first strategy
 * Best for: Static assets, images, fonts
 */
async function cacheFirstStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    // Return cached version, but update cache in background
    refreshCache(request, cache);
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, no cache available:', request.url);
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

/**
 * Network-first strategy
 * Best for: API requests, dynamic data
 */
async function networkFirstStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, checking cache:', request.url);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Background cache refresh (stale-while-revalidate)
 */
async function refreshCache(request, cache) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse);
    }
  } catch (error) {
    // Silently fail - we already have cached version
  }
}

// ============================================================================
// REQUEST TYPE DETECTION
// ============================================================================

function isApiRequest(url) {
  return url.pathname.startsWith('/rest/') ||
         url.pathname.startsWith('/api/') ||
         url.hostname.includes('supabase');
}

function isMediaRequest(url) {
  const mediaExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico'];
  return mediaExtensions.some(ext => url.pathname.toLowerCase().endsWith(ext)) ||
         url.pathname.includes('/storage/') ||
         url.pathname.includes('/media/');
}

// ============================================================================
// BACKGROUND SYNC (for offline form submissions)
// ============================================================================

self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);

  if (event.tag === 'sync-jobs') {
    event.waitUntil(syncPendingJobs());
  }
});

async function syncPendingJobs() {
  // This would be called when the device comes back online
  // The actual sync logic is in the JobRunner component
  // This is just a placeholder for more advanced background sync

  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'SYNC_TRIGGERED',
      timestamp: Date.now()
    });
  });
}

// ============================================================================
// PUSH NOTIFICATIONS (optional)
// ============================================================================

self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'JobProof', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(event.notification.data.url);
      }
    })
  );
});

// ============================================================================
// MESSAGE HANDLING (communication with main app)
// ============================================================================

self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'CACHE_URLS') {
    caches.open(STATIC_CACHE).then((cache) => {
      cache.addAll(event.data.urls);
    });
  }

  if (event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }

  // Nuclear option: Clear all caches AND IndexedDB
  if (event.data.type === 'CLEAR_ALL_DATA') {
    console.log('[SW] Clearing ALL data (caches + IndexedDB)...');

    // Clear all caches
    caches.keys().then((names) => {
      return Promise.all(names.map((name) => {
        console.log('[SW] Deleting cache:', name);
        return caches.delete(name);
      }));
    }).then(() => {
      // Clear IndexedDB databases
      if (typeof indexedDB !== 'undefined' && indexedDB.databases) {
        return indexedDB.databases().then((dbs) => {
          return Promise.all(dbs.map((db) => {
            console.log('[SW] Deleting IndexedDB:', db.name);
            return new Promise((resolve) => {
              const req = indexedDB.deleteDatabase(db.name);
              req.onsuccess = resolve;
              req.onerror = resolve;
              req.onblocked = resolve;
            });
          }));
        });
      }
    }).then(() => {
      // Notify client that clear is complete
      event.source.postMessage({
        type: 'DATA_CLEARED',
        success: true
      });
    }).catch((error) => {
      console.error('[SW] Error clearing data:', error);
      event.source.postMessage({
        type: 'DATA_CLEARED',
        success: false,
        error: error.message
      });
    });
  }

  // Get current cache version
  if (event.data.type === 'GET_VERSION') {
    event.source.postMessage({
      type: 'VERSION_INFO',
      version: CACHE_VERSION
    });
  }
});

console.log('[SW] Service worker loaded - Bunker Mode Ready (v2.0.0)');
