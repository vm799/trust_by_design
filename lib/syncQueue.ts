/**
 * Sync Queue Manager
 *
 * Handles background synchronization between IndexedDB (offline) and Supabase (cloud).
 * Implements retry logic, exponential backoff, and conflict resolution.
 */

import { Job, Photo } from '../types';
import { getSupabase, uploadPhoto, uploadSignature, isSupabaseAvailable } from './supabase';
import { getMedia } from '../db';
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
          console.log('[Orphan Recovery] Navigating to job:', job.id);
          window.location.hash = `#/app/jobs/${job.id}`;
        }
      });
    }

    // SECURITY FIX (BACKEND_AUDIT.md Risk #8): Fail sync if any photos failed to upload
    if (failedPhotos.length > 0) {
      throw new Error(`Failed to upload ${failedPhotos.length} photo(s): ${failedPhotos.join(', ')}`);
    }

    // 2. Upload signature from IndexedDB to Supabase Storage
    let signatureUrl = job.signature;
    if (job.signature && job.signatureIsIndexedDBRef) {
      const sigData = await getMedia(job.signature);
      if (sigData) {
        const publicUrl = await uploadSignature(job.id, sigData);
        if (publicUrl) {
          signatureUrl = publicUrl;
        }
      }
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
      console.log(`✓ Batch synced ${uploadedPhotos.length} photos in single query`);
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
      console.log(`✓ Batch synced ${job.safetyChecklist.length} safety checks in single query`);
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

/**
 * Retry failed syncs from localStorage queue
 */
export const retryFailedSyncs = async (): Promise<void> => {
  if (!isSupabaseAvailable()) return;
  if (!navigator.onLine) return; // Skip retries when offline

  const queueJson = localStorage.getItem('jobproof_sync_queue');
  if (!queueJson) return;

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

          // Store in failed queue for manual recovery
          const failedQueue = JSON.parse(localStorage.getItem('jobproof_failed_sync_queue') || '[]');
          failedQueue.push({
            ...item,
            failedAt: new Date().toISOString(),
            reason: 'Max retries exceeded'
          });
          localStorage.setItem('jobproof_failed_sync_queue', JSON.stringify(failedQueue));

          // Show persistent notification to user
          showPersistentNotification({
            type: 'error',
            title: 'Sync Failed',
            message: `Job ${item.id} failed to sync after ${MAX_RETRIES} attempts. Your data is saved locally. Please check your connection or contact support.`,
            persistent: true,
            actionLabel: 'View Details',
            onAction: () => {
              console.log('User clicked view details for failed sync:', item.id);
              // Could navigate to a failed sync details page
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
 */
export const getSyncQueueStatus = (): { pending: number; failed: number } => {
  const queueJson = localStorage.getItem('jobproof_sync_queue');
  if (!queueJson) return { pending: 0, failed: 0 };

  try {
    const queue: SyncQueueItem[] = JSON.parse(queueJson);
    const failed = queue.filter(item => item.retryCount >= MAX_RETRIES).length;
    const pending = queue.length - failed;
    return { pending, failed };
  } catch {
    return { pending: 0, failed: 0 };
  }
};

/**
 * Start background sync worker (call once on app load)
 * PERFORMANCE FIX: Reduced interval from 60s to 5 minutes to minimize API calls
 */
export const startSyncWorker = (): void => {
  if (!isSupabaseAvailable()) return;

  // Retry failed syncs every 5 minutes (reduced from 60s to minimize API load)
  setInterval(() => {
    if (navigator.onLine) {
      retryFailedSyncs();
    }
  }, 300000); // 5 minutes

  // Also retry on network reconnection
  window.addEventListener('online', () => {
    console.log('🌐 Network reconnected - retrying failed syncs...');
    retryFailedSyncs();
  });
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
 * @param itemId - The ID of the failed sync item to retry
 * @returns Promise<boolean> - True if retry was successful
 */
export const retryFailedSyncItem = async (itemId: string): Promise<boolean> => {
  const failedQueue = getFailedSyncQueue();
  const item = failedQueue.find(i => i.id === itemId);

  if (!item) {
    console.error(`Failed sync item ${itemId} not found`);
    return false;
  }

  // Attempt sync
  let success = false;
  if (item.type === 'job') {
    success = await syncJobToSupabase(item.data);
  }

  if (success) {
    // Remove from failed queue
    const updatedQueue = failedQueue.filter(i => i.id !== itemId);
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
};

/**
 * Clear all failed sync items
 *
 * WARNING: This will permanently discard failed sync data.
 * Use only after manual recovery or data migration.
 */
export const clearFailedSyncQueue = (): void => {
  localStorage.removeItem('jobproof_failed_sync_queue');
  console.log('[Sync] Failed sync queue cleared');
};
