import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithMagicLink } from '../lib/auth';

interface AuthViewProps {
  type: 'login' | 'signup';
  onAuth: () => void;
}

/**
 * V1 MVP Auth View - Magic Link Only
 *
 * NO Google OAuth (V2 feature)
 * NO passwords (Magic Link only for V1)
 * British English throughout
 */
const AuthView: React.FC<AuthViewProps> = ({ type, onAuth }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [email, setEmail] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [fullName, setFullName] = useState('');

  // Auto-focus refs
  const emailRef = useRef<HTMLInputElement>(null);

  // Auto-focus email on mount
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // For signup, we still send magic link but with workspace context
      const result = await signInWithMagicLink(email, type === 'signup' ? {
        workspaceName,
        fullName
      } : undefined);

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to send magic link');
      }

      setSuccessMessage(
        type === 'signup'
          ? `Magic link sent to ${email}! Click the link to create your workspace.`
          : `Magic link sent to ${email}! Check your inbox to sign in.`
      );
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
                    {type === 'signup' ? 'Your workspace will be ready to dispatch jobs.' : 'Access your operations hub instantly.'}
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

      <div className="w-full max-w-md space-y-8 relative z-10 animate-in">
        <div className="text-center space-y-4">
          <Link to="/home" className="inline-flex items-center gap-3 group">
            <div className="bg-primary size-12 rounded-2xl flex items-center justify-center shadow-xl shadow-primary/30 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-white text-2xl font-black">verified</span>
            </div>
            <span className="text-3xl font-black tracking-tighter text-white uppercase">JobProof</span>
          </Link>
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
              {type === 'signup' ? 'Create Workspace' : 'Sign In'}
            </h2>
            <p className="text-slate-300 text-sm font-medium">
              {type === 'signup'
                ? 'Set up your operations hub with magic link access.'
                : 'Enter your email to receive a secure sign-in link.'}
            </p>
          </div>
        </div>

        <form onSubmit={handleMagicLinkSubmit} className="bg-slate-900 border border-white/5 p-8 rounded-[2.5rem] shadow-2xl space-y-6">
          {error && (
            <div className="bg-danger/10 border border-danger/20 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-danger text-sm">error</span>
                <p className="text-danger text-xs font-bold uppercase">{error}</p>
              </div>
            </div>
          )}

          {/* Magic Link Badge */}
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-xl">magic_button</span>
            <div>
              <p className="text-primary text-xs font-black uppercase">Passwordless Sign-In</p>
              <p className="text-slate-400 text-[10px] font-medium">We'll send a secure link to your email</p>
            </div>
          </div>

          {type === 'signup' && (
            <>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Organisation Name *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Sterling Field Ops"
                  className="w-full bg-slate-800 border-slate-700 border rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-slate-900 outline-none transition-all"
                  value={workspaceName}
                  onChange={e => setWorkspaceName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Your Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Alex Sterling"
                  className="w-full bg-slate-800 border-slate-700 border rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-slate-900 outline-none transition-all"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
              {type === 'signup' ? 'Admin Email *' : 'Email Address *'}
            </label>
            <input
              ref={emailRef}
              required
              type="email"
              placeholder="alex@company.com"
              className="w-full bg-slate-800 border-slate-700 border rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-slate-900 outline-none transition-all"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email || (type === 'signup' && !workspaceName)}
            className="w-full py-4 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[52px]"
          >
            {loading ? (
              <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">send</span>
                {type === 'signup' ? 'Create Workspace' : 'Send Magic Link'}
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-slate-300 font-black uppercase tracking-widest">
          {type === 'login' ? "Need a workspace?" : "Already have an account?"}
          <Link to={type === 'login' ? '/auth/signup' : '/auth/login'} className="text-primary font-black ml-2 hover:underline">
            {type === 'login' ? 'Create One' : 'Sign In'}
          </Link>
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
