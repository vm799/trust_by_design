import React, { useState, useEffect } from 'react';

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
 * - Real-time network status
 * - Sync queue visibility
 * - Auto-hide when online and synced
 * - Mobile-optimized
 * - Memoized to prevent unnecessary re-renders
 */
const OfflineIndicator: React.FC<OfflineIndicatorProps> = React.memo(({ syncStatus, className = '' }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      setIsDismissed(false); // Show again when going offline
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Don't show if online and no pending syncs
  const hasPending = (syncStatus?.pending || 0) > 0;
  const hasFailed = (syncStatus?.failed || 0) > 0;

  if (isOnline && !hasPending && !hasFailed) return null;
  if (isDismissed && isOnline) return null;

  return (
    <div className={`animate-in ${className}`}>
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-warning/10 border border-warning/20 rounded-2xl p-4 flex items-center gap-4">
          <div className="size-10 bg-warning/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-warning text-xl">wifi_off</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-black uppercase text-warning tracking-tight">
              Working Offline
            </h3>
            <p className="text-xs text-slate-300 font-medium leading-relaxed">
              Your work is being saved locally. Changes will sync when you're back online.
            </p>
          </div>
          {isOnline && (
            <button
              onClick={() => setIsDismissed(true)}
              className="p-2 text-slate-400 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          )}
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
