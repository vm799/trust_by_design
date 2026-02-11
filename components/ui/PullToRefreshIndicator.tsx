/**
 * PullToRefreshIndicator - Visual feedback for pull-to-refresh gesture
 *
 * Shows a sync icon that rotates based on pull progress.
 * Transitions to spinning animation when refresh is triggered.
 */

import React from 'react';

interface PullToRefreshIndicatorProps {
  /** Pull progress ratio 0-1 */
  progress: number;
  /** Whether refresh is in progress */
  isRefreshing: boolean;
  /** Whether user is actively pulling */
  isPulling: boolean;
}

const PullToRefreshIndicator: React.FC<PullToRefreshIndicatorProps> = ({
  progress,
  isRefreshing,
  isPulling,
}) => {
  if (!isPulling && !isRefreshing) return null;

  return (
    <div
      className="flex justify-center py-3 transition-all"
      style={{ opacity: Math.min(progress * 2, 1) }}
    >
      <div className={`
        size-10 rounded-full flex items-center justify-center
        ${isRefreshing ? 'bg-primary/20' : progress >= 1 ? 'bg-emerald-500/20' : 'bg-slate-500/20'}
        transition-colors
      `}>
        <span
          className={`
            material-symbols-outlined text-xl
            ${isRefreshing ? 'text-primary animate-spin' : progress >= 1 ? 'text-emerald-400' : 'text-slate-400'}
          `}
          style={!isRefreshing ? { transform: `rotate(${progress * 360}deg)` } : undefined}
        >
          sync
        </span>
      </div>
    </div>
  );
};

export default React.memo(PullToRefreshIndicator);
