/**
 * PageHeader - Consistent Page Headers
 *
 * Provides a unified header component for all pages with:
 * - Title
 * - Optional subtitle/description
 * - Optional action buttons
 * - Optional breadcrumbs
 * REMEDIATION ITEM 6: Wrapped in React.memo to prevent unnecessary re-renders
 *
 * Phase A: Foundation & App Shell
 */

import React, { memo } from 'react';
import { Link } from 'react-router-dom';

interface Breadcrumb {
  label: string;
  to?: string;
}

interface Action {
  label: string;
  icon?: string;
  onClick?: () => void;
  to?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: Action[];
  backTo?: string;
  backLabel?: string;
  children?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  breadcrumbs,
  actions,
  backTo,
  backLabel,
  children,
}) => {
  return (
    <div className="px-4 lg:px-8 py-4 lg:py-6 border-b border-slate-200 dark:border-white/15 bg-white/50 dark:bg-slate-950/50 transition-colors">
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-2 text-sm mb-2">
          {breadcrumbs.map((crumb) => (
            <React.Fragment key={`breadcrumb-${crumb.label}`}>
              {breadcrumbs.indexOf(crumb) > 0 && (
                <span className="text-slate-600">/</span>
              )}
              {crumb.to ? (
                <Link to={crumb.to} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-slate-700 dark:text-slate-300">{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Back Button */}
      {backTo && (
        <Link
          to={backTo}
          className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors mb-3"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          {backLabel || 'Back'}
        </Link>
      )}

      {/* Title Row */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
          {subtitle && (
            <p className="text-sm text-slate-500 dark:text-blue-300/80 font-medium mt-1">{subtitle}</p>
          )}
        </div>

        {/* Actions */}
        {actions && actions.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {actions.map((action) => {
              const baseClasses = `
                inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
                text-sm font-medium transition-all
                disabled:opacity-50 disabled:cursor-not-allowed
              `;

              const variantClasses = {
                primary: 'bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20',
                secondary: 'bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10',
                danger: 'bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20',
              };

              const classes = `${baseClasses} ${variantClasses[action.variant || 'secondary']}`;
              const actionKey = action.label || action.icon || Math.random().toString();

              if (action.to) {
                return (
                  <Link key={`action-${actionKey}`} to={action.to} className={classes}>
                    {action.icon && <span className="material-symbols-outlined text-lg">{action.icon}</span>}
                    {action.label}
                  </Link>
                );
              }

              return (
                <button
                  key={`action-${actionKey}`}
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className={classes}
                >
                  {action.icon && <span className="material-symbols-outlined text-lg">{action.icon}</span>}
                  {action.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Optional children (filters, tabs, etc.) */}
      {children && (
        <div className="mt-4">
          {children}
        </div>
      )}
    </div>
  );
};

// REMEDIATION ITEM 6: Export memoized PageHeader
export default memo(PageHeader);
