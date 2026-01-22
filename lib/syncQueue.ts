/**
 * Sync Queue Manager
 *
 * Handles background synchronization between IndexedDB (offline) and Supabase (cloud).
 * Implements retry logic, exponential backoff, and conflict resolution.
 */

import { Job, Photo, SafetyCheck } from '../types';
import { getSupabase, uploadPhoto, uploadSignature, isSupabaseAvailable } from './supabase';
import { getMedia } from '../db';
import { showPersistentNotification } from './utils/syncUtils';

interface SyncQueueItem {
  id: string;
  type: 'job' | 'photo' | 'signature';
  data: any;
  retryCount: number;
  lastAttempt: number;
}

export const RETRY_DELAYS = [2000, 5000, 10000, 30000]; // Exponential backoff: 2s, 5s, 10s, 30s
const MAX_RETRIES = 4;

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

  try {
    // 1. Upload photos from IndexedDB to Supabase Storage
    const uploadedPhotos: Photo[] = [];
    const failedPhotos: string[] = [];

    for (const photo of job.photos) {
      if (photo.isIndexedDBRef) {
        // Get Base64 data from IndexedDB
        const dataUrl = await getMedia(photo.url);
        if (!dataUrl) {
          console.error(`Failed to retrieve photo ${photo.id} from IndexedDB`);
          failedPhotos.push(photo.id);
          continue;
        }

        // Upload to Supabase Storage
        const publicUrl = await uploadPhoto(job.id, photo.id, dataUrl);
        if (!publicUrl) {
          console.error(`Failed to upload photo ${photo.id} to Supabase`);
          failedPhotos.push(photo.id);
          continue;
        }

        // Update photo with cloud URL
        uploadedPhotos.push({
          ...photo,
          url: publicUrl, // Replace IndexedDB key with public URL
          isIndexedDBRef: false,
          syncStatus: 'synced'
        });
      } else {
        uploadedPhotos.push(photo);
      }
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
    const { error: jobError } = await supabase
      .from('jobs')
      .upsert({
        id: job.id,
        title: job.title,
        client: job.client,
        address: job.address,
        notes: job.notes,
        status: job.status,
        lat: job.lat,
        lng: job.lng,
        w3w: job.w3w,
        assignee: job.technician,
        signer_name: job.signerName,
        signer_role: job.signerRole,
        signature_url: signatureUrl,
        created_at: job.date,
        completed_at: job.completedAt,
        last_updated: job.lastUpdated,
        sync_status: 'synced'
      });

    if (jobError) throw jobError;

    // 4. Upsert photos to database
    for (const photo of uploadedPhotos) {
      const { error: photoError } = await supabase
        .from('photos')
        .upsert({
          id: photo.id,
          job_id: job.id,
          url: photo.url,
          type: photo.type,
          timestamp: photo.timestamp,
          verified: photo.verified,
          lat: photo.lat,
          lng: photo.lng,
          w3w: photo.w3w,
          sync_status: 'synced'
        });

      if (photoError) {
        console.error(`Failed to sync photo ${photo.id}:`, photoError);
      }
    }

    // 5. Upsert safety checklist
    if (job.safetyChecklist) {
      for (const check of job.safetyChecklist) {
        const { error: checkError } = await supabase
          .from('safety_checks')
          .upsert({
            id: check.id,
            job_id: job.id,
            label: check.label,
            checked: check.checked,
            required: check.required
          });

        if (checkError) {
          console.error(`Failed to sync safety check ${check.id}:`, checkError);
        }
      }
    }

    return true;

  } catch (error) {
    console.error('❌ Sync failed:', error);
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
 */
export const startSyncWorker = (): void => {
  if (!isSupabaseAvailable()) return;

  // Retry failed syncs every 60 seconds
  setInterval(() => {
    if (navigator.onLine) {
      retryFailedSyncs();
    }
  }, 60000);

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
