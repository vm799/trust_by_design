import { db, queueAction, LocalJob, OfflineAction } from './db';
import { getSupabase, isSupabaseAvailable } from '../supabase';
import { Job, Photo } from '../../types';

/**
 * PULL: Fetch latest jobs from Supabase and update local DB
 */
export async function pullJobs(workspaceId: string) {
    if (!navigator.onLine || !isSupabaseAvailable()) return;
    const supabase = getSupabase();
    if (!supabase) return;

    try {
        const { data, error } = await supabase
            .from('jobs')
            .select('*')
            .eq('workspace_id', workspaceId);

        if (error) throw error;

        if (data) {
            const jobs: LocalJob[] = data.map(row => ({
                id: row.id,
                title: row.title,
                status: row.status,
                client: row.client_name,
                clientId: row.client_id,
                technician: row.technician_name,
                techId: row.technician_id,
                date: row.scheduled_date,
                address: row.address,
                lat: row.lat,
                lng: row.lng,
                w3w: row.w3w,
                notes: row.notes,
                workSummary: row.work_summary,
                photos: row.photos || [], // These are just metadata references
                signature: row.signature_url,
                safetyChecklist: row.safety_checklist || [],
                siteHazards: row.site_hazards || [],
                templateId: row.template_id,
                price: row.price,
                syncStatus: 'synced', // From server = synced
                lastUpdated: new Date(row.updated_at).getTime(),
                workspaceId: row.workspace_id,
                sealedAt: row.sealed_at,
                isSealed: !!row.sealed_at,
                evidenceHash: row.evidence_hash
            }));

            // Bulk put (overwrites existing with latest server state)
            // Note: We might need conflict resolution strategy if local hash is newer
            await db.jobs.bulkPut(jobs);
            console.log(`[Sync] Pulled ${jobs.length} jobs`);
        }
    } catch (error) {
        console.error('[Sync] Pull failed:', error);
    }
}

/**
 * PUSH: Process offline queue
 */
export async function pushQueue() {
    if (!navigator.onLine || !isSupabaseAvailable()) return;

    const pending = await db.queue.where('synced').equals(0).toArray();
    if (pending.length === 0) return;

    console.log(`[Sync] Processing ${pending.length} offline actions...`);

    for (const action of pending) {
        try {
            let success = false;
            switch (action.type) {
                case 'UPDATE_JOB':
                    success = await processUpdateJob(action.payload);
                    break;
                case 'UPLOAD_PHOTO':
                    success = await processUploadPhoto(action.payload);
                    break;
                // Add other cases
            }

            if (success) {
                await db.queue.update(action.id!, { synced: true });
                // Optional: delete from queue after success
                await db.queue.delete(action.id!);
            } else {
                await db.queue.update(action.id!, { retryCount: action.retryCount + 1 });
            }
        } catch (error) {
            console.error(`[Sync] Action ${action.id} failed:`, error);
        }
    }
}

async function processUpdateJob(job: Partial<LocalJob>) {
    const supabase = getSupabase();
    if (!supabase || !job.id) return false;

    // Transform to snake_case for Supabase
    const updateData: any = {
        updated_at: new Date().toISOString()
    };
    if (job.status) updateData.status = job.status;
    if (job.notes) updateData.notes = job.notes;
    if (job.safetyChecklist) updateData.safety_checklist = job.safetyChecklist;
    if (job.photos) updateData.photos = job.photos; // Metadata update
    if (job.w3w) updateData.w3w = job.w3w;
    if (job.lat) updateData.lat = job.lat;
    if (job.lng) updateData.lng = job.lng;
    // ... map other fields

    const { error } = await supabase
        .from('jobs')
        .update(updateData)
        .eq('id', job.id);

    return !error;
}

async function processUploadPhoto(payload: { id: string; jobId: string; dataUrl?: string }) {
    const supabase = getSupabase();
    if (!supabase) return false;

    // Get data from IndexedDB if not in payload
    let dataUrl = payload.dataUrl;
    if (!dataUrl) {
        const record = await db.media.get(payload.id);
        if (!record) return false; // Media lost?
        dataUrl = record.data;
    }

    // Convert and Upload
    // Reuse existing upload logic from supabase.ts or reimplement here
    // For now, assuming successful upload logic:

    // We need to implement the upload. 
    // Usually we'd use the helper `uploadPhoto` from lib/supabase
    // But circular dependency risk.
    // Let's implement basics here.

    try {
        const base64Data = dataUrl.split(',')[1];
        const mimeType = dataUrl.match(/data:([^;]+);/)?.[1] || 'image/jpeg';
        const blob = await fetch(`data:${mimeType};base64,${base64Data}`).then(r => r.blob());
        const filePath = `${payload.jobId}/${payload.id}.jpg`;

        const { error } = await supabase.storage
            .from('job-photos')
            .upload(filePath, blob, { contentType: mimeType, upsert: true });

        return !error;
    } catch (e) {
        return false;
    }
}
