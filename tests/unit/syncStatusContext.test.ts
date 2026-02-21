/**
 * Sync Status in DataContext Tests
 *
 * Validates that DataContext exposes reactive sync queue status
 * so views can display pending/failed item counts without importing
 * getSyncQueueStatus() directly (which causes stale closures).
 *
 * BEFORE: Views had no way to reactively show sync queue state.
 * AFTER: DataContext exposes syncStatus: { pending, failed } that
 * polls the queue every 3 seconds when online.
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

describe('Sync Status in DataContext', () => {
  const dataContextContent = readFile('lib/DataContext.tsx');

  it('should have syncStatus in the DataContextType interface', () => {
    // DataContext must expose syncStatus for reactive UI updates
    expect(dataContextContent).toContain('syncStatus:');
    expect(dataContextContent).toContain('pending: number');
    expect(dataContextContent).toContain('failed: number');
  });

  it('should import getSyncQueueStatus from syncQueue', () => {
    // DataContext should read queue status from the canonical source
    expect(dataContextContent).toContain('getSyncQueueStatus');
  });

  it('should poll sync status periodically', () => {
    // Must poll (setInterval or useEffect with timer) to stay reactive
    expect(dataContextContent).toMatch(/setInterval|setTimeout.*syncStatus|SYNC_POLL_INTERVAL/);
  });

  it('should expose syncStatus in the context value', () => {
    // The value object passed to DataContext.Provider must include syncStatus
    expect(dataContextContent).toContain('syncStatus,');
  });

  it('should include syncStatus in useData return type', () => {
    // The DataContextType interface that useData() returns must have syncStatus
    expect(dataContextContent).toContain('syncStatus: { pending: number; failed: number }');
  });
});
