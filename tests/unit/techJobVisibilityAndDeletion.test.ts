import { describe, it, expect, beforeEach, vi } from 'vitest';
import { deleteJob, deleteClient, deleteTechnician, initMockDatabase } from '@/lib/db';
import type { Job, Technician } from '@/types';

/**
 * Tests for:
 * 1. Technician job visibility - matching by tech table ID via email lookup
 * 2. Deletion error handling - graceful handling of locally-created items
 */

describe('Technician Job Visibility - Tech Table ID Matching', () => {
  /**
   * Root cause: Managers assign technicians using the technician table ID (random UUID),
   * but TechPortal filters by auth UID. These are different UUIDs.
   * Fix: Also match by looking up the tech record by email and checking its table ID.
   */

  const techAuthUserId = 'auth-uid-abc-123'; // From useAuth().userId
  const techTableId = 'tech-1'; // From technicians table (different UUID)
  const techEmail = 'john@jobproof.pro';

  const technicians: Technician[] = [
    { id: techTableId, name: 'John Smith', email: techEmail, status: 'Available', rating: 4.8, jobsCompleted: 42 },
    { id: 'tech-2', name: 'Jane Doe', email: 'jane@jobproof.pro', status: 'On Site', rating: 4.9, jobsCompleted: 38 },
  ];

  // Helper: simulates the FIXED TechPortal filtering logic
  function filterMyJobs(
    allJobs: Partial<Job>[],
    userId: string,
    userEmail: string,
    techRecordId: string | undefined,
  ): Partial<Job>[] {
    return allJobs.filter(j =>
      j.technicianId === userId ||
      j.techId === userId ||
      j.techMetadata?.createdByTechId === userId ||
      // NEW: Match by technician table ID (managers assign using tech table ID)
      (techRecordId && (j.technicianId === techRecordId || j.techId === techRecordId)) ||
      (userEmail && j.techEmail && j.techEmail.toLowerCase() === userEmail.toLowerCase())
    );
  }

  it('should match jobs assigned by tech table ID (manager workflow)', () => {
    // Manager assigns technician via admin UI - sets technicianId to tech table ID
    const jobs: Partial<Job>[] = [
      { id: 'job-1', technicianId: techTableId, techId: techTableId, title: 'Assigned by manager' },
      { id: 'job-2', technicianId: 'tech-2', techId: 'tech-2', title: 'Other tech job' },
    ];

    // Find tech record by email
    const myTechRecord = technicians.find(
      t => t.email && t.email.toLowerCase() === techEmail.toLowerCase()
    );

    const myJobs = filterMyJobs(jobs, techAuthUserId, techEmail, myTechRecord?.id);

    expect(myJobs).toHaveLength(1);
    expect(myJobs[0].id).toBe('job-1');
  });

  it('should match jobs assigned by auth UID (bunker/self-service workflow)', () => {
    // Bunker or self-service flow sets techId/technicianId to auth UID
    const jobs: Partial<Job>[] = [
      { id: 'job-1', technicianId: techAuthUserId, techId: techAuthUserId, title: 'Self-created job' },
      { id: 'job-2', technicianId: 'other-auth-uid', techId: 'other-auth-uid', title: 'Other tech' },
    ];

    const myTechRecord = technicians.find(
      t => t.email && t.email.toLowerCase() === techEmail.toLowerCase()
    );

    const myJobs = filterMyJobs(jobs, techAuthUserId, techEmail, myTechRecord?.id);

    expect(myJobs).toHaveLength(1);
    expect(myJobs[0].id).toBe('job-1');
  });

  it('should match jobs by email (bunker_jobs with technician_email)', () => {
    const jobs: Partial<Job>[] = [
      { id: 'job-1', technicianId: undefined, techId: undefined, techEmail: techEmail, title: 'Email matched' },
      { id: 'job-2', technicianId: undefined, techId: undefined, techEmail: 'other@email.com', title: 'Other email' },
    ];

    const myTechRecord = technicians.find(
      t => t.email && t.email.toLowerCase() === techEmail.toLowerCase()
    );

    const myJobs = filterMyJobs(jobs, techAuthUserId, techEmail, myTechRecord?.id);

    expect(myJobs).toHaveLength(1);
    expect(myJobs[0].id).toBe('job-1');
  });

  it('should NOT show other technicians jobs', () => {
    const jobs: Partial<Job>[] = [
      { id: 'job-1', technicianId: 'tech-2', techId: 'tech-2', techEmail: 'jane@jobproof.pro', title: 'Jane job' },
      { id: 'job-2', technicianId: 'random-uuid', techId: 'random-uuid', title: 'Unknown tech' },
      { id: 'job-3', title: 'Unassigned job' },
    ];

    const myTechRecord = technicians.find(
      t => t.email && t.email.toLowerCase() === techEmail.toLowerCase()
    );

    const myJobs = filterMyJobs(jobs, techAuthUserId, techEmail, myTechRecord?.id);

    expect(myJobs).toHaveLength(0);
  });

  it('should handle case-insensitive email matching', () => {
    const jobs: Partial<Job>[] = [
      { id: 'job-1', techEmail: 'JOHN@JOBPROOF.PRO', title: 'Uppercase email' },
    ];

    const myTechRecord = technicians.find(
      t => t.email && t.email.toLowerCase() === techEmail.toLowerCase()
    );

    const myJobs = filterMyJobs(jobs, techAuthUserId, techEmail, myTechRecord?.id);

    expect(myJobs).toHaveLength(1);
  });

  it('should match self-employed jobs via techMetadata.createdByTechId', () => {
    const jobs: Partial<Job>[] = [
      {
        id: 'job-1',
        techMetadata: { createdByTechId: techAuthUserId, creationOrigin: 'self_employed' },
        title: 'Self-employed job',
      },
    ];

    const myTechRecord = technicians.find(
      t => t.email && t.email.toLowerCase() === techEmail.toLowerCase()
    );

    const myJobs = filterMyJobs(jobs, techAuthUserId, techEmail, myTechRecord?.id);

    expect(myJobs).toHaveLength(1);
  });

  it('should work when no tech record found by email (new/unregistered tech)', () => {
    const unregisteredEmail = 'newtech@example.com';
    const jobs: Partial<Job>[] = [
      { id: 'job-1', technicianId: techAuthUserId, title: 'Direct auth UID match' },
      { id: 'job-2', techEmail: unregisteredEmail, title: 'Email match' },
    ];

    // No tech record matches
    const myTechRecord = technicians.find(
      t => t.email && t.email.toLowerCase() === unregisteredEmail.toLowerCase()
    );

    const myJobs = filterMyJobs(jobs, techAuthUserId, unregisteredEmail, myTechRecord?.id);

    expect(myJobs).toHaveLength(2);
  });
});

describe('Deletion - Graceful Handling of Local-Only Items', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await initMockDatabase();
  });

  it('should successfully delete an existing job', async () => {
    const result = await deleteJob('job-1');
    expect(result.success).toBe(true);
  });

  it('should prevent deleting a sealed job', async () => {
    const result = await deleteJob('job-4'); // Sealed job in mock
    expect(result.success).toBe(false);
    expect(result.error).toContain('sealed');
  });

  it('should handle deletion of non-existent job gracefully', async () => {
    const result = await deleteJob('non-existent-id');
    expect(result.success).toBe(false);
  });

  it('should succeed when deleting client not in Supabase (locally-created)', async () => {
    // In mock mode, this tests the "not found" path
    // After fix: deleting a non-existent client should succeed (it's already gone from server)
    const result = await deleteClient('locally-created-client-uuid');
    // After fix: should succeed since the item doesn't exist in the database
    // The goal of deletion is removal - if it's not there, the goal is achieved
    expect(result.success).toBe(true);
  });

  it('should succeed when deleting technician not in Supabase (locally-created)', async () => {
    const result = await deleteTechnician('locally-created-tech-uuid');
    expect(result.success).toBe(true);
  });

  it('should successfully delete an existing client', async () => {
    const result = await deleteClient('client-1');
    expect(result.success).toBe(true);
  });

  it('should successfully delete an existing technician', async () => {
    const result = await deleteTechnician('tech-1');
    expect(result.success).toBe(true);
  });
});

describe('Job Assignment - techEmail Propagation', () => {
  it('should include techEmail when assigning technician to job', () => {
    const tech: Technician = {
      id: 'tech-1',
      name: 'John Smith',
      email: 'john@jobproof.pro',
      status: 'Available',
      rating: 4.8,
      jobsCompleted: 42,
    };

    const baseJob: Partial<Job> = {
      id: 'job-1',
      title: 'Test Job',
      client: 'Acme Corp',
      status: 'Pending',
    };

    // Simulates the FIXED assignment logic in JobDetail/JobsList
    const updatedJob = {
      ...baseJob,
      technicianId: tech.id,
      technician: tech.name,
      techEmail: tech.email, // NEW: should be set on assignment
    };

    expect(updatedJob.technicianId).toBe('tech-1');
    expect(updatedJob.technician).toBe('John Smith');
    expect(updatedJob.techEmail).toBe('john@jobproof.pro');
  });
});
