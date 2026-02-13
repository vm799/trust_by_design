/**
 * EvidenceProgressBar - Per-job evidence status indicator
 *
 * Shows three evidence requirements for job defensibility:
 * 1. Before photo (captured/missing)
 * 2. After photo (captured/missing)
 * 3. Signature (captured/missing)
 *
 * UX Contract compliance:
 * - Binary states only (defensible/not defensible)
 * - Every visible element has meaning
 * - No animation for animation's sake
 *
 * Used by: Solo Contractor hero, Technician hero, Manager evidence section
 */

import React, { useMemo } from 'react';
import { Job } from '../../types';

interface EvidenceProgressBarProps {
  /** The job to display evidence status for */
  job: Job;
  /** Compact mode: segments only, no text labels */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Called when a missing evidence segment is clicked */
  onSegmentClick?: (segmentKey: 'before' | 'after' | 'signature') => void;
}

interface EvidenceState {
  hasBefore: boolean;
  hasAfter: boolean;
  hasSignature: boolean;
  completedCount: number;
  isDefensible: boolean;
}

/**
 * Compute evidence state from a job.
 * Photo types are case-insensitive to handle both 'before' and 'Before'.
 */
function computeEvidenceState(job: Job): EvidenceState {
  const photos = job.photos || [];
  const photoTypes = photos.map(p => (p.type || '').toLowerCase());

  const hasBefore = photoTypes.includes('before');
  const hasAfter = photoTypes.includes('after');
  const hasSignature = !!job.signature;

  const completedCount = [hasBefore, hasAfter, hasSignature].filter(Boolean).length;
  const isDefensible = hasBefore && hasAfter && hasSignature;

  return { hasBefore, hasAfter, hasSignature, completedCount, isDefensible };
}

const SEGMENTS = [
  { key: 'before', label: 'Before photo', icon: 'photo_camera' },
  { key: 'after', label: 'After photo', icon: 'photo_camera' },
  { key: 'signature', label: 'Signature', icon: 'draw' },
] as const;

const EvidenceProgressBar: React.FC<EvidenceProgressBarProps> = React.memo(({
  job,
  compact = false,
  className = '',
  onSegmentClick,
}) => {
  const evidence = useMemo(() => computeEvidenceState(job), [job]);

  const getSegmentState = (key: typeof SEGMENTS[number]['key']): boolean => {
    switch (key) {
      case 'before': return evidence.hasBefore;
      case 'after': return evidence.hasAfter;
      case 'signature': return evidence.hasSignature;
    }
  };

  return (
    <div
      role="group"
      aria-label="Evidence progress"
      className={`${className}`}
    >
      {/* Segments */}
      <div data-testid="evidence-segments" className="flex gap-1.5">
        {SEGMENTS.map(segment => {
          const captured = getSegmentState(segment.key);
          const isClickable = !captured && !!onSegmentClick;

          if (isClickable) {
            return (
              <button
                key={segment.key}
                onClick={() => onSegmentClick!(segment.key)}
                aria-label={`${segment.label} missing - tap to capture`}
                className="flex-1 h-2 rounded-full transition-colors duration-200 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 cursor-pointer"
              />
            );
          }

          return (
            <div
              key={segment.key}
              aria-label={`${segment.label} ${captured ? 'captured' : 'missing'}`}
              className={`
                flex-1 h-2 rounded-full transition-colors duration-200
                ${captured
                  ? 'bg-emerald-500 dark:bg-emerald-400'
                  : 'bg-slate-200 dark:bg-slate-700'
                }
              `}
            />
          );
        })}
      </div>

      {/* Text summary (hidden in compact mode) */}
      {!compact && (
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1.5">
            <span className={`material-symbols-outlined text-sm ${
              evidence.isDefensible
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-slate-400 dark:text-slate-400'
            }`}>
              {evidence.isDefensible ? 'verified_user' : 'shield'}
            </span>
            <span className={`text-xs font-medium ${
              evidence.isDefensible
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-slate-400 dark:text-slate-400'
            }`}>
              {evidence.completedCount === 0
                ? 'No evidence'
                : evidence.isDefensible
                  ? 'Defensible'
                  : 'Not defensible'
              }
            </span>
          </div>
          <span className={`text-xs font-bold tabular-nums ${
            evidence.isDefensible
              ? 'text-emerald-700 dark:text-emerald-300'
              : 'text-slate-400 dark:text-slate-400'
          }`}>
            {evidence.completedCount} / 3
          </span>
        </div>
      )}
    </div>
  );
});

EvidenceProgressBar.displayName = 'EvidenceProgressBar';

export default EvidenceProgressBar;

/**
 * Helper: Check if a job is defensible (reusable logic)
 */
export function isJobDefensible(job: Job): boolean {
  return computeEvidenceState(job).isDefensible;
}
