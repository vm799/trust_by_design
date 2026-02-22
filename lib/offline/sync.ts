import { getDatabase, queueAction, LocalJob, getAllOrphanPhotos, getMediaLocal, deleteOrphanPhoto, incrementOrphanRecoveryAttempts, saveClientsBatch, saveTechniciansBatch } from './db';
import { getSupabase, isSupabaseAvailable } from '../supabase';
import { appendToFailedSyncQueue, isPermanentError } from '../syncQueue';
import { Photo } from '../../types';
import { requestCache, generateCacheKey } from '../performanceUtils';
import { sealEvidence } from '../sealing';
import { showPersistentNotification } from '../utils/syncUtils';

// ============================================================================
// INCREMENTAL SYNC: lastSyncAt tracking per workspace
// Stores the timestamp of the last successful pull so subsequent pulls
// only fetch records modified since then. Reduces bandwidth dramatically
// on large workspaces (1000+ jobs).
// ============================================================================

const LAST_SYNC_AT_PREFIX = 'jobproof_last_sync_at_';

/**
 * Get the timestamp of the last successful pull for a workspace.
 * Returns null if no prior sync (triggers a full pull).
 */
export function getLastSyncAt(workspaceId: string): string | null {
    try {
        return localStorage.getItem(`${LAST_SYNC_AT_PREFIX}${workspaceId}`);
    } catch {
        return null;
    }
}

/**
 * Store the timestamp of the last successful pull for a workspace.
 * Called after a successful sync to enable incremental pulls next time.
 */
export function setLastSyncAt(workspaceId: string, timestamp: string): void {
    try {
        localStorage.setItem(`${LAST_SYNC_AT_PREFIX}${workspaceId}`, timestamp);
    } catch {
        // localStorage quota or unavailable — non-critical
    }
}

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
 * Internal implementation of pullJobs with conflict resolution.
 *
 * INCREMENTAL SYNC: Uses lastSyncAt to only fetch records modified since
 * the last successful pull. Falls back to full pull on first load or when
 * lastSyncAt is missing. Orphan detection only runs on full pulls since
 * incremental pulls don't return the complete server dataset.
 */
async function _pullJobsImpl(workspaceId: string) {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
        // Determine if this is a full or incremental pull
        const lastSyncAt = getLastSyncAt(workspaceId);
        const isFullPull = !lastSyncAt;

        // Build query — incremental pulls only fetch changed records
        let query = supabase
            .from('jobs')
            .select('*')
            .eq('workspace_id', workspaceId);

        if (!isFullPull) {
            query = query.gt('updated_at', lastSyncAt);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Record pull timestamp (server time approximation: use now)
        const pullTimestamp = new Date().toISOString();

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

            // ORPHANED RECORDS DETECTION: Only on fullPull
            // Incremental pulls only return changed records, not the complete set.
            // Comparing against an incomplete set would incorrectly delete jobs
            // that simply weren't modified. Orphan detection requires the full
            // server dataset to safely identify locally-cached jobs that were
            // deleted on the server.
            if (isFullPull) {
                const allLocalJobs = await database.jobs.where('workspaceId').equals(workspaceId).toArray();
                const serverJobIds = new Set(serverJobs.map(j => j.id));
                const orphanedJobs = allLocalJobs.filter(job => !serverJobIds.has(job.id));

                for (const orphanedJob of orphanedJobs) {
                    // CRITICAL: Preserve sealed jobs - they represent immutable evidence
                    if (orphanedJob.sealedAt || orphanedJob.isSealed) {
                        continue;
                    }

                    // Safe to delete: not sealed
                    await database.jobs.delete(orphanedJob.id);
                }
            }

            // Apply updates
            if (jobsToUpdate.length > 0) {
                await database.jobs.bulkPut(jobsToUpdate);
            }

            // Persist lastSyncAt on successful pull
            setLastSyncAt(workspaceId, pullTimestamp);

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
                        // Future: Navigate to conflict history UI
                    }
                });
            }

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
 * Max retries for Dexie queue items before escalation.
 * After this many failures, items are promoted to the localStorage
 * failed sync queue where the OfflineIndicator shows them to the user.
 *
 * Without this cap, failed items retry forever with no user visibility.
 */
const DEXIE_QUEUE_MAX_RETRIES = 10;

/**
 * Internal implementation of pushQueue
 *
 * FAILSAFE FIX: Items that exceed DEXIE_QUEUE_MAX_RETRIES are escalated
 * to jobproof_failed_sync_queue (localStorage) so the OfflineIndicator
 * banner shows them and the user can manually retry. Previously, failed
 * items just incremented retryCount forever with no cap and no visibility.
 */
async function _pushQueueImpl() {
    const database = await getDatabase();
    const pending = await database.queue.where('synced').equals(0).toArray();
    if (pending.length === 0) return;


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
                case 'SEAL_JOB':
                    success = await processSealJob(action.payload);
                    break;
                case 'DELETE_JOB':
                    success = await processDeleteJob(action.payload);
                    break;
                case 'DELETE_CLIENT':
                    success = await processDeleteClient(action.payload);
                    break;
                case 'DELETE_TECHNICIAN':
                    success = await processDeleteTechnician(action.payload);
                    break;
            }

            if (success) {
                await database.queue.update(action.id!, { synced: true });
                await database.queue.delete(action.id!);
            } else {
                const newRetryCount = (action.retryCount || 0) + 1;

                if (newRetryCount >= DEXIE_QUEUE_MAX_RETRIES) {
                    // Escalate to failed sync queue for user visibility
                    // Map Dexie action type to sync queue item type
                    const itemType = action.type.includes('JOB') || action.type === 'SEAL_JOB' || action.type === 'UPLOAD_PHOTO'
                        ? 'job'
                        : action.type.includes('CLIENT')
                            ? 'client'
                            : action.type.includes('TECHNICIAN')
                                ? 'technician'
                                : 'job';

                    // TOCTOU FIX: Use atomic append instead of inline read→modify→write
                    appendToFailedSyncQueue({
                        id: action.payload?.id || `dexie-${action.id}`,
                        type: itemType,
                        actionType: action.type,
                        data: action.payload,
                        retryCount: newRetryCount,
                        lastAttempt: Date.now(),
                        failedAt: new Date().toISOString(),
                        reason: `Dexie queue: ${action.type} failed after ${DEXIE_QUEUE_MAX_RETRIES} retries`
                    });

                    // Remove from Dexie queue (it's now in the failed sync queue)
                    await database.queue.delete(action.id!);
                    console.error(`[Sync] ${action.type} ${action.id} escalated to failed sync queue after ${DEXIE_QUEUE_MAX_RETRIES} retries`);

                    showPersistentNotification({
                        type: 'error',
                        title: 'Sync Failed',
                        message: `A ${itemType} failed to sync after multiple attempts. Check the sync status banner.`,
                        persistent: true
                    });
                } else {
                    await database.queue.update(action.id!, { retryCount: newRetryCount });
                }
            }
        } catch (error) {
            console.error(`[Sync] Action ${action.id} failed:`, error);

            // PERMANENT ERROR CHECK: Classify caught exceptions same as
            // retryFailedSyncs does for the localStorage queue. Without this,
            // permanent errors (401/403/RLS) waste all 10 retries.
            if (isPermanentError(error)) {
                const itemType = action.type.includes('JOB') || action.type === 'SEAL_JOB' || action.type === 'UPLOAD_PHOTO'
                    ? 'job'
                    : action.type.includes('CLIENT')
                        ? 'client'
                        : action.type.includes('TECHNICIAN')
                            ? 'technician'
                            : 'job';

                appendToFailedSyncQueue({
                    id: action.payload?.id || `dexie-${action.id}`,
                    type: itemType,
                    actionType: action.type,
                    data: action.payload,
                    retryCount: action.retryCount || 0,
                    lastAttempt: Date.now(),
                    failedAt: new Date().toISOString(),
                    reason: `Permanent error in Dexie queue: ${error instanceof Error ? error.message : String(error)}`
                });

                await database.queue.delete(action.id!);
                console.error(`[Sync] ${action.type} ${action.id} permanent error — escalated immediately`);
            }
        }
    }
}

async function processUpdateJob(job: Partial<LocalJob>) {
    const supabase = getSupabase();
    if (!supabase || !job.id) return false;

    // Map to bunker_jobs column names
    const updateData: any = {
        last_updated: new Date().toISOString()
    };
    if (job.status) updateData.status = job.status;
    if (job.notes) updateData.notes = job.notes;
    if (job.w3w) updateData.w3w = job.w3w;
    if (job.title) updateData.title = job.title;
    if (job.client) updateData.client = job.client;
    if (job.clientId) updateData.client_id = job.clientId;
    if (job.technician) updateData.technician_name = job.technician;
    if (job.techId || job.technicianId) updateData.assigned_technician_id = job.techId || job.technicianId;
    if (job.address) updateData.address = job.address;
    if (job.signerName) updateData.signer_name = job.signerName;
    if (job.completedAt) updateData.completed_at = job.completedAt;

    const { error } = await supabase
        .from('bunker_jobs')
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
        .from('bunker_jobs')
        .upsert({
            id: job.id,
            title: job.title || '',
            client: job.client || '',
            client_id: job.clientId || null,
            assigned_technician_id: job.technicianId || job.techId || null,
            technician_name: job.technician || '',
            workspace_id: job.workspaceId || job.workspace_id || null,
            status: job.status || 'Draft',
            address: job.address || null,
            w3w: job.w3w || null,
            notes: job.notes || null,
            completed_at: job.completedAt || null,
            created_at: job.createdAt || new Date().toISOString(),
            last_updated: new Date().toISOString(),
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

// ============================================================================
// OFFLINE DELETE: Process queued deletions when back online
// Queued by DataContext when user deletes while offline.
// ============================================================================

/**
 * Process DELETE_JOB: Delete a job from Supabase.
 * Respects sealed/invoiced guards — server RLS may also reject.
 */
async function processDeleteJob(payload: { id: string }): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase || !payload.id) return false;

    // Delete from both tables — job may exist in either or both
    const { error: bunkerError } = await supabase
        .from('bunker_jobs')
        .delete()
        .eq('id', payload.id);

    const { error: jobsError } = await supabase
        .from('jobs')
        .delete()
        .eq('id', payload.id);

    // Fail only if BOTH tables returned errors
    if (bunkerError && jobsError) {
        console.error('[Sync] DELETE_JOB failed:', bunkerError.message || jobsError.message);
        return false;
    }
    return true;
}

/**
 * Process DELETE_CLIENT: Delete a client from Supabase.
 */
async function processDeleteClient(payload: { id: string }): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase || !payload.id) return false;

    const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', payload.id);

    if (error) {
        console.error('[Sync] DELETE_CLIENT failed:', error.message);
        return false;
    }
    return true;
}

/**
 * Process DELETE_TECHNICIAN: Delete a technician from Supabase.
 */
async function processDeleteTechnician(payload: { id: string }): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase || !payload.id) return false;

    const { error } = await supabase
        .from('technicians')
        .delete()
        .eq('id', payload.id);

    if (error) {
        console.error('[Sync] DELETE_TECHNICIAN failed:', error.message);
        return false;
    }
    return true;
}

/**
 * Process SEAL_JOB: Retry evidence sealing for a job whose photos are all synced.
 * Queued by processUploadPhoto when auto-seal fails after last photo upload.
 * Without this, jobs stay "Submitted" forever with no path to "Sealed".
 */
async function processSealJob(payload: { jobId: string }): Promise<boolean> {
    if (!payload.jobId) return false;

    const database = await getDatabase();
    const job = await database.jobs.get(payload.jobId);

    if (!job) return false;
    if (job.sealedAt || job.isSealed) return true; // Already sealed

    // Verify all photos are synced before sealing
    const allPhotosReady = !job.photos || job.photos.every(
        (p: Photo) => p.syncStatus === 'synced' && !p.isIndexedDBRef
    );
    if (!allPhotosReady) return false;

    try {
        const sealResult = await sealEvidence(payload.jobId);
        if (sealResult.success) {
            await database.jobs.update(payload.jobId, {
                sealedAt: sealResult.sealedAt,
                evidenceHash: sealResult.evidenceHash,
                status: 'Archived' as const,
                isSealed: true,
                lastUpdated: Date.now()
            });

            showPersistentNotification({
                type: 'success',
                title: 'Evidence Sealed',
                message: `Job "${job.title || payload.jobId}" has been sealed with tamper-proof hash.`,
                persistent: false
            });
            return true;
        }
        return false;
    } catch (error) {
        console.error(`[Sync] SEAL_JOB failed for ${payload.jobId}:`, error);
        return false;
    }
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

        // AUTO-SEAL: Check if all photos are synced and job should be sealed
        const updatedJob = await database.jobs.get(payload.jobId);
        if (updatedJob) {
            const allPhotosUploaded = updatedJob.photos.every(
                (p: Photo) => p.syncStatus === 'synced' && !p.isIndexedDBRef
            );

            if (allPhotosUploaded &&
                updatedJob.status === 'Submitted' &&
                !updatedJob.sealedAt) {

                try {
                    const sealResult = await sealEvidence(payload.jobId);

                    if (sealResult.success) {
                        await database.jobs.update(payload.jobId, {
                            sealedAt: sealResult.sealedAt,
                            evidenceHash: sealResult.evidenceHash,
                            status: 'Archived' as const,
                            isSealed: true,
                            lastUpdated: Date.now()
                        });
                    } else {
                        console.error(`[Auto-Seal] Failed to seal job ${payload.jobId}:`, sealResult.error);
                        // Queue seal retry so pushQueue() will re-attempt
                        await queueAction('SEAL_JOB', { jobId: payload.jobId });
                    }
                } catch (error) {
                    console.error(`[Auto-Seal] Exception during auto-seal for job ${payload.jobId}:`, error);
                    // Queue seal retry so pushQueue() will re-attempt
                    try {
                        await queueAction('SEAL_JOB', { jobId: payload.jobId });
                    } catch (dexieErr) {
                        // P2 FIX: If Dexie is corrupted, escalate to localStorage
                        // failed queue so OfflineIndicator makes it visible.
                        // Previously this was a silent loss — seal action gone forever.
                        console.error('[Auto-Seal] Dexie queue failed, escalating to failed sync queue:', dexieErr);
                        appendToFailedSyncQueue({
                            id: payload.jobId,
                            type: 'job',
                            actionType: 'SEAL_JOB',
                            data: { jobId: payload.jobId },
                            retryCount: 0,
                            lastAttempt: Date.now(),
                            failedAt: new Date().toISOString(),
                            reason: 'SEAL_JOB: Dexie queue unavailable, escalated to failed sync queue'
                        });
                    }
                }
            }
        }

        return true;
    } catch (e) {
        console.error(`[Sync] Exception in processUploadPhoto:`, e);
        return false;
    }
}

// ============================================================================
// P2-1: ORPHAN PHOTO RETRY
// Orphan photos are created when upload fails (network timeout or IndexedDB data lost).
// This function retries uploading orphans where local media still exists in IndexedDB.
// ============================================================================

const MAX_ORPHAN_RECOVERY_ATTEMPTS = 5;

/**
 * Retry uploading orphan photos that still have local media data.
 * Called during each sync cycle alongside pushQueue/pullJobs.
 */
export async function retryOrphanPhotos() {
    if (!navigator.onLine || !isSupabaseAvailable()) return;
    const supabase = getSupabase();
    if (!supabase) return;

    const cacheKey = generateCacheKey('retryOrphanPhotos');
    return requestCache.dedupe(cacheKey, async () => {
        return _retryOrphanPhotosImpl();
    }, 5000);
}

async function _retryOrphanPhotosImpl() {
    const supabase = getSupabase();
    if (!supabase) return;

    const orphans = await getAllOrphanPhotos();
    if (orphans.length === 0) return;

    let recovered = 0;
    let failed = 0;

    for (const orphan of orphans) {
        if (orphan.recoveryAttempts >= MAX_ORPHAN_RECOVERY_ATTEMPTS) {
            // ESCALATION FIX: Orphan exceeded max retries — escalate metadata
            // to failed sync queue so OfflineIndicator makes it visible and
            // admins know which photos need re-capture. Previously this was
            // a silent `continue` — metadata stuck in IndexedDB forever with
            // no cloud backup. If device dies, evidence metadata is lost.
            appendToFailedSyncQueue({
                id: orphan.id,
                type: 'job',
                actionType: 'ORPHAN_PHOTO',
                data: {
                    photoId: orphan.id,
                    jobId: orphan.jobId,
                    jobTitle: orphan.jobTitle,
                    photoType: orphan.type,
                    timestamp: orphan.timestamp,
                    lat: orphan.lat,
                    lng: orphan.lng,
                    w3w: orphan.w3w,
                    reason: orphan.reason,
                    orphanedAt: orphan.orphanedAt,
                },
                retryCount: orphan.recoveryAttempts,
                lastAttempt: Date.now(),
                failedAt: new Date().toISOString(),
                reason: `Orphan photo: ${orphan.reason || 'binary lost'} after ${MAX_ORPHAN_RECOVERY_ATTEMPTS} recovery attempts`,
            });
            // Remove from orphan table to prevent re-escalation on next cycle
            await deleteOrphanPhoto(orphan.id);
            failed++;
            continue;
        }

        try {
            await incrementOrphanRecoveryAttempts(orphan.id);

            // Check if local media data still exists in IndexedDB
            const dataUrl = await getMediaLocal(orphan.id);
            if (!dataUrl) {
                // Binary data is gone — cannot recover this cycle
                // Will be escalated once recoveryAttempts reaches max
                failed++;
                continue;
            }

            // Attempt upload to Supabase Storage
            const base64Data = dataUrl.split(',')[1];
            const mimeType = dataUrl.match(/data:([^;]+);/)?.[1] || 'image/jpeg';
            const blob = await fetch(`data:${mimeType};base64,${base64Data}`).then(r => r.blob());
            const filePath = `${orphan.jobId}/${orphan.id}.jpg`;

            const { error: uploadError } = await supabase.storage
                .from('job-photos')
                .upload(filePath, blob, { contentType: mimeType, upsert: true });

            if (uploadError) {
                failed++;
                continue;
            }

            // Upload succeeded — remove from orphan table
            await deleteOrphanPhoto(orphan.id);
            recovered++;

        } catch {
            failed++;
        }
    }

    if (recovered > 0) {
        showPersistentNotification({
            type: 'success',
            title: 'Photos Recovered',
            message: `${recovered} orphan photo(s) successfully uploaded.${failed > 0 ? ` ${failed} still pending.` : ''}`,
            persistent: false,
        });
    }
}

// ============================================================================
// P2-3: PULL SYNC FOR CLIENTS AND TECHNICIANS
// Matches the pullJobs() pattern — fetch from Supabase, update local Dexie cache.
// ============================================================================

/**
 * PULL: Fetch latest clients from Supabase and update local Dexie cache.
 * Uses request deduplication to prevent concurrent duplicate requests.
 */
export async function pullClients(workspaceId: string) {
    if (!navigator.onLine || !isSupabaseAvailable()) return;
    const supabase = getSupabase();
    if (!supabase) return;

    const cacheKey = generateCacheKey('pullClients', workspaceId);
    return requestCache.dedupe(cacheKey, async () => {
        return _pullClientsImpl(workspaceId);
    }, 5000);
}

async function _pullClientsImpl(workspaceId: string) {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
        // INCREMENTAL: Only fetch clients modified since last pull
        const lastSyncAt = getLastSyncAt(`clients_${workspaceId}`);
        let query = supabase
            .from('clients')
            .select('*')
            .eq('workspace_id', workspaceId);

        if (lastSyncAt) {
            query = query.gt('updated_at', lastSyncAt);
        }

        const { data, error } = await query;
        if (error || !data) return;

        const pullTimestamp = new Date().toISOString();

        const localClients = data.map((row: any) => ({
            id: row.id,
            name: row.name || '',
            email: row.email || '',
            phone: row.phone || '',
            address: row.address || '',
            totalJobs: row.total_jobs || 0,
            type: row.type || '',
            notes: row.notes || '',
            workspaceId,
            syncStatus: 'synced' as const,
            lastUpdated: Date.now(),
        }));

        await saveClientsBatch(localClients);
        setLastSyncAt(`clients_${workspaceId}`, pullTimestamp);
    } catch (err) {
        console.error('[Sync] pullClients failed:', err);
    }
}

/**
 * PULL: Fetch latest technicians from Supabase and update local Dexie cache.
 * Uses request deduplication to prevent concurrent duplicate requests.
 */
export async function pullTechnicians(workspaceId: string) {
    if (!navigator.onLine || !isSupabaseAvailable()) return;
    const supabase = getSupabase();
    if (!supabase) return;

    const cacheKey = generateCacheKey('pullTechnicians', workspaceId);
    return requestCache.dedupe(cacheKey, async () => {
        return _pullTechniciansImpl(workspaceId);
    }, 5000);
}

async function _pullTechniciansImpl(workspaceId: string) {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
        // INCREMENTAL: Only fetch technicians modified since last pull
        const lastSyncAt = getLastSyncAt(`technicians_${workspaceId}`);
        let query = supabase
            .from('technicians')
            .select('*')
            .eq('workspace_id', workspaceId);

        if (lastSyncAt) {
            query = query.gt('updated_at', lastSyncAt);
        }

        const { data, error } = await query;
        if (error || !data) return;

        const pullTimestamp = new Date().toISOString();

        const localTechs = data.map((row: any) => ({
            id: row.id,
            name: row.name || '',
            email: row.email || '',
            phone: row.phone || '',
            status: row.status || 'Available',
            rating: row.rating || 0,
            jobsCompleted: row.jobs_completed || 0,
            specialty: row.specialty || '',
            workspaceId,
            syncStatus: 'synced' as const,
            lastUpdated: Date.now(),
        }));

        await saveTechniciansBatch(localTechs);
        setLastSyncAt(`technicians_${workspaceId}`, pullTimestamp);
    } catch (err) {
        console.error('[Sync] pullTechnicians failed:', err);
    }
}
