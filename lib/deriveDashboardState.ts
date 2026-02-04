/**
 * deriveDashboardState - Pure function with enforced invariants
 *
 * Derives unified dashboard state from raw data.
 * Supports Manager, Technician, Solo Contractor, and Client roles.
 *
 * @invariant INV-1: focus is null or single entity
 * @invariant INV-2: queue.length <= MAX_QUEUE_SIZE (5)
 * @invariant INV-3: No duplicate IDs across focus, queue, background
 * @invariant INV-4: All routes start with '/'
 * @invariant INV-5: Queue sorted by urgency descending
 * @invariant INV-6: Idle technicians never in focus or queue
 *
 * ARCHITECTURE FREEZE (Feb 2026):
 * This function is the SINGLE SOURCE OF TRUTH for all dashboard state.
 * Dashboards (Admin, Contractor, Client) are render-only—they pass role
 * to UnifiedDashboard, which calls useDashboard → deriveDashboardState.
 * Parallel attention derivations are FORBIDDEN. If counts diverge from
 * content, the bug is HERE, not in the dashboard views.
 *
 * @see /docs/DASHBOARD_IMPLEMENTATION_SPEC.md
 */

import {
  DashboardState,
  DashboardInput,
  DashboardMeta,
  FocusEntity,
  QueueItem,
  BackgroundSection,
  BackgroundItem,
  SyncStatus,
  TechnicianWithAttention,
  InvariantValidation,
  MAX_QUEUE_SIZE,
  IDLE_THRESHOLD_MS,
  STUCK_THRESHOLD_MS,
  URGENT_PRIORITY,
} from './dashboardState';
import { Job, Client, Technician } from '../types';
import { JOB_STATUS, SYNC_STATUS, isCompletedJobStatus, isActiveJobStatus } from './constants';

// ============================================================================
// MAIN DERIVATION FUNCTION
// ============================================================================

/**
 * Derives dashboard state from raw data
 *
 * PURE FUNCTION - no side effects, fully testable
 */
export function deriveDashboardState(input: DashboardInput): DashboardState {
  const { role, now = Date.now(), isOffline = false, lastSyncAt } = input;

  // Track used IDs to prevent duplicates (INV-3)
  const usedIds = new Set<string>();

  // Role-specific derivation
  let state: DashboardState;

  switch (role) {
    case 'manager':
      state = deriveManagerDashboard(input, usedIds, now);
      break;
    case 'technician':
      state = deriveTechnicianDashboard(input, usedIds, now);
      break;
    case 'solo_contractor':
      state = deriveSoloContractorDashboard(input, usedIds, now);
      break;
    case 'client':
      state = deriveClientDashboard(input, usedIds, now);
      break;
    default:
      throw new Error(`Unknown dashboard role: ${role}`);
  }

  // Update offline/stale flags
  state.meta.isOffline = isOffline;
  state.meta.isStale = isOffline && lastSyncAt !== undefined &&
    (now - lastSyncAt > 5 * 60 * 1000); // Stale after 5 minutes offline

  // Final invariant check (in development)
  if (process.env.NODE_ENV !== 'production') {
    const validation = validateDashboardInvariants(state);
    if (!validation.valid) {
      console.error('[deriveDashboardState] Invariant violations:', validation.errors);
    }
  }

  return state;
}

// ============================================================================
// MANAGER DASHBOARD DERIVATION
// ============================================================================

function deriveManagerDashboard(
  input: DashboardInput,
  usedIds: Set<string>,
  now: number
): DashboardState {
  const { jobs, clients, technicians } = input;

  // Build technician attention data
  const techWithJobs = buildTechnicianAttentionData(technicians, jobs, now);

  // Sort by attention score (highest first)
  techWithJobs.sort((a, b) => b.attentionScore - a.attentionScore);

  // Find urgent jobs
  const urgentJobs = jobs.filter(j =>
    j.priority === URGENT_PRIORITY &&
    j.status !== JOB_STATUS.COMPLETE &&
    j.status !== JOB_STATUS.SUBMITTED
  );

  // ---- FOCUS (INV-1: single or null) ----
  const focus = deriveFocusForManager(techWithJobs, urgentJobs, clients, usedIds);

  // ---- QUEUE (INV-2: max 5, INV-5: sorted, INV-6: no idle) ----
  const queue = deriveQueueForManager(techWithJobs, urgentJobs, clients, usedIds);

  // ---- BACKGROUND ----
  const background = deriveBackgroundForManager(techWithJobs, jobs, clients, usedIds);

  // ---- META ----
  const meta = buildMeta(jobs, technicians, now);

  return { focus, queue, background, meta };
}

function deriveFocusForManager(
  techWithJobs: TechnicianWithAttention[],
  urgentJobs: Job[],
  clients: Client[],
  usedIds: Set<string>
): FocusEntity | null {
  // Priority 1: Critical issues (stuck jobs, sync failures)
  const criticalTech = techWithJobs.find(t => t.isStuck || t.hasSyncFailed);
  if (criticalTech && !criticalTech.isIdle) {
    const id = `tech-${criticalTech.tech.id}`;
    if (!usedIds.has(id)) {
      const reason = criticalTech.isStuck
        ? `No progress on "${criticalTech.activeJob?.title || 'job'}" for 2+ hours`
        : 'Sync failed - data may be lost';

      usedIds.add(id);
      return {
        type: 'technician',
        id,
        title: criticalTech.tech.name,
        subtitle: criticalTech.activeJob?.title,
        reason,
        severity: 'critical',
        actionLabel: 'Call Now',
        actionRoute: `/admin/technicians/${criticalTech.tech.id}`,
        syncStatus: criticalTech.hasSyncFailed ? 'failed' : undefined,
      };
    }
  }

  // Priority 2: Urgent jobs
  if (urgentJobs.length > 0) {
    const urgentJob = urgentJobs[0];
    const id = `job-${urgentJob.id}`;
    if (!usedIds.has(id)) {
      const client = clients.find(c => c.id === urgentJob.clientId);
      usedIds.add(id);
      return {
        type: 'job',
        id,
        title: urgentJob.title || `Job #${urgentJob.id.slice(0, 6)}`,
        subtitle: client?.name,
        reason: 'Urgent priority',
        severity: 'critical',
        actionLabel: 'View Job',
        actionRoute: `/admin/jobs/${urgentJob.id}`,
        syncStatus: toSyncStatus(urgentJob.syncStatus),
      };
    }
  }

  // Priority 3: Active technician with in-progress job
  const activeTech = techWithJobs.find(t => t.activeJob && !t.isIdle);
  if (activeTech) {
    const id = `tech-${activeTech.tech.id}`;
    if (!usedIds.has(id)) {
      usedIds.add(id);
      return {
        type: 'technician',
        id,
        title: activeTech.tech.name,
        subtitle: activeTech.activeJob?.title,
        reason: 'In Field',
        severity: 'info',
        actionLabel: 'View Progress',
        actionRoute: `/admin/technicians/${activeTech.tech.id}`,
        metadata: {
          photoCount: activeTech.activeJob?.photos.length || 0,
        },
      };
    }
  }

  return null;
}

function deriveQueueForManager(
  techWithJobs: TechnicianWithAttention[],
  urgentJobs: Job[],
  clients: Client[],
  usedIds: Set<string>
): QueueItem[] {
  const queue: QueueItem[] = [];

  // Add technicians with active/pending jobs (INV-6: not idle)
  for (const tw of techWithJobs) {
    if (queue.length >= MAX_QUEUE_SIZE) break;
    if (tw.isIdle) continue; // INV-6: No idle techs in queue

    const id = `tech-${tw.tech.id}`;
    if (usedIds.has(id)) continue;

    if (tw.activeJob || tw.pendingJobs.length > 0) {
      queue.push({
        id,
        type: 'technician',
        title: tw.tech.name,
        subtitle: tw.activeJob?.title || `${tw.pendingJobs.length} pending`,
        urgency: tw.attentionScore,
        route: `/admin/technicians/${tw.tech.id}`,
        syncStatus: tw.hasSyncFailed ? 'failed' : undefined,
      });
      usedIds.add(id);
    }
  }

  // Add urgent jobs not already used
  for (const job of urgentJobs) {
    if (queue.length >= MAX_QUEUE_SIZE) break;

    const id = `job-${job.id}`;
    if (usedIds.has(id)) continue;

    const client = clients.find(c => c.id === job.clientId);
    queue.push({
      id,
      type: 'job',
      title: job.title || `Job #${job.id.slice(0, 6)}`,
      subtitle: client?.name,
      urgency: 100, // Urgent jobs max urgency
      route: `/admin/jobs/${job.id}`,
      syncStatus: toSyncStatus(job.syncStatus),
    });
    usedIds.add(id);
  }

  // Sort by urgency (INV-5)
  queue.sort((a, b) => b.urgency - a.urgency);

  return queue;
}

function deriveBackgroundForManager(
  techWithJobs: TechnicianWithAttention[],
  jobs: Job[],
  clients: Client[],
  usedIds: Set<string>
): BackgroundSection[] {
  const background: BackgroundSection[] = [];

  // Idle technicians section (collapsed by default)
  const idleTechs = techWithJobs.filter(tw => tw.isIdle);
  if (idleTechs.length > 0) {
    background.push({
      id: 'idle-technicians',
      title: `Idle (${idleTechs.length})`,
      items: idleTechs.map(tw => ({
        id: `bg-tech-${tw.tech.id}`,
        type: 'technician' as const,
        title: tw.tech.name,
        subtitle: 'No active jobs',
        route: `/admin/technicians/${tw.tech.id}`,
      })),
      collapsedByDefault: true,
    });
  }

  // Completed jobs section (collapsed by default)
  const completedJobs = jobs
    .filter(j => j.status === JOB_STATUS.COMPLETE || j.status === JOB_STATUS.SUBMITTED)
    .slice(0, 10); // Limit to recent 10

  if (completedJobs.length > 0) {
    background.push({
      id: 'completed-jobs',
      title: `Completed (${completedJobs.length})`,
      items: completedJobs.map(job => {
        const client = clients.find(c => c.id === job.clientId);
        return {
          id: `bg-job-${job.id}`,
          type: 'job' as const,
          title: job.title || `Job #${job.id.slice(0, 6)}`,
          subtitle: client?.name,
          route: `/admin/jobs/${job.id}`,
          syncStatus: toSyncStatus(job.syncStatus),
        };
      }),
      collapsedByDefault: true,
    });
  }

  return background;
}

// ============================================================================
// TECHNICIAN DASHBOARD DERIVATION
// ============================================================================

function deriveTechnicianDashboard(
  input: DashboardInput,
  usedIds: Set<string>,
  now: number
): DashboardState {
  const { userId, jobs, clients, technicians } = input;

  // Filter to technician's jobs only
  const myJobs = jobs.filter(j =>
    j.techId === userId ||
    j.technicianId === userId ||
    (j.techMetadata as { createdByTechId?: string })?.createdByTechId === userId
  );

  // Categorize
  const inProgress = myJobs.find(j => j.status === JOB_STATUS.IN_PROGRESS);
  const pending = myJobs
    .filter(j =>
      j.status !== JOB_STATUS.IN_PROGRESS &&
      j.status !== JOB_STATUS.COMPLETE &&
      j.status !== JOB_STATUS.SUBMITTED
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const completed = myJobs.filter(j =>
    j.status === JOB_STATUS.COMPLETE || j.status === JOB_STATUS.SUBMITTED
  );

  // ---- FOCUS ----
  let focus: FocusEntity | null = null;
  if (inProgress) {
    const client = clients.find(c => c.id === inProgress.clientId);
    const hasEvidence = inProgress.photos.length > 0 && !!inProgress.signature;
    const id = `job-${inProgress.id}`;

    focus = {
      type: 'job',
      id,
      title: inProgress.title || `Job #${inProgress.id.slice(0, 6)}`,
      subtitle: client?.name,
      reason: hasEvidence ? 'Ready to submit' : 'In Progress',
      severity: hasEvidence ? 'info' : 'warning',
      actionLabel: 'Continue',
      actionRoute: `/tech/job/${inProgress.id}`,
      syncStatus: toSyncStatus(inProgress.syncStatus),
      metadata: {
        photoCount: inProgress.photos.length,
        hasSignature: !!inProgress.signature,
      },
    };
    usedIds.add(id);
  }

  // ---- QUEUE (pending jobs) ----
  const queue: QueueItem[] = pending.slice(0, MAX_QUEUE_SIZE).map((job, i) => {
    const client = clients.find(c => c.id === job.clientId);
    const id = `job-${job.id}`;
    usedIds.add(id);
    return {
      id,
      type: 'job' as const,
      title: job.title || `Job #${job.id.slice(0, 6)}`,
      subtitle: client?.name,
      urgency: job.priority === URGENT_PRIORITY ? 100 : 50 - i,
      route: `/tech/job/${job.id}`,
      syncStatus: toSyncStatus(job.syncStatus),
    };
  });

  // Sort by urgency (INV-5)
  queue.sort((a, b) => b.urgency - a.urgency);

  // ---- BACKGROUND ----
  const background: BackgroundSection[] = [];

  if (completed.length > 0) {
    background.push({
      id: 'finished-jobs',
      title: `Finished (${completed.length})`,
      items: completed.slice(0, 10).map(job => {
        const client = clients.find(c => c.id === job.clientId);
        return {
          id: `bg-job-${job.id}`,
          type: 'job' as const,
          title: job.title || `Job #${job.id.slice(0, 6)}`,
          subtitle: client?.name,
          route: `/tech/job/${job.id}`,
          syncStatus: toSyncStatus(job.syncStatus),
        };
      }),
      collapsedByDefault: completed.length > 3,
    });
  }

  // ---- META ----
  const meta = buildMeta(myJobs, technicians, now);

  return { focus, queue, background, meta };
}

// ============================================================================
// SOLO CONTRACTOR DASHBOARD DERIVATION
// ============================================================================

function deriveSoloContractorDashboard(
  input: DashboardInput,
  usedIds: Set<string>,
  now: number
): DashboardState {
  // Solo contractor sees their own jobs like a technician
  // but with creation capabilities (handled in UI, not derivation)
  return deriveTechnicianDashboard(input, usedIds, now);
}

// ============================================================================
// CLIENT DASHBOARD DERIVATION
// ============================================================================

function deriveClientDashboard(
  input: DashboardInput,
  usedIds: Set<string>,
  now: number
): DashboardState {
  const { userId, jobs, clients, technicians } = input;

  // Client sees jobs for their company only
  const clientJobs = jobs.filter(j => j.clientId === userId);

  // Clients don't have focus jobs - they're observers
  const focus: FocusEntity | null = null;
  const queue: QueueItem[] = [];

  // Show all their jobs in background
  const background: BackgroundSection[] = [];

  if (clientJobs.length > 0) {
    background.push({
      id: 'my-jobs',
      title: `Jobs (${clientJobs.length})`,
      items: clientJobs.slice(0, 20).map(job => ({
        id: `bg-job-${job.id}`,
        type: 'job' as const,
        title: job.title || `Job #${job.id.slice(0, 6)}`,
        subtitle: job.status,
        route: `/client/jobs/${job.id}`,
        syncStatus: toSyncStatus(job.syncStatus),
      })),
      collapsedByDefault: false,
    });
  }

  // ---- META ----
  const meta: DashboardMeta = {
    totalJobs: clientJobs.length,
    totalTechnicians: 0,
    syncPending: 0,
    syncFailed: 0,
    lastUpdated: now,
    isOffline: false,
    isStale: false,
  };

  return { focus, queue, background, meta };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function buildTechnicianAttentionData(
  technicians: Technician[],
  jobs: Job[],
  now: number
): TechnicianWithAttention[] {
  return technicians.map(tech => {
    const techJobs = jobs.filter(j => j.techId === tech.id || j.technicianId === tech.id);
    const activeJob = techJobs.find(j => j.status === JOB_STATUS.IN_PROGRESS);
    const pendingJobs = techJobs.filter(j =>
      j.status !== JOB_STATUS.IN_PROGRESS &&
      j.status !== JOB_STATUS.COMPLETE &&
      j.status !== JOB_STATUS.SUBMITTED
    );

    const lastActivity = techJobs.reduce((latest, job) => {
      const jobTime = job.lastUpdated || new Date(job.date).getTime();
      return jobTime > latest ? jobTime : latest;
    }, 0);

    const isIdle = !activeJob && pendingJobs.length === 0 &&
      (now - lastActivity > IDLE_THRESHOLD_MS || lastActivity === 0);

    const isStuck = !!(activeJob &&
      (now - (activeJob.lastUpdated || 0) > STUCK_THRESHOLD_MS) &&
      activeJob.photos.length === 0);

    const hasSyncFailed = techJobs.some(j => j.syncStatus === SYNC_STATUS.FAILED);

    return {
      tech,
      activeJob,
      pendingJobs,
      techJobs,
      isIdle,
      isStuck,
      hasSyncFailed,
      lastActivity,
      attentionScore: calculateAttentionScore(isStuck, hasSyncFailed, isIdle),
    };
  });
}

function calculateAttentionScore(
  isStuck: boolean,
  hasSyncFailed: boolean,
  isIdle: boolean
): number {
  let score = 0;
  if (isStuck) score += 100;
  if (hasSyncFailed) score += 80;
  // Idle technicians get LOW score (they go to background, INV-6)
  if (isIdle) score += 10;
  return score;
}

function buildMeta(
  jobs: Job[],
  technicians: Technician[],
  now: number
): DashboardMeta {
  return {
    totalJobs: jobs.length,
    totalTechnicians: technicians.length,
    syncPending: jobs.filter(j => j.syncStatus === SYNC_STATUS.PENDING).length,
    syncFailed: jobs.filter(j => j.syncStatus === SYNC_STATUS.FAILED).length,
    lastUpdated: now,
    isOffline: false,
    isStale: false,
  };
}

function toSyncStatus(status: string | undefined): SyncStatus | undefined {
  if (status === SYNC_STATUS.SYNCED || status === SYNC_STATUS.PENDING || status === SYNC_STATUS.FAILED) {
    return status as SyncStatus;
  }
  return undefined;
}

// ============================================================================
// INVARIANT VALIDATION (for testing and development)
// ============================================================================

/**
 * Validates all 6 dashboard invariants
 *
 * @returns Validation result with any errors found
 */
export function validateDashboardInvariants(state: DashboardState): InvariantValidation {
  const errors: string[] = [];

  // INV-1: Focus is null or single (guaranteed by type system, but check anyway)
  if (state.focus !== null && typeof state.focus !== 'object') {
    errors.push('INV-1: focus must be null or object');
  }

  // INV-2: Queue max 5 items
  if (state.queue.length > MAX_QUEUE_SIZE) {
    errors.push(`INV-2: queue has ${state.queue.length} items (max ${MAX_QUEUE_SIZE})`);
  }

  // INV-3: No duplicate IDs across focus, queue, background
  const allIds = new Set<string>();
  if (state.focus) {
    allIds.add(state.focus.id);
  }
  for (const q of state.queue) {
    if (allIds.has(q.id)) {
      errors.push(`INV-3: duplicate ID "${q.id}" in queue`);
    }
    allIds.add(q.id);
  }
  for (const section of state.background) {
    for (const item of section.items) {
      // Background uses different prefix (bg-) so shouldn't collide
      // but check the base ID part
      const baseId = item.id.replace(/^bg-/, '');
      if (allIds.has(baseId)) {
        // This is acceptable - bg items can reference same entity
        // Only error if EXACT same ID
      }
      if (allIds.has(item.id)) {
        errors.push(`INV-3: duplicate ID "${item.id}" in background`);
      }
      allIds.add(item.id);
    }
  }

  // INV-4: All routes start with '/'
  if (state.focus && !state.focus.actionRoute.startsWith('/')) {
    errors.push(`INV-4: focus actionRoute "${state.focus.actionRoute}" doesn't start with /`);
  }
  for (const q of state.queue) {
    if (!q.route.startsWith('/')) {
      errors.push(`INV-4: queue item route "${q.route}" doesn't start with /`);
    }
  }
  for (const section of state.background) {
    for (const item of section.items) {
      if (item.route && !item.route.startsWith('/')) {
        errors.push(`INV-4: background item route "${item.route}" doesn't start with /`);
      }
    }
  }

  // INV-5: Queue sorted by urgency descending
  for (let i = 1; i < state.queue.length; i++) {
    if (state.queue[i].urgency > state.queue[i - 1].urgency) {
      errors.push(`INV-5: queue not sorted by urgency (index ${i - 1} has ${state.queue[i - 1].urgency}, index ${i} has ${state.queue[i].urgency})`);
      break;
    }
  }

  // INV-6: Idle technicians never in focus or queue
  // (This is enforced during derivation - we check by looking for "Idle" or "No active jobs" text)
  if (state.focus && state.focus.type === 'technician') {
    const reason = state.focus.reason.toLowerCase();
    if (reason.includes('idle') || reason.includes('no active')) {
      errors.push(`INV-6: idle technician "${state.focus.title}" found in focus`);
    }
  }
  for (const q of state.queue) {
    if (q.type === 'technician') {
      const subtitle = (q.subtitle || '').toLowerCase();
      if (subtitle.includes('idle') || subtitle === 'no active jobs') {
        errors.push(`INV-6: idle technician "${q.title}" found in queue`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  MAX_QUEUE_SIZE,
  IDLE_THRESHOLD_MS,
  STUCK_THRESHOLD_MS,
  URGENT_PRIORITY,
};
