import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTrialStatus, useTrialCountdown } from '../hooks/useTrialStatus';
import { useTheme } from '../lib/theme';

interface TrialBannerProps {
  className?: string;
  compact?: boolean;
}

/**
 * TrialBanner - Shows trial status and countdown
 *
 * Displays different states:
 * - Trialing with days remaining
 * - Trial ending soon (3 days or less)
 * - Trial ended (paused)
 * - Active subscription (hidden)
 */
export const TrialBanner: React.FC<TrialBannerProps> = ({
  className = '',
  compact = false,
}) => {
  const {
    isTrialing,
    trialDaysRemaining,
    isPaused,
    isActive,
    tier,
    loading,
  } = useTrialStatus();
  const countdownText = useTrialCountdown();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [dismissed, setDismissed] = useState(false);

  // Don't show banner during loading
  if (loading) return null;

  // Don't show if dismissed (session only)
  if (dismissed) return null;

  // Don't show for active paid subscriptions
  if (isActive && !isTrialing) return null;

  // Paused subscription - trial ended without payment
  if (isPaused) {
    return (
      <div
        className={`
          ${compact ? 'p-3' : 'p-4'}
          rounded-xl border transition-all
          ${isDark
            ? 'bg-amber-500/10 border-amber-500/20'
            : 'bg-amber-50 border-amber-200'
          }
          ${className}
        `}
      >
        <div className={`flex items-center gap-3 ${compact ? '' : 'flex-wrap'}`}>
          <span
            className="material-symbols-outlined text-amber-500"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            warning
          </span>
          <div className="flex-1 min-w-0">
            <p className={`font-bold ${isDark ? 'text-amber-200' : 'text-amber-800'} ${compact ? 'text-sm' : ''}`}>
              Your trial has ended
            </p>
            {!compact && (
              <p className={`text-sm ${isDark ? 'text-amber-300/80' : 'text-amber-700'}`}>
                Add a payment method to continue using {tier === 'solo' ? 'JobProof' : `${tier} features`}
              </p>
            )}
          </div>
          <Link
            to="/pricing"
            className={`
              px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider
              bg-amber-500 text-white hover:bg-amber-600 transition-all
              whitespace-nowrap
            `}
          >
            Add Payment
          </Link>
        </div>
      </div>
    );
  }

  // Trialing - show countdown
  if (isTrialing) {
    const isUrgent = trialDaysRemaining <= 3;

    return (
      <div
        className={`
          ${compact ? 'p-3' : 'p-4'}
          rounded-xl border transition-all
          ${isUrgent
            ? isDark
              ? 'bg-orange-500/10 border-orange-500/20'
              : 'bg-orange-50 border-orange-200'
            : isDark
              ? 'bg-primary/10 border-primary/20'
              : 'bg-blue-50 border-blue-200'
          }
          ${className}
        `}
      >
        <div className={`flex items-center gap-3 ${compact ? '' : 'flex-wrap'}`}>
          <span
            className={`material-symbols-outlined ${isUrgent ? 'text-orange-500' : 'text-primary'}`}
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            {isUrgent ? 'schedule' : 'rocket_launch'}
          </span>
          <div className="flex-1 min-w-0">
            <p className={`font-bold ${
              isUrgent
                ? isDark ? 'text-orange-200' : 'text-orange-800'
                : isDark ? 'text-blue-200' : 'text-blue-800'
            } ${compact ? 'text-sm' : ''}`}>
              {countdownText}
            </p>
            {!compact && (
              <p className={`text-sm ${
                isUrgent
                  ? isDark ? 'text-orange-300/80' : 'text-orange-700'
                  : isDark ? 'text-blue-300/80' : 'text-blue-700'
              }`}>
                {isUrgent
                  ? 'Subscribe now to keep your data and continue using all features'
                  : `Enjoying your ${tier} trial? Subscribe anytime to continue.`
                }
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/pricing"
              className={`
                px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider
                transition-all whitespace-nowrap
                ${isUrgent
                  ? 'bg-orange-500 text-white hover:bg-orange-600'
                  : 'bg-primary text-white hover:bg-primary/90'
                }
              `}
            >
              {isUrgent ? 'Subscribe Now' : 'View Plans'}
            </Link>
            {!isUrgent && (
              <button
                onClick={() => setDismissed(true)}
                className={`
                  p-2 rounded-lg transition-all
                  ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}
                `}
                aria-label="Dismiss"
              >
                <span className="material-symbols-outlined text-sm opacity-50">
                  close
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // No banner needed
  return null;
};

/**
 * TrialBadge - Compact badge showing trial status for headers/navbars
 */
export const TrialBadge: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { isTrialing, trialDaysRemaining, isPaused, loading } = useTrialStatus();

  if (loading) return null;

  if (isPaused) {
    return (
      <Link
        to="/pricing"
        className={`
          inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
          bg-amber-500/20 text-amber-600 dark:text-amber-400
          text-xs font-bold uppercase tracking-wider
          hover:bg-amber-500/30 transition-all
          ${className}
        `}
      >
        <span className="material-symbols-outlined text-sm">warning</span>
        Trial Ended
      </Link>
    );
  }

  if (isTrialing) {
    const isUrgent = trialDaysRemaining <= 3;

    return (
      <Link
        to="/pricing"
        className={`
          inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
          text-xs font-bold uppercase tracking-wider
          transition-all
          ${isUrgent
            ? 'bg-orange-500/20 text-orange-600 dark:text-orange-400 hover:bg-orange-500/30'
            : 'bg-primary/20 text-primary hover:bg-primary/30'
          }
          ${className}
        `}
      >
        <span className="material-symbols-outlined text-sm">
          {isUrgent ? 'schedule' : 'rocket_launch'}
        </span>
        {trialDaysRemaining}d left
      </Link>
    );
  }

  return null;
};

export default TrialBanner;
