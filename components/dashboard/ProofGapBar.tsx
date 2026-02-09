/**
 * ProofGapBar - Aggregate evidence health across all jobs
 *
 * Shows "X / Y jobs defensible" with color-coded progress bar.
 * Used on Manager dashboard to answer: "Are we defensible?"
 *
 * UX Contract compliance:
 * - "Counts Must Equal Drill-Down" - number matches actual items
 * - Color semantics: green (>80%), amber (50-79%), red (<50%)
 * - Clickable only when onClick provided
 *
 * Excludes Archived and Cancelled jobs (not active operations).
 */

import React, { useMemo } from 'react';
import { Job } from '../../types';
import { isJobDefensible } from './EvidenceProgressBar';

interface ProofGapBarProps {
  /** All jobs to analyze */
  jobs: Job[];
  /** Additional CSS classes */
  className?: string;
  /** Click handler - when provided, renders as button */
  onClick?: () => void;
}

type ProofStatus = 'good' | 'warning' | 'danger';

const STATUS_COLORS: Record<ProofStatus, {
  bar: string;
  text: string;
  bg: string;
}> = {
  good: {
    bar: 'bg-emerald-500 dark:bg-emerald-400',
    text: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
  },
  warning: {
    bar: 'bg-amber-500 dark:bg-amber-400',
    text: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
  },
  danger: {
    bar: 'bg-red-500 dark:bg-red-400',
    text: 'text-red-700 dark:text-red-300',
    bg: 'bg-red-50 dark:bg-red-950/30',
  },
};

const ACTIVE_STATUSES = ['Pending', 'In Progress', 'Complete', 'Submitted', 'Draft', 'Paused'];

const ProofGapBar: React.FC<ProofGapBarProps> = React.memo(({
  jobs,
  className = '',
  onClick,
}) => {
  const { activeJobs, defensibleCount, total, percentage, status } = useMemo(() => {
    const active = jobs.filter(j => ACTIVE_STATUSES.includes(j.status));
    const defensible = active.filter(isJobDefensible).length;
    const count = active.length;
    const pct = count > 0 ? Math.round((defensible / count) * 100) : 0;

    let s: ProofStatus = 'danger';
    if (count === 0) s = 'good';
    else if (pct >= 80) s = 'good';
    else if (pct >= 50) s = 'warning';

    return {
      activeJobs: active,
      defensibleCount: defensible,
      total: count,
      percentage: pct,
      status: s,
    };
  }, [jobs]);

  const colors = STATUS_COLORS[status];

  // Empty state
  if (total === 0) {
    return (
      <div
        aria-label="Evidence compliance"
        className={`p-4 rounded-xl ${colors.bg} ${className}`}
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-lg text-slate-400 dark:text-slate-500">
            verified_user
          </span>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            No active jobs
          </span>
        </div>
      </div>
    );
  }

  const content = (
    <div
      {...(!onClick ? { 'aria-label': 'Evidence compliance' } : {})}
      data-status={status}
      className={`p-4 rounded-xl ${colors.bg} ${className} ${
        onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`material-symbols-outlined text-lg ${colors.text}`}>
            {status === 'good' ? 'verified_user' : status === 'warning' ? 'shield' : 'gpp_bad'}
          </span>
          <span className={`text-sm font-semibold ${colors.text}`}>
            Evidence Defensible
          </span>
        </div>
        <span className={`text-sm font-bold tabular-nums ${colors.text}`}>
          {defensibleCount} / {total}
        </span>
      </div>

      {/* Progress bar */}
      <div
        role="progressbar"
        aria-valuenow={defensibleCount}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${defensibleCount} of ${total} jobs defensible`}
        className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden"
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Subtitle */}
      {defensibleCount < total && (
        <p className={`text-xs mt-2 ${colors.text} opacity-80`}>
          {total - defensibleCount} job{total - defensibleCount !== 1 ? 's' : ''} need proof
          {onClick && (
            <span className="ml-1">
              <span className="material-symbols-outlined text-xs align-middle">chevron_right</span>
            </span>
          )}
        </p>
      )}
    </div>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="w-full text-left"
        aria-label={`Evidence compliance: ${defensibleCount} of ${total} jobs defensible. Click to view gaps.`}
      >
        {content}
      </button>
    );
  }

  return content;
});

ProofGapBar.displayName = 'ProofGapBar';

export default ProofGapBar;
