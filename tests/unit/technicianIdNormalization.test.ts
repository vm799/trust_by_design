/**
 * Tests for Technician ID Normalization Utility
 *
 * Sprint 2 Task 2.6: Enterprise Data Consistency
 */

import { describe, it, expect } from 'vitest';
import {
  resolveTechnicianId,
  normalizeJobTechnicianId,
  normalizeJobs,
  isJobTechnicianIdConsistent,
  diagnoseTechnicianIdFragmentation,
  prepareJobForSync,
} from '../../lib/utils/technicianIdNormalization';
import type { Job } from '../../types';

// Factory for creating test jobs with minimal required fields
function createTestJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job_test_123',
    title: 'Test Job',
    client: 'Test Client',
    clientId: 'client_123',
    technician: 'Test Tech',
    techId: '',
    status: 'Pending',
    date: '2026-02-01',
    address: '123 Test St',
    notes: '',
    photos: [],
    signature: null,
    safetyChecklist: [],
    syncStatus: 'pending',
    lastUpdated: Date.now(),
    ...overrides,
  };
}

describe('resolveTechnicianId', () => {
  it('returns technicianId when set (priority 1)', () => {
    const job = createTestJob({
      techId: 'tech_legacy',
      technicianId: 'tech_explicit',
    });

    const result = resolveTechnicianId(job);

    expect(result.assignedTechnicianId).toBe('tech_explicit');
    expect(result.source).toBe('technicianId');
  });

  it('returns techId when technicianId not set (priority 2)', () => {
    const job = createTestJob({
      techId: 'tech_legacy',
      technicianId: undefined,
    });

    const result = resolveTechnicianId(job);

    expect(result.assignedTechnicianId).toBe('tech_legacy');
    expect(result.source).toBe('techId');
  });

  it('returns techMetadata.createdByTechId when others not set (priority 3)', () => {
    const job = createTestJob({
      techId: '',
      technicianId: undefined,
      techMetadata: {
        creationOrigin: 'self_employed',
        createdByTechId: 'tech_self',
        createdByTechName: 'Self Employed Tech',
      },
    });

    const result = resolveTechnicianId(job);

    expect(result.assignedTechnicianId).toBe('tech_self');
    expect(result.source).toBe('techMetadata');
    expect(result.isSelfEmployed).toBe(true);
  });

  it('returns null when no technician assigned', () => {
    const job = createTestJob({
      techId: '',
      technicianId: undefined,
      techMetadata: undefined,
    });

    const result = resolveTechnicianId(job);

    expect(result.assignedTechnicianId).toBeNull();
    expect(result.source).toBe('none');
  });

  it('ignores empty string technicianId', () => {
    const job = createTestJob({
      techId: 'tech_legacy',
      technicianId: '',
    });

    const result = resolveTechnicianId(job);

    expect(result.assignedTechnicianId).toBe('tech_legacy');
    expect(result.source).toBe('techId');
  });

  it('ignores whitespace-only technicianId', () => {
    const job = createTestJob({
      techId: 'tech_legacy',
      technicianId: '   ',
    });

    const result = resolveTechnicianId(job);

    expect(result.assignedTechnicianId).toBe('tech_legacy');
    expect(result.source).toBe('techId');
  });

  it('detects selfEmployedMode flag', () => {
    const job = createTestJob({
      techId: 'tech_123',
      selfEmployedMode: true,
    });

    const result = resolveTechnicianId(job);

    expect(result.isSelfEmployed).toBe(true);
  });

  it('detects self_employed creationOrigin', () => {
    const job = createTestJob({
      techId: 'tech_123',
      techMetadata: {
        creationOrigin: 'self_employed',
      },
    });

    const result = resolveTechnicianId(job);

    expect(result.isSelfEmployed).toBe(true);
  });
});

describe('normalizeJobTechnicianId', () => {
  it('normalizes all fields to technicianId value', () => {
    const job = createTestJob({
      techId: 'tech_old',
      technicianId: 'tech_new',
    });

    const normalized = normalizeJobTechnicianId(job);

    expect(normalized.techId).toBe('tech_new');
    expect(normalized.technicianId).toBe('tech_new');
  });

  it('normalizes all fields to techId when technicianId not set', () => {
    const job = createTestJob({
      techId: 'tech_legacy',
      technicianId: undefined,
    });

    const normalized = normalizeJobTechnicianId(job);

    expect(normalized.techId).toBe('tech_legacy');
    expect(normalized.technicianId).toBe('tech_legacy');
  });

  it('does not mutate original job', () => {
    const job = createTestJob({
      techId: 'tech_old',
      technicianId: 'tech_new',
    });

    normalizeJobTechnicianId(job);

    expect(job.techId).toBe('tech_old');
  });

  it('returns job as-is when no technician assigned', () => {
    const job = createTestJob({
      techId: '',
      technicianId: undefined,
    });

    const normalized = normalizeJobTechnicianId(job);

    expect(normalized).toEqual(job);
  });

  it('updates techMetadata.createdByTechId for self-employed jobs', () => {
    const job = createTestJob({
      techId: '',
      technicianId: 'tech_self',
      selfEmployedMode: true,
      techMetadata: {
        creationOrigin: 'self_employed',
        createdByTechId: 'tech_old',
      },
    });

    const normalized = normalizeJobTechnicianId(job);

    expect(normalized.techMetadata?.createdByTechId).toBe('tech_self');
  });

  it('is idempotent - running twice produces same result', () => {
    const job = createTestJob({
      techId: 'tech_old',
      technicianId: 'tech_new',
    });

    const normalized1 = normalizeJobTechnicianId(job);
    const normalized2 = normalizeJobTechnicianId(normalized1);

    expect(normalized2).toEqual(normalized1);
  });
});

describe('normalizeJobs', () => {
  it('normalizes all jobs in array', () => {
    const jobs = [
      createTestJob({ id: 'job_1', techId: 'tech_1', technicianId: 'tech_1_new' }),
      createTestJob({ id: 'job_2', techId: 'tech_2', technicianId: undefined }),
      createTestJob({ id: 'job_3', techId: '', technicianId: undefined }),
    ];

    const normalized = normalizeJobs(jobs);

    expect(normalized[0].techId).toBe('tech_1_new');
    expect(normalized[1].technicianId).toBe('tech_2');
    expect(normalized[2].techId).toBe('');
  });

  it('returns new array without mutating original', () => {
    const jobs = [createTestJob({ techId: 'tech_1', technicianId: 'tech_new' })];

    const normalized = normalizeJobs(jobs);

    expect(normalized).not.toBe(jobs);
    expect(jobs[0].techId).toBe('tech_1');
  });
});

describe('isJobTechnicianIdConsistent', () => {
  it('returns true when all fields match', () => {
    const job = createTestJob({
      techId: 'tech_123',
      technicianId: 'tech_123',
    });

    expect(isJobTechnicianIdConsistent(job)).toBe(true);
  });

  it('returns false when fields mismatch', () => {
    const job = createTestJob({
      techId: 'tech_old',
      technicianId: 'tech_new',
    });

    expect(isJobTechnicianIdConsistent(job)).toBe(false);
  });

  it('returns true when technicianId not set', () => {
    const job = createTestJob({
      techId: 'tech_123',
      technicianId: undefined,
    });

    expect(isJobTechnicianIdConsistent(job)).toBe(true);
  });

  it('returns true when no technician assigned', () => {
    const job = createTestJob({
      techId: '',
      technicianId: undefined,
    });

    expect(isJobTechnicianIdConsistent(job)).toBe(true);
  });
});

describe('diagnoseTechnicianIdFragmentation', () => {
  it('provides accurate breakdown of technician ID sources', () => {
    const jobs = [
      createTestJob({ id: '1', techId: 'a', technicianId: 'a' }),  // consistent, source: technicianId
      createTestJob({ id: '2', techId: 'b', technicianId: undefined }),  // consistent, source: techId
      createTestJob({ id: '3', techId: 'old', technicianId: 'new' }),  // inconsistent
      createTestJob({ id: '4', techId: '', technicianId: undefined }),  // no technician
    ];

    const diagnosis = diagnoseTechnicianIdFragmentation(jobs);

    expect(diagnosis.total).toBe(4);
    expect(diagnosis.consistent).toBe(2);
    expect(diagnosis.inconsistent).toBe(1);
    expect(diagnosis.noTechnician).toBe(1);
    expect(diagnosis.sourceBreakdown.technicianId).toBe(2); // jobs 1 and 3
    expect(diagnosis.sourceBreakdown.techId).toBe(1); // job 2
    expect(diagnosis.sourceBreakdown.none).toBe(1); // job 4
  });

  it('handles empty array', () => {
    const diagnosis = diagnoseTechnicianIdFragmentation([]);

    expect(diagnosis.total).toBe(0);
    expect(diagnosis.consistent).toBe(0);
    expect(diagnosis.inconsistent).toBe(0);
  });
});

describe('prepareJobForSync', () => {
  it('returns normalized job for cloud sync', () => {
    const job = createTestJob({
      techId: 'tech_old',
      technicianId: 'tech_new',
    });

    const syncJob = prepareJobForSync(job);

    expect(syncJob.techId).toBe('tech_new');
    expect(syncJob.technicianId).toBe('tech_new');
  });

  it('preserves all other job fields', () => {
    const job = createTestJob({
      techId: 'tech_old',
      technicianId: 'tech_new',
      title: 'Important Job',
      status: 'In Progress',
      notes: 'Some notes',
    });

    const syncJob = prepareJobForSync(job);

    expect(syncJob.title).toBe('Important Job');
    expect(syncJob.status).toBe('In Progress');
    expect(syncJob.notes).toBe('Some notes');
  });
});
