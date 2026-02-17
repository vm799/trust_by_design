/**
 * BackgroundCollapse - Collapsed section for secondary items
 *
 * Displays background items (idle technicians, completed jobs) in
 * a collapsible section. Uses native HTML <details> for accessibility.
 *
 * Features:
 * - Collapsed by default (configurable)
 * - 44px touch targets
 * - Sync status badges
 * - Smooth expand/collapse animation
 *
 * @see /docs/DASHBOARD_IMPLEMENTATION_SPEC.md
 */

import React from 'react';
import { BackgroundSection, BackgroundItem } from '../../lib/dashboardState';
import SyncStatusBadge from './SyncStatusBadge';

interface BackgroundCollapseProps {
  /** Section data to display */
  section: BackgroundSection;

  /** Click handler for items with routes */
  onItemClick: (item: BackgroundItem) => void;

  /** Optional className for container */
  className?: string;
}

const BackgroundCollapse: React.FC<BackgroundCollapseProps> = ({
  section,
  onItemClick,
  className = '',
}) => {
  if (section.items.length === 0) {
    return null;
  }

  return (
    <details
      className={`group ${className}`}
      open={!section.collapsedByDefault}
    >
      {/* Summary/Header - 44px touch target */}
      <summary className={`
        flex items-center gap-2 px-1 py-2
        cursor-pointer list-none
        text-xs font-bold text-slate-400 dark:text-slate-400
        uppercase tracking-widest
        hover:text-slate-700 dark:hover:text-slate-300
        transition-colors
        min-h-[44px]
      `}>
        {/* Chevron with rotation */}
        <span className="material-symbols-outlined text-sm transition-transform duration-200 group-open:rotate-90">
          chevron_right
        </span>

        {/* Status dot */}
        <span className={`
          size-2 rounded-full
          ${section.collapsedByDefault ? 'bg-slate-500' : 'bg-slate-400'}
          group-open:bg-slate-400
        `} />

        {/* Title */}
        {section.title}
      </summary>

      {/* Content */}
      <div className="space-y-1 mt-2 pl-5">
        {section.items.map(item => (
          <BackgroundItemRow
            key={item.id}
            item={item}
            onClick={() => onItemClick(item)}
          />
        ))}
      </div>
    </details>
  );
};

interface BackgroundItemRowProps {
  item: BackgroundItem;
  onClick: () => void;
}

/**
 * BackgroundItemRow - Individual background item
 */
const BackgroundItemRow: React.FC<BackgroundItemRowProps> = React.memo(({
  item,
  onClick,
}) => {
  const hasRoute = !!item.route;

  // Type-based icon
  const typeIcon = item.type === 'job' ? 'work' : 'person';

  const content = (
    <>
      {/* Type icon */}
      <span className="material-symbols-outlined text-xs text-slate-500 dark:text-slate-400 shrink-0">
        {typeIcon}
      </span>

      {/* Title */}
      <span className="font-medium truncate flex-1">
        {item.title}
      </span>

      {/* Subtitle */}
      {item.subtitle && (
        <>
          <span className="text-slate-400 dark:text-slate-600">•</span>
          <span className="text-xs text-slate-400 dark:text-slate-400 truncate max-w-[120px]">
            {item.subtitle}
          </span>
        </>
      )}

      {/* Sync status */}
      {item.syncStatus && item.syncStatus !== 'synced' && (
        <SyncStatusBadge status={item.syncStatus} compact />
      )}

      {/* Chevron for clickable items */}
      {hasRoute && (
        <span className="material-symbols-outlined text-xs text-slate-500 dark:text-slate-400 shrink-0">
          chevron_right
        </span>
      )}
    </>
  );

  if (hasRoute) {
    return (
      <button
        onClick={onClick}
        className={`
          w-full flex items-center gap-2 py-2 px-3
          text-sm text-left rounded-lg
          text-slate-600 dark:text-slate-400
          hover:bg-slate-100 dark:hover:bg-slate-800
          hover:text-slate-900 dark:hover:text-white
          transition-colors
          min-h-[44px]
        `}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={`
        flex items-center gap-2 py-2 px-3
        text-sm rounded-lg
        text-slate-400 dark:text-slate-400
      `}
    >
      {content}
    </div>
  );
});

BackgroundItemRow.displayName = 'BackgroundItemRow';

export default React.memo(BackgroundCollapse);

/**
 * BackgroundCollapseSkeleton - Loading state for BackgroundCollapse
 */
export const BackgroundCollapseSkeleton: React.FC = () => (
  <div className="animate-pulse">
    <div className="flex items-center gap-2 px-1 py-2">
      <div className="size-4 bg-slate-200 dark:bg-slate-800 rounded" />
      <div className="size-2 bg-slate-200 dark:bg-slate-800 rounded-full" />
      <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
    </div>
  </div>
);
