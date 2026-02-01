/**
 * Developer Reset Utility
 *
 * Clears ALL 5 persistence layers for testing/development:
 * 1. Service Worker cache
 * 2. IndexedDB (Dexie database)
 * 3. LocalStorage
 * 4. SessionStorage
 * 5. Supabase auth session
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
 * LocalStorage keys used by JobProof
 * Centralized list for complete cleanup
 */
const LOCALSTORAGE_KEYS = [
  // User/auth state
  'jobproof_user_v2',
  'jobproof_onboarding_v4',
  // Sync queues
  'jobproof_sync_queue',
  'jobproof_failed_sync_queue',
  // Database versioning
  'jobproof_db_version',
  // Request cache
  'jobproof_request_cache',
  // Form drafts (backup to IndexedDB)
  'jobproof_draft_job',
  'jobproof_draft_client',
  'jobproof_draft_technician',
  // Feature flags
  'jobproof_dev_mode',
  'jobproof_debug_enabled',
  // Notification permissions
  'jobproof_notification_dismissed',
  // Tour state
  'jobproof_tour_complete',
  // Any other jobproof prefixed keys
];

/**
 * Clear Service Worker caches
 * Sends CLEAR_ALL_DATA message to SW and unregisters it
 */
export async function clearServiceWorker(): Promise<boolean> {
  console.log('[DevReset] Clearing service worker...');

  try {
    // Send message to SW to clear its caches
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CLEAR_ALL_DATA',
      });
      // Wait a moment for SW to process
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Unregister all service workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        console.log('[DevReset] Unregistering SW:', registration.scope);
        await registration.unregister();
      }
    }

    // Clear Cache API directly (backup)
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        console.log('[DevReset] Deleting cache:', name);
        await caches.delete(name);
      }
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
      for (const dbInfo of databases) {
        if (dbInfo.name) {
          console.log('[DevReset] Deleting IndexedDB:', dbInfo.name);
          await new Promise<void>((resolve, reject) => {
            const request = indexedDB.deleteDatabase(dbInfo.name!);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
            request.onblocked = () => {
              console.warn('[DevReset] Database delete blocked:', dbInfo.name);
              resolve(); // Continue anyway
            };
          });
        }
      }
    } else {
      // Fallback: delete known database names
      const knownDatabases = ['JobProofOfflineDB', 'keyval-store'];
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
 * Clear all localStorage
 * Removes all jobproof keys + any unknown keys for complete reset
 */
export function clearLocalStorage(allKeys = false): boolean {
  console.log('[DevReset] Clearing localStorage...');

  try {
    if (allKeys) {
      // Nuclear: clear everything
      localStorage.clear();
    } else {
      // Targeted: only jobproof keys
      for (const key of LOCALSTORAGE_KEYS) {
        localStorage.removeItem(key);
      }
      // Also remove any keys that start with 'jobproof_'
      const allLocalStorageKeys = Object.keys(localStorage);
      for (const key of allLocalStorageKeys) {
        if (key.startsWith('jobproof_') || key.startsWith('supabase.')) {
          localStorage.removeItem(key);
        }
      }
    }

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
    sessionStorage.clear();
    console.log('[DevReset] sessionStorage cleared');
    return true;
  } catch (error) {
    console.error('[DevReset] Failed to clear sessionStorage:', error);
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
      await supabase.auth.signOut({ scope: 'local' });
    }
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
    supabaseSession: boolean;
  };
  errors: string[];
}

/**
 * NUCLEAR RESET: Clear ALL 5 persistence layers
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
  console.log('='.repeat(60));

  const errors: string[] = [];

  // Clear all 5 layers in order
  const serviceWorkerResult = await clearServiceWorker();
  if (!serviceWorkerResult) errors.push('Service Worker clear failed');

  const indexedDBResult = await clearIndexedDB();
  if (!indexedDBResult) errors.push('IndexedDB clear failed');

  const localStorageResult = clearLocalStorage(true);
  if (!localStorageResult) errors.push('localStorage clear failed');

  const sessionStorageResult = clearSessionStorage();
  if (!sessionStorageResult) errors.push('sessionStorage clear failed');

  const supabaseResult = await clearSupabaseSession();
  if (!supabaseResult) errors.push('Supabase session clear failed');

  const result: DevResetResult = {
    success: errors.length === 0,
    layers: {
      serviceWorker: serviceWorkerResult,
      indexedDB: indexedDBResult,
      localStorage: localStorageResult,
      sessionStorage: sessionStorageResult,
      supabaseSession: supabaseResult,
    },
    errors,
  };

  console.log('[DevReset] Result:', result);
  console.log('='.repeat(60));

  // Auto-reload to apply changes
  if (autoReload) {
    console.log('[DevReset] Reloading page in 1 second...');
    setTimeout(() => {
      // Use location.href = location.origin to ensure clean reload
      // This bypasses any hash routing state
      window.location.href = window.location.origin + window.location.pathname;
    }, 1000);
  }

  return result;
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
