/**
 * syncJobToSupabase Targets bunker_jobs Table
 *
 * PAUL: Unit test phase for Fix 26.
 *
 * BEFORE: syncJobToSupabase in syncQueue.ts upserted to the 'jobs' table.
 * Jobs synced from Dexie offline queue to the wrong table — invisible to
 * getJobs() which reads from bunker_jobs.
 *
 * AFTER: syncJobToSupabase upserts to bunker_jobs with correct column names.
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

describe('syncJobToSupabase targets bunker_jobs', () => {
  const content = readFile('lib/syncQueue.ts');

  // Extract syncJobToSupabase function
  const fnStart = content.indexOf('export const syncJobToSupabase');
  // Find the closing of the function (next export)
  const fnBody = content.slice(fnStart, fnStart + 10000);

  it('should upsert to bunker_jobs table', () => {
    expect(fnBody).toContain("from('bunker_jobs')");
  });

  it('should use assigned_technician_id (not technician_id)', () => {
    // The upsert data should use assigned_technician_id for bunker_jobs
    expect(fnBody).toContain('assigned_technician_id');
  });

  it('should use technician_name (not assignee)', () => {
    expect(fnBody).toContain('technician_name');
  });
});
