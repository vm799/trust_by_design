/**
 * BottomNav - Mobile Sticky Bottom Navigation
 *
 * 5-item bottom bar with center FAB for quick job creation.
 * Optimized for thumb-zone ergonomics on field worker devices.
 *
 * Layout: [Dashboard] [Jobs] [+FAB] [Clients] [Techs]
 *
 * REMEDIATION ITEM 6: Wrapped in React.memo to prevent unnecessary re-renders
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
  { to: '/admin', icon: 'dashboard', label: 'Dashboard' },
  { to: '/admin/jobs', icon: 'work', label: 'Jobs' },
  // Center FAB slot is rendered separately
  { to: '/admin/clients', icon: 'group', label: 'Clients' },
  { to: '/admin/technicians', icon: 'engineering', label: 'Techs' },
];

const NavItemLink = memo<{ item: NavItem; active: boolean }>(({ item, active }) => (
  <Link
    to={item.to}
    aria-current={active ? 'page' : undefined}
    className={`
      relative flex flex-col items-center justify-center gap-0.5
      min-w-[56px] min-h-[48px] px-2 py-1.5
      rounded-xl transition-colors
      ${active
        ? 'text-primary bg-primary/10'
        : 'text-slate-500 hover:text-slate-300'
      }
    `}
  >
    {active && (
      <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-primary" />
    )}
    <span className={`material-symbols-outlined text-xl ${active ? 'font-bold' : ''}`} aria-hidden="true">
      {item.icon}
    </span>
    <span className={`text-[10px] leading-tight ${active ? 'font-bold' : 'font-medium'}`}>
      {item.label}
    </span>
  </Link>
));

NavItemLink.displayName = 'NavItemLink';

const BottomNav: React.FC<BottomNavProps> = ({ className = '' }) => {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin' || location.pathname === '/admin/';
    }
    return location.pathname.startsWith(path);
  };

  const leftItems = navItems.slice(0, 2);
  const rightItems = navItems.slice(2);

  return (
    <nav
      aria-label="Main navigation"
      className={`
        fixed bottom-0 left-0 right-0 z-40
        bg-slate-950/95 backdrop-blur-xl border-t border-white/10
        pb-safe
        ${className}
      `}
    >
      <div className="flex items-end justify-around h-16 px-1 relative">
        {/* Left items: Dashboard, Jobs */}
        {leftItems.map(item => (
          <NavItemLink
            key={item.to}
            item={item}
            active={isActive(item.to)}
          />
        ))}

        {/* Center FAB: Add Job */}
        <div className="flex flex-col items-center -mt-4">
          <Link
            to="/admin/jobs/new"
            aria-label="Create new job"
            className="
              size-[56px] rounded-2xl
              bg-gradient-to-br from-primary to-blue-600
              flex items-center justify-center
              shadow-lg shadow-primary/30
              active:scale-95 transition-transform
              min-h-[56px]
            "
          >
            <span className="material-symbols-outlined text-white text-3xl font-bold" aria-hidden="true">
              add
            </span>
          </Link>
          <span className="text-[10px] font-medium text-slate-500 mt-0.5 leading-tight">
            New
          </span>
        </div>

        {/* Right items: Clients, Techs */}
        {rightItems.map(item => (
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

export default memo(BottomNav);
