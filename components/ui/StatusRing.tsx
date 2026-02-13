/**
 * StatusRing - SVG Gauge for Operational Capacity
 *
 * Displays a circular progress ring showing job completion status.
 * Tap to toggle between count ("7 of 10") and percentage ("70%") views.
 *
 * Color states:
 *   > 75% complete = emerald (green)
 *   40-75% complete = amber
 *   < 40% complete = red
 */

import React, { useState, useMemo } from 'react';

interface StatusRingProps {
  totalJobs: number;
  completedJobs: number;
  activeJobs: number;
  pendingJobs: number;
  className?: string;
}

const RADIUS = 36;
const STROKE_WIDTH = 6;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CENTER = 44;
const SIZE = 88;

function getColorClass(percentage: number): string {
  if (percentage >= 75) return 'stroke-emerald-500';
  if (percentage >= 40) return 'stroke-amber-500';
  return 'stroke-red-500';
}

function getTextColorClass(percentage: number): string {
  if (percentage >= 75) return 'text-emerald-400';
  if (percentage >= 40) return 'text-amber-400';
  return 'text-red-400';
}

const StatusRing: React.FC<StatusRingProps> = React.memo(({
  totalJobs,
  completedJobs,
  className = '',
}) => {
  const [showPercentage, setShowPercentage] = useState(false);

  const percentage = useMemo(() => {
    if (totalJobs === 0) return 0;
    return Math.round((completedJobs / totalJobs) * 100);
  }, [completedJobs, totalJobs]);

  const strokeDashoffset = useMemo(() => {
    const progress = totalJobs === 0 ? 0 : completedJobs / totalJobs;
    return CIRCUMFERENCE * (1 - progress);
  }, [completedJobs, totalJobs]);

  const colorClass = useMemo(() => getColorClass(percentage), [percentage]);
  const textColorClass = useMemo(() => getTextColorClass(percentage), [percentage]);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Job completion: ${percentage}% — ${completedJobs} of ${totalJobs} complete`}
      className={`relative inline-flex items-center justify-center cursor-pointer min-h-[44px] min-w-[44px] select-none ${className}`}
      onClick={() => setShowPercentage(prev => !prev)}
    >
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="transform -rotate-90"
      >
        {/* Background track */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE_WIDTH}
          className="stroke-slate-800"
        />
        {/* Progress arc */}
        <circle
          data-testid="ring-progress"
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          className={`${colorClass} transition-all duration-700 ease-out`}
        />
      </svg>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {showPercentage ? (
          <span className={`text-base font-black ${textColorClass}`}>
            {percentage}%
          </span>
        ) : (
          <>
            <span className={`text-lg font-black leading-none ${textColorClass}`}>
              {completedJobs}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              of {totalJobs}
            </span>
          </>
        )}
      </div>
    </div>
  );
});

StatusRing.displayName = 'StatusRing';

export default StatusRing;
