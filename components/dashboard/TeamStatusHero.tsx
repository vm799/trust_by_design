/**
 * TeamStatusHero Component
 *
 * HERO SECTION for dashboard - Shows real-time team operational status.
 * - Displays technician count, active jobs, overdue count
 * - Changes to RED if overdue jobs exist
 * - Clickable sections drill down to details
 * - Uses real DataContext data (no mock data)
 *
 * Affordances:
 * - Clickable areas show cursor:pointer + hover lift
 * - Status color changes based on team state
 * - Color coded: Green (operational) | Amber (caution) | Red (critical)
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useData } from '../../lib/DataContext';
import { designSystem } from '../../lib/designTokens';

interface TeamStatusHeroProps {
  onTechnicianClick?: () => void;
  onJobsClick?: () => void;
  onOverdueClick?: () => void;
}

type TeamStatus = 'operational' | 'caution' | 'critical';

const TeamStatusHero: React.FC<TeamStatusHeroProps> = React.memo(({
  onTechnicianClick,
  onJobsClick,
  onOverdueClick,
}) => {
  const { jobs, technicians, isLoading, error, refresh } = useData();

  // Calculate metrics from real data
  const metrics = useMemo(() => {
    const assignedTechs = technicians.filter(t => t.status === 'active' || t.status === 'available').length;
    const totalJobs = jobs.length;
    const activeJobs = jobs.filter(j => ['In Progress', 'Dispatched'].includes(j.status)).length;
    const overdueJobs = jobs.filter(j => new Date(j.dueDate) < new Date() && !['Complete', 'Submitted', 'Archived'].includes(j.status)).length;

    // Determine status
    let status: TeamStatus = 'operational';
    if (overdueJobs > 0) status = 'critical';
    else if (activeJobs > totalJobs * 0.8) status = 'caution';

    return { assignedTechs, totalJobs, activeJobs, overdueJobs, status };
  }, [jobs, technicians]);

  // Error state with retry
  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-red-50 dark:bg-red-950 border-2 border-red-200 dark:border-red-800 rounded-xl p-6"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-red-900 dark:text-red-100">Failed to load team status</p>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
          </div>
          <button
            onClick={refresh}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors min-h-[44px]"
            aria-label="Retry loading team status"
          >
            Retry
          </button>
        </div>
      </motion.div>
    );
  }

  // Loading skeleton (no mock data)
  if (isLoading) {
    return (
      <div className="rounded-xl border-2 border-slate-200 dark:border-slate-700 p-8 bg-slate-50 dark:bg-slate-800">
        <div className="animate-pulse">
          <div className="h-6 w-48 bg-slate-300 dark:bg-slate-600 rounded mb-6" />
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="p-4 rounded-lg bg-white dark:bg-slate-700">
                <div className="h-10 w-16 bg-slate-300 dark:bg-slate-600 rounded mb-2" />
                <div className="h-4 w-24 bg-slate-300 dark:bg-slate-600 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const statusColors = {
    operational: {
      bg: 'bg-emerald-50 dark:bg-emerald-950',
      border: 'border-emerald-200 dark:border-emerald-800',
      dot: 'bg-emerald-500',
      text: 'text-emerald-900 dark:text-emerald-100',
      label: 'text-emerald-700 dark:text-emerald-300',
    },
    caution: {
      bg: 'bg-amber-50 dark:bg-amber-950',
      border: 'border-amber-200 dark:border-amber-800',
      dot: 'bg-amber-500',
      text: 'text-amber-900 dark:text-amber-100',
      label: 'text-amber-700 dark:text-amber-300',
    },
    critical: {
      bg: 'bg-red-50 dark:bg-red-950',
      border: 'border-red-200 dark:border-red-800',
      dot: 'bg-red-500',
      text: 'text-red-900 dark:text-red-100',
      label: 'text-red-700 dark:text-red-300',
    },
  };

  const colors = statusColors[metrics.status];

  const statusLabels = {
    operational: '🟢 Team Operational',
    caution: '🟡 Caution',
    critical: '🔴 Critical - Overdue Jobs',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`
        rounded-xl border-2 p-8
        ${colors.bg} ${colors.border}
        transition-all duration-300
      `}
    >
      {/* Status Indicator */}
      <motion.div
        className="flex items-center gap-3 mb-6"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <div className={`w-3 h-3 rounded-full animate-pulse ${colors.dot}`} />
        <h2 className={`text-lg font-bold ${colors.text}`}>
          {statusLabels[metrics.status]}
        </h2>
      </motion.div>

      {/* Metrics Grid - Staggered animation */}
      <motion.div
        className="grid grid-cols-3 gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ staggerChildren: 0.1, delayChildren: 0.2 }}
      >
        {/* Technicians */}
        <motion.button
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ y: -4, boxShadow: '0 10px 15px rgba(0,0,0,0.1)' }}
          transition={{ duration: 0.2 }}
          onClick={onTechnicianClick}
          className={`
            p-4 rounded-lg text-left
            bg-white dark:bg-slate-800 bg-opacity-50 dark:bg-opacity-50
            hover:bg-opacity-100 dark:hover:bg-opacity-100
            transition-all duration-200 cursor-pointer
            hover:shadow-md hover:-translate-y-1
          `}
          aria-label={`${metrics.assignedTechs} technicians assigned`}
        >
          <p className={`text-3xl font-black ${colors.text}`}>
            {metrics.assignedTechs}
          </p>
          <p className={`text-xs font-semibold uppercase tracking-wide mt-2 ${colors.label}`}>
            Technicians
          </p>
        </motion.button>

        {/* Total Jobs */}
        <motion.button
          onClick={onJobsClick}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ y: -4, boxShadow: '0 10px 15px rgba(0,0,0,0.1)' }}
          transition={{ duration: 0.2 }}
          className={`
            p-4 rounded-lg text-left
            bg-white dark:bg-slate-800 bg-opacity-50 dark:bg-opacity-50
            hover:bg-opacity-100 dark:hover:bg-opacity-100
            transition-all duration-200 cursor-pointer
            hover:shadow-md hover:-translate-y-1
          `}
          aria-label={`${metrics.totalJobs} total jobs`}
        >
          <p className={`text-3xl font-black ${colors.text}`}>
            {metrics.totalJobs}
          </p>
          <p className={`text-xs font-semibold uppercase tracking-wide mt-2 ${colors.label}`}>
            Total Jobs
          </p>
        </motion.button>

        {/* Active Jobs */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`
            p-4 rounded-lg text-left
            bg-white dark:bg-slate-800 bg-opacity-50 dark:bg-opacity-50
          `}
        >
          <p className={`text-3xl font-black ${colors.text}`}>
            {metrics.activeJobs}
          </p>
          <p className={`text-xs font-semibold uppercase tracking-wide mt-2 ${colors.label}`}>
            In Progress
          </p>
        </motion.div>
      </div>

      </motion.div>

      {/* Overdue Warning (only show if critical) - Animated entrance */}
      {metrics.status === 'critical' && (
        <motion.button
          onClick={onOverdueClick}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          whileHover={{ scale: 1.02 }}
          className={`
            mt-6 w-full p-4 rounded-lg
            bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800
            border border-red-300 dark:border-red-700
            text-red-900 dark:text-red-100 font-semibold
            transition-all duration-200 cursor-pointer
            hover:shadow-md min-h-[44px]
          `}
        >
          ⚠️ {metrics.overdueJobs} Overdue Job{metrics.overdueJobs !== 1 ? 's' : ''} - View →
        </motion.button>
      )}
    </motion.div>
  );
});

TeamStatusHero.displayName = 'TeamStatusHero';

export default TeamStatusHero;
