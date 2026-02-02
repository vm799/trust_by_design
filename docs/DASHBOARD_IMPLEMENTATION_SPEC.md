# JobProof Dashboard Implementation Spec

**Version:** 2.0 | **Status:** READY FOR IMPLEMENTATION | **Date:** February 2026

---

## Executive Summary

This spec consolidates the existing FocusStack pattern, AdminDashboard hierarchy, and UX contracts into a **UnifiedDashboard** system with:
- Centralized state derivation via `deriveDashboardState()`
- Enforced invariants preventing duplicate items
- Virtualization for 50+ job performance
- Offline-first resilience with sync badges

---

## 1. Dashboard State Management

### 1.1 Type Definitions (`lib/dashboardState.ts`)

```typescript
// ============================================================================
// DASHBOARD STATE TYPES
// ============================================================================

import { Job, Client, Technician, AttentionItem, AttentionLevel } from '../types';

/**
 * Unified dashboard state - single source of truth
 */
export interface DashboardState {
  /** Single focus entity (job or technician) - INV-1: null or exactly one */
  focus: FocusEntity | null;

  /** Queue of items needing attention - INV-2: max 5 items */
  queue: QueueItem[];

  /** Background items - collapsed by default */
  background: BackgroundSection[];

  /** Metadata */
  meta: {
    totalJobs: number;
    totalTechnicians: number;
    syncPending: number;
    syncFailed: number;
    lastUpdated: number;
  };
}

/**
 * Focus entity - the ONE thing demanding attention
 */
export interface FocusEntity {
  type: 'job' | 'technician' | 'attention';
  id: string;
  title: string;
  subtitle?: string;
  reason: string;          // Why it's in focus (e.g., "In Progress", "Needs Attention")
  severity: 'info' | 'warning' | 'critical';
  actionLabel: string;     // Primary CTA text
  actionRoute: string;     // Where action navigates
  syncStatus?: 'synced' | 'pending' | 'failed';
  metadata?: Record<string, unknown>;
}

/**
 * Queue item - next things to handle
 */
export interface QueueItem {
  id: string;
  type: 'job' | 'technician' | 'attention';
  title: string;
  subtitle?: string;
  urgency: number;         // 0-100, higher = more urgent (for sorting)
  route: string;
  syncStatus?: 'synced' | 'pending' | 'failed';
}

/**
 * Background section - collapsed, read-only
 */
export interface BackgroundSection {
  id: string;
  title: string;           // e.g., "Idle Technicians", "Completed Jobs"
  items: BackgroundItem[];
  collapsedByDefault: boolean;
}

export interface BackgroundItem {
  id: string;
  type: 'job' | 'technician';
  title: string;
  subtitle?: string;
  route?: string;          // Optional - some items are read-only
  syncStatus?: 'synced' | 'pending' | 'failed';
}

/**
 * Dashboard context for different user roles
 */
export type DashboardRole = 'manager' | 'technician' | 'solo_contractor' | 'client';

/**
 * Input for state derivation
 */
export interface DashboardInput {
  role: DashboardRole;
  userId: string;
  jobs: Job[];
  clients: Client[];
  technicians: Technician[];
  now?: number;           // Current timestamp (for testability)
}
```

### 1.2 State Derivation Function (`lib/deriveDashboardState.ts`)

```typescript
// ============================================================================
// deriveDashboardState - Pure function with enforced invariants
// ============================================================================

import {
  DashboardState,
  DashboardInput,
  FocusEntity,
  QueueItem,
  BackgroundSection,
} from './dashboardState';

// Constants
const MAX_QUEUE_SIZE = 5;
const IDLE_THRESHOLD_MS = 30 * 60 * 1000;     // 30 minutes
const STUCK_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours
const URGENT_PRIORITY = 'urgent';

/**
 * Derives dashboard state from raw data
 * PURE FUNCTION - no side effects, fully testable
 *
 * @invariant INV-1: focus is null or single entity
 * @invariant INV-2: queue.length <= MAX_QUEUE_SIZE (5)
 * @invariant INV-3: No duplicate IDs across focus, queue, background
 * @invariant INV-4: All routes start with '/'
 * @invariant INV-5: Queue sorted by urgency descending
 * @invariant INV-6: Idle technicians never in focus or queue
 */
export function deriveDashboardState(input: DashboardInput): DashboardState {
  const { role, userId, jobs, clients, technicians, now = Date.now() } = input;

  // Track used IDs to prevent duplicates (INV-3)
  const usedIds = new Set<string>();

  // Role-specific derivation
  switch (role) {
    case 'manager':
      return deriveManagerDashboard(input, usedIds, now);
    case 'technician':
      return deriveTechnicianDashboard(input, usedIds, now);
    case 'solo_contractor':
      return deriveSoloContractorDashboard(input, usedIds, now);
    case 'client':
      return deriveClientDashboard(input, usedIds, now);
    default:
      throw new Error(`Unknown dashboard role: ${role}`);
  }
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

  // Categorize technicians
  const techWithJobs = technicians.map(tech => {
    const techJobs = jobs.filter(j => j.techId === tech.id || j.technicianId === tech.id);
    const activeJob = techJobs.find(j => j.status === 'In Progress');
    const pendingJobs = techJobs.filter(j =>
      j.status !== 'In Progress' &&
      j.status !== 'Complete' &&
      j.status !== 'Submitted'
    );

    const lastActivity = techJobs.reduce((latest, job) => {
      const jobTime = job.lastUpdated || new Date(job.date).getTime();
      return jobTime > latest ? jobTime : latest;
    }, 0);

    const isIdle = !activeJob && pendingJobs.length === 0 &&
      (now - lastActivity > IDLE_THRESHOLD_MS || lastActivity === 0);

    const isStuck = activeJob &&
      (now - (activeJob.lastUpdated || 0) > STUCK_THRESHOLD_MS) &&
      activeJob.photos.length === 0;

    const hasSyncFailed = techJobs.some(j => j.syncStatus === 'failed');

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

  // Sort by attention score (highest first)
  techWithJobs.sort((a, b) => b.attentionScore - a.attentionScore);

  // Find urgent jobs
  const urgentJobs = jobs.filter(j =>
    j.priority === URGENT_PRIORITY &&
    j.status !== 'Complete' &&
    j.status !== 'Submitted'
  );

  // ---- FOCUS (INV-1: single or null) ----
  let focus: FocusEntity | null = null;

  // Priority 1: Critical issues (stuck jobs, sync failures)
  const criticalTech = techWithJobs.find(t => t.isStuck || t.hasSyncFailed);
  if (criticalTech && !usedIds.has(`tech-${criticalTech.tech.id}`)) {
    const reason = criticalTech.isStuck
      ? `No progress on "${criticalTech.activeJob?.title}" for 2+ hours`
      : 'Sync failed - data may be lost';

    focus = {
      type: 'technician',
      id: `tech-${criticalTech.tech.id}`,
      title: criticalTech.tech.name,
      subtitle: criticalTech.activeJob?.title,
      reason,
      severity: 'critical',
      actionLabel: 'Call Now',
      actionRoute: `/admin/technicians/${criticalTech.tech.id}`,
      syncStatus: criticalTech.hasSyncFailed ? 'failed' : undefined,
    };
    usedIds.add(focus.id);
  }

  // Priority 2: Urgent jobs without focus
  if (!focus && urgentJobs.length > 0) {
    const urgentJob = urgentJobs[0];
    if (!usedIds.has(`job-${urgentJob.id}`)) {
      const client = clients.find(c => c.id === urgentJob.clientId);
      focus = {
        type: 'job',
        id: `job-${urgentJob.id}`,
        title: urgentJob.title || `Job #${urgentJob.id.slice(0, 6)}`,
        subtitle: client?.name,
        reason: 'Urgent priority',
        severity: 'critical',
        actionLabel: 'View Job',
        actionRoute: `/admin/jobs/${urgentJob.id}`,
        syncStatus: urgentJob.syncStatus as 'synced' | 'pending' | 'failed',
      };
      usedIds.add(focus.id);
    }
  }

  // ---- QUEUE (INV-2: max 5, INV-5: sorted by urgency) ----
  const queue: QueueItem[] = [];

  // Add technicians with active jobs (not idle - INV-6)
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

  // Add urgent jobs not in focus
  for (const job of urgentJobs.slice(0, MAX_QUEUE_SIZE - queue.length)) {
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
      syncStatus: job.syncStatus as 'synced' | 'pending' | 'failed',
    });
    usedIds.add(id);
  }

  // Sort queue by urgency (INV-5)
  queue.sort((a, b) => b.urgency - a.urgency);

  // ---- BACKGROUND ----
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
  const completedJobs = jobs.filter(j =>
    j.status === 'Complete' || j.status === 'Submitted'
  ).slice(0, 10); // Limit to recent 10

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
          syncStatus: job.syncStatus as 'synced' | 'pending' | 'failed',
        };
      }),
      collapsedByDefault: true,
    });
  }

  // ---- META ----
  const meta = {
    totalJobs: jobs.length,
    totalTechnicians: technicians.length,
    syncPending: jobs.filter(j => j.syncStatus === 'pending').length,
    syncFailed: jobs.filter(j => j.syncStatus === 'failed').length,
    lastUpdated: now,
  };

  return { focus, queue, background, meta };
}

// ============================================================================
// TECHNICIAN DASHBOARD DERIVATION
// ============================================================================

function deriveTechnicianDashboard(
  input: DashboardInput,
  usedIds: Set<string>,
  now: number
): DashboardState {
  const { userId, jobs, clients } = input;

  // Filter to technician's jobs only
  const myJobs = jobs.filter(j =>
    j.techId === userId ||
    j.technicianId === userId ||
    j.techMetadata?.createdByTechId === userId
  );

  // Categorize
  const inProgress = myJobs.find(j => j.status === 'In Progress');
  const pending = myJobs.filter(j =>
    j.status !== 'In Progress' &&
    j.status !== 'Complete' &&
    j.status !== 'Submitted'
  ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const completed = myJobs.filter(j =>
    j.status === 'Complete' || j.status === 'Submitted'
  );

  // ---- FOCUS ----
  let focus: FocusEntity | null = null;
  if (inProgress) {
    const client = clients.find(c => c.id === inProgress.clientId);
    const hasEvidence = inProgress.photos.length > 0 && !!inProgress.signature;

    focus = {
      type: 'job',
      id: `job-${inProgress.id}`,
      title: inProgress.title || `Job #${inProgress.id.slice(0, 6)}`,
      subtitle: client?.name,
      reason: hasEvidence ? 'Ready to submit' : 'In Progress',
      severity: hasEvidence ? 'info' : 'warning',
      actionLabel: 'Continue',
      actionRoute: `/tech/job/${inProgress.id}`,
      syncStatus: inProgress.syncStatus as 'synced' | 'pending' | 'failed',
      metadata: {
        photoCount: inProgress.photos.length,
        hasSig: !!inProgress.signature,
      },
    };
    usedIds.add(focus.id);
  }

  // ---- QUEUE (pending jobs) ----
  const queue: QueueItem[] = pending.slice(0, MAX_QUEUE_SIZE).map((job, i) => {
    const client = clients.find(c => c.id === job.clientId);
    const id = `job-${job.id}`;
    usedIds.add(id);
    return {
      id,
      type: 'job',
      title: job.title || `Job #${job.id.slice(0, 6)}`,
      subtitle: client?.name,
      urgency: job.priority === URGENT_PRIORITY ? 100 : 50 - i,
      route: `/tech/job/${job.id}`,
      syncStatus: job.syncStatus as 'synced' | 'pending' | 'failed',
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
          syncStatus: job.syncStatus as 'synced' | 'pending' | 'failed',
        };
      }),
      collapsedByDefault: completed.length > 3,
    });
  }

  // ---- META ----
  const meta = {
    totalJobs: myJobs.length,
    totalTechnicians: 1,
    syncPending: myJobs.filter(j => j.syncStatus === 'pending').length,
    syncFailed: myJobs.filter(j => j.syncStatus === 'failed').length,
    lastUpdated: now,
  };

  return { focus, queue, background, meta };
}

// ============================================================================
// SOLO CONTRACTOR & CLIENT DASHBOARDS (Similar patterns)
// ============================================================================

function deriveSoloContractorDashboard(
  input: DashboardInput,
  usedIds: Set<string>,
  now: number
): DashboardState {
  // Solo contractor sees their own jobs like a technician
  // but with creation capabilities
  return deriveTechnicianDashboard(input, usedIds, now);
}

function deriveClientDashboard(
  input: DashboardInput,
  usedIds: Set<string>,
  now: number
): DashboardState {
  const { userId, jobs, clients } = input;

  // Client sees jobs for their company only
  const clientJobs = jobs.filter(j => j.clientId === userId);

  const focus: FocusEntity | null = null; // Clients don't have focus jobs
  const queue: QueueItem[] = [];

  const background: BackgroundSection[] = [{
    id: 'my-jobs',
    title: `Jobs (${clientJobs.length})`,
    items: clientJobs.slice(0, 20).map(job => ({
      id: `bg-job-${job.id}`,
      type: 'job' as const,
      title: job.title || `Job #${job.id.slice(0, 6)}`,
      subtitle: job.status,
      route: `/client/jobs/${job.id}`,
      syncStatus: job.syncStatus as 'synced' | 'pending' | 'failed',
    })),
    collapsedByDefault: false,
  }];

  const meta = {
    totalJobs: clientJobs.length,
    totalTechnicians: 0,
    syncPending: 0,
    syncFailed: 0,
    lastUpdated: now,
  };

  return { focus, queue, background, meta };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateAttentionScore(
  isStuck: boolean,
  hasSyncFailed: boolean,
  isIdle: boolean
): number {
  let score = 0;
  if (isStuck) score += 100;
  if (hasSyncFailed) score += 80;
  if (isIdle) score += 10;
  return score;
}

// ============================================================================
// INVARIANT VALIDATION (for testing)
// ============================================================================

export function validateDashboardInvariants(state: DashboardState): string[] {
  const errors: string[] = [];

  // INV-1: Focus is null or single
  // (Guaranteed by type system)

  // INV-2: Queue max 5 items
  if (state.queue.length > MAX_QUEUE_SIZE) {
    errors.push(`INV-2 violated: queue has ${state.queue.length} items (max ${MAX_QUEUE_SIZE})`);
  }

  // INV-3: No duplicate IDs across focus, queue, background
  const allIds = new Set<string>();
  if (state.focus) {
    allIds.add(state.focus.id);
  }
  for (const q of state.queue) {
    if (allIds.has(q.id)) {
      errors.push(`INV-3 violated: duplicate ID ${q.id} in queue`);
    }
    allIds.add(q.id);
  }
  for (const section of state.background) {
    for (const item of section.items) {
      // Background items use different ID prefix, so no collision expected
      // but check anyway
      if (allIds.has(item.id)) {
        errors.push(`INV-3 violated: duplicate ID ${item.id} in background`);
      }
      allIds.add(item.id);
    }
  }

  // INV-4: All routes start with '/'
  if (state.focus && !state.focus.actionRoute.startsWith('/')) {
    errors.push(`INV-4 violated: focus route doesn't start with /`);
  }
  for (const q of state.queue) {
    if (!q.route.startsWith('/')) {
      errors.push(`INV-4 violated: queue item route doesn't start with /`);
    }
  }

  // INV-5: Queue sorted by urgency descending
  for (let i = 1; i < state.queue.length; i++) {
    if (state.queue[i].urgency > state.queue[i - 1].urgency) {
      errors.push(`INV-5 violated: queue not sorted by urgency`);
      break;
    }
  }

  return errors;
}
```

---

## 2. Component Architecture

### 2.1 File Structure

```
components/
├── dashboard/
│   ├── UnifiedDashboard.tsx      # Main container
│   ├── FocusCard.tsx             # Primary action card
│   ├── QueueList.tsx             # Next-up items
│   ├── BackgroundCollapse.tsx    # Collapsed sections
│   ├── SyncStatusBadge.tsx       # Reusable sync indicator
│   └── DashboardSkeleton.tsx     # Loading state
│
lib/
├── dashboardState.ts             # Type definitions
├── deriveDashboardState.ts       # State derivation logic
└── useDashboard.ts               # React hook wrapper
```

### 2.2 UnifiedDashboard Component

```tsx
// components/dashboard/UnifiedDashboard.tsx

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../lib/DataContext';
import { useAuth } from '../../lib/AuthContext';
import { deriveDashboardState, DashboardRole } from '../../lib/deriveDashboardState';
import FocusCard from './FocusCard';
import QueueList from './QueueList';
import BackgroundCollapse from './BackgroundCollapse';
import { DashboardSkeleton } from './DashboardSkeleton';
import { staggerContainer, fadeInUp } from '../../lib/animations';

interface UnifiedDashboardProps {
  role: DashboardRole;
  header?: React.ReactNode;
  emptyState?: React.ReactNode;
}

const UnifiedDashboard: React.FC<UnifiedDashboardProps> = ({
  role,
  header,
  emptyState,
}) => {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const { jobs, clients, technicians, isLoading, refresh } = useData();

  // Derive dashboard state (memoized)
  const dashboardState = useMemo(() => {
    if (!userId) return null;

    return deriveDashboardState({
      role,
      userId,
      jobs,
      clients,
      technicians,
    });
  }, [role, userId, jobs, clients, technicians]);

  // Loading state
  if (isLoading || !dashboardState) {
    return <DashboardSkeleton />;
  }

  // Empty state
  if (dashboardState.meta.totalJobs === 0 && dashboardState.meta.totalTechnicians === 0) {
    return emptyState || <DefaultEmptyState role={role} />;
  }

  return (
    <motion.div
      className="space-y-6 pb-20"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {/* Optional header */}
      {header}

      {/* Sync status summary */}
      {(dashboardState.meta.syncPending > 0 || dashboardState.meta.syncFailed > 0) && (
        <SyncSummaryBanner
          pending={dashboardState.meta.syncPending}
          failed={dashboardState.meta.syncFailed}
          onRetry={refresh}
        />
      )}

      {/* FOCUS - Primary attention item */}
      {dashboardState.focus && (
        <motion.section variants={fadeInUp}>
          <FocusCard
            entity={dashboardState.focus}
            onAction={() => navigate(dashboardState.focus!.actionRoute)}
          />
        </motion.section>
      )}

      {/* QUEUE - Next up items */}
      {dashboardState.queue.length > 0 && (
        <motion.section variants={fadeInUp}>
          <QueueList
            items={dashboardState.queue}
            onItemClick={(item) => navigate(item.route)}
          />
        </motion.section>
      )}

      {/* BACKGROUND - Collapsed sections */}
      {dashboardState.background.map(section => (
        <motion.section key={section.id} variants={fadeInUp}>
          <BackgroundCollapse
            section={section}
            onItemClick={(item) => item.route && navigate(item.route)}
          />
        </motion.section>
      ))}
    </motion.div>
  );
};

export default React.memo(UnifiedDashboard);
```

### 2.3 FocusCard Component

```tsx
// components/dashboard/FocusCard.tsx

import React from 'react';
import { FocusEntity } from '../../lib/dashboardState';
import SyncStatusBadge from './SyncStatusBadge';

interface FocusCardProps {
  entity: FocusEntity;
  onAction: () => void;
}

const FocusCard: React.FC<FocusCardProps> = ({ entity, onAction }) => {
  const severityStyles = {
    info: 'bg-primary/5 border-primary/30',
    warning: 'bg-amber-500/5 border-amber-500/30',
    critical: 'bg-red-500/5 border-red-500/30',
  };

  const severityIcon = {
    info: 'play_arrow',
    warning: 'warning',
    critical: 'priority_high',
  };

  return (
    <div className={`rounded-2xl border-2 p-5 ${severityStyles[entity.severity]}`}>
      <div className="flex items-start gap-4">
        {/* Icon with pulse */}
        <div className={`size-14 rounded-2xl flex items-center justify-center relative shrink-0 ${
          entity.severity === 'critical' ? 'bg-red-500/20' :
          entity.severity === 'warning' ? 'bg-amber-500/20' : 'bg-primary/20'
        }`}>
          <span className={`material-symbols-outlined text-2xl ${
            entity.severity === 'critical' ? 'text-red-500' :
            entity.severity === 'warning' ? 'text-amber-500' : 'text-primary'
          }`}>
            {severityIcon[entity.severity]}
          </span>
          {entity.severity !== 'info' && (
            <span className={`absolute -top-1 -right-1 size-3 rounded-full animate-pulse ${
              entity.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'
            }`} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs font-bold uppercase tracking-wide ${
              entity.severity === 'critical' ? 'text-red-500' :
              entity.severity === 'warning' ? 'text-amber-500' : 'text-primary'
            }`}>
              {entity.reason}
            </span>
            {entity.syncStatus && entity.syncStatus !== 'synced' && (
              <SyncStatusBadge status={entity.syncStatus} />
            )}
          </div>

          <h2 className="font-bold text-slate-900 dark:text-white text-lg truncate">
            {entity.title}
          </h2>

          {entity.subtitle && (
            <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
              {entity.subtitle}
            </p>
          )}
        </div>

        {/* Action button - 44px minimum touch target */}
        <button
          onClick={onAction}
          className="shrink-0 px-5 py-3 bg-primary text-white font-bold text-sm rounded-xl min-h-[44px] min-w-[44px] flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-primary/20"
        >
          {entity.actionLabel}
          <span className="material-symbols-outlined text-lg">chevron_right</span>
        </button>
      </div>
    </div>
  );
};

export default React.memo(FocusCard);
```

### 2.4 QueueList Component (with Virtualization)

```tsx
// components/dashboard/QueueList.tsx

import React from 'react';
import { FixedSizeList as List } from 'react-window';
import { QueueItem } from '../../lib/dashboardState';
import SyncStatusBadge from './SyncStatusBadge';

interface QueueListProps {
  items: QueueItem[];
  onItemClick: (item: QueueItem) => void;
  virtualize?: boolean;  // Enable for 50+ items
}

const ITEM_HEIGHT = 64; // 56px + 8px gap

const QueueList: React.FC<QueueListProps> = ({
  items,
  onItemClick,
  virtualize = items.length > 10,
}) => {
  // Non-virtualized rendering for small lists
  if (!virtualize) {
    return (
      <div className="space-y-2">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">queue</span>
          Next Up ({items.length})
        </h2>
        {items.map((item, index) => (
          <QueueItemCard
            key={item.id}
            item={item}
            position={index + 1}
            onClick={() => onItemClick(item)}
          />
        ))}
      </div>
    );
  }

  // Virtualized rendering for large lists
  return (
    <div>
      <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-2">
        <span className="material-symbols-outlined text-sm">queue</span>
        Next Up ({items.length})
      </h2>
      <List
        height={Math.min(items.length * ITEM_HEIGHT, 400)}
        itemCount={items.length}
        itemSize={ITEM_HEIGHT}
        width="100%"
      >
        {({ index, style }) => (
          <div style={style}>
            <QueueItemCard
              item={items[index]}
              position={index + 1}
              onClick={() => onItemClick(items[index])}
            />
          </div>
        )}
      </List>
    </div>
  );
};

interface QueueItemCardProps {
  item: QueueItem;
  position: number;
  onClick: () => void;
}

const QueueItemCard: React.FC<QueueItemCardProps> = React.memo(({
  item,
  position,
  onClick,
}) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-xl hover:border-primary/30 transition-all active:scale-[0.98] min-h-[56px] text-left"
  >
    {/* Position indicator */}
    <div className="size-8 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-500 dark:text-slate-400 shrink-0">
      {position}
    </div>

    {/* Content */}
    <div className="flex-1 min-w-0">
      <p className="font-medium text-slate-900 dark:text-white truncate text-sm">
        {item.title}
      </p>
      {item.subtitle && (
        <p className="text-xs text-slate-500 truncate">{item.subtitle}</p>
      )}
    </div>

    {/* Sync status */}
    {item.syncStatus && item.syncStatus !== 'synced' && (
      <SyncStatusBadge status={item.syncStatus} compact />
    )}

    <span className="material-symbols-outlined text-slate-400 text-sm">
      chevron_right
    </span>
  </button>
));

QueueItemCard.displayName = 'QueueItemCard';

export default React.memo(QueueList);
```

### 2.5 BackgroundCollapse Component

```tsx
// components/dashboard/BackgroundCollapse.tsx

import React from 'react';
import { BackgroundSection, BackgroundItem } from '../../lib/dashboardState';
import SyncStatusBadge from './SyncStatusBadge';

interface BackgroundCollapseProps {
  section: BackgroundSection;
  onItemClick: (item: BackgroundItem) => void;
}

const BackgroundCollapse: React.FC<BackgroundCollapseProps> = ({
  section,
  onItemClick,
}) => (
  <details
    className="group"
    open={!section.collapsedByDefault}
  >
    <summary className="flex items-center gap-2 py-2 cursor-pointer list-none text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-slate-400 transition-colors">
      <span className="material-symbols-outlined text-sm transition-transform group-open:rotate-90">
        chevron_right
      </span>
      <span className="size-2 rounded-full bg-slate-500 group-open:bg-slate-400" />
      {section.title}
    </summary>

    <div className="space-y-1 mt-2 pl-5">
      {section.items.map(item => (
        <BackgroundItemRow
          key={item.id}
          item={item}
          onClick={() => onItemClick(item)}
        />
      ))}
    </div>
  </details>
);

interface BackgroundItemRowProps {
  item: BackgroundItem;
  onClick: () => void;
}

const BackgroundItemRow: React.FC<BackgroundItemRowProps> = React.memo(({
  item,
  onClick,
}) => (
  <button
    onClick={onClick}
    disabled={!item.route}
    className={`w-full flex items-center gap-2 py-2 px-3 text-sm text-left rounded-lg transition-colors ${
      item.route
        ? 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
        : 'text-slate-400 dark:text-slate-500 cursor-default'
    }`}
  >
    <span className="font-medium truncate flex-1">{item.title}</span>
    {item.subtitle && (
      <>
        <span className="opacity-50">•</span>
        <span className="text-xs truncate">{item.subtitle}</span>
      </>
    )}
    {item.syncStatus && item.syncStatus !== 'synced' && (
      <SyncStatusBadge status={item.syncStatus} compact />
    )}
  </button>
));

BackgroundItemRow.displayName = 'BackgroundItemRow';

export default React.memo(BackgroundCollapse);
```

### 2.6 SyncStatusBadge Component

```tsx
// components/dashboard/SyncStatusBadge.tsx

import React from 'react';

interface SyncStatusBadgeProps {
  status: 'synced' | 'pending' | 'failed';
  compact?: boolean;
}

const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({
  status,
  compact = false,
}) => {
  const config = {
    synced: {
      icon: 'cloud_done',
      label: 'Synced',
      className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    },
    pending: {
      icon: 'sync',
      label: 'Syncing',
      className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      animate: true,
    },
    failed: {
      icon: 'sync_problem',
      label: 'Failed',
      className: 'bg-red-500/10 text-red-600 dark:text-red-400',
    },
  }[status];

  if (compact) {
    return (
      <span
        className={`material-symbols-outlined text-xs ${config.className} ${
          config.animate ? 'animate-spin' : ''
        }`}
        title={config.label}
      >
        {config.icon}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${config.className}`}>
      <span className={`material-symbols-outlined text-xs ${config.animate ? 'animate-spin' : ''}`}>
        {config.icon}
      </span>
      {config.label}
    </span>
  );
};

export default React.memo(SyncStatusBadge);
```

---

## 3. Dashboard UX Requirements

### 3.1 Visual Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│  [Header - Role-specific greeting + sync summary]           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ FOCUS CARD (~40% screen height)                     │    │
│  │ ┌──────┐  In Progress / Urgent / Attention          │    │
│  │ │ ICON │  Job Title or Technician Name              │    │
│  │ │ 56px │  Subtitle (client / job)      [ACTION BTN] │    │
│  │ └──────┘  Sync badge if not synced     [  56px   ]  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  NEXT UP (5)                                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ [1] Job Title • Client               [sync] [>]     │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ [2] Job Title • Client               [sync] [>]     │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ [3] Technician Name • 2 pending             [>]     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ▶ Idle (3)  ──────────────── [collapsed by default]       │
│                                                              │
│  ▶ Completed (12) ─────────── [collapsed by default]       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Touch Target Sizes

| Element | Minimum Size | Class |
|---------|-------------|-------|
| Focus action button | 56×44px | `min-h-[44px] min-w-[56px] px-5 py-3` |
| Queue item | 56px height | `min-h-[56px]` |
| Collapsed section toggle | 44px tap area | `py-2` on summary |
| All interactive elements | 44×44px | Per WCAG 2.1 AAA |

### 3.3 Color & State Indicators

```css
/* Severity colors */
--focus-info: primary/5 (blue-ish)
--focus-warning: amber-500/5
--focus-critical: red-500/5

/* Sync status */
--sync-pending: amber-500/10 + animate-spin
--sync-failed: red-500/10
--sync-done: emerald-500/10

/* Section indicators */
--active-indicator: bg-emerald-500 animate-pulse
--idle-indicator: bg-slate-500 (static)
```

### 3.4 Dark Mode Support

All components use Tailwind's `dark:` variants:
- Backgrounds: `bg-slate-50 dark:bg-slate-900`
- Borders: `border-slate-200 dark:border-white/5`
- Text: `text-slate-900 dark:text-white`

---

## 4. Integration Requirements

### 4.1 Intent Capture/Resume

```typescript
// On dashboard mount, check for pending intent
import { getNavigationIntent, clearNavigationIntent } from '../lib/navigationIntent';

useEffect(() => {
  const intent = getNavigationIntent();
  if (intent && !isIntentExpired(intent)) {
    clearNavigationIntent();
    navigate(intent.path, { replace: true });
  }
}, []);
```

### 4.2 Offline Persistence

```typescript
// useDashboard hook with offline awareness
export function useDashboard(role: DashboardRole) {
  const { jobs, clients, technicians, isLoading, isOffline, lastSyncAt } = useData();
  const { userId } = useAuth();

  const state = useMemo(() =>
    deriveDashboardState({ role, userId, jobs, clients, technicians }),
    [role, userId, jobs, clients, technicians]
  );

  return {
    state,
    isLoading,
    isOffline,
    isStale: isOffline && (Date.now() - lastSyncAt > 5 * 60 * 1000), // 5 min threshold
  };
}
```

### 4.3 Service Worker Caching

Dashboard data should be cached via Service Worker:
- IndexedDB for jobs/clients/technicians (Dexie)
- Cache-first strategy for static assets
- Network-first for API calls with fallback to cache

---

## 5. Testing Strategy

### 5.1 Unit Tests (`tests/unit/deriveDashboardState.test.ts`)

```typescript
import { describe, it, expect } from 'vitest';
import {
  deriveDashboardState,
  validateDashboardInvariants,
} from '../../lib/deriveDashboardState';

describe('deriveDashboardState', () => {
  // ============================================================================
  // INVARIANT TESTS
  // ============================================================================

  describe('Invariant Validation', () => {
    it('INV-1: focus is null or single entity', () => {
      const state = deriveDashboardState(createTestInput());
      expect(state.focus === null || typeof state.focus === 'object').toBe(true);
      expect(validateDashboardInvariants(state)).toHaveLength(0);
    });

    it('INV-2: queue has max 5 items', () => {
      const input = createTestInput({
        jobs: Array.from({ length: 20 }, (_, i) => createJob({ id: `job-${i}` })),
      });
      const state = deriveDashboardState(input);
      expect(state.queue.length).toBeLessThanOrEqual(5);
    });

    it('INV-3: no duplicate IDs across focus, queue, background', () => {
      const state = deriveDashboardState(createTestInput());
      const errors = validateDashboardInvariants(state);
      expect(errors.filter(e => e.includes('INV-3'))).toHaveLength(0);
    });

    it('INV-4: all routes start with /', () => {
      const state = deriveDashboardState(createTestInput());
      if (state.focus) {
        expect(state.focus.actionRoute.startsWith('/')).toBe(true);
      }
      state.queue.forEach(q => {
        expect(q.route.startsWith('/')).toBe(true);
      });
    });

    it('INV-5: queue sorted by urgency descending', () => {
      const state = deriveDashboardState(createTestInput());
      for (let i = 1; i < state.queue.length; i++) {
        expect(state.queue[i].urgency).toBeLessThanOrEqual(state.queue[i - 1].urgency);
      }
    });

    it('INV-6: idle technicians never in focus or queue', () => {
      const input = createTestInput({
        technicians: [
          createTechnician({ id: 'idle-tech', name: 'Idle Person' }),
        ],
        jobs: [], // No jobs = idle
      });
      const state = deriveDashboardState(input);

      expect(state.focus?.id).not.toBe('tech-idle-tech');
      expect(state.queue.find(q => q.id === 'tech-idle-tech')).toBeUndefined();
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    it('handles zero jobs gracefully', () => {
      const state = deriveDashboardState(createTestInput({ jobs: [] }));
      expect(state.focus).toBeNull();
      expect(state.queue).toHaveLength(0);
      expect(state.meta.totalJobs).toBe(0);
    });

    it('handles all jobs urgent', () => {
      const jobs = Array.from({ length: 10 }, (_, i) =>
        createJob({ id: `urgent-${i}`, priority: 'urgent' })
      );
      const state = deriveDashboardState(createTestInput({ jobs }));
      expect(state.focus?.severity).toBe('critical');
      expect(state.queue.every(q => q.urgency === 100)).toBe(true);
    });

    it('handles all technicians idle', () => {
      const technicians = Array.from({ length: 5 }, (_, i) =>
        createTechnician({ id: `tech-${i}` })
      );
      const state = deriveDashboardState(createTestInput({ technicians, jobs: [] }));
      expect(state.focus).toBeNull();
      expect(state.queue).toHaveLength(0);
      expect(state.background.find(s => s.id === 'idle-technicians')?.items.length).toBe(5);
    });

    it('handles sync failures with priority escalation', () => {
      const jobs = [
        createJob({ id: 'failed-job', syncStatus: 'failed' }),
        createJob({ id: 'ok-job', syncStatus: 'synced' }),
      ];
      const state = deriveDashboardState(createTestInput({ jobs }));
      expect(state.meta.syncFailed).toBe(1);
    });
  });

  // ============================================================================
  // ROLE-SPECIFIC TESTS
  // ============================================================================

  describe('Role-specific derivation', () => {
    it('manager sees all technicians and jobs', () => {
      const state = deriveDashboardState(createTestInput({ role: 'manager' }));
      expect(state.meta.totalTechnicians).toBeGreaterThan(0);
    });

    it('technician sees only their own jobs', () => {
      const input = createTestInput({
        role: 'technician',
        userId: 'tech-1',
        jobs: [
          createJob({ id: 'my-job', techId: 'tech-1' }),
          createJob({ id: 'other-job', techId: 'tech-2' }),
        ],
      });
      const state = deriveDashboardState(input);
      expect(state.meta.totalJobs).toBe(1);
    });
  });
});

// ============================================================================
// TEST HELPERS
// ============================================================================

function createTestInput(overrides = {}) {
  return {
    role: 'manager',
    userId: 'user-1',
    jobs: [createJob()],
    clients: [createClient()],
    technicians: [createTechnician()],
    ...overrides,
  };
}

function createJob(overrides = {}) {
  return {
    id: 'job-1',
    title: 'Test Job',
    clientId: 'client-1',
    techId: 'tech-1',
    status: 'In Progress',
    syncStatus: 'synced',
    priority: 'normal',
    date: new Date().toISOString(),
    photos: [],
    ...overrides,
  };
}

function createClient(overrides = {}) {
  return { id: 'client-1', name: 'Test Client', ...overrides };
}

function createTechnician(overrides = {}) {
  return { id: 'tech-1', name: 'Test Tech', ...overrides };
}
```

### 5.2 Integration Tests

```typescript
// tests/integration/dashboard.test.tsx

describe('UnifiedDashboard Integration', () => {
  it('renders focus card when in-progress job exists', async () => {
    render(<UnifiedDashboard role="technician" />, {
      wrapper: createTestWrapper({
        jobs: [{ ...mockJob, status: 'In Progress' }],
      }),
    });

    expect(await screen.findByText('In Progress')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
  });

  it('navigates to job on focus action click', async () => {
    const navigate = vi.fn();
    render(<UnifiedDashboard role="technician" />, {
      wrapper: createTestWrapper({ navigate }),
    });

    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(navigate).toHaveBeenCalledWith('/tech/job/job-1');
  });

  it('shows sync failed badge and retry option', async () => {
    render(<UnifiedDashboard role="manager" />, {
      wrapper: createTestWrapper({
        jobs: [{ ...mockJob, syncStatus: 'failed' }],
      }),
    });

    expect(await screen.findByText(/failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('collapses idle technicians section by default', () => {
    render(<UnifiedDashboard role="manager" />, {
      wrapper: createTestWrapper({
        technicians: [{ ...mockTech, jobs: [] }],
      }),
    });

    const details = screen.getByText(/idle/i).closest('details');
    expect(details).not.toHaveAttribute('open');
  });
});
```

### 5.3 Performance Tests

```typescript
// tests/performance/dashboard.test.ts

describe('Dashboard Performance', () => {
  it('renders 50 jobs without virtualization lag', async () => {
    const jobs = Array.from({ length: 50 }, (_, i) => createJob({ id: `job-${i}` }));

    const start = performance.now();
    render(<UnifiedDashboard role="manager" />, {
      wrapper: createTestWrapper({ jobs }),
    });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100); // < 100ms initial render
  });

  it('memoization prevents re-renders on unrelated state changes', () => {
    const renderSpy = vi.fn();
    const MemoTest = React.memo(() => {
      renderSpy();
      return <UnifiedDashboard role="manager" />;
    });

    const { rerender } = render(<MemoTest />, { wrapper: createTestWrapper() });
    rerender(<MemoTest />);

    expect(renderSpy).toHaveBeenCalledTimes(1);
  });
});
```

---

## 6. Phased Implementation Plan

### Phase 1: Foundation (Days 1-2)

**Deliverables:**
1. `lib/dashboardState.ts` - Type definitions
2. `lib/deriveDashboardState.ts` - Pure derivation function
3. `tests/unit/deriveDashboardState.test.ts` - Invariant tests

**Validation:**
- [ ] All 6 invariants tested and passing
- [ ] Edge cases covered (zero jobs, all urgent, all idle)
- [ ] Role-specific derivation working

### Phase 2: Components (Days 3-4)

**Deliverables:**
1. `components/dashboard/UnifiedDashboard.tsx`
2. `components/dashboard/FocusCard.tsx`
3. `components/dashboard/QueueList.tsx`
4. `components/dashboard/BackgroundCollapse.tsx`
5. `components/dashboard/SyncStatusBadge.tsx`

**Validation:**
- [ ] Components render correctly with test data
- [ ] Touch targets meet 44px minimum
- [ ] Dark mode works consistently
- [ ] Animations are smooth

### Phase 3: Virtualization & Offline (Days 5-6)

**Deliverables:**
1. Add `react-window` dependency
2. Update `QueueList` with virtualization
3. Add offline indicators and stale data warnings
4. Implement Service Worker cache invalidation

**Validation:**
- [ ] 50+ jobs render without lag
- [ ] Offline mode shows cached data
- [ ] Sync status accurate per-item

### Phase 4: Integration & Polish (Days 7-8)

**Deliverables:**
1. Replace existing dashboards with UnifiedDashboard
2. Update routes in App.tsx
3. Add missing tests
4. Update documentation

**Validation:**
- [ ] All 443+ tests passing
- [ ] Build succeeds
- [ ] UAT script passes (see below)

---

## 7. Deliverables Checklist

### Files to Create

| File | Purpose |
|------|---------|
| `lib/dashboardState.ts` | Type definitions |
| `lib/deriveDashboardState.ts` | State derivation + validation |
| `lib/useDashboard.ts` | React hook wrapper |
| `components/dashboard/UnifiedDashboard.tsx` | Main container |
| `components/dashboard/FocusCard.tsx` | Focus entity card |
| `components/dashboard/QueueList.tsx` | Queue with virtualization |
| `components/dashboard/BackgroundCollapse.tsx` | Collapsed sections |
| `components/dashboard/SyncStatusBadge.tsx` | Reusable sync badge |
| `components/dashboard/DashboardSkeleton.tsx` | Loading state |
| `components/dashboard/index.ts` | Exports |
| `tests/unit/deriveDashboardState.test.ts` | Invariant tests |
| `tests/integration/dashboard.test.tsx` | Component tests |

### Files to Modify

| File | Change |
|------|--------|
| `package.json` | Add `react-window` dependency |
| `App.tsx` | Update dashboard route imports |
| `types.ts` | Re-export dashboard types |
| `vite.config.ts` | Add dashboard chunk to manualChunks |

### Files to Delete (After Migration)

| File | Reason |
|------|--------|
| `views/ContractorDashboard.tsx` | Replaced by UnifiedDashboard |
| `views/ClientDashboard.tsx` | Replaced by UnifiedDashboard |

*(Keep ManagerFocusDashboard, AdminDashboard, SoloContractorDashboard during transition)*

---

## 8. UAT Script

```markdown
## Dashboard UAT Checklist

### Setup
1. Open incognito browser
2. Navigate to app URL
3. Log in as Manager role

### Focus Card Tests
- [ ] If job in progress: Focus card shows with "Continue" action
- [ ] If urgent job: Focus card shows critical severity (red)
- [ ] If stuck technician: Focus card shows warning (amber)
- [ ] Tap action button → navigates to correct route

### Queue Tests
- [ ] Shows max 5 items
- [ ] Items sorted by urgency (urgent jobs first)
- [ ] Each item has 56px touch target
- [ ] Tap item → navigates to detail

### Background Tests
- [ ] Idle technicians section collapsed by default
- [ ] Click to expand shows idle techs
- [ ] Completed jobs section collapsed by default

### Sync Status Tests
- [ ] Jobs with pending sync show amber badge
- [ ] Jobs with failed sync show red badge
- [ ] Retry button appears for failed syncs
- [ ] Retry triggers sync attempt

### Offline Tests
- [ ] Enable airplane mode
- [ ] Dashboard shows cached data
- [ ] "Offline" indicator visible
- [ ] Creating job queues for sync
- [ ] Disable airplane mode → sync occurs

### Performance Tests
- [ ] With 50+ jobs, no visible lag
- [ ] Scrolling is smooth
- [ ] No duplicate items visible

### Visual Tests
- [ ] Dark mode: all elements visible
- [ ] Touch targets: all buttons ≥ 44px
- [ ] Typography: hierarchy clear
- [ ] Spacing: consistent 8px grid
```

---

## 9. Critical Checks Before Merge

### Data Integrity

- [ ] `validateDashboardInvariants()` returns empty array for all test cases
- [ ] No duplicate IDs across focus/queue/background
- [ ] Idle technicians never appear in focus or queue
- [ ] Routes all start with `/`

### UX Compliance

- [ ] Touch targets ≥ 44px (per WCAG 2.1 AAA)
- [ ] Focus card occupies ~40% of viewport
- [ ] Queue sorted by urgency descending
- [ ] Idle sections collapsed by default
- [ ] Sync badges visible on all affected items

### Performance

- [ ] Initial render < 100ms with 50 jobs
- [ ] Memoization prevents unnecessary re-renders
- [ ] Virtualization kicks in for lists > 10 items

### Offline

- [ ] Cached data displays when offline
- [ ] Stale indicator shows if offline > 5 minutes
- [ ] Sync status accurate per-item
- [ ] Retry mechanism works

### Testing

- [ ] All invariant tests passing
- [ ] All edge case tests passing
- [ ] Integration tests passing
- [ ] 443+ total tests passing
- [ ] Build succeeds

---

## Related Documents

- `/docs/ux-flow-contract.md` - Core UX laws
- `/docs/ux-route-contract.md` - Route-level requirements
- `/CLAUDE.md` - Development patterns
- `/docs/UX_ARCHITECTURE_V2.md` - UI component guidelines
