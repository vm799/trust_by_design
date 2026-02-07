import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { scheduleArchive } from '@/lib/offline/archive';
import { getDatabase, _resetDbInstance } from '@/lib/offline/db';
import { createMockJob } from '../mocks/mockData';
import type { Job } from '@/types';

describe('Fix 3.1: Auto-Archive Sealed Jobs >180 Days', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    _resetDbInstance();
  });

  afterEach(async () => {
    _resetDbInstance();
  });

  it('should archive sealed jobs older than 180 days', async () => {
    const db = await getDatabase();
    const now = new Date();
    const sealed181DaysAgo = new Date(now.getTime() - 181 * 24 * 60 * 60 * 1000);

    // Create a sealed job older than 180 days
    const job: Job = createMockJob({
      id: 'job-archived-1',
      status: 'Submitted', // Sealed status
      sealedAt: sealed181DaysAgo.toISOString(),
      isSealed: true,
      isArchived: false,
      workspaceId: 'test-workspace',
      lastUpdated: sealed181DaysAgo.getTime(),
    });

    // Save to IndexedDB
    await db.jobs.put({
      ...job,
      syncStatus: 'synced',
      lastUpdated: sealed181DaysAgo.getTime(),
    } as any);

    // Run archive function
    const archived = await scheduleArchive(db);

    // Verify job was archived
    expect(archived.length).toBe(1);
    expect(archived[0].id).toBe('job-archived-1');

    // Verify database was updated
    const updatedJob = await db.jobs.get('job-archived-1');
    expect(updatedJob?.status).toBe('Archived');
    expect(updatedJob?.isArchived).toBe(true);
    expect(updatedJob?.archivedAt).toBeDefined();
  });

  it('should NOT archive sealed jobs under 180 days', async () => {
    const db = await getDatabase();
    const now = new Date();
    const sealed179DaysAgo = new Date(now.getTime() - 179 * 24 * 60 * 60 * 1000);

    // Create a sealed job under 180 days old
    const job: Job = createMockJob({
      id: 'job-sealed-1',
      status: 'Submitted',
      sealedAt: sealed179DaysAgo.toISOString(),
      isSealed: true,
      isArchived: false,
      workspaceId: 'test-workspace',
      lastUpdated: sealed179DaysAgo.getTime(),
    });

    // Save to IndexedDB
    await db.jobs.put({
      ...job,
      syncStatus: 'synced',
      lastUpdated: sealed179DaysAgo.getTime(),
    } as any);

    // Run archive function
    const archived = await scheduleArchive(db);

    // Verify job was NOT archived
    expect(archived.length).toBe(0);

    // Verify database remains unchanged
    const unchangedJob = await db.jobs.get('job-sealed-1');
    expect(unchangedJob?.status).toBe('Submitted');
    expect(unchangedJob?.isArchived).toBe(false);
    expect(unchangedJob?.archivedAt).toBeUndefined();
  });

  it('should archive multiple sealed jobs older than 180 days', async () => {
    const db = await getDatabase();
    const now = new Date();
    const sealed181DaysAgo = new Date(now.getTime() - 181 * 24 * 60 * 60 * 1000);
    const sealed200DaysAgo = new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000);

    // Create multiple sealed jobs older than 180 days
    const job1: Job = createMockJob({
      id: 'job-archived-1',
      status: 'Submitted',
      sealedAt: sealed181DaysAgo.toISOString(),
      isSealed: true,
      isArchived: false,
      workspaceId: 'test-workspace',
      lastUpdated: sealed181DaysAgo.getTime(),
    });

    const job2: Job = createMockJob({
      id: 'job-archived-2',
      status: 'Submitted',
      sealedAt: sealed200DaysAgo.toISOString(),
      isSealed: true,
      isArchived: false,
      workspaceId: 'test-workspace',
      lastUpdated: sealed200DaysAgo.getTime(),
    });

    // Save to IndexedDB
    await db.jobs.put({
      ...job1,
      syncStatus: 'synced',
      lastUpdated: sealed181DaysAgo.getTime(),
    } as any);
    await db.jobs.put({
      ...job2,
      syncStatus: 'synced',
      lastUpdated: sealed200DaysAgo.getTime(),
    } as any);

    // Run archive function
    const archived = await scheduleArchive(db);

    // Verify both jobs were archived
    expect(archived.length).toBe(2);
    expect(archived.map(j => j.id).sort()).toEqual(['job-archived-1', 'job-archived-2'].sort());

    // Verify database was updated
    const job1Updated = await db.jobs.get('job-archived-1');
    const job2Updated = await db.jobs.get('job-archived-2');

    expect(job1Updated?.status).toBe('Archived');
    expect(job1Updated?.isArchived).toBe(true);
    expect(job1Updated?.archivedAt).toBeDefined();

    expect(job2Updated?.status).toBe('Archived');
    expect(job2Updated?.isArchived).toBe(true);
    expect(job2Updated?.archivedAt).toBeDefined();
  });

  it('should preserve evidence (photos and signature) when archiving', async () => {
    const db = await getDatabase();
    const now = new Date();
    const sealed181DaysAgo = new Date(now.getTime() - 181 * 24 * 60 * 60 * 1000);

    // Create a sealed job with photos and signature
    const job: Job = createMockJob({
      id: 'job-with-evidence',
      status: 'Submitted',
      sealedAt: sealed181DaysAgo.toISOString(),
      isSealed: true,
      isArchived: false,
      photos: [
        {
          id: 'photo-1',
          url: 'https://example.com/photo1.jpg',
          timestamp: sealed181DaysAgo.toISOString(),
          verified: true,
          syncStatus: 'synced',
          type: 'before',
        },
        {
          id: 'photo-2',
          url: 'https://example.com/photo2.jpg',
          timestamp: sealed181DaysAgo.toISOString(),
          verified: true,
          syncStatus: 'synced',
          type: 'after',
        },
      ],
      signature: 'https://example.com/signature.png',
      signerName: 'John Doe',
      workspaceId: 'test-workspace',
      lastUpdated: sealed181DaysAgo.getTime(),
    });

    // Save to IndexedDB
    await db.jobs.put({
      ...job,
      syncStatus: 'synced',
      lastUpdated: sealed181DaysAgo.getTime(),
    } as any);

    // Run archive function
    const archived = await scheduleArchive(db);

    // Verify job was archived
    expect(archived.length).toBe(1);

    // Verify evidence is still present
    const archivedJob = await db.jobs.get('job-with-evidence');
    expect(archivedJob?.photos.length).toBe(2);
    expect(archivedJob?.signature).toBe('https://example.com/signature.png');
    expect(archivedJob?.signerName).toBe('John Doe');
    expect(archivedJob?.status).toBe('Archived');
  });

  it('should NOT archive non-sealed jobs regardless of age', async () => {
    const db = await getDatabase();
    const now = new Date();
    const oldDate = new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000);

    // Create an old job that is NOT sealed
    const job: Job = createMockJob({
      id: 'job-old-not-sealed',
      status: 'In Progress',
      sealedAt: undefined,
      isSealed: false,
      isArchived: false,
      workspaceId: 'test-workspace',
      date: oldDate.toISOString().split('T')[0],
      lastUpdated: oldDate.getTime(),
    });

    // Save to IndexedDB
    await db.jobs.put({
      ...job,
      syncStatus: 'synced',
      lastUpdated: oldDate.getTime(),
    } as any);

    // Run archive function
    const archived = await scheduleArchive(db);

    // Verify job was NOT archived
    expect(archived.length).toBe(0);

    // Verify database remains unchanged
    const unchangedJob = await db.jobs.get('job-old-not-sealed');
    expect(unchangedJob?.status).toBe('In Progress');
    expect(unchangedJob?.isArchived).toBe(false);
  });

  it('should handle mixed sealed and non-sealed jobs', async () => {
    const db = await getDatabase();
    const now = new Date();
    const sealed181DaysAgo = new Date(now.getTime() - 181 * 24 * 60 * 60 * 1000);

    // Create a sealed job older than 180 days
    const sealedJob: Job = createMockJob({
      id: 'job-sealed-old',
      status: 'Submitted',
      sealedAt: sealed181DaysAgo.toISOString(),
      isSealed: true,
      isArchived: false,
      workspaceId: 'test-workspace',
      lastUpdated: sealed181DaysAgo.getTime(),
    });

    // Create an old non-sealed job
    const unsealedJob: Job = createMockJob({
      id: 'job-unsealed-old',
      status: 'In Progress',
      sealedAt: undefined,
      isSealed: false,
      isArchived: false,
      workspaceId: 'test-workspace',
      lastUpdated: sealed181DaysAgo.getTime(),
    });

    // Create a recent sealed job
    const sealedJobRecent: Job = createMockJob({
      id: 'job-sealed-recent',
      status: 'Submitted',
      sealedAt: new Date().toISOString(),
      isSealed: true,
      isArchived: false,
      workspaceId: 'test-workspace',
      lastUpdated: Date.now(),
    });

    // Save all to IndexedDB
    await db.jobs.put({
      ...sealedJob,
      syncStatus: 'synced',
      lastUpdated: sealed181DaysAgo.getTime(),
    } as any);
    await db.jobs.put({
      ...unsealedJob,
      syncStatus: 'synced',
      lastUpdated: sealed181DaysAgo.getTime(),
    } as any);
    await db.jobs.put({
      ...sealedJobRecent,
      syncStatus: 'synced',
      lastUpdated: Date.now(),
    } as any);

    // Run archive function
    const archived = await scheduleArchive(db);

    // Only the old sealed job should be archived
    expect(archived.length).toBe(1);
    expect(archived[0].id).toBe('job-sealed-old');

    // Verify correct jobs were/weren't archived
    const archivedJob = await db.jobs.get('job-sealed-old');
    const unsealedJobCheck = await db.jobs.get('job-unsealed-old');
    const recentJob = await db.jobs.get('job-sealed-recent');

    expect(archivedJob?.status).toBe('Archived');
    expect(unsealedJobCheck?.status).toBe('In Progress');
    expect(recentJob?.status).toBe('Submitted');
  });

  it('should return empty array when no jobs to archive', async () => {
    const db = await getDatabase();
    const now = new Date();

    // Create only recent sealed jobs
    const recentJob: Job = createMockJob({
      id: 'job-recent',
      status: 'Submitted',
      sealedAt: new Date().toISOString(),
      isSealed: true,
      isArchived: false,
      workspaceId: 'test-workspace',
      lastUpdated: Date.now(),
    });

    await db.jobs.put({
      ...recentJob,
      syncStatus: 'synced',
      lastUpdated: Date.now(),
    } as any);

    // Run archive function
    const archived = await scheduleArchive(db);

    // Verify no jobs were archived
    expect(archived.length).toBe(0);
  });
});
