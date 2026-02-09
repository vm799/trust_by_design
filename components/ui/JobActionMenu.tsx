/**
 * JobActionMenu - Contextual Action Buttons for Jobs
 *
 * Renders the correct set of action buttons based on job status,
 * technician assignment, seal state, and invoice state.
 *
 * Actions by lifecycle stage:
 * - Draft (no tech): Assign, Edit, Delete
 * - Dispatched (has tech, no link): Send Job, Reassign, Edit, Delete
 * - Sent (magic link exists): Remind, Chase, Resend, Reassign, Edit, Delete
 * - In Progress: Chase (if stuck), Edit
 * - Complete/Submitted: Review & Seal, Edit
 * - Sealed: Generate Invoice, View Report
 * - Invoiced: View Report
 *
 * @see CLAUDE.md - Job Status Lifecycle
 */

import React, { useMemo } from 'react';
import { Job, Technician } from '../../types';
import { JOB_STATUS } from '../../lib/constants';

// ============================================================================
// TYPES
// ============================================================================

export type JobAction =
  | 'assign'
  | 'reassign'
  | 'send'
  | 'remind'
  | 'chase'
  | 'review_seal'
  | 'invoice'
  | 'view_report'
  | 'edit'
  | 'delete'
  | 'start';

export interface JobActionConfig {
  action: JobAction;
  label: string;
  icon: string;
  variant: 'primary' | 'secondary' | 'danger' | 'warning' | 'ghost';
  disabled?: boolean;
  tooltip?: string;
}

export interface JobActionMenuProps {
  job: Job;
  technician?: Technician | null;
  onAction: (action: JobAction, job: Job) => void;
  /** Show only primary actions (compact mode for list rows) */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Determine the lifecycle stage of a job for action computation
 */
function getJobStage(job: Job): 'draft' | 'dispatched' | 'sent' | 'active' | 'review' | 'sealed' | 'invoiced' | 'archived' {
  if (job.status === 'Archived') return 'archived';
  if (job.invoiceId) return 'invoiced';
  if (job.sealedAt) return 'sealed';
  if (job.status === 'Complete' || job.status === 'Submitted') return 'review';
  if (job.status === 'In Progress') return 'active';
  if (job.magicLinkUrl) return 'sent';
  if (job.technicianId || job.techId) return 'dispatched';
  return 'draft';
}

/**
 * Check if a job appears "stuck" (in progress for >2 hours)
 */
function isJobStuck(job: Job): boolean {
  if (job.status !== 'In Progress') return false;
  const twoHoursMs = 2 * 60 * 60 * 1000;
  const lastUpdate = job.lastUpdated || 0;
  return (Date.now() - lastUpdate) > twoHoursMs;
}

/**
 * Check if a magic link is expired (>7 days)
 */
function isMagicLinkExpired(job: Job): boolean {
  if (!job.magicLinkCreatedAt) return false;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const createdAt = new Date(job.magicLinkCreatedAt).getTime();
  return (Date.now() - createdAt) > sevenDaysMs;
}

// ============================================================================
// ACTION COMPUTATION
// ============================================================================

/**
 * Compute the available actions for a job based on its current state
 */
export function getJobActions(job: Job, compact: boolean = false): JobActionConfig[] {
  const stage = getJobStage(job);
  const canDelete = !job.sealedAt && !job.invoiceId;
  const actions: JobActionConfig[] = [];

  switch (stage) {
    case 'draft':
      actions.push({
        action: 'assign',
        label: 'Assign Tech',
        icon: 'person_add',
        variant: 'primary',
      });
      if (!compact) {
        actions.push({
          action: 'edit',
          label: 'Edit',
          icon: 'edit',
          variant: 'ghost',
        });
        actions.push({
          action: 'delete',
          label: 'Delete',
          icon: 'delete',
          variant: 'danger',
        });
      }
      break;

    case 'dispatched':
      actions.push({
        action: 'send',
        label: 'Send Job',
        icon: 'send',
        variant: 'primary',
      });
      if (!compact) {
        actions.push({
          action: 'reassign',
          label: 'Reassign',
          icon: 'swap_horiz',
          variant: 'secondary',
        });
        actions.push({
          action: 'edit',
          label: 'Edit',
          icon: 'edit',
          variant: 'ghost',
        });
        if (canDelete) {
          actions.push({
            action: 'delete',
            label: 'Delete',
            icon: 'delete',
            variant: 'danger',
          });
        }
      }
      break;

    case 'sent': {
      const expired = isMagicLinkExpired(job);
      if (expired) {
        actions.push({
          action: 'send',
          label: 'Resend',
          icon: 'refresh',
          variant: 'warning',
          tooltip: 'Link expired - generate new link',
        });
      } else {
        actions.push({
          action: 'remind',
          label: 'Remind',
          icon: 'notifications_active',
          variant: 'primary',
          tooltip: 'Send reminder to technician',
        });
      }
      if (!compact) {
        actions.push({
          action: 'chase',
          label: 'Chase',
          icon: 'speed',
          variant: 'warning',
          tooltip: 'Follow up with technician',
        });
        actions.push({
          action: 'reassign',
          label: 'Reassign',
          icon: 'swap_horiz',
          variant: 'secondary',
        });
        if (canDelete) {
          actions.push({
            action: 'delete',
            label: 'Delete',
            icon: 'delete',
            variant: 'danger',
          });
        }
      }
      break;
    }

    case 'active': {
      const stuck = isJobStuck(job);
      if (stuck) {
        actions.push({
          action: 'chase',
          label: 'Chase',
          icon: 'speed',
          variant: 'warning',
          tooltip: 'Job appears stuck - follow up',
        });
      }
      if (!compact) {
        actions.push({
          action: 'reassign',
          label: 'Reassign',
          icon: 'swap_horiz',
          variant: 'secondary',
        });
        actions.push({
          action: 'edit',
          label: 'Edit',
          icon: 'edit',
          variant: 'ghost',
        });
      }
      break;
    }

    case 'review':
      actions.push({
        action: 'review_seal',
        label: 'Review & Seal',
        icon: 'verified',
        variant: 'primary',
      });
      if (!compact) {
        actions.push({
          action: 'edit',
          label: 'Edit',
          icon: 'edit',
          variant: 'ghost',
        });
      }
      break;

    case 'sealed':
      if (!job.invoiceId) {
        actions.push({
          action: 'invoice',
          label: 'Invoice',
          icon: 'receipt',
          variant: 'primary',
        });
      }
      actions.push({
        action: 'view_report',
        label: 'Report',
        icon: 'description',
        variant: 'secondary',
      });
      break;

    case 'invoiced':
      actions.push({
        action: 'view_report',
        label: 'Report',
        icon: 'description',
        variant: 'secondary',
      });
      break;

    case 'archived':
      actions.push({
        action: 'view_report',
        label: 'Report',
        icon: 'description',
        variant: 'ghost',
      });
      break;
  }

  return actions;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Variant styles mapping
 */
const variantStyles: Record<string, string> = {
  primary: 'bg-primary hover:bg-primary-hover text-white shadow-lg shadow-primary/20',
  secondary: 'bg-slate-700 hover:bg-slate-600 text-white',
  danger: 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20',
  warning: 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20',
  ghost: 'bg-white/5 hover:bg-white/10 text-slate-300',
};

const JobActionMenu: React.FC<JobActionMenuProps> = ({
  job,
  onAction,
  compact = false,
  className = '',
}) => {
  const actions = useMemo(() => getJobActions(job, compact), [job, compact]);

  if (actions.length === 0) return null;

  return (
    <div
      className={`flex items-center gap-2 ${compact ? 'flex-nowrap' : 'flex-wrap'} ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {actions.map((config) => (
        <button
          key={config.action}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onAction(config.action, job);
          }}
          disabled={config.disabled}
          title={config.tooltip || config.label}
          className={`
            inline-flex items-center gap-1.5
            ${compact ? 'px-2.5 py-1.5 text-[10px] rounded-lg min-h-[36px]' : 'px-3 py-2 text-xs rounded-xl min-h-[44px]'}
            font-bold uppercase tracking-wider
            transition-all active:scale-[0.96]
            disabled:opacity-50 disabled:pointer-events-none
            ${variantStyles[config.variant] || variantStyles.ghost}
          `}
        >
          <span className={`material-symbols-outlined ${compact ? 'text-sm' : 'text-base'}`}>
            {config.icon}
          </span>
          {!compact && <span>{config.label}</span>}
          {compact && <span className="hidden sm:inline">{config.label}</span>}
        </button>
      ))}
    </div>
  );
};

export default React.memo(JobActionMenu);
