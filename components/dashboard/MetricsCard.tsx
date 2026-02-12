/**
 * MetricsCard Component
 *
 * Individual metric card showing KPI with trend indicator.
 * - Title + large value
 * - Trend line (↑ green, ↓ amber, → neutral)
 * - Optional click handler for drill-down
 * - Uses real DataContext calculations
 *
 * Affordances:
 * - Clickable with hover lift + shadow
 * - Trend color-coded for quick understanding
 * - Large numbers for scannability
 */

import React from 'react';
import { motion } from 'framer-motion';
import { fadeInScaleMetric, hoverScaleLift, transitionFast } from '../../lib/animations';

interface MetricsCardProps {
  title: string;
  value: string | number;
  trend?: {
    label: string;
    direction: 'up' | 'down' | 'neutral';
    percentage?: number;
  };
  icon?: string;
  onClick?: () => void;
  isLoading?: boolean;
}

const MetricsCard: React.FC<MetricsCardProps> = React.memo(({
  title,
  value,
  trend,
  icon,
  onClick,
  isLoading = false,
}) => {
  const getTrendColor = () => {
    if (!trend) return 'text-slate-500 dark:text-slate-400';
    if (trend.direction === 'up') return 'text-emerald-600 dark:text-emerald-400';
    if (trend.direction === 'down') return 'text-amber-600 dark:text-amber-400';
    return 'text-slate-500 dark:text-slate-400';
  };

  const getTrendIcon = () => {
    if (!trend) return '→';
    if (trend.direction === 'up') return '↑';
    if (trend.direction === 'down') return '↓';
    return '→';
  };

  return (
    <motion.button
      initial={fadeInScaleMetric.initial}
      animate={fadeInScaleMetric.animate}
      whileHover={onClick ? hoverScaleLift : undefined}
      transition={transitionFast}
      onClick={onClick}
      disabled={!onClick}
      className={`
        bg-white dark:bg-slate-800
        border border-slate-200 dark:border-slate-700
        rounded-lg p-6
        transition-all duration-200
        ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-1' : 'cursor-default'}
        ${isLoading ? 'opacity-50' : 'opacity-100'}
        text-left
        min-h-[160px] flex flex-col justify-between
      `}
      aria-label={`${title}: ${value}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        {icon && (
          <span className={`material-symbols-outlined text-2xl text-slate-400 dark:text-slate-500`}>
            {icon}
          </span>
        )}
        {onClick && (
          <span className={`material-symbols-outlined text-lg text-slate-400 dark:text-slate-500`}>
            chevron_right
          </span>
        )}
      </div>

      {/* Value */}
      <div>
        <p className="text-3xl font-black text-slate-900 dark:text-white mb-2">
          {isLoading ? '—' : value}
        </p>

        {/* Title */}
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">
          {title}
        </p>

        {/* Trend */}
        {trend && (
          <p className={`text-xs font-semibold ${getTrendColor()}`}>
            {getTrendIcon()} {trend.label}
            {trend.percentage !== undefined && ` (${trend.percentage}%)`}
          </p>
        )}
      </div>
    </motion.button>
  );
});

MetricsCard.displayName = 'MetricsCard';

export default MetricsCard;
