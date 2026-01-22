import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signIn, signInWithGoogle, signUp } from '../lib/auth';
import { getSupabase } from '../lib/supabase';
import { validatePassword } from '../lib/validation';
import { JobProofLogo } from '../components/branding/jobproof-logo';
import { useAuth } from '../lib/AuthContext';

/**
 * Email-First Authentication Flow
 *
 * UX optimised for contractors who need to get into workspace ASAP:
 * 1. Enter email → Auto-detect new vs existing user
 * 2. Branch to password (existing) or signup (new)
 * 3. Minimal friction, clear guidance
 *
 * CRITICAL FIX (Jan 2026): Fixed auth loop by:
 * - Using AuthContext instead of direct getSession() call
 * - Adding loading guard before redirecting
 * - Using hasRedirected ref to prevent duplicate redirects
 */

type AuthStep = 'email' | 'password' | 'signup';
type UserStatus = 'existing' | 'new' | 'checking';

const EmailFirstAuth: React.FC = () => {
  const navigate = useNavigate();

  // CRITICAL FIX: Use AuthContext instead of calling getSession() directly
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Current step in the flow
  const [step, setStep] = useState<AuthStep>('email');
  const [userStatus, setUserStatus] = useState<UserStatus>('checking');

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [fullName, setFullName] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // CRITICAL FIX: Track if we've already redirected to prevent duplicate redirects
  const hasRedirectedRef = useRef(false);

  // Auto-redirect if session is detected (e.g. after Google OAuth return)
  // CRITICAL FIX: Use AuthContext state instead of direct getSession() call
  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return;

    // Already redirected - skip
    if (hasRedirectedRef.current) return;

    // Authenticated - redirect to admin
    if (isAuthenticated) {
      hasRedirectedRef.current = true;
      navigate('/admin');
    }
  }, [authLoading, isAuthenticated, navigate]);

  /**
   * Step 1: Check if email exists in system
   * Returns: 'existing' if user found, 'new' if not
   */
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabase();
      if (!supabase) {
        setError('Connection error. Please check your internet and try again.');
        setLoading(false);
        return;
      }

      // 1. Try RPC check (Secure & Reliable)
      const { data: rpcExists, error: rpcError } = await supabase.rpc('check_user_exists', {
        p_email: email.toLowerCase().trim()
      });

      if (!rpcError && typeof rpcExists === 'boolean') {
        if (rpcExists) {
          setUserStatus('existing');
          setStep('password');
        } else {
          setUserStatus('new');
          setStep('signup');
          // Pre-fill workspace name suggestion
          const domain = email.split('@')[1];
          const suggestedName = domain ? domain.split('.')[0] : 'My Company';
          setWorkspaceName(suggestedName.charAt(0).toUpperCase() + suggestedName.slice(1));
        }
        setLoading(false);
        return;
      }

      // 2. Fallback: Check 'users' table (May be blocked by RLS, returns [] if blocked)
      // This is less reliable but kept as backup
      const { data: users, error: checkError } = await supabase
        .from('users')
        .select('email, workspace_id')
        .eq('email', email.toLowerCase().trim())
        .limit(1);

      if (checkError) {
        console.error('Email check error:', checkError);
        setError(`Unable to check email (${checkError.code || '400'}). Please try again.`);
        setLoading(false);
        return;
      }

      if (users && users.length > 0) {
        // Existing user - show password field
        setUserStatus('existing');
        setStep('password');
      } else {
        // New user - show signup form
        setUserStatus('new');
        setStep('signup');
        // Pre-fill workspace name suggestion
        const domain = email.split('@')[1];
        const suggestedName = domain ? domain.split('.')[0] : 'My Company';
        setWorkspaceName(suggestedName.charAt(0).toUpperCase() + suggestedName.slice(1));
      }
    } catch (err) {
      console.error('Email check failed:', err);
      setError('Something went wrong. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Step 2a: Sign in existing user with password
   */
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await signIn(email, password);

      if (!result.success) {
        const errorMsg = result.error?.message || 'Sign in failed';

        // Handle specific error cases
        if (errorMsg.includes('Invalid login credentials')) {
          setError('Incorrect password. Please try again or use "Forgot password".');
        } else if (errorMsg.includes('Email not confirmed')) {
          setError('Please verify your email address first. Check your inbox for the confirmation link.');
        } else {
          setError(`Sign in failed: ${errorMsg}`);
        }

        setLoading(false);
        return;
      }

      // Success - navigate to admin
      setLoading(false);
      navigate('/admin');
    } catch (err) {
      console.error('Sign in error:', err);
      setError('Authentication failed. Please try again.');
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // 1. Validate Password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.error || 'Invalid password');
      setLoading(false);
      return;
    }

    try {
      const result = await signUp({
        email,
        password,
        workspaceName,
        fullName: fullName || undefined
      });

      if (!result.success) {
        // Handle "User already registered" error
        const errorMsg = result.error?.message || 'Signup failed';
        if (errorMsg.includes('User already registered') || errorMsg.includes('already exists')) {
          setError('An account with this email already exists. Please try signing in instead.');
          setUserStatus('existing');
          setStep('password');
        } else {
          setError(errorMsg);
        }
        setLoading(false);
        return;
      }

      // Success - show verification message
      setLoading(false);
      navigate('/auth/signup-success', {
        state: { email, workspaceName }
      });
    } catch (err) {
      console.error('Signup error:', err);
      setError('Workspace creation failed. Please try again.');
      setLoading(false);
    }
  };

  /**
   * Google OAuth sign-in
   */
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await signInWithGoogle();

      if (!result.success) {
        setError(result.error?.message || 'Google sign in failed');
        setLoading(false);
        return;
      }

      // OAuth redirect will happen automatically
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign in failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 py-6 md:px-6 md:py-8 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 -left-20 size-96 bg-primary/20 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-0 -right-20 size-96 bg-blue-500/10 blur-[120px] rounded-full"></div>

      <div className="w-full max-w-md space-y-8 relative z-10 animate-in">
        {/* Header */}
        <div className="text-center space-y-4">
          <Link to="/home" className="inline-block group">
            <JobProofLogo variant="full" size="lg" showTagline className="transition-transform group-hover:scale-105" />
          </Link>
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
              {step === 'email' && 'Access Your Workspace'}
              {step === 'password' && 'Welcome Back'}
              {step === 'signup' && 'Create Your Workspace'}
            </h2>
            <p className="text-slate-300 text-sm font-medium">
              {step === 'email' && "We'll find your workspace or help you create one."}
              {step === 'password' && 'Sign in to continue your work.'}
              {step === 'signup' && "Let's get you set up so you can start ASAP."}
            </p>
          </div>
        </div>

        {/* Main Form */}
        <div className="bg-slate-900 border border-white/5 p-6 md:p-8 rounded-[2.5rem] shadow-2xl space-y-6">
          {/* Error Display */}
          {error && (
            <div role="alert" aria-live="assertive" className="bg-danger/10 border border-danger/20 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-danger text-sm mt-0.5" aria-hidden="true">error</span>
                <div className="flex-1">
                  <p className="text-danger text-xs font-bold uppercase mb-1">Error</p>
                  <p id="auth-error" className="text-danger text-xs font-medium leading-relaxed">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 1: Email Entry */}
          {step === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  Your Email *
                </label>
                <input
                  required
                  type="email"
                  placeholder="contractor@company.com"
                  className="w-full bg-slate-800 border-slate-700 rounded-xl py-3 px-4 text-white focus:ring-primary outline-none"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !loading) {
                      e.preventDefault();
                      handleEmailSubmit(e as any);
                    }
                  }}
                  autoFocus
                  aria-invalid={!!error}
                  aria-describedby={error ? "auth-error" : undefined}
                  id="email-input"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center disabled:opacity-50"
              >
                {loading ? (
                  <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  'Continue'
                )}
              </button>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-slate-900 px-2 text-slate-300 font-black">Or</span>
                </div>
              </div>

              {/* Google Sign-In */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-3 bg-white hover:bg-slate-100 text-slate-900 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <svg className="size-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </button>
            </form>
          )}

          {/* STEP 2a: Password for Existing User */}
          {step === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-sm">check_circle</span>
                  <p className="text-primary text-xs font-bold">Account found: {email}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                    Password *
                  </label>
                  <button type="button" className="text-[10px] font-black text-primary hover:underline uppercase">
                    Forgot?
                  </button>
                </div>
                <input
                  required
                  type="password"
                  placeholder="••••••••"
                  className="w-full bg-slate-800 border-slate-700 rounded-xl py-3 px-4 text-white focus:ring-primary outline-none"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !loading) {
                      e.preventDefault();
                      handlePasswordSubmit(e as any);
                    }
                  }}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center disabled:opacity-50"
              >
                {loading ? (
                  <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  'Sign In'
                )}
              </button>

              <button
                type="button"
                onClick={() => { setStep('email'); setPassword(''); }}
                className="w-full text-slate-300 text-xs font-bold hover:text-white transition-colors"
              >
                ← Use a different email
              </button>
            </form>
          )}

          {/* STEP 2b: Signup for New User */}
          {step === 'signup' && (
            <form onSubmit={handleSignupSubmit} className="space-y-6">
              <div className="bg-warning/10 border border-warning/20 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-warning text-sm mt-0.5">info</span>
                  <div>
                    <p className="text-warning text-xs font-bold mb-1">New Here?</p>
                    <p className="text-slate-400 text-xs leading-relaxed">
                      We don't have an account for <span className="text-white font-bold">{email}</span>. Let's create your workspace!
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  Company/Workspace Name *
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Sterling Field Ops"
                  className="w-full bg-slate-800 border-slate-700 rounded-xl py-3 px-4 text-white focus:ring-primary outline-none"
                  value={workspaceName}
                  onChange={e => setWorkspaceName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  Your Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alex Sterling"
                  className="w-full bg-slate-800 border-slate-700 rounded-xl py-3 px-4 text-white focus:ring-primary outline-none"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  Create Password *
                </label>
                <input
                  required
                  type="password"
                  placeholder="••••••••"
                  className={`w-full bg-slate-800 border-slate-700 rounded-xl py-3 px-4 text-white focus:ring-primary outline-none ${password && !validatePassword(password).isValid ? 'border-warning/50' : 'border-slate-700'}`}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !loading && validatePassword(password).isValid) {
                      e.preventDefault();
                      handleSignupSubmit(e as any);
                    }
                  }}
                />
                <div className="space-y-3 mt-2">
                  <div className="flex flex-wrap gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter transition-all ${password.length >= 15 ? 'bg-success/20 text-success' : 'bg-slate-800 text-slate-300'}`}>
                      15+ Characters
                    </span>
                    <span className="text-[10px] font-black text-slate-400 self-center">OR</span>
                    <div className="flex gap-1.5 pt-0.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter transition-all ${password.length >= 8 ? 'bg-success/20 text-success' : 'bg-slate-800 text-slate-300'}`}>
                        8+ Chars
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter transition-all ${/[A-Z]/.test(password) ? 'bg-success/20 text-success' : 'bg-slate-800 text-slate-300'}`}>
                        CAPS
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter transition-all ${/[!@#$%^&*(),.?":{}|<>]/.test(password) ? 'bg-success/20 text-success' : 'bg-slate-800 text-slate-300'}`}>
                        Symbol
                      </span>
                    </div>
                  </div>
                  {password && !validatePassword(password).isValid && (
                    <p className="text-[10px] text-warning font-bold uppercase tracking-tight flex items-center gap-1 animate-in">
                      <span className="material-symbols-outlined text-sm">info</span>
                      Requirements not met yet
                    </p>
                  )}
                  {password && validatePassword(password).isValid && (
                    <p className="text-[10px] text-success font-bold uppercase tracking-tight flex items-center gap-1 animate-in">
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      Security Requirements Verified
                    </p>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center disabled:opacity-50"
              >
                {loading ? (
                  <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  'Create Workspace'
                )}
              </button>

              <button
                type="button"
                onClick={() => { setStep('email'); setPassword(''); setWorkspaceName(''); setFullName(''); }}
                className="w-full text-slate-300 text-xs font-bold hover:text-white transition-colors"
              >
                ← Use a different email
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailFirstAuth;
