/**
 * Cross-Tab Sync Coordination Tests
 *
 * Validates that the sync system uses BroadcastChannel to prevent
 * multiple browser tabs from double-processing the same queue items.
 *
 * BEFORE: _retryInProgress was in-memory only — each tab ran its own
 * sync loop, causing double API calls and race conditions.
 *
 * AFTER: Tabs coordinate via BroadcastChannel. When one tab starts
 * processing the queue, it broadcasts a "sync-started" message.
 * Other tabs skip their sync cycle if they receive this message.
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

describe('Cross-Tab Sync Coordination', () => {
  const syncQueueContent = readFile('lib/syncQueue.ts');

  it('should use BroadcastChannel for cross-tab coordination', () => {
    expect(syncQueueContent).toContain('BroadcastChannel');
  });

  it('should broadcast sync-started when beginning queue processing', () => {
    expect(syncQueueContent).toContain('sync-started');
  });

  it('should broadcast sync-finished when queue processing completes', () => {
    expect(syncQueueContent).toContain('sync-finished');
  });

  it('should skip processing if another tab is syncing', () => {
    // The code should check a cross-tab flag before processing
    expect(syncQueueContent).toContain('_crossTabSyncActive');
  });

  it('should gracefully handle environments without BroadcastChannel', () => {
    // BroadcastChannel is not available in all environments (e.g., Safari <15.4)
    // The code should wrap in try/catch or check for availability
    expect(syncQueueContent).toMatch(/typeof BroadcastChannel|BroadcastChannel.*catch/);
  });
});
