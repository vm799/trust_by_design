/**
 * SyncStatusBadge - Reusable sync status indicator
 *
 * Displays sync status with consistent styling across the dashboard.
 * Supports both full and compact variants for different contexts.
 *
 * @see /docs/DASHBOARD_IMPLEMENTATION_SPEC.md
 */

import React from 'react';
import { SyncStatus } from '../../lib/dashboardState';

interface SyncStatusBadgeProps {
  /** Sync status to display */
  status: SyncStatus;

  /** Compact mode shows only icon, full mode shows icon + label */
  compact?: boolean;

  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Configuration for each sync status
 */
const STATUS_CONFIG: Record<SyncStatus, {
  icon: string;
  label: string;
  className: string;
  animate?: boolean;
}> = {
  synced: {
    icon: 'cloud_done',
    label: 'Synced',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  pending: {
    icon: 'sync',
    label: 'Syncing',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    animate: true,
  },
  failed: {
    icon: 'sync_problem',
    label: 'Failed',
    className: 'bg-red-500/10 text-red-600 dark:text-red-400',
  },
};

/**
 * SyncStatusBadge Component
 *
 * @example
 * // Full badge with label
 * <SyncStatusBadge status="pending" />
 *
 * @example
 * // Compact icon-only
 * <SyncStatusBadge status="failed" compact />
 */
const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({
  status,
  compact = false,
  className = '',
}) => {
  const config = STATUS_CONFIG[status];

  if (compact) {
    return (
      <span
        className={`material-symbols-outlined text-xs ${config.className} ${
          config.animate ? 'animate-spin' : ''
        } ${className}`}
        title={config.label}
        aria-label={config.label}
      >
        {config.icon}
      </span>
    );
  }

  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 rounded
        text-[10px] font-bold uppercase tracking-wider
        ${config.className}
        ${className}
      `}
      aria-label={`Sync status: ${config.label}`}
    >
      <span
        className={`material-symbols-outlined text-xs ${
          config.animate ? 'animate-spin' : ''
        }`}
      >
        {config.icon}
      </span>
      {config.label}
    </span>
  );
};

export default React.memo(SyncStatusBadge);

/**
 * SyncStatusIcon - Icon-only variant for tight spaces
 */
export const SyncStatusIcon: React.FC<{
  status: SyncStatus;
  className?: string;
}> = React.memo(({ status, className = '' }) => {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={`material-symbols-outlined text-sm ${config.className} ${
        config.animate ? 'animate-spin' : ''
      } ${className}`}
      title={config.label}
      aria-label={config.label}
    >
      {config.icon}
    </span>
  );
});

SyncStatusIcon.displayName = 'SyncStatusIcon';

/**
 * getSyncStatusConfig - Helper for custom rendering
 */
export function getSyncStatusConfig(status: SyncStatus) {
  return STATUS_CONFIG[status];
}
