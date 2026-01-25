/**
 * JobList - Job Management List View
 *
 * Displays all jobs with filtering by status.
 *
 * Phase E: Job Lifecycle
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, PageContent } from '../../../components/layout';
import { Card, StatusBadge, ActionButton, EmptyState, LoadingSkeleton } from '../../../components/ui';
import { getJobs, getClients, getTechnicians } from '../../../hooks/useWorkspaceData';
import { Job, Client, Technician } from '../../../types';
import { route, ROUTES } from '../../../lib/routes';

type StatusType = 'pending' | 'active' | 'review' | 'sealed' | 'invoiced';
type FilterStatus = 'all' | StatusType;

const statusFilters: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'In Progress' },
  { value: 'review', label: 'Ready for Review' },
  { value: 'sealed', label: 'Sealed' },
];

const JobList: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const [jobsData, clientsData, techsData] = await Promise.all([
          getJobs(),
          getClients(),
          getTechnicians(),
        ]);
        setJobs(jobsData);
        setClients(clientsData);
        setTechnicians(techsData);
      } catch (error) {
        console.error('Failed to load jobs:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Get computed status for job
  const getJobStatus = (job: Job): StatusType => {
    if (job.invoiceId) return 'invoiced';
    if (job.sealedAt) return 'sealed';
    if (job.status === 'Complete' || job.status === 'Submitted') return 'review';
    if (job.status === 'In Progress') return 'active';
    return 'pending';
  };

  // Get status badge type
  const getStatusBadge = (job: Job): 'pending' | 'active' | 'review' | 'sealed' | 'invoiced' | 'draft' => {
    const status = getJobStatus(job);
    if (status === 'pending' && !job.technicianId) return 'draft';
    return status;
  };

  // Filter jobs
  const filteredJobs = useMemo(() => {
    let result = jobs;

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(job => getJobStatus(job) === statusFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(job => {
        const client = clients.find(c => c.id === job.clientId);
        const tech = technicians.find(t => t.id === job.technicianId);

        return (
          job.title?.toLowerCase().includes(query) ||
          job.id.toLowerCase().includes(query) ||
          client?.name.toLowerCase().includes(query) ||
          tech?.name.toLowerCase().includes(query) ||
          job.address?.toLowerCase().includes(query)
        );
      });
    }

    // Sort by date (newest first)
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [jobs, clients, technicians, statusFilter, searchQuery]);

  // Get counts for each status
  const statusCounts = useMemo(() => {
    return {
      all: jobs.length,
      pending: jobs.filter(j => getJobStatus(j) === 'pending').length,
      active: jobs.filter(j => getJobStatus(j) === 'active').length,
      review: jobs.filter(j => getJobStatus(j) === 'review').length,
      sealed: jobs.filter(j => getJobStatus(j) === 'sealed').length,
      invoiced: jobs.filter(j => getJobStatus(j) === 'invoiced').length,
    };
  }, [jobs]);

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Jobs"
          actions={[{ label: 'New Job', icon: 'add', to: ROUTES.JOB_NEW, variant: 'primary' }]}
        />
        <PageContent>
          <LoadingSkeleton variant="list" count={5} />
        </PageContent>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Jobs"
        subtitle={`${jobs.length} job${jobs.length !== 1 ? 's' : ''}`}
        actions={[{ label: 'New Job', icon: 'add', to: ROUTES.JOB_NEW, variant: 'primary' }]}
      >
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Status Pills */}
          <div className="flex flex-wrap gap-2">
            {statusFilters.map(filter => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className={`
                  px-3 py-1.5 text-sm rounded-lg transition-all
                  ${statusFilter === filter.value
                    ? 'bg-primary text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'}
                `}
              >
                {filter.label}
                <span className="ml-1.5 opacity-60">
                  {statusCounts[filter.value]}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
              search
            </span>
            <input
              type="text"
              placeholder="Search jobs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary/50"
            />
          </div>
        </div>
      </PageHeader>

      <PageContent>
        {filteredJobs.length === 0 ? (
          <EmptyState
            icon={searchQuery || statusFilter !== 'all' ? 'search_off' : 'work'}
            title={searchQuery || statusFilter !== 'all' ? 'No jobs found' : 'No jobs yet'}
            description={
              searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your filters.'
                : 'Create your first job to get started.'
            }
            action={!searchQuery && statusFilter === 'all' ? { label: 'Create Job', to: ROUTES.JOB_NEW, icon: 'add' } : undefined}
          />
        ) : (
          <div className="space-y-3">
            {filteredJobs.map(job => {
              const client = clients.find(c => c.id === job.clientId);
              const tech = technicians.find(t => t.id === job.technicianId);
              const status = getStatusBadge(job);

              return (
                <Link key={job.id} to={route(ROUTES.JOB_DETAIL, { id: job.id })}>
                  <Card variant="interactive">
                    <div className="flex items-center gap-4">
                      {/* Status indicator */}
                      <div className={`
                        size-12 rounded-xl flex items-center justify-center shrink-0
                        ${status === 'sealed' ? 'bg-emerald-500/10 text-emerald-400' :
                          status === 'review' ? 'bg-purple-500/10 text-purple-400' :
                          status === 'active' ? 'bg-amber-500/10 text-amber-400' :
                          status === 'draft' ? 'bg-slate-500/10 text-slate-400' :
                          status === 'invoiced' ? 'bg-cyan-500/10 text-cyan-400' :
                          'bg-blue-500/10 text-blue-400'}
                      `}>
                        <span className="material-symbols-outlined text-2xl">
                          {status === 'sealed' ? 'verified' :
                           status === 'review' ? 'rate_review' :
                           status === 'active' ? 'pending' :
                           status === 'draft' ? 'edit_note' :
                           status === 'invoiced' ? 'receipt' :
                           'work'}
                        </span>
                      </div>

                      {/* Job info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-white truncate">
                            {job.title || `Job #${job.id.slice(0, 6)}`}
                          </p>
                          <StatusBadge status={status} variant="compact" />
                        </div>
                        <p className="text-sm text-slate-400 truncate">
                          {client?.name || 'Unknown client'}
                          {tech && ` • ${tech.name}`}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(job.date).toLocaleDateString('en-AU', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                          {job.address && ` • ${job.address.split(',')[0]}`}
                        </p>
                      </div>

                      {/* Quick action based on status */}
                      <div className="hidden sm:block">
                        {status === 'draft' && (
                          <ActionButton variant="secondary" size="sm">
                            Assign
                          </ActionButton>
                        )}
                        {status === 'review' && (
                          <ActionButton variant="secondary" size="sm">
                            Review
                          </ActionButton>
                        )}
                        {status === 'sealed' && (
                          <ActionButton variant="secondary" size="sm">
                            Invoice
                          </ActionButton>
                        )}
                      </div>

                      <span className="material-symbols-outlined text-slate-500">chevron_right</span>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </PageContent>
    </div>
  );
};

export default JobList;
