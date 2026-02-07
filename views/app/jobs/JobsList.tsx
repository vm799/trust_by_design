/**
 * JobsList - Filterable Jobs List Page
 *
 * Displays all jobs in a filterable list/table with URL query param support.
 * Matches AdminDashboard styling (slate-950 bg, rounded cards).
 *
 * Features:
 * - Filter tabs: All | Active | Awaiting Seal | Sealed | Sync Issues
 * - URL query params for filtering (?filter=active, ?filter=sealed, etc.)
 * - Search by title/client name
 * - Mobile-responsive: cards on mobile, table on desktop
 * - Each row navigates to /admin/report/${job.id}
 */

import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../../../components/AppLayout';
import EmptyState from '../../../components/EmptyState';
import { Job, UserProfile } from '../../../types';
import { ROUTES } from '../../../lib/routes';
import {
  JOB_STATUS,
  SYNC_STATUS,
  isSealedJobStatus,
} from '../../../lib/constants';

type FilterType = 'all' | 'active' | 'awaiting_seal' | 'sealed' | 'sync_issues';

interface FilterTab {
  value: FilterType;
  label: string;
  icon: string;
  color: string;
}

const filterTabs: FilterTab[] = [
  { value: 'all', label: 'All', icon: 'list', color: 'text-slate-300' },
  { value: 'active', label: 'Active', icon: 'send', color: 'text-primary' },
  { value: 'awaiting_seal', label: 'Awaiting Seal', icon: 'signature', color: 'text-warning' },
  { value: 'sealed', label: 'Sealed', icon: 'verified', color: 'text-success' },
  { value: 'sync_issues', label: 'Sync Issues', icon: 'sync_problem', color: 'text-danger' },
];

interface JobsListProps {
  jobs: Job[];
  user?: UserProfile | null;
}

/**
 * Get lifecycle stage for a job (same logic as AdminDashboard)
 */
const getJobLifecycle = (job: Job) => {
  // VERIFIED: Submitted status (already sealed and verified)
  if (job.status === JOB_STATUS.SUBMITTED) {
    return {
      stage: 'verified',
      label: 'Verified',
      icon: 'verified',
      color: 'text-success',
      bgColor: 'bg-success/10',
      borderColor: 'border-success/20',
    };
  }

  // SEALED: Has sealedAt timestamp
  if (job.sealedAt || job.isSealed) {
    return {
      stage: 'sealed',
      label: 'Sealed',
      icon: 'lock',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      borderColor: 'border-primary/20',
    };
  }

  // AWAITING SEAL: Has evidence and signature, ready to seal
  if (job.photos.length > 0 && job.signature) {
    return {
      stage: 'awaiting_seal',
      label: 'Awaiting Seal',
      icon: 'signature',
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      borderColor: 'border-warning/20',
    };
  }

  // CAPTURE: In progress with photos
  if (job.status === JOB_STATUS.IN_PROGRESS && job.photos.length > 0) {
    return {
      stage: 'capture',
      label: 'Capturing',
      icon: 'photo_camera',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      borderColor: 'border-primary/20',
    };
  }

  // DISPATCHED: Created but not yet started or no evidence
  return {
    stage: 'dispatched',
    label: 'Dispatched',
    icon: 'send',
    color: 'text-slate-400',
    bgColor: 'bg-slate-800',
    borderColor: 'border-slate-700',
  };
};

/**
 * Get sync status display info
 */
const getSyncStatus = (job: Job) => {
  if (job.syncStatus === SYNC_STATUS.FAILED) {
    return {
      label: 'Sync Failed',
      icon: 'sync_problem',
      color: 'text-danger',
      bgColor: 'bg-danger/10',
      borderColor: 'border-danger/20',
    };
  }

  if (job.syncStatus === SYNC_STATUS.PENDING || job.syncStatus === SYNC_STATUS.SYNCING) {
    return {
      label: 'Syncing',
      icon: 'sync',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      borderColor: 'border-primary/20',
    };
  }

  return {
    label: 'Synced',
    icon: 'cloud_done',
    color: 'text-success',
    bgColor: 'bg-success/10',
    borderColor: 'border-success/20',
  };
};

const JobsList: React.FC<JobsListProps> = ({ jobs, user }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');

  // Get filter from URL params
  const currentFilter = (searchParams.get('filter') as FilterType) || 'all';

  // Update URL when filter changes
  const setFilter = (filter: FilterType) => {
    if (filter === 'all') {
      searchParams.delete('filter');
    } else {
      searchParams.set('filter', filter);
    }
    setSearchParams(searchParams);
  };

  // Computed job lists for counting
  const activeJobs = useMemo(() => jobs.filter(j => j.status !== JOB_STATUS.SUBMITTED), [jobs]);
  const sealedJobs = useMemo(() => jobs.filter(j => j.status === JOB_STATUS.SUBMITTED || j.sealedAt || j.isSealed), [jobs]);
  // FIXED: Awaiting seal = has evidence AND signature, ready to be sealed (not missing signature)
  const awaitingSealJobs = useMemo(() => activeJobs.filter(j => j.photos.length > 0 && j.signature && !j.sealedAt && !j.isSealed), [activeJobs]);
  const syncIssuesJobs = useMemo(() => jobs.filter(j => j.syncStatus === SYNC_STATUS.FAILED), [jobs]);

  // Get counts for each filter
  const filterCounts = useMemo(() => ({
    all: jobs.length,
    active: activeJobs.length,
    awaiting_seal: awaitingSealJobs.length,
    sealed: sealedJobs.length,
    sync_issues: syncIssuesJobs.length,
  }), [jobs, activeJobs, awaitingSealJobs, sealedJobs, syncIssuesJobs]);

  // Filter jobs based on current filter and search
  const filteredJobs = useMemo(() => {
    let result = [...jobs];

    // Apply filter
    switch (currentFilter) {
      case 'active':
        result = result.filter(j => j.status !== JOB_STATUS.SUBMITTED);
        break;
      case 'awaiting_seal':
        // FIXED: Awaiting seal = has evidence AND signature, ready to be sealed
        result = result.filter(j => j.photos.length > 0 && j.signature && !j.sealedAt && !j.isSealed);
        break;
      case 'sealed':
        result = result.filter(j => j.status === JOB_STATUS.SUBMITTED || j.sealedAt || j.isSealed);
        break;
      case 'sync_issues':
        result = result.filter(j => j.syncStatus === SYNC_STATUS.FAILED);
        break;
      default:
        // 'all' - no filter
        break;
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(job =>
        job.title?.toLowerCase().includes(query) ||
        job.client?.toLowerCase().includes(query) ||
        job.technician?.toLowerCase().includes(query) ||
        job.address?.toLowerCase().includes(query) ||
        job.id.toLowerCase().includes(query)
      );
    }

    // Sort by date (newest first)
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [jobs, currentFilter, searchQuery]);

  return (
    <Layout user={user}>
      <div className="space-y-6 pb-20">
        {/* Header */}
        <div className="lg:sticky lg:top-0 lg:z-10 lg:bg-slate-950/80 lg:backdrop-blur-sm lg:pb-4 lg:-mt-2 lg:pt-2">
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate(ROUTES.DASHBOARD)}
                  className="size-10 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all"
                >
                  <span className="material-symbols-outlined text-lg">arrow_back</span>
                </button>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tighter uppercase">Jobs</h2>
                  <p className="text-slate-400 text-sm">{filteredJobs.length} of {jobs.length} jobs</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate('/admin/create')}
              className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-primary text-white font-black rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-primary/20 hover:scale-105 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined font-black">add</span>
              New Job
            </button>
          </header>
        </div>

        {/* Filter Tabs */}
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-2">
          <div className="flex flex-wrap gap-2">
            {filterTabs.map(tab => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                className={`
                  flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wider transition-all
                  ${currentFilter === tab.value
                    ? 'bg-slate-800 text-white border border-white/10'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}
                `}
              >
                <span className={`material-symbols-outlined text-sm ${currentFilter === tab.value ? tab.color : ''}`}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
                <span className={`
                  ml-1 px-2 py-0.5 rounded-md text-[10px] font-black
                  ${currentFilter === tab.value ? 'bg-white/10 text-white' : 'bg-slate-800 text-slate-500'}
                `}>
                  {filterCounts[tab.value]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-xl">
            search
          </span>
          <input
            type="text"
            placeholder="Search by job title, client, technician, or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-slate-900 border border-white/5 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-primary/50 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          )}
        </div>

        {/* Empty State */}
        {filteredJobs.length === 0 ? (
          <div className="bg-slate-900 border border-white/5 rounded-2xl">
            <EmptyState
              icon={searchQuery ? 'search_off' : 'inbox'}
              title={searchQuery ? 'No Jobs Found' : 'No Jobs'}
              description={
                searchQuery
                  ? 'Try adjusting your search or filter criteria.'
                  : currentFilter !== 'all'
                    ? `No jobs match the "${filterTabs.find(t => t.value === currentFilter)?.label}" filter.`
                    : 'Create your first job to get started.'
              }
              actionLabel={!searchQuery && currentFilter === 'all' ? 'Create Job' : undefined}
              actionLink={!searchQuery && currentFilter === 'all' ? '/admin/create' : undefined}
            />
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="lg:hidden space-y-3">
              {filteredJobs.map(job => {
                const lifecycle = getJobLifecycle(job);
                getSyncStatus(job);

                return (
                  <button
                    key={job.id}
                    onClick={() => navigate(`/admin/report/${job.id}`)}
                    className="w-full bg-slate-900 border border-white/5 hover:border-white/10 rounded-2xl p-4 text-left transition-all group"
                  >
                    <div className="flex items-start gap-4">
                      {/* Status Icon */}
                      <div className={`size-12 rounded-xl flex items-center justify-center shrink-0 ${lifecycle.bgColor} ${lifecycle.borderColor} border`}>
                        <span className={`material-symbols-outlined ${lifecycle.color}`}>
                          {lifecycle.icon}
                        </span>
                      </div>

                      {/* Job Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 min-w-0">
                          <h4 className="font-bold text-white text-sm line-clamp-2 min-w-0 flex-1 group-hover:text-primary transition-colors">
                            {job.title}
                          </h4>
                          <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider shrink-0 ${lifecycle.bgColor} ${lifecycle.color} ${lifecycle.borderColor} border`}>
                            {lifecycle.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 truncate mb-1">
                          {job.client}
                        </p>
                        <div className="flex items-center gap-3 text-[10px] text-slate-500">
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">person</span>
                            {job.technician}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">calendar_today</span>
                            {new Date(job.date).toLocaleDateString('en-AU', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>

                        {/* Sync Status */}
                        {job.syncStatus === SYNC_STATUS.FAILED && (
                          <div className="mt-2 flex items-center gap-1 text-danger text-[10px] font-black uppercase">
                            <span className="material-symbols-outlined text-xs">sync_problem</span>
                            Sync Failed
                          </div>
                        )}
                      </div>

                      {/* Arrow */}
                      <span className="material-symbols-outlined text-slate-500 group-hover:text-white transition-colors">
                        chevron_right
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block bg-slate-900 border border-white/5 rounded-[2rem] overflow-hidden shadow-2xl">
              <div className="px-8 py-5 border-b border-white/5 bg-white/[0.02]">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  {currentFilter === 'all' ? 'All Jobs' : filterTabs.find(t => t.value === currentFilter)?.label}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-950/50">
                    <tr>
                      <th className="px-8 py-5 text-[11px] font-normal tracking-widest text-white">Job</th>
                      <th className="px-8 py-5 text-[11px] font-normal tracking-widest text-white">Client</th>
                      <th className="px-8 py-5 text-[11px] font-normal tracking-widest text-white">Technician</th>
                      <th className="px-8 py-5 text-[11px] font-normal tracking-widest text-white">Status</th>
                      <th className="px-8 py-5 text-[11px] font-normal tracking-widest text-white">Date</th>
                      <th className="px-8 py-5 text-[11px] font-normal tracking-widest text-white text-right">Sync</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredJobs.map(job => {
                      const lifecycle = getJobLifecycle(job);
                      const syncStatus = getSyncStatus(job);

                      return (
                        <tr
                          key={job.id}
                          className="hover:bg-white/5 transition-colors cursor-pointer group"
                          onClick={() => navigate(`/admin/report/${job.id}`)}
                        >
                          <td className="px-8 py-5">
                            <div className="font-bold text-base group-hover:text-primary transition-colors text-white line-clamp-2">
                              {job.title}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {job.id.slice(0, 8)}
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <div className="text-sm text-white font-bold">{job.client}</div>
                            {job.address && (
                              <div className="text-[10px] text-slate-500 truncate max-w-[200px]">
                                {job.address.split(',')[0]}
                              </div>
                            )}
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <div className="size-8 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-400">
                                {job.technician?.[0] || '?'}
                              </div>
                              <span className="text-sm text-slate-300 font-medium">
                                {job.technician || 'Unassigned'}
                              </span>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-tight ${lifecycle.bgColor} ${lifecycle.color} ${lifecycle.borderColor}`}>
                              <span className="material-symbols-outlined text-xs font-black">{lifecycle.icon}</span>
                              {lifecycle.label}
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <div className="text-sm text-white font-medium">
                              {new Date(job.date).toLocaleDateString('en-AU', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {new Date(job.date).toLocaleTimeString('en-AU', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </td>
                          <td className="px-8 py-5 text-right">
                            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-tight ${syncStatus.bgColor} ${syncStatus.color} ${syncStatus.borderColor}`}>
                              <span className={`material-symbols-outlined text-sm font-black ${job.syncStatus === SYNC_STATUS.SYNCING ? 'animate-spin' : ''}`}>
                                {syncStatus.icon}
                              </span>
                              {syncStatus.label}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default JobsList;
