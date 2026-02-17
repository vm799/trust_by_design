/**
 * BunkerStatusBadge - Sync Status Indicator
 *
 * Shows the current sync state with a shield/vault metaphor:
 * - Blue/Solid: Data is synced to the cloud
 * - Amber/Pulsing: Data is cryptographically sealed but stored locally (waiting for signal)
 * - Red: Sync failed, needs retry
 *
 * Designed to communicate security and data state at a glance.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { pulseOpacity, pulseOpacityGentle, transitionPulse, spinAnimate, transitionSpin, fadeInDown, pulseScaleGentle } from '../../lib/animations';

type SyncState = 'synced' | 'local' | 'syncing' | 'failed';

interface BunkerStatusBadgeProps {
  /** Current sync state */
  state: SyncState;

  /** Whether the device is offline */
  isOffline?: boolean;

  /** Number of pending items */
  pendingCount?: number;

  /** Show label text */
  showLabel?: boolean;

  /** Size variant */
  size?: 'sm' | 'md' | 'lg';

  /** Optional className */
  className?: string;

  /** Click handler for retry */
  onRetry?: () => void;
}

/**
 * State configurations
 */
const STATE_CONFIGS: Record<SyncState, {
  icon: string;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
  pulse: boolean;
}> = {
  synced: {
    icon: 'cloud_done',
    label: 'Synced',
    color: 'text-primary',
    bgColor: 'bg-primary/20',
    borderColor: 'border-primary/30',
    glowColor: 'shadow-[0_0_10px_rgba(59,130,246,0.4)]',
    pulse: false,
  },
  local: {
    icon: 'shield',
    label: 'Local Vault',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    borderColor: 'border-amber-500/30',
    glowColor: 'shadow-[0_0_10px_rgba(245,158,11,0.4)]',
    pulse: true,
  },
  syncing: {
    icon: 'sync',
    label: 'Syncing',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    borderColor: 'border-cyan-500/30',
    glowColor: 'shadow-[0_0_10px_rgba(34,211,238,0.4)]',
    pulse: false,
  },
  failed: {
    icon: 'sync_problem',
    label: 'Sync Failed',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/30',
    glowColor: 'shadow-[0_0_10px_rgba(239,68,68,0.4)]',
    pulse: true,
  },
};

/**
 * Size configurations
 */
const SIZE_CONFIGS = {
  sm: {
    container: 'px-2 py-1 rounded-lg',
    icon: 'text-sm',
    text: 'text-[10px]',
    badge: 'size-5 rounded-full',
  },
  md: {
    container: 'px-3 py-1.5 rounded-xl',
    icon: 'text-base',
    text: 'text-xs',
    badge: 'size-6 rounded-full',
  },
  lg: {
    container: 'px-4 py-2 rounded-xl',
    icon: 'text-lg',
    text: 'text-sm',
    badge: 'size-8 rounded-full',
  },
};

const BunkerStatusBadge: React.FC<BunkerStatusBadgeProps> = ({
  state,
  isOffline = false,
  pendingCount = 0,
  showLabel = true,
  size = 'md',
  className = '',
  onRetry,
}) => {
  // Override state to 'local' if offline
  const effectiveState = isOffline ? 'local' : state;
  const config = STATE_CONFIGS[effectiveState];
  const sizeConfig = SIZE_CONFIGS[size];

  // Icon-only badge (for compact display)
  if (!showLabel) {
    return (
      <motion.div
        animate={config.pulse ? pulseOpacity : {}}
        transition={config.pulse ? transitionPulse : {}}
        className={`
          ${sizeConfig.badge} flex items-center justify-center
          ${config.bgColor} ${config.borderColor} border
          ${config.glowColor}
          ${className}
        `}
        title={config.label}
      >
        <motion.span
          animate={effectiveState === 'syncing' ? spinAnimate : {}}
          transition={effectiveState === 'syncing' ? transitionSpin : {}}
          className={`material-symbols-outlined ${sizeConfig.icon} ${config.color}`}
        >
          {config.icon}
        </motion.span>
      </motion.div>
    );
  }

  return (
    <motion.div
      animate={config.pulse ? pulseOpacityGentle : {}}
      transition={config.pulse ? transitionPulse : {}}
      className={`
        inline-flex items-center gap-2
        ${sizeConfig.container}
        ${config.bgColor} ${config.borderColor} border
        ${config.glowColor}
        ${className}
      `}
    >
      {/* Icon */}
      <motion.span
        animate={effectiveState === 'syncing' ? spinAnimate : {}}
        transition={effectiveState === 'syncing' ? transitionSpin : {}}
        className={`material-symbols-outlined ${sizeConfig.icon} ${config.color}`}
      >
        {config.icon}
      </motion.span>

      {/* Label */}
      <span className={`font-bold uppercase tracking-wider ${sizeConfig.text} ${config.color}`}>
        {config.label}
      </span>

      {/* Pending count */}
      {pendingCount > 0 && (
        <span className={`${config.bgColor} px-1.5 py-0.5 rounded-full ${sizeConfig.text} ${config.color}`}>
          {pendingCount}
        </span>
      )}

      {/* Retry button for failed state */}
      {effectiveState === 'failed' && onRetry && (
        <button
          onClick={onRetry}
          className="ml-1 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <span className="material-symbols-outlined text-sm text-slate-900 dark:text-white">refresh</span>
        </button>
      )}
    </motion.div>
  );
};

/**
 * BunkerModeBanner - Full-width banner for bunker mode
 */
export const BunkerModeBanner: React.FC<{
  pendingCount?: number;
  className?: string;
}> = React.memo(({ pendingCount = 0, className = '' }) => (
  <motion.div
    initial={fadeInDown.hidden}
    animate={fadeInDown.visible}
    className={`
      flex items-center justify-between gap-4 p-4 rounded-xl
      bg-amber-500/10 border border-amber-500/20
      shadow-[0_0_20px_rgba(245,158,11,0.2)]
      ${className}
    `}
  >
    <div className="flex items-center gap-3">
      <motion.div
        animate={pulseScaleGentle}
        transition={transitionPulse}
        className="size-10 rounded-xl bg-amber-500/20 flex items-center justify-center"
      >
        <span className="material-symbols-outlined text-xl text-amber-400">shield</span>
      </motion.div>
      <div>
        <p className="font-bold text-amber-400">Bunker Mode Active</p>
        <p className="text-xs text-amber-400/70">
          {pendingCount > 0
            ? `${pendingCount} item${pendingCount !== 1 ? 's' : ''} sealed locally, will sync when online`
            : 'Evidence secured in local vault, will sync when online'
          }
        </p>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <span className="material-symbols-outlined text-lg text-amber-400">lock</span>
      <span className="text-xs font-mono text-amber-400/70">AES-256</span>
    </div>
  </motion.div>
));

BunkerModeBanner.displayName = 'BunkerModeBanner';

export default React.memo(BunkerStatusBadge);
