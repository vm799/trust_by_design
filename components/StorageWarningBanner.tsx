/**
 * Storage Warning Strip
 *
 * Slim, actionable progress strip at the top of the app when storage
 * approaches quota limit. Clickable to expand into a panel where users
 * can delete jobs directly without navigating away.
 *
 * Features:
 * - Collapsed: thin bar with percentage + progress indicator (1 line)
 * - Expanded: shows deletable jobs with one-click delete
 * - Respects sealed/invoiced job deletion rules
 * - Works from any page (uses DataContext)
 * - 44px+ touch targets
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useData } from '../lib/DataContext';
import { onQuotaExceeded } from '../lib/utils/safeLocalStorage';
import type { Job } from '../types';

interface StorageWarning {
  usage: number;
  quota: number;
  percent: number;
}

export const StorageWarningBanner: React.FC = React.memo(() => {
  const [warning, setWarning] = useState<StorageWarning | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { jobs, deleteJob } = useData();

  // Subscribe to storage quota warnings
  useEffect(() => {
    const unsubscribe = onQuotaExceeded((info) => {
      setWarning({
        usage: info.usage,
        quota: info.quota,
        percent: info.percent,
      });
      setIsDismissed(false);
    });

    return unsubscribe;
  }, []);

  // Deletable jobs: not sealed, not invoiced, sorted oldest first
  const deletableJobs = useMemo(() => {
    return jobs
      .filter((j: Job) => !j.sealedAt && !j.invoiceId)
      .sort((a: Job, b: Job) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateA - dateB;
      })
      .slice(0, 10);
  }, [jobs]);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    setIsExpanded(false);
  }, []);

  const handleToggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const handleDeleteJob = useCallback(async (jobId: string) => {
    setDeletingId(jobId);
    try {
      deleteJob(jobId);
    } finally {
      setDeletingId(null);
    }
  }, [deleteJob]);

  if (!warning || isDismissed) return null;

  // 3-status color logic: Green (<70%), Yellow (70-90%), Red (>90%)
  const isActionRequired = warning.percent >= 70 && warning.percent <= 90;
  const isCritical = warning.percent > 90;

  const barColor = isCritical ? 'bg-red-500' : isActionRequired ? 'bg-amber-500' : 'bg-emerald-500';
  const textColor = isCritical ? 'text-red-400' : isActionRequired ? 'text-amber-400' : 'text-emerald-400';
  const bgStrip = isCritical ? 'bg-red-500/10' : isActionRequired ? 'bg-amber-500/10' : 'bg-emerald-500/10';
  const statusLabel = isCritical ? 'Critical: Delete Data' : isActionRequired ? 'Action Required' : 'Healthy';

  return (
    <div className="w-full" role="status" aria-label="Storage usage warning">
      {/* Collapsed strip — always visible when warning active */}
      <button
        type="button"
        onClick={handleToggleExpand}
        className={`w-full ${bgStrip} min-h-[44px] px-4 py-2 flex items-center gap-3 transition-colors hover:bg-slate-800/60 cursor-pointer`}
        aria-expanded={isExpanded}
        aria-controls="storage-panel"
      >
        {/* Progress bar inline - max-width: 100%, relative units */}
        <div className="w-20 sm:w-32 max-w-full h-1.5 bg-slate-700 rounded-full overflow-hidden flex-shrink-0">
          <div
            className={`h-full ${barColor} transition-all duration-300 rounded-full`}
            style={{ width: `${Math.min(Math.round(warning.percent), 100)}%`, maxWidth: '100%' }}
          />
        </div>

        <span className={`text-xs font-bold ${textColor} whitespace-nowrap`}>
          {Math.round(warning.percent)}% Used
        </span>

        <span className="text-xs text-slate-500 hidden sm:inline">
          {warning.usage >= 1024 * 1024 * 1024
            ? `${(warning.usage / (1024 * 1024 * 1024)).toFixed(1)}GB`
            : `${(warning.usage / (1024 * 1024)).toFixed(1)}MB`
          } of {warning.quota >= 1024 * 1024 * 1024
            ? `${(warning.quota / (1024 * 1024 * 1024)).toFixed(0)}GB`
            : `${(warning.quota / (1024 * 1024)).toFixed(0)}MB`
          }
        </span>

        <span className={`text-[10px] font-bold ${textColor} hidden sm:inline`}>
          {statusLabel}
        </span>

        <span className={`text-xs ${textColor} ml-auto flex items-center gap-1`}>
          {isExpanded ? 'Close' : 'Manage'}
          <svg
            className={`size-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>

        {/* Dismiss button */}
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            handleDismiss();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              handleDismiss();
            }
          }}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-white transition-colors"
          aria-label="Dismiss storage warning"
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </span>
      </button>

      {/* Expanded panel — shows deletable jobs */}
      {isExpanded && (
        <div
          id="storage-panel"
          className="bg-slate-900/95 border-t border-slate-700/50 px-4 py-3 max-h-64 overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Free up space — delete old jobs
            </h3>
            {deletableJobs.length > 0 && (
              <span className="text-[10px] text-slate-500">
                {deletableJobs.length} deletable job{deletableJobs.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {deletableJobs.length === 0 ? (
            <p className="text-xs text-slate-500 py-2">
              No deletable jobs found. Sealed and invoiced jobs cannot be removed.
            </p>
          ) : (
            <ul className="space-y-1">
              {deletableJobs.map((job: Job) => (
                <li
                  key={job.id}
                  className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-800 group"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-slate-200 font-medium truncate block">
                      {job.title || job.id.slice(0, 8)}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {job.status} · {job.createdAt ? new Date(job.createdAt).toLocaleDateString() : 'No date'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteJob(job.id)}
                    disabled={deletingId === job.id}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50"
                    aria-label={`Delete job ${job.title || job.id.slice(0, 8)}`}
                  >
                    {deletingId === job.id ? (
                      <svg className="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
});

StorageWarningBanner.displayName = 'StorageWarningBanner';
