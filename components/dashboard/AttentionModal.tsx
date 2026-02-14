/**
 * AttentionModal - Detailed view for dashboard attention items
 *
 * Shows expanded information when user wants more context:
 * - Why this item needs attention
 * - Evidence status (photos, signature, seal)
 * - Consequences if not addressed
 * - Primary action + dismiss option
 *
 * @see /docs/DASHBOARD_IMPLEMENTATION_SPEC.md
 */

import React, { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FocusEntity } from '../../lib/dashboardState';
import { Job, Technician } from '../../types';
import { showToast } from '../../lib/microInteractions';
import { fadeOverlay, fadeInScaleUp, transitionSpringSnappy } from '../../lib/animations';

interface AttentionModalProps {
  /** Focus entity to display */
  entity: FocusEntity;

  /** Optional job data for evidence status */
  job?: Job | null;

  /** Optional technician data for messaging actions */
  technician?: Technician | null;

  /** Whether modal is open */
  isOpen: boolean;

  /** Handler for primary action */
  onAction: () => void;

  /** Handler for dismiss/close */
  onDismiss: () => void;
}

/**
 * Severity-based styling
 */
const SEVERITY_STYLES = {
  info: {
    bg: 'bg-primary/10',
    border: 'border-primary/30',
    icon: 'text-primary',
    iconBg: 'bg-primary/20',
    gradient: 'from-primary/20 to-primary/5',
  },
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    icon: 'text-amber-500',
    iconBg: 'bg-amber-500/20',
    gradient: 'from-amber-500/20 to-amber-500/5',
  },
  critical: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    icon: 'text-red-500',
    iconBg: 'bg-red-500/20',
    gradient: 'from-red-500/20 to-red-500/5',
  },
};

/**
 * Get detailed reason based on entity type and context
 */
function getDetailedReason(entity: FocusEntity): string {
  // Technician-related reasons
  if (entity.type === 'technician') {
    if (entity.reason.toLowerCase().includes('no progress')) {
      return 'This technician has an active job but no photos or updates in over 2 hours. They may need assistance, have connectivity issues, or encountered an unexpected problem on site.';
    }
    if (entity.reason.toLowerCase().includes('sync failed')) {
      return 'Evidence data failed to upload to the server. Photos may be stored locally on the device but are not backed up. There is a risk of data loss if the device is lost or damaged.';
    }
    if (entity.reason.toLowerCase().includes('idle')) {
      return 'This technician has no active jobs assigned. Consider assigning new work or checking if they need support.';
    }
  }

  // Job-related reasons
  if (entity.type === 'job') {
    if (entity.reason.toLowerCase().includes('urgent')) {
      return 'This job is marked as urgent priority and requires immediate attention. It may have a tight deadline or be for a high-priority client.';
    }
    if (entity.reason.toLowerCase().includes('in progress')) {
      return 'Work is actively being performed on this job. The technician is on-site and capturing evidence.';
    }
    if (entity.reason.toLowerCase().includes('pending')) {
      return 'This job is waiting to be started. The technician should begin work soon or the job may need to be reassigned.';
    }
    if (entity.reason.toLowerCase().includes('awaiting seal')) {
      return 'Evidence has been captured and is ready to be cryptographically sealed. Sealing locks the evidence for legal admissibility.';
    }
  }

  // Attention items
  if (entity.type === 'attention') {
    if (entity.reason.toLowerCase().includes('link not opened')) {
      return 'The technician has not opened the magic link sent to them. They may not have received the notification or may need a reminder.';
    }
    if (entity.reason.toLowerCase().includes('link not generated')) {
      return 'No magic link has been created for this job yet. Generate a link to allow the technician to access and complete the job.';
    }
  }

  // Default reason
  return entity.reason;
}

/**
 * Get consequence text based on severity
 */
function getConsequence(entity: FocusEntity): string {
  if (entity.severity === 'critical') {
    return 'Immediate action required. Delayed response may result in missed SLA, client escalation, or permanent data loss.';
  }
  if (entity.severity === 'warning') {
    return 'This item needs attention soon. If not addressed, it may escalate to critical status and affect job completion.';
  }
  return 'This item is progressing normally but may benefit from a check-in to ensure everything stays on track.';
}

const AttentionModal: React.FC<AttentionModalProps> = ({
  entity,
  job,
  technician,
  isOpen,
  onAction,
  onDismiss,
}) => {
  const styles = SEVERITY_STYLES[entity.severity];

  // Check if signature request is applicable
  const canRequestSignature = job &&
    !job.signature &&
    (job.status === 'In Progress' || job.status === 'Complete') &&
    technician &&
    (technician.phone || technician.email);

  // Build job link for technician access
  const jobLink = job ? `${window.location.origin}/#/tech/job/${job.id}` : '';

  // Request signature via WhatsApp (preferred) or Email
  const handleRequestSignature = useCallback(() => {
    if (!technician || !job) {
      showToast('Cannot request signature: Missing technician or job data', 'error');
      return;
    }

    const message = `Hi ${technician.name}, please capture the customer signature for job "${job.title}".\n\nJob link: ${jobLink}\n\nThank you!`;

    // Prefer WhatsApp if phone is available
    if (technician.phone) {
      const phone = technician.phone.replace(/[^0-9]/g, '');
      const encodedMessage = encodeURIComponent(message);
      window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
      showToast('Opening WhatsApp to request signature...', 'success');
      return;
    }

    // Fallback to email
    if (technician.email) {
      const subject = encodeURIComponent(`Signature Required: ${job.title}`);
      const body = encodeURIComponent(message);
      window.open(`mailto:${technician.email}?subject=${subject}&body=${body}`, '_blank');
      showToast('Opening email to request signature...', 'success');
      return;
    }

    showToast('No contact method available for technician', 'error');
  }, [technician, job, jobLink]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={fadeOverlay.hidden}
          animate={fadeOverlay.visible}
          exit={fadeOverlay.exit}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm"
          onClick={onDismiss}
        >
          <motion.div
            initial={fadeInScaleUp.initial}
            animate={fadeInScaleUp.animate}
            exit={fadeInScaleUp.exit}
            transition={transitionSpringSnappy}
            className={`bg-gradient-to-b ${styles.gradient} bg-slate-900 rounded-3xl p-6 max-w-md w-full border ${styles.border} shadow-2xl`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start gap-4 mb-6">
              <div className={`size-14 rounded-2xl flex items-center justify-center ${styles.iconBg}`}>
                <span className={`material-symbols-outlined text-2xl ${styles.icon}`}>
                  {entity.severity === 'critical' ? 'priority_high' :
                   entity.severity === 'warning' ? 'warning' : 'info'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium tracking-widest ${styles.icon} mb-1`}>
                  {entity.reason}
                </p>
                <h2 className="text-xl font-bold text-white truncate">
                  {entity.title}
                </h2>
                {entity.subtitle && (
                  <p className="text-sm text-slate-400 truncate">{entity.subtitle}</p>
                )}
              </div>
              <button
                onClick={onDismiss}
                className="size-10 rounded-xl bg-white/10 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-slate-400">close</span>
              </button>
            </div>

            {/* Why Section */}
            <div className={`rounded-xl p-4 mb-4 ${styles.bg} border ${styles.border}`}>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                Why This Needs Attention
              </p>
              <p className="text-sm text-white leading-relaxed">
                {getDetailedReason(entity)}
              </p>
            </div>

            {/* Evidence Status (if job data available) */}
            {job && (
              <div className="bg-slate-800 rounded-xl p-4 mb-4 border border-white/15">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                  Evidence Status
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className={`text-2xl font-bold ${job.photos.length > 0 ? 'text-emerald-500' : 'text-slate-600'}`}>
                      {job.photos.length}
                    </p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest">Photos</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-2xl font-bold ${job.signature ? 'text-emerald-500' : 'text-slate-600'}`}>
                      {job.signature ? '\u2713' : '\u2014'}
                    </p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest">Signed</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-2xl font-bold ${job.sealedAt ? 'text-emerald-500' : 'text-slate-600'}`}>
                      {job.sealedAt ? '\u2713' : '\u2014'}
                    </p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest">Sealed</p>
                  </div>
                </div>
              </div>
            )}

            {/* Request Signature Action (when signature is missing) */}
            {canRequestSignature && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="size-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-xl text-amber-500">draw</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-amber-500 uppercase tracking-widest">
                      Signature Missing
                    </p>
                    <p className="text-sm text-amber-100/80">
                      Remind technician to capture customer signature
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleRequestSignature}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-xl
                             transition-all flex items-center justify-center gap-2 min-h-[44px]
                             active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-lg">
                    {technician?.phone ? 'chat' : 'mail'}
                  </span>
                  Request Signature
                </button>
              </div>
            )}

            {/* Consequence Warning */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
              <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-2">
                If Not Addressed
              </p>
              <p className="text-sm text-amber-100/80 leading-relaxed">
                {getConsequence(entity)}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onAction}
                className="flex-1 py-4 bg-primary hover:bg-blue-600 text-white font-bold rounded-xl
                           transition-all flex items-center justify-center gap-2 min-h-[56px]
                           shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30
                           active:scale-[0.98]"
              >
                {entity.actionLabel}
                <span className="material-symbols-outlined text-lg">chevron_right</span>
              </button>
              <button
                onClick={onDismiss}
                className="px-6 py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl
                           transition-all border border-white/10 min-h-[56px] active:scale-[0.98]"
              >
                Later
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default React.memo(AttentionModal);
