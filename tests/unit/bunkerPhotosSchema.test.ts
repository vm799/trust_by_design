/**
 * bunker_photos Column Schema Compliance — Fix 31
 *
 * PAUL: Test-first phase.
 *
 * BEFORE: syncQueue.ts photo upsert used columns from the legacy 'photos'
 * table schema (url, verified, w3w, sync_status). These columns DO NOT
 * EXIST in bunker_photos, causing every photo sync to fail with a
 * PostgreSQL "column does not exist" error.
 *
 * bunker_photos schema (from migration):
 *   id, job_id, type, data_url, storage_url, timestamp, lat, lng,
 *   size_bytes, hash_sha256, created_at
 *
 * AFTER: Photo records use correct bunker_photos column names.
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

describe('syncQueue.ts bunker_photos column compliance', () => {
  const content = readFile('lib/syncQueue.ts');

  // Extract the photo records section
  const photoStart = content.indexOf('const photoRecords');
  const photoEnd = content.indexOf('.upsert(photoRecords)', photoStart);
  const photoSection = content.slice(photoStart, photoEnd + 30);

  it('should use storage_url (not url)', () => {
    // bunker_photos has storage_url, not url
    expect(photoSection).toContain('storage_url');
    expect(photoSection).not.toMatch(/\burl: photo\.url\b/);
  });

  it('should NOT include verified column (does not exist in bunker_photos)', () => {
    expect(photoSection).not.toContain('verified');
  });

  it('should NOT include w3w column (does not exist in bunker_photos)', () => {
    // w3w is on bunker_jobs, not bunker_photos
    expect(photoSection).not.toContain('w3w:');
  });

  it('should NOT include sync_status column (does not exist in bunker_photos)', () => {
    expect(photoSection).not.toContain('sync_status');
  });

  it('should include job_id mapping', () => {
    expect(photoSection).toContain('job_id');
  });

  it('should include type mapping', () => {
    expect(photoSection).toContain('type');
  });
});

describe('db.ts deleteJob does not reference invoice_id on bunker_jobs', () => {
  const content = readFile('lib/db.ts');

  // Extract deleteJob function
  const fnStart = content.indexOf('export const deleteJob');
  const fnEnd = content.indexOf('export const', fnStart + 30);
  const fn = content.slice(fnStart, fnEnd > fnStart ? fnEnd : fnStart + 3000);

  it('should not select invoice_id from bunker_jobs (column does not exist)', () => {
    // The .select() on bunker_jobs should NOT include invoice_id
    const bunkerSelect = fn.match(/from\('bunker_jobs'\)\s*\.select\(['"]([^'"]+)['"]\)/);
    expect(bunkerSelect).toBeTruthy();
    expect(bunkerSelect![1]).not.toContain('invoice_id');
  });
});
