/**
 * JobLog.tsx - The "Proof" Gallery
 *
 * Shows all completed jobs for the technician.
 * Acts as a "Receipt" of their work.
 *
 * Features:
 * - Fetches completed jobs from Supabase
 * - Falls back to IndexedDB for offline viewing
 * - Shows before/after photos, signature, and sync status
 *
 * @author Claude Code - End-to-End Recovery
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Dexie, { type Table } from 'dexie';
import { HandshakeService, type PausedJobContext } from '../lib/handshakeService';

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
// DATABASE
// ============================================================================

class LogDatabase extends Dexie {
  jobs!: Table<CompletedJob, string>;

  constructor() {
    super('BunkerRunDB');
    this.version(1).stores({
      jobs: 'id, syncStatus, lastUpdated'
    });
  }
}

const logDb = new LogDatabase();

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function JobLog() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<CompletedJob[]>([]);
  const [pausedJobs, setPausedJobs] = useState<PausedJobContext[]>([]);
  const [archivedJobIds, setArchivedJobIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'synced' | 'pending' | 'archived'>('all');

  useEffect(() => {
    loadJobs();
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
    } catch (error) {
      console.error('[JobLog] Failed to load archived jobs:', error);
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
      alert('You have another job in progress. Please complete or pause it first.');
      return;
    }

    // Resume the paused job
    const resumed = HandshakeService.resumeJob(jobId);
    if (resumed) {
      // Navigate to the job
      navigate(`/run/${jobId}`);
    } else {
      alert('Failed to resume job. Please try again.');
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

  const loadJobs = async () => {
    setIsLoading(true);

    try {
      // Get local jobs from IndexedDB first
      const localJobs = await logDb.jobs.toArray();
      const localCompleted = localJobs.filter(j => j.completedAt);

      // Try to fetch from Supabase
      let cloudJobs: CompletedJob[] = [];
      if (navigator.onLine && SUPABASE_URL && SUPABASE_ANON_KEY) {
        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/bunker_jobs?status=eq.Complete&order=completed_at.desc&limit=50`,
          {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          cloudJobs = data.map((j: Record<string, unknown>) => ({
            id: j.id as string,
            title: j.title as string || `Job ${j.id}`,
            client: j.client as string || 'Client',
            address: j.address as string,
            completedAt: j.completed_at as string || j.last_updated as string,
            // Jobs from Supabase ARE synced - they exist in the cloud
            syncStatus: 'synced' as const,
            beforePhotoUrl: j.before_photo_data as string,
            afterPhotoUrl: j.after_photo_data as string,
            signatureUrl: j.signature_data as string,
            reportUrl: j.report_url as string,
          }));
        }
      }

      // Merge: Cloud jobs (synced) + Local-only jobs (pending)
      const cloudJobIds = new Set(cloudJobs.map(j => j.id));

      // Local jobs that are NOT in cloud are pending sync
      const pendingJobs: CompletedJob[] = localCompleted
        .filter(j => !cloudJobIds.has(j.id))
        .map(j => ({ ...j, syncStatus: 'pending' as const }));

      // Combine: synced cloud jobs + pending local jobs
      const allJobs = [...cloudJobs, ...pendingJobs];

      // Sort by completedAt descending
      allJobs.sort((a, b) => {
        const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return dateB - dateA;
      });

      setJobs(allJobs);
    } catch (error) {
      console.error('[JobLog] Load error:', error);
      // On error, just show local jobs as pending
      try {
        const localJobs = await logDb.jobs.toArray();
        const completed = localJobs.filter(j => j.completedAt).map(j => ({
          ...j,
          syncStatus: 'pending' as const
        }));
        setJobs(completed);
      } catch {
        setJobs([]);
      }
    }

    setIsLoading(false);
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
            + New Job
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
                      <p className="text-xs text-slate-500 mt-1">
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
          <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700">
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
              className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 border-b border-slate-700">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-white">{job.title}</h3>
                    <p className="text-sm text-slate-400">{job.client}</p>
                    {job.address && (
                      <p className="text-xs text-slate-500 mt-1">{job.address}</p>
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
                <p className="text-xs text-slate-500 mt-2">
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
              <div className="p-3 bg-slate-900/50 flex gap-2">
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
