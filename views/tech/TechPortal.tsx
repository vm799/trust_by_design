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
 */

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { LoadingSkeleton } from '../../components/ui';
import { useData } from '../../lib/DataContext';
import { useAuth } from '../../lib/AuthContext';
import { Job } from '../../types';
import { JobProofLogo } from '../../components/branding/jobproof-logo';
import { OfflineIndicator } from '../../components/OfflineIndicator';

const TechPortal: React.FC = () => {
  const { userId, session } = useAuth();
  const { jobs: allJobsData, clients: clientsData, isLoading } = useData();

  // Get tech name for display
  const techName = session?.user?.user_metadata?.full_name || 'Technician';

  // Filter jobs assigned to this technician ONLY
  const myJobs = useMemo(() => {
    return allJobsData.filter(j =>
      j.technicianId === userId ||
      j.techId === userId ||
      j.techMetadata?.createdByTechId === userId
    );
  }, [allJobsData, userId]);

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
      <main className="flex-1 px-4 py-6 pb-20 max-w-2xl mx-auto w-full">
        {isLoading ? (
          <LoadingSkeleton variant="card" count={3} />
        ) : myJobs.length === 0 ? (
          /* Empty state - no assigned jobs */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="size-20 rounded-[2rem] bg-slate-100 dark:bg-slate-900 flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-4xl text-slate-400">inbox</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Jobs Assigned</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm max-w-xs">
              You have no jobs assigned. Your manager will dispatch jobs when ready.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Greeting */}
            <div className="mb-6">
              <p className="text-sm text-slate-500 dark:text-slate-400">Welcome back,</p>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">{techName}</h1>
            </div>

            {/* STARTED JOB - The one job currently in progress (if any) */}
            {startedJob && (
              <section>
                <Link to={`/tech/job/${startedJob.id}`} className="block">
                  <div className="bg-primary/5 dark:bg-primary/10 border-2 border-primary rounded-2xl p-5 transition-all active:scale-[0.98]">
                    <div className="flex items-center gap-4">
                      {/* Pulsing indicator */}
                      <div className="size-14 rounded-2xl bg-primary/20 flex items-center justify-center relative flex-shrink-0">
                        <span className="material-symbols-outlined text-2xl text-primary">play_arrow</span>
                        <span className="absolute -top-1 -right-1 size-3 bg-primary rounded-full animate-pulse" />
                      </div>

                      {/* Job info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="px-2 py-0.5 bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider rounded">
                            Started
                          </span>
                          {isDoneEnough(startedJob) && (
                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider rounded flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">check</span>
                              Ready
                            </span>
                          )}
                          {/* P0-6 FIX: Show sync status on started job */}
                          {startedJob.syncStatus && startedJob.syncStatus !== 'synced' && (
                            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded flex items-center gap-1 ${
                              startedJob.syncStatus === 'failed'
                                ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                                : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                            }`}>
                              <span className={`material-symbols-outlined text-xs ${startedJob.syncStatus === 'pending' ? 'animate-pulse' : ''}`}>
                                {startedJob.syncStatus === 'failed' ? 'sync_problem' : 'sync'}
                              </span>
                              {startedJob.syncStatus === 'failed' ? 'Sync Failed' : 'Syncing'}
                            </span>
                          )}
                        </div>
                        <p className="font-bold text-slate-900 dark:text-white text-lg truncate">
                          {startedJob.title || `Job #${startedJob.id.slice(0, 6)}`}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                          {clientsData.find(c => c.id === startedJob.clientId)?.name || startedJob.client || 'Client'}
                        </p>
                      </div>

                      <span className="material-symbols-outlined text-2xl text-primary">chevron_right</span>
                    </div>

                    {/* Progress indicators */}
                    <div className="flex items-center gap-4 mt-4 pt-4 border-t border-primary/10">
                      <div className="flex items-center gap-1.5">
                        <span className={`material-symbols-outlined text-sm ${startedJob.photos.length > 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                          {startedJob.photos.length > 0 ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          {startedJob.photos.length} photo{startedJob.photos.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`material-symbols-outlined text-sm ${startedJob.signature ? 'text-emerald-500' : 'text-slate-400'}`}>
                          {startedJob.signature ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          {startedJob.signature ? 'Signed' : 'Signature needed'}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </section>
            )}

            {/* ASSIGNED JOBS - Jobs waiting to be started */}
            {assignedJobs.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
                  <span className="material-symbols-outlined text-sm">assignment</span>
                  Assigned
                  <span className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded text-[10px]">
                    {assignedJobs.length}
                  </span>
                </h2>
                <div className="space-y-2">
                  {assignedJobs.map(job => (
                    <TechJobCard key={job.id} job={job} clients={clientsData} status="assigned" />
                  ))}
                </div>
              </section>
            )}

            {/* FINISHED - Completed jobs (collapsed if many) */}
            {finishedJobs.length > 0 && (
              <section className="pt-4 border-t border-slate-200 dark:border-white/5">
                <details className="group" open={finishedJobs.length <= 3}>
                  <summary className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 cursor-pointer list-none">
                    <span className="material-symbols-outlined text-sm transition-transform group-open:rotate-90">chevron_right</span>
                    <span className="material-symbols-outlined text-sm text-emerald-500">check_circle</span>
                    Finished
                    <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded text-[10px]">
                      {finishedJobs.length}
                    </span>
                  </summary>
                  <div className="space-y-2">
                    {finishedJobs.map(job => (
                      <TechJobCard key={job.id} job={job} clients={clientsData} status="finished" />
                    ))}
                  </div>
                </details>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

/**
 * TechJobCard - Simple job card for technician view
 * Clear status labels, no management actions
 */
const TechJobCard = React.memo(({
  job,
  clients,
  status
}: {
  job: Job;
  clients: { id: string; name: string }[];
  status: 'assigned' | 'finished';
}) => {
  const client = clients.find(c => c.id === job.clientId);

  const formattedTime = useMemo(() => {
    const date = new Date(job.date);
    const today = new Date();

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
  }, [job.date]);

  return (
    <Link to={`/tech/job/${job.id}`}>
      <div className={`rounded-xl p-4 transition-all active:scale-[0.98] min-h-[56px] ${
        status === 'finished'
          ? 'bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/5'
          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 hover:border-primary/30 shadow-sm'
      }`}>
        <div className="flex items-center gap-4">
          {/* Time */}
          <div className="min-w-[55px] text-right">
            <p className={`text-sm font-medium ${status === 'finished' ? 'text-slate-400' : 'text-slate-900 dark:text-white'}`}>
              {formattedTime}
            </p>
          </div>

          {/* Status indicator line */}
          <div className={`w-0.5 h-10 rounded-full ${
            status === 'finished' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
          }`} />

          {/* Job info */}
          <div className="flex-1 min-w-0">
            <p className={`font-medium truncate ${status === 'finished' ? 'text-slate-500' : 'text-slate-900 dark:text-white'}`}>
              {job.title || `Job #${job.id.slice(0, 6)}`}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {client?.name || job.client || 'Client'}
            </p>
          </div>

          {/* P0-6 FIX: Per-job sync status indicator */}
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
          {status === 'finished' ? (
            <span className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider rounded">
              <span className="material-symbols-outlined text-xs">check</span>
              Done
            </span>
          ) : (
            <span className="material-symbols-outlined text-slate-400">chevron_right</span>
          )}
        </div>
      </div>
    </Link>
  );
});

TechJobCard.displayName = 'TechJobCard';

export default TechPortal;
