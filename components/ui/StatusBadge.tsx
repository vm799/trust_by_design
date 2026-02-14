/**
 * StatusBadge - Status Indicator Badges
 *
 * Displays job/evidence/invoice status with visual distinction.
 * Supports both raw JobStatus values (Title Case) from types.ts
 * and derived UI statuses (lowercase) from getJobStatus().
 *
 * Phase A: Foundation & App Shell
 */

import React from 'react';

// Derived UI statuses (lowercase) used by getJobStatus() in JobDetail
// + Raw JobStatus values (Title Case) from types.ts
// + Invoice/entity statuses for non-job use cases
type StatusType =
  // Derived UI statuses (from getJobStatus in JobDetail)
  | 'draft'
  | 'assigned'
  | 'sent'
  | 'active'
  | 'review'
  | 'sealed'
  | 'invoiced'
  | 'archived'
  | 'pending'
  | 'completed'
  | 'cancelled'
  // Raw JobStatus values (Title Case, from types.ts)
  | 'Draft'
  | 'Pending'
  | 'In Progress'
  | 'Complete'
  | 'Submitted'
  | 'Paused'
  | 'Cancelled'
  | 'Archived'
  // Invoice statuses
  | 'paid'
  | 'overdue'
  | 'Sent'
  | 'Paid'
  | 'Overdue';

interface StatusBadgeProps {
  status: StatusType | string;
  variant?: 'default' | 'compact' | 'dot';
  className?: string;
}

interface StatusConfig {
  label: string;
  icon: string;
  color: string;
  dotColor: string;
}

const defaultConfig: StatusConfig = {
  label: 'Unknown',
  icon: 'help_outline',
  color: 'bg-gray-500/20 text-gray-300 border-gray-500/40',
  dotColor: 'bg-gray-300',
};

const statusConfig: Record<string, StatusConfig> = {
  // === Draft / Not Started ===
  draft: {
    label: 'Draft',
    icon: 'edit_note',
    color: 'bg-gray-500/20 text-gray-300 border-gray-500/40',
    dotColor: 'bg-gray-300',
  },
  Draft: {
    label: 'Draft',
    icon: 'edit_note',
    color: 'bg-gray-500/20 text-gray-300 border-gray-500/40',
    dotColor: 'bg-gray-300',
  },

  // === Pending / Waiting ===
  pending: {
    label: 'Pending',
    icon: 'schedule',
    color: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    dotColor: 'bg-amber-300',
  },
  Pending: {
    label: 'Pending',
    icon: 'schedule',
    color: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    dotColor: 'bg-amber-300',
  },

  // === Assigned (derived UI status) ===
  assigned: {
    label: 'Tech Assigned',
    icon: 'person',
    color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    dotColor: 'bg-indigo-300',
  },

  // === Sent / Link Sent (derived UI status) ===
  sent: {
    label: 'Link Sent',
    icon: 'mark_email_read',
    color: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    dotColor: 'bg-blue-300',
  },

  // === In Progress / Active ===
  active: {
    label: 'In Progress',
    icon: 'pending',
    color: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    dotColor: 'bg-blue-300',
  },
  'In Progress': {
    label: 'In Progress',
    icon: 'pending',
    color: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    dotColor: 'bg-blue-300',
  },

  // === Complete ===
  completed: {
    label: 'Completed',
    icon: 'task_alt',
    color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    dotColor: 'bg-emerald-300',
  },
  Complete: {
    label: 'Complete',
    icon: 'task_alt',
    color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    dotColor: 'bg-emerald-300',
  },

  // === Submitted (for review) ===
  Submitted: {
    label: 'Submitted',
    icon: 'send',
    color: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    dotColor: 'bg-teal-300',
  },
  review: {
    label: 'Review',
    icon: 'rate_review',
    color: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    dotColor: 'bg-purple-300',
  },

  // === Paused ===
  Paused: {
    label: 'Paused',
    icon: 'pause_circle',
    color: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    dotColor: 'bg-orange-300',
  },

  // === Cancelled ===
  cancelled: {
    label: 'Cancelled',
    icon: 'cancel',
    color: 'bg-red-500/20 text-red-300 border-red-500/40',
    dotColor: 'bg-red-300',
  },
  Cancelled: {
    label: 'Cancelled',
    icon: 'cancel',
    color: 'bg-red-500/20 text-red-300 border-red-500/40',
    dotColor: 'bg-red-300',
  },

  // === Archived ===
  archived: {
    label: 'Archived',
    icon: 'archive',
    color: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
    dotColor: 'bg-slate-300',
  },
  Archived: {
    label: 'Archived',
    icon: 'archive',
    color: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
    dotColor: 'bg-slate-300',
  },

  // === Sealed (evidence locked) ===
  sealed: {
    label: 'Sealed',
    icon: 'verified',
    color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    dotColor: 'bg-emerald-300',
  },

  // === Invoice statuses ===
  invoiced: {
    label: 'Invoiced',
    icon: 'receipt',
    color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    dotColor: 'bg-cyan-300',
  },
  paid: {
    label: 'Paid',
    icon: 'check_circle',
    color: 'bg-green-500/20 text-green-300 border-green-500/40',
    dotColor: 'bg-green-300',
  },
  Sent: {
    label: 'Sent',
    icon: 'mark_email_read',
    color: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    dotColor: 'bg-blue-300',
  },
  Paid: {
    label: 'Paid',
    icon: 'check_circle',
    color: 'bg-green-500/20 text-green-300 border-green-500/40',
    dotColor: 'bg-green-300',
  },
  overdue: {
    label: 'Overdue',
    icon: 'warning',
    color: 'bg-red-500/20 text-red-300 border-red-500/40',
    dotColor: 'bg-red-300',
  },
  Overdue: {
    label: 'Overdue',
    icon: 'warning',
    color: 'bg-red-500/20 text-red-300 border-red-500/40',
    dotColor: 'bg-red-300',
  },
};

const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant = 'default',
  className = '',
}) => {
  const config = statusConfig[status] || { ...defaultConfig, label: String(status) };

  if (variant === 'dot') {
    const dotColor = config.dotColor || defaultConfig.dotColor;

    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className={`size-2 rounded-full ${dotColor}`} />
        <span className="text-xs text-slate-300">{config.label}</span>
      </div>
    );
  }

  if (variant === 'compact') {
    // WCAG 2.1 AA: Minimum 44px touch target for field workers (gloved hands)
    return (
      <span className={`
        inline-flex items-center gap-1 px-3 py-2
        text-xs font-medium tracking-wide
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
