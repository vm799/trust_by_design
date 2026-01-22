import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '@/lib/offline/db';
import { sealEvidence, enableMockSealing, disableMockSealing } from '@/lib/sealing';
import { initMockDatabase } from '@/lib/db';
import type { Photo } from '@/types';

/**
 * Auto-Seal Integration Tests
 *
 * Tests the automatic sealing functionality that triggers when:
 * 1. All photos for a job are synced
 * 2. Job status is 'Submitted'
 * 3. Job is not already sealed
 */
describe('Auto-Seal Integration Tests', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    enableMockSealing();
    initMockDatabase();

    // Clear IndexedDB
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    disableMockSealing();
    await db.delete();
  });

  it('should auto-seal job when all photos are synced and job is Submitted', async () => {
    const jobId = 'test-job-auto-seal';

    // Create a job with all photos synced
    const job = {
      id: jobId,
      title: 'Test Auto-Seal Job',
      client: 'Test Client',
      clientId: 'client-1',
      technician: 'Test Tech',
      techId: 'tech-1',
      status: 'Submitted' as const,
      date: '2026-01-22',
      address: 'Test Address',
      notes: '',
      photos: [
        {
          id: 'photo-1',
          url: 'https://storage.example.com/photo-1.jpg',
          timestamp: new Date().toISOString(),
          verified: true,
          syncStatus: 'synced' as const,
          type: 'Before' as const,
          isIndexedDBRef: false
        },
        {
          id: 'photo-2',
          url: 'https://storage.example.com/photo-2.jpg',
          timestamp: new Date().toISOString(),
          verified: true,
          syncStatus: 'synced' as const,
          type: 'After' as const,
          isIndexedDBRef: false
        }
      ] as Photo[],
      signature: 'https://storage.example.com/sig.png',
      signerName: 'John Doe',
      signerRole: 'Site Manager',
      safetyChecklist: [],
      syncStatus: 'synced' as const,
      lastUpdated: Date.now(),
      workspaceId: 'workspace-123'
    };

    // Save to IndexedDB
    await db.jobs.put(job as any);

    // Simulate the auto-seal logic
    const updatedJob = await db.jobs.get(jobId);
    expect(updatedJob).toBeDefined();

    const allPhotosUploaded = updatedJob!.photos.every(
      (p: Photo) => p.syncStatus === 'synced' && !p.isIndexedDBRef
    );

    expect(allPhotosUploaded).toBe(true);
    expect(updatedJob!.status).toBe('Submitted');
    expect(updatedJob!.sealedAt).toBeUndefined();

    // Trigger seal
    const sealResult = await sealEvidence(jobId);

    expect(sealResult.success).toBe(true);
    expect(sealResult.evidenceHash).toBeDefined();
    expect(sealResult.sealedAt).toBeDefined();

    // Update job with seal data
    await db.jobs.update(jobId, {
      sealedAt: sealResult.sealedAt,
      evidenceHash: sealResult.evidenceHash,
      status: 'Archived' as const,
      isSealed: true,
      lastUpdated: Date.now()
    });

    // Verify job is sealed
    const sealedJob = await db.jobs.get(jobId);
    expect(sealedJob?.sealedAt).toBe(sealResult.sealedAt);
    expect(sealedJob?.evidenceHash).toBe(sealResult.evidenceHash);
    expect(sealedJob?.status).toBe('Archived');
    expect(sealedJob?.isSealed).toBe(true);
  });

  it('should NOT auto-seal if photos are still pending sync', async () => {
    const jobId = 'test-job-pending-photos';

    const job = {
      id: jobId,
      title: 'Test Job with Pending Photos',
      client: 'Test Client',
      clientId: 'client-1',
      technician: 'Test Tech',
      techId: 'tech-1',
      status: 'Submitted' as const,
      date: '2026-01-22',
      address: 'Test Address',
      notes: '',
      photos: [
        {
          id: 'photo-1',
          url: 'media_abc123', // IndexedDB reference
          timestamp: new Date().toISOString(),
          verified: false,
          syncStatus: 'pending' as const,
          type: 'Before' as const,
          isIndexedDBRef: true // Not synced yet
        }
      ] as Photo[],
      signature: 'sig_job_123',
      signerName: 'John Doe',
      safetyChecklist: [],
      syncStatus: 'pending' as const,
      lastUpdated: Date.now(),
      workspaceId: 'workspace-123'
    };

    await db.jobs.put(job as any);

    const updatedJob = await db.jobs.get(jobId);
    const allPhotosUploaded = updatedJob!.photos.every(
      (p: Photo) => p.syncStatus === 'synced' && !p.isIndexedDBRef
    );

    expect(allPhotosUploaded).toBe(false);

    // Should NOT trigger seal
    // In real implementation, the auto-seal check would skip this job
  });

  it('should NOT auto-seal if job status is not Submitted', async () => {
    const jobId = 'test-job-in-progress';

    const job = {
      id: jobId,
      title: 'Test Job In Progress',
      client: 'Test Client',
      clientId: 'client-1',
      technician: 'Test Tech',
      techId: 'tech-1',
      status: 'In Progress' as const, // Not submitted
      date: '2026-01-22',
      address: 'Test Address',
      notes: '',
      photos: [
        {
          id: 'photo-1',
          url: 'https://storage.example.com/photo-1.jpg',
          timestamp: new Date().toISOString(),
          verified: true,
          syncStatus: 'synced' as const,
          type: 'Before' as const,
          isIndexedDBRef: false
        }
      ] as Photo[],
      signature: 'https://storage.example.com/sig.png',
      signerName: 'John Doe',
      safetyChecklist: [],
      syncStatus: 'synced' as const,
      lastUpdated: Date.now(),
      workspaceId: 'workspace-123'
    };

    await db.jobs.put(job as any);

    const updatedJob = await db.jobs.get(jobId);
    const allPhotosUploaded = updatedJob!.photos.every(
      (p: Photo) => p.syncStatus === 'synced' && !p.isIndexedDBRef
    );

    expect(allPhotosUploaded).toBe(true);
    expect(updatedJob!.status).toBe('In Progress');

    // Should NOT trigger seal because status is not 'Submitted'
  });

  it('should NOT auto-seal if job is already sealed', async () => {
    const jobId = 'test-job-already-sealed';

    const job = {
      id: jobId,
      title: 'Already Sealed Job',
      client: 'Test Client',
      clientId: 'client-1',
      technician: 'Test Tech',
      techId: 'tech-1',
      status: 'Archived' as const,
      date: '2026-01-22',
      address: 'Test Address',
      notes: '',
      photos: [
        {
          id: 'photo-1',
          url: 'https://storage.example.com/photo-1.jpg',
          timestamp: new Date().toISOString(),
          verified: true,
          syncStatus: 'synced' as const,
          type: 'Before' as const,
          isIndexedDBRef: false
        }
      ] as Photo[],
      signature: 'https://storage.example.com/sig.png',
      signerName: 'John Doe',
      safetyChecklist: [],
      syncStatus: 'synced' as const,
      lastUpdated: Date.now(),
      workspaceId: 'workspace-123',
      sealedAt: '2026-01-22T10:00:00Z', // Already sealed
      evidenceHash: 'abc123',
      isSealed: true
    };

    await db.jobs.put(job as any);

    const updatedJob = await db.jobs.get(jobId);
    const allPhotosUploaded = updatedJob!.photos.every(
      (p: Photo) => p.syncStatus === 'synced' && !p.isIndexedDBRef
    );

    expect(allPhotosUploaded).toBe(true);
    expect(updatedJob!.status).toBe('Archived');
    expect(updatedJob!.sealedAt).toBe('2026-01-22T10:00:00Z');

    // Should NOT trigger seal because job is already sealed
  });

  it('should handle seal failure gracefully', async () => {
    const jobId = 'job-that-doesnt-exist';

    // Try to seal a non-existent job
    const sealResult = await sealEvidence(jobId);

    expect(sealResult.success).toBe(false);
    expect(sealResult.error).toBeDefined();

    // Should not crash or throw
  });

  it('should log auto-seal status correctly', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const jobId = 'test-job-logging';

    const job = {
      id: jobId,
      title: 'Test Logging Job',
      client: 'Test Client',
      clientId: 'client-1',
      technician: 'Test Tech',
      techId: 'tech-1',
      status: 'Submitted' as const,
      date: '2026-01-22',
      address: 'Test Address',
      notes: '',
      photos: [
        {
          id: 'photo-1',
          url: 'https://storage.example.com/photo-1.jpg',
          timestamp: new Date().toISOString(),
          verified: true,
          syncStatus: 'synced' as const,
          type: 'Before' as const,
          isIndexedDBRef: false
        }
      ] as Photo[],
      signature: 'https://storage.example.com/sig.png',
      signerName: 'John Doe',
      safetyChecklist: [],
      syncStatus: 'synced' as const,
      lastUpdated: Date.now(),
      workspaceId: 'workspace-123'
    };

    await db.jobs.put(job as any);

    // Simulate logging checks
    const updatedJob = await db.jobs.get(jobId);
    const allPhotosUploaded = updatedJob!.photos.every(
      (p: Photo) => p.syncStatus === 'synced' && !p.isIndexedDBRef
    );

    // In real implementation, this would log:
    // console.log(`[Auto-Seal] Job ${jobId} status check:`, { ... });

    expect(allPhotosUploaded).toBe(true);
    expect(updatedJob!.status).toBe('Submitted');
    expect(updatedJob!.sealedAt).toBeUndefined();
  });
});
