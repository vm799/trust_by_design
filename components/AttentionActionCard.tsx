/**
 * AttentionActionCard - Phase UX: Frictionless Action Cards
 *
 * Provides inline actions for dashboard attention items:
 * - Generate link if not generated
 * - Send via Email/WhatsApp/Copy if generated but not opened
 * - Call/message technician
 * - One-click seal for completed jobs
 *
 * Design principle: "No thinking needed - hold hand throughout"
 */

import React, { useState, useCallback } from 'react';
import { Job, Technician, Client } from '../types';
import { generateMagicLink, getMagicLinksForJob } from '../lib/db';
import { getValidatedHandshakeUrl } from '../lib/redirects';
import { showToast } from '../lib/microInteractions';
import { sealEvidence, canSealJob } from '../lib/sealing';

type AttentionType = 'link_not_generated' | 'link_not_opened' | 'awaiting_seal' | 'no_technician' | 'missing_evidence';

interface AttentionActionCardProps {
  job: Job;
  type: AttentionType;
  technician?: Technician;
  client?: Client;
  managerEmail?: string;
  onJobUpdate?: (job: Job) => void;
  onNavigate?: (path: string) => void;
}

const AttentionActionCard: React.FC<AttentionActionCardProps> = ({
  job,
  type,
  technician,
  client,
  managerEmail,
  onJobUpdate,
  onNavigate,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [, setShowActions] = useState(false);

  // Get link info for this job
  const links = getMagicLinksForJob(job.id);
  const activeLink = links.find(l => l.status === 'active');
  const linkUrl = activeLink && managerEmail
    ? getValidatedHandshakeUrl(job.id, managerEmail)
    : null;

  // Generate magic link
  const handleGenerateLink = useCallback(async () => {
    if (!managerEmail) {
      showToast('Cannot generate link: Manager email not available', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const result = await generateMagicLink(job.id, managerEmail);
      if (result.data) {
        showToast('Link generated! Choose how to send it below.', 'success');
        setShowActions(true);
        if (onJobUpdate) {
          onJobUpdate({
            ...job,
            magicLinkToken: result.data.token,
            magicLinkUrl: result.data.url,
          });
        }
      } else {
        showToast(result.error || 'Failed to generate link', 'error');
      }
    } catch (e) {
      showToast('Failed to generate link', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [job, managerEmail, onJobUpdate]);

  // Copy link to clipboard
  const handleCopyLink = useCallback(async () => {
    if (!linkUrl) {
      await handleGenerateLink();
      return;
    }

    await navigator.clipboard.writeText(linkUrl);
    showToast('Link copied! Send to technician via your preferred method.', 'success');
  }, [linkUrl, handleGenerateLink]);

  // Send via WhatsApp
  const handleWhatsApp = useCallback(() => {
    if (!technician?.phone) {
      showToast('No phone number for technician', 'error');
      return;
    }

    const phone = technician.phone.replace(/[^0-9]/g, '');
    const message = encodeURIComponent(
      `Hi ${technician.name}, here's your job link for "${job.title}":\n\n${linkUrl || 'Link will be generated'}\n\nPlease open it to start the job.`
    );
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
    showToast('Opening WhatsApp...', 'success');
  }, [technician, job.title, linkUrl]);

  // Send via Email
  const handleEmail = useCallback(() => {
    if (!technician?.email) {
      showToast('No email for technician', 'error');
      return;
    }

    const subject = encodeURIComponent(`Job Assignment: ${job.title}`);
    const body = encodeURIComponent(
      `Hi ${technician.name},\n\nYou have been assigned a new job:\n\n` +
      `Job: ${job.title}\n` +
      `Client: ${job.client}\n` +
      `Address: ${job.address}\n\n` +
      `Click the link below to access the job:\n${linkUrl || 'Link will be sent separately'}\n\n` +
      `Please complete the evidence capture at your earliest convenience.`
    );
    window.open(`mailto:${technician.email}?subject=${subject}&body=${body}`, '_blank');
    showToast('Opening email client...', 'success');
  }, [technician, job, linkUrl]);

  // Call technician
  const handleCall = useCallback(() => {
    if (!technician?.phone) {
      showToast('No phone number for technician', 'error');
      return;
    }
    window.location.href = `tel:${technician.phone}`;
  }, [technician]);

  // One-click seal
  const handleSeal = useCallback(async () => {
    const canSeal = canSealJob(job);
    if (!canSeal.canSeal) {
      showToast(canSeal.reasons.join(', ') || 'Cannot seal job yet', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const result = await sealEvidence(job.id);
      if (result.success) {
        showToast('Job sealed successfully!', 'success');
        if (onJobUpdate) {
          onJobUpdate({
            ...job,
            sealedAt: new Date().toISOString(),
            status: 'Submitted',
          });
        }
      } else {
        showToast(result.error || 'Failed to seal job', 'error');
      }
    } catch (e) {
      showToast('Failed to seal job', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [job, onJobUpdate]);

  // Get card styling based on type
  const getCardStyle = () => {
    switch (type) {
      case 'link_not_generated':
        return {
          bg: 'bg-danger/10',
          border: 'border-danger/30',
          icon: 'link_off',
          iconColor: 'text-danger',
          title: 'Link Not Generated',
          subtitle: 'Generate and send to technician',
        };
      case 'link_not_opened':
        return {
          bg: 'bg-warning/10',
          border: 'border-warning/30',
          icon: 'visibility_off',
          iconColor: 'text-warning',
          title: 'Link Not Opened',
          subtitle: 'Remind technician to start job',
        };
      case 'awaiting_seal':
        return {
          bg: 'bg-success/10',
          border: 'border-success/30',
          icon: 'task_alt',
          iconColor: 'text-success',
          title: 'Ready to Seal',
          subtitle: 'Evidence complete - seal now',
        };
      case 'no_technician':
        return {
          bg: 'bg-primary/10',
          border: 'border-primary/30',
          icon: 'person_add',
          iconColor: 'text-primary',
          title: 'No Technician Assigned',
          subtitle: 'Assign a technician to continue',
        };
      case 'missing_evidence':
        return {
          bg: 'bg-slate-800',
          border: 'border-white/10',
          icon: 'photo_library',
          iconColor: 'text-slate-400',
          title: 'No Evidence Yet',
          subtitle: 'Waiting for technician',
        };
      default:
        return {
          bg: 'bg-slate-800',
          border: 'border-white/10',
          icon: 'info',
          iconColor: 'text-slate-400',
          title: 'Attention Required',
          subtitle: 'Action needed',
        };
    }
  };

  const style = getCardStyle();

  return (
    <div className={`${style.bg} border ${style.border} rounded-2xl p-4 transition-all`}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`size-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0`}>
          <span className={`material-symbols-outlined text-xl ${style.iconColor}`}>{style.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-black text-white text-sm uppercase tracking-tight truncate">
            {job.title}
          </h4>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {style.title} - {style.subtitle}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">
            Tech: <span className="text-slate-300">{technician?.name || job.technician || 'Unassigned'}</span>
            {client && <span> | Client: {client.name}</span>}
          </p>
        </div>
      </div>

      {/* Quick Actions - Always Visible */}
      <div className="flex flex-wrap gap-2">
        {/* Link Not Generated */}
        {type === 'link_not_generated' && (
          <button
            onClick={handleGenerateLink}
            disabled={isLoading}
            className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/80 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">link</span>
            {isLoading ? 'Generating...' : 'Generate Link'}
          </button>
        )}

        {/* Link Not Opened - Show reminder options */}
        {type === 'link_not_opened' && (
          <>
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
            >
              <span className="material-symbols-outlined text-xs">content_copy</span>
              Copy
            </button>

            {technician?.phone && (
              <>
                <button
                  onClick={handleWhatsApp}
                  className="flex items-center gap-1.5 px-3 py-2 bg-success/20 hover:bg-success/30 text-success border border-success/30 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  <span className="material-symbols-outlined text-xs">chat</span>
                  WhatsApp
                </button>
                <button
                  onClick={handleCall}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  <span className="material-symbols-outlined text-xs">call</span>
                  Call
                </button>
              </>
            )}

            {technician?.email && (
              <button
                onClick={handleEmail}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                <span className="material-symbols-outlined text-xs">mail</span>
                Email
              </button>
            )}
          </>
        )}

        {/* Ready to Seal - One-click seal */}
        {type === 'awaiting_seal' && (
          <>
            <button
              onClick={handleSeal}
              disabled={isLoading}
              className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2.5 bg-success hover:bg-success/80 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">verified</span>
              {isLoading ? 'Sealing...' : 'Seal Now'}
            </button>
            <button
              onClick={() => onNavigate?.(`/admin/report/${job.id}`)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
            >
              <span className="material-symbols-outlined text-xs">visibility</span>
              Review
            </button>
          </>
        )}

        {/* No Technician - Assign button */}
        {type === 'no_technician' && (
          <button
            onClick={() => onNavigate?.(`/admin/jobs/${job.id}`)}
            className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/80 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
          >
            <span className="material-symbols-outlined text-sm">person_add</span>
            Assign Tech
          </button>
        )}

        {/* Missing Evidence - Remind technician */}
        {type === 'missing_evidence' && technician && (
          <>
            {technician.phone && (
              <button
                onClick={handleCall}
                className="flex items-center gap-1.5 px-3 py-2 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                <span className="material-symbols-outlined text-xs">call</span>
                Call Tech
              </button>
            )}
            <button
              onClick={() => onNavigate?.(`/admin/report/${job.id}`)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
            >
              <span className="material-symbols-outlined text-xs">visibility</span>
              View
            </button>
          </>
        )}
      </div>

      {/* Sealing Explanation - Only show for awaiting_seal */}
      {type === 'awaiting_seal' && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <p className="text-[9px] text-slate-400">
            <span className="text-success font-bold">Why seal?</span> Sealing creates a tamper-proof cryptographic record.
            Once sealed, evidence cannot be modified, giving your clients confidence in the proof of work.
          </p>
        </div>
      )}
    </div>
  );
};

export default AttentionActionCard;
