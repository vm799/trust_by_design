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

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FocusEntity } from '../../lib/dashboardState';
import { Job } from '../../types';

interface AttentionModalProps {
  /** Focus entity to display */
  entity: FocusEntity;

  /** Optional job data for evidence status */
  job?: Job | null;

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
  isOpen,
  onAction,
  onDismiss,
}) => {
  const styles = SEVERITY_STYLES[entity.severity];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm"
          onClick={onDismiss}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
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
                <p className={`text-xs font-bold uppercase tracking-widest ${styles.icon} mb-1`}>
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
                className="size-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
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
              <div className="bg-slate-800/50 rounded-xl p-4 mb-4 border border-white/5">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                  Evidence Status
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className={`text-2xl font-bold ${job.photos.length > 0 ? 'text-emerald-500' : 'text-slate-600'}`}>
                      {job.photos.length}
                    </p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">Photos</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-2xl font-bold ${job.signature ? 'text-emerald-500' : 'text-slate-600'}`}>
                      {job.signature ? '\u2713' : '\u2014'}
                    </p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">Signed</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-2xl font-bold ${job.sealedAt ? 'text-emerald-500' : 'text-slate-600'}`}>
                      {job.sealedAt ? '\u2713' : '\u2014'}
                    </p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">Sealed</p>
                  </div>
                </div>
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
