/**
 * QueueList - Next-up items queue for dashboard
 *
 * Displays queue items (max 5) sorted by urgency.
 * Supports virtualization for large lists (50+ items) via react-window.
 *
 * Features:
 * - 56px touch targets for field worker gloves
 * - Colour-coded urgency display (British English)
 * - Sync status badges
 * - Quick action buttons on tiles
 * - Virtualized rendering for performance
 *
 * @see /docs/DASHBOARD_IMPLEMENTATION_SPEC.md
 */

import React, { useMemo, useCallback, CSSProperties, ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { List } from 'react-window';
import { QueueItem } from '../../lib/dashboardState';
import QuickActionCard, { StatusColor, QuickAction } from './QuickActionCard';
import SyncStatusBadge from './SyncStatusBadge';
import { fadeInUp, staggerContainer } from '../../lib/animations';

interface QueueListProps {
  /** Queue items to display (should be pre-sorted by urgency) */
  items: QueueItem[];

  /** Click handler for queue items */
  onItemClick: (item: QueueItem) => void;

  /** Enable virtualization for large lists (default: auto based on item count) */
  virtualize?: boolean;

  /** Maximum visible height for virtualized list (default: 400px) */
  maxHeight?: number;

  /** Optional className for container */
  className?: string;

  /** Optional action handlers for quick actions */
  onEditItem?: (item: QueueItem) => void;
  onArchiveItem?: (item: QueueItem) => void;
}

/**
 * Convert urgency score to status colour (British English)
 */
const getStatusColour = (urgency: number): StatusColor => {
  if (urgency >= 80) return 'critical';
  if (urgency >= 60) return 'warning';
  if (urgency >= 40) return 'info';
  return 'neutral';
};

/**
 * Get icon based on item type
 */
const getTypeIcon = (type: QueueItem['type']): string => {
  switch (type) {
    case 'job': return 'work';
    case 'technician': return 'person';
    case 'attention': return 'notifications';
    default: return 'circle';
  }
};

const ITEM_HEIGHT = 64; // 56px content + 8px gap
const VIRTUALIZATION_THRESHOLD = 10;
const DEFAULT_MAX_HEIGHT = 400;

const QueueList: React.FC<QueueListProps> = ({
  items,
  onItemClick,
  virtualize,
  maxHeight = DEFAULT_MAX_HEIGHT,
  className = '',
  onEditItem,
  onArchiveItem,
}) => {
  const navigate = useNavigate();

  // Auto-enable virtualization for large lists
  const shouldVirtualize = virtualize ?? items.length > VIRTUALIZATION_THRESHOLD;

  // Generate actions for a queue item
  const getItemActions = useCallback((item: QueueItem): QuickAction[] => {
    const actions: QuickAction[] = [];

    // View/Navigate action
    actions.push({
      label: 'View',
      icon: 'visibility',
      onClick: () => navigate(item.route),
    });

    // Edit action if handler provided
    if (onEditItem) {
      actions.push({
        label: 'Edit',
        icon: 'edit',
        onClick: () => onEditItem(item),
      });
    }

    // Type-specific actions
    if (item.type === 'job') {
      actions.push({
        label: 'Start',
        icon: 'play_arrow',
        onClick: () => navigate(`${item.route}?action=start`),
      });
    } else if (item.type === 'technician') {
      actions.push({
        label: 'Assign',
        icon: 'assignment_ind',
        onClick: () => navigate(`/app/jobs?assignTech=${item.id.replace('tech-', '')}`),
      });
    }

    // Archive action if handler provided (danger variant)
    if (onArchiveItem) {
      actions.push({
        label: 'Archive',
        icon: 'archive',
        onClick: () => onArchiveItem(item),
        variant: 'danger',
      });
    }

    return actions;
  }, [navigate, onEditItem, onArchiveItem]);

  if (items.length === 0) {
    return null;
  }

  // Standard rendering for small lists - use QuickActionCard
  if (!shouldVirtualize) {
    return (
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className={`bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-2xl p-4 ${className}`}
      >
        <QueueHeader count={items.length} />
        <div className="space-y-2">
          {items.map((item, index) => (
            <QuickActionCard
              key={item.id}
              id={item.id}
              title={item.title}
              subtitle={item.subtitle}
              icon={getTypeIcon(item.type)}
              statusColor={getStatusColour(item.urgency)}
              syncStatus={item.syncStatus}
              route={item.route}
              actions={getItemActions(item)}
              badge={index + 1}
            />
          ))}
        </div>
      </motion.div>
    );
  }

  // Virtualized rendering for large lists
  return (
    <div className={`bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-2xl p-4 ${className}`}>
      <QueueHeader count={items.length} />
      <VirtualizedQueueList
        items={items}
        onItemClick={onItemClick}
        maxHeight={maxHeight}
      />
    </div>
  );
};

/**
 * QueueHeader - Section header for queue list
 */
const QueueHeader: React.FC<{ count: number }> = React.memo(({ count }) => (
  <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1 mb-2">
    <span className="material-symbols-outlined text-sm">queue</span>
    Next Up
    <span className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded text-[10px]">
      {count}
    </span>
  </h2>
));

QueueHeader.displayName = 'QueueHeader';

/**
 * VirtualizedQueueList - react-window v2 powered virtualized list
 */
interface VirtualizedQueueListProps {
  items: QueueItem[];
  onItemClick: (item: QueueItem) => void;
  maxHeight: number;
}

/**
 * VirtualizedRowData - Props passed to each row via rowProps
 */
interface VirtualizedRowData {
  items: QueueItem[];
  onItemClick: (item: QueueItem) => void;
}

/**
 * VirtualizedRow - Individual row renderer for react-window v2
 * The v2 API passes props via rowComponent with index, style, and custom rowProps
 */
const VirtualizedRow = ({
  index,
  style,
  items,
  onItemClick,
}: {
  ariaAttributes: {
    'aria-posinset': number;
    'aria-setsize': number;
    role: 'listitem';
  };
  index: number;
  style: CSSProperties;
} & VirtualizedRowData): ReactElement | null => {
  const item = items[index];

  const handleClick = useCallback(() => {
    onItemClick(item);
  }, [onItemClick, item]);

  return (
    <div style={{ ...style, paddingBottom: 8 }}>
      <QueueItemCardSimple
        item={item}
        position={index + 1}
        onClick={handleClick}
      />
    </div>
  );
};

const VirtualizedQueueList: React.FC<VirtualizedQueueListProps> = ({
  items,
  onItemClick,
  maxHeight,
}) => {
  // Calculate list height (capped at maxHeight)
  const listHeight = Math.min(items.length * ITEM_HEIGHT, maxHeight);

  // Row props for virtualized rows (v2 API)
  const rowProps = useMemo(() => ({
    items,
    onItemClick,
  }), [items, onItemClick]);

  return (
    <List
      style={{ height: listHeight, overflow: 'auto' }}
      rowCount={items.length}
      rowHeight={ITEM_HEIGHT}
      rowComponent={VirtualizedRow}
      rowProps={rowProps}
      overscanCount={3}
    />
  );
};

/**
 * Colour config for status-based styling (British English)
 */
const COLOUR_CONFIG: Record<StatusColor, {
  container: string;
  iconBg: string;
  icon: string;
  border: string;
  badge: string;
}> = {
  critical: {
    container: 'bg-red-50 dark:bg-red-950/30',
    iconBg: 'bg-red-500/20',
    icon: 'text-red-600 dark:text-red-400',
    border: 'border-red-200 dark:border-red-900/50 hover:border-red-300 dark:hover:border-red-800',
    badge: 'bg-red-500 text-white',
  },
  warning: {
    container: 'bg-amber-50 dark:bg-amber-950/30',
    iconBg: 'bg-amber-500/20',
    icon: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-900/50 hover:border-amber-300 dark:hover:border-amber-800',
    badge: 'bg-amber-500 text-white',
  },
  success: {
    container: 'bg-emerald-50 dark:bg-emerald-950/30',
    iconBg: 'bg-emerald-500/20',
    icon: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-900/50 hover:border-emerald-300 dark:hover:border-emerald-800',
    badge: 'bg-emerald-500 text-white',
  },
  info: {
    container: 'bg-blue-50 dark:bg-blue-950/30',
    iconBg: 'bg-blue-500/20',
    icon: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-900/50 hover:border-blue-300 dark:hover:border-blue-800',
    badge: 'bg-blue-500 text-white',
  },
  neutral: {
    container: 'bg-slate-50 dark:bg-slate-800/50',
    iconBg: 'bg-slate-500/20',
    icon: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600',
    badge: 'bg-slate-500 text-white',
  },
};

/**
 * QueueItemCardSimple - Colour-coded card for virtualized list
 * Performance optimised without motion animations
 */
const QueueItemCardSimple: React.FC<{
  item: QueueItem;
  position: number;
  onClick: () => void;
}> = React.memo(({ item, position, onClick }) => {
  const statusColour = getStatusColour(item.urgency);
  const colourConfig = COLOUR_CONFIG[statusColour];
  const typeIcon = getTypeIcon(item.type);

  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 p-3
        ${colourConfig.container}
        border-2 ${colourConfig.border}
        rounded-xl
        transition-all active:scale-[0.98]
        min-h-[56px] text-left
        group shadow-sm hover:shadow-md
      `}
    >
      {/* Position badge with status colour */}
      <div className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold ${colourConfig.badge}`}>
        {position}
      </div>

      {/* Type icon */}
      <div className={`size-10 rounded-xl ${colourConfig.iconBg} flex items-center justify-center shrink-0`}>
        <span className={`material-symbols-outlined text-lg ${colourConfig.icon}`}>
          {typeIcon}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-900 dark:text-white truncate text-sm">
          {item.title}
        </p>
        {item.subtitle && (
          <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
            {item.subtitle}
          </p>
        )}
      </div>

      {/* Sync status */}
      {item.syncStatus && item.syncStatus !== 'synced' && (
        <SyncStatusBadge status={item.syncStatus} compact />
      )}

      {/* Chevron */}
      <span className={`material-symbols-outlined ${colourConfig.icon} text-lg`}>
        chevron_right
      </span>
    </button>
  );
});

QueueItemCardSimple.displayName = 'QueueItemCardSimple';

interface QueueItemCardProps {
  item: QueueItem;
  position: number;
  onClick: () => void;
}

/**
 * QueueItemCard - Colour-coded queue item with motion
 * Used for non-virtualized small lists
 */
const QueueItemCard: React.FC<QueueItemCardProps> = React.memo(({
  item,
  position,
  onClick,
}) => {
  // Get colour config based on urgency
  const statusColour = useMemo(() => getStatusColour(item.urgency), [item.urgency]);
  const colourConfig = COLOUR_CONFIG[statusColour];
  const typeIcon = useMemo(() => getTypeIcon(item.type), [item.type]);

  return (
    <motion.button
      variants={fadeInUp}
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={`
        w-full flex items-center gap-3 p-4
        ${colourConfig.container}
        border-2 ${colourConfig.border}
        rounded-xl
        transition-all
        min-h-[72px] text-left
        shadow-sm hover:shadow-md
      `}
    >
      {/* Position badge with status colour */}
      <div className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold ${colourConfig.badge}`}>
        {position}
      </div>

      {/* Type icon */}
      <div className={`size-12 rounded-xl ${colourConfig.iconBg} flex items-center justify-center shrink-0`}>
        <span className={`material-symbols-outlined text-xl ${colourConfig.icon}`}>
          {typeIcon}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-900 dark:text-white truncate text-base">
          {item.title}
        </p>
        {item.subtitle && (
          <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
            {item.subtitle}
          </p>
        )}
      </div>

      {/* Sync status */}
      {item.syncStatus && item.syncStatus !== 'synced' && (
        <SyncStatusBadge status={item.syncStatus} compact />
      )}

      {/* Chevron */}
      <span className={`material-symbols-outlined ${colourConfig.icon} text-lg`}>
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
  <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-2xl p-4 space-y-2">
    <div className="h-4 w-24 bg-slate-700/50 rounded animate-pulse" />
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="flex items-center gap-3 p-3 bg-slate-800/50 border border-white/5 rounded-xl animate-pulse"
      >
        <div className="size-10 rounded-xl bg-slate-700/50" />
        <div className="size-8 rounded-lg bg-slate-700/50" />
        <div className="flex-1 space-y-1">
          <div className="h-4 w-32 bg-slate-700/50 rounded" />
          <div className="h-3 w-20 bg-slate-700/50 rounded" />
        </div>
      </div>
    ))}
  </div>
);
