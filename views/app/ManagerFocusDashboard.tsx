/**
 * ManagerFocusDashboard - Exception-Based Manager Dashboard
 *
 * Implements Context Thrash Prevention for managers:
 * - TECHNICIAN ROWS: Shows counts, not job lists
 * - ATTENTION QUEUE: Only exceptions appear (idle, stuck, rapid switching)
 * - DRILL-DOWN: On demand, shows technician's focus + queue + collapsed
 *
 * Core principle: Manager answers "Who needs attention?" - not "What are all the jobs?"
 */

import React, { useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PageContent } from '../../components/layout';
import { Card, ActionButton, LoadingSkeleton, FocusStack, FocusJobRenderProps, QueueJobRenderProps, CollapsedJobRenderProps } from '../../components/ui';
import { useData } from '../../lib/DataContext';
import { route, ROUTES } from '../../lib/routes';
import { Job, Client, Technician, TechnicianSummary, AttentionItem } from '../../types';
import { fadeInUp, staggerContainer, staggerContainerFast } from '../../lib/animations';
import { useGlobalKeyboardShortcuts } from '../../hooks/useGlobalKeyboardShortcuts';
import QuickSearchModal from '../../components/modals/QuickSearchModal';
import QuickAssignModal from '../../components/modals/QuickAssignModal';
import QuickInvoiceModal from '../../components/modals/QuickInvoiceModal';

// ============================================================================
// ATTENTION DETECTION
// ============================================================================

const IDLE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes without activity
const STUCK_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours on same job
const RAPID_SWITCH_COUNT = 3; // 3+ switches in an hour is concerning

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
  now: number
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
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
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
      technicianSummaries: createTechnicianSummaries(technicians, jobs, now),
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

          {/* Quick Actions Grid */}
          <motion.section variants={fadeInUp}>
            <div
              className="grid grid-cols-2 sm:grid-cols-4 gap-3"
              data-testid="quick-actions-grid"
            >
              {/* Search */}
              <button
                onClick={() => setIsSearchModalOpen(true)}
                className="
                  min-h-[56px] sm:min-h-[44px]
                  px-3 py-2
                  bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600
                  text-white text-sm font-semibold
                  rounded-lg
                  transition-colors duration-200
                  flex flex-col items-center justify-center gap-1
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800
                  shadow-lg shadow-blue-500/20
                "
                aria-label="Search jobs (Ctrl+K)"
                title="Search jobs - Press Ctrl+K"
              >
                <span className="material-symbols-outlined text-lg">search</span>
                <span className="text-xs">Search</span>
              </button>

              {/* Assign Technician */}
              <button
                onClick={() => {
                  setSelectedJobForAssign(null);
                  setIsAssignModalOpen(true);
                }}
                className="
                  min-h-[56px] sm:min-h-[44px]
                  px-3 py-2
                  bg-gradient-to-br from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600
                  text-white text-sm font-semibold
                  rounded-lg
                  transition-colors duration-200
                  flex flex-col items-center justify-center gap-1
                  focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800
                  shadow-lg shadow-purple-500/20
                "
                aria-label="Assign technician (Ctrl+A)"
                title="Assign technician - Press Ctrl+A"
              >
                <span className="material-symbols-outlined text-lg">person_add</span>
                <span className="text-xs">Assign</span>
              </button>

              {/* Create Invoice */}
              <button
                onClick={() => setIsInvoiceModalOpen(true)}
                className="
                  min-h-[56px] sm:min-h-[44px]
                  px-3 py-2
                  bg-gradient-to-br from-emerald-600 to-green-700 hover:from-emerald-500 hover:to-green-600
                  text-white text-sm font-semibold
                  rounded-lg
                  transition-colors duration-200
                  flex flex-col items-center justify-center gap-1
                  focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800
                  shadow-lg shadow-green-500/20
                "
                aria-label="Create invoice"
                title="Create invoice for completed job"
              >
                <span className="material-symbols-outlined text-lg">receipt_long</span>
                <span className="text-xs">Invoice</span>
              </button>

              {/* All Jobs */}
              <Link to={ROUTES.JOBS}>
                <button
                  className="
                    w-full min-h-[56px] sm:min-h-[44px]
                    px-3 py-2
                    bg-gradient-to-br from-orange-600 to-amber-700 hover:from-orange-500 hover:to-amber-600
                    text-white text-sm font-semibold
                    rounded-lg
                    transition-colors duration-200
                    flex flex-col items-center justify-center gap-1
                    focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800
                    shadow-lg shadow-orange-500/20
                  "
                  aria-label="View all jobs"
                  title="View all jobs"
                >
                  <span className="material-symbols-outlined text-lg">list</span>
                  <span className="text-xs">All Jobs</span>
                </button>
              </Link>

              {/* Clients */}
              <Link to={ROUTES.CLIENTS}>
                <button
                  className="
                    w-full min-h-[56px] sm:min-h-[44px]
                    px-3 py-2
                    bg-gradient-to-br from-amber-600 to-yellow-700 hover:from-amber-500 hover:to-yellow-600
                    text-white text-sm font-semibold
                    rounded-lg
                    transition-colors duration-200
                    flex flex-col items-center justify-center gap-1
                    focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800
                    shadow-lg shadow-amber-500/20
                  "
                  aria-label="View clients"
                  title="View clients"
                >
                  <span className="material-symbols-outlined text-lg">people</span>
                  <span className="text-xs">Clients</span>
                </button>
              </Link>

              {/* Technicians */}
              <Link to={ROUTES.TECHNICIANS}>
                <button
                  className="
                    w-full min-h-[56px] sm:min-h-[44px]
                    px-3 py-2
                    bg-gradient-to-br from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600
                    text-white text-sm font-semibold
                    rounded-lg
                    transition-colors duration-200
                    flex flex-col items-center justify-center gap-1
                    focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800
                    shadow-lg shadow-cyan-500/20
                  "
                  aria-label="View technicians"
                  title="View technicians"
                >
                  <span className="material-symbols-outlined text-lg">engineering</span>
                  <span className="text-xs">Technicians</span>
                </button>
              </Link>

              {/* Settings */}
              <Link to={ROUTES.SETTINGS}>
                <button
                  className="
                    w-full min-h-[56px] sm:min-h-[44px]
                    px-3 py-2
                    bg-slate-700 hover:bg-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600
                    text-white text-sm font-semibold
                    rounded-lg
                    transition-colors duration-200
                    flex flex-col items-center justify-center gap-1
                    focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-slate-800
                  "
                  aria-label="Workspace settings"
                  title="Workspace settings"
                >
                  <span className="material-symbols-outlined text-lg">settings</span>
                  <span className="text-xs">Settings</span>
                </button>
              </Link>

              {/* Invoices */}
              <Link to={ROUTES.INVOICES}>
                <button
                  className="
                    w-full min-h-[56px] sm:min-h-[44px]
                    px-3 py-2
                    bg-slate-700 hover:bg-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600
                    text-white text-sm font-semibold
                    rounded-lg
                    transition-colors duration-200
                    flex flex-col items-center justify-center gap-1
                    focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-slate-800
                  "
                  aria-label="View invoices"
                  title="View invoices"
                >
                  <span className="material-symbols-outlined text-lg">receipt</span>
                  <span className="text-xs">Invoices</span>
                </button>
              </Link>
            </div>
          </motion.section>
        </motion.div>
      </PageContent>

      {/* Quick Action Modals */}
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
        onSuccess={(job) => {
          refresh();
        }}
      />
      <QuickInvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
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
