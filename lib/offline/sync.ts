import { getDatabase, LocalJob } from './db';
import { getSupabase, isSupabaseAvailable } from '../supabase';
import { Photo } from '../../types';
import { requestCache, generateCacheKey } from '../performanceUtils';
import { sealEvidence } from '../sealing';
import { showPersistentNotification } from '../utils/syncUtils';

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
 * Detailed sync conflict for UI presentation and resolution
 */
export interface SyncConflict {
    jobId: string;
    local: LocalJob;
    remote: LocalJob;
    conflictFields: string[]; // e.g., ['status', 'technician', 'photos']
    detectedAt: string; // ISO timestamp
    resolved: boolean;
    resolution: 'local' | 'remote' | 'manual' | null;
}

/**
 * Fix 3.3: Detect conflicts between local and remote job versions
 * Compares all relevant fields and returns conflict info if differences found
 */
export function detectConflicts(localJob: LocalJob, remoteJob: LocalJob): SyncConflict | null {
    const conflicts: string[] = [];

    // Compare status
    if (localJob.status !== remoteJob.status) {
        conflicts.push('status');
    }

    // Compare technician assignment (check both techId and technicianId)
    const localTechId = localJob.technicianId || localJob.techId;
    const remoteTechId = remoteJob.technicianId || remoteJob.techId;
    if (localTechId !== remoteTechId) {
        conflicts.push('technician');
    }

    // Compare signature
    if (localJob.signature !== remoteJob.signature) {
        conflicts.push('signature');
    }

    // Compare photo count (different counts indicate conflict)
    const localPhotoCount = localJob.photos?.length || 0;
    const remotePhotoCount = remoteJob.photos?.length || 0;
    if (localPhotoCount !== remotePhotoCount) {
        conflicts.push('photos');
    }

    // Compare notes/description
    if ((localJob.notes || '') !== (remoteJob.notes || '')) {
        conflicts.push('notes');
    }

    // Compare sealed status
    if ((localJob.sealedAt || null) !== (remoteJob.sealedAt || null)) {
        conflicts.push('sealed');
    }

    // No conflicts if all fields match
    if (conflicts.length === 0) {
        return null;
    }

    // Return detailed conflict info
    return {
        jobId: localJob.id,
        local: localJob,
        remote: remoteJob,
        conflictFields: conflicts,
        detectedAt: new Date().toISOString(),
        resolved: false,
        resolution: null,
    };
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

            const database = await getDatabase();
            for (const serverJob of serverJobs) {
                const localJob = await database.jobs.get(serverJob.id);

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

            // ORPHANED RECORDS DETECTION: Remove jobs deleted on server
            // Compare local vs server job IDs and delete orphaned records
            const allLocalJobs = await database.jobs.where('workspaceId').equals(workspaceId).toArray();
            const serverJobIds = new Set(serverJobs.map(j => j.id));
            const orphanedJobs = allLocalJobs.filter(job => !serverJobIds.has(job.id));

            // Delete orphaned jobs (except sealed ones - they're immutable)
            const deletedOrphanIds: string[] = [];
            for (const orphanedJob of orphanedJobs) {
                // CRITICAL: Preserve sealed jobs - they represent immutable evidence
                if (orphanedJob.sealedAt || orphanedJob.isSealed) {
                    console.log(`[Sync] PRESERVED sealed job ${orphanedJob.id} (immutable evidence)`);
                    continue;
                }

                // Safe to delete: not sealed
                await database.jobs.delete(orphanedJob.id);
                deletedOrphanIds.push(orphanedJob.id);
                console.log(`[Sync] Deleted orphaned job ${orphanedJob.id} (${orphanedJob.title})`);
            }

            if (deletedOrphanIds.length > 0) {
                console.log(`[Sync] Deleted ${deletedOrphanIds.length} orphaned jobs from IndexedDB:`, deletedOrphanIds);
            }

            // Apply updates
            if (jobsToUpdate.length > 0) {
                await database.jobs.bulkPut(jobsToUpdate);
            }

            // Store conflicts and notify user (Sprint 1 Task 1.4)
            if (conflicts.length > 0) {
                // Enrich conflicts with timestamp for history
                const enrichedConflicts = conflicts.map(c => ({
                    ...c,
                    resolvedAt: Date.now(),
                    jobTitle: serverJobs.find(j => j.id === c.jobId)?.title || 'Unknown Job'
                }));

                // Store in conflict history (last 50)
                const existingConflicts = JSON.parse(localStorage.getItem('jobproof_sync_conflicts') || '[]');
                const allConflicts = [...existingConflicts, ...enrichedConflicts].slice(-50);
                localStorage.setItem('jobproof_sync_conflicts', JSON.stringify(allConflicts));

                // Count by resolution type for user notification
                const serverWins = conflicts.filter(c => c.resolution === 'server_accepted').length;
                const localPreserved = conflicts.filter(c => c.resolution === 'local_preserved').length;
                const merged = conflicts.filter(c => c.resolution === 'merged').length;

                // Build user-friendly message
                const messages: string[] = [];
                if (serverWins > 0) {
                    messages.push(`${serverWins} job(s) updated from cloud (sealed/newer)`);
                }
                if (localPreserved > 0) {
                    messages.push(`${localPreserved} local change(s) preserved`);
                }
                if (merged > 0) {
                    messages.push(`${merged} job(s) merged`);
                }

                // Show notification to user
                showPersistentNotification({
                    type: serverWins > 0 ? 'warning' : 'info',
                    title: 'Sync Conflicts Resolved',
                    message: `${conflicts.length} conflict(s) detected during sync. ${messages.join('. ')}.`,
                    persistent: false,  // Auto-dismiss after 10s
                    actionLabel: 'View History',
                    onAction: () => {
                        console.log('[Conflict History] User requested conflict history:', allConflicts);
                        // Future: Navigate to conflict history UI
                    }
                });
            }

            const deletedCount = deletedOrphanIds?.length || 0;
            console.log(`[Sync] Pulled ${serverJobs.length} jobs, updated ${jobsToUpdate.length}, deleted ${deletedCount} orphaned, conflicts: ${conflicts.length}`);
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
    const database = await getDatabase();
    const pending = await database.queue.where('synced').equals(0).toArray();
    if (pending.length === 0) return;

    console.log(`[Sync] Processing ${pending.length} offline actions...`);

    for (const action of pending) {
        try {
            let success = false;
            switch (action.type) {
                case 'CREATE_JOB':
                    success = await processCreateJob(action.payload);
                    break;
                case 'UPDATE_JOB':
                    success = await processUpdateJob(action.payload);
                    break;
                case 'UPLOAD_PHOTO':
                    success = await processUploadPhoto(action.payload);
                    break;
                case 'CREATE_CLIENT':
                    success = await processCreateClient(action.payload);
                    break;
                case 'UPDATE_CLIENT':
                    success = await processUpdateClient(action.payload);
                    break;
                case 'CREATE_TECHNICIAN':
                    success = await processCreateTechnician(action.payload);
                    break;
                case 'UPDATE_TECHNICIAN':
                    success = await processUpdateTechnician(action.payload);
                    break;
            }

            if (success) {
                await database.queue.update(action.id!, { synced: true });
                // Optional: delete from queue after success
                await database.queue.delete(action.id!);
            } else {
                await database.queue.update(action.id!, { retryCount: action.retryCount + 1 });
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

/**
 * Process CREATE_JOB: Insert a locally-created job into Supabase
 */
async function processCreateJob(job: any) {
    const supabase = getSupabase();
    if (!supabase || !job.id) return false;

    const { error } = await supabase
        .from('jobs')
        .upsert({
            id: job.id,
            title: job.title || '',
            description: job.description || '',
            status: job.status || 'Draft',
            client_id: job.clientId || null,
            technician_id: job.technicianId || job.techId || null,
            workspace_id: job.workspaceId || job.workspace_id || null,
            location: job.location || null,
            scheduled_date: job.scheduledDate || null,
            photos: job.photos || [],
            notes: job.notes || null,
            safety_checklist: job.safetyChecklist || [],
            created_at: job.createdAt || new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

    if (error) {
        console.error('[Sync] CREATE_JOB failed:', error.message);
        return false;
    }
    return true;
}

/**
 * Process CREATE_CLIENT: Insert a locally-created client into Supabase
 */
async function processCreateClient(client: any) {
    const supabase = getSupabase();
    if (!supabase || !client.id) return false;

    const { error } = await supabase
        .from('clients')
        .upsert({
            id: client.id,
            name: client.name || '',
            email: client.email || null,
            phone: client.phone || null,
            address: client.address || null,
            type: client.type || null,
            notes: client.notes || null,
            workspace_id: client.workspaceId || client.workspace_id || null,
            created_at: client.createdAt || new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

    if (error) {
        console.error('[Sync] CREATE_CLIENT failed:', error.message);
        return false;
    }
    return true;
}

/**
 * Process UPDATE_CLIENT: Update an existing client in Supabase
 */
async function processUpdateClient(client: any) {
    const supabase = getSupabase();
    if (!supabase || !client.id) return false;

    const updateData: any = { updated_at: new Date().toISOString() };
    if (client.name) updateData.name = client.name;
    if (client.email !== undefined) updateData.email = client.email;
    if (client.phone !== undefined) updateData.phone = client.phone;
    if (client.address !== undefined) updateData.address = client.address;
    if (client.type !== undefined) updateData.type = client.type;
    if (client.notes !== undefined) updateData.notes = client.notes;

    const { error } = await supabase
        .from('clients')
        .update(updateData)
        .eq('id', client.id);

    if (error) {
        console.error('[Sync] UPDATE_CLIENT failed:', error.message);
        return false;
    }
    return true;
}

/**
 * Process CREATE_TECHNICIAN: Insert a locally-created technician into Supabase
 */
async function processCreateTechnician(tech: any) {
    const supabase = getSupabase();
    if (!supabase || !tech.id) return false;

    const { error } = await supabase
        .from('technicians')
        .upsert({
            id: tech.id,
            name: tech.name || '',
            email: tech.email || null,
            phone: tech.phone || null,
            status: tech.status || 'Available',
            specialty: tech.specialty || null,
            workspace_id: tech.workspaceId || tech.workspace_id || null,
            created_at: tech.createdAt || new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

    if (error) {
        console.error('[Sync] CREATE_TECHNICIAN failed:', error.message);
        return false;
    }
    return true;
}

/**
 * Process UPDATE_TECHNICIAN: Update an existing technician in Supabase
 */
async function processUpdateTechnician(tech: any) {
    const supabase = getSupabase();
    if (!supabase || !tech.id) return false;

    const updateData: any = { updated_at: new Date().toISOString() };
    if (tech.name) updateData.name = tech.name;
    if (tech.email !== undefined) updateData.email = tech.email;
    if (tech.phone !== undefined) updateData.phone = tech.phone;
    if (tech.status) updateData.status = tech.status;
    if (tech.specialty !== undefined) updateData.specialty = tech.specialty;

    const { error } = await supabase
        .from('technicians')
        .update(updateData)
        .eq('id', tech.id);

    if (error) {
        console.error('[Sync] UPDATE_TECHNICIAN failed:', error.message);
        return false;
    }
    return true;
}

async function processUploadPhoto(payload: { id: string; jobId: string; dataUrl?: string }) {
    const supabase = getSupabase();
    if (!supabase) return false;

    const database = await getDatabase();

    // Get data from IndexedDB if not in payload
    let dataUrl = payload.dataUrl;
    if (!dataUrl) {
        const record = await database.media.get(payload.id);
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
        const job = await database.jobs.get(payload.jobId);
        if (job && job.photos) {
            const updatedPhotos = job.photos.map(p =>
                p.url === payload.id || p.id === payload.id
                    ? { ...p, url: publicUrl, isIndexedDBRef: false, syncStatus: 'synced' as const }
                    : p
            );

            // Update job in IndexedDB
            await database.jobs.update(payload.jobId, {
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
        await database.media.delete(payload.id);
        console.log(`[Sync] Cleaned up IndexedDB media: ${payload.id}`);

        // AUTO-SEAL: Check if all photos are synced and job should be sealed
        const updatedJob = await database.jobs.get(payload.jobId);
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
                        await database.jobs.update(payload.jobId, {
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
