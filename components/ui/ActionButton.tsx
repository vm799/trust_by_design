/**
 * ActionButton - Primary/Secondary/Danger Buttons
 *
 * Provides consistent button styling across the app.
 *
 * Phase A: Foundation & App Shell
 */

import React from 'react';
import { Link } from 'react-router-dom';

interface ActionButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  iconPosition?: 'left' | 'right';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  to?: string;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  disabled = false,
  loading = false,
  fullWidth = false,
  to,
  onClick,
  type = 'button',
  className = '',
}) => {
  const baseClasses = `
    inline-flex items-center justify-center gap-2
    font-medium transition-all
    disabled:opacity-50 disabled:cursor-not-allowed
    active:scale-[0.98]
  `;

  // Theme-aware variants: proper contrast in both light and dark modes
  const variantClasses = {
    primary: `
      bg-primary hover:bg-primary/90 text-white
      shadow-lg shadow-primary/20
    `,
    secondary: `
      bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/10
      text-slate-900 dark:text-white
      border border-slate-300 dark:border-white/10 hover:border-slate-400 dark:hover:border-white/20
    `,
    danger: `
      bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400
      border border-red-500/20 hover:border-red-500/30
    `,
    ghost: `
      bg-transparent hover:bg-slate-100 dark:hover:bg-white/10
      text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white
    `,
  };

  // Touch targets: minimum 48px height for accessibility (WCAG 2.1 AAA)
  const sizeClasses = {
    sm: 'px-4 py-2.5 text-xs rounded-lg min-h-[44px]', // 44px for compact contexts
    md: 'px-5 py-3 text-sm rounded-xl min-h-[48px]',   // 48px standard
    lg: 'px-6 py-4 text-base rounded-xl min-h-[52px]', // 52px for primary CTAs
  };

  const iconSizes = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-xl',
  };

  const classes = `
    ${baseClasses}
    ${variantClasses[variant]}
    ${sizeClasses[size]}
    ${fullWidth ? 'w-full' : ''}
    ${className}
  `;

  const content = (
    <>
      {loading && (
        <span className={`material-symbols-outlined animate-spin ${iconSizes[size]}`}>
          progress_activity
        </span>
      )}
      {!loading && icon && iconPosition === 'left' && (
        <span className={`material-symbols-outlined ${iconSizes[size]}`}>{icon}</span>
      )}
      {children}
      {!loading && icon && iconPosition === 'right' && (
        <span className={`material-symbols-outlined ${iconSizes[size]}`}>{icon}</span>
      )}
    </>
  );

  if (to && !disabled) {
    return (
      <Link to={to} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={classes}
    >
      {content}
    </button>
  );
};

export default ActionButton;
