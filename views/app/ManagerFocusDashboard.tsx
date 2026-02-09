/**
 * ManagerFocusDashboard - Unified Manager Dashboard
 *
 * UX Contract: FOCUS / QUEUE / BACKGROUND (strict)
 * - PROOF GAP BAR: "Are we defensible?" at a glance (~10%)
 * - ATTENTION QUEUE: Only exceptions appear (idle, stuck, sync failed) (~30%)
 * - TECHNICIAN ROWS: Shows counts, not job lists (~40%)
 * - CONTEXTUAL ACTIONS: 3 max (Search, Assign, All Jobs) (~10%)
 *
 * Primary questions: "Who's blocked?" / "Are we defensible?" / "Is crew on track?"
 *
 * Invoicing: Deferred to next release (signposted on roadmap).
 */

import React, { useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PageContent } from '../../components/layout';
import { Card, ActionButton, LoadingSkeleton, FocusStack, FocusJobRenderProps, QueueJobRenderProps, CollapsedJobRenderProps } from '../../components/ui';
import { ProofGapBar } from '../../components/dashboard';
import { useData } from '../../lib/DataContext';
import { route, ROUTES } from '../../lib/routes';
import { Job, Client, Technician, TechnicianSummary, AttentionItem } from '../../types';
import { fadeInUp, staggerContainer, staggerContainerFast } from '../../lib/animations';
import { useGlobalKeyboardShortcuts } from '../../hooks/useGlobalKeyboardShortcuts';
import QuickSearchModal from '../../components/modals/QuickSearchModal';
import QuickAssignModal from '../../components/modals/QuickAssignModal';

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Format time difference for display
 * @param timestampMs Timestamp in milliseconds
 * @returns Human-readable time difference (e.g., "2h ago", "30m ago")
 */
function formatTimeSince(timestampMs: number): string {
  const now = Date.now();
  const diffMs = now - timestampMs;
  const diffMins = Math.round(diffMs / (60 * 1000));
  const diffHours = Math.round(diffMs / (60 * 60 * 1000));
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

// ============================================================================
// ATTENTION DETECTION
// ============================================================================

const STUCK_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours on same job

/**
 * Generate attention items from current state
 * Only exceptions appear - no normal activity
 */
function generateAttentionItems(
  technicians: Technician[],
  jobs: Job[],
  now: number
): AttentionItem[] {
  const items: AttentionItem[] = [];

  technicians.forEach(tech => {
    const techJobs = jobs.filter(j =>
      j.technicianId === tech.id || j.techId === tech.id
    );

    const activeJob = techJobs.find(j => j.status === 'In Progress');
    const pendingJobs = techJobs.filter(j =>
      j.status !== 'Complete' &&
      j.status !== 'Submitted' &&
      j.status !== 'Archived' &&
      j.status !== 'Cancelled'
    );

    // Check for idle technician (no in-progress job, but has pending work)
    if (!activeJob && pendingJobs.length > 0) {
      items.push({
        id: `idle-${tech.id}`,
        type: 'idle_technician',
        technicianId: tech.id,
        technicianName: tech.name,
        message: `${pendingJobs.length} job${pendingJobs.length !== 1 ? 's' : ''} pending`,
        severity: 'warning',
        timestamp: now,
      });
    }

    // Check for stuck job (In Progress for too long)
    if (activeJob) {
      const jobAge = now - (activeJob.lastUpdated || 0);
      if (jobAge > STUCK_THRESHOLD_MS) {
        items.push({
          id: `stuck-${activeJob.id}`,
          type: 'stuck_job',
          technicianId: tech.id,
          technicianName: tech.name,
          jobId: activeJob.id,
          jobTitle: activeJob.title || `Job #${activeJob.id.slice(0, 6)}`,
          message: `In progress for ${Math.round(jobAge / (60 * 60 * 1000))}h`,
          severity: 'warning',
          timestamp: now,
        });
      }
    }

    // Check for sync failures
    const failedJobs = techJobs.filter(j => j.syncStatus === 'failed');
    if (failedJobs.length > 0) {
      items.push({
        id: `sync-${tech.id}`,
        type: 'sync_failed',
        technicianId: tech.id,
        technicianName: tech.name,
        message: `${failedJobs.length} job${failedJobs.length !== 1 ? 's' : ''} failed to sync`,
        severity: 'critical',
        timestamp: now,
      });
    }
  });

  // Check for urgent jobs without assignment
  const urgentUnassigned = jobs.filter(j =>
    j.priority === 'urgent' &&
    !j.technicianId &&
    !j.techId &&
    j.status !== 'Complete' &&
    j.status !== 'Submitted'
  );

  urgentUnassigned.forEach(job => {
    items.push({
      id: `urgent-${job.id}`,
      type: 'urgent_job',
      jobId: job.id,
      jobTitle: job.title || `Job #${job.id.slice(0, 6)}`,
      message: 'Urgent job needs assignment',
      severity: 'critical',
      timestamp: now,
    });
  });

  // Sort by severity (critical first), then by timestamp (newest first)
  return items.sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (b.severity === 'critical' && a.severity !== 'critical') return 1;
    return b.timestamp - a.timestamp;
  });
}

/**
 * Create technician summaries with counts
 */
function createTechnicianSummaries(
  technicians: Technician[],
  jobs: Job[],
): TechnicianSummary[] {
  return technicians.map(tech => {
    const techJobs = jobs.filter(j =>
      j.technicianId === tech.id || j.techId === tech.id
    );

    const activeJob = techJobs.find(j => j.status === 'In Progress');
    const pendingJobs = techJobs.filter(j =>
      j.status !== 'Complete' &&
      j.status !== 'Submitted' &&
      j.status !== 'Archived' &&
      j.status !== 'Cancelled' &&
      j.id !== activeJob?.id
    );

    // Determine status
    let status: 'working' | 'idle' | 'offline' = 'idle';
    if (activeJob) {
      status = 'working';
    }
    // Could add offline detection based on last activity

    return {
      id: tech.id,
      name: tech.name,
      activeJobId: activeJob?.id || null,
      activeJobTitle: activeJob?.title || (activeJob ? `Job #${activeJob.id.slice(0, 6)}` : undefined),
      jobsRemaining: pendingJobs.length,
      lastActivityAt: activeJob?.lastUpdated || 0,
      status,
    };
  });
}

// ============================================================================
// TECHNICIAN DRILL-DOWN COMPONENT
// ============================================================================

interface TechnicianDrillDownProps {
  technician: Technician;
  jobs: Job[];
  clients: Client[];
  onClose: () => void;
}

const TechnicianDrillDown: React.FC<TechnicianDrillDownProps> = ({
  technician,
  jobs,
  clients,
  onClose,
}) => {
  const techJobs = useMemo(() =>
    jobs.filter(j => j.technicianId === technician.id || j.techId === technician.id),
    [jobs, technician.id]
  );

  const focusJobId = useMemo(() => {
    const activeJob = techJobs.find(j => j.status === 'In Progress');
    return activeJob?.id || null;
  }, [techJobs]);

  const sortQueueJobs = useCallback((queueJobs: Job[]) => {
    return [...queueJobs].sort((a, b) => {
      const aDate = new Date(a.date).getTime();
      const bDate = new Date(b.date).getTime();
      if (aDate !== bDate) return aDate - bDate;
      return (b.lastUpdated || 0) - (a.lastUpdated || 0);
    });
  }, []);

  // Render functions for drill-down FocusStack
  const renderFocusJob = useCallback(({ job, client }: FocusJobRenderProps) => (
    <Link to={route(ROUTES.JOB_DETAIL, { id: job.id })}>
      <Card className="bg-primary/5 dark:bg-primary/10 border-primary/30">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary">play_arrow</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-primary">Active</p>
            <p className="font-medium text-slate-900 dark:text-white truncate">
              {job.title || `Job #${job.id.slice(0, 6)}`}
            </p>
            <p className="text-sm text-slate-500 truncate">{client?.name}</p>
          </div>
        </div>
      </Card>
    </Link>
  ), []);

  const renderQueueJob = useCallback(({ job, client, position }: QueueJobRenderProps) => (
    <Link to={route(ROUTES.JOB_DETAIL, { id: job.id })}>
      <Card variant="interactive" padding="sm">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-400">{position}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
              {job.title || `Job #${job.id.slice(0, 6)}`}
            </p>
            <p className="text-xs text-slate-500 truncate">{client?.name}</p>
          </div>
        </div>
      </Card>
    </Link>
  ), []);

  const renderCollapsedJob = useCallback(({ job, client }: CollapsedJobRenderProps) => (
    <Link
      to={route(ROUTES.JOB_DETAIL, { id: job.id })}
      className="block py-1.5 px-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
    >
      {job.title || `Job #${job.id.slice(0, 6)}`}
      <span className="mx-1.5 opacity-50">•</span>
      {client?.name || 'Unknown'}
    </Link>
  ), []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-white/5">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">engineering</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">{technician.name}</h3>
              <p className="text-sm text-slate-500">{techJobs.length} total jobs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center min-h-[44px]"
          >
            <span className="material-symbols-outlined text-slate-500">close</span>
          </button>
        </div>

        {/* Content - Focus Stack */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          <FocusStack
            jobs={techJobs}
            clients={clients}
            focusJobId={focusJobId}
            renderFocusJob={renderFocusJob}
            renderQueueJob={renderQueueJob}
            renderCollapsedJob={renderCollapsedJob}
            onContinueFocusJob={() => {}}
            maxQueueSize={3}
            sortQueue={sortQueueJobs}
            emptyState={
              <div className="text-center py-8 text-slate-500">
                <span className="material-symbols-outlined text-3xl mb-2">work_off</span>
                <p>No active jobs</p>
              </div>
            }
          />
        </div>
      </motion.div>
    </motion.div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const ManagerFocusDashboard: React.FC = () => {
  const { jobs, clients, technicians, isLoading, error, refresh } = useData();
  const [selectedTechnician, setSelectedTechnician] = useState<Technician | null>(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedJobForAssign, setSelectedJobForAssign] = useState<Job | null>(null);

  useGlobalKeyboardShortcuts({
    onSearch: () => setIsSearchModalOpen(true),
    onAssign: () => {
      setSelectedJobForAssign(null);
      setIsAssignModalOpen(true);
    },
    disabled: false,
  });

  const now = Date.now();

  // Generate attention items and technician summaries
  const { attentionItems, technicianSummaries } = useMemo(() => {
    return {
      attentionItems: generateAttentionItems(technicians, jobs, now),
      technicianSummaries: createTechnicianSummaries(technicians, jobs),
    };
  }, [technicians, jobs, now]);

  // Counts for header
  const { totalPending, totalActive, totalComplete } = useMemo(() => {
    const pending = jobs.filter(j =>
      j.status !== 'Complete' &&
      j.status !== 'Submitted' &&
      j.status !== 'In Progress'
    ).length;
    const active = jobs.filter(j => j.status === 'In Progress').length;
    const complete = jobs.filter(j =>
      j.status === 'Complete' || j.status === 'Submitted'
    ).length;

    return { totalPending: pending, totalActive: active, totalComplete: complete };
  }, [jobs]);

  // Loading state
  if (isLoading) {
    return (
      <div className="px-4 lg:px-8 py-8">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <PageContent>
        <Card className="text-center py-8">
          <span className="material-symbols-outlined text-4xl text-red-400 mb-4">error</span>
          <p className="text-white font-medium mb-2">Failed to load data</p>
          <p className="text-slate-400 text-sm mb-4">{error}</p>
          <ActionButton variant="secondary" onClick={refresh} icon="refresh">
            Retry
          </ActionButton>
        </Card>
      </PageContent>
    );
  }

  return (
    <div>
      {/* Header with counts */}
      <div className="px-4 lg:px-8 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-white">Team Overview</h1>
          <div className="hidden sm:flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-emerald-500" />
              {totalActive} active
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-amber-500" />
              {totalPending} pending
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-blue-500" />
              {totalComplete} done
            </span>
          </div>
        </div>
        <ActionButton variant="primary" icon="add" to={ROUTES.JOB_NEW}>
          New Job
        </ActionButton>
      </div>

      <PageContent>
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-8"
        >
          {/* PROOF GAP BAR - "Are we defensible?" */}
          <motion.section variants={fadeInUp}>
            <ProofGapBar jobs={jobs} />
          </motion.section>

          {/* ATTENTION QUEUE - Critical exceptions only */}
          {attentionItems.length > 0 && (
            <motion.section variants={fadeInUp}>
              <div className="flex items-center gap-3 mb-4">
                <div className="size-8 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-red-400">priority_high</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Needs Attention</h2>
                  <p className="text-xs text-slate-400">
                    {attentionItems.length} item{attentionItems.length !== 1 ? 's' : ''} requiring action
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {attentionItems.slice(0, 5).map(item => (
                  <Card
                    key={item.id}
                    variant="interactive"
                    className={item.severity === 'critical' ? 'border-red-500/30' : 'border-amber-500/30'}
                    onClick={() => {
                      if (item.technicianId) {
                        const tech = technicians.find(t => t.id === item.technicianId);
                        if (tech) setSelectedTechnician(tech);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${
                        item.severity === 'critical'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        <span className="material-symbols-outlined text-lg">
                          {item.type === 'idle_technician' ? 'person_off' :
                           item.type === 'stuck_job' ? 'schedule' :
                           item.type === 'sync_failed' ? 'sync_problem' :
                           item.type === 'urgent_job' ? 'bolt' : 'warning'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">
                          {item.technicianName || item.jobTitle}
                        </p>
                        <p className="text-sm text-slate-400 truncate">{item.message}</p>
                      </div>
                      <span className="material-symbols-outlined text-slate-500 shrink-0">chevron_right</span>
                    </div>
                  </Card>
                ))}
              </div>
            </motion.section>
          )}

          {/* TECHNICIAN ROWS - Counts, not lists */}
          <motion.section variants={fadeInUp}>
            <div className="flex items-center gap-3 mb-4">
              <div className="size-8 rounded-xl bg-primary/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">group</span>
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Technicians</h2>
                <p className="text-xs text-slate-400">
                  {technicians.length} team member{technicians.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {technicians.length === 0 ? (
              <Card className="text-center py-8">
                <span className="material-symbols-outlined text-3xl text-slate-500 mb-2">group_off</span>
                <p className="text-slate-400 text-sm mb-4">No technicians yet</p>
                <ActionButton variant="secondary" to={ROUTES.TECHNICIAN_NEW} icon="person_add">
                  Add Technician
                </ActionButton>
              </Card>
            ) : (
              <motion.div
                variants={staggerContainerFast}
                initial="hidden"
                animate="visible"
                className="space-y-2"
              >
                {technicianSummaries.map(summary => (
                  <motion.div key={summary.id} variants={fadeInUp}>
                    <Card
                      variant="interactive"
                      onClick={() => {
                        const tech = technicians.find(t => t.id === summary.id);
                        if (tech) setSelectedTechnician(tech);
                      }}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        {/* Status indicator */}
                        <div className={`size-12 rounded-xl flex items-center justify-center shrink-0 ${
                          summary.status === 'working'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : summary.status === 'idle'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-slate-500/20 text-slate-400'
                        }`}>
                          <span className="material-symbols-outlined">
                            {summary.status === 'working' ? 'engineering' :
                             summary.status === 'idle' ? 'hourglass_empty' : 'wifi_off'}
                          </span>
                        </div>

                        {/* Technician info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">{summary.name}</p>
                          {summary.activeJobTitle ? (
                            <p className="text-sm text-emerald-400 truncate">
                              Working: {summary.activeJobTitle}
                            </p>
                          ) : summary.status === 'offline' ? (
                            <p className="text-sm text-slate-500">
                              Last seen: {formatTimeSince(summary.lastActivityAt)}
                            </p>
                          ) : (
                            <p className="text-sm text-slate-400">No active job</p>
                          )}
                        </div>

                        {/* Jobs remaining count */}
                        <div className="text-center shrink-0">
                          <p className="text-lg font-bold text-white">{summary.jobsRemaining}</p>
                          <p className="text-xs text-slate-500">remaining</p>
                        </div>

                        <span className="material-symbols-outlined text-slate-500 shrink-0">chevron_right</span>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </motion.section>

          {/* ALL CAUGHT UP STATE */}
          {attentionItems.length === 0 && technicians.length > 0 && (
            <motion.section variants={fadeInUp}>
              <Card className="text-center py-8">
                <div className="size-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-3xl text-emerald-400">verified_user</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Team Running Smoothly</h3>
                <p className="text-slate-400 text-sm">
                  No items need attention. All technicians on track.
                </p>
              </Card>
            </motion.section>
          )}

          {/* Contextual Actions: 3 max, 56px touch targets */}
          <motion.section variants={fadeInUp}>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setIsSearchModalOpen(true)}
                className="min-h-[56px] px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-xl transition-colors flex flex-col items-center justify-center gap-1 focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Search jobs (Ctrl+K)"
              >
                <span className="material-symbols-outlined text-lg">search</span>
                <span className="text-xs">Search</span>
              </button>
              <button
                onClick={() => {
                  setSelectedJobForAssign(null);
                  setIsAssignModalOpen(true);
                }}
                className="min-h-[56px] px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-sm font-semibold rounded-xl transition-colors flex flex-col items-center justify-center gap-1 focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Assign technician (Ctrl+A)"
              >
                <span className="material-symbols-outlined text-lg">person_add</span>
                <span className="text-xs">Assign</span>
              </button>
              <Link
                to={ROUTES.JOBS}
                className="min-h-[56px] px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-xl transition-colors flex flex-col items-center justify-center gap-1 focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="View all jobs"
              >
                <span className="material-symbols-outlined text-lg">list_alt</span>
                <span className="text-xs">All Jobs</span>
              </Link>
            </div>
          </motion.section>
        </motion.div>
      </PageContent>

      {/* Modals (Search + Assign only; invoicing deferred to next release) */}
      <QuickSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
      />
      <QuickAssignModal
        isOpen={isAssignModalOpen}
        jobId={selectedJobForAssign?.id}
        onClose={() => {
          setIsAssignModalOpen(false);
          setSelectedJobForAssign(null);
        }}
        onSuccess={() => {
          refresh();
        }}
      />

      {/* Technician Drill-Down Modal */}
      <AnimatePresence>
        {selectedTechnician && (
          <TechnicianDrillDown
            technician={selectedTechnician}
            jobs={jobs}
            clients={clients}
            onClose={() => setSelectedTechnician(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ManagerFocusDashboard;
