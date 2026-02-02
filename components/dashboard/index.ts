/**
 * Dashboard Components
 *
 * Unified dashboard components for JobProof.
 * @see /docs/DASHBOARD_IMPLEMENTATION_SPEC.md
 */

// Main container
export { default as UnifiedDashboard } from './UnifiedDashboard';

// Core components
export { default as FocusCard, FocusCardSkeleton } from './FocusCard';
export { default as QueueList, QueueListSkeleton } from './QueueList';
export { default as BackgroundCollapse, BackgroundCollapseSkeleton } from './BackgroundCollapse';

// Utilities
export { default as SyncStatusBadge, SyncStatusIcon, getSyncStatusConfig } from './SyncStatusBadge';

// Re-export types for convenience
export type {
  DashboardState,
  DashboardRole,
  FocusEntity,
  QueueItem,
  BackgroundSection,
  BackgroundItem,
  SyncStatus,
} from '../../lib/dashboardState';
