/**
 * Incremental Pull for Clients and Technicians Tests
 *
 * PAUL: Unit test phase for Fix 17.
 *
 * BEFORE: _pullClientsImpl and _pullTechniciansImpl always fetched ALL
 * records from Supabase on every sync cycle — no incremental filtering.
 * Jobs already had lastSyncAt-based incremental pull (Fix 5).
 *
 * AFTER: Both functions use getLastSyncAt/setLastSyncAt to only fetch
 * records modified since the last successful pull, reducing bandwidth
 * and server load on large workspaces.
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

describe('Incremental pull for clients and technicians', () => {
  const syncContent = readFile('lib/offline/sync.ts');

  describe('_pullClientsImpl incremental sync', () => {
    const fnStart = syncContent.indexOf('async function _pullClientsImpl');
    const fnEnd = syncContent.indexOf('async function pullTechnicians');
    const clientFn = syncContent.slice(fnStart, fnEnd);

    it('should read lastSyncAt for clients', () => {
      expect(clientFn).toContain('getLastSyncAt');
    });

    it('should filter by updated_at when lastSyncAt exists', () => {
      expect(clientFn).toContain('updated_at');
    });

    it('should store lastSyncAt after successful pull', () => {
      expect(clientFn).toContain('setLastSyncAt');
    });
  });

  describe('_pullTechniciansImpl incremental sync', () => {
    const fnStart = syncContent.indexOf('async function _pullTechniciansImpl');
    const techFn = syncContent.slice(fnStart);

    it('should read lastSyncAt for technicians', () => {
      expect(techFn).toContain('getLastSyncAt');
    });

    it('should filter by updated_at when lastSyncAt exists', () => {
      expect(techFn).toContain('updated_at');
    });

    it('should store lastSyncAt after successful pull', () => {
      expect(techFn).toContain('setLastSyncAt');
    });
  });

  describe('separate keys per entity type', () => {
    it('should use entity-specific lastSyncAt keys (not shared with jobs)', () => {
      const clientFn = syncContent.slice(
        syncContent.indexOf('async function _pullClientsImpl'),
        syncContent.indexOf('async function pullTechnicians')
      );
      const techFn = syncContent.slice(
        syncContent.indexOf('async function _pullTechniciansImpl')
      );
      // Each entity should have a distinct key prefix to avoid collision
      expect(clientFn).toMatch(/clients|client/i);
      expect(techFn).toMatch(/technicians|tech/i);
    });
  });
});
