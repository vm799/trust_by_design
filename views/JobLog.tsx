/**
 * JobLog.tsx - The "Proof" Gallery
 *
 * Shows all completed jobs for the technician.
 * Acts as a "Receipt" of their work.
 *
 * Features:
 * - Uses DataContext for centralized job data
 * - Derives completed jobs via useMemo
 * - Shows before/after photos, signature, and sync status
 * - Error state with retry via DataContext.refresh()
 *
 * @author Claude Code - DataContext Migration
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../lib/DataContext';
import { HandshakeService, type PausedJobContext } from '../lib/handshakeService';
import { toast } from '../lib/toast';

// ============================================================================
// TYPES
// ============================================================================

interface CompletedJob {
  id: string;
  title: string;
  client: string;
  address?: string;
  completedAt: string;
  syncStatus: 'pending' | 'synced' | 'failed';
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
  signatureUrl?: string;
  reportUrl?: string;
  archived?: boolean;
  archivedAt?: string;
}

// Local storage key for archived job IDs
const ARCHIVED_JOBS_KEY = 'jobproof_archived_jobs';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function JobLog() {
  const navigate = useNavigate();
  const { jobs: allJobs, isLoading: dataLoading, error: dataError, refresh } = useData();

  const jobs: CompletedJob[] = useMemo(() =>
    allJobs
      .filter(j => j.status === 'Complete' || j.status === 'Submitted')
      .map(j => ({
        id: j.id,
        title: j.title || `Job ${j.id}`,
        client: j.client || 'Client',
        address: j.address,
        completedAt: j.completedAt || j.date || new Date().toISOString(),
        syncStatus: (j.syncStatus || 'synced') as 'pending' | 'synced' | 'failed',
        beforePhotoUrl: j.photos?.[0]?.url,
        afterPhotoUrl: j.photos?.[1]?.url,
        signatureUrl: typeof j.signature === 'string' ? j.signature : undefined,
        reportUrl: undefined,
      }))
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()),
    [allJobs]
  );

  const isLoading = dataLoading;

  const [pausedJobs, setPausedJobs] = useState<PausedJobContext[]>([]);
  const [archivedJobIds, setArchivedJobIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'synced' | 'pending' | 'archived'>('all');

  useEffect(() => {
    loadPausedJobs();
    loadArchivedJobs();
  }, []);

  const loadArchivedJobs = () => {
    try {
      const stored = localStorage.getItem(ARCHIVED_JOBS_KEY);
      if (stored) {
        const ids = JSON.parse(stored) as string[];
        setArchivedJobIds(new Set(ids));
      }
    } catch {
      // Non-fatal: archived job IDs are UI state only
    }
  };

  const handleArchiveJob = (jobId: string) => {
    const newArchived = new Set(archivedJobIds);
    newArchived.add(jobId);
    setArchivedJobIds(newArchived);
    localStorage.setItem(ARCHIVED_JOBS_KEY, JSON.stringify([...newArchived]));
  };

  const handleUnarchiveJob = (jobId: string) => {
    const newArchived = new Set(archivedJobIds);
    newArchived.delete(jobId);
    setArchivedJobIds(newArchived);
    localStorage.setItem(ARCHIVED_JOBS_KEY, JSON.stringify([...newArchived]));
  };

  const loadPausedJobs = () => {
    const paused = HandshakeService.getPausedJobs();
    setPausedJobs(paused);
  };

  const handleResumeJob = (jobId: string) => {
    // Check if another job is currently locked
    const currentContext = HandshakeService.get();
    if (currentContext?.isLocked) {
      toast.warning('You have another job in progress. Please complete or pause it first.');
      return;
    }

    // Resume the paused job
    const resumed = HandshakeService.resumeJob(jobId);
    if (resumed) {
      // Navigate to the job
      navigate(`/run/${jobId}`);
    } else {
      toast.error('Failed to resume job. Please try again.');
    }
  };

  const formatPauseReason = (reason?: PausedJobContext['pauseReason']) => {
    switch (reason) {
      case 'emergency': return 'Emergency';
      case 'parts_unavailable': return 'Waiting for parts';
      case 'weather': return 'Weather delay';
      case 'client_unavailable': return 'Client unavailable';
      case 'other': return 'Other';
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

  const filteredJobs = jobs.filter(j => {
    const isArchived = archivedJobIds.has(j.id);

    // Archived filter shows only archived jobs
    if (filter === 'archived') return isArchived;

    // All other filters exclude archived jobs
    if (isArchived) return false;

    if (filter === 'all') return true;
    return j.syncStatus === filter;
  });

  const archivedCount = jobs.filter(j => archivedJobIds.has(j.id)).length;

  if (dataError) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <span className="material-symbols-outlined text-4xl text-red-400">error</span>
          <p className="text-red-400">{dataError}</p>
          <button
            onClick={refresh}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium min-h-[44px]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-2xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Job Log</h1>
            <p className="text-slate-400 text-sm">Your completed work</p>
          </div>
          <a
            href="/#/create-job"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium"
          >
            New Job
          </a>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {(['all', 'synced', 'pending', 'archived'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                filter === f
                  ? f === 'archived' ? 'bg-slate-600 text-white' : 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {f === 'all' ? 'All' : f === 'synced' ? 'Synced ✓' : f === 'pending' ? 'Pending' : (
                <>
                  <span className="material-symbols-outlined text-sm">archive</span>
                  Archived
                  {archivedCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-slate-700 text-[10px] rounded-full">
                      {archivedCount}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>

        {/* Paused Jobs Section - High Priority */}
        {pausedJobs.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-amber-400">pause_circle</span>
              <h2 className="text-lg font-bold text-amber-400">Paused Jobs</h2>
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs font-bold rounded-full">
                {pausedJobs.length}
              </span>
            </div>

            <div className="space-y-3">
              {pausedJobs.map(pausedJob => (
                <div
                  key={pausedJob.jobId}
                  className="bg-amber-500/10 border-2 border-amber-500/30 rounded-xl p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-white">Job #{pausedJob.jobId.slice(0, 8)}</h3>
                      <p className="text-sm text-amber-400/80">
                        {formatPauseReason(pausedJob.pauseReason)}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Paused {formatTimeSince(pausedJob.pausedAt)}
                      </p>
                    </div>
                    <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs font-bold rounded">
                      ⏸ PAUSED
                    </span>
                  </div>

                  {/* Resume Button */}
                  <button
                    onClick={() => handleResumeJob(pausedJob.jobId)}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                  >
                    <span className="material-symbols-outlined">play_arrow</span>
                    Resume This Job
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="size-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
            <p className="text-slate-400 mt-4">Loading jobs...</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredJobs.length === 0 && (
          <div className="text-center py-12 bg-slate-800 rounded-xl border border-slate-600">
            <span className="text-4xl">📋</span>
            <h3 className="text-lg font-medium text-white mt-4">No Jobs Yet</h3>
            <p className="text-slate-400 mt-2">Complete your first job to see it here</p>
            <a
              href="/#/create-job"
              className="inline-block mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium"
            >
              Create a Job
            </a>
          </div>
        )}

        {/* Job List */}
        <div className="space-y-4">
          {filteredJobs.map(job => (
            <div
              key={job.id}
              className="bg-slate-800 rounded-xl border border-slate-600 overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 border-b border-slate-600">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-white">{job.title}</h3>
                    <p className="text-sm text-slate-400">{job.client}</p>
                    {job.address && (
                      <p className="text-xs text-slate-400 mt-1">{job.address}</p>
                    )}
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    job.syncStatus === 'synced'
                      ? 'bg-green-600/20 text-green-400'
                      : job.syncStatus === 'failed'
                      ? 'bg-red-600/20 text-red-400'
                      : 'bg-yellow-600/20 text-yellow-400'
                  }`}>
                    {job.syncStatus === 'synced' ? '✓ Synced' :
                     job.syncStatus === 'failed' ? '✗ Failed' : '⏳ Pending'}
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Completed: {formatDate(job.completedAt)}
                </p>
              </div>

              {/* Photos */}
              {(job.beforePhotoUrl || job.afterPhotoUrl) && (
                <div className="grid grid-cols-2 gap-px bg-slate-700">
                  {job.beforePhotoUrl && (
                    <div className="relative">
                      <img
                        src={job.beforePhotoUrl}
                        alt="Before"
                        className="w-full h-32 object-cover"
                      />
                      <span className="absolute bottom-1 left-1 px-2 py-0.5 bg-black/70 rounded text-xs text-white">
                        Before
                      </span>
                    </div>
                  )}
                  {job.afterPhotoUrl && (
                    <div className="relative">
                      <img
                        src={job.afterPhotoUrl}
                        alt="After"
                        className="w-full h-32 object-cover"
                      />
                      <span className="absolute bottom-1 left-1 px-2 py-0.5 bg-black/70 rounded text-xs text-white">
                        After
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="p-3 bg-slate-900 flex gap-2">
                <a
                  href={`/#/run/${job.id}`}
                  className="flex-1 py-2 text-center bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
                >
                  View Details
                </a>
                {job.reportUrl && (
                  <a
                    href={job.reportUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 text-center bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm"
                  >
                    📄 View Report
                  </a>
                )}
                {/* Archive/Unarchive Button */}
                {archivedJobIds.has(job.id) ? (
                  <button
                    onClick={() => handleUnarchiveJob(job.id)}
                    className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">unarchive</span>
                    Restore
                  </button>
                ) : (
                  <button
                    onClick={() => handleArchiveJob(job.id)}
                    className="px-3 py-2 bg-slate-700/50 hover:bg-slate-600 text-slate-400 hover:text-white rounded-lg text-sm flex items-center gap-1 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">archive</span>
                    Archive
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Action Links */}
        <div className="mt-8 text-center space-y-3">
          <a
            href="/#/track-lookup"
            className="block px-6 py-3 bg-primary hover:bg-primary/90 text-white font-medium rounded-xl transition-colors"
          >
            <span className="material-symbols-outlined align-middle mr-2">add_circle</span>
            Start New Job
          </a>
          <a
            href="/#/contractor"
            className="text-slate-400 hover:text-white text-sm transition-colors"
          >
            ← Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
