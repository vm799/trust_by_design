/**
 * StatusBadge - Status Indicator Badges
 *
 * Displays job/evidence status with visual distinction.
 *
 * Phase A: Foundation & App Shell
 */

import React from 'react';

type StatusType =
  | 'draft'
  | 'dispatched'
  | 'active'
  | 'review'
  | 'sealed'
  | 'invoiced'
  | 'paid'
  | 'overdue'
  | 'pending'
  | 'completed'
  | 'cancelled';

interface StatusBadgeProps {
  status: StatusType;
  variant?: 'default' | 'compact' | 'dot';
  className?: string;
}

const statusConfig: Record<StatusType, { label: string; icon: string; color: string }> = {
  draft: {
    label: 'Draft',
    icon: 'edit_note',
    color: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  },
  dispatched: {
    label: 'Dispatched',
    icon: 'send',
    color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  active: {
    label: 'In Progress',
    icon: 'pending',
    color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  review: {
    label: 'Review',
    icon: 'rate_review',
    color: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  },
  sealed: {
    label: 'Sealed',
    icon: 'verified',
    color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  invoiced: {
    label: 'Invoiced',
    icon: 'receipt',
    color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  },
  paid: {
    label: 'Paid',
    icon: 'check_circle',
    color: 'bg-green-500/10 text-green-400 border-green-500/20',
  },
  overdue: {
    label: 'Overdue',
    icon: 'warning',
    color: 'bg-red-500/10 text-red-400 border-red-500/20',
  },
  pending: {
    label: 'Pending',
    icon: 'schedule',
    color: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  },
  completed: {
    label: 'Completed',
    icon: 'task_alt',
    color: 'bg-green-500/10 text-green-400 border-green-500/20',
  },
  cancelled: {
    label: 'Cancelled',
    icon: 'cancel',
    color: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  },
};

const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant = 'default',
  className = '',
}) => {
  const config = statusConfig[status];

  if (!config) {
    return null;
  }

  if (variant === 'dot') {
    const dotColors: Record<StatusType, string> = {
      draft: 'bg-slate-400',
      dispatched: 'bg-blue-400',
      active: 'bg-amber-400',
      review: 'bg-purple-400',
      sealed: 'bg-emerald-400',
      invoiced: 'bg-cyan-400',
      paid: 'bg-green-400',
      overdue: 'bg-red-400',
      pending: 'bg-orange-400',
      completed: 'bg-green-400',
      cancelled: 'bg-slate-500',
    };

    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className={`size-2 rounded-full ${dotColors[status]}`} />
        <span className="text-xs text-slate-300">{config.label}</span>
      </div>
    );
  }

  if (variant === 'compact') {
    // WCAG 2.1 AA: Minimum 44px touch target for field workers (gloved hands)
    return (
      <span className={`
        inline-flex items-center gap-1 px-3 py-2
        text-[10px] font-bold uppercase tracking-wide
        rounded-md border min-h-[44px]
        ${config.color}
        ${className}
      `}>
        {config.label}
      </span>
    );
  }

  return (
    <span className={`
      inline-flex items-center gap-1.5 px-2.5 py-1
      text-xs font-medium
      rounded-lg border
      ${config.color}
      ${className}
    `}>
      <span className="material-symbols-outlined text-sm">{config.icon}</span>
      {config.label}
    </span>
  );
};

export default StatusBadge;
