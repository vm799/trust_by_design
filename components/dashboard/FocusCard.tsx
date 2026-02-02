/**
 * FocusCard - Primary attention card for dashboard
 *
 * Displays the single focus entity with:
 * - Severity-based styling (info/warning/critical)
 * - Sync status badge
 * - Primary action button (44px+ touch target)
 * - Pulsing indicator for non-info severity
 *
 * @see /docs/DASHBOARD_IMPLEMENTATION_SPEC.md
 */

import React from 'react';
import { motion } from 'framer-motion';
import { FocusEntity } from '../../lib/dashboardState';
import SyncStatusBadge from './SyncStatusBadge';
import { fadeInUp } from '../../lib/animations';

interface FocusCardProps {
  /** Focus entity to display */
  entity: FocusEntity;

  /** Action handler for primary button */
  onAction: () => void;

  /** Optional className for container */
  className?: string;
}

/**
 * Severity-based styling configuration
 */
const SEVERITY_CONFIG = {
  info: {
    container: 'bg-primary/5 dark:bg-primary/10 border-primary/30',
    iconBg: 'bg-primary/20',
    iconColor: 'text-primary',
    textColor: 'text-primary',
    pulseColor: 'bg-primary',
  },
  warning: {
    container: 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/30',
    iconBg: 'bg-amber-500/20',
    iconColor: 'text-amber-500',
    textColor: 'text-amber-500',
    pulseColor: 'bg-amber-500',
  },
  critical: {
    container: 'bg-red-500/5 dark:bg-red-500/10 border-red-500/30',
    iconBg: 'bg-red-500/20',
    iconColor: 'text-red-500',
    textColor: 'text-red-500',
    pulseColor: 'bg-red-500',
  },
};

/**
 * Severity-based icon mapping
 */
const SEVERITY_ICONS = {
  info: 'play_arrow',
  warning: 'warning',
  critical: 'priority_high',
};

/**
 * Type-based icon mapping (fallback when severity doesn't apply)
 */
const TYPE_ICONS = {
  job: 'work',
  technician: 'person',
  attention: 'notifications_active',
};

const FocusCard: React.FC<FocusCardProps> = ({
  entity,
  onAction,
  className = '',
}) => {
  const config = SEVERITY_CONFIG[entity.severity];
  const icon = SEVERITY_ICONS[entity.severity] || TYPE_ICONS[entity.type];

  return (
    <motion.div
      variants={fadeInUp}
      className={`rounded-2xl border-2 p-5 transition-all ${config.container} ${className}`}
    >
      <div className="flex items-start gap-4">
        {/* Icon with optional pulse */}
        <div className={`size-14 rounded-2xl flex items-center justify-center relative shrink-0 ${config.iconBg}`}>
          <span className={`material-symbols-outlined text-2xl ${config.iconColor}`}>
            {icon}
          </span>
          {entity.severity !== 'info' && (
            <span className={`absolute -top-1 -right-1 size-3 rounded-full animate-pulse ${config.pulseColor}`} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Reason badge + sync status */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs font-bold uppercase tracking-wide ${config.textColor}`}>
              {entity.reason}
            </span>
            {entity.syncStatus && entity.syncStatus !== 'synced' && (
              <SyncStatusBadge status={entity.syncStatus} />
            )}
          </div>

          {/* Title */}
          <h2 className="font-bold text-slate-900 dark:text-white text-lg truncate">
            {entity.title}
          </h2>

          {/* Subtitle */}
          {entity.subtitle && (
            <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
              {entity.subtitle}
            </p>
          )}

          {/* Metadata badges (photo count, etc.) */}
          {entity.metadata && (
            <div className="flex items-center gap-3 mt-2">
              {typeof entity.metadata.photoCount === 'number' && (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <span className="material-symbols-outlined text-sm">photo_camera</span>
                  {entity.metadata.photoCount} photo{entity.metadata.photoCount !== 1 ? 's' : ''}
                </span>
              )}
              {entity.metadata.hasSignature && (
                <span className="flex items-center gap-1 text-xs text-emerald-500">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  Signed
                </span>
              )}
            </div>
          )}
        </div>

        {/* Action button - 44px minimum touch target */}
        <button
          onClick={onAction}
          className={`
            shrink-0 px-5 py-3 bg-primary text-white font-bold text-sm rounded-xl
            min-h-[44px] min-w-[44px] flex items-center gap-2
            transition-all active:scale-95 shadow-lg shadow-primary/20
            hover:shadow-xl hover:shadow-primary/30
          `}
        >
          {entity.actionLabel}
          <span className="material-symbols-outlined text-lg">chevron_right</span>
        </button>
      </div>
    </motion.div>
  );
};

export default React.memo(FocusCard);

/**
 * FocusCardSkeleton - Loading state for FocusCard
 */
export const FocusCardSkeleton: React.FC = () => (
  <div className="rounded-2xl border-2 border-slate-200 dark:border-white/10 p-5 animate-pulse">
    <div className="flex items-start gap-4">
      <div className="size-14 rounded-2xl bg-slate-200 dark:bg-slate-800 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
      </div>
      <div className="h-11 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl shrink-0" />
    </div>
  </div>
);
