/**
 * TechPortal - Action-First Technician Dashboard
 *
 * Redesigned based on UX Architecture v2.0
 * Single question: "What job do I continue right now?"
 *
 * NO tabs. NO categorization. ONLY action.
 */

import React, { useMemo, useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, EmptyState, LoadingSkeleton } from '../../components/ui';
import { useData } from '../../lib/DataContext';
import { useAuth } from '../../lib/AuthContext';
import { Job } from '../../types';
import { JobProofLogo } from '../../components/branding/jobproof-logo';
import { OfflineIndicator } from '../../components/OfflineIndicator';
import QuickJobForm from '../../components/QuickJobForm';
import { createJob } from '../../lib/db';

const TechPortal: React.FC = () => {
  const navigate = useNavigate();
  const { userId, session } = useAuth();

  // Use DataContext for centralized state management (CLAUDE.md mandate)
  const { jobs: allJobsData, clients: clientsData, isLoading, addJob } = useData();

  const [showQuickJob, setShowQuickJob] = useState(false);

  // Get user info for QuickJobForm
  const techId = userId || 'tech-local';
  const techName = session?.user?.user_metadata?.full_name || 'Technician';
  const techEmail = session?.user?.email;
  const workspaceId = 'local-workspace';

  // Filter jobs assigned to this technician
  const allJobs = useMemo(() => {
    return allJobsData.filter(j =>
      j.technicianId === userId ||
      j.techId === userId ||
      j.techMetadata?.createdByTechId === userId ||
      // Fallback: show all jobs with a technician assigned (demo mode)
      j.technicianId
    );
  }, [allJobsData, userId]);

  const clients = clientsData;

  // Sync status
  const syncPending = useMemo(() => {
    return allJobs.filter(j => j.syncStatus === 'pending').length;
  }, [allJobs]);

  // Handle job creation
  const handleJobCreated = useCallback(async (job: Job) => {
    await createJob(job, job.workspaceId || workspaceId);
    addJob(job);
    setShowQuickJob(false);
    navigate(`/tech/job/${job.id}`);
  }, [navigate, workspaceId, addJob]);

  // Categorize jobs - prioritize active job
  const { activeJob, todayJobs, upcomingJobs, completedCount } = useMemo(() => {
    const today = new Date().toDateString();

    // Find the currently active job (In Progress)
    const inProgressJob = allJobs.find(j => j.status === 'In Progress');

    // Active jobs (not complete)
    const active = allJobs.filter(j => j.status !== 'Complete' && j.status !== 'Submitted');

    // Today's jobs (excluding active job if exists)
    const todayActive = active
      .filter(j => new Date(j.date).toDateString() === today)
      .filter(j => j.id !== inProgressJob?.id);

    // Upcoming jobs
    const upcoming = active
      .filter(j => new Date(j.date).toDateString() !== today)
      .filter(j => j.id !== inProgressJob?.id)
      .slice(0, 3);

    // Completed count
    const completed = allJobs.filter(j => j.status === 'Complete' || j.status === 'Submitted').length;

    return {
      activeJob: inProgressJob,
      todayJobs: todayActive,
      upcomingJobs: upcoming,
      completedCount: completed,
    };
  }, [allJobs]);

  // Show QuickJobForm modal
  if (showQuickJob) {
    return (
      <QuickJobForm
        techId={techId}
        techName={techName}
        techEmail={techEmail}
        workspaceId={workspaceId}
        onJobCreated={handleJobCreated}
        onCancel={() => setShowQuickJob(false)}
        existingClients={clients.map(c => ({ id: c.id, name: c.name, address: c.address || '' }))}
      />
    );
  }

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
            {/* Settings/Profile link - secondary */}
            <Link
              to="/tech/profile"
              className="size-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-sm text-slate-600 dark:text-slate-400">person</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-6 pb-32">
        {isLoading ? (
          <LoadingSkeleton variant="card" count={3} />
        ) : allJobs.length === 0 ? (
          /* Empty state - no jobs */
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="size-20 rounded-[2rem] bg-primary/10 flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-4xl text-primary">add_task</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Ready to work?</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-6 max-w-xs">
              Create your first job to start capturing evidence.
            </p>
            <button
              onClick={() => setShowQuickJob(true)}
              className="px-6 py-4 bg-primary rounded-2xl font-bold text-white text-sm shadow-lg shadow-primary/20 flex items-center gap-3 transition-all active:scale-95 min-h-[56px]"
            >
              <span className="material-symbols-outlined">add</span>
              Create First Job
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* PRIMARY ACTION: Continue Current Job (if active) */}
            {activeJob && (
              <section>
                <Link to={`/tech/job/${activeJob.id}`} className="block">
                  <Card className="bg-primary/5 border-primary/30 dark:bg-primary/10">
                    <div className="flex items-center gap-4 py-2">
                      {/* Pulsing indicator */}
                      <div className="size-14 rounded-2xl bg-primary/20 flex items-center justify-center relative">
                        <span className="material-symbols-outlined text-2xl text-primary">play_arrow</span>
                        <span className="absolute -top-1 -right-1 size-3 bg-primary rounded-full animate-pulse" />
                      </div>

                      {/* Job info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-primary uppercase tracking-wide mb-1">
                          Continue Working
                        </p>
                        <p className="font-bold text-slate-900 dark:text-white text-lg truncate">
                          {activeJob.title || `Job #${activeJob.id.slice(0, 6)}`}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                          {clients.find(c => c.id === activeJob.clientId)?.name || 'Unknown client'}
                        </p>
                      </div>

                      <span className="material-symbols-outlined text-2xl text-primary">chevron_right</span>
                    </div>
                  </Card>
                </Link>
              </section>
            )}

            {/* TODAY'S JOBS */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">today</span>
                  Today
                  {todayJobs.length > 0 && (
                    <span className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full">
                      {todayJobs.length}
                    </span>
                  )}
                </h2>
              </div>

              {todayJobs.length === 0 && !activeJob ? (
                <Card className="text-center py-6">
                  <span className="material-symbols-outlined text-3xl text-slate-400 dark:text-slate-600 mb-2">event_busy</span>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">No jobs scheduled today</p>
                </Card>
              ) : todayJobs.length === 0 && activeJob ? (
                <Card className="text-center py-4">
                  <p className="text-slate-500 text-sm">Only your active job is scheduled for today</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {todayJobs.map(job => {
                    const client = clients.find(c => c.id === job.clientId);
                    const hasEvidence = job.photos && job.photos.length > 0;

                    return (
                      <Link key={job.id} to={`/tech/job/${job.id}`}>
                        <Card variant="interactive">
                          <div className="flex items-center gap-4">
                            {/* Time */}
                            <div className="text-center min-w-[50px]">
                              <p className="text-lg font-bold text-slate-900 dark:text-white">
                                {new Date(job.date).toLocaleTimeString('en-AU', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>

                            {/* Divider */}
                            <div className={`w-0.5 h-12 rounded-full ${hasEvidence ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-white/10'}`} />

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-900 dark:text-white truncate">
                                {job.title || `Job #${job.id.slice(0, 6)}`}
                              </p>
                              <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                                {client?.name || 'Unknown client'}
                              </p>
                              {/* Evidence status indicator */}
                              <div className="flex items-center gap-2 mt-1">
                                {hasEvidence ? (
                                  <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-xs">check_circle</span>
                                    {job.photos?.length} photo{job.photos?.length !== 1 ? 's' : ''}
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-500 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-xs">photo_camera</span>
                                    No evidence yet
                                  </span>
                                )}
                              </div>
                            </div>

                            <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                          </div>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            {/* UPCOMING JOBS - Collapsed by default */}
            {upcomingJobs.length > 0 && (
              <section>
                <details className="group">
                  <summary className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900 dark:hover:text-slate-300 py-2">
                    <span className="material-symbols-outlined text-sm transition-transform group-open:rotate-90">chevron_right</span>
                    <span className="material-symbols-outlined text-sm">event</span>
                    Upcoming ({upcomingJobs.length})
                  </summary>

                  <div className="space-y-3 pt-3">
                    {upcomingJobs.map(job => {
                      const client = clients.find(c => c.id === job.clientId);

                      return (
                        <Link key={job.id} to={`/tech/job/${job.id}`}>
                          <Card variant="interactive">
                            <div className="flex items-center gap-4">
                              {/* Date */}
                              <div className="text-center min-w-[50px]">
                                <p className="text-sm font-bold text-slate-900 dark:text-white">
                                  {new Date(job.date).toLocaleDateString('en-AU', {
                                    day: 'numeric',
                                  })}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {new Date(job.date).toLocaleDateString('en-AU', {
                                    month: 'short',
                                  })}
                                </p>
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-slate-900 dark:text-white truncate">
                                  {job.title || `Job #${job.id.slice(0, 6)}`}
                                </p>
                                <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                                  {client?.name || 'Unknown client'}
                                </p>
                              </div>

                              <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                            </div>
                          </Card>
                        </Link>
                      );
                    })}
                  </div>
                </details>
              </section>
            )}

            {/* HISTORY LINK - Tertiary */}
            {completedCount > 0 && (
              <section className="pt-4 border-t border-slate-200 dark:border-white/5">
                <Link
                  to="/tech/history"
                  className="flex items-center justify-between py-3 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-500">history</span>
                    <span className="text-sm">Completed Jobs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{completedCount}</span>
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </div>
                </Link>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Floating Action Button - Start New Job */}
      <div className="fixed bottom-6 left-4 right-4 z-40">
        <button
          onClick={() => setShowQuickJob(true)}
          className="w-full py-4 bg-primary rounded-2xl shadow-lg shadow-primary/30 flex items-center justify-center gap-3 text-white font-bold text-sm transition-all active:scale-98 min-h-[56px]"
        >
          <span className="material-symbols-outlined">add</span>
          Start New Job
        </button>
      </div>
    </div>
  );
};

export default TechPortal;
