/**
 * QuickActionCard - Enhanced clickable dashboard tile with actions
 *
 * Features:
 * - Color-coded by status (critical/warning/success/info/neutral)
 * - Hover-reveal action buttons (desktop)
 * - Mobile menu for actions
 * - Touch-friendly (56px min height)
 * - Sync status indicator
 * - Pulse animation for critical items
 */

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import SyncStatusBadge from './SyncStatusBadge';
import { hoverLiftSmall, tapScaleSubtle, pulseIndicator, transitionPulse, hoverScaleLarge, tapScale, fadeOverlay, dropdownMenu } from '../../lib/animations';

export type StatusColor = 'critical' | 'warning' | 'success' | 'info' | 'neutral';
export type SyncStatus = 'pending' | 'synced' | 'failed';

export interface QuickAction {
  label: string;
  icon: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
}

interface QuickActionCardProps {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  statusColor: StatusColor;
  syncStatus?: SyncStatus;
  route?: string;
  actions?: QuickAction[];
  onClick?: () => void;
  badge?: string | number;
}

/**
 * Glassmorphism styling configuration
 * - Translucent dark surface with soft blur
 * - Thin light border with colored left accent for status
 * - Color applied to left border accent and icon background (state indication)
 */
const STATUS_COLORS: Record<StatusColor, {
  container: string;
  iconBg: string;
  icon: string;
  hover: string;
  pulse: string;
  leftBorder: string;
}> = {
  critical: {
    container: 'bg-slate-50/70 dark:bg-slate-900/70 backdrop-blur-lg border border-slate-200 dark:border-white/10',
    iconBg: 'bg-red-500/20',
    icon: 'text-red-400',
    hover: 'hover:bg-slate-100 dark:hover:bg-slate-900/80',
    pulse: 'bg-red-500',
    leftBorder: 'border-l-4 border-l-red-500',
  },
  warning: {
    container: 'bg-slate-50/70 dark:bg-slate-900/70 backdrop-blur-lg border border-slate-200 dark:border-white/10',
    iconBg: 'bg-amber-500/20',
    icon: 'text-amber-400',
    hover: 'hover:bg-slate-100 dark:hover:bg-slate-900/80',
    pulse: 'bg-amber-500',
    leftBorder: 'border-l-4 border-l-amber-500',
  },
  success: {
    container: 'bg-slate-50/70 dark:bg-slate-900/70 backdrop-blur-lg border border-slate-200 dark:border-white/10',
    iconBg: 'bg-emerald-500/20',
    icon: 'text-emerald-400',
    hover: 'hover:bg-slate-100 dark:hover:bg-slate-900/80',
    pulse: 'bg-emerald-500',
    leftBorder: 'border-l-4 border-l-emerald-500',
  },
  info: {
    container: 'bg-slate-50/70 dark:bg-slate-900/70 backdrop-blur-lg border border-slate-200 dark:border-white/10',
    iconBg: 'bg-primary/20',
    icon: 'text-primary',
    hover: 'hover:bg-slate-100 dark:hover:bg-slate-900/80',
    pulse: 'bg-primary',
    leftBorder: 'border-l-4 border-l-primary',
  },
  neutral: {
    container: 'bg-slate-50/70 dark:bg-slate-900/70 backdrop-blur-lg border border-slate-200 dark:border-white/10',
    iconBg: 'bg-slate-500/20',
    icon: 'text-slate-500 dark:text-slate-400',
    hover: 'hover:bg-slate-100 dark:hover:bg-slate-900/80',
    pulse: 'bg-slate-400',
    leftBorder: 'border-l-4 border-l-slate-500',
  },
};

const QuickActionCard: React.FC<QuickActionCardProps> = ({
  title,
  subtitle,
  icon,
  statusColor,
  syncStatus,
  route,
  actions = [],
  onClick,
  badge,
}) => {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const colorConfig = STATUS_COLORS[statusColor];

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    } else if (route) {
      navigate(route);
    }
  }, [onClick, route, navigate]);

  const handleAction = useCallback(
    (action: QuickAction, e: React.MouseEvent) => {
      e.stopPropagation();
      action.onClick();
      setShowMenu(false);
    },
    []
  );

  return (
    <motion.div
      whileHover={hoverLiftSmall}
      whileTap={tapScaleSubtle}
      className="relative"
    >
      <button
        onClick={handleClick}
        className={`
          w-full flex items-center gap-4 p-4 rounded-xl
          ${colorConfig.container}
          ${colorConfig.leftBorder}
          ${colorConfig.hover}
          transition-all
          group text-left min-h-[72px]
          shadow-lg shadow-black/10 dark:shadow-black/20 hover:shadow-xl hover:shadow-black/15 dark:hover:shadow-black/30
        `}
      >
        {/* Left: Icon with status indicator */}
        <div className={`relative shrink-0 size-12 rounded-xl ${colorConfig.iconBg} flex items-center justify-center`}>
          <span className={`material-symbols-outlined text-xl ${colorConfig.icon}`}>
            {icon}
          </span>
          {/* Pulse for critical items */}
          {statusColor === 'critical' && (
            <motion.span
              animate={pulseIndicator}
              transition={transitionPulse}
              className={`absolute -top-1 -right-1 size-3 rounded-full ${colorConfig.pulse}`}
            />
          )}
        </div>

        {/* Center: Title + Subtitle */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 dark:text-white truncate text-base">
            {title}
          </p>
          {subtitle && (
            <p className="text-sm text-slate-700 dark:text-slate-300 truncate">
              {subtitle}
            </p>
          )}
        </div>

        {/* Right: Badge, Sync status, Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Badge */}
          {badge !== undefined && (
            <span className={`px-2 py-1 rounded-lg text-xs font-bold ${colorConfig.iconBg} ${colorConfig.icon}`}>
              {badge}
            </span>
          )}

          {/* Sync status */}
          {syncStatus && syncStatus !== 'synced' && (
            <SyncStatusBadge status={syncStatus} compact />
          )}

          {/* Desktop: Action buttons always visible */}
          {actions.length > 0 && (
            <div className="hidden sm:flex gap-1">
              {actions.slice(0, 2).map((action) => (
                <motion.button
                  key={action.label}
                  onClick={(e) => handleAction(action, e)}
                  whileHover={hoverScaleLarge}
                  whileTap={tapScale}
                  className={`p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] ${
                    action.variant === 'danger'
                      ? 'text-red-400 hover:bg-red-500/20'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10'
                  }`}
                  title={action.label}
                >
                  <span className="material-symbols-outlined text-lg">
                    {action.icon}
                  </span>
                </motion.button>
              ))}
            </div>
          )}

          {/* Chevron / Menu button */}
          {actions.length > 0 ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="sm:hidden p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 min-h-[44px] min-w-[44px]"
            >
              <span className="material-symbols-outlined">more_vert</span>
            </button>
          ) : (
            <span className="material-symbols-outlined text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
              chevron_right
            </span>
          )}
        </div>
      </button>

      {/* Mobile menu dropdown */}
      <AnimatePresence>
        {showMenu && actions.length > 0 && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={fadeOverlay.hidden}
              animate={fadeOverlay.visible}
              exit={fadeOverlay.exit}
              onClick={() => setShowMenu(false)}
              className="fixed inset-0 z-40"
            />
            {/* Menu */}
            <motion.div
              initial={dropdownMenu.initial}
              animate={dropdownMenu.animate}
              exit={dropdownMenu.exit}
              className="absolute top-full right-0 mt-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-xl shadow-xl border border-slate-200 dark:border-white/10 z-50 min-w-[180px] overflow-hidden"
            >
              {actions.map((action, i) => (
                <button
                  key={action.label}
                  onClick={(e) => handleAction(action, e)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors min-h-[52px] ${
                    action.variant === 'danger'
                      ? 'text-red-400 hover:bg-red-500/20'
                      : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10'
                  } ${i > 0 ? 'border-t border-slate-200 dark:border-white/10' : ''}`}
                >
                  <span className="material-symbols-outlined text-lg">
                    {action.icon}
                  </span>
                  <span className="font-medium">{action.label}</span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default React.memo(QuickActionCard);
