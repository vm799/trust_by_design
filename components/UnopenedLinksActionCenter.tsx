/**
 * UnopenedLinksActionCenter - Phase 10
 *
 * Full action center for managing unopened job links.
 * Provides one-click actions: Call Tech/Client, Reassign, Pause, Cancel, Resend, Delete
 */

import React, { useState, useMemo } from 'react';
import { Modal, ActionButton, ConfirmDialog } from './ui';
import { Job, Technician } from '../types';
import { showToast } from '../lib/microInteractions';
import { generateMagicLink, acknowledgeLinkFlag, type MagicLinkInfo } from '../lib/db';

interface UnopenedLinksActionCenterProps {
  isOpen: boolean;
  onClose: () => void;
  links: MagicLinkInfo[];
  jobs: Job[];
  technicians: Technician[];
  clients: Array<{ id: string; name: string; phone?: string; email?: string }>;
  onUpdateJob: (job: Job) => void;
  onDeleteJob?: (jobId: string) => void;
  onDismissLink: (token: string) => void;
  onRefreshLinks: () => void;
}

type JobAction = 'pause' | 'cancel' | 'delete' | 'reassign';

const UnopenedLinksActionCenter: React.FC<UnopenedLinksActionCenterProps> = ({
  isOpen,
  onClose,
  links,
  jobs,
  technicians,
  clients,
  onUpdateJob,
  onDeleteJob,
  onDismissLink,
  onRefreshLinks,
}) => {
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [showReassignDropdown, setShowReassignDropdown] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    action: JobAction;
    jobIds: string[];
    title: string;
    message: string;
  } | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Get enriched link data with job and tech info
  const enrichedLinks = useMemo(() => {
    return links.map(link => {
      const job = jobs.find(j => j.id === link.job_id);
      const tech = job ? technicians.find(t => t.id === job.techId) : null;
      const client = job ? clients.find(c => c.id === job.clientId) : null;
      const sentAge = link.sent_at
        ? Math.floor((Date.now() - new Date(link.sent_at).getTime()) / (1000 * 60 * 60))
        : 0;
      return { link, job, tech, client, sentAge, isUrgent: sentAge >= 4 };
    }).filter(item => item.job);
  }, [links, jobs, technicians, clients]);

  const handleSelectAll = () => {
    if (selectedJobs.size === enrichedLinks.length) {
      setSelectedJobs(new Set());
    } else {
      setSelectedJobs(new Set(enrichedLinks.map(item => item.job!.id)));
    }
  };

  const handleToggleSelect = (jobId: string) => {
    const newSelected = new Set(selectedJobs);
    if (newSelected.has(jobId)) {
      newSelected.delete(jobId);
    } else {
      newSelected.add(jobId);
    }
    setSelectedJobs(newSelected);
  };

  const handlePauseJob = async (job: Job) => {
    const updatedJob = { ...job, status: 'Paused' as const, pausedAt: Date.now() };
    onUpdateJob(updatedJob as Job);
    showToast(`Job paused - ${job.technician} notified`, 'success', 3000);
  };

  const handleCancelJob = async (job: Job, reason: string) => {
    const updatedJob = {
      ...job,
      status: 'Cancelled' as const,
      cancelledAt: Date.now(),
      cancellationReason: reason,
    };
    onUpdateJob(updatedJob as Job);
    showToast(`Job cancelled - ${job.technician} notified`, 'warning', 3000);
  };

  const handleReassignJob = async (job: Job, newTechId: string) => {
    const newTech = technicians.find(t => t.id === newTechId);
    if (!newTech) return;

    const updatedJob = {
      ...job,
      techId: newTechId,
      technician: newTech.name,
      reassignedAt: Date.now(),
      previousTechId: job.techId,
    };
    onUpdateJob(updatedJob);

    // Generate new magic link for new technician
    const newLinkResult = await generateMagicLink(job.id);

    showToast(`Reassigned to ${newTech.name}${newTech.phone ? ` (${newTech.phone})` : ''}`, 'success', 4000);
    setShowReassignDropdown(null);
    onRefreshLinks();
  };

  const handleResendLink = async (job: Job, link: MagicLinkInfo) => {
    // Generate a fresh magic link
    const newLinkResult = await generateMagicLink(job.id);

    // Share via native share if available, otherwise copy to clipboard
    const linkUrl = newLinkResult.data?.url || `${window.location.origin}/#/tech/${job.id}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Job Link: ${job.title}`,
          text: `${job.technician}, here's your job link for ${job.title}`,
          url: linkUrl,
        });
        showToast('Link shared successfully', 'success', 3000);
      } catch {
        // User cancelled or share failed
        await navigator.clipboard.writeText(linkUrl);
        showToast('Link copied to clipboard', 'success', 3000);
      }
    } else {
      await navigator.clipboard.writeText(linkUrl);
      showToast('Link copied to clipboard', 'success', 3000);
    }

    // Dismiss the old alert
    onDismissLink(link.token);
    onRefreshLinks();
  };

  const handleDeleteJob = async (job: Job, link: MagicLinkInfo) => {
    if (onDeleteJob) {
      onDeleteJob(job.id);
      onDismissLink(link.token);
      showToast('Job deleted permanently', 'warning', 3000);
    }
  };

  // Bulk actions
  const handleBulkPause = () => {
    setConfirmDialog({
      isOpen: true,
      action: 'pause',
      jobIds: Array.from(selectedJobs),
      title: 'Pause Selected Jobs',
      message: `Pause ${selectedJobs.size} job${selectedJobs.size > 1 ? 's' : ''}? Technicians will be notified.`,
    });
  };

  const handleBulkCancel = () => {
    setConfirmDialog({
      isOpen: true,
      action: 'cancel',
      jobIds: Array.from(selectedJobs),
      title: 'Cancel Selected Jobs',
      message: `Cancel ${selectedJobs.size} job${selectedJobs.size > 1 ? 's' : ''}? This cannot be undone.`,
    });
  };

  const executeBulkAction = async () => {
    if (!confirmDialog) return;

    const { action, jobIds } = confirmDialog;

    for (const jobId of jobIds) {
      const enriched = enrichedLinks.find(e => e.job?.id === jobId);
      if (!enriched?.job) continue;

      if (action === 'pause') {
        await handlePauseJob(enriched.job);
        onDismissLink(enriched.link.token);
      } else if (action === 'cancel') {
        await handleCancelJob(enriched.job, cancelReason || 'Bulk cancelled by manager');
        onDismissLink(enriched.link.token);
      }
    }

    setSelectedJobs(new Set());
    setConfirmDialog(null);
    setCancelReason('');
    onRefreshLinks();
  };

  if (!isOpen) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Unopened Links Action Center"
        size="xl"
      >
        <div className="space-y-4">
          {/* Header Stats */}
          <div className="flex items-center justify-between p-4 bg-danger/10 border border-danger/20 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="size-10 bg-danger/20 rounded-xl flex items-center justify-center">
                <span className="material-symbols-outlined text-danger text-xl">warning</span>
              </div>
              <div>
                <p className="text-lg font-black text-white">{enrichedLinks.length} Unopened</p>
                <p className="text-xs text-slate-400">Links not accessed after 2+ hours</p>
              </div>
            </div>
            {enrichedLinks.length > 1 && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedJobs.size === enrichedLinks.length}
                  onChange={handleSelectAll}
                  className="size-5 rounded border-2 border-slate-600 bg-slate-800 checked:bg-primary checked:border-primary cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-400 uppercase">Select All</span>
              </label>
            )}
          </div>

          {/* Bulk Actions */}
          {selectedJobs.size > 0 && (
            <div className="flex items-center gap-2 p-3 bg-slate-800/50 border border-white/10 rounded-xl animate-in">
              <span className="text-xs font-bold text-slate-400 mr-2">
                {selectedJobs.size} selected:
              </span>
              <button
                onClick={handleBulkPause}
                className="px-3 py-1.5 bg-warning/20 hover:bg-warning/30 text-warning border border-warning/30 rounded-lg text-xs font-bold uppercase transition-all"
              >
                Pause All
              </button>
              <button
                onClick={handleBulkCancel}
                className="px-3 py-1.5 bg-danger/20 hover:bg-danger/30 text-danger border border-danger/30 rounded-lg text-xs font-bold uppercase transition-all"
              >
                Cancel All
              </button>
            </div>
          )}

          {/* Links Table */}
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {enrichedLinks.map(({ link, job, tech, client, sentAge, isUrgent }) => {
              if (!job) return null;

              return (
                <div
                  key={link.token}
                  className={`bg-slate-900/80 border rounded-xl p-4 transition-all ${
                    isUrgent ? 'border-danger/40' : 'border-warning/30'
                  } ${selectedJobs.has(job.id) ? 'ring-2 ring-primary' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedJobs.has(job.id)}
                      onChange={() => handleToggleSelect(job.id)}
                      className="size-5 rounded border-2 border-slate-600 bg-slate-800 checked:bg-primary checked:border-primary cursor-pointer mt-1"
                    />

                    {/* Job Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isUrgent ? 'text-danger' : 'text-warning'}`}>
                          {sentAge}h since sent {isUrgent && '- URGENT'}
                        </span>
                      </div>
                      <h4 className="font-black text-white text-sm uppercase tracking-tight truncate">
                        {job.title}
                      </h4>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[10px] text-slate-400">
                        <span>
                          Tech: <span className="text-slate-300 font-bold">{tech?.name || job.technician}</span>
                        </span>
                        <span>
                          Client: <span className="text-slate-300 font-bold">{client?.name || job.client}</span>
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {/* Call Tech */}
                        {tech?.phone && (
                          <a
                            href={`tel:${tech.phone}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-success/20 hover:bg-success/30 text-success border border-success/30 rounded-lg text-[10px] font-bold uppercase transition-all"
                            title={`Call ${tech.name}: ${tech.phone}`}
                          >
                            <span className="material-symbols-outlined text-xs">call</span>
                            Call Tech
                          </a>
                        )}

                        {/* Call Client */}
                        {client?.phone && (
                          <a
                            href={`tel:${client.phone}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg text-[10px] font-bold uppercase transition-all"
                            title={`Call ${client.name}: ${client.phone}`}
                          >
                            <span className="material-symbols-outlined text-xs">call</span>
                            Call Client
                          </a>
                        )}

                        {/* Reassign */}
                        <div className="relative">
                          <button
                            onClick={() => setShowReassignDropdown(showReassignDropdown === job.id ? null : job.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 rounded-lg text-[10px] font-bold uppercase transition-all"
                          >
                            <span className="material-symbols-outlined text-xs">swap_horiz</span>
                            Reassign
                          </button>
                          {showReassignDropdown === job.id && (
                            <div className="absolute z-50 top-full left-0 mt-1 w-48 bg-slate-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                              <div className="p-2 border-b border-white/5">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Select Technician</p>
                              </div>
                              <div className="max-h-40 overflow-y-auto">
                                {technicians
                                  .filter(t => t.id !== job.techId)
                                  .map(t => (
                                    <button
                                      key={t.id}
                                      onClick={() => handleReassignJob(job, t.id)}
                                      className="w-full px-3 py-2 text-left hover:bg-white/5 transition-colors"
                                    >
                                      <p className="text-sm text-white font-medium">{t.name}</p>
                                      {t.phone && (
                                        <p className="text-[10px] text-slate-400">{t.phone}</p>
                                      )}
                                    </button>
                                  ))}
                                {technicians.filter(t => t.id !== job.techId).length === 0 && (
                                  <p className="px-3 py-2 text-xs text-slate-400 italic">No other technicians</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Resend Link */}
                        <button
                          onClick={() => handleResendLink(job, link)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 rounded-lg text-[10px] font-bold uppercase transition-all"
                        >
                          <span className="material-symbols-outlined text-xs">send</span>
                          Resend
                        </button>

                        {/* Pause */}
                        <button
                          onClick={() => {
                            handlePauseJob(job);
                            onDismissLink(link.token);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-warning/20 hover:bg-warning/30 text-warning border border-warning/30 rounded-lg text-[10px] font-bold uppercase transition-all"
                        >
                          <span className="material-symbols-outlined text-xs">pause</span>
                          Pause
                        </button>

                        {/* Cancel */}
                        <button
                          onClick={() => {
                            setConfirmDialog({
                              isOpen: true,
                              action: 'cancel',
                              jobIds: [job.id],
                              title: 'Cancel Job',
                              message: `Cancel "${job.title}"? The technician will be notified.`,
                            });
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-danger/20 hover:bg-danger/30 text-danger border border-danger/30 rounded-lg text-[10px] font-bold uppercase transition-all"
                        >
                          <span className="material-symbols-outlined text-xs">cancel</span>
                          Cancel
                        </button>

                        {/* Delete (if available) */}
                        {onDeleteJob && (
                          <button
                            onClick={() => {
                              setConfirmDialog({
                                isOpen: true,
                                action: 'delete',
                                jobIds: [job.id],
                                title: 'Delete Job',
                                message: `Permanently delete "${job.title}"? This cannot be undone.`,
                              });
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-red-900/50 text-slate-400 hover:text-danger border border-slate-700 rounded-lg text-[10px] font-bold uppercase transition-all"
                          >
                            <span className="material-symbols-outlined text-xs">delete</span>
                            Delete
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Dismiss */}
                    <button
                      onClick={() => onDismissLink(link.token)}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
                      title="Dismiss alert"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {enrichedLinks.length === 0 && (
              <div className="text-center py-12">
                <div className="size-16 bg-success/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-success text-3xl">check_circle</span>
                </div>
                <p className="text-lg font-bold text-white">All Clear!</p>
                <p className="text-sm text-slate-400 mt-1">No unopened links requiring attention</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end pt-4 border-t border-white/5">
            <ActionButton variant="secondary" onClick={onClose}>
              Close
            </ActionButton>
          </div>
        </div>
      </Modal>

      {/* Confirm Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          onClose={() => {
            setConfirmDialog(null);
            setCancelReason('');
          }}
          onConfirm={async () => {
            if (confirmDialog.action === 'delete' && confirmDialog.jobIds.length === 1) {
              const enriched = enrichedLinks.find(e => e.job?.id === confirmDialog.jobIds[0]);
              if (enriched?.job) {
                handleDeleteJob(enriched.job, enriched.link);
              }
              setConfirmDialog(null);
            } else {
              await executeBulkAction();
            }
          }}
          title={confirmDialog.title}
          message={
            confirmDialog.action === 'cancel' ? (
              <div className="space-y-3">
                <p>{confirmDialog.message}</p>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Reason for cancellation (optional)"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                />
              </div>
            ) : (
              confirmDialog.message
            )
          }
          confirmLabel={confirmDialog.action === 'delete' ? 'Delete' : confirmDialog.action === 'cancel' ? 'Cancel Job' : 'Confirm'}
          variant={confirmDialog.action === 'delete' || confirmDialog.action === 'cancel' ? 'danger' : 'warning'}
        />
      )}
    </>
  );
};

export default UnopenedLinksActionCenter;
