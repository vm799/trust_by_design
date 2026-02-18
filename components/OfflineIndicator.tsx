import React, { useState, useEffect, useCallback } from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { getFailedSyncQueue, getSyncQueueStatus, retryFailedSyncItem, isRetryInProgress, getAutoRetryProgress } from '../lib/syncQueue';

interface OfflineIndicatorProps {
  syncStatus?: {
    pending: number;
    failed: number;
  };
  className?: string;
}

/**
 * Offline/Network Status Indicator
 * Shows connection status, pending sync items, and failed sync retry UI
 *
 * SELF-SUFFICIENT: Reads sync queue directly via getSyncQueueStatus()
 * because no parent view passes the syncStatus prop. Falls back to prop
 * if provided, but always supplements with direct queue reads.
 *
 * Features:
 * - P1-4: Real network status via ping (not just navigator.onLine)
 * - Sync queue visibility (reads localStorage directly)
 * - Failed sync retry with one-tap "Retry All"
 * - Auto-polls queue every 3s when online (catches background sync changes)
 * - Auto-hide when online and synced
 * - Mobile-optimized (44px+ touch targets)
 * - Memoized to prevent unnecessary re-renders
 */
const OfflineIndicator: React.FC<OfflineIndicatorProps> = React.memo(({ syncStatus: syncStatusProp, className = '' }) => {
  // P1-4: Use improved network detection (actual ping, not just navigator.onLine)
  const { isOnline, isChecking } = useNetworkStatus();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryResults, setRetryResults] = useState<{ succeeded: number; failed: number } | null>(null);
  const [liveStatus, setLiveStatus] = useState<{ pending: number; failed: number }>({ pending: 0, failed: 0 });
  const [autoRetryState, setAutoRetryState] = useState<{ total: number; recovered: number; isRunning: boolean }>({ total: 0, recovered: 0, isRunning: false });

  // Poll sync queue status AND auto-retry progress directly
  useEffect(() => {
    const poll = () => {
      setLiveStatus(getSyncQueueStatus());
      setAutoRetryState(getAutoRetryProgress());
    };

    // Initial read
    poll();

    // Poll every 3s when online to catch background sync changes
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [isOnline]);

  // Reset dismissed state when going offline
  useEffect(() => {
    if (!isOnline) {
      setIsDismissed(false);
    }
  }, [isOnline]);

  // Clear retry results after 5 seconds
  useEffect(() => {
    if (retryResults) {
      const timer = setTimeout(() => setRetryResults(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [retryResults]);

  // Retry all failed sync items, then refresh status
  // UX FIX: If auto-retry is already running (bunker exit), show "already syncing"
  // instead of hammering the same items and showing fake "X still failing" results.
  const handleRetryAll = useCallback(async () => {
    const failedItems = getFailedSyncQueue();
    if (failedItems.length === 0 || isRetrying) return;

    // Check if background auto-retry is already handling these items
    if (isRetryInProgress()) {
      setRetryResults({ succeeded: 0, failed: 0 });
      return;
    }

    setIsRetrying(true);
    setRetryResults(null);

    let succeeded = 0;
    let failed = 0;

    for (const item of failedItems) {
      // If auto-retry started mid-loop, stop to avoid double-processing
      if (isRetryInProgress()) break;

      const success = await retryFailedSyncItem(item.id);
      if (success) {
        succeeded++;
      } else {
        failed++;
      }
    }

    setRetryResults({ succeeded, failed });
    setIsRetrying(false);
    // Refresh status immediately after retry completes
    setLiveStatus(getSyncQueueStatus());
  }, [isRetrying]);

  // Use prop if provided, otherwise use live polled status
  const syncStatus = syncStatusProp || liveStatus;
  const hasPending = syncStatus.pending > 0;
  const hasFailed = syncStatus.failed > 0;

  // P1 FIELD UX: Show individual failed item names so workers know WHAT's stuck
  const failedItems = hasFailed ? getFailedSyncQueue() : [];
  const MAX_VISIBLE_ITEMS = 3;
  const visibleItems = failedItems.slice(0, MAX_VISIBLE_ITEMS);
  const hiddenCount = failedItems.length - visibleItems.length;

  if (isOnline && !hasPending && !hasFailed) return null;
  if (isDismissed && isOnline) return null;

  return (
    <div className={`animate-in ${className}`}>
      {/* Bunker Mode Banner - Full Offline Access */}
      {!isOnline && (
        <div className="bg-amber-500/15 border border-amber-400/30 rounded-2xl p-4 flex items-center gap-4">
          <div className="size-10 bg-amber-500/25 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className={`material-symbols-outlined text-amber-400 text-xl ${isChecking ? 'animate-spin' : ''}`}>
              {isChecking ? 'sync' : 'signal_cellular_off'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-black uppercase text-amber-400 tracking-tight flex items-center gap-2">
              {isChecking ? 'Checking Connection...' : (
                <>
                  <span className="material-symbols-outlined text-base">shield</span>
                  Bunker Mode
                </>
              )}
            </h3>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
              {isChecking
                ? 'Verifying network connectivity...'
                : 'Full access enabled. All features available. Changes sync when online.'}
            </p>
          </div>
        </div>
      )}

      {/* Sync Pending Banner */}
      {isOnline && hasPending && (
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center gap-4">
          <div className="size-10 bg-primary/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-primary text-xl animate-spin">sync</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-black uppercase text-primary tracking-tight">
              Syncing Changes
            </h3>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
              {syncStatus.pending} {syncStatus.pending === 1 ? 'item' : 'items'} pending sync...
            </p>
          </div>
        </div>
      )}

      {/* Auto-Syncing Progress Banner — shown during background auto-retry */}
      {isOnline && autoRetryState.isRunning && (
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center gap-4">
          <div className="size-10 bg-primary/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-primary text-xl animate-spin">sync</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-black uppercase text-primary tracking-tight">
              Auto-Syncing Evidence
            </h3>
            <p className="text-xs text-slate-300 font-medium">
              Recovering {autoRetryState.recovered} of {autoRetryState.total} failed {autoRetryState.total === 1 ? 'item' : 'items'}...
            </p>
          </div>
        </div>
      )}

      {/* Sync Failed Banner with Retry (if online and has failures) */}
      {isOnline && hasFailed && !hasPending && !autoRetryState.isRunning && (
        <div className="bg-danger/10 border border-danger/20 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-4">
            <div className="size-10 bg-danger/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className={`material-symbols-outlined text-danger text-xl ${isRetrying ? 'animate-spin' : ''}`}>
                {isRetrying ? 'sync' : 'sync_problem'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-black uppercase text-danger tracking-tight">
                {isRetrying ? 'Retrying Sync...' : 'Sync Issues Detected'}
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                {isRetrying
                  ? 'Attempting to sync failed items...'
                  : `${syncStatus.failed} ${syncStatus.failed === 1 ? 'item' : 'items'} failed to sync. Tap retry when you have signal.`}
              </p>
            </div>
          </div>

          {/* P1: Individual failed item list — shows WHAT's stuck */}
          {visibleItems.length > 0 && !isRetrying && (
            <div className="space-y-1 px-1">
              {visibleItems.map((item) => {
                const label = item.type === 'job'
                  ? (item.data?.title || item.id)
                  : (item.data?.name || item.id);
                const typeLabel = item.type === 'technician' ? 'Tech' : item.type === 'client' ? 'Client' : 'Job';
                return (
                  <div key={item.id} className="text-xs text-slate-400 truncate flex items-center gap-1.5">
                    <span className="text-danger/60 font-semibold uppercase text-[10px]">{typeLabel}:</span>
                    <span className="truncate">{label}</span>
                  </div>
                );
              })}
              {hiddenCount > 0 && (
                <div className="text-xs text-slate-500 italic">+{hiddenCount} more</div>
              )}
            </div>
          )}

          {/* Retry results feedback */}
          {retryResults && (
            <div className={`text-xs font-semibold px-3 py-2 rounded-xl ${
              retryResults.failed === 0
                ? 'bg-success/10 text-success'
                : 'bg-warning/10 text-warning'
            }`}>
              {retryResults.succeeded > 0 && `${retryResults.succeeded} synced successfully. `}
              {retryResults.failed > 0 && `${retryResults.failed} still failing.`}
              {retryResults.failed === 0 && 'All items synced!'}
            </div>
          )}

          {/* Retry All button - 44px+ touch target for field workers with gloves */}
          {!isRetrying && (
            <button
              onClick={handleRetryAll}
              className="w-full min-h-[44px] px-4 py-3 rounded-xl border border-danger/30 bg-danger/5 text-danger text-xs font-black uppercase tracking-widest hover:bg-danger/15 active:bg-danger/25 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-base">refresh</span>
              Retry All
            </button>
          )}
        </div>
      )}
    </div>
  );
});

OfflineIndicator.displayName = 'OfflineIndicator';

export { OfflineIndicator };
export default OfflineIndicator;
