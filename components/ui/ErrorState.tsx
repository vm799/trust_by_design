/**
 * ErrorState - Error Display with Retry
 *
 * REMEDIATION ITEM 10: Add retry UI for failed operations
 *
 * Displays when an operation fails with:
 * - Error icon and message
 * - Retry button
 * - Optional secondary action (e.g., go back)
 *
 * Phase A: Foundation & App Shell
 */

import React, { memo, useState } from 'react';
import ActionButton from './ActionButton';

interface ErrorStateProps {
  /** Main error title */
  title?: string;
  /** Error description or message */
  message?: string;
  /** Icon to display (Material Symbols) */
  icon?: string;
  /** Retry callback - shows retry button when provided */
  onRetry?: () => void | Promise<void>;
  /** Retry button label */
  retryLabel?: string;
  /** Secondary action */
  secondaryAction?: {
    label: string;
    onClick?: () => void;
    to?: string;
    icon?: string;
  };
  /** Visual variant */
  variant?: 'default' | 'compact' | 'inline';
  /** Additional CSS classes */
  className?: string;
}

const ErrorState = memo<ErrorStateProps>(({
  title = 'Something went wrong',
  message = 'We couldn\'t load the data. Please try again.',
  icon = 'error',
  onRetry,
  retryLabel = 'Try Again',
  secondaryAction,
  variant = 'default',
  className = '',
}) => {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    if (!onRetry) return;

    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  // Inline variant for use within cards/sections
  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl ${className}`}>
        <span className="material-symbols-outlined text-red-400">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">{title}</p>
          {message && <p className="text-xs text-slate-400">{message}</p>}
        </div>
        {onRetry && (
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {isRetrying ? (
              <>
                <span className="size-3 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                Retrying...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm">refresh</span>
                {retryLabel}
              </>
            )}
          </button>
        )}
      </div>
    );
  }

  // Compact variant for smaller spaces
  if (variant === 'compact') {
    return (
      <div className={`flex flex-col items-center justify-center py-8 px-4 text-center ${className}`}>
        <div className="size-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-3">
          <span className="material-symbols-outlined text-2xl text-red-400">{icon}</span>
        </div>
        <p className="text-sm font-medium text-white mb-1">{title}</p>
        {message && <p className="text-xs text-slate-400 max-w-xs mb-4">{message}</p>}
        {onRetry && (
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isRetrying ? (
              <>
                <span className="size-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                Retrying...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">refresh</span>
                {retryLabel}
              </>
            )}
          </button>
        )}
      </div>
    );
  }

  // Default full-size variant
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      {/* Icon */}
      <div className="size-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-3xl text-red-400">{icon}</span>
      </div>

      {/* Title */}
      <h3 className="text-lg font-medium text-white mb-1">{title}</h3>

      {/* Message */}
      {message && (
        <p className="text-sm text-slate-400 max-w-sm mb-6">{message}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        {onRetry && (
          <ActionButton
            variant="primary"
            icon="refresh"
            onClick={handleRetry}
            loading={isRetrying}
          >
            {retryLabel}
          </ActionButton>
        )}
        {secondaryAction && (
          <ActionButton
            variant="secondary"
            icon={secondaryAction.icon}
            onClick={secondaryAction.onClick}
            to={secondaryAction.to}
          >
            {secondaryAction.label}
          </ActionButton>
        )}
      </div>
    </div>
  );
});

ErrorState.displayName = 'ErrorState';

export default ErrorState;
