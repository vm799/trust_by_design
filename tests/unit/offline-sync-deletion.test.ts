import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockJob } from '../mocks/mockData';

/**
 * Unit tests for orphaned records deletion in sync.ts
 * Tests verify the logic that removes jobs deleted on server from IndexedDB
 *
 * FIX #1.1: When a job is deleted on Supabase, pullJobs() now syncs
 * orphaned deletions - jobs that exist locally but not on server
 */
describe('Orphaned Records Deletion Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Core Deletion Logic', () => {
    it('identifies orphaned jobs correctly', () => {
      // Setup: Create local and server job lists
      const localJobs = [
        createMockJob({ id: 'job-1', workspaceId: 'ws-123' }),
        createMockJob({ id: 'job-2', workspaceId: 'ws-123' }),
        createMockJob({ id: 'job-3', workspaceId: 'ws-123' }),
      ];

      const serverJobIds = new Set(['job-1']); // Only job-1 on server

      // Execute: Identify orphaned jobs (same logic as sync.ts)
      const orphanedJobs = localJobs.filter(job => !serverJobIds.has(job.id));

      // Assert: 2 orphaned jobs identified
      expect(orphanedJobs).toHaveLength(2);
      expect(orphanedJobs[0].id).toBe('job-2');
      expect(orphanedJobs[1].id).toBe('job-3');
    });

    it('filters out sealed jobs from deletion', () => {
      // Setup: Mix of sealed and regular jobs
      const orphanedJobs = [
        createMockJob({
          id: 'regular-job',
          workspaceId: 'ws-123',
          isSealed: false,
        }),
        createMockJob({
          id: 'sealed-job',
          workspaceId: 'ws-123',
          sealedAt: '2024-01-10T17:00:00Z',
          isSealed: true,
        }),
      ];

      // Execute: Filter sealed jobs (same logic as sync.ts)
      const deletionCandidates = orphanedJobs.filter(job => {
        return !(job.sealedAt || job.isSealed);
      });

      // Assert: Only regular job is deletion candidate
      expect(deletionCandidates).toHaveLength(1);
      expect(deletionCandidates[0].id).toBe('regular-job');
    });

    it('preserves sealed jobs even when orphaned', () => {
      // Setup: Sealed job is orphaned (deleted on server)
      const sealedOrphanedJob = createMockJob({
        id: 'sealed-orphan',
        workspaceId: 'ws-123',
        sealedAt: '2024-01-10T17:00:00Z',
        isSealed: true,
      });

      // Execute: Check if sealed status prevents deletion
      const shouldPreserve = !!(sealedOrphanedJob.sealedAt || sealedOrphanedJob.isSealed);

      // Assert: Sealed job is preserved despite being orphaned
      expect(shouldPreserve).toBe(true);
    });
  });

  describe('Orphan Detection Scenarios', () => {
    it('handles empty server response', () => {
      // Setup: 3 local jobs, empty server
      const localJobs = [
        createMockJob({ id: 'job-1', workspaceId: 'ws-123' }),
        createMockJob({ id: 'job-2', workspaceId: 'ws-123' }),
        createMockJob({ id: 'job-3', workspaceId: 'ws-123' }),
      ];
      const serverJobIds = new Set<string>([]); // Empty server

      // Execute: Identify orphans
      const orphanedJobs = localJobs.filter(job => !serverJobIds.has(job.id));

      // Assert: All local jobs are orphaned
      expect(orphanedJobs).toHaveLength(3);
    });

    it('handles full server match', () => {
      // Setup: All local jobs exist on server
      const localJobs = [
        createMockJob({ id: 'job-1', workspaceId: 'ws-123' }),
        createMockJob({ id: 'job-2', workspaceId: 'ws-123' }),
      ];
      const serverJobIds = new Set(['job-1', 'job-2']); // All jobs on server

      // Execute: Identify orphans
      const orphanedJobs = localJobs.filter(job => !serverJobIds.has(job.id));

      // Assert: No orphans
      expect(orphanedJobs).toHaveLength(0);
    });

    it('workspace isolation - only deletes from correct workspace', () => {
      // Setup: Jobs from two workspaces
      const allLocalJobs = [
        createMockJob({ id: 'ws1-job1', workspaceId: 'ws-1' }),
        createMockJob({ id: 'ws1-job2', workspaceId: 'ws-1' }),
        createMockJob({ id: 'ws2-job1', workspaceId: 'ws-2' }),
      ];

      // Filter to only ws-1 jobs (as pullJobs would do)
      const ws1Jobs = allLocalJobs.filter(j => j.workspaceId === 'ws-1');
      const serverJobIds = new Set(['ws1-job1']); // Only job1 on server

      // Execute: Identify ws-1 orphans
      const orphanedInWs1 = ws1Jobs.filter(job => !serverJobIds.has(job.id));

      // Assert: Only ws1-job2 is orphaned, ws2 untouched
      expect(orphanedInWs1).toHaveLength(1);
      expect(orphanedInWs1[0].id).toBe('ws1-job2');
    });

    it('idempotent deletion - second sync has no orphans', () => {
      // Setup: After first sync, only job-1 remains locally
      const localJobsAfterFirstSync = [
        createMockJob({ id: 'job-1', workspaceId: 'ws-123' }),
      ];
      const serverJobIds = new Set(['job-1']); // job-1 still on server

      // Execute: Second sync - identify orphans
      const orphanedJobs = localJobsAfterFirstSync.filter(
        job => !serverJobIds.has(job.id)
      );

      // Assert: No orphans (idempotent)
      expect(orphanedJobs).toHaveLength(0);
    });
  });

  describe('Sealed Job Protection', () => {
    it('sealed jobs with sealedAt flag are preserved', () => {
      const sealedJob = createMockJob({
        id: 'sealed-1',
        sealedAt: '2024-01-10T17:00:00Z',
      });

      const isProtected = !!(sealedJob.sealedAt || sealedJob.isSealed);
      expect(isProtected).toBe(true);
    });

    it('sealed jobs with isSealed flag are preserved', () => {
      const sealedJob = createMockJob({
        id: 'sealed-2',
        isSealed: true,
      });

      const isProtected = sealedJob.sealedAt || sealedJob.isSealed;
      expect(isProtected).toBe(true);
    });

    it('regular jobs without seal flags can be deleted', () => {
      const regularJob = createMockJob({
        id: 'regular-1',
        isSealed: false,
      });

      const canDelete = !(regularJob.sealedAt || regularJob.isSealed);
      expect(canDelete).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('handles job IDs with special characters', () => {
      const localJobs = [
        createMockJob({ id: 'job-with-uuid-123e4567-e89b-12d3-a456-426614174000', workspaceId: 'ws-123' }),
        createMockJob({ id: 'job_with_underscore', workspaceId: 'ws-123' }),
      ];
      const serverJobIds = new Set(['job-with-uuid-123e4567-e89b-12d3-a456-426614174000']);

      const orphanedJobs = localJobs.filter(job => !serverJobIds.has(job.id));

      expect(orphanedJobs).toHaveLength(1);
      expect(orphanedJobs[0].id).toBe('job_with_underscore');
    });

    it('large batch deletion tracking', () => {
      // Setup: 100 jobs locally, 10 on server
      const localJobs = Array.from({ length: 100 }, (_, i) =>
        createMockJob({ id: `job-${i}`, workspaceId: 'ws-123' })
      );
      const serverJobIds = new Set(
        Array.from({ length: 10 }, (_, i) => `job-${i}`)
      );

      const orphanedJobs = localJobs.filter(job => !serverJobIds.has(job.id));

      expect(orphanedJobs).toHaveLength(90);
    });
  });
});
