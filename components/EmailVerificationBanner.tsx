import React, { useState } from 'react';
import { getSupabase } from '../lib/supabase';

interface EmailVerificationBannerProps {
  user: any;
  onDismiss?: () => void;
}

/**
 * Email Verification Banner
 * Persistent reminder for users to verify their email
 *
 * Features:
 * - Dismissible but reappears on refresh until verified
 * - Resend verification link
 * - Clear call-to-action
 * - Mobile-optimized
 */
const EmailVerificationBanner: React.FC<EmailVerificationBannerProps> = ({ user, onDismiss }) => {
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  // Check if user is verified
  const isVerified = user?.email_confirmed_at || user?.confirmed_at;

  // Don't show if verified or dismissed
  if (isVerified || isDismissed) return null;

  const handleResendEmail = async () => {
    if (isSending) return;

    setIsSending(true);
    setMessage(null);

    try {
      const supabase = getSupabase();
      if (!supabase) {
        setMessage('Connection error. Please check your internet.');
        setIsSending(false);
        return;
      }

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email
      });

      if (error) {
        setMessage(`Failed to resend: ${error.message}`);
      } else {
        setMessage('✅ Verification email sent! Check your inbox.');
      }
    } catch (error) {
      console.error('Resend verification error:', error);
      setMessage('An error occurred. Please try again.');
    } finally {
      setIsSending(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    if (onDismiss) onDismiss();
  };

  return (
    <div className="bg-warning/10 border border-warning/20 rounded-2xl p-4 sm:p-5 animate-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Icon */}
        <div className="size-10 bg-warning/20 rounded-xl flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-warning text-xl">mail</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black uppercase text-warning tracking-tight">
              Verify Your Email
            </h3>
          </div>
          <p className="text-xs text-slate-300 font-medium leading-relaxed">
            Please check <span className="font-black text-white">{user.email}</span> and click the verification link to activate your account.
          </p>
          {message && (
            <p className={`text-[10px] font-bold ${message.startsWith('✅') ? 'text-success' : 'text-danger'}`}>
              {message}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleResendEmail}
            disabled={isSending}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-warning/20 hover:bg-warning/30 border border-warning/30 text-warning rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <span className={`material-symbols-outlined text-sm ${isSending ? 'animate-spin' : ''}`}>
              {isSending ? 'sync' : 'send'}
            </span>
            {isSending ? 'Sending...' : 'Resend Email'}
          </button>

          <button
            onClick={handleDismiss}
            className="p-2.5 text-slate-400 hover:text-white transition-colors"
            title="Dismiss (will reappear until verified)"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationBanner;
