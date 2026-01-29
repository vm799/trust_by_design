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
import Dexie, { type Table } from 'dexie';

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
}

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
  const [jobs, setJobs] = useState<CompletedJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'synced' | 'pending'>('all');

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    setIsLoading(true);

    try {
      // Try to fetch from Supabase first
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
          const mappedJobs: CompletedJob[] = data.map((j: Record<string, unknown>) => ({
            id: j.id as string,
            title: j.title as string || `Job ${j.id}`,
            client: j.client as string || 'Client',
            address: j.address as string,
            completedAt: j.completed_at as string || j.last_updated as string,
            // FIX: Read actual sync_status from API instead of hardcoding 'synced'
            syncStatus: (j.sync_status as 'pending' | 'synced' | 'failed') || 'synced',
            beforePhotoUrl: j.before_photo_data as string,
            afterPhotoUrl: j.after_photo_data as string,
            signatureUrl: j.signature_data as string,
            reportUrl: j.report_url as string,
          }));
          setJobs(mappedJobs);
          setIsLoading(false);
          return;
        }
      }

      // Fallback to IndexedDB
      const localJobs = await logDb.jobs.toArray();
      const completed = localJobs.filter(j => j.completedAt);
      setJobs(completed);
    } catch (error) {
      console.error('[JobLog] Load error:', error);
    }

    setIsLoading(false);
  };

  const filteredJobs = jobs.filter(j => {
    if (filter === 'all') return true;
    return j.syncStatus === filter;
  });

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
        <div className="flex gap-2 mb-6">
          {(['all', 'synced', 'pending'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {f === 'all' ? 'All' : f === 'synced' ? 'Synced ✓' : 'Pending'}
            </button>
          ))}
        </div>

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
