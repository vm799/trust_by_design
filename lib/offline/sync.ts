import { db, LocalJob } from './db';
import { getSupabase, isSupabaseAvailable } from '../supabase';
import { Photo } from '../../types';
import { requestCache, generateCacheKey } from '../performanceUtils';
import { sealEvidence } from '../sealing';

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
 * Conflict resolution result for tracking
 */
export interface ConflictResult {
    jobId: string;
    resolution: 'local_preserved' | 'server_accepted' | 'merged';
    localTimestamp: number;
    serverTimestamp: number;
}

/**
 * Internal implementation of pullJobs with conflict resolution
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
            const serverJobs: LocalJob[] = data.map(row => ({
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
                photos: row.photos || [],
                signature: row.signature_url,
                safetyChecklist: row.safety_checklist || [],
                siteHazards: row.site_hazards || [],
                templateId: row.template_id,
                price: row.price,
                syncStatus: 'synced' as const,
                lastUpdated: new Date(row.updated_at).getTime(),
                workspaceId: row.workspace_id,
                sealedAt: row.sealed_at,
                isSealed: !!row.sealed_at,
                evidenceHash: row.evidence_hash
            }));

            // CONFLICT RESOLUTION: Compare local vs server for each job
            const conflicts: ConflictResult[] = [];
            const jobsToUpdate: LocalJob[] = [];

            for (const serverJob of serverJobs) {
                const localJob = await db.jobs.get(serverJob.id);

                if (!localJob) {
                    // No local job - accept server version
                    jobsToUpdate.push(serverJob);
                    continue;
                }

                const localHasPendingChanges = localJob.syncStatus === 'pending';
                const localIsNewer = localJob.lastUpdated > serverJob.lastUpdated;
                const serverIsSealed = serverJob.isSealed || serverJob.sealedAt;

                // RULE 1: Sealed jobs ALWAYS win (immutable evidence)
                if (serverIsSealed) {
                    jobsToUpdate.push(serverJob);
                    if (localHasPendingChanges && localIsNewer) {
                        conflicts.push({
                            jobId: serverJob.id,
                            resolution: 'server_accepted',
                            localTimestamp: localJob.lastUpdated,
                            serverTimestamp: serverJob.lastUpdated
                        });
                        console.warn(`[Sync] Conflict: Job ${serverJob.id} was sealed on server. Local changes discarded.`);
                    }
                    continue;
                }

                // RULE 2: Local pending changes + local is newer = preserve local
                if (localHasPendingChanges && localIsNewer) {
                    // DON'T overwrite local - it has pending changes that are newer
                    conflicts.push({
                        jobId: serverJob.id,
                        resolution: 'local_preserved',
                        localTimestamp: localJob.lastUpdated,
                        serverTimestamp: serverJob.lastUpdated
                    });
                    console.log(`[Sync] Preserved local job ${serverJob.id} (local: ${new Date(localJob.lastUpdated).toISOString()}, server: ${new Date(serverJob.lastUpdated).toISOString()})`);
                    continue;
                }

                // RULE 3: Server is newer OR local has no pending changes = accept server
                if (!localHasPendingChanges || !localIsNewer) {
                    // Merge: Preserve local photos that aren't on server yet
                    const mergedJob = mergeJobData(localJob, serverJob);
                    jobsToUpdate.push(mergedJob);

                    if (localHasPendingChanges) {
                        conflicts.push({
                            jobId: serverJob.id,
                            resolution: 'merged',
                            localTimestamp: localJob.lastUpdated,
                            serverTimestamp: serverJob.lastUpdated
                        });
                    }
                    continue;
                }

                // Default: accept server
                jobsToUpdate.push(serverJob);
            }

            // Apply updates
            if (jobsToUpdate.length > 0) {
                await db.jobs.bulkPut(jobsToUpdate);
            }

            // Store conflicts for UI notification
            if (conflicts.length > 0) {
                const existingConflicts = JSON.parse(localStorage.getItem('jobproof_sync_conflicts') || '[]');
                const allConflicts = [...existingConflicts, ...conflicts].slice(-50); // Keep last 50
                localStorage.setItem('jobproof_sync_conflicts', JSON.stringify(allConflicts));
            }

            console.log(`[Sync] Pulled ${serverJobs.length} jobs, updated ${jobsToUpdate.length}, conflicts: ${conflicts.length}`);
        }
    } catch (error) {
        console.error('[Sync] Pull failed:', error);
    }
}

/**
 * Merge local and server job data intelligently
 * - Preserves local photos not yet synced
 * - Uses server data for everything else
 */
function mergeJobData(local: LocalJob, server: LocalJob): LocalJob {
    // Start with server data
    const merged = { ...server };

    // Preserve local photos that haven't synced yet
    if (local.photos && local.photos.length > 0) {
        const localUnsyncedPhotos = local.photos.filter(
            (p: Photo) => p.syncStatus === 'pending' || p.isIndexedDBRef
        );

        if (localUnsyncedPhotos.length > 0) {
            // Combine server photos with local unsynced photos
            const serverPhotoIds = new Set((server.photos || []).map((p: Photo) => p.id));
            const photosToAdd = localUnsyncedPhotos.filter((p: Photo) => !serverPhotoIds.has(p.id));

            merged.photos = [...(server.photos || []), ...photosToAdd];
            merged.syncStatus = 'pending'; // Mark as needing sync due to merged photos
        }
    }

    // Preserve local signature if server doesn't have one and local does
    if (!server.signature && local.signature) {
        merged.signature = local.signature;
        merged.signatureHash = local.signatureHash;
        merged.signerName = local.signerName;
        merged.signerRole = local.signerRole;
        merged.syncStatus = 'pending';
    }

    return merged;
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

        // AUTO-SEAL: Check if all photos are synced and job should be sealed
        const updatedJob = await db.jobs.get(payload.jobId);
        if (updatedJob) {
            const allPhotosUploaded = updatedJob.photos.every(
                (p: Photo) => p.syncStatus === 'synced' && !p.isIndexedDBRef
            );

            console.log(`[Auto-Seal] Job ${payload.jobId} status check:`, {
                allPhotosUploaded,
                jobStatus: updatedJob.status,
                isSealed: !!updatedJob.sealedAt,
                photoCount: updatedJob.photos.length
            });

            if (allPhotosUploaded &&
                updatedJob.status === 'Submitted' &&
                !updatedJob.sealedAt) {
                console.log(`[Auto-Seal] All photos synced for submitted job - auto-sealing job ${payload.jobId}...`);

                try {
                    const sealResult = await sealEvidence(payload.jobId);

                    if (sealResult.success) {
                        console.log(`[Auto-Seal] Successfully sealed job ${payload.jobId}`, {
                            sealedAt: sealResult.sealedAt,
                            evidenceHash: sealResult.evidenceHash
                        });

                        // Update local job with seal data
                        await db.jobs.update(payload.jobId, {
                            sealedAt: sealResult.sealedAt,
                            evidenceHash: sealResult.evidenceHash,
                            status: 'Archived' as const,
                            isSealed: true,
                            lastUpdated: Date.now()
                        });

                        console.log(`[Auto-Seal] Job ${payload.jobId} updated locally with seal data`);
                    } else {
                        console.error(`[Auto-Seal] Failed to seal job ${payload.jobId}:`, sealResult.error);
                        // Don't fail the photo upload if sealing fails - can retry later
                    }
                } catch (error) {
                    console.error(`[Auto-Seal] Exception during auto-seal for job ${payload.jobId}:`, error);
                    // Don't fail the photo upload if sealing fails - can retry later
                }
            }
        }

        return true;
    } catch (e) {
        console.error(`[Sync] Exception in processUploadPhoto:`, e);
        return false;
    }
}
