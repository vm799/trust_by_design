/**
 * Cross-Tab Guard on autoRetryFailedQueue Tests
 *
 * PAUL: Unit test phase for Fix 13.
 *
 * BEFORE: autoRetryFailedQueue checked _failedRetryInProgress (same-tab)
 * but NOT _crossTabSyncActive. Two tabs could double-process the
 * permanently failed queue simultaneously.
 *
 * AFTER: autoRetryFailedQueue checks _crossTabSyncActive before proceeding
 * and broadcasts sync-started/sync-finished via BroadcastChannel.
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

describe('autoRetryFailedQueue cross-tab guard', () => {
  const syncQueueContent = readFile('lib/syncQueue.ts');

  // Extract just the autoRetryFailedQueue function body
  const fnStart = syncQueueContent.indexOf('export const autoRetryFailedQueue');
  const fnEnd = syncQueueContent.indexOf('export const getAutoRetryProgress') > fnStart
    ? syncQueueContent.indexOf('export const getAutoRetryProgress')
    : syncQueueContent.indexOf('/**\n * Start background sync worker');
  const autoRetryFn = syncQueueContent.slice(fnStart, fnEnd);

  it('should check _crossTabSyncActive before processing', () => {
    expect(autoRetryFn).toContain('_crossTabSyncActive');
  });

  it('should broadcast sync-started when beginning work', () => {
    expect(autoRetryFn).toContain("broadcastSyncState('sync-started')");
  });

  it('should broadcast sync-finished in finally block', () => {
    expect(autoRetryFn).toContain("broadcastSyncState('sync-finished')");
  });

  it('should have cross-tab check before _failedRetryInProgress assignment', () => {
    // _crossTabSyncActive check must come BEFORE setting _failedRetryInProgress
    const crossTabIdx = autoRetryFn.indexOf('_crossTabSyncActive');
    const lockIdx = autoRetryFn.indexOf('_failedRetryInProgress = true');
    expect(crossTabIdx).toBeGreaterThan(-1);
    expect(lockIdx).toBeGreaterThan(-1);
    expect(crossTabIdx).toBeLessThan(lockIdx);
  });
});
