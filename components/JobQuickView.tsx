/**
 * JobQuickView Component
 *
 * A lightweight modal/drawer for managers to quickly check job status
 * without navigating to the full JobReport view.
 *
 * Shows: Status, Blockers, Evidence Summary, Quick Actions
 */

import React, { useState, useEffect } from 'react';
import { Job, Technician } from '../types';
import { getMagicLinksForJob, type MagicLinkInfo } from '../lib/db';
import Modal from './ui/Modal';

interface JobQuickViewProps {
  job: Job | null;
  isOpen: boolean;
  onClose: () => void;
  onViewFullReport: (jobId: string) => void;
  onGenerateLink?: (jobId: string) => void;
  onResendLink?: (jobId: string) => void;
  onCallTech?: (phone: string) => void;
  technicians?: Technician[];
}

interface JobState {
  noWorkStarted: boolean;
  evidenceIncomplete: boolean;
  readyForSeal: boolean;
  sealed: boolean;
}

const JobQuickView: React.FC<JobQuickViewProps> = ({
  job,
  isOpen,
  onClose,
  onViewFullReport,
  onGenerateLink,
  onResendLink,
  onCallTech,
  technicians = [],
}) => {
  const [magicLinkInfo, setMagicLinkInfo] = useState<MagicLinkInfo | null>(null);
  const [isLoadingLink, setIsLoadingLink] = useState(false);

  // Load magic link info when job changes
  useEffect(() => {
    if (job?.id && isOpen) {
      setIsLoadingLink(true);
      const links = getMagicLinksForJob(job.id);
      // Get the most recent active link, or the first link if none active
      const activeLink = links.find(l => l.status === 'active') || links[0] || null;
      setMagicLinkInfo(activeLink);
      setIsLoadingLink(false);
    }
  }, [job?.id, isOpen]);

  if (!job) return null;

  // Calculate job state
  const hasPhotos = job.photos.length > 0;
  const hasSignature = !!job.signature;
  const isSealed = !!job.sealedAt || !!job.isSealed;
  const techLinkSent = !!magicLinkInfo?.sent_at || !!job.magicLinkToken;
  const techLinkOpened = !!job.technicianLinkOpened || !!magicLinkInfo?.first_accessed_at;

  const jobState: JobState = {
    noWorkStarted: !hasPhotos && !hasSignature && !isSealed,
    evidenceIncomplete: hasPhotos && !hasSignature && !isSealed,
    readyForSeal: hasPhotos && hasSignature && !isSealed,
    sealed: isSealed,
  };

  // Calculate blockers
  const blockers: string[] = [];
  if (!techLinkSent) blockers.push('Technician link not generated');
  else if (!techLinkOpened) blockers.push('Technician has not opened the link');
  else if (!hasPhotos) blockers.push('No evidence photos captured');
  else if (!hasSignature) blockers.push('Client signature not obtained');

  // Get tech info
  const tech = technicians.find(t => t.id === job.techId);

  // Determine status colors and labels
  const getStatusInfo = () => {
    if (jobState.sealed) return {
      color: 'text-success',
      bgColor: 'bg-success/10',
      borderColor: 'border-success/30',
      icon: 'verified',
      label: 'Sealed & Verified'
    };
    if (jobState.readyForSeal) return {
      color: 'text-success',
      bgColor: 'bg-success/10',
      borderColor: 'border-success/30',
      icon: 'lock_open',
      label: 'Ready to Seal'
    };
    if (jobState.evidenceIncomplete) return {
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      borderColor: 'border-warning/30',
      icon: 'pending',
      label: 'Evidence Incomplete'
    };
    return {
      color: 'text-danger',
      bgColor: 'bg-danger/10',
      borderColor: 'border-danger/30',
      icon: 'hourglass_empty',
      label: 'Not Started'
    };
  };

  const status = getStatusInfo();

  // Time since link sent
  const getTimeSinceSent = () => {
    if (!magicLinkInfo?.sent_at) return null;
    const sent = new Date(magicLinkInfo.sent_at);
    const now = new Date();
    const hours = Math.floor((now.getTime() - sent.getTime()) / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="lg"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className={`size-14 rounded-2xl flex items-center justify-center ${status.bgColor}`}>
            <span className={`material-symbols-outlined text-3xl font-black ${status.color}`}>
              {status.icon}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">
              {job.title}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {job.client} • {job.technician}
            </p>
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full mt-2 ${status.bgColor} border ${status.borderColor}`}>
              <span className={`material-symbols-outlined text-sm ${status.color}`}>{status.icon}</span>
              <span className={`text-xs font-semibold tracking-wider ${status.color}`}>{status.label}</span>
            </div>
          </div>
        </div>

        {/* Blockers - Only if not sealed */}
        {!jobState.sealed && blockers.length > 0 && (
          <div className="bg-danger/10 border-2 border-danger/30 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-danger text-lg">block</span>
              <span className="text-sm font-black text-danger uppercase tracking-wider">Blocking Progress</span>
            </div>
            <ul className="space-y-1">
              {blockers.map((blocker, i) => (
                <li key={`blocker-${i}`} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <span className="material-symbols-outlined text-danger text-xs">close</span>
                  {blocker}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-800 border border-white/15 rounded-xl p-3 text-center">
            <div className={`text-2xl font-black ${hasPhotos ? 'text-success' : 'text-slate-400'}`}>
              {job.photos.length}
            </div>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Photos</div>
          </div>
          <div className="bg-slate-800 border border-white/15 rounded-xl p-3 text-center">
            <div className={`text-2xl font-black ${hasSignature ? 'text-success' : 'text-slate-400'}`}>
              {hasSignature ? '✓' : '—'}
            </div>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Signature</div>
          </div>
          <div className="bg-slate-800 border border-white/15 rounded-xl p-3 text-center">
            <div className={`text-2xl font-black ${isSealed ? 'text-success' : 'text-slate-400'}`}>
              {isSealed ? '✓' : '—'}
            </div>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Sealed</div>
          </div>
        </div>

        {/* Tech Link Status */}
        <div className="bg-slate-800 border border-white/15 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Technician Link</span>
            {getTimeSinceSent() && (
              <span className="text-[10px] text-slate-400">Sent {getTimeSinceSent()}</span>
            )}
          </div>

          {isLoadingLink ? (
            <div className="animate-pulse h-8 bg-slate-700 rounded"></div>
          ) : !techLinkSent ? (
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-slate-400">link_off</span>
              <span className="text-sm text-slate-400">No link generated</span>
              {onGenerateLink && (
                <button
                  onClick={() => onGenerateLink(job.id)}
                  className="ml-auto px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Generate
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className={`material-symbols-outlined ${techLinkOpened ? 'text-success' : 'text-warning'}`}>
                  {techLinkOpened ? 'check_circle' : 'schedule'}
                </span>
                <span className="text-sm text-slate-300">
                  {techLinkOpened ? 'Link opened by technician' : 'Waiting for technician to open'}
                </span>
              </div>
              {!techLinkOpened && (
                <div className="flex items-center gap-2 pt-2">
                  {tech?.phone && onCallTech && (
                    <button
                      onClick={() => onCallTech(tech.phone!)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-success/20 hover:bg-success/30 text-success border border-success/30 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      <span className="material-symbols-outlined text-xs">call</span>
                      Call Tech
                    </button>
                  )}
                  {onResendLink && (
                    <button
                      onClick={() => onResendLink(job.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-warning/20 hover:bg-warning/30 text-warning border border-warning/30 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      <span className="material-symbols-outlined text-xs">refresh</span>
                      Resend
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Photo Evidence Preview */}
        {hasPhotos && (
          <div className="bg-slate-800 border border-white/15 rounded-2xl p-4">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">
              Evidence Preview ({job.photos.length} photos)
            </span>
            <div className="flex -space-x-2">
              {job.photos.slice(0, 5).map((photo) => (
                <div
                  key={photo.id}
                  className="size-12 rounded-lg border-2 border-slate-900 overflow-hidden bg-slate-800"
                >
                  {photo.url && !photo.url.startsWith('idb://') ? (
                    <img src={photo.url} className="w-full h-full object-cover" alt="Evidence" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="material-symbols-outlined text-slate-400 text-lg">image</span>
                    </div>
                  )}
                </div>
              ))}
              {job.photos.length > 5 && (
                <div className="size-12 rounded-lg border-2 border-slate-900 bg-slate-800 flex items-center justify-center">
                  <span className="text-xs font-black text-slate-400">+{job.photos.length - 5}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white border border-white/10 rounded-xl text-sm font-semibold tracking-wider transition-all"
          >
            Close
          </button>
          <button
            onClick={() => {
              onClose();
              onViewFullReport(job.id);
            }}
            className="flex-1 px-4 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-semibold tracking-wider transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">open_in_new</span>
            {jobState.sealed ? 'View Report' : 'Manage Job'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default React.memo(JobQuickView);
