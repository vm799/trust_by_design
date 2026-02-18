/**
 * Sync Queue Manager
 *
 * Handles background synchronization between IndexedDB (offline) and Supabase (cloud).
 * Implements retry logic, exponential backoff, and conflict resolution.
 */

import { Job, Photo } from '../types';
import { getSupabase, uploadPhoto, uploadSignature, isSupabaseAvailable } from './supabase';
import { getMediaLocal as getMedia } from './offline/db';
import { showPersistentNotification } from './utils/syncUtils';
import { SYNC_STATUS } from './constants';
import { saveOrphanPhoto, countOrphanPhotos, type OrphanPhoto } from './offline/db';
import { prepareJobForSync } from './utils/technicianIdNormalization';
import { logConflict, isConflictError, getConflictTypeFromError } from './conflictTelemetry';

interface SyncQueueItem {
  id: string;
  type: 'job' | 'photo' | 'signature';
  data: any;
  retryCount: number;
  lastAttempt: number;
}

// FIELD UX FIX: Reduced retry window with faster early feedback
// Total window: 2s + 4s + 8s + 15s + 30s + 60s + 60s = 179s (~3 minutes)
// Users need feedback within 3 minutes, not 12 minutes
export const RETRY_DELAYS = [2000, 4000, 8000, 15000, 30000, 60000, 60000];
const MAX_RETRIES = 7;

/**
 * Sync a complete job to Supabase
 * Uploads photos, signature, and job metadata
 */
export const syncJobToSupabase = async (job: Job): Promise<boolean> => {
  if (!isSupabaseAvailable()) {
    console.warn('Supabase not configured - skipping sync');
    return false;
  }

  const supabase = getSupabase();
  if (!supabase) return false;

  // Sprint 2 Task 2.6: Normalize technician IDs before sync
  const normalizedJob = prepareJobForSync(job);

  try {
    // 1. Upload photos from IndexedDB to Supabase Storage
    const uploadedPhotos: Photo[] = [];
    const failedPhotos: string[] = [];

    const orphanedPhotos: OrphanPhoto[] = [];

    for (const photo of job.photos) {
      if (photo.isIndexedDBRef) {
        // Get Base64 data from IndexedDB
        const dataUrl = await getMedia(photo.url);
        if (!dataUrl) {
          console.error(`Failed to retrieve photo ${photo.id} from IndexedDB`);
          failedPhotos.push(photo.id);

          // Sprint 1 Task 1.3: Preserve metadata in orphan log instead of silently losing it
          const orphan: OrphanPhoto = {
            id: photo.id,
            jobId: job.id,
            jobTitle: job.title,
            type: photo.type,
            timestamp: photo.timestamp,
            lat: photo.lat,
            lng: photo.lng,
            w3w: photo.w3w,
            reason: 'IndexedDB data lost - binary not found',
            orphanedAt: Date.now(),
            recoveryAttempts: 0
          };
          orphanedPhotos.push(orphan);

          // Save to IndexedDB orphan log
          try {
            await saveOrphanPhoto(orphan);
            console.warn(`📸 Photo ${photo.id} metadata preserved in orphan log`);
          } catch (saveErr) {
            console.error('Failed to save orphan photo metadata:', saveErr);
          }
          continue;
        }

        // Upload to Supabase Storage
        const publicUrl = await uploadPhoto(job.id, photo.id, dataUrl);
        if (!publicUrl) {
          console.error(`Failed to upload photo ${photo.id} to Supabase`);
          failedPhotos.push(photo.id);

          // Preserve metadata for upload failures too (network issue, not data loss)
          const orphan: OrphanPhoto = {
            id: photo.id,
            jobId: job.id,
            jobTitle: job.title,
            type: photo.type,
            timestamp: photo.timestamp,
            lat: photo.lat,
            lng: photo.lng,
            w3w: photo.w3w,
            reason: 'Upload failed - data exists locally but cloud upload failed',
            orphanedAt: Date.now(),
            recoveryAttempts: 0
          };
          orphanedPhotos.push(orphan);

          try {
            await saveOrphanPhoto(orphan);
            console.warn(`📸 Photo ${photo.id} metadata preserved (upload failed)`);
          } catch (saveErr) {
            console.error('Failed to save orphan photo metadata:', saveErr);
          }
          continue;
        }

        // Update photo with cloud URL
        uploadedPhotos.push({
          ...photo,
          url: publicUrl, // Replace IndexedDB key with public URL
          isIndexedDBRef: false,
          syncStatus: SYNC_STATUS.SYNCED
        });
      } else {
        uploadedPhotos.push(photo);
      }
    }

    // Notify user if any photos were orphaned
    if (orphanedPhotos.length > 0) {
      const totalOrphans = await countOrphanPhotos();
      showPersistentNotification({
        type: 'warning',
        title: 'Photo Sync Issue',
        message: `${orphanedPhotos.length} photo(s) could not sync for "${job.title}". Metadata preserved. ${totalOrphans} total photos need attention. Check your connection and try again.`,
        persistent: true,
        actionLabel: 'View Job',
        onAction: () => {
          // P0-5 FIX: Navigate to job detail instead of doing nothing
          // User can see the affected job and potentially re-capture photos
          window.location.hash = `#/app/jobs/${job.id}`;
        }
      });
    }

    // SECURITY FIX (BACKEND_AUDIT.md Risk #8): Fail sync if any photos failed to upload
    if (failedPhotos.length > 0) {
      throw new Error(`Failed to upload ${failedPhotos.length} photo(s): ${failedPhotos.join(', ')}`);
    }

    // 2. Upload signature from IndexedDB to Supabase Storage
    // FAILSAFE: Throw on failure like photos do. Previously failed silently,
    // saving an invalid IndexedDB key as signature_url in Supabase.
    let signatureUrl = job.signature;
    if (job.signature && job.signatureIsIndexedDBRef) {
      const sigData = await getMedia(job.signature);
      if (!sigData) {
        throw new Error(`Signature data not found in IndexedDB for job ${job.id}`);
      }
      const publicUrl = await uploadSignature(job.id, sigData);
      if (!publicUrl) {
        throw new Error(`Signature upload failed for job ${job.id}`);
      }
      signatureUrl = publicUrl;
    }

    // 3. Upsert job to database
    // Sprint 2 Task 2.6: Use normalizedJob for consistent technician IDs
    const { error: jobError } = await supabase
      .from('jobs')
      .upsert({
        id: normalizedJob.id,
        title: normalizedJob.title,
        client: normalizedJob.client,
        address: normalizedJob.address,
        notes: normalizedJob.notes,
        status: normalizedJob.status,
        lat: normalizedJob.lat,
        lng: normalizedJob.lng,
        w3w: normalizedJob.w3w,
        assignee: normalizedJob.technician,
        technician_id: normalizedJob.technicianId || normalizedJob.techId, // Normalized technician ID
        signer_name: normalizedJob.signerName,
        signer_role: normalizedJob.signerRole,
        signature_url: signatureUrl,
        created_at: normalizedJob.date,
        completed_at: normalizedJob.completedAt,
        last_updated: normalizedJob.lastUpdated,
        sync_status: SYNC_STATUS.SYNCED
      });

    if (jobError) throw jobError;

    // 4. Batch upsert photos to database (OPTIMIZED: single query instead of N queries)
    if (uploadedPhotos.length > 0) {
      const photoRecords = uploadedPhotos.map(photo => ({
        id: photo.id,
        job_id: job.id,
        url: photo.url,
        type: photo.type,
        timestamp: photo.timestamp,
        verified: photo.verified,
        lat: photo.lat,
        lng: photo.lng,
        w3w: photo.w3w,
        sync_status: SYNC_STATUS.SYNCED
      }));

      const { error: photoError } = await supabase
        .from('photos')
        .upsert(photoRecords);

      // P0 FIX: Never return success if photo records failed to sync
      if (photoError) {
        console.error(`Failed to batch sync ${uploadedPhotos.length} photos:`, photoError);
        throw new Error(`Photo batch sync failed: ${photoError.message}`);
      }
    }

    // 5. Batch upsert safety checklist (OPTIMIZED: single query instead of N queries)
    if (job.safetyChecklist && job.safetyChecklist.length > 0) {
      const checklistRecords = job.safetyChecklist.map(check => ({
        id: check.id,
        job_id: job.id,
        label: check.label,
        checked: check.checked,
        required: check.required
      }));

      const { error: checkError } = await supabase
        .from('safety_checks')
        .upsert(checklistRecords);

      // P0 FIX: Never return success if safety checks failed to sync
      if (checkError) {
        console.error(`Failed to batch sync ${job.safetyChecklist.length} safety checks:`, checkError);
        throw new Error(`Safety checklist sync failed: ${checkError.message}`);
      }
    }

    return true;

  } catch (error) {
    console.error('❌ Sync failed:', error);

    // P1-1a: Log conflict telemetry for analysis
    if (isConflictError(error)) {
      const conflictType = getConflictTypeFromError(error) || 'UPSERT_VERSION_MISMATCH';
      logConflict(
        conflictType,
        'job',
        job.id,
        'UNRESOLVED',
        {
          jobId: job.id,
          errorMessage: error instanceof Error ? error.message : String(error),
        }
      );
    }

    return false;
  }
};

// Concurrency guard: prevents timer + online event from double-processing the queue
let _retryInProgress = false;

/**
 * Retry failed syncs from localStorage queue
 *
 * CRITICAL FIX: Added _retryInProgress lock to prevent concurrent calls
 * from the 5-minute timer and the 'online' event listener. Without this,
 * both can read the same localStorage snapshot, process the same items,
 * and race on the final write — causing double API calls and lost updates.
 */
export const retryFailedSyncs = async (): Promise<void> => {
  if (_retryInProgress) return; // Another call is already processing
  if (!isSupabaseAvailable()) return;
  if (!navigator.onLine) return; // Skip retries when offline

  const queueJson = localStorage.getItem('jobproof_sync_queue');
  if (!queueJson) return;

  _retryInProgress = true;
  try {
    const queue: SyncQueueItem[] = JSON.parse(queueJson);
    const now = Date.now();
    const updatedQueue: SyncQueueItem[] = [];

    for (const item of queue) {
      // Check if enough time has passed since last attempt
      const delay = RETRY_DELAYS[Math.min(item.retryCount, RETRY_DELAYS.length - 1)];
      if (now - item.lastAttempt < delay) {
        updatedQueue.push(item);
        continue;
      }

      // Attempt sync
      let success = false;
      if (item.type === 'job') {
        success = await syncJobToSupabase(item.data);
      }

      if (!success) {
        // Increment retry count
        item.retryCount++;
        item.lastAttempt = now;

        // Re-queue if under max retries
        if (item.retryCount < MAX_RETRIES) {
          updatedQueue.push(item);
          console.warn(`⚠️ Retry ${item.retryCount}/${MAX_RETRIES} failed for ${item.type} ${item.id}`);
        } else {
          console.error(`❌ Max retries exceeded for ${item.type} ${item.id} - giving up`);

          // Store in failed queue for manual recovery (atomic append)
          appendToFailedSyncQueue({
            ...item,
            failedAt: new Date().toISOString(),
            reason: 'Max retries exceeded'
          });

          // Show persistent notification to user with working navigation
          const failedJobId = item.id;
          showPersistentNotification({
            type: 'error',
            title: 'Sync Failed',
            message: `Job ${failedJobId} failed to sync after ${MAX_RETRIES} attempts. Your data is saved locally. Please check your connection or contact support.`,
            persistent: true,
            actionLabel: 'View Job',
            onAction: () => {
              window.location.hash = `#/app/jobs/${failedJobId}`;
            }
          });
        }
      }
    }

    // Update queue in localStorage
    if (updatedQueue.length > 0) {
      localStorage.setItem('jobproof_sync_queue', JSON.stringify(updatedQueue));
    } else {
      localStorage.removeItem('jobproof_sync_queue');
    }

  } catch (error) {
    console.error('Failed to process sync queue:', error);
  } finally {
    _retryInProgress = false;
  }
};

/**
 * Add job to sync queue for retry
 */
export const addToSyncQueue = (job: Job): void => {
  try {
    const queueJson = localStorage.getItem('jobproof_sync_queue');
    const queue: SyncQueueItem[] = queueJson ? JSON.parse(queueJson) : [];

    queue.push({
      id: job.id,
      type: 'job',
      data: job,
      retryCount: 0,
      lastAttempt: Date.now()
    });

    localStorage.setItem('jobproof_sync_queue', JSON.stringify(queue));
  } catch (error) {
    // Handle quota exceeded or other localStorage errors
    console.warn('Failed to add job to sync queue:', error);
  }
};

/**
 * Get sync queue status
 *
 * CRITICAL FIX: Counts BOTH the active retry queue AND the permanently
 * failed queue. Previously only checked jobproof_sync_queue, but items
 * are moved to jobproof_failed_sync_queue after MAX_RETRIES — so the
 * failed count was always 0 and the UI never showed sync failures.
 */
export const getSyncQueueStatus = (): { pending: number; failed: number } => {
  let pending = 0;
  let failed = 0;

  try {
    // Count items still in active retry queue
    const queueJson = localStorage.getItem('jobproof_sync_queue');
    if (queueJson) {
      const queue: SyncQueueItem[] = JSON.parse(queueJson);
      pending = queue.length;
    }

    // Count permanently failed items (moved here after MAX_RETRIES)
    const failedJson = localStorage.getItem('jobproof_failed_sync_queue');
    if (failedJson) {
      const failedQueue = JSON.parse(failedJson);
      failed = Array.isArray(failedQueue) ? failedQueue.length : 0;
    }
  } catch {
    // Graceful fallback on corrupted localStorage
  }

  return { pending, failed };
};

/**
 * Auto-retry all permanently failed sync items
 *
 * Called automatically when regaining connectivity (bunker exit scenario).
 * Iterates through jobproof_failed_sync_queue and retries each item.
 * Successful items are removed; failed items stay for manual retry.
 *
 * SHARED GUARD: Uses _failedRetryInProgress to prevent concurrent access
 * from both autoRetryFailedQueue() and retryFailedSyncItem(). Without this,
 * a user tapping "Retry All" while auto-retry is running could double-process
 * the same items, corrupt the queue, or cause double API calls.
 */
let _failedRetryInProgress = false;
let _autoRetryProgress = { total: 0, recovered: 0, isRunning: false };

/**
 * Get real-time auto-retry progress for UI consumption.
 *
 * Allows OfflineIndicator to show "Auto-Syncing 2/5..." instead of
 * going silent during the recovery loop.
 */
export const getAutoRetryProgress = (): { total: number; recovered: number; isRunning: boolean } => ({
  ..._autoRetryProgress
});

export const autoRetryFailedQueue = async (): Promise<void> => {
  if (_failedRetryInProgress) return;
  if (!navigator.onLine) return;
  if (!isSupabaseAvailable()) return;

  const failedItems = getFailedSyncQueue();
  if (failedItems.length === 0) return;

  _failedRetryInProgress = true;
  _autoRetryProgress = { total: failedItems.length, recovered: 0, isRunning: true };
  try {
    let recovered = 0;

    for (const item of failedItems) {
      let success = false;
      if (item.type === 'job') {
        success = await syncJobToSupabase(item.data);
      }

      if (success) {
        // Remove from failed queue
        const currentQueue = getFailedSyncQueue();
        const updatedQueue = currentQueue.filter(i => i.id !== item.id);
        localStorage.setItem('jobproof_failed_sync_queue', JSON.stringify(updatedQueue));
        recovered++;
        _autoRetryProgress = { total: failedItems.length, recovered, isRunning: true };
      }
    }

    if (recovered > 0) {
      showPersistentNotification({
        type: 'success',
        title: 'Evidence Synced',
        message: `${recovered} job(s) successfully synced after reconnection.`,
        persistent: false
      });
    }
  } catch (error) {
    console.error('Failed to auto-retry failed queue:', error);
  } finally {
    _failedRetryInProgress = false;
    _autoRetryProgress = { total: 0, recovered: 0, isRunning: false };
  }
};

/**
 * Start background sync worker (call once on app load)
 * PERFORMANCE FIX: Reduced interval from 60s to 5 minutes to minimize API calls
 *
 * BUNKER RECOVERY: On reconnection, retries BOTH the active queue AND
 * the permanently failed queue. This ensures a technician exiting a
 * no-signal zone has their evidence auto-synced without manual intervention.
 */
export const startSyncWorker = (): void => {
  if (!isSupabaseAvailable()) return;

  // Retry active queue every 5 minutes
  setInterval(() => {
    if (navigator.onLine) {
      retryFailedSyncs();
    }
  }, 300000); // 5 minutes

  // On reconnection: retry BOTH queues (bunker exit scenario)
  window.addEventListener('online', () => {
    retryFailedSyncs();
    // Delay failed queue retry by 5s to let active queue process first
    setTimeout(() => autoRetryFailedQueue(), 5000);
  });
};

/**
 * Atomically append an item to the failed sync queue (localStorage).
 *
 * TOCTOU FIX: All escalation paths (localStorage retry, Dexie queue, debounced queue)
 * must use this function instead of inline read→modify→write. The read-modify-write
 * happens in a single synchronous block, preventing interleaved writes from overwriting
 * each other when two async escalations happen between `await` boundaries.
 */
export const appendToFailedSyncQueue = (item: {
  id: string;
  type: string;
  data: any;
  retryCount: number;
  lastAttempt: number;
  failedAt: string;
  reason: string;
  actionType?: string;
}): void => {
  try {
    // Synchronous read→modify→write — cannot be interleaved by other JS
    const raw = localStorage.getItem('jobproof_failed_sync_queue') || '[]';
    const queue = JSON.parse(raw);
    queue.push(item);
    localStorage.setItem('jobproof_failed_sync_queue', JSON.stringify(queue));
  } catch (error) {
    console.error('[SyncQueue] Failed to append to failed sync queue:', error);
  }
};

/**
 * Get failed sync queue items
 *
 * @returns Array of permanently failed sync items
 */
export const getFailedSyncQueue = (): SyncQueueItem[] => {
  try {
    const failedJson = localStorage.getItem('jobproof_failed_sync_queue');
    return failedJson ? JSON.parse(failedJson) : [];
  } catch {
    return [];
  }
};

/**
 * Retry a specific failed sync item
 *
 * RACE PROTECTION: Shares _failedRetryInProgress guard with autoRetryFailedQueue.
 * If auto-retry is running when user taps "Retry", this returns false immediately
 * rather than double-processing. The auto-retry will handle the item.
 *
 * @param itemId - The ID of the failed sync item to retry
 * @returns Promise<boolean> - True if retry was successful
 */
export const retryFailedSyncItem = async (itemId: string): Promise<boolean> => {
  if (_failedRetryInProgress) return false;

  _failedRetryInProgress = true;
  try {
    const failedQueue = getFailedSyncQueue();
    const item = failedQueue.find(i => i.id === itemId);

    if (!item) {
      return false;
    }

    // Attempt sync
    let success = false;
    if (item.type === 'job') {
      success = await syncJobToSupabase(item.data);
    }

    if (success) {
      // Re-read queue (may have changed) and remove item
      const currentQueue = getFailedSyncQueue();
      const updatedQueue = currentQueue.filter(i => i.id !== itemId);
      localStorage.setItem('jobproof_failed_sync_queue', JSON.stringify(updatedQueue));

      showPersistentNotification({
        type: 'success',
        title: 'Sync Recovered',
        message: `Job ${itemId} has been successfully synced to cloud.`,
        persistent: false
      });

      return true;
    } else {
      showPersistentNotification({
        type: 'error',
        title: 'Retry Failed',
        message: `Failed to sync job ${itemId}. Please try again later or contact support.`,
        persistent: false
      });

      return false;
    }
  } finally {
    _failedRetryInProgress = false;
  }
};

/**
 * Check if a retry operation is currently in progress.
 * Used by UI to show "already syncing" instead of triggering duplicate retries.
 */
export const isRetryInProgress = (): boolean => _failedRetryInProgress;

/**
 * Clear all failed sync items
 *
 * WARNING: This will permanently discard failed sync data.
 * Use only after manual recovery or data migration.
 */
export const clearFailedSyncQueue = (): void => {
  localStorage.removeItem('jobproof_failed_sync_queue');
};
