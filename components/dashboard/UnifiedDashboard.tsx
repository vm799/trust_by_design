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

import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useDashboard } from '../../lib/useDashboard';
import { DashboardRole, QueueItem, BackgroundItem } from '../../lib/dashboardState';
import FocusCard, { FocusCardSkeleton } from './FocusCard';
import QueueList, { QueueListSkeleton } from './QueueList';
import BackgroundCollapse, { BackgroundCollapseSkeleton } from './BackgroundCollapse';
import SyncStatusBadge from './SyncStatusBadge';
import { staggerContainer, fadeInUp } from '../../lib/animations';

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
  const {
    state,
    isLoading,
    isOffline,
    isStale,
    refresh,
    role,
  } = useDashboard({ role: roleOverride });

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

  // No data state
  if (!state) {
    return emptyState || <DefaultEmptyState role={role} />;
  }

  // Check for completely empty dashboard
  const isEmpty =
    state.meta.totalJobs === 0 &&
    state.meta.totalTechnicians === 0 &&
    !state.focus &&
    state.queue.length === 0 &&
    state.background.every(s => s.items.length === 0);

  if (isEmpty) {
    return emptyState || <DefaultEmptyState role={role} />;
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className={`space-y-6 pb-20 ${className}`}
    >
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

      {/* FOCUS - Primary attention item */}
      {state.focus && (
        <motion.section variants={fadeInUp}>
          <FocusCard
            entity={state.focus}
            onAction={handleFocusAction}
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
