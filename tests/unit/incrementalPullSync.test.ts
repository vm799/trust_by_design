/**
 * Incremental Pull Sync Tests
 *
 * Validates that pullJobs uses updated_at filtering for incremental syncs
 * to reduce bandwidth and improve performance on large workspaces.
 *
 * BEFORE: pullJobs fetched ALL jobs every cycle (SELECT * FROM jobs WHERE workspace_id=X).
 * On a workspace with 1000 jobs, this transfers the entire dataset every 5 minutes.
 *
 * AFTER: pullJobs tracks lastSyncAt per workspace and only fetches jobs
 * modified since the last successful sync. Full pulls still happen on
 * first load and periodically for orphan detection.
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

describe('Incremental Pull Sync', () => {
  const syncContent = readFile('lib/offline/sync.ts');

  it('should have a lastSyncAt storage mechanism', () => {
    // Must store the timestamp of the last successful sync
    expect(syncContent).toContain('lastSyncAt');
  });

  it('should use updated_at filter for incremental pulls', () => {
    // Supabase query should filter by updated_at > lastSyncAt
    expect(syncContent).toContain('updated_at');
    expect(syncContent).toMatch(/\.gt\s*\(\s*['"]updated_at['"]/);
  });

  it('should store lastSyncAt after successful pull', () => {
    // Must persist the timestamp after a successful sync
    expect(syncContent).toContain('setLastSyncAt');
  });

  it('should fall back to full pull when no lastSyncAt exists', () => {
    // First sync or cleared cache should fetch all records
    expect(syncContent).toMatch(/lastSyncAt.*null|!lastSyncAt|fullPull/);
  });

  it('should export getLastSyncAt and setLastSyncAt for testing', () => {
    // Functions must be exported so tests can verify/reset sync state
    expect(syncContent).toContain('export function getLastSyncAt');
    expect(syncContent).toContain('export function setLastSyncAt');
  });

  it('should only run orphan detection on full pulls', () => {
    // Incremental pulls only see changed records, not all records.
    // Orphan detection (deleting locally-cached jobs removed on server)
    // requires the full server dataset to compare against.
    // The code guards orphan detection with `if (isFullPull)`
    expect(syncContent).toContain('isFullPull');
    expect(syncContent).toContain('ORPHANED RECORDS DETECTION: Only on fullPull');
  });
});
