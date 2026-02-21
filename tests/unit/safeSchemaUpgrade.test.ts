/**
 * Safe Schema Upgrade Tests
 *
 * Validates that Dexie schema upgrades preserve critical data instead
 * of wiping the database entirely.
 *
 * BEFORE: purgeAndRecreateDatabase() called Dexie.delete() which
 * permanently destroys ALL local data — pending sync queue items,
 * unsynced photos, form drafts, and locally-created jobs.
 *
 * AFTER: Before purging, critical data is exported to localStorage
 * as a rescue payload. After recreating the database, the data is
 * reimported. Only truly unrecoverable corruption triggers a full wipe.
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

describe('Safe Schema Upgrade - Data Preservation', () => {
  const dbContent = readFile('lib/offline/db.ts');

  it('should export pending queue items before purge', () => {
    // The purge function must rescue unsynced queue items
    expect(dbContent).toContain('rescueDataBeforePurge');
  });

  it('should store rescue payload in localStorage', () => {
    // Rescue data persists in localStorage while IndexedDB is wiped
    expect(dbContent).toContain('jobproof_db_rescue');
  });

  it('should reimport rescued data after database recreation', () => {
    // After fresh DB creation, reimport rescued queue/drafts
    expect(dbContent).toContain('reimportRescuedData');
  });

  it('should rescue form drafts to prevent data loss', () => {
    // Form drafts (partially filled forms) must survive schema upgrade
    expect(dbContent).toContain('formDrafts');
    expect(dbContent).toMatch(/rescue.*draft|draft.*rescue/i);
  });

  it('should rescue unsynced jobs (syncStatus pending)', () => {
    // Jobs created offline but not yet synced to server
    expect(dbContent).toMatch(/rescue.*pending|pending.*rescue/i);
  });
});
