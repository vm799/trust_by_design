/* eslint-env serviceworker */
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
 *
 * Developer Mode:
 * - More aggressive cache invalidation
 * - Schema version checking
 * - Auto-clear on version mismatch
 */

// Cache version - increment to force cache refresh on deployment
// v2.0.0: Added CSP fix, database error handling
// v2.1.0: Fixed stale asset detection - auto-clear on 404 JS/CSS
// v2.2.0: Fixed index.html cache strategy - network-first prevents stale asset refs
// v2.3.0: Added schema version tracking, dev mode support, enhanced reset
// v2.4.0: Added automatic version detection and paid user auto-updates
// v2.5.0: Fixed stale cache on deploy - never cache index.html, force revalidation
const CACHE_VERSION = 'bunker-v2.5';
// Schema version must match lib/offline/db.ts DB_SCHEMA_VERSION
const SCHEMA_VERSION = 4;
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const MEDIA_CACHE = `${CACHE_VERSION}-media`;

// Critical paths that should be fetched with priority (network-first, no caching delay)
const CRITICAL_PATHS = [
  '/api/subscription',
  '/api/seal-evidence',
  '/api/generate-report',
  '/rest/v1/rpc/seal_evidence',
  '/rest/v1/rpc/verify_evidence',
];

// Track if we've done a fresh install/update
let isNewInstall = false;

// Track if we've already triggered a stale asset reload (prevents infinite loops)
// Using in-memory flag - resets when SW restarts, which is fine
let staleAssetReloadTriggered = false;
const STALE_RELOAD_COOLDOWN = 30000; // 30 seconds between reload attempts
let lastStaleReloadTime = 0;

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
  if (isCriticalPath(url)) {
    // Critical paths: network-first with no caching (always fresh)
    event.respondWith(priorityFetchStrategy(request));
  } else if (isApiRequest(url)) {
    event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE));
  } else if (isNavigationRequest(request, url)) {
    // CRITICAL: index.html must ALWAYS come from network when online.
    // Stale cached HTML references dead hashed asset URLs → "Unexpected token '<'" error.
    // Only fall back to cache when truly offline.
    event.respondWith(navigationStrategy(request));
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
 *
 * CRITICAL FIX: Detects stale assets (404 on .js/.css) and triggers cache bust
 */
async function cacheFirstStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);
  const url = new URL(request.url);
  const isCriticalAsset = url.pathname.endsWith('.js') || url.pathname.endsWith('.css');

  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    // Return cached version, but update cache in background
    refreshCache(request, cache);
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    // CRITICAL: If a JS/CSS file returns 404, the cached index.html is stale
    // Clear all caches and notify clients to reload - BUT only ONCE to prevent infinite loops
    if (!networkResponse.ok && isCriticalAsset) {
      console.error('[SW] Critical asset 404 detected:', url.pathname);

      const now = Date.now();
      const timeSinceLastReload = now - lastStaleReloadTime;

      // Guard against infinite reload loops
      if (staleAssetReloadTriggered && timeSinceLastReload < STALE_RELOAD_COOLDOWN) {
        console.warn('[SW] Reload already triggered recently, skipping to prevent loop');
        // Return a helpful error page instead of looping
        return new Response(
          `<!DOCTYPE html>
          <html><head><title>Update Required</title></head>
          <body style="font-family:system-ui;padding:40px;text-align:center">
            <h1>App Update Required</h1>
            <p>A new version is available but couldn't load automatically.</p>
            <p>Asset not found: ${url.pathname}</p>
            <button onclick="caches.keys().then(n=>Promise.all(n.map(k=>caches.delete(k)))).then(()=>location.reload())"
                    style="padding:12px 24px;font-size:16px;cursor:pointer">
              Clear Cache & Reload
            </button>
          </body></html>`,
          { status: 200, headers: { 'Content-Type': 'text/html' } }
        );
      }

      // Mark that we're triggering a reload
      staleAssetReloadTriggered = true;
      lastStaleReloadTime = now;

      console.log('[SW] Clearing stale caches and triggering reload...');

      // Clear all caches
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));

      // Notify all clients to reload
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'STALE_ASSETS_DETECTED',
          message: 'New version available - reloading...',
          failedAsset: url.pathname
        });
      });

      // Return a special response that triggers reload
      return new Response(
        '<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0"></head><body>Updating...</body></html>',
        {
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }

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
 * Navigation strategy - network-only with offline fallback
 * NEVER serves cached index.html when online, because stale HTML
 * references dead hashed assets causing "Unexpected token '<'" errors.
 */
async function navigationStrategy(request) {
  try {
    const networkResponse = await fetch(request, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (networkResponse.ok) {
      // Update the offline fallback cache
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Truly offline — use cached version as last resort
    console.log('[SW] Offline: serving cached index.html');
    const cache = await caches.open(STATIC_CACHE);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
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

/**
 * Priority fetch strategy - network only, no caching
 * Best for: Critical API endpoints that must always be fresh
 */
async function priorityFetchStrategy(request) {
  try {
    const networkResponse = await fetch(request, {
      cache: 'no-store',
      credentials: 'same-origin'
    });
    return networkResponse;
  } catch (error) {
    console.log('[SW] Priority fetch failed:', request.url);
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ============================================================================
// REQUEST TYPE DETECTION
// ============================================================================

/**
 * Check if request is a critical path that needs priority handling
 */
function isCriticalPath(url) {
  return CRITICAL_PATHS.some(path => url.pathname.includes(path));
}

function isApiRequest(url) {
  return url.pathname.startsWith('/rest/') ||
         url.pathname.startsWith('/api/') ||
         url.hostname.includes('supabase');
}

/**
 * Detect navigation requests (HTML pages)
 * These should be network-first to always get latest asset references
 */
function isNavigationRequest(request, url) {
  // Navigation requests (browser navigation)
  if (request.mode === 'navigate') {
    return true;
  }
  // Direct requests for index.html or root
  if (url.pathname === '/' || url.pathname === '/index.html') {
    return true;
  }
  // Any HTML file request
  if (url.pathname.endsWith('.html')) {
    return true;
  }
  return false;
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

  // Get current cache version and schema version
  if (event.data.type === 'GET_VERSION') {
    event.source.postMessage({
      type: 'VERSION_INFO',
      version: CACHE_VERSION,
      schemaVersion: SCHEMA_VERSION
    });
  }

  // Developer reset - clears everything and unregisters
  if (event.data.type === 'DEV_RESET') {
    console.log('[SW] Developer reset initiated');

    // Clear all caches
    caches.keys().then((names) => {
      return Promise.all(names.map((name) => {
        console.log('[SW] DEV_RESET: Deleting cache:', name);
        return caches.delete(name);
      }));
    }).then(() => {
      // Clear IndexedDB
      if (typeof indexedDB !== 'undefined' && indexedDB.databases) {
        return indexedDB.databases().then((dbs) => {
          return Promise.all(dbs.map((db) => {
            console.log('[SW] DEV_RESET: Deleting IndexedDB:', db.name);
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
      // Notify client
      event.source.postMessage({
        type: 'DEV_RESET_COMPLETE',
        success: true
      });
      // Unregister this service worker
      return self.registration.unregister();
    }).then(() => {
      console.log('[SW] DEV_RESET: Service worker unregistered');
    }).catch((error) => {
      console.error('[SW] DEV_RESET error:', error);
      event.source.postMessage({
        type: 'DEV_RESET_COMPLETE',
        success: false,
        error: error.message
      });
    });
  }

  // Check for updates - compares version from index.html meta tag
  if (event.data.type === 'CHECK_FOR_UPDATES') {
    const currentVersion = event.data.currentVersion;
    console.log('[SW] Checking for updates, current version:', currentVersion);
    checkForUpdates(currentVersion).then((result) => {
      if (result.updateAvailable) {
        console.log('[SW] Update available:', result.newVersion);
      }
    });
  }
});

// ============================================================================
// VERSION CHECKING - Automatic update detection
// ============================================================================

/**
 * Check for updates by fetching index.html and comparing version meta tag
 * Posts UPDATE_AVAILABLE message to all clients if version differs
 *
 * @param {string} currentVersion - The current app version from the client
 * @returns {Promise<{updateAvailable: boolean, newVersion: string|null}>}
 */
async function checkForUpdates(currentVersion) {
  try {
    // Fetch index.html with cache bypass
    const response = await fetch('/index.html', {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });

    if (!response.ok) {
      console.log('[SW] Failed to fetch index.html for version check');
      return { updateAvailable: false, newVersion: null };
    }

    const html = await response.text();

    // Extract version from meta tag: <meta name="app-version" content="...">
    const versionMatch = html.match(/<meta\s+name=["']app-version["']\s+content=["']([^"']+)["']/i);

    if (!versionMatch) {
      console.log('[SW] No app-version meta tag found in index.html');
      return { updateAvailable: false, newVersion: null };
    }

    const newVersion = versionMatch[1];
    console.log('[SW] Version check: current=' + currentVersion + ', server=' + newVersion);

    // Normalize versions to commit hash only for comparison.
    // Meta tag format is "commit-timestamp" (e.g., "a1b2c3d-1707658400000")
    // Client may send just the commit hash (e.g., "a1b2c3d").
    // Compare only the commit hash prefix to avoid false positives.
    const currentCommit = currentVersion ? currentVersion.split('-')[0] : '';
    const newCommit = newVersion ? newVersion.split('-')[0] : '';

    if (currentCommit && newCommit && newCommit !== currentCommit) {
      // Notify all clients about the update
      const clients = await self.clients.matchAll({ includeUncontrolled: true });
      clients.forEach((client) => {
        client.postMessage({
          type: 'UPDATE_AVAILABLE',
          currentVersion: currentVersion,
          newVersion: newVersion,
          timestamp: Date.now()
        });
      });

      return { updateAvailable: true, newVersion: newVersion };
    }

    return { updateAvailable: false, newVersion: newVersion };
  } catch (error) {
    console.error('[SW] Error checking for updates:', error);
    return { updateAvailable: false, newVersion: null };
  }
}

console.log(`[SW] Service worker loaded - Bunker Mode Ready (${CACHE_VERSION}) with auto-update detection`);
