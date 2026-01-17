import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signIn, signUp, signInWithGoogle, type SignUpData } from '../lib/auth';

interface AuthViewProps {
  type: 'login' | 'signup';
  onAuth: () => void;
}

const AuthView: React.FC<AuthViewProps> = ({ type, onAuth }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [email, setEmail] = useState(() => {
    // Auto-fill email from smart redirect
    if (type === 'signup') {
      const savedEmail = sessionStorage.getItem('signup_email');
      if (savedEmail) {
        sessionStorage.removeItem('signup_email');
        return savedEmail;
      }
    }
    return '';
  });
  const [password, setPassword] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [fullName, setFullName] = useState('');
  const [showSmartRedirectMessage, setShowSmartRedirectMessage] = useState(() => {
    return type === 'signup' && !!sessionStorage.getItem('signup_email');
  });
  const [signupSuccess, setSignupSuccess] = useState(false);

  // Auto-focus refs
  const fullNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Auto-focus email on mount if redirected from login
  useEffect(() => {
    if (type === 'signup' && email) {
      fullNameRef.current?.focus();
    }
  }, [type, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (type === 'signup') {
        // Sign up with workspace creation
        const signUpData: SignUpData = {
          email,
          password,
          workspaceName,
          fullName: fullName || undefined
        };

        const result = await signUp(signUpData);

        if (!result.success) {
          setError(result.error?.message || 'Sign up failed');
          setLoading(false);
          return;
        }

        // Success - show success screen
        setLoading(false);
        setSignupSuccess(true);
      } else {
        // Sign in
        const result = await signIn(email, password);

        if (!result.success) {
          const errorMsg = result.error?.message || 'Sign in failed';

          // Smart redirect: If email not found, redirect to signup
          if (errorMsg.includes('Invalid login credentials') || errorMsg.includes('Email not confirmed')) {
            setLoading(false);
            // Store email for signup form auto-fill
            sessionStorage.setItem('signup_email', email);
            navigate('/auth/signup');
            return;
          }

          setError(errorMsg);
          setLoading(false);
          return;
        }

        // Success - call onAuth callback and navigate
        setLoading(false);
        onAuth();
        navigate('/admin');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setLoading(false);
    }
  };

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

  // Show success screen after signup
  if (signupSuccess) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background Orbs */}
        <div className="absolute top-0 -left-20 size-96 bg-success/20 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-0 -right-20 size-96 bg-primary/20 blur-[120px] rounded-full"></div>

        <div className="w-full max-w-md space-y-8 relative z-10 animate-in text-center">
          <div className="bg-success/10 size-24 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-success/30">
            <span className="material-symbols-outlined text-success text-6xl font-black">check_circle</span>
          </div>

          <div className="space-y-4">
            <h2 className="text-4xl font-black text-white uppercase tracking-tighter">
              Workspace Created!
            </h2>
            <p className="text-slate-400 text-base font-medium max-w-sm mx-auto leading-relaxed">
              Welcome to <span className="text-primary font-black">{workspaceName}</span>! We've sent a confirmation email to <span className="text-white font-bold">{email}</span>.
            </p>
          </div>

          <div className="bg-slate-900 border border-white/5 p-8 rounded-[2.5rem] shadow-2xl space-y-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3 text-left">
                <div className="bg-primary/10 size-10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-primary text-lg font-black">1</span>
                </div>
                <div>
                  <h3 className="text-white font-black text-sm uppercase tracking-widest mb-1">Check Your Email</h3>
                  <p className="text-slate-400 text-xs font-medium leading-relaxed">
                    Click the verification link we just sent to activate your account.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-left">
                <div className="bg-primary/10 size-10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-primary text-lg font-black">2</span>
                </div>
                <div>
                  <h3 className="text-white font-black text-sm uppercase tracking-widest mb-1">Sign In</h3>
                  <p className="text-slate-400 text-xs font-medium leading-relaxed">
                    After verification, sign in to access your operations hub.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-left">
                <div className="bg-primary/10 size-10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-primary text-lg font-black">3</span>
                </div>
                <div>
                  <h3 className="text-white font-black text-sm uppercase tracking-widest mb-1">Start Dispatching</h3>
                  <p className="text-slate-400 text-xs font-medium leading-relaxed">
                    Create your first job and begin capturing verifiable evidence.
                  </p>
                </div>
              </div>
            </div>

            <Link
              to="/auth/login"
              className="w-full py-4 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              Go to Sign In
              <span className="material-symbols-outlined text-lg font-black">arrow_forward</span>
            </Link>
          </div>

          <p className="text-slate-500 text-xs font-medium">
            Didn't receive the email?{' '}
            <button className="text-primary font-black hover:underline">
              Resend verification
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 -left-20 size-96 bg-primary/20 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-0 -right-20 size-96 bg-blue-500/10 blur-[120px] rounded-full"></div>

      <div className="w-full max-w-md space-y-8 relative z-10 animate-in">
        <div className="text-center space-y-4">
          <Link to="/home" className="inline-flex items-center gap-3 group">
            <div className="bg-primary size-12 rounded-2xl flex items-center justify-center shadow-xl shadow-primary/30 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-white text-2xl font-black">verified</span>
            </div>
            <span className="text-3xl font-black tracking-tighter text-white uppercase">Trust by Design</span>
          </Link>
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
              {type === 'login' ? 'Access Control' : 'Create Workspace'}
            </h2>
            <p className="text-slate-500 text-sm font-medium">
              {type === 'login' ? 'Welcome back to the operations hub.' : 'Start capturing verifiable evidence.'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-900 border border-white/5 p-8 rounded-[2.5rem] shadow-2xl space-y-6">
          {showSmartRedirectMessage && (
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-sm">info</span>
                <p className="text-primary text-xs font-bold">Oops! You seem new around here. Let's get you signed up with your own workspace!</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-danger/10 border border-danger/20 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-danger text-sm">error</span>
                <p className="text-danger text-xs font-bold uppercase">{error}</p>
              </div>
            </div>
          )}

          {type === 'signup' && (
            <>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Organisation Name *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Sterling Field Ops"
                  className="w-full bg-slate-800 border-slate-700 rounded-xl py-3 px-4 text-white focus:ring-primary outline-none"
                  value={workspaceName}
                  onChange={e => setWorkspaceName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Your Full Name</label>
                <input
                  ref={fullNameRef}
                  type="text"
                  placeholder="e.g. Alex Sterling"
                  className="w-full bg-slate-800 border-slate-700 rounded-xl py-3 px-4 text-white focus:ring-primary outline-none"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  onKeyPress={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      emailRef.current?.focus();
                    }
                  }}
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              {type === 'signup' ? 'Admin Email *' : 'Email *'}
            </label>
            <input
              ref={emailRef}
              required
              type="email"
              placeholder="alex@company.com"
              className="w-full bg-slate-800 border-slate-700 rounded-xl py-3 px-4 text-white focus:ring-primary outline-none"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyPress={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  passwordRef.current?.focus();
                }
              }}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Password *</label>
              {type === 'login' && (
                <button type="button" className="text-[10px] font-black text-primary hover:underline uppercase">
                  Forgot?
                </button>
              )}
            </div>
            <input
              ref={passwordRef}
              required
              type="password"
              placeholder="••••••••"
              className="w-full bg-slate-800 border-slate-700 rounded-xl py-3 px-4 text-white focus:ring-primary outline-none"
              value={password}
              onChange={e => setPassword(e.target.value)}
              minLength={6}
            />
            {type === 'signup' && password.length > 0 && (
              <div className="bg-slate-800/50 rounded-lg p-3 space-y-1.5">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Password Requirements</p>
                <div className="flex items-center gap-2">
                  <span className={`material-symbols-outlined text-xs ${password.length >= 6 ? 'text-success' : 'text-slate-600'}`}>
                    {password.length >= 6 ? 'check_circle' : 'cancel'}
                  </span>
                  <p className={`text-[10px] font-medium ${password.length >= 6 ? 'text-success' : 'text-slate-500'}`}>
                    At least 6 characters
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`material-symbols-outlined text-xs ${/[A-Z]/.test(password) ? 'text-success' : 'text-slate-600'}`}>
                    {/[A-Z]/.test(password) ? 'check_circle' : 'cancel'}
                  </span>
                  <p className={`text-[10px] font-medium ${/[A-Z]/.test(password) ? 'text-success' : 'text-slate-500'}`}>
                    One uppercase letter
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`material-symbols-outlined text-xs ${/[0-9]/.test(password) ? 'text-success' : 'text-slate-600'}`}>
                    {/[0-9]/.test(password) ? 'check_circle' : 'cancel'}
                  </span>
                  <p className={`text-[10px] font-medium ${/[0-9]/.test(password) ? 'text-success' : 'text-slate-500'}`}>
                    One number
                  </p>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              type === 'login' ? 'Enter Hub' : 'Create Workspace'
            )}
          </button>

          {/* Google OAuth (Optional) */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-900 px-2 text-slate-500 font-black">Or continue with</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-3 bg-white hover:bg-slate-100 text-slate-900 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="size-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 font-black uppercase tracking-widest">
          {type === 'login' ? "New to the platform?" : "Already have an account?"}
          <Link to={type === 'login' ? '/auth/signup' : '/auth/login'} className="text-primary font-black ml-2 hover:underline">
            {type === 'login' ? 'Create Workspace' : 'Sign In'}
          </Link>
        </p>

        {/* Legal Disclaimer (Phase C.5) */}
        <div className="bg-slate-900 border border-warning/20 rounded-2xl p-4">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-warning text-sm mt-0.5">info</span>
            <div className="space-y-1">
              <p className="text-warning text-[10px] font-black uppercase">Legal Notice</p>
              <p className="text-slate-400 text-[10px] leading-relaxed">
                Trust by Design is a technical evidence capture tool, not a legal authority.
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
