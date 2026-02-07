/**
 * DashboardSection - Enhanced section wrapper with color delineation
 *
 * Provides visual hierarchy with:
 * - Color-coded headers by section type
 * - Count badges
 * - Action buttons
 * - Collapsible content
 */

import React, { useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeInUp } from '../../lib/animations';

export type SectionType = 'urgent' | 'active' | 'completed' | 'pending' | 'neutral';

interface DashboardSectionProps {
  title: string;
  type: SectionType;
  icon: string;
  count?: number;
  collapsible?: boolean;
  defaultOpen?: boolean;
  action?: {
    label: string;
    icon: string;
    onClick: () => void;
  };
  children: ReactNode;
}

const SECTION_COLORS: Record<SectionType, {
  headerBg: string;
  headerText: string;
  border: string;
  badge: string;
  icon: string;
}> = {
  urgent: {
    headerBg: 'bg-red-100 dark:bg-red-950/40',
    headerText: 'text-red-700 dark:text-red-400',
    border: 'border-red-200 dark:border-red-900/50',
    badge: 'bg-red-500 text-white',
    icon: 'text-red-600 dark:text-red-400',
  },
  active: {
    headerBg: 'bg-emerald-100 dark:bg-emerald-950/40',
    headerText: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-900/50',
    badge: 'bg-emerald-500 text-white',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
  completed: {
    headerBg: 'bg-blue-100 dark:bg-blue-950/40',
    headerText: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-900/50',
    badge: 'bg-blue-500 text-white',
    icon: 'text-blue-600 dark:text-blue-400',
  },
  pending: {
    headerBg: 'bg-amber-100 dark:bg-amber-950/40',
    headerText: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-900/50',
    badge: 'bg-amber-500 text-white',
    icon: 'text-amber-600 dark:text-amber-400',
  },
  neutral: {
    headerBg: 'bg-slate-100 dark:bg-slate-800/50',
    headerText: 'text-slate-700 dark:text-slate-400',
    border: 'border-slate-200 dark:border-slate-700',
    badge: 'bg-slate-500 text-white',
    icon: 'text-slate-600 dark:text-slate-400',
  },
};

const DashboardSection: React.FC<DashboardSectionProps> = ({
  title,
  type,
  icon,
  count,
  collapsible = false,
  defaultOpen = true,
  action,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const colorConfig = SECTION_COLORS[type];

  const HeaderContent = (
    <>
      {/* Icon */}
      <div className={`size-8 rounded-lg ${colorConfig.headerBg} flex items-center justify-center shrink-0`}>
        <span className={`material-symbols-outlined text-lg ${colorConfig.icon}`}>
          {icon}
        </span>
      </div>

      {/* Title */}
      <span className={`font-bold uppercase tracking-wider text-sm ${colorConfig.headerText}`}>
        {title}
      </span>

      {/* Count badge */}
      {count !== undefined && count > 0 && (
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${colorConfig.badge}`}>
          {count}
        </span>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action button */}
      {action && !collapsible && (
        <motion.button
          onClick={(e) => {
            e.stopPropagation();
            action.onClick();
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold ${colorConfig.headerText} hover:bg-white/50 dark:hover:bg-black/20 transition-colors min-h-[44px]`}
        >
          <span className="material-symbols-outlined text-sm">{action.icon}</span>
          {action.label}
        </motion.button>
      )}

      {/* Collapse chevron */}
      {collapsible && (
        <motion.span
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ duration: 0.2 }}
          className={`material-symbols-outlined ${colorConfig.icon}`}
        >
          chevron_right
        </motion.span>
      )}
    </>
  );

  return (
    <motion.section variants={fadeInUp} className="space-y-3">
      {/* Header */}
      {collapsible ? (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${colorConfig.headerBg} ${colorConfig.border} border-2 transition-all hover:shadow-md min-h-[52px]`}
        >
          {HeaderContent}
        </button>
      ) : (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${colorConfig.headerBg} ${colorConfig.border} border-2`}>
          {HeaderContent}
        </div>
      )}

      {/* Content */}
      <AnimatePresence initial={false}>
        {(!collapsible || isOpen) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-2 overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
};

export default React.memo(DashboardSection);
