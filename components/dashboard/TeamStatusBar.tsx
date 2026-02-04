/**
 * TeamStatusBar - Shows real-time technician work status
 *
 * Displays counts of technicians in each state:
 * - Idle: No active jobs
 * - Active: Currently working on a job
 * - Stuck: Job in progress but no recent activity
 * - Completed Today: Finished at least one job today
 *
 * Uses deriveTechWorkStatusCounts from statusHelpers for derived state.
 *
 * @see /lib/statusHelpers.ts
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useData } from '../../lib/DataContext';
import { deriveTechWorkStatusCounts, TechWorkStatus } from '../../lib/statusHelpers';
import { fadeInUp } from '../../lib/animations';

interface StatusItemProps {
  label: string;
  count: number;
  color: string;
  icon: string;
}

const StatusItem: React.FC<StatusItemProps> = ({ label, count, color, icon }) => (
  <div className="flex flex-col items-center gap-1 min-w-[60px]">
    <div
      className={`
        size-10 rounded-xl flex items-center justify-center
        ${color}
      `}
    >
      <span className="material-symbols-outlined text-lg">{icon}</span>
    </div>
    <span className="text-lg font-bold text-slate-900 dark:text-white">{count}</span>
    <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
  </div>
);

const TeamStatusBar: React.FC = () => {
  const { technicians, jobs } = useData();

  // Derive technician work status counts using statusHelpers
  const statusCounts = useMemo(() => {
    return deriveTechWorkStatusCounts(technicians, jobs);
  }, [technicians, jobs]);

  // Don't render if no technicians
  if (technicians.length === 0) {
    return null;
  }

  const statusConfig: Record<TechWorkStatus, { label: string; color: string; icon: string }> = {
    idle: {
      label: 'Idle',
      color: 'bg-slate-100 dark:bg-slate-800 text-slate-500',
      icon: 'hourglass_empty',
    },
    active: {
      label: 'Active',
      color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
      icon: 'engineering',
    },
    stuck: {
      label: 'Stuck',
      color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
      icon: 'warning',
    },
    completed_today: {
      label: 'Done',
      color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
      icon: 'check_circle',
    },
  };

  return (
    <motion.div
      variants={fadeInUp}
      className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">
          Team Status
        </h3>
        <span className="text-xs text-slate-500">
          {technicians.length} technician{technicians.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex items-center justify-around">
        {(Object.keys(statusConfig) as TechWorkStatus[]).map((status) => (
          <StatusItem
            key={status}
            label={statusConfig[status].label}
            count={statusCounts[status]}
            color={statusConfig[status].color}
            icon={statusConfig[status].icon}
          />
        ))}
      </div>
    </motion.div>
  );
};

export default React.memo(TeamStatusBar);
