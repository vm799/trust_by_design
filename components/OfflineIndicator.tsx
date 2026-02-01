import React, { useState, useEffect } from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

interface OfflineIndicatorProps {
  syncStatus?: {
    pending: number;
    failed: number;
  };
  className?: string;
}

/**
 * Offline/Network Status Indicator
 * Shows connection status and pending sync items
 *
 * Features:
 * - P1-4: Real network status via ping (not just navigator.onLine)
 * - Sync queue visibility
 * - Auto-hide when online and synced
 * - Mobile-optimized
 * - Memoized to prevent unnecessary re-renders
 */
const OfflineIndicator: React.FC<OfflineIndicatorProps> = React.memo(({ syncStatus, className = '' }) => {
  // P1-4: Use improved network detection (actual ping, not just navigator.onLine)
  const { isOnline, isChecking } = useNetworkStatus();
  const [isDismissed, setIsDismissed] = useState(false);

  // Reset dismissed state when going offline
  useEffect(() => {
    if (!isOnline) {
      setIsDismissed(false);
    }
  }, [isOnline]);

  // Don't show if online and no pending syncs
  const hasPending = (syncStatus?.pending || 0) > 0;
  const hasFailed = (syncStatus?.failed || 0) > 0;

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
            <p className="text-xs text-slate-300 font-medium leading-relaxed">
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
            <p className="text-xs text-slate-300 font-medium">
              {syncStatus?.pending || 0} {syncStatus?.pending === 1 ? 'item' : 'items'} pending sync...
            </p>
          </div>
        </div>
      )}

      {/* Sync Failed Banner (if online and has failures) */}
      {isOnline && hasFailed && !hasPending && (
        <div className="bg-danger/10 border border-danger/20 rounded-2xl p-4 flex items-center gap-4">
          <div className="size-10 bg-danger/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-danger text-xl">sync_problem</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-black uppercase text-danger tracking-tight">
              Sync Issues Detected
            </h3>
            <p className="text-xs text-slate-300 font-medium">
              {syncStatus?.failed || 0} {syncStatus?.failed === 1 ? 'item' : 'items'} failed to sync. Check your connection.
            </p>
          </div>
        </div>
      )}
    </div>
  );
});

OfflineIndicator.displayName = 'OfflineIndicator';

export { OfflineIndicator };
export default OfflineIndicator;
