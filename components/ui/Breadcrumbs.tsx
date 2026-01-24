import React, { memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../../lib/theme';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
  showHome?: boolean;
  separator?: 'chevron' | 'slash' | 'arrow';
}

/**
 * Breadcrumbs Navigation Component
 *
 * Phase 3: Job Creation Guards
 * REMEDIATION ITEM 6: Wrapped in React.memo to prevent unnecessary re-renders
 *
 * Provides navigation context with:
 * - Clickable links to parent pages
 * - Current page indicator
 * - Theme-aware styling
 * - Optional home link
 */
const Breadcrumbs = memo<BreadcrumbsProps>(({
  items,
  className = '',
  showHome = true,
  separator = 'chevron',
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const location = useLocation();

  const separatorIcon = {
    chevron: 'chevron_right',
    slash: '/',
    arrow: 'arrow_forward',
  };

  // Build full items list with optional home
  const fullItems: BreadcrumbItem[] = showHome
    ? [{ label: 'Dashboard', href: '/admin', icon: 'home' }, ...items]
    : items;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-1 text-sm ${className}`}
    >
      <ol className="flex items-center gap-1 flex-wrap">
        {fullItems.map((item, index) => {
          const isLast = index === fullItems.length - 1;
          const isClickable = !!item.href && !isLast;

          return (
            <li key={index} className="flex items-center gap-1">
              {/* Separator (not before first item) */}
              {index > 0 && (
                <span
                  className={`
                    ${isDark ? 'text-slate-600' : 'text-slate-400'}
                    ${separator === 'slash' ? 'mx-1' : ''}
                  `}
                  aria-hidden="true"
                >
                  {separator === 'slash' ? (
                    '/'
                  ) : (
                    <span className="material-symbols-outlined text-sm">
                      {separatorIcon[separator]}
                    </span>
                  )}
                </span>
              )}

              {/* Breadcrumb item */}
              {isClickable ? (
                <Link
                  to={item.href!}
                  className={`
                    flex items-center gap-1.5 px-2 py-1 rounded-lg
                    transition-colors duration-150
                    ${isDark
                      ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                    }
                  `}
                >
                  {item.icon && (
                    <span className="material-symbols-outlined text-sm">
                      {item.icon}
                    </span>
                  )}
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span
                  className={`
                    flex items-center gap-1.5 px-2 py-1
                    ${isLast
                      ? isDark
                        ? 'text-white font-medium'
                        : 'text-slate-900 font-medium'
                      : isDark
                        ? 'text-slate-400'
                        : 'text-slate-500'
                    }
                  `}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.icon && (
                    <span className="material-symbols-outlined text-sm">
                      {item.icon}
                    </span>
                  )}
                  <span>{item.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
});

Breadcrumbs.displayName = 'Breadcrumbs';

/**
 * Back Button Component
 * Provides a quick "back to X" navigation
 * REMEDIATION ITEM 6: Wrapped in React.memo
 */
export const BackButton = memo<{
  to: string;
  label?: string;
  className?: string;
}>(({ to, label = 'Back', className = '' }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <Link
      to={to}
      className={`
        inline-flex items-center gap-2 px-3 py-2 rounded-xl
        text-sm font-medium transition-all duration-150
        active:scale-95 press-spring
        ${isDark
          ? 'text-slate-400 hover:text-white hover:bg-slate-800 border border-white/10'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
        }
        ${className}
      `}
    >
      <span className="material-symbols-outlined text-lg">arrow_back</span>
      <span>{label}</span>
    </Link>
  );
});

BackButton.displayName = 'BackButton';

/**
 * Job Creation Breadcrumbs - Preset for job creation flow
 * REMEDIATION ITEM 6: Wrapped in React.memo
 */
export const JobCreationBreadcrumbs = memo<{
  currentStep?: string;
  className?: string;
}>(({ currentStep = 'New Job', className }) => (
  <Breadcrumbs
    items={[
      { label: 'Jobs', href: '/admin/jobs', icon: 'work' },
      { label: currentStep },
    ]}
    className={className}
  />
));

JobCreationBreadcrumbs.displayName = 'JobCreationBreadcrumbs';

/**
 * Client Creation Breadcrumbs - Preset for client creation flow
 * REMEDIATION ITEM 6: Wrapped in React.memo
 */
export const ClientCreationBreadcrumbs = memo<{
  currentStep?: string;
  className?: string;
}>(({ currentStep = 'New Client', className }) => (
  <Breadcrumbs
    items={[
      { label: 'Clients', href: '/admin/clients', icon: 'people' },
      { label: currentStep },
    ]}
    className={className}
  />
));

ClientCreationBreadcrumbs.displayName = 'ClientCreationBreadcrumbs';

/**
 * Technician Creation Breadcrumbs - Preset for technician creation flow
 * REMEDIATION ITEM 6: Wrapped in React.memo
 */
export const TechnicianCreationBreadcrumbs = memo<{
  currentStep?: string;
  className?: string;
}>(({ currentStep = 'New Technician', className }) => (
  <Breadcrumbs
    items={[
      { label: 'Technicians', href: '/admin/technicians', icon: 'engineering' },
      { label: currentStep },
    ]}
    className={className}
  />
));

TechnicianCreationBreadcrumbs.displayName = 'TechnicianCreationBreadcrumbs';

export default Breadcrumbs;
