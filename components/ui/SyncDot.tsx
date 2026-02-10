/**
 * SyncDot - Compact sync status indicator
 *
 * Visual states derived from job.syncStatus (SyncStatus type):
 *   pending  = hollow amber circle (local-only, awaiting sync)
 *   syncing  = pulsing amber dot (upload in progress)
 *   synced   = solid emerald dot (confirmed in cloud)
 *   failed   = solid red dot (sync error)
 *
 * Used on job cards to give instant visual sync feedback.
 */

import React from 'react';
import type { SyncStatus } from '../../types';

interface SyncDotProps {
  status: SyncStatus;
  showLabel?: boolean;
  className?: string;
}

const DOT_CONFIG: Record<SyncStatus, { dotClass: string; label: string; ariaLabel: string }> = {
  pending: {
    dotClass: 'size-2 rounded-full border-2 border-amber-500 bg-transparent',
    label: 'Pending',
    ariaLabel: 'Sync status: local only, pending upload',
  },
  syncing: {
    dotClass: 'size-2 rounded-full bg-amber-500 animate-pulse',
    label: 'Syncing',
    ariaLabel: 'Sync status: syncing to cloud',
  },
  synced: {
    dotClass: 'size-2 rounded-full bg-emerald-500',
    label: 'Synced',
    ariaLabel: 'Sync status: synced to cloud',
  },
  failed: {
    dotClass: 'size-2 rounded-full bg-red-500',
    label: 'Failed',
    ariaLabel: 'Sync status: failed to sync',
  },
};

const SyncDot: React.FC<SyncDotProps> = React.memo(({ status, showLabel = false, className = '' }) => {
  const config = DOT_CONFIG[status] || DOT_CONFIG.pending;

  if (showLabel) {
    return (
      <span
        aria-label={config.ariaLabel}
        className={`inline-flex items-center gap-1.5 ${className}`}
      >
        <span data-testid="sync-dot" className={config.dotClass} />
        <span className="text-[10px] text-slate-400 font-medium">{config.label}</span>
      </span>
    );
  }

  return (
    <span
      data-testid="sync-dot"
      aria-label={config.ariaLabel}
      className={`${config.dotClass} ${className}`}
    />
  );
});

SyncDot.displayName = 'SyncDot';

export default SyncDot;
