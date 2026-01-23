import React, { useState, useEffect, useCallback } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { useTheme } from '../../lib/theme';

// Auto-dismiss duration in ms (60 seconds)
const AUTO_DISMISS_DURATION = 60000;
// Show delay in ms (300ms as per spec)
const SHOW_DELAY = 300;

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  variant?: 'default' | 'highlighted' | 'warning' | 'success' | 'info';
  showClose?: boolean;
  autoDismiss?: boolean;
  autoDismissDelay?: number;
  delayDuration?: number;
  className?: string;
}

/**
 * Smart Tooltip Component - Phase 2 UX Polish
 *
 * Features:
 * - Radix UI for accessibility and positioning
 * - High-contrast colors (dark bg/white text or inverse)
 * - 300ms hover delay to show
 * - 60s auto-dismiss option
 * - Close button (X) option
 * - Slide-out-right animation on dismiss
 */
const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  variant = 'default',
  showClose = false,
  autoDismiss = false,
  autoDismissDelay = AUTO_DISMISS_DURATION,
  delayDuration = SHOW_DELAY,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // Handle close with slide-out animation
  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      setOpen(false);
      setIsExiting(false);
    }, 150); // Animation duration
  }, []);

  // Auto-dismiss after specified duration
  useEffect(() => {
    if (open && autoDismiss) {
      const timer = setTimeout(() => {
        handleClose();
      }, autoDismissDelay);
      return () => clearTimeout(timer);
    }
  }, [open, autoDismiss, autoDismissDelay, handleClose]);

  // Get variant styles - high contrast for visibility
  const getVariantStyles = () => {
    switch (variant) {
      case 'highlighted':
        // Safety orange - high contrast
        return 'bg-amber-500 text-slate-900 border-amber-400 shadow-amber-500/40';
      case 'warning':
        // Orange warning
        return 'bg-orange-500 text-white border-orange-400 shadow-orange-500/40';
      case 'success':
        // Emerald success
        return 'bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/40';
      case 'info':
        // Blue info
        return 'bg-blue-500 text-white border-blue-400 shadow-blue-500/40';
      default:
        // High contrast based on theme
        return isDark
          ? 'bg-white text-slate-900 border-slate-200 shadow-white/20'
          : 'bg-slate-900 text-white border-slate-700 shadow-slate-900/40';
    }
  };

  // Map position to Radix side
  const getSide = (): 'top' | 'right' | 'bottom' | 'left' => {
    return position;
  };

  // Animation classes
  const getAnimationClasses = () => {
    if (isExiting) {
      return 'animate-out fade-out-0 slide-out-to-right-2 duration-150';
    }
    return 'animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200';
  };

  if (!content) return <>{children}</>;

  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipPrimitive.Root open={open} onOpenChange={setOpen}>
        <TooltipPrimitive.Trigger asChild>
          <span className="inline-flex">{children}</span>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={getSide()}
            sideOffset={8}
            className={`
              z-[200] max-w-xs px-3 py-2 text-xs font-semibold
              rounded-lg border shadow-lg
              ${getVariantStyles()}
              ${getAnimationClasses()}
              ${className}
            `}
            onPointerDownOutside={(e) => {
              // Allow clicking outside to close
              if (showClose) {
                e.preventDefault();
              }
            }}
          >
            <div className="flex items-start gap-2">
              <span className="flex-1">{content}</span>
              {showClose && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClose();
                  }}
                  className={`
                    flex-shrink-0 -mr-1 -mt-0.5 p-0.5 rounded
                    transition-colors duration-150
                    ${variant === 'default'
                      ? isDark
                        ? 'hover:bg-slate-200 text-slate-600'
                        : 'hover:bg-slate-700 text-slate-300'
                      : variant === 'highlighted'
                        ? 'hover:bg-amber-600/30 text-slate-800'
                        : 'hover:bg-white/20 text-white/80'
                    }
                  `}
                  aria-label="Close tooltip"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              )}
            </div>
            <TooltipPrimitive.Arrow
              className={`
                ${variant === 'highlighted'
                  ? 'fill-amber-500'
                  : variant === 'warning'
                    ? 'fill-orange-500'
                    : variant === 'success'
                      ? 'fill-emerald-500'
                      : variant === 'info'
                        ? 'fill-blue-500'
                        : isDark
                          ? 'fill-white'
                          : 'fill-slate-900'
                }
              `}
            />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
};

/**
 * Simple Tooltip - For quick usage without close button
 */
export const SimpleTooltip: React.FC<{
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}> = ({ content, children, position = 'top' }) => (
  <Tooltip content={content} position={position} variant="default">
    {children}
  </Tooltip>
);

/**
 * Info Tooltip - With auto-dismiss and close button
 * For form field hints and help text
 */
export const InfoTooltip: React.FC<{
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}> = ({ content, children, position = 'top' }) => (
  <Tooltip
    content={content}
    position={position}
    variant="info"
    showClose
    autoDismiss
  >
    {children}
  </Tooltip>
);

/**
 * Help Icon with Tooltip
 * Standalone help icon that shows tooltip on hover
 */
export const HelpTooltip: React.FC<{
  content: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  size?: 'sm' | 'md' | 'lg';
}> = ({ content, position = 'top', size = 'sm' }) => {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <Tooltip content={content} position={position} variant="info" showClose autoDismiss>
      <button
        type="button"
        className={`
          inline-flex items-center justify-center
          text-slate-400 hover:text-slate-600 dark:hover:text-slate-300
          transition-colors duration-150
          ${sizeClasses[size]}
        `}
        aria-label="Help"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 'inherit' }}>
          help
        </span>
      </button>
    </Tooltip>
  );
};

export default Tooltip;
