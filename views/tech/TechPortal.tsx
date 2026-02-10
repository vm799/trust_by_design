/**
 * TechPortal - Technician Dashboard
 *
 * Primary Question: "What am I meant to be doing right now?"
 *
 * Design Principles:
 * - Assigned jobs ONLY - no visibility of others (when online)
 * - No filters, no search (unless >10 jobs)
 * - Clear status labels: Assigned, Started, Finished
 * - Visual signal when job is "done enough"
 * - NO reordering, editing metadata, or arbitrary status changes
 *
 * BUNKER FIRST (Offline Mode):
 * - When offline, technicians CAN create jobs, clients, and capture evidence
 * - All actions sync when connectivity returns
 * - Never block field work due to "insufficient permissions"
 *
 * HERO CARD LAYOUT (2026-02-07):
 * - Started job: 50vh hero card with glassmorphism
 * - Assigned jobs: Horizontal swimlane with priority visual cues
 * - Finished jobs: Collapsed by default with shadow-inner style
 * - Urgent priority: Red pulse border animation
 */

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LoadingSkeleton } from '../../components/ui';
import { EvidenceProgressBar } from '../../components/dashboard';
import { useData } from '../../lib/DataContext';
import { useAuth } from '../../lib/AuthContext';
import { Job } from '../../types';
import { JobProofLogo } from '../../components/branding/jobproof-logo';
import { OfflineIndicator } from '../../components/OfflineIndicator';
import { fadeInUp, staggerContainer, staggerContainerFast } from '../../lib/animations';

const TechPortal: React.FC = () => {
  const { userId, session, userEmail } = useAuth();
  const { jobs: allJobsData, clients: clientsData, isLoading } = useData();

  // Get tech name for display
  const techName = session?.user?.user_metadata?.full_name || 'Technician';

  // Filter jobs assigned to this technician ONLY
  // SECURITY FIX: Match by UUID (techId/technicianId) OR by email (techEmail)
  const myJobs = useMemo(() => {
    return allJobsData.filter(j =>
      j.technicianId === userId ||
      j.techId === userId ||
      j.techMetadata?.createdByTechId === userId ||
      (userEmail && j.techEmail && j.techEmail.toLowerCase() === userEmail.toLowerCase())
    );
  }, [allJobsData, userId, userEmail]);

  // Categorize by status: Assigned (pending), Started (in progress), Finished
  const { assignedJobs, startedJob, finishedJobs } = useMemo(() => {
    // Only one job can be "started" at a time (In Progress)
    const started = myJobs.find(j => j.status === 'In Progress');

    // Assigned: Pending jobs (not started, not finished)
    const assigned = myJobs
      .filter(j =>
        j.status !== 'In Progress' &&
        j.status !== 'Complete' &&
        j.status !== 'Submitted'
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Finished: Complete or Submitted
    const finished = myJobs.filter(j =>
      j.status === 'Complete' || j.status === 'Submitted'
    );

    return {
      assignedJobs: assigned,
      startedJob: started,
      finishedJobs: finished,
    };
  }, [myJobs]);

  // Sync status
  const syncPending = useMemo(() => {
    return myJobs.filter(j => j.syncStatus === 'pending').length;
  }, [myJobs]);

  // Check if a job is "done enough" - has evidence and signature
  const isDoneEnough = (job: Job): boolean => {
    return job.photos.length > 0 && !!job.signature;
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col">
      {/* Minimal header */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 px-4 py-3">
        <div className="flex items-center justify-between">
          <JobProofLogo variant="full" size="sm" />
          <div className="flex items-center gap-3">
            {syncPending > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 dark:bg-amber-500/20 rounded-lg">
                <span className="material-symbols-outlined text-sm text-amber-600 dark:text-amber-400 animate-pulse">sync</span>
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{syncPending}</span>
              </div>
            )}
            <OfflineIndicator />
            {/* Profile link disabled - no profile view yet (Sprint 2 Task 2.8) */}
            <div
              className="size-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center opacity-50 cursor-not-allowed"
              title="Profile settings coming soon"
            >
              <span className="material-symbols-outlined text-sm text-slate-600 dark:text-slate-400">person</span>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 pb-20">
        {isLoading ? (
          <div className="px-4 py-6 max-w-2xl mx-auto">
            <LoadingSkeleton variant="card" count={3} />
          </div>
        ) : myJobs.length === 0 ? (
          /* Empty state - no assigned jobs */
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="size-20 rounded-[2rem] bg-slate-100 dark:bg-slate-900 flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-4xl text-slate-400">inbox</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Jobs Assigned</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm max-w-xs">
              You have no jobs assigned. Your manager will dispatch jobs when ready.
            </p>
          </div>
        ) : (
          <motion.div
            className="space-y-6"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {/* Greeting */}
            <motion.div variants={fadeInUp} className="px-4 pt-6 max-w-2xl mx-auto">
              <p className="text-sm text-slate-500 dark:text-slate-400">Welcome back,</p>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">{techName}</h1>
            </motion.div>

            {/* HERO CARD - Started job (50vh) */}
            {startedJob && (
              <motion.section variants={fadeInUp}>
                <HeroJobCard
                  job={startedJob}
                  client={clientsData.find(c => c.id === startedJob.clientId)}
                  isDoneEnough={isDoneEnough(startedJob)}
                />
              </motion.section>
            )}

            {/* ASSIGNED JOBS - Horizontal swimlane */}
            {assignedJobs.length > 0 && (
              <motion.section variants={fadeInUp} className="px-4 max-w-2xl mx-auto">
                <h2 className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
                  <span className="material-symbols-outlined text-sm">assignment</span>
                  Assigned
                  <span className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded text-[10px]">
                    {assignedJobs.length}
                  </span>
                </h2>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory">
                  {assignedJobs.map(job => (
                    <AssignedJobCard
                      key={job.id}
                      job={job}
                      client={clientsData.find(c => c.id === job.clientId)}
                    />
                  ))}
                </div>
              </motion.section>
            )}

            {/* FINISHED - Collapsed by default */}
            {finishedJobs.length > 0 && (
              <motion.section variants={fadeInUp} className="px-4 pt-4 border-t border-slate-200 dark:border-white/5 max-w-2xl mx-auto">
                <details className="group">
                  <summary className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 cursor-pointer list-none min-h-[44px]">
                    <span className="material-symbols-outlined text-sm transition-transform group-open:rotate-90">chevron_right</span>
                    <span className="material-symbols-outlined text-sm text-emerald-500">check_circle</span>
                    Finished
                    <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded text-[10px]">
                      {finishedJobs.length}
                    </span>
                  </summary>
                  <motion.div
                    className="space-y-2"
                    variants={staggerContainerFast}
                    initial="hidden"
                    animate="visible"
                  >
                    {finishedJobs.map(job => (
                      <motion.div key={job.id} variants={fadeInUp}>
                        <FinishedJobCard
                          job={job}
                          client={clientsData.find(c => c.id === job.clientId)}
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                </details>
              </motion.section>
            )}
          </motion.div>
        )}
      </main>
    </div>
  );
};

/**
 * HeroJobCard - 50vh hero card for started job
 * Dominant visual treatment with glassmorphism
 * CTAs: Capture (1-tap to camera) + Continue/Complete
 */
const HeroJobCard = React.memo(({
  job,
  client,
  isDoneEnough
}: {
  job: Job;
  client?: { id: string; name: string };
  isDoneEnough: boolean;
}) => {
  const previewPhoto = job.photos[0];

  return (
    <div className="relative min-h-[50vh] bg-gradient-to-br from-tech-accent/10 to-tech-accent/5 dark:from-tech-accent/20 dark:to-tech-accent/15 rounded-3xl overflow-hidden backdrop-blur-xl border border-tech-accent/30 dark:border-tech-accent/20">
      {/* Background image if photo exists */}
      {previewPhoto && (
        <div className="absolute inset-0 opacity-20">
          <img
            src={previewPhoto.url}
            alt="Job preview"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 p-6 flex flex-col justify-between h-full min-h-[50vh]">
        {/* Top section - badges */}
        <div className="flex items-start justify-between">
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1.5 bg-tech-accent/90 backdrop-blur-sm text-white text-xs font-medium tracking-wider rounded-lg flex items-center gap-1.5 shrink-0">
              <span className="material-symbols-outlined text-sm">play_arrow</span>
              Started
            </span>
            {isDoneEnough && (
              <span className="px-3 py-1.5 bg-emerald-500/90 backdrop-blur-sm text-white text-xs font-medium tracking-wider rounded-lg flex items-center gap-1.5 shrink-0">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                Ready to Submit
              </span>
            )}
            {job.syncStatus && job.syncStatus !== 'synced' && (
              <span className={`px-3 py-1.5 backdrop-blur-sm text-xs font-medium tracking-wider rounded-lg flex items-center gap-1.5 shrink-0 ${
                job.syncStatus === 'failed'
                  ? 'bg-red-500/90 text-white'
                  : 'bg-amber-500/90 text-white'
              }`}>
                <span className={`material-symbols-outlined text-sm ${job.syncStatus === 'pending' ? 'animate-pulse' : ''}`}>
                  {job.syncStatus === 'failed' ? 'sync_problem' : 'sync'}
                </span>
                {job.syncStatus === 'failed' ? 'Sync Failed' : 'Syncing'}
              </span>
            )}
          </div>
        </div>

        {/* Middle section - job details (tappable to navigate) */}
        <Link to={`/tech/job/${job.id}`} className="flex-1 flex flex-col justify-center py-8 active:opacity-80 transition-opacity">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 line-clamp-2">
            {job.title || `Job #${job.id.slice(0, 6)}`}
          </h2>
          <p className="text-lg text-slate-700 dark:text-slate-300 mb-4 truncate">
            {client?.name || job.client || 'Client'}
          </p>
          {job.address && (
            <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1.5 truncate">
              <span className="material-symbols-outlined text-sm shrink-0">location_on</span>
              <span className="truncate">{job.address}</span>
            </p>
          )}
        </Link>

        {/* Bottom section - evidence progress + action CTAs */}
        <div className="space-y-4">
          {/* Evidence progress bar (replaces text-based photo/signature indicators) */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl p-3">
            <EvidenceProgressBar job={job} />
          </div>

          {/* Direct action CTAs: Capture + Continue/Complete */}
          <div className="flex gap-2">
            <Link
              to={`/tech/job/${job.id}/capture`}
              className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] min-h-[56px]"
              aria-label="Capture evidence"
            >
              <span className="material-symbols-outlined">photo_camera</span>
              Capture
            </Link>
            {isDoneEnough ? (
              <Link
                to={`/tech/job/${job.id}/review`}
                className="flex-1 py-4 bg-primary hover:bg-primary/90 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] min-h-[56px]"
                aria-label="Complete and submit job"
              >
                <span className="material-symbols-outlined">rate_review</span>
                Complete
              </Link>
            ) : (
              <Link
                to={`/tech/job/${job.id}`}
                className="flex-1 py-4 bg-slate-700 hover:bg-slate-600 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] min-h-[56px]"
                aria-label="Continue working on job"
              >
                <span className="material-symbols-outlined">play_arrow</span>
                Continue
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

HeroJobCard.displayName = 'HeroJobCard';

/**
 * AssignedJobCard - Horizontal swimlane card with priority visual cues
 * Includes urgent priority pulse border
 */
const AssignedJobCard = React.memo(({
  job,
  client
}: {
  job: Job;
  client?: { id: string; name: string };
}) => {
  const isUrgent = job.priority === 'urgent';

  const formattedTime = useMemo(() => {
    const date = new Date(job.date);
    const today = new Date();

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
    }
    return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  }, [job.date]);

  return (
    <Link to={`/tech/job/${job.id}`} className="block shrink-0 snap-start">
      <div className={`w-[280px] bg-white dark:bg-slate-900 rounded-2xl p-4 transition-all active:scale-[0.98] min-h-[140px] ${
        isUrgent
          ? 'border-2 border-red-500 animate-pulse shadow-lg shadow-red-500/20'
          : 'border border-slate-200 dark:border-white/10 shadow-sm'
      }`}>
        {/* Header - priority badge */}
        {isUrgent && (
          <div className="flex items-center gap-1.5 mb-3">
            <span className="material-symbols-outlined text-sm text-red-500">priority_high</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-500">Urgent</span>
          </div>
        )}

        {/* Job info */}
        <div className="space-y-2">
          <h3 className="font-bold text-slate-900 dark:text-white text-base line-clamp-2">
            {job.title || `Job #${job.id.slice(0, 6)}`}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
            {client?.name || job.client || 'Client'}
          </p>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="material-symbols-outlined text-xs">schedule</span>
            {formattedTime}
          </div>
        </div>

        {/* Sync status */}
        {job.syncStatus && job.syncStatus !== 'synced' && (
          <div className={`mt-3 flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
            job.syncStatus === 'failed'
              ? 'bg-red-500/10 text-red-600 dark:text-red-400'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
          }`}>
            <span className={`material-symbols-outlined text-xs ${job.syncStatus === 'pending' ? 'animate-pulse' : ''}`}>
              {job.syncStatus === 'failed' ? 'sync_problem' : 'sync'}
            </span>
            {job.syncStatus === 'failed' ? 'Failed' : 'Syncing'}
          </div>
        )}

        {/* Action indicator */}
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-white/5 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">Tap to start</span>
          <span className="material-symbols-outlined text-slate-400">chevron_right</span>
        </div>
      </div>
    </Link>
  );
});

AssignedJobCard.displayName = 'AssignedJobCard';

/**
 * FinishedJobCard - Collapsed style with inset shadow
 * Visual treatment for completed work
 */
const FinishedJobCard = React.memo(({
  job,
  client
}: {
  job: Job;
  client?: { id: string; name: string };
}) => {
  const formattedTime = useMemo(() => {
    const date = new Date(job.date);
    return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  }, [job.date]);

  return (
    <Link to={`/tech/job/${job.id}`}>
      <div className="bg-slate-100/50 dark:bg-slate-900/50 rounded-xl p-4 transition-all active:scale-[0.98] min-h-[56px] shadow-inner border border-slate-200 dark:border-white/5">
        <div className="flex items-center gap-4">
          {/* Time */}
          <div className="min-w-[55px] text-right">
            <p className="text-sm font-medium text-slate-400">
              {formattedTime}
            </p>
          </div>

          {/* Status indicator line */}
          <div className="w-0.5 h-10 rounded-full bg-emerald-500" />

          {/* Job info */}
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate text-slate-500">
              {job.title || `Job #${job.id.slice(0, 6)}`}
            </p>
            <p className="text-xs text-slate-400 truncate">
              {client?.name || job.client || 'Client'}
            </p>
          </div>

          {/* Sync status */}
          {job.syncStatus && job.syncStatus !== 'synced' && (
            <span className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
              job.syncStatus === 'failed'
                ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
            }`}>
              <span className={`material-symbols-outlined text-xs ${job.syncStatus === 'pending' ? 'animate-pulse' : ''}`}>
                {job.syncStatus === 'failed' ? 'sync_problem' : 'sync'}
              </span>
              {job.syncStatus === 'failed' ? 'Failed' : 'Pending'}
            </span>
          )}

          {/* Status badge */}
          <span className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider rounded">
            <span className="material-symbols-outlined text-xs">check</span>
            Done
          </span>
        </div>
      </div>
    </Link>
  );
});

FinishedJobCard.displayName = 'FinishedJobCard';

export default TechPortal;
