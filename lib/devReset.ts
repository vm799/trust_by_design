/**
 * Developer Reset Utility
 *
 * Clears ALL 6 persistence layers for testing/development:
 * 1. Service Worker cache
 * 2. IndexedDB (Dexie database)
 * 3. LocalStorage
 * 4. SessionStorage
 * 5. Supabase auth session
 * 6. Cookies (auth tokens)
 *
 * This is the "nuclear option" for developers - NOT shipped to production users
 * in normal flows. Access via:
 * - /#/dev/reset route
 * - Long-press logo 5 seconds
 * - ?reset=1 query parameter (dev only)
 *
 * @see CLAUDE.md Emergency Procedures
 */

import { getSupabase } from './supabase';

// Build fingerprint for debugging
// These are set at build time by Vite's define
export const BUILD_INFO = {
  // Git commit hash (first 7 chars)
  commit: import.meta.env.VITE_GIT_COMMIT || 'dev',
  // Build timestamp
  buildTime: import.meta.env.VITE_BUILD_TIME || new Date().toISOString(),
  // Schema version from offline/db.ts
  schemaVersion: 4,
  // Service worker version (must match sw.js CACHE_VERSION)
  swVersion: 'bunker-v2.3',
  // App version from package.json
  appVersion: import.meta.env.VITE_APP_VERSION || '0.0.0',
};

/**
 * Prefixes for localStorage keys that should be cleared
 */
const STORAGE_PREFIXES = [
  'jobproof_',
  'supabase.',
  'sb-',  // Supabase auth tokens
  'bunker_',
  'infobox_dismissed_',
];

/**
 * Clear Service Worker caches
 * Sends CLEAR_ALL_DATA message to SW and unregisters it
 */
export async function clearServiceWorker(): Promise<boolean> {
  console.log('[DevReset] Clearing service worker...');

  try {
    // Clear Cache API FIRST (before unregistering SW)
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      console.log('[DevReset] Found caches:', cacheNames);
      await Promise.all(
        cacheNames.map(async (name) => {
          console.log('[DevReset] Deleting cache:', name);
          await caches.delete(name);
        })
      );
    }

    // Send message to SW to clear its internal state
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CLEAR_ALL_DATA',
      });
      // Wait for SW to process
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Unregister all service workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      console.log('[DevReset] Found SW registrations:', registrations.length);
      await Promise.all(
        registrations.map(async (registration) => {
          console.log('[DevReset] Unregistering SW:', registration.scope);
          await registration.unregister();
        })
      );
    }

    console.log('[DevReset] Service worker cleared');
    return true;
  } catch (error) {
    console.error('[DevReset] Failed to clear service worker:', error);
    return false;
  }
}

/**
 * Clear ALL IndexedDB databases
 * More thorough than Dexie's clearAllData - gets ALL databases
 */
export async function clearIndexedDB(): Promise<boolean> {
  console.log('[DevReset] Clearing IndexedDB...');

  try {
    // First, try to close any open Dexie connections
    try {
      const { db, clearAllData } = await import('./offline/db');
      db.close();
      await clearAllData();
    } catch (e) {
      console.warn('[DevReset] Dexie cleanup failed (may already be closed):', e);
    }

    // Get all databases and delete them
    if (indexedDB.databases) {
      const databases = await indexedDB.databases();
      console.log('[DevReset] Found IndexedDB databases:', databases.map(d => d.name));

      for (const dbInfo of databases) {
        if (dbInfo.name) {
          console.log('[DevReset] Deleting IndexedDB:', dbInfo.name);
          await new Promise<void>((resolve) => {
            const request = indexedDB.deleteDatabase(dbInfo.name!);
            request.onsuccess = () => {
              console.log('[DevReset] Deleted:', dbInfo.name);
              resolve();
            };
            request.onerror = () => {
              console.warn('[DevReset] Error deleting:', dbInfo.name);
              resolve();
            };
            request.onblocked = () => {
              console.warn('[DevReset] Blocked deleting:', dbInfo.name);
              resolve();
            };
          });
        }
      }
    } else {
      // Fallback: delete known database names
      const knownDatabases = [
        'JobProofOfflineDB',
        'keyval-store',
        'localforage',
        'firebaseLocalStorageDb',
      ];
      for (const name of knownDatabases) {
        await new Promise<void>((resolve) => {
          const request = indexedDB.deleteDatabase(name);
          request.onsuccess = () => resolve();
          request.onerror = () => resolve();
          request.onblocked = () => resolve();
        });
      }
    }

    console.log('[DevReset] IndexedDB cleared');
    return true;
  } catch (error) {
    console.error('[DevReset] Failed to clear IndexedDB:', error);
    return false;
  }
}

/**
 * Clear all localStorage - NUCLEAR version
 * Clears EVERYTHING, no exceptions
 */
export function clearLocalStorage(allKeys = false): boolean {
  console.log('[DevReset] Clearing localStorage...');

  try {
    const keysBefore = Object.keys(localStorage);
    console.log('[DevReset] localStorage keys before:', keysBefore);

    if (allKeys) {
      // Nuclear: clear everything
      localStorage.clear();
      console.log('[DevReset] localStorage.clear() called');
    } else {
      // Targeted: only app-related keys
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const shouldRemove = STORAGE_PREFIXES.some(prefix => key.startsWith(prefix));
          if (shouldRemove) {
            keysToRemove.push(key);
          }
        }
      }
      keysToRemove.forEach(key => {
        console.log('[DevReset] Removing:', key);
        localStorage.removeItem(key);
      });
    }

    const keysAfter = Object.keys(localStorage);
    console.log('[DevReset] localStorage keys after:', keysAfter);
    console.log('[DevReset] localStorage cleared');
    return true;
  } catch (error) {
    console.error('[DevReset] Failed to clear localStorage:', error);
    return false;
  }
}

/**
 * Clear sessionStorage
 */
export function clearSessionStorage(): boolean {
  console.log('[DevReset] Clearing sessionStorage...');

  try {
    const keysBefore = Object.keys(sessionStorage);
    console.log('[DevReset] sessionStorage keys before:', keysBefore);
    sessionStorage.clear();
    console.log('[DevReset] sessionStorage cleared');
    return true;
  } catch (error) {
    console.error('[DevReset] Failed to clear sessionStorage:', error);
    return false;
  }
}

/**
 * Clear all cookies
 */
export function clearCookies(): boolean {
  console.log('[DevReset] Clearing cookies...');

  try {
    const cookies = document.cookie.split(';');
    console.log('[DevReset] Found cookies:', cookies.length);

    for (const cookie of cookies) {
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
      // Clear for current path and root
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${window.location.pathname}`;
    }

    console.log('[DevReset] Cookies cleared');
    return true;
  } catch (error) {
    console.error('[DevReset] Failed to clear cookies:', error);
    return false;
  }
}

/**
 * Sign out from Supabase
 * Clears the auth session
 */
export async function clearSupabaseSession(): Promise<boolean> {
  console.log('[DevReset] Clearing Supabase session...');

  try {
    const supabase = getSupabase();
    if (supabase) {
      // Sign out globally (clears all sessions)
      await supabase.auth.signOut({ scope: 'global' });
    }

    // Also manually clear any Supabase localStorage keys that might remain
    const supabaseKeys = Object.keys(localStorage).filter(
      key => key.startsWith('sb-') || key.startsWith('supabase.')
    );
    supabaseKeys.forEach(key => {
      console.log('[DevReset] Removing Supabase key:', key);
      localStorage.removeItem(key);
    });

    console.log('[DevReset] Supabase session cleared');
    return true;
  } catch (error) {
    console.error('[DevReset] Failed to clear Supabase session:', error);
    return false;
  }
}

/**
 * Result of developer reset operation
 */
export interface DevResetResult {
  success: boolean;
  layers: {
    serviceWorker: boolean;
    indexedDB: boolean;
    localStorage: boolean;
    sessionStorage: boolean;
    cookies: boolean;
    supabaseSession: boolean;
  };
  errors: string[];
}

/**
 * NUCLEAR RESET: Clear ALL 6 persistence layers
 *
 * This is the complete developer reset. After calling this:
 * 1. User will be logged out
 * 2. All cached data will be gone
 * 3. App will behave like fresh install
 * 4. Page will reload automatically
 *
 * @param autoReload - Whether to reload the page after reset (default: true)
 * @returns Result object with success status for each layer
 */
export async function developerReset(autoReload = true): Promise<DevResetResult> {
  console.log('='.repeat(60));
  console.log('[DevReset] INITIATING NUCLEAR RESET');
  console.log('[DevReset] Build:', BUILD_INFO.commit);
  console.log('[DevReset] Schema:', BUILD_INFO.schemaVersion);
  console.log('[DevReset] Time:', new Date().toISOString());
  console.log('='.repeat(60));

  const errors: string[] = [];

  // Clear Supabase session FIRST (before clearing storage it uses)
  const supabaseResult = await clearSupabaseSession();
  if (!supabaseResult) errors.push('Supabase session clear failed');

  // Clear service workers and caches
  const serviceWorkerResult = await clearServiceWorker();
  if (!serviceWorkerResult) errors.push('Service Worker clear failed');

  // Clear IndexedDB
  const indexedDBResult = await clearIndexedDB();
  if (!indexedDBResult) errors.push('IndexedDB clear failed');

  // Clear localStorage (NUCLEAR - everything)
  const localStorageResult = clearLocalStorage(true);
  if (!localStorageResult) errors.push('localStorage clear failed');

  // Clear sessionStorage
  const sessionStorageResult = clearSessionStorage();
  if (!sessionStorageResult) errors.push('sessionStorage clear failed');

  // Clear cookies
  const cookiesResult = clearCookies();
  if (!cookiesResult) errors.push('Cookies clear failed');

  const result: DevResetResult = {
    success: errors.length === 0,
    layers: {
      serviceWorker: serviceWorkerResult,
      indexedDB: indexedDBResult,
      localStorage: localStorageResult,
      sessionStorage: sessionStorageResult,
      cookies: cookiesResult,
      supabaseSession: supabaseResult,
    },
    errors,
  };

  console.log('[DevReset] Result:', result);
  console.log('='.repeat(60));

  // Auto-reload to apply changes
  if (autoReload) {
    console.log('[DevReset] Hard reload in 500ms...');
    setTimeout(() => {
      // Force a cache-busting hard reload
      // Adding timestamp ensures browser doesn't use disk cache
      const url = new URL(window.location.origin + window.location.pathname);
      url.searchParams.set('_reset', Date.now().toString());
      window.location.replace(url.toString());
    }, 500);
  }

  return result;
}

/**
 * Get a diagnostic report of current storage state
 * Useful for debugging what's persisting
 */
export async function getStorageDiagnostics(): Promise<{
  localStorage: { count: number; keys: string[] };
  sessionStorage: { count: number; keys: string[] };
  indexedDB: { count: number; databases: string[] };
  caches: { count: number; names: string[] };
  serviceWorker: { active: boolean; scope?: string };
  cookies: { count: number };
}> {
  const localStorageKeys = Object.keys(localStorage);
  const sessionStorageKeys = Object.keys(sessionStorage);

  let indexedDBDatabases: string[] = [];
  if (indexedDB.databases) {
    const dbs = await indexedDB.databases();
    indexedDBDatabases = dbs.map(db => db.name || 'unknown');
  }

  let cacheNames: string[] = [];
  if ('caches' in window) {
    cacheNames = await caches.keys();
  }

  let swActive = false;
  let swScope: string | undefined;
  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg?.active) {
      swActive = true;
      swScope = reg.scope;
    }
  }

  const cookieCount = document.cookie.split(';').filter(c => c.trim()).length;

  return {
    localStorage: { count: localStorageKeys.length, keys: localStorageKeys },
    sessionStorage: { count: sessionStorageKeys.length, keys: sessionStorageKeys },
    indexedDB: { count: indexedDBDatabases.length, databases: indexedDBDatabases },
    caches: { count: cacheNames.length, names: cacheNames },
    serviceWorker: { active: swActive, scope: swScope },
    cookies: { count: cookieCount },
  };
}

/**
 * Check if reset is needed based on schema version mismatch
 * Call this on app startup to auto-detect stale data
 */
export function checkSchemaVersionMismatch(): boolean {
  const storedVersion = localStorage.getItem('jobproof_db_version');
  const currentVersion = String(BUILD_INFO.schemaVersion);

  if (storedVersion && storedVersion !== currentVersion) {
    console.warn(
      `[DevReset] Schema mismatch detected: stored=${storedVersion}, current=${currentVersion}`
    );
    return true;
  }
  return false;
}

/**
 * Get current build info for display
 */
export function getBuildInfo(): typeof BUILD_INFO {
  return BUILD_INFO;
}

/**
 * Check if running in development mode
 */
export function isDevMode(): boolean {
  return (
    import.meta.env.DEV ||
    import.meta.env.MODE === 'development' ||
    localStorage.getItem('jobproof_dev_mode') === 'true'
  );
}

/**
 * Enable dev mode (persists across refreshes)
 */
export function enableDevMode(): void {
  localStorage.setItem('jobproof_dev_mode', 'true');
  console.log('[DevReset] Dev mode enabled');
}

/**
 * Disable dev mode
 */
export function disableDevMode(): void {
  localStorage.removeItem('jobproof_dev_mode');
  console.log('[DevReset] Dev mode disabled');
}
