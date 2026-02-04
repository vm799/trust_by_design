/**
 * GlassActionTile - Glassmorphic dashboard tile with single action focus
 *
 * Implements the Action-First UX Contract's visual system:
 * - Glassmorphism: translucent dark surface, soft blur, thin light border
 * - Near-black matte base with subtle gradient
 * - Color is STATE ONLY (amber=attention, red=failed, blue=active, green=completed, grey=inactive)
 * - Single obvious action per tile
 * - 44px minimum touch target, 72px overall for field workers with gloves
 */

import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp, hoverLift, tapScale, transitionQuick } from '../../lib/animations';
import SyncStatusBadge from './SyncStatusBadge';

// =============================================================================
// Types
// =============================================================================

export type TileStatus = 'critical' | 'warning' | 'active' | 'success' | 'neutral';
export type TileSyncStatus = 'pending' | 'failed' | 'synced';

export interface TileMetadata {
  label: string;
  value: string | number;
}

export interface GlassActionTileProps {
  /** Primary title text */
  title: string;
  /** Optional secondary text */
  subtitle?: string;
  /** Status determines the accent color */
  status: TileStatus;
  /** Label for the action button */
  actionLabel: string;
  /** Callback when action button is clicked */
  onAction: () => void;
  /** Material Symbol name for the tile icon */
  icon?: string;
  /** Optional metadata key-value pairs */
  metadata?: TileMetadata[];
  /** Sync status indicator */
  syncStatus?: TileSyncStatus;
  /** Enable pulse animation for critical items */
  pulse?: boolean;
  /** Optional additional CSS classes */
  className?: string;
}

// =============================================================================
// Status Configuration
// =============================================================================

/**
 * Status color configuration following the UX Contract:
 * - amber = attention/warning
 * - red = failed/critical
 * - blue = active
 * - green = completed/success
 * - grey = inactive/neutral
 */
const STATUS_CONFIG: Record<TileStatus, {
  border: string;
  iconBg: string;
  iconText: string;
  actionBg: string;
  actionHover: string;
  actionText: string;
  pulseColor: string;
}> = {
  critical: {
    border: 'border-l-red-500',
    iconBg: 'bg-red-500/20',
    iconText: 'text-red-400',
    actionBg: 'bg-red-500',
    actionHover: 'hover:bg-red-400',
    actionText: 'text-white',
    pulseColor: 'bg-red-500',
  },
  warning: {
    border: 'border-l-amber-500',
    iconBg: 'bg-amber-500/20',
    iconText: 'text-amber-400',
    actionBg: 'bg-amber-500',
    actionHover: 'hover:bg-amber-400',
    actionText: 'text-black',
    pulseColor: 'bg-amber-500',
  },
  active: {
    border: 'border-l-blue-500',
    iconBg: 'bg-blue-500/20',
    iconText: 'text-blue-400',
    actionBg: 'bg-blue-500',
    actionHover: 'hover:bg-blue-400',
    actionText: 'text-white',
    pulseColor: 'bg-blue-500',
  },
  success: {
    border: 'border-l-emerald-500',
    iconBg: 'bg-emerald-500/20',
    iconText: 'text-emerald-400',
    actionBg: 'bg-emerald-500',
    actionHover: 'hover:bg-emerald-400',
    actionText: 'text-white',
    pulseColor: 'bg-emerald-500',
  },
  neutral: {
    border: 'border-l-slate-500',
    iconBg: 'bg-slate-500/20',
    iconText: 'text-slate-400',
    actionBg: 'bg-slate-600',
    actionHover: 'hover:bg-slate-500',
    actionText: 'text-white',
    pulseColor: 'bg-slate-500',
  },
};

// =============================================================================
// Component
// =============================================================================

/**
 * GlassActionTile - A glassmorphic tile with a single prominent action
 *
 * @example
 * <GlassActionTile
 *   title="Overdue Jobs"
 *   subtitle="3 jobs need attention"
 *   status="critical"
 *   actionLabel="Review Now"
 *   onAction={() => navigate('/jobs?filter=overdue')}
 *   icon="warning"
 *   pulse
 * />
 */
const GlassActionTile: React.FC<GlassActionTileProps> = ({
  title,
  subtitle,
  status,
  actionLabel,
  onAction,
  icon = 'task_alt',
  metadata,
  syncStatus,
  pulse = false,
  className = '',
}) => {
  const config = STATUS_CONFIG[status];

  const handleAction = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onAction();
    },
    [onAction]
  );

  return (
    <motion.article
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      whileHover={hoverLift}
      whileTap={tapScale}
      transition={transitionQuick}
      className={`
        relative overflow-hidden
        min-h-[72px]
        rounded-2xl
        bg-slate-900/80 backdrop-blur-xl
        border border-white/10
        border-l-4 ${config.border}
        shadow-lg shadow-black/20
        ${className}
      `}
      role="region"
      aria-labelledby={`tile-title-${title.replace(/\s+/g, '-').toLowerCase()}`}
    >
      {/* Subtle gradient overlay for depth */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative flex items-center gap-4 p-4">
        {/* Left: Icon with status-coloured background */}
        <div className={`relative shrink-0 size-12 rounded-xl ${config.iconBg} flex items-center justify-center`}>
          <span className={`material-symbols-outlined text-2xl ${config.iconText}`}>
            {icon}
          </span>

          {/* Pulse indicator for critical/attention items */}
          {pulse && (
            <motion.span
              animate={{ scale: [1, 1.5, 1], opacity: [1, 0.4, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className={`absolute -top-1 -right-1 size-3 rounded-full ${config.pulseColor}`}
              aria-hidden="true"
            />
          )}
        </div>

        {/* Centre: Title, subtitle, and metadata */}
        <div className="flex-1 min-w-0">
          <h3
            id={`tile-title-${title.replace(/\s+/g, '-').toLowerCase()}`}
            className="font-bold text-white truncate text-base leading-tight"
          >
            {title}
          </h3>

          {subtitle && (
            <p className="text-sm text-slate-400 truncate mt-0.5">
              {subtitle}
            </p>
          )}

          {/* Metadata row */}
          {metadata && metadata.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {metadata.map((item) => (
                <span
                  key={item.label}
                  className="text-xs text-slate-500"
                >
                  <span className="text-slate-600">{item.label}:</span>{' '}
                  <span className="text-slate-300 font-medium">{item.value}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right: Sync status and action button */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Sync status indicator */}
          {syncStatus && syncStatus !== 'synced' && (
            <SyncStatusBadge status={syncStatus} compact />
          )}

          {/* Primary action button - 44px+ height for accessibility */}
          <motion.button
            onClick={handleAction}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`
              inline-flex items-center justify-center
              px-4 py-2.5
              min-h-[44px] min-w-[44px]
              rounded-xl
              font-semibold text-sm
              ${config.actionBg} ${config.actionHover} ${config.actionText}
              transition-colors duration-150
              shadow-md shadow-black/20
              focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-slate-900
            `}
            aria-label={`${actionLabel} for ${title}`}
          >
            {actionLabel}
            <span className="material-symbols-outlined text-lg ml-1.5" aria-hidden="true">
              arrow_forward
            </span>
          </motion.button>
        </div>
      </div>
    </motion.article>
  );
};

// Memoize to prevent unnecessary re-renders
export default React.memo(GlassActionTile);
