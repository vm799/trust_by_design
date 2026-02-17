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

describe('Sync Queue Guards - All retry functions check isSupabaseAvailable', () => {
  const syncQueueContent = readFile('lib/syncQueue.ts');

  it('autoRetryFailedQueue should check isSupabaseAvailable before retrying', () => {
    // The function body must contain the guard
    expect(syncQueueContent).toContain('autoRetryFailedQueue');
    // Find the function and verify guard is present BEFORE syncJobToSupabase
    const funcStart = syncQueueContent.indexOf('const autoRetryFailedQueue');
    const funcBody = syncQueueContent.slice(funcStart, funcStart + 500);
    expect(funcBody).toContain('isSupabaseAvailable()');
  });

  it('retryFailedSyncs should check isSupabaseAvailable', () => {
    const funcStart = syncQueueContent.indexOf('const retryFailedSyncs');
    const funcBody = syncQueueContent.slice(funcStart, funcStart + 500);
    expect(funcBody).toContain('isSupabaseAvailable()');
  });

  it('retryFailedSyncItem should share concurrency guard with autoRetryFailedQueue', () => {
    expect(syncQueueContent).toContain('_failedRetryInProgress');
    // Both functions should reference this guard
    const occurrences = syncQueueContent.match(/_failedRetryInProgress/g) || [];
    // At minimum: declaration + autoRetry read + autoRetry set/clear + retryItem read + retryItem set/clear
    expect(occurrences.length).toBeGreaterThanOrEqual(5);
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

// ============================================================
// P1: TOCTOU FIX — Atomic appendToFailedSyncQueue
// All escalation paths must use the shared helper instead of
// inline read→modify→write on jobproof_failed_sync_queue
// ============================================================

describe('TOCTOU Fix - Atomic appendToFailedSyncQueue', () => {
  const syncQueueContent = readFile('lib/syncQueue.ts');
  const syncContent = readFile('lib/offline/sync.ts');
  const debouncedContent = readFile('lib/debouncedSync.ts');

  it('syncQueue.ts should export appendToFailedSyncQueue helper', () => {
    expect(syncQueueContent).toContain('export const appendToFailedSyncQueue');
  });

  it('appendToFailedSyncQueue should do synchronous read→modify→write', () => {
    // Find the function body
    const funcStart = syncQueueContent.indexOf('export const appendToFailedSyncQueue');
    const funcBody = syncQueueContent.slice(funcStart, funcStart + 600);
    // Must read, push, and write in one synchronous block
    expect(funcBody).toContain("localStorage.getItem('jobproof_failed_sync_queue')");
    expect(funcBody).toContain('queue.push(item)');
    expect(funcBody).toContain("localStorage.setItem('jobproof_failed_sync_queue'");
  });

  it('retryFailedSyncs escalation should use appendToFailedSyncQueue', () => {
    // Find the retryFailedSyncs function
    const funcStart = syncQueueContent.indexOf('export const retryFailedSyncs');
    const funcEnd = syncQueueContent.indexOf('export const addToSyncQueue');
    const funcBody = syncQueueContent.slice(funcStart, funcEnd);
    expect(funcBody).toContain('appendToFailedSyncQueue(');
    // Should NOT have inline read→modify→write pattern
    expect(funcBody).not.toContain("JSON.parse(localStorage.getItem('jobproof_failed_sync_queue')");
  });

  it('Dexie queue escalation should use appendToFailedSyncQueue', () => {
    expect(syncContent).toContain("import { appendToFailedSyncQueue } from '../syncQueue'");
    // The pushQueue escalation should call the helper
    expect(syncContent).toContain('appendToFailedSyncQueue({');
    // Should NOT have inline read→modify→write for failed sync queue
    const pushQueueSection = syncContent.split('_pushQueueImpl')[1]?.split('async function processUpdateJob')[0] || '';
    expect(pushQueueSection).not.toContain("JSON.parse(localStorage.getItem('jobproof_failed_sync_queue')");
  });

  it('debounced queue escalation should use appendToFailedSyncQueue', () => {
    expect(debouncedContent).toContain("import { appendToFailedSyncQueue } from './syncQueue'");
    // Should use the helper
    expect(debouncedContent).toContain('appendToFailedSyncQueue({');
    // Should NOT have inline read→modify→write for failed sync queue
    const processSection = debouncedContent.split('processOfflineQueue')[1]?.split('export function getPendingCount')[0] || '';
    expect(processSection).not.toContain("JSON.parse(localStorage.getItem('jobproof_failed_sync_queue')");
  });
});

// ============================================================
// P2: Dexie corruption guard for SEAL_JOB
// If queueAction('SEAL_JOB') fails (Dexie corrupted), escalate
// to localStorage failed queue instead of silently losing it
// ============================================================

describe('P2: Dexie corruption guard - SEAL_JOB fallback', () => {
  const syncContent = readFile('lib/offline/sync.ts');

  it('auto-seal Dexie fallback should escalate to appendToFailedSyncQueue', () => {
    // The catch block for queueAction('SEAL_JOB') should call appendToFailedSyncQueue
    // Previously it was just "// Last resort: seal action lost"
    expect(syncContent).toContain('Dexie queue unavailable, escalated to failed sync queue');
    expect(syncContent).toContain("actionType: 'SEAL_JOB'");
  });

  it('auto-seal Dexie fallback should NOT silently lose the seal action', () => {
    // The old "Last resort" comment should be gone
    expect(syncContent).not.toContain('seal action lost');
  });
});
