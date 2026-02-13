/**
 * Card - Base Card Component
 *
 * Provides a consistent card container with variants.
 *
 * Phase A: Foundation & App Shell
 */

import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'outlined' | 'elevated' | 'interactive' | 'highlight';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
  /** Accent color for highlight variant left border */
  accentColor?: 'primary' | 'emerald' | 'amber' | 'red';
}

const ACCENT_COLORS = {
  primary: 'border-l-primary',
  emerald: 'border-l-emerald-500',
  amber: 'border-l-amber-500',
  red: 'border-l-red-500',
} as const;

const Card: React.FC<CardProps> = ({
  children,
  className = '',
  variant = 'default',
  padding = 'md',
  onClick,
  accentColor,
}) => {
  const baseClasses = 'rounded-2xl transition-all';

  const variantClasses = {
    default: 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/15 text-slate-900 dark:text-white',
    outlined: 'bg-transparent border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white',
    elevated: 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/15 shadow-xl shadow-slate-200/50 dark:shadow-black/50 text-slate-900 dark:text-white',
    interactive: 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/15 hover:border-slate-400 dark:hover:border-white/20 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-slate-900 dark:text-white',
    highlight: `bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/15 border-l-4 ${accentColor ? ACCENT_COLORS[accentColor] : ACCENT_COLORS.primary} text-slate-900 dark:text-white`,
  };

  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4 lg:p-5',
    lg: 'p-6 lg:p-8',
  };

  const classes = `
    ${baseClasses}
    ${variantClasses[variant]}
    ${paddingClasses[padding]}
    ${className}
  `;

  if (onClick) {
    return (
      <button onClick={onClick} className={`${classes} w-full text-left`}>
        {children}
      </button>
    );
  }

  return <div className={classes}>{children}</div>;
};

export default Card;
