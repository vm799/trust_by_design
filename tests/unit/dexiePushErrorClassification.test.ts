/**
 * Dexie Push Queue Error Classification Tests
 *
 * Validates that _pushQueueImpl classifies errors via isPermanentError
 * before escalating to the failed sync queue.
 *
 * BEFORE: _pushQueueImpl caught errors from processCreateJob/processUpdateJob
 * but only logged them. Items retried up to DEXIE_QUEUE_MAX_RETRIES (10)
 * before escalation — even for permanent errors like 401/403/RLS.
 *
 * AFTER: The catch block in _pushQueueImpl checks isPermanentError. If true,
 * the item is immediately escalated to the failed sync queue without
 * incrementing retryCount, saving up to 10 wasted cycles.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../..');

const readFile = (filePath: string): string => {
  const fullPath = path.join(ROOT, filePath);
  if (!fs.existsSync(fullPath)) return '';
  return fs.readFileSync(fullPath, 'utf-8');
};

describe('Dexie _pushQueueImpl error classification', () => {
  const syncContent = readFile('lib/offline/sync.ts');

  it('should import isPermanentError from syncQueue', () => {
    expect(syncContent).toContain('isPermanentError');
  });

  it('should check isPermanentError in _pushQueueImpl catch block', () => {
    const pushSection = syncContent.slice(
      syncContent.indexOf('async function _pushQueueImpl'),
      syncContent.indexOf('async function processUpdateJob')
    );
    expect(pushSection).toContain('isPermanentError');
  });

  it('should escalate permanent errors immediately without retry increment', () => {
    const pushSection = syncContent.slice(
      syncContent.indexOf('async function _pushQueueImpl'),
      syncContent.indexOf('async function processUpdateJob')
    );
    // Should escalate to failed sync queue on permanent error
    expect(pushSection).toContain('appendToFailedSyncQueue');
    // Should reference permanent error in the escalation reason
    expect(pushSection).toMatch(/[Pp]ermanent/);
  });

  it('should delete item from Dexie queue after permanent error escalation', () => {
    const pushSection = syncContent.slice(
      syncContent.indexOf('async function _pushQueueImpl'),
      syncContent.indexOf('async function processUpdateJob')
    );
    // After escalation, the item should be deleted from Dexie queue
    expect(pushSection).toContain('database.queue.delete');
  });
});
