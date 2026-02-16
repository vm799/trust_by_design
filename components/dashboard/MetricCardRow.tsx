/**
 * MetricCardRow - Prominent dashboard metric cards
 *
 * Displays 3-4 large metric cards at the top of any dashboard role.
 * Each card has a bold number, label, accent-colored icon, and tinted background.
 *
 * Research spec: "Top 2-3 metrics should be immediately visible."
 * This component makes metrics available to ALL roles, not just managers.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fadeInUp } from '../../lib/animations';

interface MetricCard {
  /** Display label */
  label: string;
  /** Numeric value */
  value: number;
  /** Material Symbols icon name */
  icon: string;
  /** Semantic color */
  color: 'blue' | 'amber' | 'emerald' | 'red' | 'slate';
  /** Optional route on click */
  route?: string;
  /** Optional delta indicator (e.g., "+2 today") */
  delta?: string;
}

interface MetricCardRowProps {
  metrics: MetricCard[];
  className?: string;
}

const COLOR_MAP = {
  blue: {
    bg: 'bg-white dark:bg-slate-900/80',
    text: 'text-slate-900 dark:text-white',
    icon: 'bg-blue-500/10 text-blue-500',
    border: 'border-slate-200 dark:border-slate-800',
  },
  amber: {
    bg: 'bg-white dark:bg-slate-900/80',
    text: 'text-slate-900 dark:text-white',
    icon: 'bg-amber-500/10 text-amber-500',
    border: 'border-slate-200 dark:border-slate-800',
  },
  emerald: {
    bg: 'bg-white dark:bg-slate-900/80',
    text: 'text-slate-900 dark:text-white',
    icon: 'bg-emerald-500/10 text-emerald-500',
    border: 'border-slate-200 dark:border-slate-800',
  },
  red: {
    bg: 'bg-white dark:bg-slate-900/80',
    text: 'text-slate-900 dark:text-white',
    icon: 'bg-red-500/10 text-red-500',
    border: 'border-slate-200 dark:border-slate-800',
  },
  slate: {
    bg: 'bg-white dark:bg-slate-900/80',
    text: 'text-slate-900 dark:text-white',
    icon: 'bg-slate-500/10 text-slate-400',
    border: 'border-slate-200 dark:border-slate-800',
  },
} as const;

const MetricCardItem: React.FC<{ metric: MetricCard }> = React.memo(({ metric }) => {
  const navigate = useNavigate();
  const colors = COLOR_MAP[metric.color];

  const content = (
    <div className={`
      rounded-2xl border ${colors.border} ${colors.bg} p-4
      ${metric.route ? 'cursor-pointer hover:opacity-90 active:scale-[0.98]' : ''}
      transition-all min-h-[44px]
    `}>
      <div className="flex items-start justify-between mb-2">
        <div className={`size-10 rounded-xl ${colors.icon} flex items-center justify-center`}>
          <span className="material-symbols-outlined text-xl">{metric.icon}</span>
        </div>
        {metric.delta && (
          <span className={`text-xs font-medium ${colors.text} bg-white/10 px-2 py-0.5 rounded-full`}>
            {metric.delta}
          </span>
        )}
      </div>
      <p className={`text-2xl font-extrabold ${colors.text} leading-none mb-1`}>
        {metric.value}
      </p>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
        {metric.label}
      </p>
    </div>
  );

  if (metric.route) {
    return (
      <motion.button
        variants={fadeInUp}
        onClick={() => navigate(metric.route!)}
        className="text-left w-full"
      >
        {content}
      </motion.button>
    );
  }

  return <motion.div variants={fadeInUp}>{content}</motion.div>;
});

MetricCardItem.displayName = 'MetricCardItem';

const MetricCardRow: React.FC<MetricCardRowProps> = ({ metrics, className = '' }) => {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 ${className}`}>
      {metrics.map(metric => (
        <MetricCardItem key={metric.label} metric={metric} />
      ))}
    </div>
  );
};

export default React.memo(MetricCardRow);
