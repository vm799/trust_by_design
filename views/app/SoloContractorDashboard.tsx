/**
 * SoloContractorDashboard - Focus Stack for Self-Employed Workers
 *
 * Implements Context Thrash Prevention for solo contractors:
 * - IN FOCUS (Dominant): Current active job (~50% screen)
 * - NEXT 3 (QUEUE): System-ordered, no user sorting controls
 * - REST (COLLAPSED): Scroll-only, no affordances
 *
 * Key difference from Technician: Solo contractors self-dispatch,
 * so they need overview without planning overhead.
 */

import React, { useMemo, useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageContent } from '../../components/layout';
import { Card, ActionButton, LoadingSkeleton, FocusStack, FocusJobRenderProps, QueueJobRenderProps, CollapsedJobRenderProps } from '../../components/ui';
import { useData } from '../../lib/DataContext';
import { useAuth } from '../../lib/AuthContext';
import { route, ROUTES } from '../../lib/routes';
import { Job, Client } from '../../types';
import { fadeInUp, staggerContainer } from '../../lib/animations';
import { useGlobalKeyboardShortcuts } from '../../hooks/useGlobalKeyboardShortcuts';
import QuickSearchModal from '../../components/modals/QuickSearchModal';
import QuickAssignModal from '../../components/modals/QuickAssignModal';
import QuickInvoiceModal from '../../components/modals/QuickInvoiceModal';

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

/**
 * Get evidence status summary
 */
function getEvidenceSummary(job: Job): { icon: string; text: string; color: string } {
  const photoCount = job.photos?.length || 0;
  const hasSignature = !!job.signature;

  if (photoCount === 0 && !hasSignature) {
    return { icon: 'photo_camera', text: 'No evidence', color: 'text-slate-400' };
  }
  if (photoCount > 0 && hasSignature) {
    return { icon: 'verified', text: `${photoCount} photos + signature`, color: 'text-emerald-400' };
  }
  if (photoCount > 0) {
    return { icon: 'photo_library', text: `${photoCount} photo${photoCount !== 1 ? 's' : ''}`, color: 'text-amber-400' };
  }
  return { icon: 'draw', text: 'Signature only', color: 'text-amber-400' };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const SoloContractorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const { jobs, clients, isLoading, error, refresh } = useData();

  // Modal state management
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedJobForAssign, setSelectedJobForAssign] = useState<Job | null>(null);

  // Keyboard shortcuts for quick actions
  useGlobalKeyboardShortcuts({
    onSearch: () => setIsSearchModalOpen(true),
    onAssign: () => {
      setSelectedJobForAssign(null);
      setIsAssignModalOpen(true);
    },
    disabled: false,
  });

  // Filter to jobs owned/created by this user
  const myJobs = useMemo(() => {
    return jobs.filter(j =>
      j.technicianId === userId ||
      j.techId === userId ||
      j.techMetadata?.createdByTechId === userId ||
      // For solo contractors, show all their workspace jobs
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
      // Primary: Last updated (most recent first) - favors "last touched"
      const aUpdated = a.lastUpdated || 0;
      const bUpdated = b.lastUpdated || 0;
      if (Math.abs(aUpdated - bUpdated) > 3600000) {
        // If more than 1 hour difference, use lastUpdated
        return bUpdated - aUpdated;
      }

      // Secondary: Scheduled date (earliest first)
      const aDate = new Date(a.date).getTime();
      const bDate = new Date(b.date).getTime();
      return aDate - bDate;
    });
  }, []);

  // Navigate to job
  const handleContinueFocusJob = useCallback((job: Job) => {
    navigate(route(ROUTES.JOB_DETAIL, { id: job.id }));
  }, [navigate]);

  // Render: Focus job (dominant, ~50% screen)
  const renderFocusJob = useCallback(({ job, client, onContinue }: FocusJobRenderProps) => {
    const evidence = getEvidenceSummary(job);

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
            <div className={`flex items-center gap-2 text-sm ${evidence.color}`}>
              <span className="material-symbols-outlined text-base">{evidence.icon}</span>
              <span>{evidence.text}</span>
            </div>
            {job.lastUpdated && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span className="material-symbols-outlined text-base">schedule</span>
                <span>Last activity: {formatRelativeTime(job.lastUpdated)}</span>
              </div>
            )}
          </div>

          {/* Primary CTA */}
          <button
            onClick={onContinue}
            className="w-full py-4 bg-primary text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all active:scale-98 min-h-[56px]"
          >
            <span className="material-symbols-outlined">play_arrow</span>
            Continue Working
          </button>
        </div>
      </Card>
    );
  }, []);

  // Render: Queue job (compact, read-only)
  const renderQueueJob = useCallback(({ job, client, position }: QueueJobRenderProps) => {
    const evidence = getEvidenceSummary(job);

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
              <p className={`text-xs ${evidence.color} flex items-center gap-1 mt-0.5`}>
                <span className="material-symbols-outlined text-xs">{evidence.icon}</span>
                {evidence.text}
              </p>
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

  // Render: Collapsed job (minimal)
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
          <span className="mx-2 opacity-50">•</span>
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
          <ActionButton variant="primary" icon="add" to={ROUTES.JOB_NEW}>
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
        <ActionButton variant="primary" icon="add" to={ROUTES.JOB_NEW}>
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

          {/* Completed Jobs Link */}
          {completedCount > 0 && (
            <motion.section
              variants={fadeInUp}
              className="pt-4 border-t border-white/5"
            >
              <Link
                to={`${ROUTES.JOBS}?status=review`}
                className="flex items-center justify-between py-3 text-slate-400 hover:text-white transition-colors min-h-[44px]"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-500">check_circle</span>
                  <span className="text-sm">Completed Jobs</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{completedCount}</span>
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </div>
              </Link>
            </motion.section>
          )}

          {/* Quick Actions */}
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
                  bg-slate-700 hover:bg-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600
                  text-white text-sm font-semibold
                  rounded-lg
                  transition-colors duration-200
                  flex flex-col items-center justify-center gap-1
                  focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-slate-800
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
                  bg-slate-700 hover:bg-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600
                  text-white text-sm font-semibold
                  rounded-lg
                  transition-colors duration-200
                  flex flex-col items-center justify-center gap-1
                  focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-slate-800
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
                  bg-slate-700 hover:bg-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600
                  text-white text-sm font-semibold
                  rounded-lg
                  transition-colors duration-200
                  flex flex-col items-center justify-center gap-1
                  focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-slate-800
                "
                aria-label="Create invoice"
                title="Create invoice for completed job"
              >
                <span className="material-symbols-outlined text-lg">receipt</span>
                <span className="text-xs">Invoice</span>
              </button>

              {/* Clients Link */}
              <Link
                to={ROUTES.CLIENTS}
                className="
                  min-h-[56px] sm:min-h-[44px]
                  px-3 py-2
                  bg-slate-700 hover:bg-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600
                  text-white text-sm font-semibold
                  rounded-lg
                  transition-colors duration-200
                  flex flex-col items-center justify-center gap-1
                  focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-slate-800
                "
                aria-label="View clients"
                title="View all clients"
              >
                <span className="material-symbols-outlined text-lg">people</span>
                <span className="text-xs">Clients</span>
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
          refresh(); // Refresh dashboard data after successful assignment
        }}
      />

      <QuickInvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        onSuccess={() => {
          refresh(); // Refresh dashboard data after successful invoice creation
        }}
      />
    </div>
  );
};

export default SoloContractorDashboard;
