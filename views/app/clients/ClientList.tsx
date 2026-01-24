/**
 * ClientList - Client Registry List View
 *
 * Displays all clients with search and filtering.
 *
 * Phase D: Client Registry
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, PageContent } from '../../../components/layout';
import { Card, ActionButton, EmptyState, LoadingSkeleton } from '../../../components/ui';
import { getClients, getJobs } from '../../../hooks/useWorkspaceData';
import { Client, Job } from '../../../types';
import { route, ROUTES } from '../../../lib/routes';

const ClientList: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const [clientsData, jobsData] = await Promise.all([
          getClients(),
          getJobs(),
        ]);
        setClients(clientsData);
        setJobs(jobsData);
      } catch (error) {
        console.error('Failed to load clients:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Filter clients by search query
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;

    const query = searchQuery.toLowerCase();
    return clients.filter(client =>
      client.name.toLowerCase().includes(query) ||
      client.email?.toLowerCase().includes(query) ||
      client.address?.toLowerCase().includes(query)
    );
  }, [clients, searchQuery]);

  // REMEDIATION ITEM 7: Memoize job stats per client to avoid O(n*m) lookups in render
  const clientJobStats = useMemo(() => {
    const stats: Record<string, { count: number; lastJobDate: Date | null }> = {};

    // Group jobs by clientId
    const jobsByClient: Record<string, Job[]> = {};
    for (const job of jobs) {
      if (job.clientId) {
        if (!jobsByClient[job.clientId]) {
          jobsByClient[job.clientId] = [];
        }
        jobsByClient[job.clientId].push(job);
      }
    }

    // Calculate stats for each client
    for (const clientId of Object.keys(jobsByClient)) {
      const clientJobs = jobsByClient[clientId];
      const sortedJobs = [...clientJobs].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      stats[clientId] = {
        count: clientJobs.length,
        lastJobDate: sortedJobs.length > 0 ? new Date(sortedJobs[0].date) : null,
      };
    }

    return stats;
  }, [jobs]);

  // Get job count for each client (uses memoized stats)
  const getJobCount = (clientId: string) => {
    return clientJobStats[clientId]?.count ?? 0;
  };

  // Get last job date for client (uses memoized stats)
  const getLastJobDate = (clientId: string) => {
    return clientJobStats[clientId]?.lastJobDate ?? null;
  };

  const formatRelativeDate = (date: Date | null) => {
    if (!date) return 'Never';

    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Clients"
          actions={[{ label: 'Add Client', icon: 'add', to: ROUTES.CLIENT_NEW, variant: 'primary' }]}
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
        title="Clients"
        subtitle={`${clients.length} client${clients.length !== 1 ? 's' : ''}`}
        actions={[{ label: 'Add Client', icon: 'add', to: ROUTES.CLIENT_NEW, variant: 'primary' }]}
      >
        {/* Search */}
        <div className="relative max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
            search
          </span>
          <input
            type="text"
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary/50"
          />
        </div>
      </PageHeader>

      <PageContent>
        {filteredClients.length === 0 ? (
          <EmptyState
            icon={searchQuery ? 'search_off' : 'group'}
            title={searchQuery ? 'No clients found' : 'No clients yet'}
            description={searchQuery
              ? 'Try adjusting your search query.'
              : 'Add your first client to get started.'}
            action={!searchQuery ? { label: 'Add Client', to: ROUTES.CLIENT_NEW, icon: 'add' } : undefined}
          />
        ) : (
          <div className="space-y-3">
            {filteredClients.map(client => {
              const jobCount = getJobCount(client.id);
              const lastJob = getLastJobDate(client.id);

              return (
                <Link key={client.id} to={route(ROUTES.CLIENT_DETAIL, { id: client.id })}>
                  <Card variant="interactive">
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className="size-12 rounded-xl bg-gradient-to-br from-primary/20 to-blue-500/20 flex items-center justify-center border border-white/5">
                        <span className="text-lg font-bold text-primary">
                          {client.name.charAt(0).toUpperCase()}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-white truncate">{client.name}</p>
                          {client.type && (
                            <span className={`
                              px-2 py-0.5 text-[10px] font-bold uppercase rounded
                              ${client.type === 'commercial'
                                ? 'bg-blue-500/10 text-blue-400'
                                : 'bg-slate-500/10 text-slate-400'}
                            `}>
                              {client.type}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-400 truncate">
                          {client.address || client.email || 'No contact info'}
                        </p>
                      </div>

                      {/* Stats */}
                      <div className="hidden sm:flex items-center gap-6 text-right">
                        <div>
                          <p className="text-sm font-medium text-white">{jobCount}</p>
                          <p className="text-xs text-slate-500">Jobs</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-300">
                            {formatRelativeDate(lastJob)}
                          </p>
                          <p className="text-xs text-slate-500">Last Job</p>
                        </div>
                      </div>

                      {/* Arrow */}
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

export default ClientList;
