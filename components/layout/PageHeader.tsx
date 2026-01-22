/**
 * PageHeader - Consistent Page Headers
 *
 * Provides a unified header component for all pages with:
 * - Title
 * - Optional subtitle/description
 * - Optional action buttons
 * - Optional breadcrumbs
 *
 * Phase A: Foundation & App Shell
 */

import React from 'react';
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
    <div className="px-4 lg:px-8 py-4 lg:py-6 border-b border-white/5 bg-slate-950/50">
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-2 text-sm mb-2">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={index}>
              {index > 0 && (
                <span className="text-slate-600">/</span>
              )}
              {crumb.to ? (
                <Link to={crumb.to} className="text-slate-400 hover:text-white transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-slate-300">{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Back Button */}
      {backTo && (
        <Link
          to={backTo}
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors mb-3"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          {backLabel || 'Back'}
        </Link>
      )}

      {/* Title Row */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-white">{title}</h1>
          {subtitle && (
            <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
          )}
        </div>

        {/* Actions */}
        {actions && actions.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {actions.map((action, index) => {
              const baseClasses = `
                inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
                text-sm font-medium transition-all
                disabled:opacity-50 disabled:cursor-not-allowed
              `;

              const variantClasses = {
                primary: 'bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20',
                secondary: 'bg-white/5 hover:bg-white/10 text-white border border-white/10',
                danger: 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20',
              };

              const classes = `${baseClasses} ${variantClasses[action.variant || 'secondary']}`;

              if (action.to) {
                return (
                  <Link key={index} to={action.to} className={classes}>
                    {action.icon && <span className="material-symbols-outlined text-lg">{action.icon}</span>}
                    {action.label}
                  </Link>
                );
              }

              return (
                <button
                  key={index}
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

export default PageHeader;
