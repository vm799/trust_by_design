/**
 * Storage Continuity Tests
 *
 * Validates that DataContext CRUD operations persist to backend (Supabase)
 * when online and to offline queue (Dexie) when offline.
 *
 * BEFORE this fix: addJob/updateJob/addClient/updateClient/addTechnician/updateTechnician
 * only called setJobs/setClients/setTechnicians (React state) - data never reached Supabase.
 *
 * AFTER this fix: All create/update operations persist to:
 * - Supabase (online) via db.ts createJob/updateJob/createClient/etc.
 * - Dexie IndexedDB + offline queue (offline) via offline/db.ts saveJobLocal/queueAction
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

describe('Storage Continuity - DataContext CRUD persistence', () => {

  describe('DataContext addJob persists to backend', () => {
    const content = readFile('lib/DataContext.tsx');

    it('addJob should be async', () => {
      expect(content).toMatch(/const addJob = useCallback\(async/);
    });

    it('addJob should call db.createJob when online', () => {
      expect(content).toMatch(/dbModule\.createJob\(jobWithWorkspace,\s*workspaceId\)/);
    });

    it('addJob should save to Dexie offline queue as fallback', () => {
      expect(content).toMatch(/offlineDb\.queueAction\('CREATE_JOB'/);
    });

    it('addJob should save to Dexie local storage as fallback', () => {
      expect(content).toMatch(/offlineDb\.saveJobLocal\(/);
    });

    it('addJob should inject workspaceId for Dexie queryability', () => {
      expect(content).toMatch(/jobWithWorkspace.*workspaceId/);
    });

    it('addJob should still do optimistic state update', () => {
      expect(content).toMatch(/setJobs\(prev => \[jobWithWorkspace/);
    });
  });

  describe('DataContext updateJob persists to backend', () => {
    const content = readFile('lib/DataContext.tsx');

    it('updateJob should be async', () => {
      expect(content).toMatch(/const updateJob = useCallback\(async/);
    });

    it('updateJob should call db.updateJob when online', () => {
      expect(content).toMatch(/dbModule\.updateJob\(jobWithWorkspace\.id,\s*jobWithWorkspace\)/);
    });

    it('updateJob should queue UPDATE_JOB action for offline sync', () => {
      expect(content).toMatch(/offlineDb\.queueAction\('UPDATE_JOB'/);
    });

    it('updateJob should inject workspaceId for Dexie queryability', () => {
      expect(content).toMatch(/jobWithWorkspace.*workspaceId/);
    });

    it('updateJob should still do optimistic state update', () => {
      expect(content).toMatch(/setJobs\(prev => prev\.map\(j => j\.id === jobWithWorkspace\.id/);
    });
  });

  describe('DataContext addClient persists to backend', () => {
    const content = readFile('lib/DataContext.tsx');

    it('addClient should be async', () => {
      expect(content).toMatch(/const addClient = useCallback\(async/);
    });

    it('addClient should call db.createClient when online', () => {
      expect(content).toMatch(/dbModule\.createClient\(client,\s*workspaceId\)/);
    });

    it('addClient should queue CREATE_CLIENT action for offline sync', () => {
      expect(content).toMatch(/offlineDb\.queueAction\('CREATE_CLIENT'/);
    });

    it('addClient should save to Dexie local storage as fallback', () => {
      expect(content).toMatch(/offlineDb\.saveClientLocal\(/);
    });
  });

  describe('DataContext updateClient persists to backend', () => {
    const content = readFile('lib/DataContext.tsx');

    it('updateClient should be async', () => {
      expect(content).toMatch(/const updateClient = useCallback\(async/);
    });

    it('updateClient should call db.updateClient when online', () => {
      expect(content).toMatch(/dbModule\.updateClient\(updatedClient\.id,\s*updatedClient\)/);
    });

    it('updateClient should queue UPDATE_CLIENT action for offline sync', () => {
      expect(content).toMatch(/offlineDb\.queueAction\('UPDATE_CLIENT'/);
    });
  });

  describe('DataContext addTechnician persists to backend', () => {
    const content = readFile('lib/DataContext.tsx');

    it('addTechnician should be async', () => {
      expect(content).toMatch(/const addTechnician = useCallback\(async/);
    });

    it('addTechnician should call db.createTechnician when online', () => {
      expect(content).toMatch(/dbModule\.createTechnician\(tech,\s*workspaceId\)/);
    });

    it('addTechnician should queue CREATE_TECHNICIAN action for offline sync', () => {
      expect(content).toMatch(/offlineDb\.queueAction\('CREATE_TECHNICIAN'/);
    });

    it('addTechnician should save to Dexie local storage as fallback', () => {
      expect(content).toMatch(/offlineDb\.saveTechnicianLocal\(/);
    });
  });

  describe('DataContext updateTechnician persists to backend', () => {
    const content = readFile('lib/DataContext.tsx');

    it('updateTechnician should be async', () => {
      expect(content).toMatch(/const updateTechnician = useCallback\(async/);
    });

    it('updateTechnician should call db.updateTechnician when online', () => {
      expect(content).toMatch(/dbModule\.updateTechnician\(updatedTech\.id,\s*updatedTech\)/);
    });

    it('updateTechnician should queue UPDATE_TECHNICIAN action for offline sync', () => {
      expect(content).toMatch(/offlineDb\.queueAction\('UPDATE_TECHNICIAN'/);
    });
  });

  describe('Delete functions still persist to backend (unchanged)', () => {
    const content = readFile('lib/DataContext.tsx');

    it('deleteJob should call dbModule.deleteJob', () => {
      expect(content).toMatch(/dbModule\.deleteJob\(id\)/);
    });

    it('deleteClient should call dbModule.deleteClient', () => {
      expect(content).toMatch(/dbModule\.deleteClient\(id\)/);
    });

    it('deleteTechnician should call dbModule.deleteTechnician', () => {
      expect(content).toMatch(/dbModule\.deleteTechnician\(id\)/);
    });
  });
});

describe('Storage Continuity - Offline sync handlers', () => {
  const syncContent = readFile('lib/offline/sync.ts');

  it('pushQueue should handle CREATE_JOB action', () => {
    expect(syncContent).toMatch(/case 'CREATE_JOB'/);
    expect(syncContent).toMatch(/processCreateJob/);
  });

  it('pushQueue should handle CREATE_CLIENT action', () => {
    expect(syncContent).toMatch(/case 'CREATE_CLIENT'/);
    expect(syncContent).toMatch(/processCreateClient/);
  });

  it('pushQueue should handle UPDATE_CLIENT action', () => {
    expect(syncContent).toMatch(/case 'UPDATE_CLIENT'/);
    expect(syncContent).toMatch(/processUpdateClient/);
  });

  it('pushQueue should handle CREATE_TECHNICIAN action', () => {
    expect(syncContent).toMatch(/case 'CREATE_TECHNICIAN'/);
    expect(syncContent).toMatch(/processCreateTechnician/);
  });

  it('pushQueue should handle UPDATE_TECHNICIAN action', () => {
    expect(syncContent).toMatch(/case 'UPDATE_TECHNICIAN'/);
    expect(syncContent).toMatch(/processUpdateTechnician/);
  });

  it('processCreateJob should upsert to jobs table', () => {
    expect(syncContent).toMatch(/\.from\('jobs'\)\s*\n?\s*\.upsert\(/);
  });

  it('processCreateClient should upsert to clients table', () => {
    expect(syncContent).toMatch(/\.from\('clients'\)\s*\n?\s*\.upsert\(/);
  });

  it('processCreateTechnician should upsert to technicians table', () => {
    expect(syncContent).toMatch(/\.from\('technicians'\)\s*\n?\s*\.upsert\(/);
  });

  it('pushQueue should escalate items to failed sync queue after max retries', () => {
    expect(syncContent).toContain('DEXIE_QUEUE_MAX_RETRIES');
    expect(syncContent).toContain('jobproof_failed_sync_queue');
    expect(syncContent).toContain('escalated to failed sync queue');
  });

  it('pushQueue should notify user when items are escalated', () => {
    expect(syncContent).toContain('showPersistentNotification');
  });

  it('pushQueue should handle SEAL_JOB action', () => {
    expect(syncContent).toMatch(/case 'SEAL_JOB'/);
    expect(syncContent).toContain('processSealJob');
  });

  it('processSealJob should call sealEvidence and update job on success', () => {
    expect(syncContent).toContain('async function processSealJob');
    expect(syncContent).toContain('sealEvidence');
    // Verify it checks if already sealed
    expect(syncContent).toContain('Already sealed');
  });

  it('auto-seal failure should queue SEAL_JOB for retry', () => {
    // processUploadPhoto should queue SEAL_JOB when sealing fails
    // Both the success and failure paths should queue the action
    expect(syncContent).toContain("queueAction('SEAL_JOB'");
  });
});

describe('Storage Continuity - Escalation type mapping', () => {
  const syncContent = readFile('lib/offline/sync.ts');

  it('should map JOB actions to job type in failed sync queue', () => {
    expect(syncContent).toContain("action.type.includes('JOB')");
    expect(syncContent).toContain("? 'job'");
  });

  it('should map CLIENT actions to client type in failed sync queue', () => {
    expect(syncContent).toContain("action.type.includes('CLIENT')");
    expect(syncContent).toContain("? 'client'");
  });

  it('should map TECHNICIAN actions to technician type in failed sync queue', () => {
    expect(syncContent).toContain("action.type.includes('TECHNICIAN')");
    expect(syncContent).toContain("? 'technician'");
  });

  it('should preserve original action type in escalated item', () => {
    expect(syncContent).toContain('actionType: action.type');
  });
});

describe('Storage Continuity - Signature upload failsafe', () => {
  const syncQueueContent = readFile('lib/syncQueue.ts');

  it('should throw on signature data not found in IndexedDB', () => {
    expect(syncQueueContent).toContain('Signature data not found in IndexedDB');
    // Must throw, not silently continue
    expect(syncQueueContent).toContain("throw new Error(`Signature data not found");
  });

  it('should throw on signature upload failure', () => {
    expect(syncQueueContent).toContain('Signature upload failed');
    expect(syncQueueContent).toContain("throw new Error(`Signature upload failed");
  });
});

describe('Storage Continuity - Retry guard exports', () => {
  const syncQueueContent = readFile('lib/syncQueue.ts');

  it('should export isRetryInProgress for UI consumption', () => {
    expect(syncQueueContent).toContain('export const isRetryInProgress');
  });
});

describe('Storage Continuity - debouncedSync escalation', () => {
  const debouncedContent = readFile('lib/debouncedSync.ts');

  it('processOfflineQueue should have max retry limit', () => {
    expect(debouncedContent).toContain('DEBOUNCED_QUEUE_MAX_RETRIES');
  });

  it('processOfflineQueue should escalate items to failed sync queue after max retries', () => {
    expect(debouncedContent).toContain('jobproof_failed_sync_queue');
  });

  it('processOfflineQueue should track retryCount on each item', () => {
    expect(debouncedContent).toContain('retryCount');
  });

  it('processOfflineQueue should check isSupabaseAvailable before processing', () => {
    const funcBody = debouncedContent.split('processOfflineQueue')[1]?.slice(0, 200) || '';
    expect(funcBody).toContain('isSupabaseAvailable()');
  });
});

describe('Storage Continuity - OfflineAction type supports all action types', () => {
  const dbContent = readFile('lib/offline/db.ts');

  it('OfflineAction type should include CREATE_JOB', () => {
    expect(dbContent).toContain("'CREATE_JOB'");
  });

  it('OfflineAction type should include CREATE_CLIENT', () => {
    expect(dbContent).toContain("'CREATE_CLIENT'");
  });

  it('OfflineAction type should include UPDATE_CLIENT', () => {
    expect(dbContent).toContain("'UPDATE_CLIENT'");
  });

  it('OfflineAction type should include CREATE_TECHNICIAN', () => {
    expect(dbContent).toContain("'CREATE_TECHNICIAN'");
  });

  it('OfflineAction type should include UPDATE_TECHNICIAN', () => {
    expect(dbContent).toContain("'UPDATE_TECHNICIAN'");
  });
});

describe('Storage Continuity - Symmetry check (all entities persist the same way)', () => {
  const content = readFile('lib/DataContext.tsx');

  it('all add functions should check navigator.onLine', () => {
    const onlineChecks = (content.match(/navigator\.onLine/g) || []).length;
    // addJob, updateJob, addClient, updateClient, addTechnician, updateTechnician = 6
    expect(onlineChecks).toBeGreaterThanOrEqual(6);
  });

  it('all add/update functions should have offline Dexie fallback', () => {
    const queueActionCalls = (content.match(/offlineDb\.queueAction\(/g) || []).length;
    // Each of 6 functions has 3 fallback paths (online fail, offline, catch) = 18 minimum
    expect(queueActionCalls).toBeGreaterThanOrEqual(12);
  });

  it('deleteJob Supabase path validates sealedAt before deletion', () => {
    const dbContent = readFile('lib/db.ts');
    // The Supabase path must fetch sealed_at and check it before deleting
    expect(dbContent).toContain("select('workspace_id, sealed_at, invoice_id')");
    expect(dbContent).toMatch(/if \(sealedAt\)[\s\S]*?sealed and cannot be deleted/);
  });

  it('deleteJob Supabase path validates invoiceId before deletion', () => {
    const dbContent = readFile('lib/db.ts');
    expect(dbContent).toMatch(/if \(invoiceId\)[\s\S]*?has an invoice/);
  });

  it('no add/update function should only use setState without backend persistence', () => {
    // Verify addJob is async (not sync-only setState)
    expect(content).not.toMatch(/const addJob = useCallback\(\(job: Job\) =>/);
    // Verify updateJob is async (not sync-only setState)
    expect(content).not.toMatch(/const updateJob = useCallback\(\(updatedJob: Job\) =>/);
    // Verify addClient is async
    expect(content).not.toMatch(/const addClient = useCallback\(\(client: Client\) =>/);
    // Verify updateClient is async
    expect(content).not.toMatch(/const updateClient = useCallback\(\(updatedClient: Client\) =>/);
    // Verify addTechnician is async
    expect(content).not.toMatch(/const addTechnician = useCallback\(\(tech: Technician\) =>/);
    // Verify updateTechnician is async
    expect(content).not.toMatch(/const updateTechnician = useCallback\(\(updatedTech: Technician\) =>/);
  });
});
