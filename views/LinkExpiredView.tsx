import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fadeInUp, hoverLiftQuick } from '../lib/animations';
import { getNavigationIntent, clearNavigationIntent } from '../lib/navigationIntent';

/**
 * LinkExpiredView - UX Flow Contract Compliant
 *
 * This component is shown when a magic link has expired or been used.
 * Per the UX Flow Contract, this is the ONLY screen shown for expired links.
 *
 * Features:
 * - Shows job context if user was trying to access a specific job
 * - One-click resend functionality
 * - Pre-fills email if available
 * - NO landing page detour
 * - NO dashboard redirection
 */

interface LinkExpiredViewProps {
  /** Optional email to pre-fill the resend form */
  email?: string;
  /** Optional job ID to show context */
  jobId?: string;
  /** Callback when resend is requested */
  onResend?: (email: string) => Promise<void>;
}

const LinkExpiredView: React.FC<LinkExpiredViewProps> = ({
  email: propEmail,
  jobId: propJobId,
  onResend,
}) => {
  const navigate = useNavigate();
  const [emailInput, setEmailInput] = useState(propEmail || '');
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get intent context
  const storedIntent = getNavigationIntent();
  const jobId = propJobId || storedIntent?.jobId;

  const handleResend = async () => {
    if (!emailInput.trim() || !emailInput.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setIsResending(true);
    setError(null);

    try {
      if (onResend) {
        await onResend(emailInput);
      } else {
        // Default behavior: navigate to auth with email pre-filled
        navigate(`/auth?email=${encodeURIComponent(emailInput)}`);
        return;
      }
      setResendSuccess(true);
    } catch (err) {
      setError('Failed to send link. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleGoToAuth = () => {
    // Don't clear intent - preserve it for the next auth attempt
    navigate('/auth');
  };

  const handleGoHome = () => {
    clearNavigationIntent();
    navigate('/home');
  };

  if (resendSuccess) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          className="w-full max-w-md space-y-6 text-center"
        >
          <div className="bg-success/10 size-20 rounded-full flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-success text-4xl">mark_email_read</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-white uppercase tracking-tight">
              Link Sent
            </h1>
            <p className="text-slate-400 text-sm">
              Check your inbox for a new sign-in link.
            </p>
            {jobId && (
              <p className="text-slate-500 text-xs mt-2">
                You will be taken to Job #{jobId} after signing in.
              </p>
            )}
          </div>
          <button
            onClick={handleGoHome}
            className="w-full min-h-[44px] py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm uppercase tracking-widest transition-all"
          >
            Back to Home
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeInUp}
        className="w-full max-w-md space-y-6 text-center"
      >
        <div className="bg-warning/10 size-20 rounded-full flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-warning text-4xl">schedule</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-white uppercase tracking-tight">
            Link Expired
          </h1>
          <p className="text-slate-400 text-sm">
            Your sign-in link has expired or was already used.
          </p>
          {jobId && (
            <p className="text-primary text-sm font-medium mt-2">
              To continue to Job #{jobId}, request a new link below.
            </p>
          )}
        </div>

        <div className="space-y-4">
          {/* Email input */}
          <div className="space-y-2">
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Enter your email"
              className="w-full min-h-[56px] px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              aria-label="Email address"
            />
            {error && (
              <p className="text-danger text-xs text-left">{error}</p>
            )}
          </div>

          {/* Primary action: Resend link */}
          <motion.button
            onClick={handleResend}
            disabled={isResending || !emailInput.trim()}
            whileHover={hoverLiftQuick}
            whileTap={{ scale: 0.98 }}
            className="w-full min-h-[56px] py-4 bg-primary hover:bg-primary-hover disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2"
          >
            {isResending ? (
              <>
                <span className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Sending...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-xl">send</span>
                {jobId ? `Resend Link for Job #${jobId}` : 'Resend Link'}
              </>
            )}
          </motion.button>

          {/* Secondary actions */}
          <div className="flex gap-3">
            <button
              onClick={handleGoToAuth}
              className="flex-1 min-h-[44px] py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all"
            >
              Sign In
            </button>
            <button
              onClick={handleGoHome}
              className="flex-1 min-h-[44px] py-3 bg-slate-800/50 hover:bg-slate-700 text-slate-400 rounded-xl font-bold text-xs uppercase tracking-widest transition-all"
            >
              Home
            </button>
          </div>
        </div>

        {/* Help text */}
        <p className="text-slate-500 text-xs">
          Links expire after 1 hour for security. Each link can only be used once.
        </p>
      </motion.div>
    </div>
  );
};

export default LinkExpiredView;
