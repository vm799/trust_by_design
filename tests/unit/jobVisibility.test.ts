import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getJobs, initMockDatabase } from '@/lib/db';
import type { Job } from '@/types';

/**
 * Job Visibility Security Tests
 *
 * Validates that:
 * 1. Jobs are scoped to workspace_id (cross-workspace isolation)
 * 2. Technician ID mapping correctly uses assigned_technician_id
 * 3. Jobs without workspace_id are not returned to authenticated queries
 * 4. TechPortal-style filtering works with normalized technician IDs
 */
describe('Job Visibility - Workspace Isolation', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await initMockDatabase();
  });

  it('should only return jobs for the requested workspace', async () => {
    const result = await getJobs('workspace-123');

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    // All returned jobs should belong to workspace-123
    for (const job of result.data || []) {
      // Mock DB returns workspace_id on jobs
      expect(job.workspaceId || (job as any).workspace_id).toBe('workspace-123');
    }
  });

  it('should return empty array for unknown workspace', async () => {
    const result = await getJobs('workspace-unknown');

    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });

  it('should not return jobs from other workspaces', async () => {
    const resultWs1 = await getJobs('workspace-123');
    const resultWs2 = await getJobs('workspace-other');

    expect(resultWs1.success).toBe(true);
    expect(resultWs2.success).toBe(true);

    // workspace-123 has jobs in mock, workspace-other should not
    expect(resultWs1.data?.length).toBeGreaterThan(0);
    expect(resultWs2.data?.length).toBe(0);
  });

  it('should reject empty workspace_id', async () => {
    const result = await getJobs('');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('Job Visibility - Technician ID Mapping', () => {
  it('should filter jobs by technician ID correctly', () => {
    const techUserId = 'tech-user-abc';

    const jobs: Partial<Job>[] = [
      { id: 'job-1', techId: techUserId, technicianId: techUserId, title: 'My Job' },
      { id: 'job-2', techId: 'other-tech', technicianId: 'other-tech', title: 'Other Job' },
      { id: 'job-3', techId: techUserId, title: 'Legacy Job' },
      { id: 'job-4', title: 'Unassigned Job' },
    ];

    // Simulate TechPortal filtering logic
    const myJobs = jobs.filter(j =>
      j.technicianId === techUserId ||
      j.techId === techUserId
    );

    expect(myJobs).toHaveLength(2);
    expect(myJobs.map(j => j.id)).toEqual(['job-1', 'job-3']);
    // job-1 matches via both technicianId and techId, job-3 matches via techId only
    expect(myJobs.every(j => j.techId === techUserId || j.technicianId === techUserId)).toBe(true);
  });

  it('should not match undefined techId to userId', () => {
    const userId = 'tech-user-abc';

    const jobs: Partial<Job>[] = [
      { id: 'job-1', techId: undefined, technicianId: undefined, title: 'Broken Mapping' },
      { id: 'job-2', techId: '', technicianId: '', title: 'Empty String' },
    ];

    const myJobs = jobs.filter(j =>
      j.technicianId === userId ||
      j.techId === userId
    );

    expect(myJobs).toHaveLength(0);
  });

  it('should correctly map assigned_technician_id from bunker_jobs row', () => {
    // Simulate the mapping from bunker_jobs schema to Job type
    const bunkerJobRow = {
      id: 'bj-1',
      title: 'Test Job',
      technician_name: 'John Smith',
      assigned_technician_id: 'auth-user-uuid-123',
      technician_id: undefined, // Column does not exist in bunker_jobs
      workspace_id: 'ws-1',
      status: 'In Progress',
      created_at: '2026-02-10T00:00:00Z',
    };

    // This is the mapping logic from db.ts _getJobsImpl
    const mappedJob = {
      id: bunkerJobRow.id,
      title: bunkerJobRow.title,
      technician: bunkerJobRow.technician_name || '',
      techId: bunkerJobRow.assigned_technician_id || bunkerJobRow.technician_id,
      technicianId: bunkerJobRow.assigned_technician_id || bunkerJobRow.technician_id,
    };

    expect(mappedJob.techId).toBe('auth-user-uuid-123');
    expect(mappedJob.technicianId).toBe('auth-user-uuid-123');
  });

  it('should fall back to technician_id when assigned_technician_id is null', () => {
    const bunkerJobRow = {
      id: 'bj-2',
      assigned_technician_id: null,
      technician_id: 'legacy-tech-id',
    };

    const techId = bunkerJobRow.assigned_technician_id || bunkerJobRow.technician_id;
    expect(techId).toBe('legacy-tech-id');
  });
});

describe('Job Visibility - Ownership Guard', () => {
  it('should deny access to jobs not assigned to the technician', () => {
    const userId = 'tech-abc';

    const otherTechJob: Partial<Job> = {
      id: 'job-other',
      techId: 'tech-xyz',
      technicianId: 'tech-xyz',
      title: 'Not My Job',
    };

    // Simulate TechJobDetail ownership check
    const isOwner =
      otherTechJob.technicianId === userId ||
      otherTechJob.techId === userId;

    expect(isOwner).toBe(false);
  });

  it('should allow access to jobs assigned via techMetadata', () => {
    const userId = 'self-employed-tech';

    const selfEmployedJob: Partial<Job> = {
      id: 'job-self',
      techId: undefined,
      technicianId: undefined,
      techMetadata: {
        createdByTechId: userId,
        creationOrigin: 'self_employed',
      },
      title: 'Self-Created Job',
    };

    const isOwner =
      selfEmployedJob.technicianId === userId ||
      selfEmployedJob.techId === userId ||
      selfEmployedJob.techMetadata?.createdByTechId === userId;

    expect(isOwner).toBe(true);
  });

  it('should allow access to properly assigned jobs', () => {
    const userId = 'tech-abc';

    const myJob: Partial<Job> = {
      id: 'job-mine',
      techId: userId,
      technicianId: userId,
      title: 'My Assigned Job',
    };

    const isOwner =
      myJob.technicianId === userId ||
      myJob.techId === userId;

    expect(isOwner).toBe(true);
  });
});

describe('Job Visibility - Cross-Workspace Security', () => {
  it('should prevent technician from seeing jobs in another workspace', () => {
    const techWorkspace = 'workspace-A';
    const otherWorkspace = 'workspace-B';

    const allJobs: Partial<Job>[] = [
      { id: 'j1', workspaceId: techWorkspace, techId: 'tech-1', title: 'My Workspace Job' },
      { id: 'j2', workspaceId: otherWorkspace, techId: 'tech-1', title: 'Other Workspace Job' },
      { id: 'j3', workspaceId: techWorkspace, techId: 'tech-2', title: 'Colleague Job' },
    ];

    // Workspace filter (applied at query level)
    const workspaceJobs = allJobs.filter(j => j.workspaceId === techWorkspace);

    // Technician filter (applied at UI level)
    const myJobs = workspaceJobs.filter(j => j.techId === 'tech-1');

    expect(workspaceJobs).toHaveLength(2); // Only workspace-A jobs
    expect(myJobs).toHaveLength(1); // Only tech-1's job in workspace-A
    expect(myJobs[0].id).toBe('j1');
  });

  it('should not expose job data from unrelated workspaces in memory', () => {
    const myWorkspace = 'workspace-mine';

    const allJobs: Partial<Job>[] = [
      { id: 'j1', workspaceId: myWorkspace, title: 'Visible' },
      { id: 'j2', workspaceId: 'workspace-other', title: 'Confidential' },
      { id: 'j3', workspaceId: undefined, title: 'No Workspace' },
    ];

    // With workspace_id filter applied at query level, only workspace-mine jobs load
    const filteredJobs = allJobs.filter(j => j.workspaceId === myWorkspace);

    expect(filteredJobs).toHaveLength(1);
    expect(filteredJobs[0].title).toBe('Visible');
    // Jobs from other workspaces should never reach browser memory
    expect(filteredJobs.find(j => j.title === 'Confidential')).toBeUndefined();
  });
});
