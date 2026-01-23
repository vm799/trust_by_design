import React, { useState, useRef, useEffect } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  variant?: 'default' | 'highlighted' | 'warning' | 'success';
  delay?: number;
}

/**
 * Tooltip Component - UAT Fix #1
 * Custom styled tooltips with highlighted colors that stand out
 * against the dashboard visual noise
 */
const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  variant = 'highlighted',
  delay = 200,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getVariantStyles = () => {
    switch (variant) {
      case 'highlighted':
        return 'bg-amber-500 text-slate-900 border-amber-400 shadow-amber-500/30';
      case 'warning':
        return 'bg-orange-500 text-white border-orange-400 shadow-orange-500/30';
      case 'success':
        return 'bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/30';
      default:
        return 'bg-slate-800 text-white border-slate-700 shadow-slate-900/50';
    }
  };

  const getArrowStyles = () => {
    switch (variant) {
      case 'highlighted':
        return 'border-amber-500';
      case 'warning':
        return 'border-orange-500';
      case 'success':
        return 'border-emerald-500';
      default:
        return 'border-slate-800';
    }
  };

  const getPositionStyles = () => {
    switch (position) {
      case 'top':
        return 'bottom-full left-1/2 -translate-x-1/2 mb-2';
      case 'bottom':
        return 'top-full left-1/2 -translate-x-1/2 mt-2';
      case 'left':
        return 'right-full top-1/2 -translate-y-1/2 mr-2';
      case 'right':
        return 'left-full top-1/2 -translate-y-1/2 ml-2';
    }
  };

  const getArrowPosition = () => {
    switch (position) {
      case 'top':
        return 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent';
      case 'bottom':
        return 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent';
      case 'left':
        return 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent';
      case 'right':
        return 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent';
    }
  };

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {isVisible && content && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className={`
            absolute z-[200] px-3 py-2 text-xs font-bold uppercase tracking-wide
            rounded-lg border shadow-lg whitespace-nowrap
            animate-in fade-in zoom-in-95 duration-150
            ${getPositionStyles()}
            ${getVariantStyles()}
          `}
        >
          {content}
          <div
            className={`
              absolute w-0 h-0 border-4
              ${getArrowPosition()}
              ${getArrowStyles()}
            `}
          />
        </div>
      )}
    </div>
  );
};

export default Tooltip;
