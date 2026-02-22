/**
 * db.ts Write Operations Target bunker_jobs Table
 *
 * PAUL: Unit test phase for Fix 24.
 *
 * BEFORE: createJob, updateJob, and getJob all used the 'jobs' table,
 * but getJobs reads from 'bunker_jobs'. Jobs written to 'jobs' vanish
 * from the list view after any page refresh — the core "job details sync" bug.
 *
 * AFTER: All CRUD operations in db.ts target 'bunker_jobs' as the
 * primary table, matching getJobs(). Column names mapped accordingly
 * (client not client_name, assigned_technician_id not technician_id).
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

/** Extract a named function body from source code */
function extractFunction(source: string, funcName: string): string {
  const patterns = [
    `export const ${funcName} = async`,
    `const ${funcName} = async`,
  ];

  for (const pattern of patterns) {
    const start = source.indexOf(pattern);
    if (start === -1) continue;

    // Find the next export const or the file end
    let end = source.length;
    const nextExport = source.indexOf('\nexport const ', start + pattern.length);
    const nextSection = source.indexOf('\n// ====', start + pattern.length);
    if (nextExport > start) end = Math.min(end, nextExport);
    if (nextSection > start) end = Math.min(end, nextSection);

    return source.slice(start, end);
  }
  return '';
}

describe('db.ts CRUD operations target bunker_jobs', () => {
  const dbContent = readFile('lib/db.ts');

  describe('createJob', () => {
    const fn = extractFunction(dbContent, 'createJob');

    it('should insert into bunker_jobs table', () => {
      // After mock guard, the Supabase insert should target bunker_jobs
      const afterMock = fn.slice(fn.indexOf('const supabase = getSupabase'));
      expect(afterMock).toContain("from('bunker_jobs')");
    });

    it('should use bunker_jobs column name: client (not client_name)', () => {
      const afterMock = fn.slice(fn.indexOf('const supabase = getSupabase'));
      // Should have 'client:' in the insert data, not 'client_name:'
      expect(afterMock).not.toContain('client_name:');
    });

    it('should use bunker_jobs column name: assigned_technician_id', () => {
      const afterMock = fn.slice(fn.indexOf('const supabase = getSupabase'));
      expect(afterMock).toContain('assigned_technician_id');
    });
  });

  describe('updateJob', () => {
    const fn = extractFunction(dbContent, 'updateJob');

    it('should query bunker_jobs for sealed check', () => {
      const afterMock = fn.slice(fn.indexOf('const supabase = getSupabase'));
      // The sealed_at check and update should target bunker_jobs
      expect(afterMock).toContain("from('bunker_jobs')");
    });

    it('should map client to bunker_jobs column (not client_name)', () => {
      const afterMock = fn.slice(fn.indexOf('const supabase = getSupabase'));
      // updateData should use 'client' not 'client_name'
      expect(afterMock).not.toContain("updateData.client_name");
    });

    it('should map techId to assigned_technician_id (not technician_id)', () => {
      const afterMock = fn.slice(fn.indexOf('const supabase = getSupabase'));
      expect(afterMock).toContain('assigned_technician_id');
    });
  });

  describe('getJob (_getJobImpl)', () => {
    const fn = extractFunction(dbContent, '_getJobImpl');

    it('should read from bunker_jobs table', () => {
      const afterMock = fn.slice(fn.indexOf('const supabase = getSupabase'));
      expect(afterMock).toContain("from('bunker_jobs')");
    });
  });
});
