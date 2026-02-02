/**
 * QueueList - Next-up items queue for dashboard
 *
 * Displays queue items (max 5) sorted by urgency.
 * Supports virtualization for large lists (50+ items).
 *
 * Features:
 * - 56px touch targets for field worker gloves
 * - Urgency-sorted display
 * - Sync status badges
 * - Position indicators
 *
 * @see /docs/DASHBOARD_IMPLEMENTATION_SPEC.md
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { QueueItem } from '../../lib/dashboardState';
import SyncStatusBadge from './SyncStatusBadge';
import { fadeInUp, staggerContainer } from '../../lib/animations';

interface QueueListProps {
  /** Queue items to display (should be pre-sorted by urgency) */
  items: QueueItem[];

  /** Click handler for queue items */
  onItemClick: (item: QueueItem) => void;

  /** Enable virtualization for large lists (default: auto based on item count) */
  virtualize?: boolean;

  /** Optional className for container */
  className?: string;
}

const ITEM_HEIGHT = 64; // 56px content + 8px gap
const VIRTUALIZATION_THRESHOLD = 10;

const QueueList: React.FC<QueueListProps> = ({
  items,
  onItemClick,
  virtualize,
  className = '',
}) => {
  // Auto-enable virtualization for large lists
  const shouldVirtualize = virtualize ?? items.length > VIRTUALIZATION_THRESHOLD;

  // For now, use standard rendering (virtualization requires react-window)
  // TODO: Add react-window virtualization when needed for 50+ items
  if (shouldVirtualize && items.length > 50) {
    console.warn('[QueueList] Large list detected. Consider adding react-window for better performance.');
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className={`space-y-2 ${className}`}
    >
      {/* Section header */}
      <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
        <span className="material-symbols-outlined text-sm">queue</span>
        Next Up
        <span className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded text-[10px]">
          {items.length}
        </span>
      </h2>

      {/* Queue items */}
      <div className="space-y-2">
        {items.map((item, index) => (
          <QueueItemCard
            key={item.id}
            item={item}
            position={index + 1}
            onClick={() => onItemClick(item)}
          />
        ))}
      </div>
    </motion.div>
  );
};

interface QueueItemCardProps {
  item: QueueItem;
  position: number;
  onClick: () => void;
}

/**
 * QueueItemCard - Individual queue item display
 */
const QueueItemCard: React.FC<QueueItemCardProps> = React.memo(({
  item,
  position,
  onClick,
}) => {
  // Determine urgency indicator color
  const urgencyColor = useMemo(() => {
    if (item.urgency >= 80) return 'bg-red-500';
    if (item.urgency >= 50) return 'bg-amber-500';
    return 'bg-slate-400';
  }, [item.urgency]);

  // Type-based icon
  const typeIcon = useMemo(() => {
    switch (item.type) {
      case 'job': return 'work';
      case 'technician': return 'person';
      case 'attention': return 'notifications';
      default: return 'circle';
    }
  }, [item.type]);

  return (
    <motion.button
      variants={fadeInUp}
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 p-3
        bg-white dark:bg-slate-900
        border border-slate-200 dark:border-white/5
        rounded-xl
        hover:border-primary/30 dark:hover:border-primary/30
        transition-all active:scale-[0.98]
        min-h-[56px] text-left
        group
      `}
    >
      {/* Position indicator with urgency color */}
      <div className="relative shrink-0">
        <div className={`
          size-10 rounded-xl bg-slate-100 dark:bg-slate-800
          flex items-center justify-center
          text-sm font-bold text-slate-600 dark:text-slate-400
          group-hover:bg-primary/10 group-hover:text-primary
          transition-colors
        `}>
          {position}
        </div>
        {/* Urgency dot */}
        <span className={`absolute -top-0.5 -right-0.5 size-2.5 rounded-full ${urgencyColor}`} />
      </div>

      {/* Type icon */}
      <div className="size-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined text-sm text-slate-500 dark:text-slate-400">
          {typeIcon}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 dark:text-white truncate text-sm group-hover:text-primary transition-colors">
          {item.title}
        </p>
        {item.subtitle && (
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {item.subtitle}
          </p>
        )}
      </div>

      {/* Sync status */}
      {item.syncStatus && item.syncStatus !== 'synced' && (
        <SyncStatusBadge status={item.syncStatus} compact />
      )}

      {/* Chevron */}
      <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-sm group-hover:text-primary transition-colors">
        chevron_right
      </span>
    </motion.button>
  );
});

QueueItemCard.displayName = 'QueueItemCard';

export default React.memo(QueueList);

/**
 * QueueListSkeleton - Loading state for QueueList
 */
export const QueueListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="space-y-2">
    <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="flex items-center gap-3 p-3 bg-slate-100 dark:bg-slate-900 rounded-xl animate-pulse"
      >
        <div className="size-10 rounded-xl bg-slate-200 dark:bg-slate-800" />
        <div className="size-8 rounded-lg bg-slate-200 dark:bg-slate-800" />
        <div className="flex-1 space-y-1">
          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
      </div>
    ))}
  </div>
);
