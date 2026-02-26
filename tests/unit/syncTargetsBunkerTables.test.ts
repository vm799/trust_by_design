/**
 * Sync Pull and Photo Upload Target bunker_jobs
 *
 * PAUL: Unit test phase for Fix 28.
 *
 * BEFORE: pullJobs read from 'jobs' table (empty). processUploadPhoto
 * updated 'jobs' table. syncQueue photo upsert targeted 'photos' table.
 * syncRecovery health check queried 'jobs'. None of these found data.
 *
 * AFTER: All sync operations target the correct bunker tables.
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

describe('Sync operations target correct bunker tables', () => {
  describe('lib/offline/sync.ts pull operation', () => {
    const content = readFile('lib/offline/sync.ts');

    // Extract pullJobs function area
    const pullStart = content.indexOf('async function pullJobs');
    const pullEnd = content.indexOf('async function pushQueue');
    const pullFn = content.slice(pullStart, pullEnd);

    it('pullJobs should read from bunker_jobs', () => {
      expect(pullFn).toContain("from('bunker_jobs')");
    });

    it('pullJobs should use bunker_jobs column mapping (client not client_name)', () => {
      expect(pullFn).toContain('row.client');
    });
  });

  describe('lib/offline/sync.ts processUploadPhoto', () => {
    const content = readFile('lib/offline/sync.ts');

    // Extract processUploadPhoto area — Fix 53 persists full photos JSONB
    const fnStart = content.indexOf('async function processUploadPhoto');
    const fnEnd = content.indexOf('// Clean up IndexedDB media record');
    const fnSlice = content.slice(fnStart, fnEnd);

    it('should update bunker_jobs (not jobs)', () => {
      expect(fnSlice).toContain("from('bunker_jobs')");
    });
  });

  describe('lib/syncQueue.ts photo upsert', () => {
    const content = readFile('lib/syncQueue.ts');

    // Find the photo batch upsert
    const photoArea = content.indexOf('const { error: photoError }');
    const photoSlice = content.slice(photoArea, photoArea + 100);

    it('should upsert to bunker_photos (not photos)', () => {
      expect(photoSlice).toContain("from('bunker_photos')");
    });
  });

  describe('lib/syncRecovery.ts health check', () => {
    const content = readFile('lib/syncRecovery.ts');

    // Find health check area
    const healthStart = content.indexOf('Simple health check query');
    const healthSlice = content.slice(healthStart, healthStart + 100);

    it('should check bunker_jobs (not jobs)', () => {
      expect(healthSlice).toContain("from('bunker_jobs')");
    });
  });
});
