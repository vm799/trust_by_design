/**
 * UnifiedDashboard - Main dashboard container component
 *
 * Renders the unified dashboard with:
 * - FocusCard (primary attention item)
 * - QueueList (next-up items)
 * - BackgroundCollapse (idle/completed items)
 *
 * Supports all roles: Manager, Technician, Solo Contractor, Client
 *
 * @see /docs/DASHBOARD_IMPLEMENTATION_SPEC.md
 */

import React, { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useDashboard } from '../../lib/useDashboard';
import { useAuth } from '../../lib/AuthContext';
import { useData } from '../../lib/DataContext';
import { DashboardRole, QueueItem, BackgroundItem } from '../../lib/dashboardState';
import { isFeatureEnabled } from '../../lib/featureFlags';
import FocusCard, { FocusCardSkeleton } from './FocusCard';
import QueueList, { QueueListSkeleton } from './QueueList';
import BackgroundCollapse, { BackgroundCollapseSkeleton } from './BackgroundCollapse';
import TeamStatusBar from './TeamStatusBar';
import ReadyToInvoiceSection from './ReadyToInvoiceSection';
import QuickActionCard from './QuickActionCard';
import {
  staggerContainer,
  fadeInUp,
  bgOrb1Animate,
  bgOrb1Transition,
  bgOrb2Animate,
  bgOrb2Transition,
} from '../../lib/animations';

interface UnifiedDashboardProps {
  /** Dashboard role (auto-detected if not provided) */
  role?: DashboardRole;

  /** Optional header content */
  header?: React.ReactNode;

  /** Optional empty state content */
  emptyState?: React.ReactNode;

  /** Optional className for container */
  className?: string;
}

const UnifiedDashboard: React.FC<UnifiedDashboardProps> = ({
  role: roleOverride,
  header,
  emptyState,
  className = '',
}) => {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const { jobs, clients, technicians } = useData();
  const {
    state,
    isLoading,
    isOffline,
    isStale,
    refresh,
    role,
  } = useDashboard({ role: roleOverride });

  // Feature flags for new dashboard sections
  const showTeamStatusBar = isFeatureEnabled('TEAM_STATUS_BAR', userId || undefined);
  const showReadyToInvoice = isFeatureEnabled('READY_TO_INVOICE_SECTION', userId || undefined);

  // Find the actual job object for the focus entity (needed for modal)
  const focusJob = useMemo(() => {
    if (!state?.focus) return null;
    // Focus ID is prefixed with 'job-', extract the actual job ID
    const jobId = state.focus.id.replace('job-', '');
    return jobs.find(j => j.id === jobId) || null;
  }, [state?.focus, jobs]);

  // Compute stats for the quick stats section
  const stats = useMemo(() => {
    const inProgressJobs = jobs.filter(j => j.status === 'In Progress').length;
    const pendingJobs = jobs.filter(j => j.status === 'Pending').length;
    const completedJobs = jobs.filter(j => j.status === 'Complete' || j.status === 'Submitted').length;
    const activeClients = clients.length;
    const activeTechnicians = technicians.filter(t => t.status === 'Available' || t.status === 'On Site').length;

    return {
      totalJobs: jobs.length,
      inProgressJobs,
      pendingJobs,
      completedJobs,
      activeClients,
      activeTechnicians,
      totalTechnicians: technicians.length,
    };
  }, [jobs, clients, technicians]);

  // Navigation handlers
  const handleFocusAction = useCallback(() => {
    if (state?.focus) {
      navigate(state.focus.actionRoute);
    }
  }, [navigate, state?.focus]);

  const handleQueueItemClick = useCallback((item: QueueItem) => {
    navigate(item.route);
  }, [navigate]);

  const handleBackgroundItemClick = useCallback((item: BackgroundItem) => {
    if (item.route) {
      navigate(item.route);
    }
  }, [navigate]);

  // Loading state
  if (isLoading) {
    return (
      <div className={`space-y-6 pb-20 ${className}`}>
        {header}
        <FocusCardSkeleton />
        <QueueListSkeleton count={3} />
        <BackgroundCollapseSkeleton />
      </div>
    );
  }

  // No data state - but for managers, still show Quick Stats/Actions
  if (!state) {
    // For managers, show a minimal dashboard with quick actions even without data
    if (role === 'manager') {
      return (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className={`relative overflow-hidden space-y-6 pb-20 ${className}`}
        >
          {header}
          {/* QUICK STATS - Always show for managers */}
          <motion.section variants={fadeInUp}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <QuickActionCard
                id="stat-jobs"
                title="0"
                subtitle="Total Jobs"
                icon="work"
                statusColor="neutral"
                route="/admin/jobs"
              />
              <QuickActionCard
                id="stat-clients"
                title={`${clients.length}`}
                subtitle="Clients"
                icon="business"
                statusColor={clients.length > 0 ? 'success' : 'neutral'}
                route="/admin/clients"
              />
              <QuickActionCard
                id="stat-technicians"
                title={`${technicians.length}`}
                subtitle="Technicians"
                icon="engineering"
                statusColor={technicians.length > 0 ? 'success' : 'warning'}
                route="/admin/technicians"
              />
              <QuickActionCard
                id="stat-completed"
                title="0"
                subtitle="Completed"
                icon="check_circle"
                statusColor="neutral"
                route="/admin/jobs?status=complete"
              />
            </div>
          </motion.section>
          {/* QUICK ACTIONS */}
          <motion.section variants={fadeInUp}>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <QuickActionCard
                id="action-new-job"
                title="New Job"
                subtitle="Create a new job"
                icon="add_circle"
                statusColor="info"
                route="/admin/jobs/new"
              />
              <QuickActionCard
                id="action-new-client"
                title="New Client"
                subtitle="Add a client"
                icon="person_add"
                statusColor="info"
                route="/admin/clients/new"
              />
              <QuickActionCard
                id="action-new-tech"
                title="Add Technician"
                subtitle="Invite team member"
                icon="group_add"
                statusColor="info"
                route="/admin/technicians/new"
              />
            </div>
          </motion.section>
          {emptyState || <DefaultEmptyState role={role} />}
        </motion.div>
      );
    }
    return emptyState || <DefaultEmptyState role={role} />;
  }

  // Check if work items are empty (focus, queue, background)
  const hasNoWorkItems =
    !state.focus &&
    state.queue.length === 0 &&
    state.background.every(s => s.items.length === 0);

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className={`relative overflow-hidden space-y-6 pb-20 ${className}`}
    >
      {/* Background Orbs - glassmorphism depth effect */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <motion.div
          className="absolute -top-48 -left-48 size-96 rounded-full bg-emerald-500/10 blur-[120px]"
          animate={bgOrb1Animate}
          transition={bgOrb1Transition}
        />
        <motion.div
          className="absolute -bottom-48 -right-48 size-96 rounded-full bg-primary/10 blur-[120px]"
          animate={bgOrb2Animate}
          transition={bgOrb2Transition}
        />
      </div>

      {/* Optional header */}
      {header}

      {/* Offline/Stale banner */}
      {(isOffline || isStale) && (
        <OfflineBanner
          isOffline={isOffline}
          isStale={isStale}
          onRetry={refresh}
        />
      )}

      {/* Sync status summary */}
      {(state.meta.syncPending > 0 || state.meta.syncFailed > 0) && (
        <SyncSummaryBanner
          pending={state.meta.syncPending}
          failed={state.meta.syncFailed}
          onRetry={refresh}
        />
      )}

      {/* TEAM STATUS - Technician work status (feature flagged) */}
      {showTeamStatusBar && role === 'manager' && (
        <motion.section variants={fadeInUp}>
          <TeamStatusBar />
        </motion.section>
      )}

      {/* READY TO INVOICE - Completed jobs awaiting invoicing (feature flagged) */}
      {showReadyToInvoice && role === 'manager' && (
        <motion.section variants={fadeInUp}>
          <ReadyToInvoiceSection />
        </motion.section>
      )}

      {/* QUICK STATS - Clickable overview cards */}
      {role === 'manager' && (
        <motion.section variants={fadeInUp}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <QuickActionCard
              id="stat-jobs"
              title={`${stats.totalJobs}`}
              subtitle="Total Jobs"
              icon="work"
              statusColor={stats.inProgressJobs > 0 ? 'info' : 'neutral'}
              route="/admin/jobs"
              badge={stats.inProgressJobs > 0 ? `${stats.inProgressJobs} active` : undefined}
            />
            <QuickActionCard
              id="stat-clients"
              title={`${stats.activeClients}`}
              subtitle="Clients"
              icon="business"
              statusColor="success"
              route="/admin/clients"
            />
            <QuickActionCard
              id="stat-technicians"
              title={`${stats.activeTechnicians}`}
              subtitle="Technicians"
              icon="engineering"
              statusColor={stats.activeTechnicians > 0 ? 'success' : 'warning'}
              route="/admin/technicians"
              badge={stats.totalTechnicians > stats.activeTechnicians ? `${stats.totalTechnicians} total` : undefined}
            />
            <QuickActionCard
              id="stat-completed"
              title={`${stats.completedJobs}`}
              subtitle="Completed"
              icon="check_circle"
              statusColor="success"
              route="/admin/jobs?status=complete"
            />
          </div>
        </motion.section>
      )}

      {/* QUICK ACTIONS - Create new items */}
      {role === 'manager' && (
        <motion.section variants={fadeInUp}>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <QuickActionCard
              id="action-new-job"
              title="New Job"
              subtitle="Create a new job"
              icon="add_circle"
              statusColor="info"
              route="/admin/jobs/new"
            />
            <QuickActionCard
              id="action-new-client"
              title="New Client"
              subtitle="Add a client"
              icon="person_add"
              statusColor="info"
              route="/admin/clients/new"
            />
            <QuickActionCard
              id="action-new-tech"
              title="Add Technician"
              subtitle="Invite team member"
              icon="group_add"
              statusColor="info"
              route="/admin/technicians/new"
            />
          </div>
        </motion.section>
      )}

      {/* FOCUS - Primary attention item with modal */}
      {state.focus && (
        <motion.section variants={fadeInUp}>
          <FocusCard
            entity={state.focus}
            onAction={handleFocusAction}
            job={focusJob}
            enableModal={true}
          />
        </motion.section>
      )}

      {/* QUEUE - Next up items */}
      {state.queue.length > 0 && (
        <motion.section variants={fadeInUp}>
          <QueueList
            items={state.queue}
            onItemClick={handleQueueItemClick}
          />
        </motion.section>
      )}

      {/* BACKGROUND - Collapsed sections */}
      {state.background.map(section => (
        <motion.section key={section.id} variants={fadeInUp}>
          <BackgroundCollapse
            section={section}
            onItemClick={handleBackgroundItemClick}
          />
        </motion.section>
      ))}

      {/* NO WORK ITEMS - Show helpful message when queue is empty */}
      {hasNoWorkItems && role === 'manager' && (
        <motion.section variants={fadeInUp}>
          <div className="rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-white/10 p-8 text-center">
            <div className="size-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl text-emerald-400">check_circle</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">All Caught Up!</h3>
            <p className="text-slate-400 text-sm mb-6">
              No jobs need attention right now. Use the quick actions above to get started.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <QuickActionCard
                id="empty-new-job"
                title="Create First Job"
                subtitle="Start tracking work"
                icon="add_circle"
                statusColor="info"
                route="/admin/jobs/new"
              />
            </div>
          </div>
        </motion.section>
      )}
    </motion.div>
  );
};

/**
 * OfflineBanner - Displays offline/stale data warning
 */
const OfflineBanner: React.FC<{
  isOffline: boolean;
  isStale: boolean;
  onRetry: () => void;
}> = React.memo(({ isOffline, isStale, onRetry }) => (
  <motion.div
    variants={fadeInUp}
    className={`
      flex items-center justify-between gap-4 p-4 rounded-xl
      ${isStale
        ? 'bg-amber-500/10 border border-amber-500/20'
        : 'bg-slate-500/10 border border-slate-500/20'
      }
    `}
  >
    <div className="flex items-center gap-3">
      <span className={`material-symbols-outlined text-xl ${isStale ? 'text-amber-500' : 'text-slate-500'}`}>
        {isOffline ? 'cloud_off' : 'sync_problem'}
      </span>
      <div>
        <p className={`text-sm font-bold ${isStale ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'}`}>
          {isOffline ? 'Offline Mode' : 'Data may be outdated'}
        </p>
        <p className="text-xs text-slate-500">
          {isStale
            ? 'Last synced more than 5 minutes ago'
            : 'Working with cached data'
          }
        </p>
      </div>
    </div>
    {!isOffline && (
      <button
        onClick={onRetry}
        className={`
          px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide
          ${isStale
            ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/30'
            : 'bg-slate-500/20 text-slate-600 dark:text-slate-400 hover:bg-slate-500/30'
          }
          transition-colors min-h-[44px]
        `}
      >
        Refresh
      </button>
    )}
  </motion.div>
));

OfflineBanner.displayName = 'OfflineBanner';

/**
 * SyncSummaryBanner - Displays sync status summary with retry option
 */
const SyncSummaryBanner: React.FC<{
  pending: number;
  failed: number;
  onRetry: () => void;
}> = React.memo(({ pending, failed, onRetry }) => {
  const hasFailed = failed > 0;

  return (
    <motion.div
      variants={fadeInUp}
      className={`
        flex items-center justify-between gap-4 p-4 rounded-xl
        ${hasFailed
          ? 'bg-red-500/10 border border-red-500/20'
          : 'bg-amber-500/10 border border-amber-500/20'
        }
      `}
    >
      <div className="flex items-center gap-3">
        <span className={`material-symbols-outlined text-xl ${hasFailed ? 'text-red-500' : 'text-amber-500'}`}>
          {hasFailed ? 'sync_problem' : 'sync'}
        </span>
        <div>
          <p className={`text-sm font-bold ${hasFailed ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {hasFailed
              ? `${failed} job${failed !== 1 ? 's' : ''} failed to sync`
              : `${pending} job${pending !== 1 ? 's' : ''} pending sync`
            }
          </p>
          <p className="text-xs text-slate-500">
            {hasFailed
              ? 'Data may be lost - retry recommended'
              : 'Changes will sync when online'
            }
          </p>
        </div>
      </div>
      {hasFailed && (
        <button
          onClick={onRetry}
          className="
            px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide
            bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/30
            transition-colors min-h-[44px]
          "
        >
          Retry
        </button>
      )}
    </motion.div>
  );
});

SyncSummaryBanner.displayName = 'SyncSummaryBanner';

/**
 * DefaultEmptyState - Default empty dashboard state
 */
const DefaultEmptyState: React.FC<{ role: DashboardRole }> = ({ role }) => {
  const navigate = useNavigate();

  const config = {
    manager: {
      icon: 'groups',
      title: 'No Team Activity',
      description: 'Add technicians and create jobs to get started',
      action: 'Add Technician',
      route: '/admin/technicians/new',
    },
    technician: {
      icon: 'inbox',
      title: 'No Jobs Assigned',
      description: 'Your manager will dispatch jobs when ready',
      action: null,
      route: null,
    },
    solo_contractor: {
      icon: 'work',
      title: 'No Jobs Yet',
      description: 'Create your first job to start capturing evidence',
      action: 'Create Job',
      route: '/contractor/jobs/new',
    },
    client: {
      icon: 'folder_open',
      title: 'No Jobs Found',
      description: 'Your jobs will appear here when created',
      action: null,
      route: null,
    },
  }[role];

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="size-20 rounded-[2rem] bg-slate-100 dark:bg-slate-900 flex items-center justify-center mb-6">
        <span className="material-symbols-outlined text-4xl text-slate-400">
          {config.icon}
        </span>
      </div>
      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
        {config.title}
      </h3>
      <p className="text-slate-600 dark:text-slate-400 text-sm max-w-xs mb-6">
        {config.description}
      </p>
      {config.action && config.route && (
        <button
          onClick={() => navigate(config.route!)}
          className="px-6 py-3 bg-primary text-white font-bold rounded-xl text-sm min-h-[44px]"
        >
          {config.action}
        </button>
      )}
    </div>
  );
};

export default React.memo(UnifiedDashboard);
