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
  variant?: 'default' | 'outlined' | 'elevated' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({
  children,
  className = '',
  variant = 'default',
  padding = 'md',
  onClick,
}) => {
  const baseClasses = 'rounded-2xl transition-all';

  const variantClasses = {
    default: 'bg-slate-900 border border-white/5',
    outlined: 'bg-transparent border border-white/10',
    elevated: 'bg-slate-900 border border-white/5 shadow-xl shadow-black/20',
    interactive: 'bg-slate-900 border border-white/5 hover:border-white/20 hover:bg-slate-800/50 cursor-pointer',
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
