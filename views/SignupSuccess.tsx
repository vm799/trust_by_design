import React from 'react';
import { Link, useLocation } from 'react-router-dom';
// REMEDIATION ITEM 13: Static import since view is already lazy-loaded
import { getSupabase } from '../lib/supabase';

interface LocationState {
  email?: string;
  workspaceName?: string;
}

/**
 * Professional Workspace Creation Success Screen
 *
 * Shown after successful signup to guide users through verification.
 * Replaces the old "alert" flow with clear 3-step guidance.
 */
const SignupSuccess: React.FC = () => {
  const location = useLocation();
  const state = location.state as LocationState;
  const email = state?.email || 'your email';
  const workspaceName = state?.workspaceName || 'your workspace';

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 py-6 md:px-6 md:py-8 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 -left-20 size-96 bg-success/20 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-0 -right-20 size-96 bg-primary/10 blur-[120px] rounded-full"></div>

      <div className="w-full max-w-2xl space-y-8 relative z-10 animate-in">
        {/* Success Icon */}
        <div className="flex justify-center">
          <div className="bg-success/10 size-24 rounded-full flex items-center justify-center border border-success/20">
            <span className="material-symbols-outlined text-success text-6xl">check_circle</span>
          </div>
        </div>

        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-black text-white uppercase tracking-tighter">
            Workspace Created!
          </h1>
          <p className="text-slate-400 text-lg">
            Welcome to <span className="text-primary font-black">{workspaceName}</span>!
          </p>
          <p className="text-slate-500 text-sm">
            We've sent a verification email to <span className="text-white font-bold">{email}</span>
          </p>
        </div>

        {/* 3-Step Guide */}
        <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-8 space-y-6">
          <h2 className="text-xl font-black text-white uppercase tracking-tighter text-center">
            Next Steps
          </h2>

          <div className="space-y-4">
            {/* Step 1 */}
            <div className="flex items-start gap-4 p-4 bg-slate-800/50 rounded-2xl border border-white/5">
              <div className="bg-primary size-10 rounded-xl flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-white text-xl">mail</span>
              </div>
              <div className="flex-1">
                <h3 className="text-white font-black text-sm uppercase tracking-wide mb-1">
                  1. Check Your Email
                </h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Click the verification link we just sent to <span className="text-white font-bold">{email}</span>
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-4 p-4 bg-slate-800/50 rounded-2xl border border-white/5">
              <div className="bg-primary size-10 rounded-xl flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-white text-xl">login</span>
              </div>
              <div className="flex-1">
                <h3 className="text-white font-black text-sm uppercase tracking-wide mb-1">
                  2. Sign In to Your Hub
                </h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  After verifying your email, you'll be automatically redirected to your workspace dashboard
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-4 p-4 bg-slate-800/50 rounded-2xl border border-white/5">
              <div className="bg-primary size-10 rounded-xl flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-white text-xl">rocket_launch</span>
              </div>
              <div className="flex-1">
                <h3 className="text-white font-black text-sm uppercase tracking-wide mb-1">
                  3. Start Dispatching Jobs
                </h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Create your first job, add technicians, and start building professional audit trails
                </p>
              </div>
            </div>
          </div>

          {/* Primary CTA */}
          <Link
            to="/auth/login"
            className="w-full block py-4 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black text-sm uppercase tracking-widest text-center shadow-xl shadow-primary/20 transition-all active:scale-95"
          >
            Go to Sign In
          </Link>

          {/* Secondary Action */}
          <div className="text-center">
            <p className="text-slate-500 text-xs mb-2">Didn't receive the email?</p>
            <button
              type="button"
              className="text-primary text-xs font-bold hover:underline uppercase tracking-wide"
              onClick={async () => {
                const supabase = getSupabase();
                if (!supabase) {
                  alert('Supabase not configured');
                  return;
                }

                const { error } = await supabase.auth.resend({
                  type: 'signup',
                  email: email
                });

                if (error) {
                  alert(`Failed to resend: ${error.message}`);
                } else {
                  alert('Verification email sent! Check your inbox.');
                }
              }}
            >
              Resend Verification Email
            </button>
          </div>
        </div>

        {/* Support Info */}
        <div className="text-center">
          <p className="text-slate-500 text-xs">
            Need help? Contact{' '}
            <a href="mailto:support@jobproof.io" className="text-primary font-bold hover:underline">
              support@jobproof.io
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignupSuccess;
