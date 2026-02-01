/**
 * Centralized Constants
 *
 * All status values, sync indicators, and other constants MUST be imported from here.
 * NEVER hardcode status strings in components or other files.
 *
 * @see CLAUDE.md - "NO HARDCODED STATUSES"
 */

import type { JobStatus, SyncStatus } from '../types';

// ============================================================================
// JOB STATUS CONSTANTS
// ============================================================================

/**
 * Job status values - use these instead of string literals
 */
export const JOB_STATUS = {
  PENDING: 'Pending' as JobStatus,
  IN_PROGRESS: 'In Progress' as JobStatus,
  COMPLETE: 'Complete' as JobStatus,
  SUBMITTED: 'Submitted' as JobStatus,
  ARCHIVED: 'Archived' as JobStatus,
  PAUSED: 'Paused' as JobStatus,
  CANCELLED: 'Cancelled' as JobStatus,
  DRAFT: 'Draft' as JobStatus,
} as const;

/**
 * Job statuses that indicate active work (not finished)
 */
export const ACTIVE_JOB_STATUSES: JobStatus[] = [
  JOB_STATUS.PENDING,
  JOB_STATUS.IN_PROGRESS,
  JOB_STATUS.PAUSED,
];

/**
 * Job statuses that indicate completed work (finished)
 */
export const COMPLETED_JOB_STATUSES: JobStatus[] = [
  JOB_STATUS.COMPLETE,
  JOB_STATUS.SUBMITTED,
  JOB_STATUS.ARCHIVED,
];

/**
 * Job statuses that indicate work is sealed/verified
 */
export const SEALED_JOB_STATUSES: JobStatus[] = [
  JOB_STATUS.SUBMITTED,
];

/**
 * Job statuses that indicate work is cancelled/abandoned
 */
export const INACTIVE_JOB_STATUSES: JobStatus[] = [
  JOB_STATUS.CANCELLED,
  JOB_STATUS.ARCHIVED,
];

/**
 * Default status for new jobs
 */
export const DEFAULT_JOB_STATUS = JOB_STATUS.PENDING;

// ============================================================================
// SYNC STATUS CONSTANTS
// ============================================================================

/**
 * Sync status values - use these instead of string literals
 */
export const SYNC_STATUS = {
  PENDING: 'pending' as SyncStatus,
  SYNCING: 'syncing' as SyncStatus,
  SYNCED: 'synced' as SyncStatus,
  FAILED: 'failed' as SyncStatus,
} as const;

/**
 * Default sync status for new entities
 */
export const DEFAULT_SYNC_STATUS = SYNC_STATUS.PENDING;

/**
 * Sync statuses that need retry/attention
 */
export const SYNC_NEEDS_ATTENTION: SyncStatus[] = [
  SYNC_STATUS.FAILED,
];

/**
 * Sync statuses that are in progress
 */
export const SYNC_IN_PROGRESS: SyncStatus[] = [
  SYNC_STATUS.PENDING,
  SYNC_STATUS.SYNCING,
];

// ============================================================================
// TECHNICIAN STATUS CONSTANTS
// ============================================================================

/**
 * Technician status values
 */
export const TECHNICIAN_STATUS = {
  AVAILABLE: 'Available' as const,
  ON_SITE: 'On Site' as const,
  OFF_DUTY: 'Off Duty' as const,
  AUTHORISED: 'Authorised' as const,
} as const;

export type TechnicianStatusType = typeof TECHNICIAN_STATUS[keyof typeof TECHNICIAN_STATUS];

/**
 * Technician statuses that can accept new jobs
 */
export const TECHNICIAN_CAN_ACCEPT_JOBS: TechnicianStatusType[] = [
  TECHNICIAN_STATUS.AVAILABLE,
  TECHNICIAN_STATUS.AUTHORISED,
];

// ============================================================================
// INVOICE STATUS CONSTANTS
// ============================================================================

/**
 * Invoice status values
 */
export const INVOICE_STATUS = {
  DRAFT: 'Draft' as const,
  SENT: 'Sent' as const,
  PAID: 'Paid' as const,
  OVERDUE: 'Overdue' as const,
} as const;

// ============================================================================
// PHOTO TYPE CONSTANTS
// ============================================================================

/**
 * Photo type values
 */
export const PHOTO_TYPE = {
  BEFORE: 'before' as const,
  DURING: 'during' as const,
  AFTER: 'after' as const,
  EVIDENCE: 'Evidence' as const,
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a job status represents active work
 */
export const isActiveJobStatus = (status: JobStatus): boolean =>
  ACTIVE_JOB_STATUSES.includes(status);

/**
 * Check if a job status represents completed work
 */
export const isCompletedJobStatus = (status: JobStatus): boolean =>
  COMPLETED_JOB_STATUSES.includes(status);

/**
 * Check if a job is sealed (cannot be deleted)
 */
export const isSealedJobStatus = (status: JobStatus): boolean =>
  SEALED_JOB_STATUSES.includes(status);

/**
 * Check if sync status needs attention
 */
export const syncNeedsAttention = (status: SyncStatus): boolean =>
  SYNC_NEEDS_ATTENTION.includes(status);

/**
 * Check if sync is in progress
 */
export const isSyncInProgress = (status: SyncStatus): boolean =>
  SYNC_IN_PROGRESS.includes(status);

/**
 * Check if technician can accept new jobs
 */
export const canTechnicianAcceptJobs = (status: TechnicianStatusType): boolean =>
  TECHNICIAN_CAN_ACCEPT_JOBS.includes(status);
