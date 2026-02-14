/**
 * Sidebar - Desktop Navigation
 *
 * Provides the main navigation for desktop users.
 * REMEDIATION ITEM 6: Wrapped in React.memo to prevent unnecessary re-renders
 *
 * Phase A: Foundation & App Shell
 */

import React, { memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { JobProofLogo } from '../branding/jobproof-logo';

interface SidebarProps {
  className?: string;
  userInitials: string;
  userEmail: string;
  onNavigate?: () => void;
  onLogout?: () => void;
}

interface NavItem {
  to: string;
  icon: string;
  label: string;
  badge?: number;
}

const mainNavItems: NavItem[] = [
  { to: '/app', icon: 'dashboard', label: 'Dashboard' },
  { to: '/app/clients', icon: 'group', label: 'Clients' },
  { to: '/app/jobs', icon: 'work', label: 'Jobs' },
  { to: '/app/technicians', icon: 'engineering', label: 'Technicians' },
];

const secondaryNavItems: NavItem[] = [
  { to: '/app/settings', icon: 'settings', label: 'Settings' },
  { to: '/app/settings/billing', icon: 'payments', label: 'Billing' },
];

const Sidebar: React.FC<SidebarProps> = ({
  className = '',
  userInitials,
  userEmail,
  onNavigate,
  onLogout
}) => {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/app') {
      return location.pathname === '/app' || location.pathname === '/app/';
    }
    return location.pathname.startsWith(path);
  };

  const handleClick = () => {
    onNavigate?.();
  };

  return (
    <aside className={`w-64 flex-col border-r border-white/15 bg-slate-950/50 ${className}`}>
      {/* Logo */}
      <div className="p-6 border-b border-white/15">
        <Link to="/app" onClick={handleClick}>
          <JobProofLogo variant="full" size="md" />
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 py-2">
          <span className="text-xs font-bold text-blue-400/70 uppercase tracking-widest">
            Management
          </span>
        </div>

        {mainNavItems.map(item => (
          <NavLink
            key={item.to}
            {...item}
            active={isActive(item.to)}
            onClick={handleClick}
          />
        ))}

        <div className="px-3 py-2 mt-6">
          <span className="text-xs font-bold text-blue-400/70 uppercase tracking-widest">
            Settings
          </span>
        </div>

        {secondaryNavItems.map(item => (
          <NavLink
            key={item.to}
            {...item}
            active={isActive(item.to)}
            onClick={handleClick}
          />
        ))}
      </nav>

      {/* User Profile Footer */}
      <div className="p-4 border-t border-white/15 space-y-2">
        <Link
          to="/app/settings"
          onClick={handleClick}
          className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors"
        >
          <div className="size-10 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white font-bold">
            {userInitials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{userEmail}</p>
            <p className="text-xs text-slate-300">Manage account</p>
          </div>
        </Link>
        {onLogout && (
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all min-h-[44px]"
          >
            <span className="material-symbols-outlined text-xl" aria-hidden="true">logout</span>
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        )}
      </div>
    </aside>
  );
};

interface NavLinkProps extends NavItem {
  active: boolean;
  onClick?: () => void;
}

// REMEDIATION ITEM 6: Memoized NavLink to prevent re-renders when other items change
const NavLink = memo<NavLinkProps>(({ to, icon, label, badge, active, onClick }) => (
  <Link
    to={to}
    onClick={onClick}
    aria-current={active ? 'page' : undefined}
    className={`
      flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all
      ${active
        ? 'bg-primary/10 text-primary border border-primary/20'
        : 'text-slate-300 hover:bg-white/5 hover:text-white'
      }
    `}
  >
    <span className="material-symbols-outlined text-xl" aria-hidden="true">{icon}</span>
    <span className="text-sm font-medium flex-1">{label}</span>
    {badge !== undefined && badge > 0 && (
      <span className="px-2 py-0.5 text-xs font-bold bg-primary text-white rounded-full">
        {badge > 99 ? '99+' : badge}
      </span>
    )}
  </Link>
));

NavLink.displayName = 'NavLink';

// REMEDIATION ITEM 6: Export memoized Sidebar
export default memo(Sidebar);
