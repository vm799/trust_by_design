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

const STATUS_COLORS: Record<StatusColor, {
  container: string;
  iconBg: string;
  icon: string;
  hover: string;
  pulse: string;
  border: string;
}> = {
  critical: {
    container: 'bg-red-50 dark:bg-red-950/30',
    iconBg: 'bg-red-500/20',
    icon: 'text-red-600 dark:text-red-400',
    hover: 'hover:bg-red-100 dark:hover:bg-red-950/50',
    pulse: 'bg-red-500',
    border: 'border-red-200 dark:border-red-900/50',
  },
  warning: {
    container: 'bg-amber-50 dark:bg-amber-950/30',
    iconBg: 'bg-amber-500/20',
    icon: 'text-amber-600 dark:text-amber-400',
    hover: 'hover:bg-amber-100 dark:hover:bg-amber-950/50',
    pulse: 'bg-amber-500',
    border: 'border-amber-200 dark:border-amber-900/50',
  },
  success: {
    container: 'bg-emerald-50 dark:bg-emerald-950/30',
    iconBg: 'bg-emerald-500/20',
    icon: 'text-emerald-600 dark:text-emerald-400',
    hover: 'hover:bg-emerald-100 dark:hover:bg-emerald-950/50',
    pulse: 'bg-emerald-500',
    border: 'border-emerald-200 dark:border-emerald-900/50',
  },
  info: {
    container: 'bg-blue-50 dark:bg-blue-950/30',
    iconBg: 'bg-blue-500/20',
    icon: 'text-blue-600 dark:text-blue-400',
    hover: 'hover:bg-blue-100 dark:hover:bg-blue-950/50',
    pulse: 'bg-blue-500',
    border: 'border-blue-200 dark:border-blue-900/50',
  },
  neutral: {
    container: 'bg-slate-50 dark:bg-slate-800/50',
    iconBg: 'bg-slate-500/20',
    icon: 'text-slate-600 dark:text-slate-400',
    hover: 'hover:bg-slate-100 dark:hover:bg-slate-800',
    pulse: 'bg-slate-400',
    border: 'border-slate-200 dark:border-slate-700',
  },
};

const QuickActionCard: React.FC<QuickActionCardProps> = ({
  id,
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
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="relative"
    >
      <button
        onClick={handleClick}
        className={`
          w-full flex items-center gap-4 p-4 rounded-xl
          ${colorConfig.container}
          ${colorConfig.border}
          ${colorConfig.hover}
          border-2 transition-all
          group text-left min-h-[72px]
          shadow-sm hover:shadow-md
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
              animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
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
            <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
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

          {/* Desktop: Hidden action buttons appear on hover */}
          {actions.length > 0 && (
            <div className="hidden sm:flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {actions.slice(0, 2).map((action) => (
                <motion.button
                  key={action.label}
                  onClick={(e) => handleAction(action, e)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className={`p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] ${
                    action.variant === 'danger'
                      ? 'text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
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
              className="sm:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 min-h-[44px] min-w-[44px]"
            >
              <span className="material-symbols-outlined">more_vert</span>
            </button>
          ) : (
            <span className="material-symbols-outlined text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMenu(false)}
              className="fixed inset-0 z-40"
            />
            {/* Menu */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              className="absolute top-full right-0 mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 min-w-[180px] overflow-hidden"
            >
              {actions.map((action, i) => (
                <button
                  key={action.label}
                  onClick={(e) => handleAction(action, e)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors min-h-[52px] ${
                    action.variant === 'danger'
                      ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  } ${i > 0 ? 'border-t border-slate-100 dark:border-slate-700' : ''}`}
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
