import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createJob, getJobs, updateJob, deleteJob, generateMagicLink, validateMagicLink, initMockDatabase } from '@/lib/db';
import type { Job } from '@/types';

describe('lib/db - Database Operations', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Initialize mock database for tests
    await initMockDatabase();
  });

  describe('createJob', () => {
    it('should create a new job successfully', async () => {
      const jobData: Partial<Job> = {
        title: 'New HVAC Installation',
        client: 'Acme Corp',
        clientId: 'client-1',
        technician: 'John Smith',
        techId: 'tech-1',
        address: '123 Business St',
        date: '2024-01-20',
        notes: 'Install new system',
        workspaceId: 'workspace-123',
      };

      const result = await createJob(jobData, 'workspace-123');

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('id');
      expect(result.data?.title).toBe('New HVAC Installation');
      expect(result.data?.status).toBe('Pending'); // Default status
      expect(result.data?.workspaceId).toBe('workspace-123');
    });

    it('should return error when workspace_id is missing', async () => {
      const jobData: Partial<Job> = {
        title: 'Test Job',
        client: 'Test Client',
        // Missing workspace_id
      };

      const result = await createJob(jobData, '');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should initialize job with default values', async () => {
      const jobData: Partial<Job> = {
        title: 'Test Job',
        workspaceId: 'workspace-123',
      };

      const result = await createJob(jobData, 'workspace-123');

      expect(result.success).toBe(true);
      expect(result.data?.syncStatus).toBe('synced');
      expect(result.data?.photos).toEqual([]);
      expect(result.data?.safetyChecklist).toBeDefined();
    });
  });

  describe('getJobs', () => {
    it('should retrieve jobs for a workspace', async () => {
      const result = await getJobs('workspace-123');

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data?.length).toBeGreaterThan(0);
      expect(result.data?.[0]).toHaveProperty('workspace_id');
    });

    it('should return empty array when workspace has no jobs', async () => {
      const result = await getJobs('empty-workspace');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should return error when workspace_id is not provided', async () => {
      const result = await getJobs('');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('updateJob', () => {
    it('should update a job successfully', async () => {
      const updates: Partial<Job> = {
        status: 'In Progress',
        workSummary: 'Started work on site',
      };

      const result = await updateJob('job-1', updates);

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('In Progress');
      expect(result.data?.workSummary).toBe('Started work on site');
    });

    it('should prevent updating a sealed job', async () => {
      const updates: Partial<Job> = {
        status: 'In Progress',
      };

      const result = await updateJob('job-4', updates); // job-4 is sealed

      expect(result.success).toBe(false);
      expect(result.error).toContain('sealed');
    });

    it('should update job timestamp on modification', async () => {
      const beforeUpdate = Date.now();

      const result = await updateJob('job-1', { notes: 'Updated notes' });

      expect(result.success).toBe(true);
      expect(result.data?.lastUpdated).toBeGreaterThanOrEqual(beforeUpdate);
    });
  });

  describe('deleteJob', () => {
    it('should delete a job successfully', async () => {
      const result = await deleteJob('job-1');

      expect(result.success).toBe(true);
    });

    it('should return error when job not found', async () => {
      const result = await deleteJob('non-existent-job');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should prevent deleting a sealed job', async () => {
      const result = await deleteJob('job-4'); // Sealed job

      expect(result.success).toBe(false);
      expect(result.error).toContain('sealed');
    });
  });

  describe('Magic Link System', () => {
    describe('generateMagicLink', () => {
      it('should generate a valid magic link token with validated handshake URL', async () => {
        // deliveryEmail is now required for validated handshake URLs
        const result = await generateMagicLink('job-1', 'manager@test.com');

        expect(result.success).toBe(true);
        expect(result.data).toHaveProperty('token');
        expect(result.data).toHaveProperty('url');
        expect(result.data).toHaveProperty('expiresAt');
        // URL now uses /go/:accessCode pattern instead of /technician/:token
        expect(result.data?.url).toContain('/#/go/');
      });

      it('should generate token with 7-day expiry', async () => {
        const result = await generateMagicLink('job-1', 'manager@test.com');
        const expiresAt = new Date(result.data!.expiresAt);
        const now = new Date();
        const daysDiff = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

        expect(daysDiff).toBeGreaterThan(6.9);
        expect(daysDiff).toBeLessThan(7.1);
      });

      it('should return error when job does not exist', async () => {
        const result = await generateMagicLink('non-existent-job', 'manager@test.com');

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should return error when deliveryEmail is not provided', async () => {
        // @ts-expect-error - Testing missing required parameter
        const result = await generateMagicLink('job-1');

        expect(result.success).toBe(false);
        expect(result.error).toContain('Valid deliveryEmail with @');
      });
    });

    describe('validateMagicLink', () => {
      it('should validate a valid token', async () => {
        const result = await validateMagicLink('mock-token-123');

        expect(result.success).toBe(true);
        expect(result.data).toHaveProperty('job_id');
        expect(result.data).toHaveProperty('workspace_id');
        expect(result.data?.is_valid).toBe(true);
      });

      it('should reject an expired token', async () => {
        const result = await validateMagicLink('expired-token');

        expect(result.success).toBe(false);
        expect(result.error).toContain('expired');
      });

      it('should reject an invalid token', async () => {
        const result = await validateMagicLink('invalid-token');

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should reject token for sealed job', async () => {
        // Assuming token for job-4 (sealed)
        const result = await validateMagicLink('sealed-job-token');

        expect(result.success).toBe(false);
        expect(result.error).toContain('sealed');
      });
    });
  });
});
