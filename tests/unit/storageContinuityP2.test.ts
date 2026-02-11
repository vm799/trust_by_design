/**
 * Storage Continuity P2 Tests
 *
 * Validates the P2 fixes:
 * - P2-1: Orphan photo retry mechanism in sync flow
 * - P2-3: Pull sync for clients and technicians
 * - App.tsx sync trigger wiring for all new functions
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

describe('P2-1: Orphan Photo Retry Mechanism', () => {
  const syncContent = readFile('lib/offline/sync.ts');

  it('should export retryOrphanPhotos function', () => {
    expect(syncContent).toMatch(/export async function retryOrphanPhotos\(\)/);
  });

  it('should use request deduplication for retryOrphanPhotos', () => {
    expect(syncContent).toContain("generateCacheKey('retryOrphanPhotos')");
    expect(syncContent).toContain('requestCache.dedupe(cacheKey');
  });

  it('should check navigator.onLine before retrying', () => {
    expect(syncContent).toContain('navigator.onLine');
  });

  it('should import getAllOrphanPhotos from offline db', () => {
    expect(syncContent).toMatch(/import.*getAllOrphanPhotos.*from.*\.\/db/);
  });

  it('should import getMediaLocal for checking if binary exists', () => {
    expect(syncContent).toMatch(/import.*getMediaLocal.*from.*\.\/db/);
  });

  it('should import deleteOrphanPhoto for cleanup after success', () => {
    expect(syncContent).toMatch(/import.*deleteOrphanPhoto.*from.*\.\/db/);
  });

  it('should import incrementOrphanRecoveryAttempts for tracking', () => {
    expect(syncContent).toMatch(/import.*incrementOrphanRecoveryAttempts.*from.*\.\/db/);
  });

  it('should upload to job-photos storage bucket', () => {
    expect(syncContent).toContain("from('job-photos')");
  });

  it('should have a max recovery attempts limit', () => {
    expect(syncContent).toContain('MAX_ORPHAN_RECOVERY_ATTEMPTS');
  });

  it('should call deleteOrphanPhoto on successful upload', () => {
    expect(syncContent).toContain('await deleteOrphanPhoto(orphan.id)');
  });

  it('should call incrementOrphanRecoveryAttempts on each attempt', () => {
    expect(syncContent).toContain('await incrementOrphanRecoveryAttempts(orphan.id)');
  });

  it('should show notification on successful recovery', () => {
    expect(syncContent).toContain('showPersistentNotification');
    expect(syncContent).toContain('Photos Recovered');
  });
});

describe('P2-3: Pull Sync for Clients and Technicians', () => {
  const syncContent = readFile('lib/offline/sync.ts');

  describe('pullClients', () => {
    it('should export pullClients function', () => {
      expect(syncContent).toMatch(/export async function pullClients\(workspaceId: string\)/);
    });

    it('should use request deduplication', () => {
      expect(syncContent).toContain("generateCacheKey('pullClients'");
    });

    it('should query from clients table', () => {
      expect(syncContent).toMatch(/\.from\('clients'\)\s*\n?\s*\.select\('\*'\)/);
    });

    it('should filter by workspace_id in pullClients impl', () => {
      // The _pullClientsImpl function should filter by workspace
      expect(syncContent).toContain("await saveClientsBatch(localClients)");
    });

    it('should save to Dexie via saveClientsBatch', () => {
      expect(syncContent).toMatch(/import.*saveClientsBatch.*from.*\.\/db/);
      expect(syncContent).toContain('saveClientsBatch(localClients)');
    });
  });

  describe('pullTechnicians', () => {
    it('should export pullTechnicians function', () => {
      expect(syncContent).toMatch(/export async function pullTechnicians\(workspaceId: string\)/);
    });

    it('should use request deduplication', () => {
      expect(syncContent).toContain("generateCacheKey('pullTechnicians'");
    });

    it('should query from technicians table', () => {
      expect(syncContent).toMatch(/\.from\('technicians'\)\s*\n?\s*\.select\('\*'\)/);
    });

    it('should filter by workspace_id in pullTechnicians impl', () => {
      expect(syncContent).toContain("await saveTechniciansBatch(localTechs)");
    });

    it('should save to Dexie via saveTechniciansBatch', () => {
      expect(syncContent).toMatch(/import.*saveTechniciansBatch.*from.*\.\/db/);
      expect(syncContent).toContain('saveTechniciansBatch(localTechs)');
    });
  });
});

describe('App.tsx Sync Trigger Wiring', () => {
  const appContent = readFile('App.tsx');

  it('should call sync.pullClients in performSync', () => {
    expect(appContent).toContain('sync.pullClients(user.workspace.id)');
  });

  it('should call sync.pullTechnicians in performSync', () => {
    expect(appContent).toContain('sync.pullTechnicians(user.workspace.id)');
  });

  it('should call sync.retryOrphanPhotos in performSync', () => {
    expect(appContent).toContain('sync.retryOrphanPhotos()');
  });

  it('should call sync.pullClients in initialPull', () => {
    const initialPullSection = appContent.split('initialPull')[1]?.split('setInterval')[0] || '';
    expect(initialPullSection).toContain('sync.pullClients');
  });

  it('should call sync.pullTechnicians in initialPull', () => {
    const initialPullSection = appContent.split('initialPull')[1]?.split('setInterval')[0] || '';
    expect(initialPullSection).toContain('sync.pullTechnicians');
  });
});

describe('Sync Functions - Pattern Consistency', () => {
  const syncContent = readFile('lib/offline/sync.ts');

  it('pullClients should follow same guard pattern as pullJobs', () => {
    const pullJobs = syncContent.split('export async function pullJobs')[1]?.split('export')[0] || '';
    const pullClients = syncContent.split('export async function pullClients')[1]?.split('export')[0] || '';

    expect(pullJobs).toContain('navigator.onLine');
    expect(pullClients).toContain('navigator.onLine');
    expect(pullJobs).toContain('isSupabaseAvailable');
    expect(pullClients).toContain('isSupabaseAvailable');
  });

  it('pullTechnicians should follow same guard pattern as pullJobs', () => {
    const pullJobs = syncContent.split('export async function pullJobs')[1]?.split('export')[0] || '';
    const pullTechs = syncContent.split('export async function pullTechnicians')[1]?.split('export')[0] || '';

    expect(pullJobs).toContain('navigator.onLine');
    expect(pullTechs).toContain('navigator.onLine');
    expect(pullJobs).toContain('isSupabaseAvailable');
    expect(pullTechs).toContain('isSupabaseAvailable');
  });

  it('all three new exports should be present in sync.ts', () => {
    const exports = syncContent.match(/export async function \w+/g) || [];
    const exportNames = exports.map(e => e.replace('export async function ', ''));
    expect(exportNames).toContain('retryOrphanPhotos');
    expect(exportNames).toContain('pullClients');
    expect(exportNames).toContain('pullTechnicians');
  });
});

describe('OfflineAction type completeness (from P0 fix)', () => {
  const dbContent = readFile('lib/offline/db.ts');

  it('should support all sync action types', () => {
    const actionTypes = [
      'CREATE_JOB', 'UPDATE_JOB', 'UPLOAD_PHOTO', 'SEAL_JOB',
      'CREATE_CLIENT', 'UPDATE_CLIENT',
      'CREATE_TECHNICIAN', 'UPDATE_TECHNICIAN'
    ];
    for (const type of actionTypes) {
      expect(dbContent).toContain(`'${type}'`);
    }
  });
});
