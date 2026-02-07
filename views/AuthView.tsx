import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { signInWithMagicLink, signIn } from '../lib/auth';
import { shouldShowDevLogin, shouldShowPasswordLogin, getTestUsers } from '../lib/devAuth';
import type { TestUser } from '../lib/devAuth';

/**
 * Auth View - Environment-Aware Authentication
 *
 * Three modes based on environment:
 * - Dev (localhost): Quick-login buttons for 3 test roles + magic link
 * - Staging: Email + password fields + magic link toggle
 * - Production: Magic link only (passwordless)
 *
 * British English throughout
 */
const AuthView: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [devLoginRole, setDevLoginRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'magic_link' | 'password'>('magic_link');

  const emailRef = useRef<HTMLInputElement>(null);

  const showDevLogin = shouldShowDevLogin();
  const showPasswordLogin = shouldShowPasswordLogin();
  const testUsers = showDevLogin ? getTestUsers() : [];

  // Auto-focus email on mount
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  /**
   * Dev Quick Login - sign in as a test user with one click
   */
  const handleDevLogin = async (testUser: TestUser) => {
    setLoading(true);
    setDevLoginRole(testUser.role);
    setError(null);

    try {
      const result = await signIn(testUser.email, testUser.password);

      if (!result.success) {
        const msg = result.error?.message || 'Sign-in failed';

        if (msg.includes('Invalid login credentials')) {
          throw new Error(
            `Test user "${testUser.label}" not found in Supabase. ` +
            'Create test users first — see supabase/seed-test-users.sql'
          );
        }

        throw new Error(msg);
      }

      // Success — AuthContext picks up the session change automatically
      // PersonaRedirect in App.tsx handles routing to the correct dashboard
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dev login failed');
      setLoading(false);
      setDevLoginRole(null);
    }
  };

  /**
   * Password Sign In - for staging and dev fallback
   */
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();

    try {
      const result = await signIn(normalizedEmail, password);

      if (!result.success) {
        const msg = result.error?.message || 'Sign-in failed';

        if (result.rateLimited) {
          const waitTime = result.retryAfter || 60;
          throw new Error(
            `Rate limit reached. Please wait ${waitTime} seconds before trying again.`
          );
        }

        if (msg.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password. Please check your credentials and try again.');
        }

        throw new Error(msg);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
      setLoading(false);
    }
  };

  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    // Normalize email (trim whitespace, lowercase)
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const result = await signInWithMagicLink(normalizedEmail);

      if (!result.success) {
        const errorMsg = result.error?.message || 'Failed to send magic link';

        // Handle rate limiting with specific, actionable message
        if (result.rateLimited) {
          const waitTime = result.retryAfter || 60;
          throw new Error(
            `Email service rate limit reached. Please wait ${waitTime > 60 ? Math.ceil(waitTime / 60) + ' minute(s)' : waitTime + ' seconds'} before trying again. ` +
            'This is a security feature to prevent spam.'
          );
        }

        // Handle specific Supabase errors with user-friendly messages
        if (errorMsg.toLowerCase().includes('invalid') && errorMsg.toLowerCase().includes('email')) {
          throw new Error(
            'Unable to send to this email address. This may be due to email provider restrictions. ' +
            'Please try a different email address (Gmail, Outlook, or work email recommended).'
          );
        }

        if (errorMsg.includes('rate limit') || errorMsg.includes('too many') || errorMsg.includes('exceeded')) {
          throw new Error(
            'Too many sign-in attempts. The email service has a limit of 4 emails per hour per address. ' +
            'Please wait a few minutes and try again, or use a different email address.'
          );
        }

        // Handle "For security purposes" errors from Supabase
        if (errorMsg.includes('security') || errorMsg.includes('Security')) {
          throw new Error(
            'Temporarily blocked for security. This can happen after multiple sign-in attempts from the same network. ' +
            'Please wait 5-10 minutes and try again.'
          );
        }

        throw new Error(errorMsg);
      }

      setSuccessMessage(`Magic link sent to ${normalizedEmail}! Check your inbox.`);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send magic link');
      setLoading(false);
    }
  };

  // Success state - magic link sent
  if (successMessage) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 py-6 md:px-6 md:py-8 relative overflow-hidden">
        {/* Background Orbs */}
        <div className="absolute top-0 -left-20 size-96 bg-success/20 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-0 -right-20 size-96 bg-primary/20 blur-[120px] rounded-full"></div>

        <div className="w-full max-w-md space-y-8 relative z-10 animate-in text-center">
          <div className="bg-success/10 size-24 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-success/30">
            <span className="material-symbols-outlined text-success text-6xl font-black">mark_email_read</span>
          </div>

          <div className="space-y-4">
            <h2 className="text-4xl font-black text-white uppercase tracking-tighter">
              Check Your Email
            </h2>
            <p className="text-slate-400 text-base font-medium max-w-sm mx-auto leading-relaxed">
              {successMessage}
            </p>
          </div>

          <div className="bg-slate-900 border border-white/5 p-8 rounded-[2.5rem] shadow-2xl space-y-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3 text-left">
                <div className="bg-primary/10 size-10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-primary text-lg font-black">inbox</span>
                </div>
                <div>
                  <h3 className="text-white font-black text-sm uppercase tracking-widest mb-1">Open Your Email</h3>
                  <p className="text-slate-400 text-xs font-medium leading-relaxed">
                    Look for an email from JobProof with your magic link.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-left">
                <div className="bg-primary/10 size-10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-primary text-lg font-black">touch_app</span>
                </div>
                <div>
                  <h3 className="text-white font-black text-sm uppercase tracking-widest mb-1">Click the Link</h3>
                  <p className="text-slate-400 text-xs font-medium leading-relaxed">
                    The link will sign you in automatically — no password needed.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-left">
                <div className="bg-primary/10 size-10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-primary text-lg font-black">rocket_launch</span>
                </div>
                <div>
                  <h3 className="text-white font-black text-sm uppercase tracking-widest mb-1">Start Working</h3>
                  <p className="text-slate-400 text-xs font-medium leading-relaxed">
                    Access your operations hub instantly.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5">
              <p className="text-slate-500 text-xs font-medium mb-3">
                Didn't receive the email? Check your spam folder or try again.
              </p>
              <button
                onClick={() => setSuccessMessage(null)}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
              >
                Send Another Link
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 py-6 md:px-6 md:py-8 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 -left-20 size-96 bg-primary/20 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-0 -right-20 size-96 bg-blue-500/10 blur-[120px] rounded-full"></div>

      <div className="w-full max-w-md space-y-6 relative z-10 animate-in">
        <div className="text-center space-y-4">
          <Link to="/home" className="inline-flex items-center gap-3 group">
            <div className="bg-primary size-12 rounded-2xl flex items-center justify-center shadow-xl shadow-primary/30 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-white text-2xl font-black">verified</span>
            </div>
            <span className="text-3xl font-black tracking-tighter text-white uppercase">JobProof</span>
          </Link>
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
              Get Started
            </h2>
            <p className="text-slate-300 text-sm font-medium">
              {showDevLogin
                ? 'Dev mode — quick login as any role, or use magic link below.'
                : 'Enter your email to receive a secure sign-in link. New users will choose their role next.'}
            </p>
          </div>
        </div>

        {/* Error Display - shared across all auth modes */}
        {error && (
          <div className="bg-danger/10 border border-danger/20 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-danger text-sm mt-0.5">error</span>
              <div>
                <p className="text-danger text-xs font-bold uppercase">Error</p>
                <p className="text-danger text-xs font-medium mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================= */}
        {/* DEV QUICK LOGIN - localhost only           */}
        {/* ========================================= */}
        {showDevLogin && testUsers.length > 0 && (
          <div className="bg-slate-900 border border-amber-500/30 p-6 rounded-[2.5rem] shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-amber-500/10 size-10 rounded-xl flex items-center justify-center">
                <span className="material-symbols-outlined text-amber-400 text-lg font-black">developer_mode</span>
              </div>
              <div>
                <p className="text-amber-400 text-xs font-black uppercase tracking-widest">Dev Quick Login</p>
                <p className="text-slate-400 text-[10px] font-medium">One-click sign in as any role</p>
              </div>
            </div>

            <div className="space-y-3">
              {testUsers.map((testUser) => (
                <button
                  key={testUser.role}
                  onClick={() => handleDevLogin(testUser)}
                  disabled={loading}
                  className="w-full py-4 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-amber-500/40 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center gap-4 disabled:opacity-50 disabled:cursor-not-allowed min-h-[56px]"
                >
                  {loading && devLoginRole === testUser.role ? (
                    <div className="size-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin flex-shrink-0"></div>
                  ) : (
                    <span className="material-symbols-outlined text-amber-400 text-xl flex-shrink-0">{testUser.icon}</span>
                  )}
                  <div className="text-left flex-1">
                    <p className="text-sm font-black">{testUser.label}</p>
                    <p className="text-slate-400 text-[10px] font-medium normal-case tracking-normal">{testUser.description}</p>
                  </div>
                </button>
              ))}
            </div>

            {testUsers.length === 0 && (
              <p className="text-slate-500 text-xs text-center py-2">
                Set VITE_TEST_*_EMAIL and VITE_TEST_*_PASSWORD in .env.local
              </p>
            )}
          </div>
        )}

        {/* No test users configured hint */}
        {showDevLogin && testUsers.length === 0 && (
          <div className="bg-slate-900 border border-amber-500/30 p-6 rounded-[2.5rem] shadow-2xl space-y-3">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-amber-400 text-lg">developer_mode</span>
              <p className="text-amber-400 text-xs font-black uppercase tracking-widest">Dev Mode Active</p>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              Quick login not configured. Add test user credentials to <code className="text-amber-400 bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">.env.local</code> — see <code className="text-amber-400 bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">.env.example</code> for details.
            </p>
          </div>
        )}

        {/* ========================================= */}
        {/* AUTH MODE TOGGLE - dev/staging only        */}
        {/* ========================================= */}
        {showPasswordLogin && (
          <div className="flex gap-2">
            <button
              onClick={() => setAuthMode('magic_link')}
              className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all min-h-[44px] ${
                authMode === 'magic_link'
                  ? 'bg-primary text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Magic Link
            </button>
            <button
              onClick={() => setAuthMode('password')}
              className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all min-h-[44px] ${
                authMode === 'password'
                  ? 'bg-primary text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Password
            </button>
          </div>
        )}

        {/* ========================================= */}
        {/* PASSWORD SIGN IN FORM                      */}
        {/* ========================================= */}
        {showPasswordLogin && authMode === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="bg-slate-900 border border-white/5 p-8 rounded-[2.5rem] shadow-2xl space-y-6">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-center gap-3">
              <span className="material-symbols-outlined text-blue-400 text-xl">lock</span>
              <div>
                <p className="text-blue-400 text-xs font-black uppercase">Password Sign-In</p>
                <p className="text-slate-400 text-[10px] font-medium">
                  {showDevLogin ? 'Dev/staging mode — use test account credentials' : 'Sign in with email and password'}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                Email Address *
              </label>
              <input
                required
                type="email"
                placeholder="test-manager@jobproof.pro"
                className="w-full bg-slate-800 border-slate-700 border rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-slate-900 outline-none transition-all"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                Password *
              </label>
              <input
                required
                type="password"
                placeholder="Enter password"
                className="w-full bg-slate-800 border-slate-700 border rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-slate-900 outline-none transition-all"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full py-4 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[52px]"
            >
              {loading ? (
                <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">login</span>
                  Sign In
                </>
              )}
            </button>
          </form>
        )}

        {/* ========================================= */}
        {/* MAGIC LINK FORM (default / production)     */}
        {/* ========================================= */}
        {(authMode === 'magic_link' || !showPasswordLogin) && (
          <form onSubmit={handleMagicLinkSubmit} className="bg-slate-900 border border-white/5 p-8 rounded-[2.5rem] shadow-2xl space-y-6">
            {/* Magic Link Badge */}
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-xl">magic_button</span>
              <div>
                <p className="text-primary text-xs font-black uppercase">Passwordless Sign-In</p>
                <p className="text-slate-400 text-[10px] font-medium">We'll send a secure link to your email</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                Email Address *
              </label>
              <input
                ref={emailRef}
                required
                type="email"
                pattern="[^\s@]+@[^\s@]+\.[^\s@]+"
                placeholder="alex@company.com"
                className="w-full bg-slate-800 border-slate-700 border rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-slate-900 outline-none transition-all"
                value={email}
                onChange={e => setEmail(e.target.value)}
                title="Enter a valid email address (e.g., name@domain.co.uk)"
              />
              <p className="text-slate-500 text-[10px] font-medium">
                New users will have a workspace created automatically.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-4 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[52px]"
            >
              {loading ? (
                <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">send</span>
                  Send Magic Link
                </>
              )}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-slate-400 font-medium">
          Technician? Use the link sent by your manager to access jobs.
        </p>

        {/* Legal Disclaimer */}
        <div className="bg-slate-900 border border-warning/20 rounded-2xl p-4">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-warning text-sm mt-0.5">info</span>
            <div className="space-y-1">
              <p className="text-warning text-[10px] font-black uppercase">Legal Notice</p>
              <p className="text-slate-400 text-[10px] leading-relaxed">
                JobProof is a technical evidence capture tool, not a legal authority.
                We do not certify admissibility or provide legal advice.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthView;
