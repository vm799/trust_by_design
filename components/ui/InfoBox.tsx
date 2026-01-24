import React, { useState } from 'react';
import { useTheme } from '../../lib/theme';

export interface InfoBoxProps {
  children: React.ReactNode;
  icon?: string;
  title?: string;
  variant?: 'info' | 'warning' | 'success' | 'tip';
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
  /** Storage key for persistence - if provided, dismiss state is saved to localStorage */
  persistKey?: string;
}

/**
 * InfoBox Component - Compact Info Callout
 *
 * Distinct from regular UI elements with:
 * - Smaller, more compact size
 * - Cyan/teal color (not primary blue) for info variant
 * - Clear X button for dismissing
 *
 * Used for helpful hints, tips, and non-critical notices.
 */
const InfoBox: React.FC<InfoBoxProps> = ({
  children,
  icon,
  title,
  variant = 'info',
  dismissible = true,
  onDismiss,
  className = '',
  persistKey,
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // Check if already dismissed (persisted)
  const getInitialDismissed = () => {
    if (!persistKey) return false;
    try {
      return localStorage.getItem(`infobox_dismissed_${persistKey}`) === 'true';
    } catch {
      return false;
    }
  };

  const [isDismissed, setIsDismissed] = useState(getInitialDismissed);

  const handleDismiss = () => {
    setIsDismissed(true);
    if (persistKey) {
      try {
        localStorage.setItem(`infobox_dismissed_${persistKey}`, 'true');
      } catch {
        // Ignore storage errors
      }
    }
    onDismiss?.();
  };

  if (isDismissed) return null;

  // Variant styles - using cyan/teal for info to distinguish from primary blue
  const getVariantStyles = () => {
    switch (variant) {
      case 'warning':
        return {
          bg: isDark ? 'bg-amber-500/10' : 'bg-amber-50',
          border: 'border-amber-400/30',
          iconColor: 'text-amber-500',
          titleColor: isDark ? 'text-amber-400' : 'text-amber-700',
          textColor: isDark ? 'text-amber-200/80' : 'text-amber-700/80',
          closeHover: 'hover:bg-amber-500/20',
        };
      case 'success':
        return {
          bg: isDark ? 'bg-emerald-500/10' : 'bg-emerald-50',
          border: 'border-emerald-400/30',
          iconColor: 'text-emerald-500',
          titleColor: isDark ? 'text-emerald-400' : 'text-emerald-700',
          textColor: isDark ? 'text-emerald-200/80' : 'text-emerald-700/80',
          closeHover: 'hover:bg-emerald-500/20',
        };
      case 'tip':
        return {
          bg: isDark ? 'bg-violet-500/10' : 'bg-violet-50',
          border: 'border-violet-400/30',
          iconColor: 'text-violet-500',
          titleColor: isDark ? 'text-violet-400' : 'text-violet-700',
          textColor: isDark ? 'text-violet-200/80' : 'text-violet-700/80',
          closeHover: 'hover:bg-violet-500/20',
        };
      case 'info':
      default:
        // Cyan/teal - distinct from primary blue
        return {
          bg: isDark ? 'bg-cyan-500/10' : 'bg-cyan-50',
          border: 'border-cyan-400/30',
          iconColor: 'text-cyan-500',
          titleColor: isDark ? 'text-cyan-400' : 'text-cyan-700',
          textColor: isDark ? 'text-cyan-200/80' : 'text-cyan-700/80',
          closeHover: 'hover:bg-cyan-500/20',
        };
    }
  };

  const defaultIcons = {
    info: 'info',
    warning: 'warning',
    success: 'check_circle',
    tip: 'lightbulb',
  };

  const styles = getVariantStyles();
  const displayIcon = icon || defaultIcons[variant];

  return (
    <div
      className={`
        ${styles.bg} ${styles.border}
        border rounded-xl p-3
        flex items-start gap-2.5
        text-xs
        animate-in fade-in-0 duration-200
        ${className}
      `}
      role="note"
    >
      {displayIcon && (
        <span
          className={`material-symbols-outlined ${styles.iconColor} text-base flex-shrink-0 mt-0.5`}
          aria-hidden="true"
        >
          {displayIcon}
        </span>
      )}

      <div className="flex-1 min-w-0">
        {title && (
          <p className={`font-bold ${styles.titleColor} text-xs leading-tight mb-0.5`}>
            {title}
          </p>
        )}
        <div className={`${styles.textColor} text-[11px] leading-relaxed`}>
          {children}
        </div>
      </div>

      {dismissible && (
        <button
          onClick={handleDismiss}
          className={`
            flex-shrink-0 -mr-1 -mt-1 p-1 rounded-lg
            ${styles.textColor} ${styles.closeHover}
            transition-colors duration-150
          `}
          aria-label="Dismiss"
          title="Click to dismiss"
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      )}
    </div>
  );
};

export default InfoBox;
