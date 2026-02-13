import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlanSelector } from '../components/PlanSelector';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/theme';

/**
 * SelectPlan - Post-signup plan selection view
 *
 * Shows after user creates account. Allows them to:
 * 1. Continue with Solo (free) tier
 * 2. Start a 14-day trial of Team or Agency (no CC required)
 */
const SelectPlan: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, userEmail } = useAuth();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // If not authenticated, redirect to auth
  if (!isAuthenticated) {
    navigate('/auth');
    return null;
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-950' : 'bg-slate-50'} px-4 py-8 md:py-12`}>
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <header className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
              check_circle
            </span>
            <span className="text-xs font-medium tracking-wider">Account Created</span>
          </div>

          <h1 className={`text-3xl md:text-4xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Welcome to JobProof!
          </h1>

          <p className={`text-lg ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {userEmail ? `Signed in as ${userEmail}` : 'Choose a plan to get started'}
          </p>

          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-400'} max-w-xl mx-auto`}>
            Start with our free Solo plan, or try Team or Agency free for 14 days.
            <br />
            <strong>No credit card required</strong> to start your trial.
          </p>
        </header>

        {/* Plan Selection */}
        <PlanSelector showTrialBadge />

        {/* Skip Link */}
        <div className="text-center pt-4">
          <Link
            to="/admin"
            className={`
              inline-flex items-center gap-2 text-sm font-medium
              ${isDark ? 'text-slate-400 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}
              transition-colors
            `}
          >
            Skip for now, continue with free plan
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </Link>
        </div>

        {/* Footer */}
        <footer className={`text-center text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'} pt-8`}>
          <p>
            By selecting a plan, you agree to our{' '}
            <Link to="/legal/terms" className="underline hover:no-underline">Terms of Service</Link>
            {' '}and{' '}
            <Link to="/legal/privacy" className="underline hover:no-underline">Privacy Policy</Link>.
          </p>
        </footer>
      </div>
    </div>
  );
};

export default SelectPlan;
