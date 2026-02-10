/**
 * SoloContractorDashboard - Focus Stack for Self-Employed Workers
 *
 * UX Contract: FOCUS / QUEUE / BACKGROUND (strict)
 * - FOCUS: Current active job with evidence progress + capture CTA (~45%)
 * - QUEUE: Next 3 jobs, system-ordered, each with one action (~35%)
 * - BACKGROUND: Completed jobs count, collapsed (~10%)
 * - ACTIONS: 3 contextual buttons max (~10%)
 *
 * Primary question: "What's my current job, what's next?"
 *
 * Invoicing: Deferred to next release (signposted on roadmap).
 * Solo contractors do NOT assign technicians (they ARE the technician).
 */

import React, { useMemo, useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageContent } from '../../components/layout';
import { Card, ActionButton, LoadingSkeleton, FocusStack, FocusJobRenderProps, QueueJobRenderProps, CollapsedJobRenderProps } from '../../components/ui';
import { EvidenceProgressBar } from '../../components/dashboard';
import { useData } from '../../lib/DataContext';
import { useAuth } from '../../lib/AuthContext';
import { route, ROUTES } from '../../lib/routes';
import { Job } from '../../types';
import { fadeInUp, staggerContainer } from '../../lib/animations';
import { useGlobalKeyboardShortcuts } from '../../hooks/useGlobalKeyboardShortcuts';
import { isReportReady, canDeleteJob } from '../../lib/statusHelpers';
import QuickSearchModal from '../../components/modals/QuickSearchModal';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Format relative time (e.g., "5 min ago", "2h ago")
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const SoloContractorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const { jobs, clients, updateJob, deleteJob, isLoading, error, refresh } = useData();

  // Search modal state (only modal a solo contractor needs)
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  // Keyboard shortcut: Ctrl+K for search
  useGlobalKeyboardShortcuts({
    onSearch: () => setIsSearchModalOpen(true),
    disabled: false,
  });

  // Filter to jobs owned/created by this user
  const myJobs = useMemo(() => {
    return jobs.filter(j =>
      j.technicianId === userId ||
      j.techId === userId ||
      j.techMetadata?.createdByTechId === userId ||
      !j.technicianId
    );
  }, [jobs, userId]);

  // Find the focus job (In Progress) and count completed
  const { focusJobId, completedCount, syncPending } = useMemo(() => {
    const inProgressJob = myJobs.find(j => j.status === 'In Progress');
    const completed = myJobs.filter(j =>
      j.status === 'Complete' || j.status === 'Submitted'
    ).length;
    const pending = myJobs.filter(j => j.syncStatus === 'pending').length;

    return {
      focusJobId: inProgressJob?.id || null,
      completedCount: completed,
      syncPending: pending,
    };
  }, [myJobs]);

  // Queue sorting: last touched → scheduled time
  const sortQueueJobs = useCallback((queueJobs: Job[]) => {
    return [...queueJobs].sort((a, b) => {
      const aUpdated = a.lastUpdated || 0;
      const bUpdated = b.lastUpdated || 0;
      if (Math.abs(aUpdated - bUpdated) > 3600000) {
        return bUpdated - aUpdated;
      }
      const aDate = new Date(a.date).getTime();
      const bDate = new Date(b.date).getTime();
      return aDate - bDate;
    });
  }, []);

  // Navigate to job detail
  const handleContinueFocusJob = useCallback((job: Job) => {
    navigate(route(ROUTES.JOB_DETAIL, { id: job.id }));
  }, [navigate]);

  // ========================================================================
  // RENDER: Focus job (dominant, ~45% screen)
  // UX Contract: Max 1, must be actionable, must explain why it's focus
  // ========================================================================
  const renderFocusJob = useCallback(({ job, client, onContinue }: FocusJobRenderProps) => {
    return (
      <Card className="bg-primary/5 dark:bg-primary/10 border-primary/30">
        <div className="p-2">
          {/* Header with status */}
          <div className="flex items-center gap-3 mb-4">
            <div className="size-14 rounded-2xl bg-primary/20 flex items-center justify-center relative shrink-0">
              <span className="material-symbols-outlined text-2xl text-primary">play_arrow</span>
              <span className="absolute -top-1 -right-1 size-3 bg-primary rounded-full animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-primary uppercase tracking-wide">In Focus</p>
              <p className="font-bold text-slate-900 dark:text-white text-lg truncate">
                {job.title || `Job #${job.id.slice(0, 6)}`}
              </p>
            </div>
          </div>

          {/* Job details */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <span className="material-symbols-outlined text-base">person</span>
              <span className="truncate">{client?.name || 'Unknown client'}</span>
            </div>
            {job.address && (
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <span className="material-symbols-outlined text-base">location_on</span>
                <span className="truncate">{job.address}</span>
              </div>
            )}
            {job.lastUpdated && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span className="material-symbols-outlined text-base">schedule</span>
                <span>Last activity: {formatRelativeTime(job.lastUpdated)}</span>
              </div>
            )}
          </div>

          {/* Evidence progress - clickable segments to capture missing evidence */}
          <div className="mb-4">
            <EvidenceProgressBar
              job={job}
              onSegmentClick={(segmentKey) => {
                if (segmentKey === 'signature') {
                  navigate(route(ROUTES.JOB_DETAIL, { id: job.id }));
                } else {
                  navigate(route(ROUTES.JOB_DETAIL, { id: job.id }) + '/evidence');
                }
              }}
            />
          </div>

          {/* Primary CTAs: Continue + Capture */}
          <div className="flex gap-2">
            <button
              onClick={onContinue}
              className="flex-1 py-4 bg-primary text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all active:scale-98 min-h-[56px]"
            >
              <span className="material-symbols-outlined">play_arrow</span>
              Continue
            </button>
            <Link
              to={route(ROUTES.JOB_DETAIL, { id: job.id }) + '/evidence'}
              className="py-4 px-5 bg-emerald-600 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all active:scale-98 min-h-[56px] hover:bg-emerald-700"
            >
              <span className="material-symbols-outlined">photo_camera</span>
              Capture
            </Link>
          </div>
        </div>
      </Card>
    );
  }, []);

  // ========================================================================
  // RENDER: Queue job (compact, read-only)
  // UX Contract: Max 3, ordered by urgency, each with one action
  // ========================================================================
  const renderQueueJob = useCallback(({ job, client, position }: QueueJobRenderProps) => {
    return (
      <Link to={route(ROUTES.JOB_DETAIL, { id: job.id })}>
        <Card variant="interactive">
          <div className="flex items-center gap-4">
            {/* Position */}
            <div className="size-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{position}</span>
            </div>

            {/* Job info */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-900 dark:text-white truncate">
                {job.title || `Job #${job.id.slice(0, 6)}`}
              </p>
              <p className="text-sm text-slate-500 truncate">{client?.name || 'Unknown'}</p>
              {/* Compact evidence bar */}
              <div className="mt-1.5">
                <EvidenceProgressBar job={job} compact />
              </div>
            </div>

            {/* Time */}
            <div className="text-right shrink-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {new Date(job.date).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="text-xs text-slate-500">
                {new Date(job.date).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>
        </Card>
      </Link>
    );
  }, []);

  // ========================================================================
  // RENDER: Collapsed job (minimal, scroll-only)
  // UX Contract: Background - collapsed by default, no alerts
  // ========================================================================
  const renderCollapsedJob = useCallback(({ job, client }: CollapsedJobRenderProps) => (
    <Link
      to={route(ROUTES.JOB_DETAIL, { id: job.id })}
      className="block py-2.5 px-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors"
    >
      <div className="flex items-center justify-between">
        <span className="text-slate-600 dark:text-slate-400 truncate">
          <span className="font-medium text-slate-900 dark:text-white">
            {job.title || `Job #${job.id.slice(0, 6)}`}
          </span>
          <span className="mx-2 opacity-50">&middot;</span>
          <span>{client?.name || 'Unknown'}</span>
        </span>
        <span className="text-xs text-slate-400 shrink-0 ml-2">
          {new Date(job.date).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}
        </span>
      </div>
    </Link>
  ), []);

  // Loading state
  if (isLoading) {
    return (
      <div className="px-4 lg:px-8 py-8">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    );
  }

  // Error state with retry (UX Contract: every data fetch needs ErrorState)
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

  // Empty state
  if (myJobs.length === 0) {
    return (
      <PageContent>
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="size-20 rounded-[2rem] bg-primary/10 flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-4xl text-primary">add_task</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Ready to work?</h3>
          <p className="text-slate-400 text-sm mb-6 max-w-xs">
            Create your first job to start capturing evidence and building your audit trail.
          </p>
          <ActionButton variant="primary" icon="add" to={ROUTES.JOB_CREATE}>
            Create First Job
          </ActionButton>
        </div>
      </PageContent>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="px-4 lg:px-8 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-white">My Jobs</h1>
          {syncPending > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/20 rounded-lg">
              <span className="material-symbols-outlined text-sm text-amber-400 animate-pulse">sync</span>
              <span className="text-xs font-medium text-amber-400">{syncPending}</span>
            </div>
          )}
        </div>
        <ActionButton variant="primary" icon="add" to={ROUTES.JOB_CREATE}>
          New Job
        </ActionButton>
      </div>

      <PageContent>
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* Focus Stack: 1 Focus + 3 Queue + Collapsed */}
          <FocusStack
            jobs={myJobs}
            clients={clients}
            focusJobId={focusJobId}
            renderFocusJob={renderFocusJob}
            renderQueueJob={renderQueueJob}
            renderCollapsedJob={renderCollapsedJob}
            onContinueFocusJob={handleContinueFocusJob}
            maxQueueSize={3}
            sortQueue={sortQueueJobs}
            showCollapsed={true}
            queueHeader={
              <h2 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">queue</span>
                Up Next
              </h2>
            }
            collapsedHeader="More jobs"
          />

          {/* Completed Jobs - Actions first, report only when evidence complete */}
          {completedCount > 0 && (
            <motion.section
              variants={fadeInUp}
              className="pt-4 border-t border-white/5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-500">check_circle</span>
                  <span className="text-sm font-medium text-white">Completed</span>
                  <span className="text-xs text-slate-400 font-bold">({completedCount})</span>
                </div>
                <Link
                  to={`${ROUTES.JOBS}?status=review`}
                  className="text-xs text-slate-400 hover:text-white transition-colors min-h-[44px] flex items-center gap-1"
                >
                  View all <span className="material-symbols-outlined text-xs">chevron_right</span>
                </Link>
              </div>
              {/* Show up to 3 recent completed jobs with actions */}
              <div className="space-y-2">
                {myJobs
                  .filter(j => j.status === 'Complete' || j.status === 'Submitted')
                  .slice(0, 3)
                  .map(job => {
                    const client = clients.find(c => c.id === job.clientId);
                    const reportReady = isReportReady(job);
                    const deletable = canDeleteJob(job);

                    return (
                      <Card key={job.id} padding="sm">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="size-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-sm text-emerald-400">check_circle</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {job.title || `Job #${job.id.slice(0, 6)}`}
                            </p>
                            <p className="text-xs text-slate-400 truncate">{client?.name || 'Unknown'}</p>
                          </div>
                        </div>
                        {/* Actions row - actions first, report conditional */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              updateJob({ ...job, status: 'Archived', archivedAt: new Date().toISOString(), isArchived: true });
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-xs font-medium min-h-[44px] hover:bg-slate-600 transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">inventory_2</span>
                            Archive
                          </button>
                          {deletable && (
                            <button
                              onClick={() => deleteJob(job.id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium min-h-[44px] hover:bg-red-500/20 transition-colors"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                              Delete
                            </button>
                          )}
                          {reportReady ? (
                            <Link
                              to={route(ROUTES.JOB_DETAIL, { id: job.id })}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-medium min-h-[44px] hover:bg-emerald-500/20 transition-colors ml-auto"
                            >
                              <span className="material-symbols-outlined text-sm">description</span>
                              Report
                            </Link>
                          ) : (
                            <Link
                              to={route(ROUTES.JOB_DETAIL, { id: job.id })}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-400 text-xs font-medium min-h-[44px] hover:bg-slate-700 transition-colors ml-auto"
                            >
                              <span className="material-symbols-outlined text-sm">visibility</span>
                              View
                            </Link>
                          )}
                        </div>
                      </Card>
                    );
                  })}
              </div>
            </motion.section>
          )}

          {/* Contextual Actions: 3 max, 56px touch targets */}
          <motion.section variants={fadeInUp}>
            <div className="grid grid-cols-3 gap-3">
              <Link
                to={ROUTES.JOB_CREATE}
                className="min-h-[56px] px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-sm font-semibold rounded-xl transition-colors flex flex-col items-center justify-center gap-1 focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Create new job"
              >
                <span className="material-symbols-outlined text-lg">add_circle</span>
                <span className="text-xs">New Job</span>
              </Link>
              <button
                onClick={() => setIsSearchModalOpen(true)}
                className="min-h-[56px] px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-xl transition-colors flex flex-col items-center justify-center gap-1 focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Search jobs (Ctrl+K)"
              >
                <span className="material-symbols-outlined text-lg">search</span>
                <span className="text-xs">Search</span>
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

      {/* Search Modal (only modal a solo contractor needs) */}
      <QuickSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
      />
    </div>
  );
};

export default SoloContractorDashboard;
