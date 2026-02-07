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
  const { jobs, technicians, isLoading, error } = useData();

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

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-900">
        <p className="font-semibold">Failed to load team status</p>
        <p className="text-sm text-red-700 mt-1">{error}</p>
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
    <div
      className={`
        rounded-xl border-2 p-8
        ${colors.bg} ${colors.border}
        transition-all duration-300
        ${isLoading ? 'opacity-50' : 'opacity-100'}
      `}
    >
      {/* Status Indicator */}
      <div className="flex items-center gap-3 mb-6">
        <div className={`w-3 h-3 rounded-full animate-pulse ${colors.dot}`} />
        <h2 className={`text-lg font-bold ${colors.text}`}>
          {statusLabels[metrics.status]}
        </h2>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-4">
        {/* Technicians */}
        <button
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
        </button>

        {/* Total Jobs */}
        <button
          onClick={onJobsClick}
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
        </button>

        {/* Active Jobs */}
        <div className={`
          p-4 rounded-lg text-left
          bg-white dark:bg-slate-800 bg-opacity-50 dark:bg-opacity-50
        `}>
          <p className={`text-3xl font-black ${colors.text}`}>
            {metrics.activeJobs}
          </p>
          <p className={`text-xs font-semibold uppercase tracking-wide mt-2 ${colors.label}`}>
            In Progress
          </p>
        </div>
      </div>

      {/* Overdue Warning (only show if critical) */}
      {metrics.status === 'critical' && (
        <button
          onClick={onOverdueClick}
          className={`
            mt-6 w-full p-4 rounded-lg
            bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800
            border border-red-300 dark:border-red-700
            text-red-900 dark:text-red-100 font-semibold
            transition-all duration-200 cursor-pointer
            hover:shadow-md
          `}
        >
          ⚠️ {metrics.overdueJobs} Overdue Job{metrics.overdueJobs !== 1 ? 's' : ''} - View →
        </button>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-950/50 rounded-xl">
          <div className="animate-spin">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full" />
          </div>
        </div>
      )}
    </div>
  );
});

TeamStatusHero.displayName = 'TeamStatusHero';

export default TeamStatusHero;
