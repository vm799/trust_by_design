/**
 * Offline Delete Queue Type Tests
 *
 * PAUL: Unit test phase for Fix 18a/b.
 *
 * BEFORE: OfflineAction type only supported CREATE/UPDATE/UPLOAD/SEAL.
 * Job deletions while offline failed silently — the job reappeared
 * on next pull because no DELETE action was queued.
 *
 * AFTER: OfflineAction includes DELETE_JOB, DELETE_CLIENT, DELETE_TECHNICIAN.
 * _pushQueueImpl processes these with processDeleteJob/processDeleteClient/
 * processDeleteTechnician, syncing the deletion when back online.
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

describe('Offline delete queue types', () => {
  const dbContent = readFile('lib/offline/db.ts');

  it('should include DELETE_JOB in OfflineAction type', () => {
    expect(dbContent).toContain('DELETE_JOB');
  });

  it('should include DELETE_CLIENT in OfflineAction type', () => {
    expect(dbContent).toContain('DELETE_CLIENT');
  });

  it('should include DELETE_TECHNICIAN in OfflineAction type', () => {
    expect(dbContent).toContain('DELETE_TECHNICIAN');
  });
});

describe('Offline delete queue processing', () => {
  const syncContent = readFile('lib/offline/sync.ts');

  // Extract _pushQueueImpl function
  const pushStart = syncContent.indexOf('async function _pushQueueImpl');
  const pushEnd = syncContent.indexOf('async function processUpdateJob');
  const pushFn = syncContent.slice(pushStart, pushEnd);

  it('should handle DELETE_JOB in _pushQueueImpl switch', () => {
    expect(pushFn).toContain("'DELETE_JOB'");
  });

  it('should have processDeleteJob function', () => {
    expect(syncContent).toContain('async function processDeleteJob');
  });

  it('should call Supabase delete for DELETE_JOB', () => {
    const deleteSection = syncContent.slice(
      syncContent.indexOf('async function processDeleteJob')
    );
    // Should delete from 'jobs' table
    expect(deleteSection).toContain('.delete()');
  });
});
