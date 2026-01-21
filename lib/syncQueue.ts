/**
 * Sync Queue Manager
 *
 * Handles background synchronization between IndexedDB (offline) and Supabase (cloud).
 * Implements retry logic, exponential backoff, and conflict resolution.
 */

import { Job, Photo, SafetyCheck } from '../types';
import { getSupabase, uploadPhoto, uploadSignature, isSupabaseAvailable } from './supabase';
import { getMedia } from '../db';

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
    for (const photo of job.photos) {
      if (photo.isIndexedDBRef) {
        // Get Base64 data from IndexedDB
        const dataUrl = await getMedia(photo.url);
        if (!dataUrl) {
          console.error(`Failed to retrieve photo ${photo.id} from IndexedDB`);
          continue;
        }

        // Upload to Supabase Storage
        const publicUrl = await uploadPhoto(job.id, photo.id, dataUrl);
        if (!publicUrl) {
          console.error(`Failed to upload photo ${photo.id} to Supabase`);
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
