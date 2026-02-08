/**
 * Fix 3.3: SyncConflictResolver Component
 * Displays sync conflicts between local and remote job versions
 * Allows user to choose resolution: Use Mine, Use Server, or Manual
 */

import React from 'react';
import type { SyncConflict } from '../lib/offline/sync';

export interface SyncConflictResolverProps {
  conflict: SyncConflict;
  onResolve: (resolution: 'local' | 'remote' | 'manual') => void;
  onDismiss?: () => void;
}

/**
 * Format field value for display
 */
function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '(empty)';
  }
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return `${value.length} items`;
    }
    return JSON.stringify(value).slice(0, 50) + (JSON.stringify(value).length > 50 ? '...' : '');
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  return String(value).slice(0, 100);
}

/**
 * Get human-readable field name
 */
function getFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    status: 'Job Status',
    technician: 'Assigned Technician',
    signature: 'Signature',
    photos: 'Photos',
    notes: 'Notes',
    sealed: 'Sealed Status',
  };
  return labels[field] || field.charAt(0).toUpperCase() + field.slice(1);
}

export const SyncConflictResolver: React.FC<SyncConflictResolverProps> = ({
  conflict,
  onResolve,
  onDismiss,
}) => {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-red-400 text-lg">sync_problem</span>
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-white text-lg">Sync Conflict Detected</h3>
          <p className="text-sm text-slate-400 mt-1">
            Job "{conflict.local.title}" has been modified both locally and on the server.
            <br />
            Choose which version to keep:
          </p>
        </div>
      </div>

      {/* Conflict Fields Display */}
      <div className="space-y-3">
        {conflict.conflictFields.map((field) => (
          <div
            key={field}
            className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 space-y-2"
          >
            <div className="text-xs uppercase font-bold text-slate-400">
              {getFieldLabel(field)}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Local Version */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-blue-300 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">smartphone</span>
                  This Device
                </div>
                <div className="text-sm text-white font-mono bg-slate-900/50 rounded p-3 break-words whitespace-pre-wrap min-h-[40px] flex items-center">
                  {formatFieldValue((conflict.local as unknown as Record<string, unknown>)[field])}
                </div>
              </div>

              {/* Remote Version */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-amber-300 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">cloud</span>
                  Server
                </div>
                <div className="text-sm text-white font-mono bg-slate-900/50 rounded p-3 break-words whitespace-pre-wrap min-h-[40px] flex items-center">
                  {formatFieldValue((conflict.remote as unknown as Record<string, unknown>)[field])}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Resolution Actions */}
      <div className="space-y-3">
        <p className="text-sm text-slate-400 font-medium">Choose Resolution:</p>

        <div className="grid grid-cols-2 gap-3">
          {/* Keep Local */}
          <button
            onClick={() => onResolve('local')}
            className="flex items-center gap-2 p-4 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 hover:border-blue-500/50 transition-all text-left active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-blue-400 text-lg flex-shrink-0">
              smartphone
            </span>
            <div className="flex-1">
              <div className="font-semibold text-white text-sm">Use Mine</div>
              <div className="text-xs text-slate-400">Keep local version</div>
            </div>
          </button>

          {/* Keep Remote */}
          <button
            onClick={() => onResolve('remote')}
            className="flex items-center gap-2 p-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-500/50 transition-all text-left active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-amber-400 text-lg flex-shrink-0">
              cloud
            </span>
            <div className="flex-1">
              <div className="font-semibold text-white text-sm">Use Server</div>
              <div className="text-xs text-slate-400">Keep server version</div>
            </div>
          </button>
        </div>

        {/* Manual Resolution Option */}
        <button
          onClick={() => onResolve('manual')}
          className="w-full flex items-center gap-2 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/50 hover:border-slate-600/50 transition-all text-left active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-slate-400 text-lg flex-shrink-0">
            edit
          </span>
          <div className="flex-1">
            <div className="font-semibold text-white text-sm">Manual Merge</div>
            <div className="text-xs text-slate-400">Edit and combine versions</div>
          </div>
        </button>
      </div>

      {/* Help Text */}
      <div className="bg-slate-900/50 border border-slate-700/30 rounded-lg p-3 text-xs text-slate-400">
        <p className="flex items-start gap-2">
          <span className="material-symbols-outlined text-sm flex-shrink-0 mt-0.5">
            info
          </span>
          <span>
            Choosing &quot;Use Mine&quot; keeps your local changes. &quot;Use Server&quot; will overload your changes
            with the server version. Select &quot;Manual Merge&quot; to carefully combine both versions.
          </span>
        </p>
      </div>

      {/* Dismiss Option */}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="w-full py-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
        >
          Dismiss
        </button>
      )}
    </div>
  );
};

export default SyncConflictResolver;
