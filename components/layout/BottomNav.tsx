/**
 * BottomNav - Mobile Bottom Navigation
 *
 * Provides thumb-zone optimized navigation for mobile users.
 * REMEDIATION ITEM 6: Wrapped in React.memo to prevent unnecessary re-renders
 *
 * Phase A: Foundation & App Shell
 */

import React, { memo } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface BottomNavProps {
  className?: string;
}

interface NavItem {
  to: string;
  icon: string;
  label: string;
}

const navItems: NavItem[] = [
  { to: '/app', icon: 'dashboard', label: 'Home' },
  { to: '/app/clients', icon: 'group', label: 'Clients' },
  { to: '/app/jobs', icon: 'work', label: 'Jobs' },
  { to: '/app/invoices', icon: 'receipt_long', label: 'Invoices' },
  { to: '/app/settings', icon: 'more_horiz', label: 'More' },
];

// Memoized nav item component to prevent re-renders when other items change
const NavItemLink = memo<{ item: NavItem; active: boolean }>(({ item, active }) => (
  <Link
    to={item.to}
    className={`
      flex flex-col items-center justify-center gap-1
      min-w-[64px] min-h-[48px] px-3 py-2
      rounded-xl transition-colors
      ${active
        ? 'text-primary'
        : 'text-slate-500 hover:text-slate-300'
      }
    `}
  >
    <span className={`material-symbols-outlined text-2xl ${active ? 'font-bold' : ''}`}>
      {item.icon}
    </span>
    <span className={`text-[10px] ${active ? 'font-bold' : 'font-medium'}`}>
      {item.label}
    </span>
  </Link>
));

NavItemLink.displayName = 'NavItemLink';

const BottomNav: React.FC<BottomNavProps> = ({ className = '' }) => {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/app') {
      return location.pathname === '/app' || location.pathname === '/app/';
    }
    if (path === '/app/settings') {
      // "More" tab is active for settings, technicians, and other secondary pages
      return location.pathname.startsWith('/app/settings') ||
             location.pathname.startsWith('/app/technicians');
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className={`
      fixed bottom-0 left-0 right-0 z-40
      bg-slate-950/95 backdrop-blur-xl border-t border-white/10
      px-2 pb-safe
      ${className}
    `}>
      <div className="flex items-center justify-around h-16">
        {navItems.map(item => (
          <NavItemLink
            key={item.to}
            item={item}
            active={isActive(item.to)}
          />
        ))}
      </div>
    </nav>
  );
};

// REMEDIATION ITEM 6: Export memoized component
export default memo(BottomNav);
