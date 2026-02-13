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

/**
 * Result of workspace-scoped reset operation.
 * Unlike ResetResult, this only affects a single workspace's data.
 */
export interface WorkspaceResetResult {
    success: boolean;
    workspaceId: string;
    indexedDB: {
        jobsDeleted: number;
        clientsDeleted: number;
        techniciansDeleted: number;
        formDraftsDeleted: number;
        error?: string;
    };
    localStorage: {
        keysDeleted: number;
        keys: string[];
        error?: string;
    };
    durationMs: number;
    errors: string[];
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
// FEATURE FLAGS
// ============================================================================

/**
 * Check if workspace-isolated storage is enabled.
 * When enabled, localStorage keys are prefixed with workspaceId.
 */
export function isWorkspaceIsolatedStorageEnabled(): boolean {
    return localStorage.getItem('jobproof_feature_workspace_isolated_storage') === 'true';
}

/**
 * Enable workspace-isolated storage feature flag.
 * Use this in test setup to enable isolation.
 */
export function enableWorkspaceIsolatedStorage(): void {
    guardTestingAccess('enableWorkspaceIsolatedStorage');
    localStorage.setItem('jobproof_feature_workspace_isolated_storage', 'true');
}

/**
 * Disable workspace-isolated storage feature flag.
 * Data will use shared keys (default behavior).
 */
export function disableWorkspaceIsolatedStorage(): void {
    guardTestingAccess('disableWorkspaceIsolatedStorage');
    localStorage.removeItem('jobproof_feature_workspace_isolated_storage');
}

/**
 * Get the localStorage key for a given base key and workspace.
 * When isolation is enabled: `${baseKey}:${workspaceId}`
 * When disabled: `${baseKey}` (backward compatible)
 */
export function getWorkspaceStorageKey(baseKey: string, workspaceId?: string | null): string {
    if (isWorkspaceIsolatedStorageEnabled() && workspaceId) {
        return `${baseKey}:${workspaceId}`;
    }
    return baseKey;
}

// ============================================================================
// WORKSPACE-SCOPED RESET
// ============================================================================

/**
 * Reset only a single workspace's data while preserving other workspaces.
 *
 * This is the KEY function for test isolation - allows parallel tests
 * to run without interfering with each other.
 *
 * Clears:
 * 1. IndexedDB records where workspaceId matches
 * 2. localStorage keys prefixed with workspace ID (when isolation enabled)
 *
 * Does NOT clear:
 * - Service Worker (shared across all workspaces)
 * - Session Storage (shared)
 * - Cookies (shared)
 * - Supabase auth (shared)
 * - Other workspaces' data
 *
 * @param workspaceId - The workspace ID to reset
 * @returns Detailed result with counts of deleted items
 */
async function resetWorkspace(workspaceId: string): Promise<WorkspaceResetResult> {
    guardTestingAccess('resetWorkspace');

    const startTime = Date.now();
    const errors: string[] = [];
    const result: WorkspaceResetResult = {
        success: false,
        workspaceId,
        indexedDB: {
            jobsDeleted: 0,
            clientsDeleted: 0,
            techniciansDeleted: 0,
            formDraftsDeleted: 0,
        },
        localStorage: {
            keysDeleted: 0,
            keys: [],
        },
        durationMs: 0,
        errors: [],
    };


    try {
        // Step 1: Delete IndexedDB records for this workspace
        try {
            const database = await getDatabase();

            // Delete jobs for this workspace
            const jobsDeleted = await database.jobs
                .where('workspaceId')
                .equals(workspaceId)
                .delete();
            result.indexedDB.jobsDeleted = jobsDeleted;

            // Delete clients for this workspace
            const clientsDeleted = await database.clients
                .where('workspaceId')
                .equals(workspaceId)
                .delete();
            result.indexedDB.clientsDeleted = clientsDeleted;

            // Delete technicians for this workspace
            const techniciansDeleted = await database.technicians
                .where('workspaceId')
                .equals(workspaceId)
                .delete();
            result.indexedDB.techniciansDeleted = techniciansDeleted;

            // Delete form drafts (these are keyed by formType, not workspaceId)
            // We need to check if workspace isolation is enabled and handle accordingly
            if (isWorkspaceIsolatedStorageEnabled()) {
                // When isolation is enabled, form drafts use workspaceId in key
                // Form types might be like 'client:ws-123', 'job:ws-123'
                const allDrafts = await database.formDrafts.toArray();
                const workspaceDrafts = allDrafts.filter(d =>
                    d.formType.includes(`:${workspaceId}`)
                );
                for (const draft of workspaceDrafts) {
                    await database.formDrafts.delete(draft.formType);
                    result.indexedDB.formDraftsDeleted++;
                }
            }

        } catch (error) {
            const msg = `IndexedDB workspace clear: ${error instanceof Error ? error.message : String(error)}`;
            errors.push(msg);
            result.indexedDB.error = msg;
        }

        // Step 2: Delete workspace-prefixed localStorage keys
        try {
            const keysToDelete: string[] = [];

            // When isolation is enabled, keys have :workspaceId suffix
            if (isWorkspaceIsolatedStorageEnabled()) {
                const suffix = `:${workspaceId}`;
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.endsWith(suffix)) {
                        keysToDelete.push(key);
                    }
                }
            }

            // Also check for any keys that contain the workspaceId explicitly
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.includes(workspaceId) && !keysToDelete.includes(key)) {
                    keysToDelete.push(key);
                }
            }

            // Delete the keys
            for (const key of keysToDelete) {
                localStorage.removeItem(key);
            }

            result.localStorage.keysDeleted = keysToDelete.length;
            result.localStorage.keys = keysToDelete;

        } catch (error) {
            const msg = `localStorage workspace clear: ${error instanceof Error ? error.message : String(error)}`;
            errors.push(msg);
            result.localStorage.error = msg;
        }

    } catch (error) {
        const msg = `Unexpected error: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(msg);
    }

    result.durationMs = Date.now() - startTime;
    result.errors = errors;
    result.success = errors.length === 0;


    return result;
}

/**
 * Get the status of a specific workspace's data.
 * Useful for verifying isolation between workspaces.
 */
async function getWorkspaceStatus(workspaceId: string): Promise<{
    workspaceId: string;
    indexedDB: {
        jobsCount: number;
        clientsCount: number;
        techniciansCount: number;
    };
    localStorage: {
        keyCount: number;
        keys: string[];
    };
}> {
    guardTestingAccess('getWorkspaceStatus');

    const status = {
        workspaceId,
        indexedDB: {
            jobsCount: 0,
            clientsCount: 0,
            techniciansCount: 0,
        },
        localStorage: {
            keyCount: 0,
            keys: [] as string[],
        },
    };

    try {
        const database = await getDatabase();

        status.indexedDB.jobsCount = await database.jobs
            .where('workspaceId')
            .equals(workspaceId)
            .count();

        status.indexedDB.clientsCount = await database.clients
            .where('workspaceId')
            .equals(workspaceId)
            .count();

        status.indexedDB.techniciansCount = await database.technicians
            .where('workspaceId')
            .equals(workspaceId)
            .count();
    } catch (error) {
        console.warn('[TestingControlPlane] Failed to get IndexedDB status:', error);
    }

    // Check localStorage for workspace-specific keys
    const workspaceKeys: string[] = [];
    const suffix = `:${workspaceId}`;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.endsWith(suffix) || key.includes(workspaceId))) {
            workspaceKeys.push(key);
        }
    }
    status.localStorage.keyCount = workspaceKeys.length;
    status.localStorage.keys = workspaceKeys;

    return status;
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


    try {
        // Step 1: Close all Dexie connections FIRST
        // This is critical - deleteDatabase will be "blocked" if connections are open
        await closeAllConnections();
        _resetDbInstance();

        // Step 2: Sign out Supabase (before clearing its localStorage keys)
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
        try {
            const ssResult = clearSessionStorage();
            result.layers.sessionStorage.cleared = ssResult;
        } catch (error) {
            const msg = `sessionStorage: ${error instanceof Error ? error.message : String(error)}`;
            errors.push(msg);
            result.layers.sessionStorage.error = msg;
        }

        // Step 7: Clear cookies
        try {
            const cookieResult = clearCookies();
            result.layers.cookies.cleared = cookieResult;
        } catch (error) {
            const msg = `cookies: ${error instanceof Error ? error.message : String(error)}`;
            errors.push(msg);
            result.layers.cookies.error = msg;
        }

        // Step 8: Verify clean state
        result.verified = await verifyCleanState();

    } catch (error) {
        const msg = `Unexpected error: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(msg);
    }

    result.durationMs = Date.now() - startTime;
    result.errors = errors;
    result.success = errors.length === 0 && result.verified;


    if (autoReload) {
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
    // Core reset functions
    resetAll,
    resetWorkspace,

    // Status inspection
    getLayerStatus,
    getWorkspaceStatus,
    verifyCleanState,

    // Feature flags for workspace isolation
    isWorkspaceIsolatedStorageEnabled,
    enableWorkspaceIsolatedStorage,
    disableWorkspaceIsolatedStorage,
    getWorkspaceStorageKey,

    // Access control
    isTestingAllowed,

    // Build info for debugging
    buildInfo: BUILD_INFO,
};

export type TestingControlPlaneType = typeof TestingControlPlane;
