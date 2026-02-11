/**
 * LoadingSkeleton - Loading State Placeholders
 *
 * Provides skeleton loading states for various content types.
 *
 * Phase A: Foundation & App Shell
 */

import React from 'react';

interface LoadingSkeletonProps {
  variant?: 'text' | 'card' | 'list' | 'table' | 'avatar';
  count?: number;
  className?: string;
}

const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  variant = 'text',
  count = 1,
  className = '',
}) => {
  const skeletons = Array.from({ length: count }, (_, i) => i);

  // Theme-aware skeleton colors
  const baseClasses = 'animate-pulse bg-slate-200 dark:bg-slate-800 rounded';

  if (variant === 'text') {
    return (
      <div className={`space-y-2 ${className}`}>
        {skeletons.map(i => (
          <div key={`skeleton-text-${i}`} className={`${baseClasses} h-4 ${i === count - 1 ? 'w-3/4' : 'w-full'}`} />
        ))}
      </div>
    );
  }

  if (variant === 'avatar') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className={`${baseClasses} size-10 rounded-xl`} />
        <div className="flex-1 space-y-2">
          <div className={`${baseClasses} h-4 w-24`} />
          <div className={`${baseClasses} h-3 w-16`} />
        </div>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={`space-y-4 ${className}`}>
        {skeletons.map(i => (
          <div key={`skeleton-card-${i}`} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl p-5">
            <div className="flex items-start gap-4">
              <div className={`${baseClasses} size-12 rounded-xl`} />
              <div className="flex-1 space-y-3">
                <div className={`${baseClasses} h-5 w-48`} />
                <div className={`${baseClasses} h-4 w-32`} />
                <div className="flex gap-2">
                  <div className={`${baseClasses} h-6 w-20 rounded-lg`} />
                  <div className={`${baseClasses} h-6 w-16 rounded-lg`} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={`space-y-3 ${className}`}>
        {skeletons.map(i => (
          <div key={`skeleton-list-${i}`} className="flex items-center gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-xl">
            <div className={`${baseClasses} size-10 rounded-lg`} />
            <div className="flex-1 space-y-2">
              <div className={`${baseClasses} h-4 w-48`} />
              <div className={`${baseClasses} h-3 w-32`} />
            </div>
            <div className={`${baseClasses} h-8 w-20 rounded-lg`} />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className={`space-y-2 ${className}`}>
        {/* Header */}
        <div className="flex gap-4 px-4 py-3 border-b border-slate-200 dark:border-white/5">
          <div className={`${baseClasses} h-4 w-32`} />
          <div className={`${baseClasses} h-4 w-24`} />
          <div className={`${baseClasses} h-4 w-20`} />
          <div className={`${baseClasses} h-4 w-28`} />
        </div>
        {/* Rows */}
        {skeletons.map(i => (
          <div key={`skeleton-row-${i}`} className="flex gap-4 px-4 py-3">
            <div className={`${baseClasses} h-4 w-32`} />
            <div className={`${baseClasses} h-4 w-24`} />
            <div className={`${baseClasses} h-4 w-20`} />
            <div className={`${baseClasses} h-4 w-28`} />
          </div>
        ))}
      </div>
    );
  }

  return null;
};

export default LoadingSkeleton;
