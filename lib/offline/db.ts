import Dexie, { type Table } from 'dexie';
import { Job, SyncStatus } from '../../types';

// Database schema version - increment when schema changes
// v3: Added clients and technicians tables for offline persistence
// v4: Added orphanPhotos table for failed sync recovery (Sprint 1 Task 1.3)
// v5: Added archivedAt index for Fix 3.1 (auto-archive sealed jobs >180 days)
// v6: Added syncConflicts table for Fix 3.3 (sync conflict detection & UI)
const DB_SCHEMA_VERSION = 6;
const DB_NAME = 'JobProofOfflineDB';

export interface LocalJob extends Job {
    syncStatus: SyncStatus;
    lastUpdated: number;
}

export interface OfflineAction {
    id?: number;
    type: 'CREATE_JOB' | 'UPDATE_JOB' | 'DELETE_JOB' | 'UPLOAD_PHOTO' | 'SEAL_JOB'
        | 'CREATE_CLIENT' | 'UPDATE_CLIENT' | 'DELETE_CLIENT'
        | 'CREATE_TECHNICIAN' | 'UPDATE_TECHNICIAN' | 'DELETE_TECHNICIAN';
    payload: any;
    createdAt: number;
    synced: boolean;
    retryCount: number;
}

export interface LocalMedia {
    id: string; // matches photo.url key
    jobId: string;
    data: string; // Base64
    createdAt: number;
}

// CLAUDE.md mandate: Form draft storage for offline persistence
export interface FormDraft {
    formType: string; // 'client' | 'technician' | 'job'
    data: Record<string, unknown>;
    savedAt: number;
}

// Sprint 1 Task 1.3: Orphan photo log for failed sync recovery
export interface OrphanPhoto {
    id: string;           // Photo ID
    jobId: string;        // Associated job ID
    jobTitle?: string;    // Job title for user display
    type?: string;        // Photo type (before/during/after/evidence)
    timestamp?: string;   // When photo was taken
    lat?: number;         // GPS latitude (preserved for audit trail)
    lng?: number;         // GPS longitude
    w3w?: string;         // What3Words location
    reason: string;       // Why it became orphaned
    orphanedAt: number;   // When it was orphaned
    recoveryAttempts: number; // How many times we tried to recover
}

// Fix 3.3: Sync conflict record for conflict history and resolution UI
export interface SyncConflictRecord {
    id?: number;
    jobId: string;
    local: any;           // Local job version (stored as JSON)
    remote: any;          // Remote job version (stored as JSON)
    conflictFields: string[]; // Fields that differ
    detectedAt: string;   // ISO timestamp when detected
    resolvedAt?: string;  // ISO timestamp when resolved
    resolution: 'local' | 'remote' | 'manual' | null; // How conflict was resolved
}

// CLAUDE.md mandate: Clients must persist offline
export interface LocalClient {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    totalJobs: number;
    type?: string;
    notes?: string;
    workspaceId: string;
    syncStatus: SyncStatus;
    lastUpdated: number;
}

// CLAUDE.md mandate: Technicians must persist offline
export interface LocalTechnician {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    status: 'Available' | 'On Site' | 'Off Duty' | 'Authorised' | 'In Transit' | 'Offline' | 'Registered';
    rating: number;
    jobsCompleted: number;
    specialty?: string;
    workspaceId: string;
    syncStatus: SyncStatus;
    lastUpdated: number;
}

export class JobProofDatabase extends Dexie {
    jobs!: Table<LocalJob, string>;
    queue!: Table<OfflineAction, number>;
    media!: Table<LocalMedia, string>;
    formDrafts!: Table<FormDraft, string>;
    clients!: Table<LocalClient, string>;       // v3: CLAUDE.md offline mandate
    technicians!: Table<LocalTechnician, string>; // v3: CLAUDE.md offline mandate
    orphanPhotos!: Table<OrphanPhoto, string>;    // v4: Failed sync recovery
    syncConflicts!: Table<SyncConflictRecord, number>; // v6: Fix 3.3 conflict history

    constructor() {
        super(DB_NAME);
        this.version(1).stores({
            jobs: 'id, syncStatus, workspaceId, status',
            queue: '++id, type, synced, createdAt',
            media: 'id, jobId'
        });
        // Version 2: Add formDrafts for CLAUDE.md offline mandate
        this.version(2).stores({
            jobs: 'id, syncStatus, workspaceId, status',
            queue: '++id, type, synced, createdAt',
            media: 'id, jobId',
            formDrafts: 'formType, savedAt'
        });
        // Version 3: Add clients and technicians for CLAUDE.md offline mandate
        this.version(3).stores({
            jobs: 'id, syncStatus, workspaceId, status',
            queue: '++id, type, synced, createdAt',
            media: 'id, jobId',
            formDrafts: 'formType, savedAt',
            clients: 'id, workspaceId, name',
            technicians: 'id, workspaceId, name'
        });
        // Version 4: Add orphanPhotos for failed sync recovery (Sprint 1 Task 1.3)
        this.version(4).stores({
            jobs: 'id, syncStatus, workspaceId, status',
            queue: '++id, type, synced, createdAt',
            media: 'id, jobId',
            formDrafts: 'formType, savedAt',
            clients: 'id, workspaceId, name',
            technicians: 'id, workspaceId, name',
            orphanPhotos: 'id, jobId, orphanedAt'
        });
        // Version 5: Add archivedAt index for Fix 3.1 (auto-archive sealed jobs >180 days)
        this.version(5).stores({
            jobs: 'id, syncStatus, workspaceId, status, archivedAt, isArchived',
            queue: '++id, type, synced, createdAt',
            media: 'id, jobId',
            formDrafts: 'formType, savedAt',
            clients: 'id, workspaceId, name',
            technicians: 'id, workspaceId, name',
            orphanPhotos: 'id, jobId, orphanedAt'
        });
        // Version 6: Add syncConflicts table for Fix 3.3 (sync conflict detection & UI)
        this.version(6).stores({
            jobs: 'id, syncStatus, workspaceId, status, archivedAt, isArchived',
            queue: '++id, type, synced, createdAt',
            media: 'id, jobId',
            formDrafts: 'formType, savedAt',
            clients: 'id, workspaceId, name',
            technicians: 'id, workspaceId, name',
            orphanPhotos: 'id, jobId, orphanedAt',
            syncConflicts: '++id, jobId, detectedAt'
        });

        // Handle version change from other tabs
        this.on('versionchange', () => {
            this.close();
            // Notify user or auto-reload
            if (typeof window !== 'undefined') {
                window.location.reload();
            }
        });
    }
}

// Create singleton instance
let dbInstance: JobProofDatabase | null = null;

/**
 * Get database instance with automatic error recovery
 * Handles UpgradeError and DatabaseClosedError gracefully
 */
export async function getDatabase(): Promise<JobProofDatabase> {
    if (dbInstance && dbInstance.isOpen()) {
        return dbInstance;
    }

    dbInstance = new JobProofDatabase();

    try {
        await dbInstance.open();
        return dbInstance;
    } catch (error: any) {
        // Handle UpgradeError - schema mismatch, need to delete and recreate
        if (error.name === 'UpgradeError' || error.message?.includes('UpgradeError')) {
            console.warn('[DB] Schema mismatch detected. Purging legacy database...');
            await purgeAndRecreateDatabase();
            return dbInstance!;
        }

        // Handle DatabaseClosedError - try to reopen
        if (error.name === 'DatabaseClosedError' || error.message?.includes('DatabaseClosedError')) {
            console.warn('[DB] Database was closed unexpectedly. Reopening...');
            dbInstance = new JobProofDatabase();
            await dbInstance.open();
            return dbInstance;
        }

        // Handle other IndexedDB errors
        if (error.name === 'InvalidStateError' || error.name === 'QuotaExceededError') {
            console.error('[DB] IndexedDB error:', error.name, '- Purging database...');
            await purgeAndRecreateDatabase();
            return dbInstance!;
        }

        console.error('[DB] Failed to open database:', error);
        throw error;
    }
}

// ============================================================================
// SAFE SCHEMA UPGRADE: Rescue critical data before purge
// Previously, purgeAndRecreateDatabase() wiped ALL local data — including
// pending sync queue items, unsynced photos, form drafts, and locally-created
// jobs that hadn't synced to the server yet. This caused silent data loss.
//
// Now: Before purging, we export critical data to localStorage as a rescue
// payload. After recreating the database, we reimport it.
// ============================================================================

const RESCUE_KEY = 'jobproof_db_rescue';

// Max rescue payload size: 2MB leaves headroom under the ~5MB localStorage quota
// for other keys (sync queue, lastSyncAt, conflict history, etc.)
const MAX_RESCUE_PAYLOAD_BYTES = 2 * 1024 * 1024;

interface RescuePayload {
    pendingJobs: LocalJob[];       // Jobs with syncStatus 'pending'
    queueItems: OfflineAction[];   // Unsynced queue items
    formDrafts: FormDraft[];       // Partially filled forms
    rescuedAt: number;             // Timestamp for staleness detection
}

/**
 * Rescue critical data from the database before purging.
 * Saves pending jobs, queue items, and form drafts to localStorage.
 *
 * SIZE LIMIT: Estimates payload size before writing. If over 2MB,
 * progressively drops formDrafts, then queueItems — pendingJobs
 * are preserved as highest priority (unsaved field evidence).
 */
async function rescueDataBeforePurge(): Promise<void> {
    if (!dbInstance || !dbInstance.isOpen()) return;

    try {
        const pendingJobs = await dbInstance.jobs
            .where('syncStatus').equals('pending')
            .toArray()
            .catch(() => [] as LocalJob[]);

        let queueItems = await dbInstance.queue
            .where('synced').equals(0)
            .toArray()
            .catch(() => [] as OfflineAction[]);

        let formDrafts = await dbInstance.formDrafts
            .toArray()
            .catch(() => [] as FormDraft[]);

        // Only rescue if there's actually data to save
        if (pendingJobs.length === 0 && queueItems.length === 0 && formDrafts.length === 0) {
            return;
        }

        let payload: RescuePayload = {
            pendingJobs,
            queueItems,
            formDrafts,
            rescuedAt: Date.now(),
        };

        // SIZE CHECK: Estimate and truncate if too large for localStorage
        let serialized = JSON.stringify(payload);
        if (serialized.length > MAX_RESCUE_PAYLOAD_BYTES) {
            // Drop formDrafts first (least critical)
            console.warn(`[DB] Rescue payload too large (${serialized.length} bytes). Truncating formDrafts.`);
            formDrafts = [];
            payload = { ...payload, formDrafts };
            serialized = JSON.stringify(payload);
        }
        if (serialized.length > MAX_RESCUE_PAYLOAD_BYTES) {
            // Still too large — drop queueItems (can be re-created from pending jobs)
            console.warn(`[DB] Rescue payload still too large (${serialized.length} bytes). Truncating queueItems.`);
            queueItems = [];
            payload = { ...payload, queueItems };
            serialized = JSON.stringify(payload);
        }
        if (serialized.length > MAX_RESCUE_PAYLOAD_BYTES) {
            // Last resort: keep only the newest pending jobs
            const halfCount = Math.floor(pendingJobs.length / 2);
            console.warn(`[DB] Rescue payload still too large. Keeping ${halfCount} newest pending jobs.`);
            payload = { ...payload, pendingJobs: pendingJobs.slice(-halfCount) };
            serialized = JSON.stringify(payload);
        }

        localStorage.setItem(RESCUE_KEY, serialized);
        console.warn(`[DB] Rescued ${payload.pendingJobs.length} pending jobs, ${payload.queueItems.length} queue items, ${payload.formDrafts.length} form drafts before purge`);
    } catch (error) {
        console.error('[DB] Failed to rescue data before purge:', error);
        // Non-fatal: purge proceeds even if rescue fails
    }
}

/**
 * Reimport rescued data into the freshly created database.
 * Called after purgeAndRecreateDatabase() succeeds.
 */
async function reimportRescuedData(): Promise<void> {
    const rescueJson = localStorage.getItem(RESCUE_KEY);
    if (!rescueJson || !dbInstance) return;

    try {
        const payload: RescuePayload = JSON.parse(rescueJson);

        // Don't reimport stale rescue data (older than 24 hours)
        if (Date.now() - payload.rescuedAt > 24 * 60 * 60 * 1000) {
            console.warn('[DB] Rescue payload is stale (>24h), discarding');
            localStorage.removeItem(RESCUE_KEY);
            return;
        }

        // Reimport pending jobs
        if (payload.pendingJobs.length > 0) {
            await dbInstance.jobs.bulkPut(payload.pendingJobs);
            console.info(`[DB] Reimported ${payload.pendingJobs.length} pending jobs`);
        }

        // Reimport queue items
        if (payload.queueItems.length > 0) {
            await dbInstance.queue.bulkAdd(payload.queueItems);
            console.info(`[DB] Reimported ${payload.queueItems.length} queue items`);
        }

        // Reimport form drafts
        if (payload.formDrafts.length > 0) {
            await dbInstance.formDrafts.bulkPut(payload.formDrafts);
            console.info(`[DB] Reimported ${payload.formDrafts.length} form drafts`);
        }

        // Clean up rescue payload
        localStorage.removeItem(RESCUE_KEY);
        console.info('[DB] Rescue data reimported successfully');
    } catch (error) {
        console.error('[DB] Failed to reimport rescued data:', error);
        // Don't remove rescue key — allows manual recovery
    }
}

/**
 * Purge corrupted/outdated database and recreate fresh.
 * Now rescues critical data before wiping.
 */
async function purgeAndRecreateDatabase(): Promise<void> {

    // RESCUE: Export critical data before destroying the database
    await rescueDataBeforePurge();

    // Close existing instance if open
    if (dbInstance) {
        try {
            dbInstance.close();
        } catch (e) {
            // Ignore close errors
        }
    }

    // Delete the database entirely
    try {
        await Dexie.delete(DB_NAME);
    } catch (e) {
        console.warn('[DB] Could not delete database:', e);
    }

    // Clear any localStorage schema version markers
    try {
        localStorage.removeItem('jobproof_db_version');
    } catch (e) {
        // Ignore localStorage errors
    }

    // Clear lastSyncAt keys to force full pull after purge.
    // Without this, incremental sync uses a stale timestamp and misses
    // records that existed before the purge — phantom data loss.
    try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('jobproof_last_sync_at_')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (e) {
        // Ignore localStorage errors
    }

    // Create fresh instance
    dbInstance = new JobProofDatabase();
    await dbInstance.open();

    // REIMPORT: Restore rescued data into the fresh database
    await reimportRescuedData();

    // Store current schema version
    try {
        localStorage.setItem('jobproof_db_version', String(DB_SCHEMA_VERSION));
    } catch (e) {
        // Ignore localStorage errors
    }
}

/**
 * Check if database needs migration on app startup
 * Call this early in app initialization
 */
export async function checkDatabaseHealth(): Promise<boolean> {
    try {
        // Check stored schema version
        const storedVersion = localStorage.getItem('jobproof_db_version');
        const currentVersion = String(DB_SCHEMA_VERSION);

        if (storedVersion && storedVersion !== currentVersion) {
            await purgeAndRecreateDatabase();
            return true;
        }

        // Try to open and verify database health
        const database = await getDatabase();
        await database.jobs.count(); // Simple health check query

        // Store current version if not set
        if (!storedVersion) {
            localStorage.setItem('jobproof_db_version', currentVersion);
        }

        return true;
    } catch (error) {
        console.error('[DB] Health check failed:', error);
        return false;
    }
}

/**
 * Force clear all IndexedDB data (nuclear option)
 * Use when user needs a complete reset
 */
export async function clearAllData(): Promise<void> {

    if (dbInstance) {
        try {
            dbInstance.close();
        } catch (e) {
            // Ignore
        }
    }

    await Dexie.delete(DB_NAME);
    localStorage.removeItem('jobproof_db_version');

    dbInstance = null;
}

/**
 * Get database instance - LAZY INITIALIZATION
 *
 * This is the ONLY way to access the database. No eager singleton.
 * Critical for test isolation - tests can reset dbInstance before any access.
 *
 * @see lib/testingControlPlane.ts for test reset capabilities
 */
export async function getDb(): Promise<JobProofDatabase> {
    return getDatabase();
}

/**
 * Close all database connections
 * Required before deleteDatabase() to prevent "blocked" state
 *
 * @returns true if closed successfully
 */
export async function closeAllConnections(): Promise<boolean> {
    if (dbInstance) {
        try {
            dbInstance.close();
            dbInstance = null;
            return true;
        } catch (error) {
            console.warn('[DB] Error closing connections:', error);
            return false;
        }
    }
    return true;
}

/**
 * Reset database instance for testing
 * ONLY call this from TestingControlPlane
 */
export function _resetDbInstance(): void {
    if (dbInstance) {
        try {
            dbInstance.close();
        } catch (_e) {
            // Ignore
        }
    }
    dbInstance = null;
}

export async function saveJobLocal(job: LocalJob) {
    const database = await getDatabase();
    return await database.jobs.put(job);
}

export async function getJobLocal(id: string) {
    const database = await getDatabase();
    return await database.jobs.get(id);
}

export async function getAllJobsLocal(workspaceId: string) {
    const database = await getDatabase();
    return await database.jobs
        .where('workspaceId')
        .equals(workspaceId)
        .reverse()
        .sortBy('lastUpdated'); // Sort by recent
}

// P0 FIX: Custom error for quota exceeded - allows callers to surface meaningful message
export class StorageQuotaExceededError extends Error {
    constructor(message: string = 'Device storage is full. Please free up space.') {
        super(message);
        this.name = 'StorageQuotaExceededError';
    }
}

export async function saveMediaLocal(id: string, jobId: string, data: string) {
    try {
        const database = await getDatabase();
        return await database.media.put({
            id,
            jobId,
            data,
            createdAt: Date.now()
        });
    } catch (error: any) {
        // P0 CRITICAL: Detect quota exceeded and throw meaningful error
        // Never silently fail when device storage is full
        if (error?.name === 'QuotaExceededError' ||
            error?.message?.includes('QuotaExceededError') ||
            error?.inner?.name === 'QuotaExceededError') {
            console.error('[DB] Storage quota exceeded when saving media:', id);
            throw new StorageQuotaExceededError();
        }
        // Re-throw other errors
        throw error;
    }
}

export async function getMediaLocal(id: string): Promise<string | null> {
    const database = await getDatabase();
    const record = await database.media.get(id);
    if (!record) return null;
    // Handle both Dexie LocalMedia objects and legacy raw IDB string values
    if (typeof record === 'string') return record;
    return record.data || null;
}

export async function queueAction(type: OfflineAction['type'], payload: any) {
    const database = await getDatabase();
    return await database.queue.add({
        type,
        payload,
        createdAt: Date.now(),
        synced: false,
        retryCount: 0
    });
}

// ============================================================================
// FORM DRAFT PERSISTENCE (CLAUDE.md Mandate: Dexie/IndexedDB draft saving)
// ============================================================================

export const DRAFT_EXPIRY_MS = 8 * 60 * 60 * 1000; // 8 hours

/**
 * Save form draft to IndexedDB
 * CLAUDE.md: "Dexie/IndexedDB draft saving (every keystroke)"
 */
export async function saveFormDraft(formType: string, data: Record<string, unknown>): Promise<void> {
    const database = await getDatabase();
    await database.formDrafts.put({
        formType,
        data,
        savedAt: Date.now()
    });
}

/**
 * Get form draft from IndexedDB
 * Returns null if draft is expired (8hr)
 */
export async function getFormDraft(formType: string): Promise<FormDraft | undefined> {
    const database = await getDatabase();
    const draft = await database.formDrafts.get(formType);
    if (!draft) return undefined;

    // Check expiry
    if (Date.now() - draft.savedAt >= DRAFT_EXPIRY_MS) {
        await clearFormDraft(formType);
        return undefined;
    }

    return draft;
}

/**
 * Clear form draft after successful submission
 */
export async function clearFormDraft(formType: string): Promise<void> {
    const database = await getDatabase();
    await database.formDrafts.delete(formType);
}

// ============================================================================
// CLIENT LOCAL PERSISTENCE (CLAUDE.md Mandate: Offline-first)
// ============================================================================

/**
 * Save a single client to IndexedDB
 */
export async function saveClientLocal(client: LocalClient): Promise<string> {
    const database = await getDatabase();
    return await database.clients.put(client);
}

/**
 * Get a single client by ID
 */
export async function getClientLocal(id: string): Promise<LocalClient | undefined> {
    const database = await getDatabase();
    return await database.clients.get(id);
}

/**
 * Get all clients for a workspace
 */
export async function getClientsLocal(workspaceId: string): Promise<LocalClient[]> {
    const database = await getDatabase();
    return await database.clients
        .where('workspaceId')
        .equals(workspaceId)
        .sortBy('name');
}

/**
 * Batch save clients (for initial sync from Supabase)
 */
export async function saveClientsBatch(clients: LocalClient[]): Promise<void> {
    const database = await getDatabase();
    await database.clients.bulkPut(clients);
}

/**
 * Delete a client from local storage
 */
export async function deleteClientLocal(id: string): Promise<void> {
    const database = await getDatabase();
    await database.clients.delete(id);
}

/**
 * Count clients in a workspace
 */
export async function countClientsLocal(workspaceId: string): Promise<number> {
    const database = await getDatabase();
    return await database.clients
        .where('workspaceId')
        .equals(workspaceId)
        .count();
}

// ============================================================================
// TECHNICIAN LOCAL PERSISTENCE (CLAUDE.md Mandate: Offline-first)
// ============================================================================

/**
 * Save a single technician to IndexedDB
 */
export async function saveTechnicianLocal(technician: LocalTechnician): Promise<string> {
    const database = await getDatabase();
    return await database.technicians.put(technician);
}

/**
 * Get a single technician by ID
 */
export async function getTechnicianLocal(id: string): Promise<LocalTechnician | undefined> {
    const database = await getDatabase();
    return await database.technicians.get(id);
}

/**
 * Get all technicians for a workspace
 */
export async function getTechniciansLocal(workspaceId: string): Promise<LocalTechnician[]> {
    const database = await getDatabase();
    return await database.technicians
        .where('workspaceId')
        .equals(workspaceId)
        .sortBy('name');
}

/**
 * Batch save technicians (for initial sync from Supabase)
 */
export async function saveTechniciansBatch(technicians: LocalTechnician[]): Promise<void> {
    const database = await getDatabase();
    await database.technicians.bulkPut(technicians);
}

/**
 * Delete a technician from local storage
 */
export async function deleteTechnicianLocal(id: string): Promise<void> {
    const database = await getDatabase();
    await database.technicians.delete(id);
}

/**
 * Count technicians in a workspace
 */
export async function countTechniciansLocal(workspaceId: string): Promise<number> {
    const database = await getDatabase();
    return await database.technicians
        .where('workspaceId')
        .equals(workspaceId)
        .count();
}

// ============================================================================
// ORPHAN PHOTO RECOVERY (Sprint 1 Task 1.3: Preserve failed photo references)
// ============================================================================

/**
 * Save orphan photo metadata when IndexedDB data is lost
 * Preserves metadata (GPS, timestamp, type) for audit trail even if binary is gone
 */
export async function saveOrphanPhoto(orphan: OrphanPhoto): Promise<string> {
    const database = await getDatabase();
    return await database.orphanPhotos.put(orphan);
}

/**
 * Get all orphan photos for a job
 */
export async function getOrphanPhotosForJob(jobId: string): Promise<OrphanPhoto[]> {
    const database = await getDatabase();
    return await database.orphanPhotos
        .where('jobId')
        .equals(jobId)
        .toArray();
}

/**
 * Get all orphan photos (for admin recovery view)
 */
export async function getAllOrphanPhotos(): Promise<OrphanPhoto[]> {
    const database = await getDatabase();
    return await database.orphanPhotos
        .orderBy('orphanedAt')
        .reverse()
        .toArray();
}

/**
 * Count orphan photos (for dashboard badge)
 */
export async function countOrphanPhotos(): Promise<number> {
    const database = await getDatabase();
    return await database.orphanPhotos.count();
}

/**
 * Delete orphan photo after successful recovery or manual dismissal
 */
export async function deleteOrphanPhoto(id: string): Promise<void> {
    const database = await getDatabase();
    await database.orphanPhotos.delete(id);
}

/**
 * Update recovery attempts on orphan photo
 */
export async function incrementOrphanRecoveryAttempts(id: string): Promise<void> {
    const database = await getDatabase();
    const current = await database.orphanPhotos.get(id);
    await database.orphanPhotos.update(id, {
        recoveryAttempts: (current?.recoveryAttempts ?? 0) + 1
    });
}

/**
 * Clear all orphan photos (use with caution - only after verified recovery)
 */
export async function clearAllOrphanPhotos(): Promise<void> {
    const database = await getDatabase();
    await database.orphanPhotos.clear();
}
