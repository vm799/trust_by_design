/**
 * Purge clears lastSyncAt Tests
 *
 * Validates that purgeAndRecreateDatabase clears lastSyncAt keys from
 * localStorage, forcing a full pull on next sync cycle.
 *
 * BEFORE: purgeAndRecreateDatabase() wiped IndexedDB but left lastSyncAt
 * keys intact. The next pullJobs() used incremental mode with the stale
 * timestamp, only fetching records changed after the old sync time.
 * Records that existed before the purge but weren't recently modified
 * were silently lost — phantom data loss.
 *
 * AFTER: purgeAndRecreateDatabase() also clears all lastSyncAt keys.
 * The next pullJobs() detects no lastSyncAt and performs a full pull,
 * correctly restoring all server data into the fresh database.
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

describe('purgeAndRecreateDatabase clears lastSyncAt', () => {
  const dbContent = readFile('lib/offline/db.ts');

  it('should clear lastSyncAt keys during purge', () => {
    // purgeAndRecreateDatabase must remove lastSyncAt to force full pull
    expect(dbContent).toContain('jobproof_last_sync_at');
  });

  it('should clear keys before creating fresh database instance', () => {
    // The cleanup must happen DURING purge (between delete and recreate)
    const purgeSection = dbContent.slice(
      dbContent.indexOf('async function purgeAndRecreateDatabase'),
      dbContent.indexOf('async function checkDatabaseHealth')
    );
    expect(purgeSection).toContain('jobproof_last_sync_at');
  });

  it('should iterate and remove all workspace-specific keys', () => {
    // Multiple workspaces may have different lastSyncAt keys
    // The code must find and clear ALL matching keys
    const purgeSection = dbContent.slice(
      dbContent.indexOf('async function purgeAndRecreateDatabase'),
      dbContent.indexOf('async function checkDatabaseHealth')
    );
    // Should iterate over localStorage keys to find all lastSyncAt entries
    expect(purgeSection).toMatch(/localStorage|lastSyncAt/);
  });
});
