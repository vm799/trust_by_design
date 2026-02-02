/**
 * Dashboard State Types
 *
 * Unified type definitions for the JobProof dashboard system.
 * Supports Manager, Technician, Solo Contractor, and Client roles.
 *
 * @see /docs/DASHBOARD_IMPLEMENTATION_SPEC.md
 */

import { Job, Client, Technician } from '../types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum items in the queue (INV-2) */
export const MAX_QUEUE_SIZE = 5;

/** Idle threshold: 30 minutes without activity */
export const IDLE_THRESHOLD_MS = 30 * 60 * 1000;

/** Stuck threshold: 2 hours with no progress on in-progress job */
export const STUCK_THRESHOLD_MS = 2 * 60 * 60 * 1000;

/** Priority value for urgent jobs */
export const URGENT_PRIORITY = 'urgent';

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Unified dashboard state - single source of truth
 *
 * @invariant INV-1: focus is null or single entity
 * @invariant INV-2: queue.length <= MAX_QUEUE_SIZE (5)
 * @invariant INV-3: No duplicate IDs across focus, queue, background
 * @invariant INV-4: All routes start with '/'
 * @invariant INV-5: Queue sorted by urgency descending
 * @invariant INV-6: Idle technicians never in focus or queue
 */
export interface DashboardState {
  /** Single focus entity (job or technician) - INV-1: null or exactly one */
  focus: FocusEntity | null;

  /** Queue of items needing attention - INV-2: max 5 items */
  queue: QueueItem[];

  /** Background items - collapsed by default */
  background: BackgroundSection[];

  /** Metadata for summary display */
  meta: DashboardMeta;
}

/**
 * Dashboard metadata for header/summary display
 */
export interface DashboardMeta {
  totalJobs: number;
  totalTechnicians: number;
  syncPending: number;
  syncFailed: number;
  lastUpdated: number;
  isOffline: boolean;
  isStale: boolean;
}

/**
 * Focus entity - the ONE thing demanding attention
 */
export interface FocusEntity {
  /** Entity type for rendering decisions */
  type: 'job' | 'technician' | 'attention';

  /** Unique ID (prefixed: job-xxx, tech-xxx) */
  id: string;

  /** Display title */
  title: string;

  /** Secondary text (client name, job title) */
  subtitle?: string;

  /** Why it's in focus (e.g., "In Progress", "Needs Attention") */
  reason: string;

  /** Visual severity indicator */
  severity: 'info' | 'warning' | 'critical';

  /** Primary CTA text */
  actionLabel: string;

  /** Where action navigates - INV-4: must start with '/' */
  actionRoute: string;

  /** Sync status for badge display */
  syncStatus?: SyncStatus;

  /** Additional data for rendering */
  metadata?: Record<string, unknown>;
}

/**
 * Queue item - next things to handle
 */
export interface QueueItem {
  /** Unique ID (prefixed: job-xxx, tech-xxx) */
  id: string;

  /** Entity type for rendering decisions */
  type: 'job' | 'technician' | 'attention';

  /** Display title */
  title: string;

  /** Secondary text */
  subtitle?: string;

  /** Urgency score 0-100, higher = more urgent (INV-5: sorted descending) */
  urgency: number;

  /** Navigation route - INV-4: must start with '/' */
  route: string;

  /** Sync status for badge display */
  syncStatus?: SyncStatus;
}

/**
 * Background section - collapsed, read-only
 */
export interface BackgroundSection {
  /** Section ID for React key */
  id: string;

  /** Section title (e.g., "Idle Technicians", "Completed Jobs") */
  title: string;

  /** Items in this section */
  items: BackgroundItem[];

  /** Whether section should be collapsed by default */
  collapsedByDefault: boolean;
}

/**
 * Background item - individual row in collapsed section
 */
export interface BackgroundItem {
  /** Unique ID (prefixed: bg-job-xxx, bg-tech-xxx) */
  id: string;

  /** Entity type */
  type: 'job' | 'technician';

  /** Display title */
  title: string;

  /** Secondary text */
  subtitle?: string;

  /** Optional navigation route (some items are read-only) */
  route?: string;

  /** Sync status for badge display */
  syncStatus?: SyncStatus;
}

/**
 * Sync status enum for consistent badge rendering
 */
export type SyncStatus = 'synced' | 'pending' | 'failed';

/**
 * Dashboard role determines derivation logic
 */
export type DashboardRole = 'manager' | 'technician' | 'solo_contractor' | 'client';

/**
 * Input for state derivation - all data needed to compute dashboard
 */
export interface DashboardInput {
  /** User's dashboard role */
  role: DashboardRole;

  /** Current user ID */
  userId: string;

  /** All jobs (filtered by role in derivation) */
  jobs: Job[];

  /** All clients */
  clients: Client[];

  /** All technicians (empty for non-manager roles) */
  technicians: Technician[];

  /** Current timestamp (for testability - defaults to Date.now()) */
  now?: number;

  /** Whether currently offline */
  isOffline?: boolean;

  /** Last successful sync timestamp */
  lastSyncAt?: number;
}

// ============================================================================
// INTERNAL TYPES (used by derivation)
// ============================================================================

/**
 * Technician with computed attention data
 * @internal
 */
export interface TechnicianWithAttention {
  tech: Technician;
  activeJob: Job | undefined;
  pendingJobs: Job[];
  techJobs: Job[];
  isIdle: boolean;
  isStuck: boolean;
  hasSyncFailed: boolean;
  lastActivity: number;
  attentionScore: number;
}

/**
 * Invariant validation result
 */
export interface InvariantValidation {
  valid: boolean;
  errors: string[];
}
