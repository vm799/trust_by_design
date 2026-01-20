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

export class JobProofDatabase extends Dexie {
    jobs!: Table<LocalJob, string>;
    queue!: Table<OfflineAction, number>;
    media!: Table<LocalMedia, string>;

    constructor() {
        super('JobProofOfflineDB');
        this.version(1).stores({
            jobs: 'id, syncStatus, workspaceId, status', // Indexes
            queue: '++id, type, synced, createdAt',
            media: 'id, jobId'
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
