/**
 * SLACountdown - Time-remaining badge for job cards
 *
 * Displays countdown to job deadline with color-coded urgency:
 *   > 4h = emerald (on track)
 *   1-4h = amber (attention needed)
 *   < 1h = red (urgent)
 *   overdue = red + pulse
 *
 * Updates every 60 seconds. Returns null for empty/invalid deadlines.
 */

import React, { useState, useEffect, useMemo } from 'react';

interface SLACountdownProps {
  deadline: string;
  className?: string;
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Overdue';

  const totalMinutes = Math.floor(ms / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function getColorClasses(ms: number): string {
  if (ms <= 0) return 'bg-red-500/15 text-red-400 border-red-500/20 animate-pulse';
  if (ms < 60 * 60 * 1000) return 'bg-red-500/15 text-red-400 border-red-500/20';
  if (ms < 4 * 60 * 60 * 1000) return 'bg-amber-500/15 text-amber-400 border-amber-500/20';
  return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
}

const SLACountdown: React.FC<SLACountdownProps> = React.memo(({ deadline, className = '' }) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const deadlineMs = useMemo(() => {
    if (!deadline) return null;
    const parsed = new Date(deadline).getTime();
    if (isNaN(parsed)) return null;
    return parsed;
  }, [deadline]);

  if (deadlineMs === null) return null;

  const remaining = deadlineMs - now;
  const label = formatTimeRemaining(remaining);
  const colorClasses = getColorClasses(remaining);

  return (
    <span
      role="timer"
      aria-label={`Time remaining: ${label}`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wide ${colorClasses} ${className}`}
    >
      <span className="material-symbols-outlined text-xs" style={{ fontSize: '12px' }}>
        {remaining <= 0 ? 'warning' : 'schedule'}
      </span>
      {label}
    </span>
  );
});

SLACountdown.displayName = 'SLACountdown';

export default SLACountdown;
