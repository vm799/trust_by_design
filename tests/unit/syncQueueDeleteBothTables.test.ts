/**
 * Sync Queue DELETE_JOB Both Tables Tests
 *
 * PAUL: Unit test phase for Fix 23.
 *
 * BEFORE: offline/sync.ts processDeleteJob() only deleted from the 'jobs'
 * table. Jobs that exist in 'bunker_jobs' (the primary table) were never
 * removed — they reappeared on the next data refresh after reconnecting.
 *
 * AFTER: processDeleteJob() deletes from BOTH 'bunker_jobs' and 'jobs'
 * tables, matching the fix applied to db.ts deleteJob() in Fix 22.
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

describe('Sync queue processDeleteJob both tables', () => {
  const syncContent = readFile('lib/offline/sync.ts');

  // Extract the processDeleteJob function body
  const fnStart = syncContent.indexOf('async function processDeleteJob');
  const fnBody = syncContent.slice(fnStart, fnStart + 600);

  it('should exist as a function', () => {
    expect(fnStart).toBeGreaterThan(-1);
  });

  it('should delete from bunker_jobs table', () => {
    expect(fnBody).toContain("from('bunker_jobs')");
  });

  it('should delete from jobs table', () => {
    expect(fnBody).toContain("from('jobs')");
  });

  it('should delete from both tables, not just one', () => {
    // Count occurrences of .delete() in the function
    const deleteCount = (fnBody.match(/\.delete\(\)/g) || []).length;
    expect(deleteCount).toBeGreaterThanOrEqual(2);
  });
});
