/**
 * ClientDetail - Client Detail View
 *
 * Shows client information with job history.
 *
 * Phase D: Client Registry
 */

import React, { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { PageHeader, PageContent } from '../../../components/layout';
import { Card, StatusBadge, ActionButton, EmptyState, LoadingSkeleton, ConfirmDialog } from '../../../components/ui';
import { useData } from '../../../lib/DataContext';
import { Client, Job } from '../../../types';
import { route, ROUTES } from '../../../lib/routes';

const ClientDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Use DataContext for centralized state management (CLAUDE.md mandate)
  const {
    clients,
    jobs: allJobs,
    deleteClient: contextDeleteClient,
    isLoading
  } = useData();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Derive client and jobs from DataContext (memoized for performance)
  const client = useMemo(() => clients.find(c => c.id === id) || null, [clients, id]);
  const jobs = useMemo(() => allJobs.filter(j => j.clientId === id), [allJobs, id]);

  const loading = isLoading;

  const handleDelete = async () => {
    if (!client) return;

    setDeleting(true);
    try {
      contextDeleteClient(client.id);
      navigate(ROUTES.CLIENTS);
    } catch (error) {
      console.error('Failed to delete client:', error);
      alert('Failed to delete client. Please try again.');
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const getJobStatus = (job: Job): 'pending' | 'active' | 'completed' | 'sealed' => {
    if (job.sealedAt) return 'sealed';
    if (job.status === 'Complete' || job.status === 'Submitted') return 'completed';
    if (job.status === 'In Progress') return 'active';
    return 'pending';
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Client" backTo={ROUTES.CLIENTS} backLabel="Clients" />
        <PageContent>
          <LoadingSkeleton variant="card" count={2} />
        </PageContent>
      </div>
    );
  }

  if (!client) {
    return (
      <div>
        <PageHeader title="Client Not Found" backTo={ROUTES.CLIENTS} backLabel="Clients" />
        <PageContent>
          <EmptyState
            icon="person_off"
            title="Client not found"
            description="The client you're looking for doesn't exist or has been deleted."
            action={{ label: 'Back to Clients', to: ROUTES.CLIENTS }}
          />
        </PageContent>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={client.name}
        backTo={ROUTES.CLIENTS}
        backLabel="Clients"
        actions={[
          { label: 'New Job', icon: 'add', to: `${ROUTES.JOB_NEW}?clientId=${client.id}`, variant: 'primary' },
          { label: 'Edit', icon: 'edit', to: route(ROUTES.CLIENT_EDIT, { id: client.id }) },
          { label: 'Delete', icon: 'delete', onClick: () => setShowDeleteDialog(true), variant: 'danger' },
        ]}
      />

      <PageContent>
        {/* Client Info */}
        <Card className="mb-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
            Contact Information
          </h3>
          <div className="space-y-4">
            {client.address && (
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-slate-500">location_on</span>
                <div className="flex-1">
                  <p className="text-white">{client.address}</p>
                  {/* Phase 9: Clickable map link */}
                  <button
                    onClick={() => {
                      const encodedAddress = encodeURIComponent(client.address || '');
                      window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
                    }}
                    className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-lg text-primary text-xs font-bold transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">map</span>
                    Open in Maps
                  </button>
                </div>
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-slate-500">email</span>
                <a href={`mailto:${client.email}`} className="text-primary hover:underline">
                  {client.email}
                </a>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-slate-500">phone</span>
                <a href={`tel:${client.phone}`} className="text-primary hover:underline">
                  {client.phone}
                </a>
              </div>
            )}
            {client.type && (
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-slate-500">business</span>
                <span className="text-white capitalize">{client.type}</span>
              </div>
            )}
          </div>
        </Card>

        {/* Job History */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Job History</h2>
          <ActionButton
            variant="secondary"
            size="sm"
            icon="add"
            to={`${ROUTES.JOB_NEW}?clientId=${client.id}`}
          >
            New Job
          </ActionButton>
        </div>

        {jobs.length === 0 ? (
          <EmptyState
            icon="work_off"
            title="No jobs yet"
            description="Create the first job for this client."
            action={{ label: 'Create Job', to: `${ROUTES.JOB_NEW}?clientId=${client.id}`, icon: 'add' }}
          />
        ) : (
          <div className="space-y-3">
            {jobs.map(job => (
              <Link key={job.id} to={route(ROUTES.JOB_DETAIL, { id: job.id })}>
                <Card variant="interactive">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-white truncate">
                          {job.title || `Job #${job.id.slice(0, 6)}`}
                        </p>
                        <StatusBadge status={getJobStatus(job)} variant="compact" />
                      </div>
                      <p className="text-sm text-slate-400">
                        {new Date(job.date).toLocaleDateString('en-AU', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    {job.total && (
                      <p className="text-sm font-medium text-white">
                        ${job.total.toFixed(2)}
                      </p>
                    )}
                    <span className="material-symbols-outlined text-slate-500">chevron_right</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </PageContent>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title="Delete Client"
        message={`Are you sure you want to delete "${client.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
};

export default ClientDetail;
