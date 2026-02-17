/**
 * AppShell - Main Application Layout
 *
 * Provides the unified layout structure for the manager dashboard:
 * - Desktop: Sidebar + Main content
 * - Mobile: Bottom nav + Main content
 *
 * Phase A: Foundation & App Shell
 */

import React, { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import FloatingActionPanel from '../ui/FloatingActionPanel';
import { useAuth } from '../../lib/AuthContext';
import { OfflineIndicator } from '../OfflineIndicator';

const getAuth = () => import('../../lib/auth');

interface AppShellProps {
  children?: React.ReactNode;
}

const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { userEmail } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(prev => !prev);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  // Get user initials for avatar
  const userInitials = userEmail?.charAt(0).toUpperCase() || 'U';

  const handleLogout = useCallback(async () => {
    const auth = await getAuth();
    await auth.signOut();
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-slate-950 transition-colors">
      {/* Desktop Sidebar - hidden on mobile */}
      <Sidebar
        className="hidden lg:flex"
        userInitials={userInitials}
        userEmail={userEmail || ''}
        onLogout={handleLogout}
      />

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation menu"
          onClick={closeMobileMenu}
          onKeyDown={(e) => { if (e.key === 'Escape') { closeMobileMenu(); } }}
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
        >
          <div className="absolute inset-0 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl" />
          <div
            className="relative h-full w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-white/10 animate-in slide-in-from-left"
            role="presentation"
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.stopPropagation()}
          >
            <Sidebar
              className="flex"
              userInitials={userInitials}
              userEmail={userEmail || ''}
              onNavigate={closeMobileMenu}
              onLogout={handleLogout}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header - Mobile hamburger + context */}
        <header className="h-14 lg:h-16 border-b border-slate-200 dark:border-white/15 flex items-center justify-between px-4 lg:px-8 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40 transition-colors">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              onClick={toggleMobileMenu}
              className="lg:hidden p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              aria-label="Open menu"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Offline indicator */}
            <OfflineIndicator />

            {/* Notifications */}
            <button className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors relative" aria-label="Notifications">
              <span className="material-symbols-outlined" aria-hidden="true">notifications</span>
              {/* Notification badge - show when there are unread */}
              {/* <span className="absolute top-1 right-1 size-2 bg-primary rounded-full" /> */}
            </button>

            {/* User avatar - desktop only, mobile uses bottom nav */}
            <div className="hidden lg:flex items-center gap-3">
              <div className="size-8 rounded-lg bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white text-sm font-bold">
                {userInitials}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          {children || <Outlet />}
        </main>

        {/* Floating Action Panel - Context-sensitive CTA above bottom nav */}
        <FloatingActionPanel />

        {/* Mobile Bottom Navigation */}
        <BottomNav className="lg:hidden" />
      </div>
    </div>
  );
};

export default AppShell;
