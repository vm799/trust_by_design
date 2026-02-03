/**
 * Testing Control Plane
 *
 * Provides atomic reset, verification, and inspection of all 6 persistence layers.
 * This is the "meta-system" that gives developers control over the production system.
 *
 * SECURITY: All methods are gated by guardTestingAccess() which only allows
 * execution in dev mode or localhost. Production calls throw immediately.
 *
 * Usage:
 * - Console: await window.__JOBPROOF_TEST__.resetAll()
 * - Playwright: await page.evaluate(() => window.__JOBPROOF_TEST__.resetAll())
 * - Route: /#/dev/reset
 *
 * @see CLAUDE.md "Emergency Procedures"
 */

import { closeAllConnections, _resetDbInstance, getDatabase } from './offline/db';
import {
    clearServiceWorker,
    clearIndexedDB,
    clearLocalStorage,
    clearSessionStorage,
    clearCookies,
    clearSupabaseSession,
    BUILD_INFO,
} from './devReset';

// ============================================================================
// TYPES
// ============================================================================

export interface ResetResult {
    success: boolean;
    layers: {
        serviceWorker: { cleared: boolean; unregistered: boolean; error?: string };
        indexedDB: { deleted: boolean; wasBlocked: boolean; error?: string };
        localStorage: { cleared: boolean; keyCount: number; error?: string };
        sessionStorage: { cleared: boolean; error?: string };
        cookies: { cleared: boolean; error?: string };
        supabaseAuth: { signedOut: boolean; error?: string };
    };
    durationMs: number;
    errors: string[];
    verified: boolean;
}

export interface LayerStatus {
    serviceWorker: {
        active: boolean;
        version: string | null;
        scope: string | null;
    };
    indexedDB: {
        open: boolean;
        databaseCount: number;
        tables: Record<string, number>; // table name -> row count
    };
    localStorage: {
        keyCount: number;
        jobproofKeyCount: number;
        keys: string[];
    };
    sessionStorage: {
        keyCount: number;
        keys: string[];
    };
    supabaseAuth: {
        hasSession: boolean;
        userId: string | null;
    };
    caches: {
        count: number;
        names: string[];
    };
}

// ============================================================================
// SECURITY GATE
// ============================================================================

/**
 * Guards all Testing Control Plane methods.
 * Only allows execution in:
 * - Vite dev mode (import.meta.env.DEV)
 * - localhost (for testing built app)
 * - Explicit test flag (for staging UAT)
 *
 * CRITICAL: This prevents accidental data loss in production.
 */
function guardTestingAccess(operation: string): void {
    const isDev = import.meta.env.DEV;
    const isLocalhost = typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' ||
         window.location.hostname === '127.0.0.1');
    const hasTestFlag = typeof localStorage !== 'undefined' &&
        localStorage.getItem('jobproof_enable_testing') === 'CONFIRMED';

    if (!isDev && !isLocalhost && !hasTestFlag) {
        const msg = `TestingControlPlane.${operation}() is DISABLED in production. ` +
            `This is a safety measure to prevent data loss. ` +
            `Set localStorage.setItem('jobproof_enable_testing', 'CONFIRMED') to override on staging.`;
        console.error('[TestingControlPlane] BLOCKED:', msg);
        throw new Error(msg);
    }
}

// ============================================================================
// RESET WITH TIMEOUT
// ============================================================================

const RESET_TIMEOUT_MS = 5000; // 5 seconds max for reset operations

/**
 * Wraps a promise with a timeout.
 * If the operation takes longer than timeoutMs, rejects with timeout error.
 */
async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    operationName: string
): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout>;

    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });

    try {
        const result = await Promise.race([promise, timeoutPromise]);
        clearTimeout(timeoutId!);
        return result;
    } catch (error) {
        clearTimeout(timeoutId!);
        throw error;
    }
}

// ============================================================================
// CORE API
// ============================================================================

/**
 * Atomic reset of all 6 persistence layers with verification.
 *
 * Order matters:
 * 1. Close Dexie connections (prevents "blocked" state)
 * 2. Sign out Supabase (before clearing its storage)
 * 3. Clear Service Worker + caches
 * 4. Delete IndexedDB
 * 5. Clear localStorage
 * 6. Clear sessionStorage
 * 7. Clear cookies
 * 8. Verify clean state
 *
 * @param autoReload - Whether to reload page after reset (default: false)
 * @returns Detailed result with success status for each layer
 */
async function resetAll(autoReload = false): Promise<ResetResult> {
    guardTestingAccess('resetAll');

    const startTime = Date.now();
    const errors: string[] = [];
    const result: ResetResult = {
        success: false,
        layers: {
            serviceWorker: { cleared: false, unregistered: false },
            indexedDB: { deleted: false, wasBlocked: false },
            localStorage: { cleared: false, keyCount: 0 },
            sessionStorage: { cleared: false },
            cookies: { cleared: false },
            supabaseAuth: { signedOut: false },
        },
        durationMs: 0,
        errors: [],
        verified: false,
    };

    console.log('[TestingControlPlane] ========================================');
    console.log('[TestingControlPlane] RESET ALL - Starting atomic reset');
    console.log('[TestingControlPlane] Build:', BUILD_INFO.commit);
    console.log('[TestingControlPlane] Time:', new Date().toISOString());
    console.log('[TestingControlPlane] ========================================');

    try {
        // Step 1: Close all Dexie connections FIRST
        // This is critical - deleteDatabase will be "blocked" if connections are open
        console.log('[TestingControlPlane] Step 1: Closing Dexie connections...');
        await closeAllConnections();
        _resetDbInstance();

        // Step 2: Sign out Supabase (before clearing its localStorage keys)
        console.log('[TestingControlPlane] Step 2: Signing out Supabase...');
        try {
            const supabaseResult = await withTimeout(
                clearSupabaseSession(),
                RESET_TIMEOUT_MS,
                'Supabase signOut'
            );
            result.layers.supabaseAuth.signedOut = supabaseResult;
        } catch (error) {
            const msg = `Supabase signOut: ${error instanceof Error ? error.message : String(error)}`;
            errors.push(msg);
            result.layers.supabaseAuth.error = msg;
        }

        // Step 3: Clear Service Worker and caches
        console.log('[TestingControlPlane] Step 3: Clearing Service Worker...');
        try {
            const swResult = await withTimeout(
                clearServiceWorker(),
                RESET_TIMEOUT_MS,
                'Service Worker clear'
            );
            result.layers.serviceWorker.cleared = swResult;
            result.layers.serviceWorker.unregistered = swResult;
        } catch (error) {
            const msg = `Service Worker: ${error instanceof Error ? error.message : String(error)}`;
            errors.push(msg);
            result.layers.serviceWorker.error = msg;
        }

        // Step 4: Delete IndexedDB
        console.log('[TestingControlPlane] Step 4: Deleting IndexedDB...');
        try {
            const idbResult = await withTimeout(
                clearIndexedDB(),
                RESET_TIMEOUT_MS,
                'IndexedDB delete'
            );
            result.layers.indexedDB.deleted = idbResult;
        } catch (error) {
            const msg = `IndexedDB: ${error instanceof Error ? error.message : String(error)}`;
            errors.push(msg);
            result.layers.indexedDB.error = msg;
            // Check if it was a blocked error
            if (error instanceof Error && error.message.includes('blocked')) {
                result.layers.indexedDB.wasBlocked = true;
            }
        }

        // Step 5: Clear localStorage
        console.log('[TestingControlPlane] Step 5: Clearing localStorage...');
        try {
            const keysBefore = Object.keys(localStorage).length;
            const lsResult = clearLocalStorage(true); // Nuclear clear
            result.layers.localStorage.cleared = lsResult;
            result.layers.localStorage.keyCount = keysBefore;
        } catch (error) {
            const msg = `localStorage: ${error instanceof Error ? error.message : String(error)}`;
            errors.push(msg);
            result.layers.localStorage.error = msg;
        }

        // Step 6: Clear sessionStorage
        console.log('[TestingControlPlane] Step 6: Clearing sessionStorage...');
        try {
            const ssResult = clearSessionStorage();
            result.layers.sessionStorage.cleared = ssResult;
        } catch (error) {
            const msg = `sessionStorage: ${error instanceof Error ? error.message : String(error)}`;
            errors.push(msg);
            result.layers.sessionStorage.error = msg;
        }

        // Step 7: Clear cookies
        console.log('[TestingControlPlane] Step 7: Clearing cookies...');
        try {
            const cookieResult = clearCookies();
            result.layers.cookies.cleared = cookieResult;
        } catch (error) {
            const msg = `cookies: ${error instanceof Error ? error.message : String(error)}`;
            errors.push(msg);
            result.layers.cookies.error = msg;
        }

        // Step 8: Verify clean state
        console.log('[TestingControlPlane] Step 8: Verifying clean state...');
        result.verified = await verifyCleanState();

    } catch (error) {
        const msg = `Unexpected error: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(msg);
    }

    result.durationMs = Date.now() - startTime;
    result.errors = errors;
    result.success = errors.length === 0 && result.verified;

    console.log('[TestingControlPlane] ========================================');
    console.log('[TestingControlPlane] RESET COMPLETE');
    console.log('[TestingControlPlane] Success:', result.success);
    console.log('[TestingControlPlane] Verified:', result.verified);
    console.log('[TestingControlPlane] Duration:', result.durationMs, 'ms');
    console.log('[TestingControlPlane] Errors:', result.errors);
    console.log('[TestingControlPlane] ========================================');

    if (autoReload) {
        console.log('[TestingControlPlane] Auto-reload in 500ms...');
        setTimeout(() => {
            window.location.href = window.location.origin;
        }, 500);
    }

    return result;
}

/**
 * Get comprehensive status of all persistence layers.
 *
 * Use this to:
 * - Debug what's persisting
 * - Verify reset worked
 * - Understand current state
 */
async function getLayerStatus(): Promise<LayerStatus> {
    guardTestingAccess('getLayerStatus');

    const status: LayerStatus = {
        serviceWorker: { active: false, version: null, scope: null },
        indexedDB: { open: false, databaseCount: 0, tables: {} },
        localStorage: { keyCount: 0, jobproofKeyCount: 0, keys: [] },
        sessionStorage: { keyCount: 0, keys: [] },
        supabaseAuth: { hasSession: false, userId: null },
        caches: { count: 0, names: [] },
    };

    // Service Worker
    if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg?.active) {
            status.serviceWorker.active = true;
            status.serviceWorker.scope = reg.scope;
            // Try to get version from SW
            try {
                const response = await new Promise<{ version: string } | null>((resolve) => {
                    const timeout = setTimeout(() => resolve(null), 1000);
                    const handler = (event: MessageEvent) => {
                        if (event.data?.type === 'VERSION_INFO') {
                            clearTimeout(timeout);
                            navigator.serviceWorker.removeEventListener('message', handler);
                            resolve(event.data);
                        }
                    };
                    navigator.serviceWorker.addEventListener('message', handler);
                    navigator.serviceWorker.controller?.postMessage({ type: 'GET_VERSION' });
                });
                if (response) {
                    status.serviceWorker.version = response.version;
                }
            } catch {
                // Ignore SW communication errors
            }
        }
    }

    // IndexedDB
    if (indexedDB.databases) {
        const dbs = await indexedDB.databases();
        status.indexedDB.databaseCount = dbs.length;

        // Try to get row counts from JobProofOfflineDB
        try {
            const database = await getDatabase();
            status.indexedDB.open = database.isOpen();
            status.indexedDB.tables = {
                jobs: await database.jobs.count(),
                queue: await database.queue.count(),
                media: await database.media.count(),
                formDrafts: await database.formDrafts.count(),
                clients: await database.clients.count(),
                technicians: await database.technicians.count(),
                orphanPhotos: await database.orphanPhotos.count(),
            };
        } catch {
            // Database might not exist after reset
        }
    }

    // localStorage
    const allKeys = Object.keys(localStorage);
    status.localStorage.keyCount = allKeys.length;
    status.localStorage.keys = allKeys;
    status.localStorage.jobproofKeyCount = allKeys.filter(
        k => k.startsWith('jobproof_') || k.startsWith('sb-') || k.startsWith('supabase.')
    ).length;

    // sessionStorage
    const sessionKeys = Object.keys(sessionStorage);
    status.sessionStorage.keyCount = sessionKeys.length;
    status.sessionStorage.keys = sessionKeys;

    // Supabase auth
    const supabaseKeys = allKeys.filter(k => k.startsWith('sb-') || k.startsWith('supabase.'));
    status.supabaseAuth.hasSession = supabaseKeys.length > 0;

    // Caches
    if ('caches' in window) {
        const cacheNames = await caches.keys();
        status.caches.count = cacheNames.length;
        status.caches.names = cacheNames;
    }

    return status;
}

/**
 * Verify that all persistence layers are in a clean state.
 *
 * Returns true only if:
 * - No IndexedDB databases exist (or all tables are empty)
 * - No jobproof_* keys in localStorage
 * - No sb-* or supabase.* keys in localStorage
 * - No caches exist
 *
 * This is the "proof" that resetAll() worked.
 */
async function verifyCleanState(): Promise<boolean> {
    guardTestingAccess('verifyCleanState');

    let isClean = true;
    const issues: string[] = [];

    // Check localStorage for app keys
    const appKeys = Object.keys(localStorage).filter(
        k => k.startsWith('jobproof_') || k.startsWith('sb-') || k.startsWith('supabase.')
    );
    if (appKeys.length > 0) {
        isClean = false;
        issues.push(`localStorage has ${appKeys.length} app keys: ${appKeys.slice(0, 5).join(', ')}...`);
    }

    // Check IndexedDB
    if (indexedDB.databases) {
        const dbs = await indexedDB.databases();
        if (dbs.length > 0) {
            isClean = false;
            issues.push(`IndexedDB has ${dbs.length} databases: ${dbs.map(d => d.name).join(', ')}`);
        }
    }

    // Check caches
    if ('caches' in window) {
        const cacheNames = await caches.keys();
        if (cacheNames.length > 0) {
            isClean = false;
            issues.push(`Cache API has ${cacheNames.length} caches: ${cacheNames.join(', ')}`);
        }
    }

    if (!isClean) {
        console.warn('[TestingControlPlane] verifyCleanState FAILED:', issues);
    } else {
        console.log('[TestingControlPlane] verifyCleanState PASSED - all layers clean');
    }

    return isClean;
}

/**
 * Check if testing access is allowed in current environment.
 * Useful for UI to show/hide testing controls.
 */
function isTestingAllowed(): boolean {
    const isDev = import.meta.env.DEV;
    const isLocalhost = typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' ||
         window.location.hostname === '127.0.0.1');
    const hasTestFlag = typeof localStorage !== 'undefined' &&
        localStorage.getItem('jobproof_enable_testing') === 'CONFIRMED';

    return isDev || isLocalhost || hasTestFlag;
}

// ============================================================================
// EXPORT
// ============================================================================

/**
 * Testing Control Plane API
 *
 * All methods are guarded and will throw in production.
 * Exposed at window.__JOBPROOF_TEST__ in dev mode.
 */
export const TestingControlPlane = {
    resetAll,
    getLayerStatus,
    verifyCleanState,
    isTestingAllowed,
    // Build info for debugging
    buildInfo: BUILD_INFO,
};

export type TestingControlPlaneType = typeof TestingControlPlane;
