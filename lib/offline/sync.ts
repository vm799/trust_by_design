import { db, queueAction, LocalJob, OfflineAction } from './db';
import { getSupabase, isSupabaseAvailable } from '../supabase';
import { Job, Photo } from '../../types';
import { requestCache, generateCacheKey } from '../performanceUtils';

/**
 * PULL: Fetch latest jobs from Supabase and update local DB
 * Uses request deduplication to prevent concurrent duplicate requests
 */
export async function pullJobs(workspaceId: string) {
    if (!navigator.onLine || !isSupabaseAvailable()) return;
    const supabase = getSupabase();
    if (!supabase) return;

    // Deduplicate concurrent requests
    const cacheKey = generateCacheKey('pullJobs', workspaceId);
    return requestCache.dedupe(cacheKey, async () => {
        return _pullJobsImpl(workspaceId);
    }, 3000); // Cache for 3 seconds
}

/**
 * Internal implementation of pullJobs
 */
async function _pullJobsImpl(workspaceId: string) {
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
 * Uses request deduplication to prevent concurrent queue processing
 */
export async function pushQueue() {
    if (!navigator.onLine || !isSupabaseAvailable()) return;

    // Deduplicate concurrent pushQueue calls
    const cacheKey = generateCacheKey('pushQueue');
    return requestCache.dedupe(cacheKey, async () => {
        return _pushQueueImpl();
    }, 2000); // Cache for 2 seconds
}

/**
 * Internal implementation of pushQueue
 */
async function _pushQueueImpl() {
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
        if (!record) {
            console.error(`[Sync] Photo data not found in IndexedDB: ${payload.id}`);
            return false; // Media lost?
        }
        dataUrl = record.data;
    }

    // Check if dataUrl is valid
    if (!dataUrl) {
        console.error(`[Sync] Invalid dataUrl for photo: ${payload.id}`);
        return false;
    }

    try {
        const base64Data = dataUrl.split(',')[1];
        const mimeType = dataUrl.match(/data:([^;]+);/)?.[1] || 'image/jpeg';
        const blob = await fetch(`data:${mimeType};base64,${base64Data}`).then(r => r.blob());
        const filePath = `${payload.jobId}/${payload.id}.jpg`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('job-photos')
            .upload(filePath, blob, { contentType: mimeType, upsert: true });

        if (uploadError) {
            console.error(`[Sync] Upload failed for photo ${payload.id}:`, uploadError);
            return false;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('job-photos')
            .getPublicUrl(filePath);

        const publicUrl = urlData.publicUrl;

        if (!publicUrl) {
            console.error(`[Sync] Failed to get public URL for photo ${payload.id}`);
            return false;
        }

        console.log(`[Sync] Photo ${payload.id} uploaded successfully to ${publicUrl}`);

        // Update photo in job (IndexedDB)
        const job = await db.jobs.get(payload.jobId);
        if (job && job.photos) {
            const updatedPhotos = job.photos.map(p =>
                p.url === payload.id || p.id === payload.id
                    ? { ...p, url: publicUrl, isIndexedDBRef: false, syncStatus: 'synced' as const }
                    : p
            );

            // Update job in IndexedDB
            await db.jobs.update(payload.jobId, {
                photos: updatedPhotos,
                syncStatus: 'synced' as const,
                lastUpdated: Date.now()
            });

            console.log(`[Sync] Updated job ${payload.jobId} with public URL for photo ${payload.id}`);

            // Also update in Supabase
            const { error: updateError } = await supabase
                .from('jobs')
                .update({
                    photos: updatedPhotos,
                    updated_at: new Date().toISOString()
                })
                .eq('id', payload.jobId);

            if (updateError) {
                console.warn(`[Sync] Failed to update job in Supabase:`, updateError);
                // Not critical - photo is uploaded and IndexedDB is updated
            }
        }

        // Clean up IndexedDB media record
        await db.media.delete(payload.id);
        console.log(`[Sync] Cleaned up IndexedDB media: ${payload.id}`);

        return true;
    } catch (e) {
        console.error(`[Sync] Exception in processUploadPhoto:`, e);
        return false;
    }
}
