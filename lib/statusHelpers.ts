/**
 * Status Helpers - Derived Status Functions
 *
 * Pure functions that derive status information from job state.
 * These use the canonical JOB_STATUS values from constants.ts.
 *
 * IMPORTANT: These functions derive status from existing data,
 * they do NOT introduce new status types.
 *
 * @see CLAUDE.md - "NO HARDCODED STATUSES"
 */

import type { Job, Technician } from '../types';
import { JOB_STATUS, SYNC_STATUS, isCompletedJobStatus } from './constants';

// ============================================================================
// EVIDENCE STATUS DERIVATION
// ============================================================================

/**
 * Derived evidence readiness status from job state
 */
export interface EvidenceStatus {
  /** Job has at least one photo */
  hasPhotos: boolean;
  /** Total photo count */
  photoCount: number;
  /** Job has a before photo */
  hasBeforePhoto: boolean;
  /** Job has an after photo */
  hasAfterPhoto: boolean;
  /** Job has a signature */
  hasSignature: boolean;
  /** Signature has been verified */
  signatureVerified: boolean;
  /** Signer name if available */
  signerName?: string;
  /** Location has been verified (GPS or W3W) */
  locationVerified: boolean;
  /** What3Words address if available */
  w3wAddress?: string;
  /** All photos are synced to server */
  allPhotosSynced: boolean;
  /** Evidence is ready for cryptographic sealing */
  readyForSealing: boolean;
  /** Job is ready for invoicing (sealed with signature) */
  readyForInvoicing: boolean;
}

/**
 * Derives evidence readiness status from job state
 *
 * @param job - The job to analyze
 * @returns EvidenceStatus with all derived flags
 *
 * @example
 * const status = deriveEvidenceStatus(job);
 * if (status.readyForSealing) {
 *   // Show seal button
 * }
 */
export function deriveEvidenceStatus(job: Job): EvidenceStatus {
  const photos = job.photos || [];

  const hasPhotos = photos.length > 0;
  const photoCount = photos.length;

  // Check for before photo (case-insensitive)
  const hasBeforePhoto = photos.some(
    (p) => p.type?.toLowerCase() === 'before' || !!job.beforePhoto
  );

  // Check for after photo (case-insensitive)
  const hasAfterPhoto = photos.some(
    (p) => p.type?.toLowerCase() === 'after' || !!job.afterPhoto
  );

  // Check signature
  const hasSignature = !!(job.signature || job.clientSignature);

  // Signer name from job
  const signerName = job.signerName || job.clientNameSigned;

  // Location verification
  const locationVerified = Boolean(job.locationVerified) || Boolean(job.w3w);
  const w3wAddress = job.w3w;

  // Signature verification - check hash exists or explicit verification
  const signatureVerified = !!(
    hasSignature &&
    (job.signatureHash || job.clientSignatureAt)
  );

  // All photos synced
  const allPhotosSynced =
    photos.length === 0 ||
    photos.every((p) => p.syncStatus === SYNC_STATUS.SYNCED);

  // Ready for sealing: completed status, has evidence, all synced
  const jobCompleted = isCompletedJobStatus(job.status) ||
    job.status === JOB_STATUS.COMPLETE ||
    job.status === JOB_STATUS.SUBMITTED;

  const readyForSealing =
    jobCompleted &&
    hasPhotos &&
    hasSignature &&
    allPhotosSynced &&
    !job.sealedAt; // Not already sealed

  // Ready for invoicing: completed with signature, not already invoiced
  // (Can invoice before or after sealing)
  const readyForInvoicing = !!(
    jobCompleted &&
    hasSignature &&
    !job.invoiceId // Not already invoiced
  );

  return {
    hasPhotos,
    photoCount,
    hasBeforePhoto,
    hasAfterPhoto,
    hasSignature,
    signatureVerified,
    signerName,
    locationVerified,
    w3wAddress,
    allPhotosSynced,
    readyForSealing,
    readyForInvoicing,
  };
}

// ============================================================================
// TECHNICIAN WORK STATUS DERIVATION
// ============================================================================

/**
 * Technician work status derived from their job assignments
 * - idle: No active or pending jobs
 * - active: Has in-progress job with recent activity
 * - stuck: Has in-progress job with no activity for too long
 * - completed_today: Finished jobs today, none pending
 */
export type TechWorkStatus = 'idle' | 'active' | 'stuck' | 'completed_today';

/** Default threshold for "stuck" status: 2 hours in milliseconds */
const DEFAULT_STUCK_THRESHOLD_MS = 2 * 60 * 60 * 1000;

/**
 * Derives technician work status from their assigned jobs
 *
 * @param techJobs - Array of jobs assigned to the technician
 * @param stuckThresholdMs - Time without activity to consider "stuck" (default: 2 hours)
 * @param now - Current timestamp for testing (default: Date.now())
 * @returns TechWorkStatus classification
 *
 * @example
 * const status = deriveTechWorkStatus(technicianJobs);
 * if (status === 'stuck') {
 *   // Alert manager
 * }
 */
export function deriveTechWorkStatus(
  techJobs: Job[],
  stuckThresholdMs: number = DEFAULT_STUCK_THRESHOLD_MS,
  now: number = Date.now()
): TechWorkStatus {
  if (!techJobs || techJobs.length === 0) {
    return 'idle';
  }

  // Find in-progress job
  const inProgressJob = techJobs.find(
    (j) => j.status === JOB_STATUS.IN_PROGRESS
  );

  // Find pending jobs (not completed, not in progress)
  const pendingJobs = techJobs.filter(
    (j) =>
      j.status === JOB_STATUS.PENDING ||
      j.status === JOB_STATUS.DRAFT ||
      j.status === JOB_STATUS.PAUSED
  );

  // Find jobs completed today
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();

  const completedToday = techJobs.filter((j) => {
    if (j.status !== JOB_STATUS.COMPLETE && j.status !== JOB_STATUS.SUBMITTED) {
      return false;
    }
    const completedAt = j.completedAt
      ? new Date(j.completedAt).getTime()
      : j.lastUpdated || 0;
    return completedAt >= todayStart;
  });

  // Determine status
  if (inProgressJob) {
    // Check if stuck (no activity for threshold period)
    const lastActivity = inProgressJob.lastUpdated || 0;
    const timeSinceActivity = now - lastActivity;

    if (timeSinceActivity > stuckThresholdMs) {
      return 'stuck';
    }
    return 'active';
  }

  if (pendingJobs.length > 0) {
    return 'idle'; // Has pending work but not started
  }

  if (completedToday.length > 0) {
    return 'completed_today';
  }

  return 'idle';
}

// ============================================================================
// JOB AGE CLASSIFICATION DERIVATION
// ============================================================================

/**
 * Job age classification derived from timestamps
 * - fresh: Recently created or updated
 * - aging: Getting older, may need attention
 * - stale: Old, likely needs follow-up
 * - critical: Very old, urgent attention needed
 */
export type JobAgeClass = 'fresh' | 'aging' | 'stale' | 'critical';

/**
 * Default thresholds for job age classification (in milliseconds)
 */
export interface JobAgeThresholds {
  /** Time until job is considered "aging" (default: 24 hours) */
  aging: number;
  /** Time until job is considered "stale" (default: 72 hours) */
  stale: number;
  /** Time until job is considered "critical" (default: 168 hours / 1 week) */
  critical: number;
}

const DEFAULT_AGE_THRESHOLDS: JobAgeThresholds = {
  aging: 24 * 60 * 60 * 1000, // 24 hours
  stale: 72 * 60 * 60 * 1000, // 72 hours (3 days)
  critical: 168 * 60 * 60 * 1000, // 168 hours (7 days)
};

/**
 * Derives job age classification from timestamps
 *
 * Uses the job's creation date (job.date) and status to determine
 * how old/urgent the job is. Completed/archived jobs are always "fresh"
 * since they don't need attention.
 *
 * @param job - The job to classify
 * @param thresholds - Custom thresholds (optional)
 * @param now - Current timestamp for testing (default: Date.now())
 * @returns JobAgeClass classification
 *
 * @example
 * const ageClass = deriveJobAgeClass(job);
 * if (ageClass === 'critical') {
 *   // Show urgent indicator
 * }
 */
export function deriveJobAgeClass(
  job: Job,
  thresholds: Partial<JobAgeThresholds> = {},
  now: number = Date.now()
): JobAgeClass {
  // Completed/archived/submitted jobs are always "fresh" (done, no urgency)
  if (
    job.status === JOB_STATUS.COMPLETE ||
    job.status === JOB_STATUS.SUBMITTED ||
    job.status === JOB_STATUS.ARCHIVED ||
    job.status === JOB_STATUS.CANCELLED
  ) {
    return 'fresh';
  }

  // Merge thresholds with defaults
  const t: JobAgeThresholds = { ...DEFAULT_AGE_THRESHOLDS, ...thresholds };

  // Calculate job age from creation date
  const jobDate = job.date ? new Date(job.date).getTime() : now;
  const age = now - jobDate;

  // Classify based on thresholds
  if (age >= t.critical) {
    return 'critical';
  }
  if (age >= t.stale) {
    return 'stale';
  }
  if (age >= t.aging) {
    return 'aging';
  }

  return 'fresh';
}

// ============================================================================
// BULK TECHNICIAN STATUS DERIVATION (for TeamStatusBar)
// ============================================================================

/**
 * Aggregate technician status counts for dashboard display
 */
export interface TechWorkStatusCounts {
  /** Number of technicians actively working */
  active: number;
  /** Number of idle technicians */
  idle: number;
  /** Number of stuck technicians */
  stuck: number;
  /** Number of technicians who completed a job today */
  completed_today: number;
  /** Total number of jobs */
  totalJobs: number;
  /** Breakdown by technician ID */
  byTechnician: Map<string, TechWorkStatus>;
}

/**
 * Derives work status counts for all technicians
 *
 * Used by TeamStatusBar to display aggregate counts.
 *
 * @param technicians - Array of all technicians
 * @param jobs - Array of all jobs
 * @param stuckThresholdMs - Time without activity to consider "stuck" (default: 2 hours)
 * @param now - Current timestamp for testing (default: Date.now())
 * @returns TechWorkStatusCounts with aggregate counts and per-technician breakdown
 */
export function deriveTechWorkStatusCounts(
  technicians: Technician[],
  jobs: Job[],
  stuckThresholdMs: number = DEFAULT_STUCK_THRESHOLD_MS,
  now: number = Date.now()
): TechWorkStatusCounts {
  const result: TechWorkStatusCounts = {
    active: 0,
    idle: 0,
    stuck: 0,
    completed_today: 0,
    totalJobs: jobs.length,
    byTechnician: new Map(),
  };

  for (const tech of technicians) {
    // Get jobs assigned to this technician
    const techJobs = jobs.filter(
      (j) => j.techId === tech.id || j.technicianId === tech.id
    );

    // Derive status for this technician
    const status = deriveTechWorkStatus(techJobs, stuckThresholdMs, now);

    result.byTechnician.set(tech.id, status);

    // Count by status
    switch (status) {
      case 'active':
        result.active++;
        break;
      case 'completed_today':
        result.completed_today++;
        break;
      case 'idle':
        result.idle++;
        break;
      case 'stuck':
        result.stuck++;
        break;
    }
  }

  return result;
}

// ============================================================================
// JOBS READY FOR INVOICING
// ============================================================================

/**
 * Filters jobs to those ready for invoicing
 *
 * @param jobs - Array of jobs to filter
 * @returns Jobs that are ready to be invoiced
 */
export function getJobsReadyForInvoicing(jobs: Job[]): Job[] {
  return jobs.filter((job) => deriveEvidenceStatus(job).readyForInvoicing);
}
