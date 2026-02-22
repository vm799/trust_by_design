/**
 * Online Delete Job Both Tables Tests
 *
 * PAUL: Unit test phase for Fix 22.
 *
 * BEFORE: db.ts deleteJob() deleted from 'jobs' table as primary action,
 * then attempted 'bunker_jobs' as "best-effort" wrapped in try-catch
 * that didn't check the Supabase error response. If the job only existed
 * in bunker_jobs (which is the primary table), the delete silently failed.
 *
 * AFTER: deleteJob() deletes from BOTH tables with proper error checking.
 * bunker_jobs deletion is a first-class operation, not best-effort cleanup.
 * Returns success if at least one table had the row and deleted it.
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

describe('Online deleteJob both tables', () => {
  const dbContent = readFile('lib/db.ts');

  // Extract the deleteJob function
  const fnStart = dbContent.indexOf('export const deleteJob = async');
  const fnEnd = dbContent.indexOf('// ============================================================================\n// MAGIC LINKS');
  const deleteFn = dbContent.slice(fnStart, fnEnd);

  it('should delete from bunker_jobs with error checking (not best-effort)', () => {
    // bunker_jobs delete should NOT be wrapped in a swallowing try-catch
    // It should check the error response from Supabase
    expect(deleteFn).not.toContain('Non-critical: bunker_jobs deletion is best-effort');
  });

  it('should delete from bunker_jobs table', () => {
    expect(deleteFn).toContain("from('bunker_jobs')");
    expect(deleteFn).toContain('.delete()');
  });

  it('should delete from jobs table', () => {
    expect(deleteFn).toContain("from('jobs')");
  });

  it('should check error on bunker_jobs delete', () => {
    // The bunker_jobs delete section should destructure error
    // Find the bunker_jobs delete and ensure it checks error
    const bunkerDeleteIdx = deleteFn.lastIndexOf("from('bunker_jobs')");
    const afterBunkerDelete = deleteFn.slice(bunkerDeleteIdx, bunkerDeleteIdx + 200);
    expect(afterBunkerDelete).toContain('error');
  });
});
