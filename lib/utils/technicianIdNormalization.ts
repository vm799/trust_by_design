/**
 * Technician ID Normalization Utility
 *
 * REMEDIATION: Sprint 2 Task 2.6 - Enterprise Data Consistency
 *
 * Problem: Three different technician ID fields causing data fragmentation:
 *   1. job.techId (legacy, always set)
 *   2. job.technicianId (alias, sometimes set)
 *   3. job.techMetadata.createdByTechId (self-employed mode)
 *
 * Solution: Normalize on read to ensure consistent data flow.
 * This is Phase 1 of the hybrid migration (client-side normalization).
 * Phase 2 (server-side SQL cleanup) can be deferred to maintenance window.
 *
 * Key Properties:
 * - Idempotent: Safe to run multiple times
 * - Offline-safe: No network calls required
 * - Non-destructive: Original fields preserved for backwards compatibility
 *
 * @author Claude Code - Enterprise Data Consistency
 */

import type { Job } from '../../types';

/**
 * Normalized technician assignment result
 */
export interface NormalizedTechnicianAssignment {
  /** The resolved technician ID (single source of truth) */
  assignedTechnicianId: string | null;
  /** Technician display name if available */
  assignedTechnicianName: string | null;
  /** Whether this is a self-employed job (technician = creator) */
  isSelfEmployed: boolean;
  /** Source of the technician ID for debugging */
  source: 'techId' | 'technicianId' | 'techMetadata' | 'none';
}

/**
 * Resolve the canonical technician ID from a job's fragmented fields.
 *
 * Priority order (highest to lowest):
 * 1. technicianId (explicit assignment, preferred field)
 * 2. techId (legacy field, always present)
 * 3. techMetadata.createdByTechId (self-employed mode fallback)
 *
 * @param job - The job to normalize
 * @returns Normalized technician assignment
 */
export function resolveTechnicianId(job: Job): NormalizedTechnicianAssignment {
  // Check for self-employed mode first (special case)
  const isSelfEmployed = job.selfEmployedMode === true ||
    job.techMetadata?.creationOrigin === 'self_employed';

  // Priority 1: technicianId (explicit assignment)
  if (job.technicianId && job.technicianId.trim() !== '') {
    return {
      assignedTechnicianId: job.technicianId,
      assignedTechnicianName: job.technician || null,
      isSelfEmployed,
      source: 'technicianId',
    };
  }

  // Priority 2: techId (legacy field)
  if (job.techId && job.techId.trim() !== '') {
    return {
      assignedTechnicianId: job.techId,
      assignedTechnicianName: job.technician || null,
      isSelfEmployed,
      source: 'techId',
    };
  }

  // Priority 3: techMetadata.createdByTechId (self-employed fallback)
  if (job.techMetadata?.createdByTechId && job.techMetadata.createdByTechId.trim() !== '') {
    return {
      assignedTechnicianId: job.techMetadata.createdByTechId,
      assignedTechnicianName: job.techMetadata.createdByTechName || job.technician || null,
      isSelfEmployed: true, // If using this field, definitely self-employed
      source: 'techMetadata',
    };
  }

  // No technician assigned
  return {
    assignedTechnicianId: null,
    assignedTechnicianName: null,
    isSelfEmployed,
    source: 'none',
  };
}

/**
 * Normalize a job's technician ID fields to ensure consistency.
 * This function ensures all three fields have the same value.
 *
 * Call this:
 * - On load from IndexedDB
 * - On load from Supabase
 * - Before sync to cloud
 *
 * @param job - The job to normalize
 * @returns Job with normalized technician IDs (new object, original unchanged)
 */
export function normalizeJobTechnicianId(job: Job): Job {
  const resolved = resolveTechnicianId(job);

  // If no technician assigned, return job as-is
  if (!resolved.assignedTechnicianId) {
    return job;
  }

  // Create normalized job with consistent IDs
  const normalizedJob: Job = {
    ...job,
    techId: resolved.assignedTechnicianId,
    technicianId: resolved.assignedTechnicianId,
    technician: resolved.assignedTechnicianName || job.technician,
  };

  // Also update techMetadata if present
  if (normalizedJob.techMetadata && resolved.isSelfEmployed) {
    normalizedJob.techMetadata = {
      ...normalizedJob.techMetadata,
      createdByTechId: resolved.assignedTechnicianId,
    };
  }

  return normalizedJob;
}

/**
 * Normalize an array of jobs for consistent technician IDs.
 * Use this when loading jobs from storage.
 *
 * @param jobs - Array of jobs to normalize
 * @returns Array of normalized jobs
 */
export function normalizeJobs(jobs: Job[]): Job[] {
  return jobs.map(normalizeJobTechnicianId);
}

/**
 * Check if a job has consistent technician ID fields.
 * Useful for diagnostics and migration validation.
 *
 * @param job - The job to check
 * @returns true if all technician ID fields are consistent
 */
export function isJobTechnicianIdConsistent(job: Job): boolean {
  const resolved = resolveTechnicianId(job);

  // No technician = consistent (no fields to compare)
  if (!resolved.assignedTechnicianId) {
    return true;
  }

  const techId = job.techId || '';
  const technicianId = job.technicianId || '';

  // Both fields should match the resolved ID (if they exist)
  const techIdMatch = techId === '' || techId === resolved.assignedTechnicianId;
  const technicianIdMatch = technicianId === '' || technicianId === resolved.assignedTechnicianId;

  return techIdMatch && technicianIdMatch;
}

/**
 * Get diagnostic info about technician ID fragmentation.
 * Useful for debugging and migration progress tracking.
 *
 * @param jobs - Array of jobs to analyze
 * @returns Diagnostic summary
 */
export function diagnoseTechnicianIdFragmentation(jobs: Job[]): {
  total: number;
  consistent: number;
  inconsistent: number;
  noTechnician: number;
  sourceBreakdown: Record<string, number>;
} {
  const result = {
    total: jobs.length,
    consistent: 0,
    inconsistent: 0,
    noTechnician: 0,
    sourceBreakdown: {
      technicianId: 0,
      techId: 0,
      techMetadata: 0,
      none: 0,
    } as Record<string, number>,
  };

  for (const job of jobs) {
    const resolved = resolveTechnicianId(job);
    result.sourceBreakdown[resolved.source]++;

    if (resolved.source === 'none') {
      result.noTechnician++;
    } else if (isJobTechnicianIdConsistent(job)) {
      result.consistent++;
    } else {
      result.inconsistent++;
    }
  }

  return result;
}

/**
 * Create a normalized sync payload for a job.
 * Ensures the job sent to Supabase has consistent technician IDs.
 *
 * @param job - The job to prepare for sync
 * @returns Job ready for cloud sync with normalized IDs
 */
export function prepareJobForSync(job: Job): Job {
  return normalizeJobTechnicianId(job);
}
