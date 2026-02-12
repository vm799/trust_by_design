/**
 * JobSwitcher.tsx - Floating Job Queue Component
 *
 * Allows technicians to see their job queue and switch between jobs.
 * Shows active job, paused jobs, and pending jobs in a drawer.
 *
 * Design: FAB button that opens a bottom drawer on mobile.
 *
 * @author Claude Code - Multi-Job UX Enhancement
 */

import React, { useState, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { HandshakeService, type PausedJobContext } from '../lib/handshakeService';
import ConfirmDialog from './ui/ConfirmDialog';

interface JobSwitcherProps {
  currentJobId?: string;
  onPauseRequest?: () => void;
}

/**
 * JobSwitcher - FAB + Drawer for multi-job switching
 */
export const JobSwitcher = memo(function JobSwitcher({
  currentJobId,
  onPauseRequest,
}: JobSwitcherProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [pausedJobs, setPausedJobs] = useState<PausedJobContext[]>([]);
  const [hasLockedJob, setHasLockedJob] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [, setPendingResumeJobId] = useState<string | null>(null);

  // Load paused jobs and check current lock status
  useEffect(() => {
    const loadState = () => {
      const paused = HandshakeService.getPausedJobs();
      setPausedJobs(paused);

      const context = HandshakeService.get();
      setHasLockedJob(!!context?.isLocked);
    };

    loadState();

    // Refresh when drawer opens
    if (isOpen) {
      loadState();
    }
  }, [isOpen]);

  // Don't show FAB if no paused jobs and no current job
  if (pausedJobs.length === 0 && !currentJobId) {
    return null;
  }

  const handleResumeJob = (jobId: string) => {
    // If there's a current job locked, need to pause it first
    if (hasLockedJob && currentJobId !== jobId) {
      if (onPauseRequest) {
        onPauseRequest();
      } else {
        // FIELD UX FIX: Use ConfirmDialog instead of browser alert()
        setPendingResumeJobId(jobId);
        setShowPauseDialog(true);
      }
      return;
    }

    // Resume the paused job
    const resumed = HandshakeService.resumeJob(jobId);
    if (resumed) {
      setIsOpen(false);
      navigate(`/run/${jobId}`);
    }
  };

  const handlePauseConfirm = () => {
    // User confirmed they want to pause current job
    // The parent component should handle the actual pause logic
    setShowPauseDialog(false);
    setPendingResumeJobId(null);
    // For now, just close drawer - parent needs to implement pause flow
    setIsOpen(false);
  };

  const formatPauseReason = (reason?: PausedJobContext['pauseReason']) => {
    switch (reason) {
      case 'emergency': return 'Emergency pause';
      case 'parts_unavailable': return 'Waiting for parts';
      case 'weather': return 'Weather delay';
      case 'client_unavailable': return 'Client unavailable';
      default: return 'Paused';
    }
  };

  const formatTimeSince = (timestamp: number) => {
    const minutes = Math.floor((Date.now() - timestamp) / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const otherPausedJobs = pausedJobs.filter(j => j.jobId !== currentJobId);

  return (
    <>
      {/* FAB Button - 56px for gloved hands */}
      {otherPausedJobs.length > 0 && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          onClick={() => setIsOpen(!isOpen)}
          className={`
            fixed bottom-20 right-4 z-40
            size-14 rounded-full flex items-center justify-center
            transition-all active:scale-95 shadow-lg
            bg-amber-500 hover:bg-amber-600
          `}
          aria-label={`Switch jobs (${otherPausedJobs.length} paused)`}
        >
          <span className="material-symbols-outlined text-white text-2xl">
            splitscreen
          </span>
          {/* Badge */}
          <span className="absolute -top-1 -right-1 size-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {otherPausedJobs.length}
          </span>
        </motion.button>
      )}

      {/* Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40 bg-black/50"
            />

            {/* Drawer Panel */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 max-h-[70vh] bg-slate-900 rounded-t-3xl border-t border-white/10 overflow-hidden"
            >
              {/* Handle Bar */}
              <div className="flex justify-center py-3">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              <div className="px-4 pb-8 overflow-y-auto max-h-[calc(70vh-40px)]">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-400">
                      pause_circle
                    </span>
                    <h2 className="text-lg font-bold text-white">Paused Jobs</h2>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="size-10 rounded-full bg-slate-800 flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined text-slate-400">close</span>
                  </button>
                </div>

                {/* Current Job Indicator */}
                {currentJobId && hasLockedJob && (
                  <div className="mb-6 p-4 rounded-2xl bg-primary/20 border border-primary/30">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-primary text-sm">
                        check_circle
                      </span>
                      <span className="text-xs font-bold text-primary uppercase">
                        Currently Active
                      </span>
                    </div>
                    <p className="text-sm text-white font-medium">
                      Job #{currentJobId.slice(0, 8)}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Pause this job to switch to another
                    </p>
                  </div>
                )}

                {/* Paused Jobs List */}
                {otherPausedJobs.length === 0 ? (
                  <div className="text-center py-8">
                    <span className="material-symbols-outlined text-4xl text-slate-500 mb-2">
                      done_all
                    </span>
                    <p className="text-sm text-slate-400">
                      No other paused jobs
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {otherPausedJobs.map(job => (
                      <motion.div
                        key={job.jobId}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-4 rounded-2xl bg-slate-800/50 border border-white/5"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-bold text-white">
                              Job #{job.jobId.slice(0, 8)}
                            </p>
                            <p className="text-xs text-amber-400/80">
                              {formatPauseReason(job.pauseReason)}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              {formatTimeSince(job.pausedAt)}
                            </p>
                          </div>
                          <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-[10px] font-bold rounded">
                            PAUSED
                          </span>
                        </div>

                        <button
                          onClick={() => handleResumeJob(job.jobId)}
                          disabled={hasLockedJob && currentJobId !== job.jobId}
                          className={`
                            w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors
                            ${hasLockedJob && currentJobId !== job.jobId
                              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                              : 'bg-amber-500 hover:bg-amber-600 text-white'
                            }
                          `}
                        >
                          <span className="material-symbols-outlined text-lg">
                            play_arrow
                          </span>
                          {hasLockedJob && currentJobId !== job.jobId
                            ? 'Pause current job first'
                            : 'Resume Job'
                          }
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* View All Jobs Link */}
                <div className="mt-6 text-center">
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      navigate('/job-log');
                    }}
                    className="text-sm text-primary hover:text-primary/80 transition-colors"
                  >
                    View All Jobs →
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* FIELD UX FIX: Confirm dialog for job switching */}
      <ConfirmDialog
        isOpen={showPauseDialog}
        onClose={() => {
          setShowPauseDialog(false);
          setPendingResumeJobId(null);
        }}
        onConfirm={handlePauseConfirm}
        title="Pause Current Job?"
        message="You need to pause your current job before switching to another. Would you like to go back and pause it?"
        confirmLabel="Go Back"
        cancelLabel="Cancel"
        variant="warning"
      />
    </>
  );
});

export default JobSwitcher;
