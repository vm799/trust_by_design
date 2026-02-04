/**
 * useDashboard - React hook for dashboard state
 *
 * Integrates deriveDashboardState with DataContext and AuthContext.
 * Provides memoized dashboard state with offline awareness.
 *
 * @see /docs/DASHBOARD_IMPLEMENTATION_SPEC.md
 */

import { useMemo, useCallback } from 'react';
import { useData } from './DataContext';
import { useAuth } from './AuthContext';
import { deriveDashboardState } from './deriveDashboardState';
import { DashboardState, DashboardRole } from './dashboardState';

interface UseDashboardOptions {
  /** Dashboard role (overrides auto-detection) */
  role?: DashboardRole;
}

interface UseDashboardResult {
  /** Derived dashboard state */
  state: DashboardState | null;

  /** Whether data is still loading */
  isLoading: boolean;

  /** Whether currently offline */
  isOffline: boolean;

  /** Whether data is stale (offline > 5 minutes) */
  isStale: boolean;

  /** Refresh data from server */
  refresh: () => Promise<void>;

  /** Current user's role */
  role: DashboardRole;
}

/**
 * Detects dashboard role from user metadata
 *
 * IMPORTANT: Default to 'manager' for authenticated users without explicit persona
 * This ensures new dashboard features are visible by default.
 * Only explicitly technician personas get technician view.
 */
function detectRole(userMetadata: Record<string, unknown> | null): DashboardRole {
  if (!userMetadata) return 'manager'; // Default to manager for logged-in users

  const persona = userMetadata.persona as string | undefined;

  // Explicit technician personas
  if (persona === 'technician' || persona === 'field_worker') {
    return 'technician';
  }

  // Explicit solo contractor
  if (persona === 'solo_contractor') {
    return 'solo_contractor';
  }

  // Everyone else (including undefined, agency_owner, compliance_officer, etc.) = manager
  return 'manager';
}

/**
 * useDashboard hook
 *
 * @example
 * ```tsx
 * const { state, isLoading, refresh } = useDashboard({ role: 'manager' });
 *
 * if (isLoading) return <DashboardSkeleton />;
 * if (!state) return <EmptyState />;
 *
 * return (
 *   <>
 *     {state.focus && <FocusCard entity={state.focus} />}
 *     <QueueList items={state.queue} />
 *   </>
 * );
 * ```
 */
export function useDashboard(options: UseDashboardOptions = {}): UseDashboardResult {
  const { userId, session } = useAuth();
  const {
    jobs,
    clients,
    technicians,
    isLoading,
    refresh,
  } = useData();

  // Detect role from user metadata or use override
  const role = useMemo(() => {
    if (options.role) return options.role;
    return detectRole(session?.user?.user_metadata || null);
  }, [options.role, session?.user?.user_metadata]);

  // Check offline status
  const isOffline = useMemo(() => {
    return typeof navigator !== 'undefined' && !navigator.onLine;
  }, []);

  // Get last sync timestamp (would need to be tracked in DataContext)
  const lastSyncAt = useMemo(() => {
    // TODO: Track last sync time in DataContext
    return Date.now() - 60000; // Placeholder: 1 minute ago
  }, []);

  // Derive dashboard state (memoized)
  const state = useMemo(() => {
    if (!userId) return null;

    return deriveDashboardState({
      role,
      userId,
      jobs,
      clients,
      technicians,
      now: Date.now(),
      isOffline,
      lastSyncAt,
    });
  }, [role, userId, jobs, clients, technicians, isOffline, lastSyncAt]);

  // Memoized refresh handler
  const handleRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  // Compute isStale
  const isStale = useMemo(() => {
    return state?.meta.isStale ?? false;
  }, [state?.meta.isStale]);

  return {
    state,
    isLoading,
    isOffline,
    isStale,
    refresh: handleRefresh,
    role,
  };
}

export default useDashboard;
