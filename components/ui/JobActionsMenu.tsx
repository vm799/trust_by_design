/**
 * JobActionsMenu - Manager actions for job lifecycle management
 *
 * Phase 3.5: Full workflow matrix support
 *
 * Actions:
 * - Pause Job → status='Paused' → resume button
 * - Cancel Job → status='Cancelled' → reason dropdown
 * - Reassign Job → transfer techId
 */

import React, { useState } from 'react';
import { Job, Technician, JobStatus } from '../../types';
import { showToast } from '../../lib/microInteractions';

interface JobActionsMenuProps {
  job: Job;
  technicians: Technician[];
  onUpdateJob: (jobId: string, updates: Partial<Job>) => void;
  className?: string;
}

const CANCEL_REASONS = [
  'Client cancelled',
  'Weather conditions',
  'Technician unavailable',
  'Equipment issue',
  'Scheduling conflict',
  'Other',
];

const JobActionsMenu: React.FC<JobActionsMenuProps> = ({
  job,
  technicians,
  onUpdateJob,
  className = '',
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showReassign, setShowReassign] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const isPaused = job.status === 'Paused';
  const isCancelled = job.status === 'Cancelled';
  const isCompleted = job.status === 'Submitted' || job.status === 'Archived';

  const handlePauseToggle = () => {
    const newStatus: JobStatus = isPaused ? 'Pending' : 'Paused';
    onUpdateJob(job.id, { status: newStatus });
    showToast(
      isPaused ? 'Job resumed' : 'Job paused',
      'success',
      3000
    );
    setShowMenu(false);
  };

  const handleCancel = () => {
    if (!cancelReason) {
      showToast('Please select a cancellation reason', 'warning', 3000);
      return;
    }
    onUpdateJob(job.id, {
      status: 'Cancelled',
      notes: `${job.notes}\n\n[CANCELLED: ${cancelReason}]`,
    });
    showToast('Job cancelled', 'info', 3000);
    setShowCancel(false);
    setShowMenu(false);
  };

  const handleReassign = (newTechId: string) => {
    const newTech = technicians.find(t => t.id === newTechId);
    if (!newTech) return;

    onUpdateJob(job.id, {
      techId: newTechId,
      technician: newTech.name,
    });
    showToast(`Job reassigned to ${newTech.name}`, 'success', 3000);
    setShowReassign(false);
    setShowMenu(false);
  };

  // Don't show menu for completed jobs
  if (isCompleted) {
    return null;
  }

  return (
    <div className={`relative ${className}`}>
      {/* Menu Toggle Button */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
        title="Job actions"
      >
        <span className="material-symbols-outlined text-slate-400">more_vert</span>
      </button>

      {/* Dropdown Menu */}
      {showMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setShowMenu(false);
              setShowReassign(false);
              setShowCancel(false);
            }}
          />

          {/* Menu */}
          <div className="absolute right-0 top-full mt-1 w-56 bg-slate-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            {!showReassign && !showCancel ? (
              <>
                {/* Pause/Resume */}
                <button
                  onClick={handlePauseToggle}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800 transition-colors text-left"
                >
                  <span className="material-symbols-outlined text-warning">
                    {isPaused ? 'play_arrow' : 'pause'}
                  </span>
                  <span className="text-sm font-bold text-white">
                    {isPaused ? 'Resume Job' : 'Pause Job'}
                  </span>
                </button>

                {/* Reassign */}
                <button
                  onClick={() => setShowReassign(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800 transition-colors text-left"
                >
                  <span className="material-symbols-outlined text-primary">swap_horiz</span>
                  <span className="text-sm font-bold text-white">Reassign Technician</span>
                </button>

                {/* Cancel */}
                {!isCancelled && (
                  <button
                    onClick={() => setShowCancel(true)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800 transition-colors text-left border-t border-white/5"
                  >
                    <span className="material-symbols-outlined text-danger">cancel</span>
                    <span className="text-sm font-bold text-danger">Cancel Job</span>
                  </button>
                )}
              </>
            ) : showReassign ? (
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest">
                    Reassign To
                  </h4>
                  <button
                    onClick={() => setShowReassign(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {technicians
                    .filter(t => t.id !== job.techId)
                    .map(tech => (
                      <button
                        key={tech.id}
                        onClick={() => handleReassign(tech.id)}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-800 rounded-lg transition-colors text-left"
                      >
                        <div className="size-8 rounded-lg bg-primary/20 flex items-center justify-center">
                          <span className="text-primary font-black text-sm">
                            {tech.name[0]}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">{tech.name}</p>
                          <p className="text-xs text-slate-400">{tech.status}</p>
                        </div>
                      </button>
                    ))}
                  {technicians.filter(t => t.id !== job.techId).length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-2">
                      No other technicians available
                    </p>
                  )}
                </div>
              </div>
            ) : showCancel ? (
              <div className="p-3 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-black text-danger uppercase tracking-widest">
                    Cancel Job
                  </h4>
                  <button
                    onClick={() => setShowCancel(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary"
                >
                  <option value="">Select reason...</option>
                  {CANCEL_REASONS.map(reason => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
                <button
                  onClick={handleCancel}
                  disabled={!cancelReason}
                  className="w-full py-2 bg-danger hover:bg-danger/80 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs uppercase tracking-widest rounded-lg transition-colors"
                >
                  Confirm Cancel
                </button>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
};

export default JobActionsMenu;
