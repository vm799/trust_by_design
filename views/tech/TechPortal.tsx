/**
 * TechPortal - Focus Stack Technician Dashboard
 *
 * Implements Context Thrash Prevention pattern:
 * - ONE job in focus (the active "In Progress" job)
 * - Max 3 jobs in queue (next assigned, read-only)
 * - Everything else collapsed (scroll-only)
 *
 * Core principle: Technicians execute the queue, they don't manage it.
 */

import React, { useMemo, useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, LoadingSkeleton, FocusStack, FocusJobRenderProps, QueueJobRenderProps, CollapsedJobRenderProps } from '../../components/ui';
import { useData } from '../../lib/DataContext';
import { useAuth } from '../../lib/AuthContext';
import { Job } from '../../types';
import { JobProofLogo } from '../../components/branding/jobproof-logo';
import { OfflineIndicator } from '../../components/OfflineIndicator';
import QuickJobForm from '../../components/QuickJobForm';
import { createJob } from '../../lib/db';
import { fadeInUp } from '../../lib/animations';

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

  // Focus Stack: Find the ONE focus job and count completed
  const { focusJobId, completedCount } = useMemo(() => {
    // Find the currently active job (In Progress) - this is the focus job
    const inProgressJob = allJobs.find(j => j.status === 'In Progress');

    // Completed count for history link
    const completed = allJobs.filter(j =>
      j.status === 'Complete' || j.status === 'Submitted'
    ).length;

    return {
      focusJobId: inProgressJob?.id || null,
      completedCount: completed,
    };
  }, [allJobs]);

  // Queue sorting: by scheduled time, then by last updated
  const sortQueueJobs = useCallback((jobs: Job[]) => {
    return [...jobs].sort((a, b) => {
      // Primary: Scheduled date (earliest first)
      const aDate = new Date(a.date).getTime();
      const bDate = new Date(b.date).getTime();
      if (aDate !== bDate) return aDate - bDate;

      // Secondary: Last updated (most recent first)
      return (b.lastUpdated || 0) - (a.lastUpdated || 0);
    });
  }, []);

  // Navigate to focus job
  const handleContinueFocusJob = useCallback((job: Job) => {
    navigate(`/tech/job/${job.id}`);
  }, [navigate]);

  // Render: Focus job (dominant, ~50% screen)
  const renderFocusJob = useCallback(({ job, client }: FocusJobRenderProps) => (
    <Link to={`/tech/job/${job.id}`} className="block">
      <Card className="bg-primary/5 border-primary/30 dark:bg-primary/10">
        <div className="flex items-center gap-4 py-2">
          {/* Pulsing indicator */}
          <div className="size-16 rounded-2xl bg-primary/20 flex items-center justify-center relative shrink-0">
            <span className="material-symbols-outlined text-3xl text-primary">play_arrow</span>
            <span className="absolute -top-1 -right-1 size-3 bg-primary rounded-full animate-pulse" />
          </div>

          {/* Job info */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-primary uppercase tracking-wide mb-1">
              Continue Working
            </p>
            <p className="font-bold text-slate-900 dark:text-white text-lg truncate">
              {job.title || `Job #${job.id.slice(0, 6)}`}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
              {client?.name || 'Unknown client'}
            </p>
            {/* Evidence indicator */}
            {job.photos && job.photos.length > 0 && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">check_circle</span>
                {job.photos.length} photo{job.photos.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          <span className="material-symbols-outlined text-2xl text-primary">chevron_right</span>
        </div>
      </Card>
    </Link>
  ), []);

  // Render: Queue job (compact, read-only)
  const renderQueueJob = useCallback(({ job, client, position }: QueueJobRenderProps) => {
    const hasEvidence = job.photos && job.photos.length > 0;

    return (
      <Link to={`/tech/job/${job.id}`}>
        <Card variant="interactive" padding="sm">
          <div className="flex items-center gap-3">
            {/* Position indicator */}
            <div className="size-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{position}</span>
            </div>

            {/* Evidence status bar */}
            <div className={`w-0.5 h-10 rounded-full ${hasEvidence ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-white/10'}`} />

            {/* Job info */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-900 dark:text-white truncate text-sm">
                {job.title || `Job #${job.id.slice(0, 6)}`}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {client?.name || 'Unknown client'}
              </p>
            </div>

            {/* Time */}
            <div className="text-xs text-slate-400 shrink-0">
              {new Date(job.date).toLocaleTimeString('en-AU', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        </Card>
      </Link>
    );
  }, []);

  // Render: Collapsed job (minimal, scroll-only)
  const renderCollapsedJob = useCallback(({ job, client }: CollapsedJobRenderProps) => (
    <Link
      to={`/tech/job/${job.id}`}
      className="block py-2 px-3 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50"
    >
      <span className="font-medium">{job.title || `Job #${job.id.slice(0, 6)}`}</span>
      <span className="mx-2 opacity-50">•</span>
      <span>{client?.name || 'Unknown'}</span>
    </Link>
  ), []);

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

      {/* Content - Focus Stack Pattern */}
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
            {/* Focus Stack: 1 Focus + 3 Queue + Collapsed */}
            <FocusStack
              jobs={allJobs}
              clients={clients}
              focusJobId={focusJobId}
              renderFocusJob={renderFocusJob}
              renderQueueJob={renderQueueJob}
              renderCollapsedJob={renderCollapsedJob}
              onContinueFocusJob={handleContinueFocusJob}
              maxQueueSize={3}
              sortQueue={sortQueueJobs}
              showCollapsed={true}
              queueHeader={
                <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">queue</span>
                  Next Up
                </h2>
              }
            />

            {/* HISTORY LINK - Tertiary */}
            {completedCount > 0 && (
              <motion.section
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
                className="pt-4 border-t border-slate-200 dark:border-white/5"
              >
                <Link
                  to="/tech/history"
                  className="flex items-center justify-between py-3 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors min-h-[44px]"
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
              </motion.section>
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
