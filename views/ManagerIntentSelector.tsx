/**
 * ManagerIntentSelector - Intent-First Entry Point for Managers
 *
 * After magic link authentication, managers land here to choose their workflow:
 * 1. Dispatch Job → /admin/create
 * 2. Review Jobs → /admin
 * 3. Notifications → /admin/notifications (future)
 *
 * Phase: V1 MVP - UAT Ready
 * UX Pattern: Intent-first (reduces cognitive load)
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserProfile } from '../types';
import { InfoBox } from '../components/ui';

interface ManagerIntentSelectorProps {
  user: UserProfile | null;
  pendingJobsCount?: number;
  unseenNotificationsCount?: number;
}

const ManagerIntentSelector: React.FC<ManagerIntentSelectorProps> = ({
  user,
  pendingJobsCount = 0,
  unseenNotificationsCount = 0
}) => {
  const navigate = useNavigate();

  // Extract display name - handle email-as-name fallback gracefully
  const rawName = user?.name || '';
  const isEmailAsName = rawName.includes('@');
  const displayName = isEmailAsName
    ? rawName.split('@')[0] // Extract part before @ for emails
    : (rawName.split(' ')[0] || 'Manager'); // First name or fallback

  // Check if this is a first-time user
  // CRITICAL FIX: Don't treat name===email as first-time if user has complete profile
  // A complete profile means they went through OAuthSetup (workspace + persona exist)
  const hasCompleteProfile = !!(user?.workspace?.id && user?.persona);
  const isFirstTimeUser = !hasCompleteProfile;

  // PWA tip banner - show once per session if not installed
  const [showPwaTip, setShowPwaTip] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    // Don't show if already dismissed this session
    if (sessionStorage.getItem('jobproof_pwa_tip_dismissed')) return false;
    // Don't show if already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return false;
    return true;
  });

  const dismissPwaTip = () => {
    setShowPwaTip(false);
    sessionStorage.setItem('jobproof_pwa_tip_dismissed', 'true');
  };

  // Get current date formatted
  const today = new Date();
  const dateString = today.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const timeString = today.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  const intentOptions = [
    {
      id: 'dispatch',
      icon: 'add_circle',
      title: 'Dispatch Job',
      description: 'Create and assign a field service order',
      examples: 'Boiler service • Site survey • Repair',
      route: '/admin/create',
      shortcut: 'D',
      primary: true,
    },
    {
      id: 'review',
      icon: 'assignment',
      title: 'Review Jobs',
      description: 'Track progress and check evidence',
      examples: `${pendingJobsCount} active • Awaiting seal • Issues`,
      route: '/admin',
      shortcut: 'R',
      primary: false,
    },
    {
      id: 'notifications',
      icon: 'notifications',
      title: 'Notifications',
      description: 'Messages and system alerts',
      examples: `${unseenNotificationsCount || 'No'} unread`,
      route: '/admin', // Future: /admin/notifications
      shortcut: 'N',
      primary: false,
      badge: unseenNotificationsCount > 0 ? unseenNotificationsCount : undefined,
    },
  ];

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toUpperCase();
      if (key === 'D' || key === '1') navigate('/admin/create');
      if (key === 'R' || key === '2') navigate('/admin');
      if (key === 'N' || key === '3') navigate('/admin'); // Future: /admin/notifications
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="p-6 pb-0">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin')}
              className="min-w-[48px] min-h-[48px] flex items-center justify-center text-slate-400 hover:text-white transition-colors rounded-xl hover:bg-white/5 press-spring"
              aria-label="Back to dashboard"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="size-10 bg-primary/20 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-xl">verified_user</span>
            </div>
            <span className="text-sm font-bold text-white">JobProof</span>
          </div>
          <button
            onClick={() => navigate('/admin/profile')}
            className="min-w-[48px] min-h-[48px] flex items-center justify-center text-slate-400 hover:text-white transition-colors rounded-xl hover:bg-white/5 press-spring"
            aria-label="Profile settings"
          >
            <span className="material-symbols-outlined">account_circle</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col justify-center px-6 py-8">
        <div className="max-w-lg mx-auto w-full space-y-8">
          {/* Welcome Message */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-black text-white tracking-tight">
              {isFirstTimeUser ? `Welcome to JobProof` : `Welcome back, ${displayName}`}
            </h1>
            <p className="text-sm text-slate-400">
              {dateString} • {timeString}
            </p>
            {isFirstTimeUser && (
              <p className="text-sm text-primary mt-2">
                Let's get you set up! Start by creating your first job.
              </p>
            )}
          </div>

          {/* PWA Tip Banner */}
          {showPwaTip && (
            <InfoBox
              icon="add_to_home_screen"
              title="Add to Home Screen"
              variant="tip"
              onDismiss={dismissPwaTip}
            >
              For quick access, bookmark this app. On mobile, tap your browser's share button and select "Add to Home Screen".
            </InfoBox>
          )}

          {/* Intent Question */}
          <div className="text-center">
            <p className="text-lg font-medium text-slate-300">
              What do you need to do now?
            </p>
          </div>

          {/* Intent Cards */}
          <div className="space-y-4">
            {intentOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => navigate(option.route)}
                className={`
                  w-full p-6 rounded-2xl border transition-all
                  min-h-[100px] text-left group relative
                  active:scale-[0.98]
                  ${option.primary
                    ? 'bg-primary/10 border-primary/30 hover:bg-primary/20 hover:border-primary/50'
                    : 'bg-slate-900/50 border-white/10 hover:bg-slate-900 hover:border-white/20'
                  }
                `}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`
                    size-14 rounded-2xl flex items-center justify-center flex-shrink-0
                    ${option.primary ? 'bg-primary/20' : 'bg-white/5'}
                  `}>
                    <span className={`
                      material-symbols-outlined text-3xl
                      ${option.primary ? 'text-primary' : 'text-slate-400 group-hover:text-white'}
                    `}>
                      {option.icon}
                    </span>
                    {option.badge && (
                      <span className="absolute -top-1 -right-1 size-5 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {option.badge}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className={`
                        text-lg font-bold uppercase tracking-tight
                        ${option.primary ? 'text-white' : 'text-slate-200 group-hover:text-white'}
                      `}>
                        {option.title}
                      </h2>
                      <span className="material-symbols-outlined text-slate-600 group-hover:text-slate-400 transition-colors">
                        arrow_forward
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">
                      {option.description}
                    </p>
                    <p className="text-xs text-slate-500 mt-2 border-t border-white/5 pt-2">
                      {option.examples}
                    </p>
                  </div>
                </div>

                {/* Keyboard Shortcut Hint */}
                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <kbd className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded font-mono">
                    {option.shortcut}
                  </kbd>
                </div>
              </button>
            ))}
          </div>

          {/* Quick Stats (Optional) */}
          {pendingJobsCount > 0 && (
            <div className="bg-slate-900/50 border border-white/5 rounded-xl p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Active jobs requiring attention</span>
                <span className="text-white font-bold">{pendingJobsCount}</span>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer Navigation */}
      <footer className="p-4 border-t border-white/5">
        <div className="flex items-center justify-center gap-8 max-w-lg mx-auto">
          <button
            onClick={() => navigate('/admin')}
            className="min-w-[48px] min-h-[48px] flex flex-col items-center gap-1 text-slate-500 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-xl">person</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Profile</span>
          </button>
          <button
            onClick={() => navigate('/admin')}
            className="min-w-[48px] min-h-[48px] flex flex-col items-center gap-1 text-slate-500 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-xl">settings</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Settings</span>
          </button>
          <button
            onClick={() => navigate('/home')}
            className="min-w-[48px] min-h-[48px] flex flex-col items-center gap-1 text-slate-500 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-xl">help</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Help</span>
          </button>
        </div>
      </footer>
    </div>
  );
};

export default ManagerIntentSelector;
