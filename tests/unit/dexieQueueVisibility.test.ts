/**
 * Dexie Queue Visibility Tests
 *
 * Validates that getSyncQueueStatus() includes Dexie queue pending items
 * in its pending count, not just localStorage queue items.
 *
 * BEFORE: getSyncQueueStatus() only counted items in localStorage queues
 * (jobproof_sync_queue + jobproof_failed_sync_queue). Items in the Dexie
 * queue (database.queue table) were invisible to the UI — the OfflineIndicator
 * showed 0 pending even while Dexie had items waiting to sync.
 *
 * AFTER: getSyncQueueStatus() also includes a cached count of Dexie queue
 * items. updateDexiePendingCount() refreshes this cache from IndexedDB.
 * The total pending count = localStorage queue + Dexie queue.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getSyncQueueStatus,
  updateDexiePendingCount,
  _setDexiePendingCountForTest,
} from '@/lib/syncQueue';

describe('Dexie Queue Visibility in getSyncQueueStatus', () => {
  beforeEach(() => {
    localStorage.clear();
    _setDexiePendingCountForTest(0);
  });

  afterEach(() => {
    localStorage.clear();
    _setDexiePendingCountForTest(0);
  });

  it('should export updateDexiePendingCount function', () => {
    expect(typeof updateDexiePendingCount).toBe('function');
  });

  it('should export _setDexiePendingCountForTest for testing', () => {
    expect(typeof _setDexiePendingCountForTest).toBe('function');
  });

  it('should include Dexie pending count in getSyncQueueStatus.pending', () => {
    // Set 1 item in localStorage queue
    const queue = [
      { id: 'job-1', type: 'job', data: {}, retryCount: 0, lastAttempt: Date.now() },
    ];
    localStorage.setItem('jobproof_sync_queue', JSON.stringify(queue));

    // Simulate 3 Dexie pending items
    _setDexiePendingCountForTest(3);

    const status = getSyncQueueStatus();
    // Should be 1 (localStorage) + 3 (Dexie) = 4
    expect(status.pending).toBe(4);
  });

  it('should return only Dexie count when localStorage queue is empty', () => {
    _setDexiePendingCountForTest(5);

    const status = getSyncQueueStatus();
    expect(status.pending).toBe(5);
    expect(status.failed).toBe(0);
  });

  it('should return 0 pending when both queues are empty', () => {
    const status = getSyncQueueStatus();
    expect(status.pending).toBe(0);
    expect(status.failed).toBe(0);
  });

  it('should not affect failed count when Dexie count is set', () => {
    // 2 failed items in localStorage
    const failedQueue = [
      { id: 'f1', type: 'job', data: {}, retryCount: 7 },
      { id: 'f2', type: 'job', data: {}, retryCount: 7 },
    ];
    localStorage.setItem('jobproof_failed_sync_queue', JSON.stringify(failedQueue));

    // 3 Dexie pending items
    _setDexiePendingCountForTest(3);

    const status = getSyncQueueStatus();
    expect(status.pending).toBe(3); // Only Dexie (no localStorage pending)
    expect(status.failed).toBe(2);  // Only localStorage failed
  });
});
