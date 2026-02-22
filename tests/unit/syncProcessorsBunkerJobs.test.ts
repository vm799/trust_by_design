/**
 * Sync Processors Target bunker_jobs Table
 *
 * PAUL: Unit test phase for Fix 25.
 *
 * BEFORE: processCreateJob and processUpdateJob in offline/sync.ts both
 * targeted the 'jobs' table. Offline-created/updated jobs synced to the
 * wrong table — invisible to getJobs() which reads from bunker_jobs.
 *
 * AFTER: Both processors target bunker_jobs with correct column mapping.
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

describe('Sync processors target bunker_jobs', () => {
  const syncContent = readFile('lib/offline/sync.ts');

  describe('processCreateJob', () => {
    const fnStart = syncContent.indexOf('async function processCreateJob');
    const fnEnd = syncContent.indexOf('async function processCreateClient');
    const fn = syncContent.slice(fnStart, fnEnd);

    it('should upsert into bunker_jobs', () => {
      expect(fn).toContain("from('bunker_jobs')");
    });

    it('should use bunker_jobs column: client (not client_id only)', () => {
      // Should have client field mapped for bunker_jobs
      expect(fn).toContain('client:');
    });

    it('should use assigned_technician_id (not technician_id)', () => {
      expect(fn).toContain('assigned_technician_id');
    });
  });

  describe('processUpdateJob', () => {
    const fnStart = syncContent.indexOf('async function processUpdateJob');
    const fnEnd = syncContent.indexOf('async function processCreateJob');
    const fn = syncContent.slice(fnStart, fnEnd);

    it('should update bunker_jobs', () => {
      expect(fn).toContain("from('bunker_jobs')");
    });

    it('should use last_updated (not updated_at)', () => {
      expect(fn).toContain('last_updated');
    });
  });
});
