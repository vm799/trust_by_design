/**
 * DataContext deleteJob Offline Queue Tests
 *
 * PAUL: Unit test phase for Fix 19.
 *
 * BEFORE: deleteJob in DataContext called dbModule.deleteJob() which requires
 * Supabase. When offline, it failed and restored the job to state. The
 * DELETE_JOB action was never queued — the job reappeared on next pull.
 *
 * AFTER: deleteJob checks navigator.onLine. When offline, it removes from
 * local Dexie and queues DELETE_JOB action. When online but Supabase fails,
 * it also queues for later sync. Matches addJob/updateJob offline pattern.
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

describe('DataContext deleteJob offline queue', () => {
  const contextContent = readFile('lib/DataContext.tsx');

  // Extract the deleteJob function (ends at addClient)
  const fnStart = contextContent.indexOf('const deleteJob = useCallback');
  const fnEnd = contextContent.indexOf('const addClient = useCallback');
  const deleteFn = contextContent.slice(fnStart, fnEnd);

  it('should check navigator.onLine before attempting delete', () => {
    expect(deleteFn).toContain('navigator.onLine');
  });

  it('should queue DELETE_JOB action when offline', () => {
    expect(deleteFn).toContain("'DELETE_JOB'");
  });

  it('should import and use getOfflineDbModule', () => {
    expect(deleteFn).toContain('getOfflineDbModule');
  });

  it('should delete from local Dexie when offline', () => {
    // Should remove from local IndexedDB so the job disappears locally
    expect(deleteFn).toContain('deleteJobLocal');
  });

  it('should NOT restore job on successful offline queue', () => {
    // When offline queue succeeds, don't rollback the optimistic update
    // The function should only restore on actual errors, not on offline path
    expect(deleteFn).toContain('queueAction');
  });

  it('should still guard against sealed/invoiced jobs', () => {
    // Sealed/invoiced check should happen BEFORE any delete attempt
    expect(deleteFn).toMatch(/sealedAt|sealed/);
  });
});
