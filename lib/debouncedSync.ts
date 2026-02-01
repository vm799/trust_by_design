/**
 * Debounced Sync Manager
 *
 * Batches and debounces Supabase updates to reduce API chatter.
 * Only syncs after 2 seconds of inactivity to optimize for field conditions.
 *
 * Key features:
 * - 2-second debounce window
 * - Immediate localStorage save (instant UI feedback)
 * - Batched cloud sync (reduced API calls)
 * - Offline-aware (queues for later if offline)
 *
 * @author Claude Code - Performance Optimization
 */

import { getSupabase, isSupabaseAvailable } from './supabase';
import { toSnakeCaseKeys } from './caseConvert';
import { setCache, invalidateCache } from './cacheFirst';

// Debounce delay in milliseconds
const DEBOUNCE_DELAY = 2000;

// Pending updates by entity type and ID
const pendingUpdates: Map<string, {
  table: string;
  id: string;
  data: Record<string, unknown>;
  timer: ReturnType<typeof setTimeout> | null;
  localKey?: string;
}> = new Map();

// Sync status callbacks
type SyncStatusCallback = (status: 'pending' | 'syncing' | 'synced' | 'error', error?: string) => void;
const statusCallbacks: Map<string, SyncStatusCallback> = new Map();

/**
 * Register a callback for sync status updates
 */
export function onSyncStatus(entityKey: string, callback: SyncStatusCallback): () => void {
  statusCallbacks.set(entityKey, callback);
  return () => statusCallbacks.delete(entityKey);
}

/**
 * Notify status change
 */
function notifyStatus(entityKey: string, status: 'pending' | 'syncing' | 'synced' | 'error', error?: string): void {
  const callback = statusCallbacks.get(entityKey);
  if (callback) {
    callback(status, error);
  }
}

/**
 * Debounced update for any Supabase table
 *
 * @param table - Supabase table name (e.g., 'bunker_jobs')
 * @param id - Row ID
 * @param data - Data to update (camelCase keys, will be converted)
 * @param localCacheKey - Optional cache key to update immediately
 */
export function debouncedUpdate(
  table: string,
  id: string,
  data: Record<string, unknown>,
  localCacheKey?: string
): void {
  const entityKey = `${table}:${id}`;

  // Cancel any existing timer for this entity
  const existing = pendingUpdates.get(entityKey);
  if (existing?.timer) {
    clearTimeout(existing.timer);
  }

  // Merge with existing pending data
  const mergedData = existing ? { ...existing.data, ...data } : data;

  // Immediately save to localStorage for instant UI feedback
  if (localCacheKey) {
    const cached = localStorage.getItem(`jobproof_cache_${localCacheKey}`);
    if (cached) {
      try {
        const current = JSON.parse(cached);
        setCache(localCacheKey, { ...current, ...data });
      } catch {
        setCache(localCacheKey, data);
      }
    }
  }

  // Notify pending status
  notifyStatus(entityKey, 'pending');

  // Set up debounced sync
  const timer = setTimeout(() => {
    executeSync(entityKey);
  }, DEBOUNCE_DELAY);

  pendingUpdates.set(entityKey, {
    table,
    id,
    data: mergedData,
    timer,
    localKey: localCacheKey,
  });
}

/**
 * Execute the actual sync to Supabase
 */
async function executeSync(entityKey: string): Promise<void> {
  const pending = pendingUpdates.get(entityKey);
  if (!pending) return;

  // Remove from pending
  pendingUpdates.delete(entityKey);

  // Check if online
  if (!navigator.onLine) {
    // Queue for later sync
    queueOfflineUpdate(pending);
    notifyStatus(entityKey, 'pending');
    return;
  }

  // Check if Supabase is available
  if (!isSupabaseAvailable()) {
    queueOfflineUpdate(pending);
    notifyStatus(entityKey, 'pending');
    return;
  }

  const supabase = getSupabase();
  if (!supabase) {
    queueOfflineUpdate(pending);
    notifyStatus(entityKey, 'pending');
    return;
  }

  // Notify syncing status
  notifyStatus(entityKey, 'syncing');

  try {
    // Convert to snake_case for PostgreSQL
    const snakeCaseData = toSnakeCaseKeys(pending.data);

    // Add last_updated timestamp
    snakeCaseData.last_updated = new Date().toISOString();

    // Execute upsert
    const { error } = await supabase
      .from(pending.table)
      .upsert({
        id: pending.id,
        ...snakeCaseData,
      });

    if (error) {
      throw error;
    }

    // Invalidate cache to force fresh fetch on next read
    if (pending.localKey) {
      invalidateCache(pending.localKey);
    }

    notifyStatus(entityKey, 'synced');
  } catch (error) {
    console.error(`[DebouncedSync] Failed to sync ${entityKey}:`, error);
    notifyStatus(entityKey, 'error', error instanceof Error ? error.message : 'Sync failed');

    // Queue for retry
    queueOfflineUpdate(pending);
  }
}

/**
 * Queue update for offline sync
 */
function queueOfflineUpdate(pending: {
  table: string;
  id: string;
  data: Record<string, unknown>;
}): void {
  const queueKey = 'jobproof_debounced_queue';
  try {
    const queue = JSON.parse(localStorage.getItem(queueKey) || '[]');
    queue.push({
      table: pending.table,
      id: pending.id,
      data: pending.data,
      queuedAt: new Date().toISOString(),
    });
    localStorage.setItem(queueKey, JSON.stringify(queue));
  } catch (e) {
    console.warn('[DebouncedSync] Failed to queue offline update:', e);
  }
}

/**
 * Flush all pending updates immediately (call before page unload)
 */
export async function flushPendingUpdates(): Promise<void> {
  const promises: Promise<void>[] = [];

  for (const [entityKey, pending] of pendingUpdates) {
    if (pending.timer) {
      clearTimeout(pending.timer);
    }
    promises.push(executeSync(entityKey));
  }

  await Promise.allSettled(promises);
}

/**
 * Process queued offline updates (call when back online)
 */
export async function processOfflineQueue(): Promise<void> {
  if (!navigator.onLine || !isSupabaseAvailable()) return;

  const queueKey = 'jobproof_debounced_queue';
  const queue = JSON.parse(localStorage.getItem(queueKey) || '[]');

  if (queue.length === 0) return;

  const supabase = getSupabase();
  if (!supabase) return;

  const failed: typeof queue = [];

  for (const item of queue) {
    try {
      const snakeCaseData = toSnakeCaseKeys(item.data);
      snakeCaseData.last_updated = new Date().toISOString();

      const { error } = await supabase
        .from(item.table)
        .upsert({
          id: item.id,
          ...snakeCaseData,
        });

      if (error) {
        failed.push(item);
      }
    } catch {
      failed.push(item);
    }
  }

  // Update queue with only failed items
  if (failed.length > 0) {
    localStorage.setItem(queueKey, JSON.stringify(failed));
  } else {
    localStorage.removeItem(queueKey);
  }
}

/**
 * Get count of pending/queued updates
 */
export function getPendingCount(): { inMemory: number; queued: number } {
  const queueKey = 'jobproof_debounced_queue';
  let queued = 0;
  try {
    const queue = JSON.parse(localStorage.getItem(queueKey) || '[]');
    queued = queue.length;
  } catch {
    queued = 0;
  }

  return {
    inMemory: pendingUpdates.size,
    queued,
  };
}

/**
 * Convenience function for job updates
 */
export function debouncedJobUpdate(jobId: string, data: Record<string, unknown>): void {
  debouncedUpdate('bunker_jobs', jobId, data, `job_${jobId}`);
}

/**
 * Convenience function for photo updates
 */
export function debouncedPhotoUpdate(photoId: string, jobId: string, data: Record<string, unknown>): void {
  debouncedUpdate('photos', photoId, { ...data, jobId }, `photos_${jobId}`);
}

// Auto-process offline queue when coming back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[DebouncedSync] Back online - processing queued updates...');
    processOfflineQueue();
  });

  // Flush pending updates before page unload
  window.addEventListener('beforeunload', () => {
    // Note: async operations may not complete, but we try our best
    flushPendingUpdates();
  });
}
