import Dexie, { type Table } from 'dexie';
import { Job, Photo, SyncStatus } from '../../types';

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

export class JobProofDatabase extends Dexie {
    jobs!: Table<LocalJob, string>;
    queue!: Table<OfflineAction, number>;
    media!: Table<LocalMedia, string>;
    formDrafts!: Table<FormDraft, string>; // CLAUDE.md: Dexie/IndexedDB draft saving

    constructor() {
        super('JobProofOfflineDB');
        this.version(1).stores({
            jobs: 'id, syncStatus, workspaceId, status', // Indexes
            queue: '++id, type, synced, createdAt',
            media: 'id, jobId'
        });
        // Version 2: Add formDrafts for CLAUDE.md offline mandate
        this.version(2).stores({
            jobs: 'id, syncStatus, workspaceId, status',
            queue: '++id, type, synced, createdAt',
            media: 'id, jobId',
            formDrafts: 'formType, savedAt' // Primary key: formType
        });
    }
}

export const db = new JobProofDatabase();

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
