/**
 * Dashboard - Attention-First Manager Dashboard
 *
 * The main dashboard for managers, prioritizing items that need attention.
 *
 * Phase C: Dashboard Redesign
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, PageContent } from '../../components/layout';
import { Card, StatusBadge, ActionButton, EmptyState, LoadingSkeleton } from '../../components/ui';
import { useWorkspaceData } from '../../hooks/useWorkspaceData';
import { route, ROUTES } from '../../lib/routes';

interface QuickStat {
  label: string;
  value: number;
  icon: string;
  color: string;
  link: string;
  trend?: { value: number; isUp: boolean };
}

interface AttentionItem {
  id: string;
  type: 'dispatch' | 'seal' | 'invoice' | 'overdue';
  title: string;
  subtitle: string;
  action: { label: string; to: string };
  urgency: 'high' | 'medium' | 'low';
}

const Dashboard: React.FC = () => {
  // Use reactive DataContext hook instead of deprecated standalone functions
  // This ensures dashboard updates when data changes elsewhere in the app
  const { jobs, clients, technicians, isLoading: loading } = useWorkspaceData();

  // Calculate stats with clickable links
  const stats: QuickStat[] = [
    {
      label: 'Need Action',
      value: jobs.filter(j => !j.technicianId || j.status === 'Pending').length,
      icon: 'priority_high',
      color: 'text-red-400 bg-red-500/10',
      link: `${ROUTES.JOBS}?status=pending`,
    },
    {
      label: 'In Progress',
      value: jobs.filter(j => j.status === 'In Progress').length,
      icon: 'pending',
      color: 'text-amber-400 bg-amber-500/10',
      link: `${ROUTES.JOBS}?status=in-progress`,
    },
    {
      label: 'Completed',
      value: jobs.filter(j => j.status === 'Complete').length,
      icon: 'check_circle',
      color: 'text-emerald-400 bg-emerald-500/10',
      link: `${ROUTES.JOBS}?status=complete`,
    },
    {
      label: 'Total Clients',
      value: clients.length,
      icon: 'group',
      color: 'text-blue-400 bg-blue-500/10',
      link: ROUTES.CLIENTS,
    },
  ];

  // Generate attention items
  const getAttentionItems = (): AttentionItem[] => {
    const items: AttentionItem[] = [];

    // Jobs without technicians
    jobs
      .filter(j => !j.technicianId && j.status !== 'Complete')
      .slice(0, 3)
      .forEach(job => {
        const client = clients.find(c => c.id === job.clientId);
        items.push({
          id: `dispatch-${job.id}`,
          type: 'dispatch',
          title: `Job #${job.id.slice(0, 6)}`,
          subtitle: `No technician assigned${client ? ` - ${client.name}` : ''}`,
          action: { label: 'Assign Tech', to: route(ROUTES.JOB_DETAIL, { id: job.id }) },
          urgency: 'high',
        });
      });

    // Jobs ready for sealing (completed but not sealed)
    jobs
      .filter(j => j.status === 'Complete' && !j.sealedAt)
      .slice(0, 3)
      .forEach(job => {
        items.push({
          id: `seal-${job.id}`,
          type: 'seal',
          title: `Job #${job.id.slice(0, 6)}`,
          subtitle: 'Evidence ready for seal',
          action: { label: 'Review & Seal', to: route(ROUTES.JOB_EVIDENCE, { id: job.id }) },
          urgency: 'medium',
        });
      });

    // Jobs ready for invoicing (sealed but not invoiced)
    jobs
      .filter(j => j.sealedAt && !j.invoiceId)
      .slice(0, 3)
      .forEach(job => {
        items.push({
          id: `invoice-${job.id}`,
          type: 'invoice',
          title: `Job #${job.id.slice(0, 6)}`,
          subtitle: 'Sealed, ready to invoice',
          action: { label: 'Generate Invoice', to: route(ROUTES.JOB_DETAIL, { id: job.id }) },
          urgency: 'low',
        });
      });

    return items.slice(0, 5);
  };

  const attentionItems = loading ? [] : getAttentionItems();

  // Get today's jobs
  const todayJobs = jobs.filter(j => {
    const jobDate = new Date(j.date);
    const today = new Date();
    return jobDate.toDateString() === today.toDateString();
  });

  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const formatDate = () => {
    return new Date().toLocaleDateString('en-AU', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <PageContent>
          <LoadingSkeleton variant="card" count={3} />
        </PageContent>
      </div>
    );
  }

  return (
    <div>
      {/* Header with greeting */}
      <div className="px-4 lg:px-8 py-6 border-b border-white/5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {getGreeting()}
            </h1>
            <p className="text-sm text-slate-400 mt-1">{formatDate()}</p>
          </div>
          <div className="flex gap-2">
            <ActionButton variant="primary" icon="add" to={ROUTES.JOB_NEW}>
              New Job
            </ActionButton>
          </div>
        </div>
      </div>

      <PageContent>
        {/* Quick Stats - Clickable metrics linking to filtered views */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, i) => (
            <Link key={i} to={stat.link} className="block">
              <Card padding="md" variant="interactive" className="h-full hover:scale-[1.02] transition-transform">
                <div className="flex items-center gap-3">
                  <div className={`size-10 rounded-xl flex items-center justify-center ${stat.color}`}>
                    <span className="material-symbols-outlined text-xl">{stat.icon}</span>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                    <p className="text-xs text-slate-400">{stat.label}</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        {/* Needs Your Attention */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Needs Your Attention</h2>
            <Link to={ROUTES.JOBS} className="text-sm text-primary hover:text-primary/80">
              View All
            </Link>
          </div>

          {attentionItems.length === 0 ? (
            <Card>
              <div className="flex items-center gap-4 py-4">
                <div className="size-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl text-emerald-400">check_circle</span>
                </div>
                <div>
                  <p className="font-medium text-white">All caught up!</p>
                  <p className="text-sm text-slate-400">No items need your immediate attention.</p>
                </div>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {attentionItems.map(item => (
                <Card key={item.id} variant="interactive">
                  <div className="flex items-center gap-4">
                    <div className={`
                      size-10 rounded-xl flex items-center justify-center
                      ${item.urgency === 'high' ? 'bg-red-500/10 text-red-400' :
                        item.urgency === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-blue-500/10 text-blue-400'}
                    `}>
                      <span className="material-symbols-outlined text-xl">
                        {item.type === 'dispatch' ? 'person_add' :
                         item.type === 'seal' ? 'verified' :
                         item.type === 'invoice' ? 'receipt' : 'warning'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{item.title}</p>
                      <p className="text-sm text-slate-400 truncate">{item.subtitle}</p>
                    </div>
                    <ActionButton variant="secondary" size="sm" to={item.action.to}>
                      {item.action.label}
                    </ActionButton>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Today's Schedule */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Today's Schedule</h2>
            <Link to={ROUTES.JOBS} className="text-sm text-primary hover:text-primary/80">
              View All
            </Link>
          </div>

          {todayJobs.length === 0 ? (
            <EmptyState
              icon="event_busy"
              title="No jobs scheduled for today"
              description="Create a new job to get started."
              action={{ label: 'Create Job', to: ROUTES.JOB_NEW, icon: 'add' }}
            />
          ) : (
            <div className="space-y-3">
              {todayJobs.map(job => {
                const client = clients.find(c => c.id === job.clientId);
                const tech = technicians.find(t => t.id === job.technicianId);

                return (
                  <Link key={job.id} to={route(ROUTES.JOB_DETAIL, { id: job.id })}>
                    <Card variant="interactive">
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[60px]">
                          <p className="text-xs text-slate-500">
                            {new Date(job.date).toLocaleTimeString('en-AU', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        <div className="w-px h-10 bg-white/10" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-white truncate">
                              {job.title || `Job #${job.id.slice(0, 6)}`}
                            </p>
                            <StatusBadge
                              status={job.status === 'Complete' ? 'completed' : job.status === 'In Progress' ? 'active' : 'pending'}
                              variant="compact"
                            />
                          </div>
                          <p className="text-sm text-slate-400 truncate">
                            {client?.name || 'Unknown client'}
                            {tech && ` • ${tech.name}`}
                          </p>
                        </div>
                        <span className="material-symbols-outlined text-slate-500">chevron_right</span>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Quick Actions */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Link to={ROUTES.JOB_NEW}>
              <Card variant="interactive" padding="md">
                <div className="flex flex-col items-center gap-2 py-2">
                  <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl text-primary">add_circle</span>
                  </div>
                  <span className="text-sm font-medium text-white">New Job</span>
                </div>
              </Card>
            </Link>
            <Link to={ROUTES.CLIENT_NEW}>
              <Card variant="interactive" padding="md">
                <div className="flex flex-col items-center gap-2 py-2">
                  <div className="size-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl text-blue-400">person_add</span>
                  </div>
                  <span className="text-sm font-medium text-white">Add Client</span>
                </div>
              </Card>
            </Link>
            <Link to={ROUTES.TECHNICIAN_NEW}>
              <Card variant="interactive" padding="md">
                <div className="flex flex-col items-center gap-2 py-2">
                  <div className="size-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl text-amber-400">engineering</span>
                  </div>
                  <span className="text-sm font-medium text-white">Add Tech</span>
                </div>
              </Card>
            </Link>
            <Link to={ROUTES.INVOICES}>
              <Card variant="interactive" padding="md">
                <div className="flex flex-col items-center gap-2 py-2">
                  <div className="size-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl text-emerald-400">receipt_long</span>
                  </div>
                  <span className="text-sm font-medium text-white">Invoices</span>
                </div>
              </Card>
            </Link>
          </div>
        </section>
      </PageContent>
    </div>
  );
};

export default Dashboard;
