/**
 * PostJobCreationModal - Unified post-creation success modal
 *
 * Shown after job creation across all pathways.
 * Adapts based on whether a technician was assigned:
 * - With tech: Magic link + share/copy/email options + QR code
 * - Without tech: "View Job" CTA + option to return to dashboard
 *
 * Combines best features from:
 * - Wizard's share modal (native share, email, copy)
 * - CreateJob's QR code display
 * - Consistent animation and feedback
 */

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { markLinkAsSent } from '../../lib/db';
import { hapticFeedback, showToast, celebrateSuccess } from '../../lib/microInteractions';
import { navigateToNextStep } from '../../lib/onboarding';
import { route, ROUTES } from '../../lib/routes';

interface PostJobCreationModalProps {
  jobId: string;
  jobTitle: string;
  technicianName?: string;
  technicianEmail?: string;
  clientName?: string;
  address?: string;
  magicLinkUrl?: string;
  magicLinkToken?: string;
  userPersona?: string;
  onClose: () => void;
}

const PostJobCreationModal: React.FC<PostJobCreationModalProps> = ({
  jobId,
  jobTitle,
  technicianName,
  technicianEmail,
  clientName,
  address,
  magicLinkUrl,
  magicLinkToken,
  userPersona,
  onClose,
}) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const hasTech = !!technicianName && !!magicLinkUrl;

  const handleCopy = useCallback(() => {
    if (!magicLinkUrl) return;
    navigator.clipboard.writeText(magicLinkUrl);
    if (magicLinkToken) markLinkAsSent(magicLinkToken, 'copy');
    setCopied(true);
    hapticFeedback('success');
    showToast('Magic link copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  }, [magicLinkUrl, magicLinkToken]);

  const handleShare = useCallback(async () => {
    if (!magicLinkUrl) return;
    const shareData = {
      title: `Job Assignment: ${jobTitle}`,
      text: 'You have been assigned a new job. Click to start:',
      url: magicLinkUrl,
    };
    try {
      await navigator.share(shareData);
      if (magicLinkToken) markLinkAsSent(magicLinkToken, 'share');
      showToast('Link shared successfully!', 'success');
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        handleCopy();
      }
    }
  }, [magicLinkUrl, magicLinkToken, jobTitle, handleCopy]);

  const handleViewJob = () => {
    onClose();
    navigate(route(ROUTES.JOB_DETAIL, { id: jobId }));
  };

  const handleReturnToDashboard = () => {
    onClose();
    navigateToNextStep('CREATE_JOB', userPersona, navigate);
  };

  const emailBody = `You have been assigned a new job.\n\nJob: ${jobTitle}${clientName ? `\nClient: ${clientName}` : ''}${address ? `\nAddress: ${address}` : ''}\n\nClick the link below to start:\n${magicLinkUrl || ''}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md animate-in fade-in">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/15 p-8 rounded-[2.5rem] max-w-lg w-full shadow-2xl space-y-6">
        {/* Success header */}
        <div className="text-center space-y-3">
          <div className="bg-success/20 size-16 rounded-2xl flex items-center justify-center mx-auto animate-success-pop">
            <span className="material-symbols-outlined text-success text-4xl">check_circle</span>
          </div>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Job Created</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            {hasTech
              ? <>Magic link ready for <span className="text-slate-900 dark:text-white font-bold">{technicianName}</span></>
              : <>Job created successfully. Assign a technician from the job detail page.</>
            }
          </p>
        </div>

        {/* Magic link section - only when tech assigned */}
        {hasTech && (
          <>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-white/15">
              <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Magic Link</p>
              <p className="text-xs font-mono text-slate-900 dark:text-white break-all bg-slate-100 dark:bg-slate-950 p-3 rounded-lg">
                {magicLinkUrl}
              </p>
            </div>

            <div className="space-y-3">
              {/* Primary: Native share or copy */}
              {typeof navigator !== 'undefined' && 'share' in navigator ? (
                <button
                  onClick={handleShare}
                  className="w-full py-4 bg-primary text-white font-black rounded-xl uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:bg-primary-hover active:scale-[0.98] press-spring flex items-center justify-center gap-2 min-h-[56px]"
                >
                  <span className="material-symbols-outlined">share</span>
                  Share Link
                </button>
              ) : (
                <button
                  onClick={handleCopy}
                  className="w-full py-4 bg-primary text-white font-black rounded-xl uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:bg-primary-hover active:scale-[0.98] press-spring flex items-center justify-center gap-2 min-h-[56px]"
                >
                  <span className="material-symbols-outlined">{copied ? 'check' : 'content_copy'}</span>
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              )}

              {/* Secondary: Email + Copy */}
              <div className="grid grid-cols-2 gap-3">
                <a
                  href={`mailto:${technicianEmail || ''}?subject=${encodeURIComponent(`Job Assignment: ${jobTitle}`)}&body=${encodeURIComponent(emailBody)}`}
                  onClick={() => {
                    if (magicLinkToken) markLinkAsSent(magicLinkToken, 'email');
                  }}
                  className="py-3 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-900 dark:text-white font-bold rounded-xl uppercase tracking-wide transition-all border border-slate-200 dark:border-white/10 flex items-center justify-center gap-2 text-xs press-spring min-h-[44px]"
                >
                  <span className="material-symbols-outlined text-sm">email</span>
                  Email
                </a>
                <button
                  onClick={handleCopy}
                  className="py-3 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-900 dark:text-white font-bold rounded-xl uppercase tracking-wide transition-all border border-slate-200 dark:border-white/10 flex items-center justify-center gap-2 text-xs press-spring min-h-[44px]"
                >
                  <span className="material-symbols-outlined text-sm">content_copy</span>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleViewJob}
            className={`w-full py-4 font-black rounded-xl uppercase tracking-widest shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] press-spring flex items-center justify-center gap-2 min-h-[56px] ${
              !hasTech ? 'bg-primary text-white shadow-primary/20' : 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10'
            }`}
          >
            <span className="material-symbols-outlined">visibility</span>
            View Job
          </button>

          <button
            onClick={handleReturnToDashboard}
            className="w-full py-3 text-slate-500 dark:text-slate-400 font-bold text-sm uppercase tracking-widest hover:text-slate-900 dark:hover:text-white transition-all min-h-[44px]"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostJobCreationModal;
