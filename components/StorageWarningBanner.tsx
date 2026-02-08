/**
 * Storage Warning Banner
 *
 * Shows warning when localStorage approaches quota limit
 * Guides users to archive/delete old jobs to free space
 *
 * Features:
 * - Auto-dismisses when user takes action (archives jobs)
 * - Shows storage percentage and available space
 * - Persistent until quota pressure relieved
 * - Mobile-optimized
 */

import React, { useState, useEffect, useCallback } from 'react';
import { onQuotaExceeded } from '../lib/utils/safeLocalStorage';

interface StorageWarning {
  usage: number;
  quota: number;
  percent: number;
}

export const StorageWarningBanner: React.FC = React.memo(() => {
  const [warning, setWarning] = useState<StorageWarning | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  // Subscribe to storage quota warnings
  useEffect(() => {
    const unsubscribe = onQuotaExceeded((info) => {
      setWarning({
        usage: info.usage,
        quota: info.quota,
        percent: info.percent,
      });
      setIsDismissed(false); // Re-show if dismissed
    });

    return unsubscribe;
  }, []);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
  }, []);

  // Hide banner if no warning
  if (!warning || isDismissed) return null;

  const isCritical = warning.percent >= 90;
  const isLow = warning.percent >= 75;

  // Determine styling based on severity
  const bgColor = isCritical ? 'bg-danger/10' : 'bg-warning/10';
  const borderColor = isCritical ? 'border-danger/20' : 'border-warning/20';
  const iconColor = isCritical ? 'text-danger' : 'text-warning';
  const textColor = isCritical ? 'text-danger' : 'text-warning';

  return (
    <div className={`${bgColor} border ${borderColor} rounded-2xl p-4 sm:p-5 animate-in`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Icon */}
        <div
          className={`size-10 ${isCritical ? 'bg-danger/20' : 'bg-warning/20'} rounded-xl flex items-center justify-center flex-shrink-0`}
        >
          <span className={`material-symbols-outlined ${iconColor} text-xl`}>
            {isCritical ? 'warning' : 'info'}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          <h3 className={`text-sm font-black uppercase ${textColor} tracking-tight`}>
            {isCritical ? 'Storage Nearly Full' : 'Storage Getting Full'}
          </h3>
          <p className="text-xs text-slate-300 font-medium leading-relaxed">
            You&apos;re using <span className="font-black text-white">{warning.percent}%</span> of available storage.
            Clear old jobs or archive completed work to continue.
          </p>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={handleDismiss}
          className="p-2.5 text-slate-400 hover:text-white transition-colors flex-shrink-0"
          title="Dismiss banner (will reappear if quota critical)"
          aria-label="Dismiss storage warning"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${isCritical ? 'bg-danger' : 'bg-warning'}`}
          style={{ width: `${Math.min(warning.percent, 100)}%` }}
        />
      </div>
    </div>
  );
});

StorageWarningBanner.displayName = 'StorageWarningBanner';
