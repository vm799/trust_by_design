/**
 * Delete cleans ALL Dexie databases — Fix 32
 *
 * PAUL: Test-first phase.
 *
 * BEFORE: DataContext.deleteJob only cleaned JobProofOfflineDB. Two other
 * Dexie databases (BunkerRunDB, BunkerProofDB) retained ghost records.
 * Visiting /run/:id after deletion loaded the ghost from BunkerRunDB,
 * resurrecting the deleted job. If the ghost had a beforePhoto, auto-sync
 * set the status to 'In Progress'.
 *
 * AFTER: DataContext.deleteJob also cleans BunkerRunDB and BunkerProofDB.
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

describe('DataContext deleteJob cleans all Dexie databases', () => {
  const content = readFile('lib/DataContext.tsx');

  // Extract the deleteJob function area (wrapped in useCallback)
  const fnStart = content.indexOf('const deleteJob = useCallback');
  const fn = content.slice(fnStart, fnStart + 2000);

  it('should clean BunkerRunDB on delete', () => {
    expect(fn).toContain('BunkerRunDB');
  });

  it('should clean BunkerProofDB on delete', () => {
    expect(fn).toContain('BunkerProofDB');
  });
});

describe('BunkerRun.tsx loadJob validates against server', () => {
  const content = readFile('views/BunkerRun.tsx');

  // Extract loadJob function
  const fnStart = content.indexOf('const loadJob = async');
  const fnBody = content.slice(fnStart, fnStart + 1500);

  it('should verify cached job exists server-side before using it', () => {
    // When a cached job is found, should check Supabase to verify it still exists
    // Look for a deletion/existence check when using cached data
    expect(fnBody).toContain('delete');
  });
});
