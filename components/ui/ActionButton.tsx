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

  const variantClasses = {
    primary: `
      bg-primary hover:bg-primary/90 text-white
      shadow-lg shadow-primary/20
    `,
    secondary: `
      bg-white/5 hover:bg-white/10 text-white
      border border-white/10 hover:border-white/20
    `,
    danger: `
      bg-red-500/10 hover:bg-red-500/20 text-red-400
      border border-red-500/20 hover:border-red-500/30
    `,
    ghost: `
      bg-transparent hover:bg-white/5 text-slate-300 hover:text-white
    `,
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs rounded-lg',
    md: 'px-4 py-2.5 text-sm rounded-xl',
    lg: 'px-6 py-3 text-base rounded-xl',
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
