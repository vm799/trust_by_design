import Dexie, { type Table } from 'dexie';
import { Job, Photo, SyncStatus } from '../../types';

// Database schema version - increment when schema changes
// v3: Added clients and technicians tables for offline persistence
const DB_SCHEMA_VERSION = 3;
const DB_NAME = 'JobProofOfflineDB';

export interface LocalJob extends Job {
    syncStatus: SyncStatus;
    lastUpdated: number;
}

export interface OfflineAction {
    id?: number;
    type: 'CREATE_JOB' | 'UPDATE_JOB' | 'UPLOAD_PHOTO' | 'SEAL_JOB';
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
    status: 'Available' | 'On Site' | 'Off Duty' | 'Authorised';
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

        // Handle version change from other tabs
        this.on('versionchange', () => {
            console.log('[DB] Version change detected from another tab, closing...');
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
        console.log('[DB] Database opened successfully');
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

/**
 * Purge corrupted/outdated database and recreate fresh
 */
async function purgeAndRecreateDatabase(): Promise<void> {
    console.log('[DB] Purging legacy database...');

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
        console.log('[DB] Legacy database deleted');
    } catch (e) {
        console.warn('[DB] Could not delete database:', e);
    }

    // Clear any localStorage schema version markers
    try {
        localStorage.removeItem('jobproof_db_version');
    } catch (e) {
        // Ignore localStorage errors
    }

    // Create fresh instance
    dbInstance = new JobProofDatabase();
    await dbInstance.open();
    console.log('[DB] Fresh database created successfully');

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
            console.log(`[DB] Schema version mismatch: stored=${storedVersion}, current=${currentVersion}`);
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
    console.log('[DB] Clearing all IndexedDB data...');

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
    console.log('[DB] All data cleared');
}

// Legacy export for backward compatibility - auto-opens on first use
export const db = new JobProofDatabase();

// Initialize database with error handling on module load
if (typeof window !== 'undefined') {
    db.open().catch((error: any) => {
        if (error.name === 'UpgradeError' || error.message?.includes('UpgradeError')) {
            console.warn('[DB] UpgradeError on init - will purge on next access');
            purgeAndRecreateDatabase().catch(console.error);
        } else {
            console.error('[DB] Failed to open database on init:', error);
        }
    });
}

export async function saveJobLocal(job: LocalJob) {
    return await db.jobs.put(job);
}

export async function getJobLocal(id: string) {
    return await db.jobs.get(id);
}

export async function getAllJobsLocal(workspaceId: string) {
    return await db.jobs
        .where('workspaceId')
        .equals(workspaceId)
        .reverse()
        .sortBy('lastUpdated'); // Sort by recent
}

export async function saveMediaLocal(id: string, jobId: string, data: string) {
    return await db.media.put({
        id,
        jobId,
        data,
        createdAt: Date.now()
    });
}

export async function getMediaLocal(id: string) {
    const record = await db.media.get(id);
    return record?.data || null;
}

export async function queueAction(type: OfflineAction['type'], payload: any) {
    return await db.queue.add({
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

const DRAFT_EXPIRY_MS = 8 * 60 * 60 * 1000; // 8 hours

/**
 * Save form draft to IndexedDB
 * CLAUDE.md: "Dexie/IndexedDB draft saving (every keystroke)"
 */
export async function saveFormDraft(formType: string, data: Record<string, unknown>): Promise<void> {
    await db.formDrafts.put({
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
    const draft = await db.formDrafts.get(formType);
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
    await db.formDrafts.delete(formType);
}

// ============================================================================
// CLIENT LOCAL PERSISTENCE (CLAUDE.md Mandate: Offline-first)
// ============================================================================

/**
 * Save a single client to IndexedDB
 */
export async function saveClientLocal(client: LocalClient): Promise<string> {
    return await db.clients.put(client);
}

/**
 * Get a single client by ID
 */
export async function getClientLocal(id: string): Promise<LocalClient | undefined> {
    return await db.clients.get(id);
}

/**
 * Get all clients for a workspace
 */
export async function getClientsLocal(workspaceId: string): Promise<LocalClient[]> {
    return await db.clients
        .where('workspaceId')
        .equals(workspaceId)
        .sortBy('name');
}

/**
 * Batch save clients (for initial sync from Supabase)
 */
export async function saveClientsBatch(clients: LocalClient[]): Promise<void> {
    await db.clients.bulkPut(clients);
}

/**
 * Delete a client from local storage
 */
export async function deleteClientLocal(id: string): Promise<void> {
    await db.clients.delete(id);
}

/**
 * Count clients in a workspace
 */
export async function countClientsLocal(workspaceId: string): Promise<number> {
    return await db.clients
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
    return await db.technicians.put(technician);
}

/**
 * Get a single technician by ID
 */
export async function getTechnicianLocal(id: string): Promise<LocalTechnician | undefined> {
    return await db.technicians.get(id);
}

/**
 * Get all technicians for a workspace
 */
export async function getTechniciansLocal(workspaceId: string): Promise<LocalTechnician[]> {
    return await db.technicians
        .where('workspaceId')
        .equals(workspaceId)
        .sortBy('name');
}

/**
 * Batch save technicians (for initial sync from Supabase)
 */
export async function saveTechniciansBatch(technicians: LocalTechnician[]): Promise<void> {
    await db.technicians.bulkPut(technicians);
}

/**
 * Delete a technician from local storage
 */
export async function deleteTechnicianLocal(id: string): Promise<void> {
    await db.technicians.delete(id);
}

/**
 * Count technicians in a workspace
 */
export async function countTechniciansLocal(workspaceId: string): Promise<number> {
    return await db.technicians
        .where('workspaceId')
        .equals(workspaceId)
        .count();
}
