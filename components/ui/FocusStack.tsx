/**
 * FocusStack - Context Thrash Prevention UI Pattern
 *
 * Implements the focus/queue/collapsed pattern:
 * - ONE job in focus (dominant, ~50% screen)
 * - Max 3 jobs in queue (preview only, read-only)
 * - Everything else collapsed (scroll-only, no affordances)
 *
 * Core principle: You scale by showing less and remembering more.
 */

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Card from './Card';
import { fadeInUp, staggerContainer, staggerContainerFast } from '../../lib/animations';
import { Job, Client, AttentionLevel } from '../../types';

// ============================================================================
// TYPES
// ============================================================================

export interface FocusJobRenderProps {
  job: Job;
  client?: Client;
  onContinue: () => void;
}

export interface QueueJobRenderProps {
  job: Job;
  client?: Client;
  position: number;
}

export interface CollapsedJobRenderProps {
  job: Job;
  client?: Client;
}

interface FocusStackProps {
  /** All jobs to display (will be categorized automatically) */
  jobs: Job[];
  /** Clients for job lookups */
  clients: Client[];
  /** Currently active/focus job ID (null if none) */
  focusJobId: string | null;
  /** Render function for the focus job (takes ~50% screen) */
  renderFocusJob: (props: FocusJobRenderProps) => React.ReactNode;
  /** Render function for queue jobs (max 3, read-only preview) */
  renderQueueJob: (props: QueueJobRenderProps) => React.ReactNode;
  /** Render function for collapsed jobs (scroll-only, minimal) */
  renderCollapsedJob?: (props: CollapsedJobRenderProps) => React.ReactNode;
  /** Callback when user clicks continue on focus job */
  onContinueFocusJob: (job: Job) => void;
  /** Maximum queue size (default: 3) */
  maxQueueSize?: number;
  /** Custom queue sorting function */
  sortQueue?: (jobs: Job[]) => Job[];
  /** Whether to show collapsed section */
  showCollapsed?: boolean;
  /** Empty state content when no jobs */
  emptyState?: React.ReactNode;
  /** Header for queue section */
  queueHeader?: React.ReactNode;
  /** Header for collapsed section */
  collapsedHeader?: React.ReactNode;
}

// ============================================================================
// DEFAULT SORTING
// ============================================================================

/**
 * Default queue sorting: last touched → proximity → scheduled time
 */
function defaultQueueSort(jobs: Job[]): Job[] {
  return [...jobs].sort((a, b) => {
    // Primary: Last updated (most recent first)
    const aUpdated = a.lastUpdated || 0;
    const bUpdated = b.lastUpdated || 0;
    if (aUpdated !== bUpdated) return bUpdated - aUpdated;

    // Secondary: Scheduled date (earliest first)
    const aDate = new Date(a.date).getTime();
    const bDate = new Date(b.date).getTime();
    return aDate - bDate;
  });
}

// ============================================================================
// COMPONENT
// ============================================================================

const FocusStack: React.FC<FocusStackProps> = ({
  jobs,
  clients,
  focusJobId,
  renderFocusJob,
  renderQueueJob,
  renderCollapsedJob,
  onContinueFocusJob,
  maxQueueSize = 3,
  sortQueue = defaultQueueSort,
  showCollapsed = true,
  emptyState,
  queueHeader,
  collapsedHeader,
}) => {
  // Find client helper
  const findClient = (job: Job): Client | undefined =>
    clients.find(c => c.id === job.clientId);

  // Categorize jobs into focus/queue/collapsed
  const { focusJob, queueJobs, collapsedJobs } = useMemo(() => {
    const levels = new Map<string, AttentionLevel>();

    // Find focus job
    const focus = focusJobId ? jobs.find(j => j.id === focusJobId) : null;
    if (focus) {
      levels.set(focus.id, 'focus');
    }

    // Filter remaining jobs (active, not complete/submitted)
    const remaining = jobs.filter(j =>
      j.id !== focusJobId &&
      j.status !== 'Complete' &&
      j.status !== 'Submitted' &&
      j.status !== 'Archived' &&
      j.status !== 'Cancelled'
    );

    // Sort and take queue
    const sorted = sortQueue(remaining);
    const queue = sorted.slice(0, maxQueueSize);
    const collapsed = sorted.slice(maxQueueSize);

    // Mark attention levels
    queue.forEach(j => levels.set(j.id, 'queue'));
    collapsed.forEach(j => levels.set(j.id, 'collapsed'));

    return {
      focusJob: focus,
      queueJobs: queue,
      collapsedJobs: collapsed,
      attentionLevels: levels,
    };
  }, [jobs, focusJobId, sortQueue, maxQueueSize]);

  // Empty state
  if (jobs.length === 0) {
    return emptyState ? <>{emptyState}</> : null;
  }

  return (
    <motion.div
      className="space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {/* FOCUS JOB - Dominant, ~50% screen */}
      {focusJob && (
        <motion.section variants={fadeInUp} className="mb-6">
          {renderFocusJob({
            job: focusJob,
            client: findClient(focusJob),
            onContinue: () => onContinueFocusJob(focusJob),
          })}
        </motion.section>
      )}

      {/* QUEUE - Next 3, read-only preview */}
      {queueJobs.length > 0 && (
        <motion.section variants={fadeInUp}>
          {queueHeader || (
            <h2 className="text-sm font-medium text-slate-400 dark:text-slate-400 mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">queue</span>
              Next Up ({queueJobs.length})
            </h2>
          )}

          <motion.div
            className="space-y-2"
            variants={staggerContainerFast}
            initial="hidden"
            animate="visible"
          >
            {queueJobs.map((job, index) => (
              <motion.div key={job.id} variants={fadeInUp}>
                {renderQueueJob({
                  job,
                  client: findClient(job),
                  position: index + 1,
                })}
              </motion.div>
            ))}
          </motion.div>
        </motion.section>
      )}

      {/* COLLAPSED - Rest, scroll-only, no affordances */}
      {showCollapsed && collapsedJobs.length > 0 && renderCollapsedJob && (
        <motion.section variants={fadeInUp}>
          <details className="group">
            <summary className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 py-2">
              <span className="material-symbols-outlined text-sm transition-transform group-open:rotate-90">
                chevron_right
              </span>
              {collapsedHeader || `${collapsedJobs.length} more job${collapsedJobs.length !== 1 ? 's' : ''}`}
            </summary>

            <motion.div
              className="space-y-2 pt-2"
              variants={staggerContainerFast}
              initial="hidden"
              animate="visible"
            >
              {collapsedJobs.map(job => (
                <motion.div key={job.id} variants={fadeInUp}>
                  {renderCollapsedJob({
                    job,
                    client: findClient(job),
                  })}
                </motion.div>
              ))}
            </motion.div>
          </details>
        </motion.section>
      )}
    </motion.div>
  );
};

// ============================================================================
// DEFAULT RENDER COMPONENTS
// ============================================================================

/**
 * Default Focus Job Card - Large, prominent, with continue action
 */
export const DefaultFocusJobCard: React.FC<FocusJobRenderProps> = ({
  job,
  client,
  onContinue,
}) => (
  <Card className="bg-primary/5 dark:bg-primary/10 border-primary/30">
    <div className="flex items-center gap-4 py-2">
      {/* Pulsing indicator */}
      <div className="size-16 rounded-2xl bg-primary/20 flex items-center justify-center relative shrink-0">
        <span className="material-symbols-outlined text-3xl text-primary">play_arrow</span>
        <span className="absolute -top-1 -right-1 size-3 bg-primary rounded-full animate-pulse" />
      </div>

      {/* Job info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-primary uppercase tracking-wide mb-1">
          In Focus
        </p>
        <p className="font-bold text-slate-900 dark:text-white text-lg truncate">
          {job.title || `Job #${job.id.slice(0, 6)}`}
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
          {client?.name || 'Unknown client'}
        </p>
        {job.status && (
          <p className="text-xs text-slate-400 mt-1">
            {job.status}
          </p>
        )}
      </div>

      {/* Continue button */}
      <button
        onClick={onContinue}
        className="shrink-0 px-4 py-3 bg-primary text-white font-bold text-sm rounded-xl min-h-[48px] flex items-center gap-2 transition-all active:scale-95"
      >
        Continue
        <span className="material-symbols-outlined text-lg">chevron_right</span>
      </button>
    </div>
  </Card>
);

/**
 * Default Queue Job Card - Compact, read-only
 */
export const DefaultQueueJobCard: React.FC<QueueJobRenderProps & { to?: string }> = ({
  job,
  client,
  position,
  to,
}) => {
  const content = (
    <Card variant="interactive" padding="sm">
      <div className="flex items-center gap-3">
        {/* Position indicator */}
        <div className="size-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm font-medium text-slate-400 dark:text-slate-400 shrink-0">
          {position}
        </div>

        {/* Job info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-900 dark:text-white truncate text-sm">
            {job.title || `Job #${job.id.slice(0, 6)}`}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-400 truncate">
            {client?.name || 'Unknown client'}
          </p>
        </div>

        {/* Time indicator */}
        <div className="text-xs text-slate-400 shrink-0">
          {new Date(job.date).toLocaleTimeString('en-AU', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </Card>
  );

  if (to) {
    return <Link to={to}>{content}</Link>;
  }

  return content;
};

/**
 * Default Collapsed Job Card - Minimal, just text
 */
export const DefaultCollapsedJobCard: React.FC<CollapsedJobRenderProps & { to?: string }> = ({
  job,
  client,
  to,
}) => {
  const content = (
    <div className="py-2 px-3 text-sm text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
      <span className="font-medium">{job.title || `Job #${job.id.slice(0, 6)}`}</span>
      <span className="mx-2 opacity-50">•</span>
      <span>{client?.name || 'Unknown'}</span>
    </div>
  );

  if (to) {
    return <Link to={to} className="block">{content}</Link>;
  }

  return content;
};

export default FocusStack;
