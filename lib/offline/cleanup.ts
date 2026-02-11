/**
 * IndexedDB Cleanup Utility - CRITICAL FIX 1.3
 *
 * Handles automatic cleanup of:
 * 1. Orphaned photo blobs from synced jobs (photos with URLs already synced to Supabase)
 * 2. Expired form drafts older than 8 hours
 *
 * Prevents unbounded IndexedDB growth:
 * - 10K jobs × 5 photos × 500KB = 25GB demand without cleanup
 * - Safari evicts after 7 days, causing data loss
 *
 * CRITICAL RULES:
 * - Only delete photos from jobs with syncStatus='synced'
 * - NEVER delete photos from pending/in-progress jobs
 * - NEVER delete form drafts less than 8 hours old
 * - Idempotent - safe to run multiple times
 */

import { getDatabase, DRAFT_EXPIRY_MS } from './db';

/**
 * Cleanup statistics returned after operation
 */
export interface CleanupStats {
  photosCleaned: number;  // Photos deleted
  draftsCleaned: number;  // Form drafts deleted
  bytesFreed: number;     // Approximate bytes freed (estimated)
  timestamp: number;      // When cleanup ran
}

/**
 * Main cleanup function - removes orphaned photos and expired drafts
 *
 * Algorithm:
 * 1. Get all jobs with syncStatus='synced' (these have Supabase URLs)
 * 2. Collect all photo IDs from these synced jobs
 * 3. Find all media records NOT in the synced photo list
 * 4. Delete those orphaned media records
 * 5. Find all form drafts older than DRAFT_EXPIRY_MS
 * 6. Delete expired drafts
 * 7. Return statistics
 */
export async function cleanupIndexedDB(): Promise<CleanupStats> {
  const stats: CleanupStats = {
    photosCleaned: 0,
    draftsCleaned: 0,
    bytesFreed: 0,
    timestamp: Date.now()
  };

  try {
    const database = await getDatabase();

    // STEP 1-4: Clean up orphaned photos
    const allJobs = await database.jobs.toArray();

    // Collect all photo IDs from synced jobs
    const syncedPhotoIds = new Set<string>();
    for (const job of allJobs) {
      // Only consider photos from synced jobs
      if (job.syncStatus === 'synced' && job.photos && Array.isArray(job.photos)) {
        for (const photo of job.photos) {
          if (photo.url) {
            syncedPhotoIds.add(photo.url);
          }
        }
      }
    }

    // Get all media records
    const allMedia = await database.media.toArray();

    // Find orphaned media (media not referenced in synced photos)
    const orphanedMediaIds: string[] = [];
    for (const mediaRecord of allMedia) {
      // If this media ID is not in any synced job's photos, it's orphaned
      if (!syncedPhotoIds.has(mediaRecord.id)) {
        orphanedMediaIds.push(mediaRecord.id);
        // Estimate bytes: Base64 is ~1.33x original, assume ~500KB average photo
        stats.bytesFreed += Math.ceil(mediaRecord.data.length / 1.33);
      }
    }

    // Delete orphaned media records
    if (orphanedMediaIds.length > 0) {
      await database.media.bulkDelete(orphanedMediaIds);
      stats.photosCleaned = orphanedMediaIds.length;
    }

    // STEP 5-6: Clean up expired form drafts
    const now = Date.now();
    const allDrafts = await database.formDrafts.toArray();

    const expiredDraftKeys: string[] = [];
    for (const draft of allDrafts) {
      if (now - draft.savedAt >= DRAFT_EXPIRY_MS) {
        expiredDraftKeys.push(draft.formType);
      }
    }

    // Delete expired drafts
    if (expiredDraftKeys.length > 0) {
      await database.formDrafts.bulkDelete(expiredDraftKeys);
      stats.draftsCleaned = expiredDraftKeys.length;
    }

    return stats;
  } catch (error) {
    console.error('[Cleanup] IndexedDB cleanup failed:', error);
    // Return empty stats on failure - cleanup is non-critical
    return stats;
  }
}

/**
 * Schedule automatic cleanup on app startup + hourly intervals
 *
 * Call this once from DataContext.tsx on app initialization
 * Subsequent cleanups run automatically every 1 hour
 */
export async function scheduleCleanup(): Promise<void> {
  try {

    // Run cleanup immediately on app startup
    await cleanupIndexedDB();

    // Schedule cleanup every 1 hour
    const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds
    setInterval(async () => {
      await cleanupIndexedDB();
    }, CLEANUP_INTERVAL);
  } catch (error) {
    console.error('[Cleanup] Failed to schedule cleanup:', error);
    // Non-fatal - app continues even if scheduling fails
  }
}
