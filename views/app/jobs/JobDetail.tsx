/**
 * JobDetail - Job Detail View
 *
 * Shows complete job information with timeline and actions.
 *
 * Phase E: Job Lifecycle
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { PageHeader, PageContent } from '../../../components/layout';
import { Card, StatusBadge, ActionButton, EmptyState, LoadingSkeleton, ConfirmDialog, Modal } from '../../../components/ui';
import { getJobs, getClients, getTechnicians, deleteJob, updateJob } from '../../../hooks/useWorkspaceData';
import { Job, Client, Technician } from '../../../types';
import { route, ROUTES } from '../../../lib/routes';
import SealBadge from '../../../components/SealBadge';

const JobDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<Job | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;

      try {
        const [jobsData, clientsData, techsData] = await Promise.all([
          getJobs(),
          getClients(),
          getTechnicians(),
        ]);

        const foundJob = jobsData.find(j => j.id === id);
        setJob(foundJob || null);

        if (foundJob) {
          setClient(clientsData.find(c => c.id === foundJob.clientId) || null);
          setTechnician(techsData.find(t => t.id === foundJob.technicianId) || null);
        }

        setTechnicians(techsData);
      } catch (error) {
        console.error('Failed to load job:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  const handleDelete = async () => {
    if (!job) return;

    setDeleting(true);
    try {
      await deleteJob(job.id);
      navigate(ROUTES.JOBS);
    } catch (error) {
      console.error('Failed to delete job:', error);
      alert('Failed to delete job. Please try again.');
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleAssignTech = async (techId: string) => {
    if (!job) return;

    setAssigning(true);
    try {
      await updateJob(job.id, { technicianId: techId });
      const tech = technicians.find(t => t.id === techId);
      setTechnician(tech || null);
      setJob({ ...job, technicianId: techId });
      setShowAssignModal(false);
    } catch (error) {
      console.error('Failed to assign technician:', error);
      alert('Failed to assign technician. Please try again.');
    } finally {
      setAssigning(false);
    }
  };

  // Get computed status
  const getJobStatus = (): 'draft' | 'dispatched' | 'active' | 'review' | 'sealed' | 'invoiced' => {
    if (!job) return 'draft';
    if (job.invoiceId) return 'invoiced';
    if (job.sealedAt) return 'sealed';
    if (job.status === 'complete') return 'review';
    if (job.status === 'in-progress') return 'active';
    if (job.technicianId) return 'dispatched';
    return 'draft';
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Job" backTo={ROUTES.JOBS} backLabel="Jobs" />
        <PageContent>
          <LoadingSkeleton variant="card" count={2} />
        </PageContent>
      </div>
    );
  }

  if (!job) {
    return (
      <div>
        <PageHeader title="Job Not Found" backTo={ROUTES.JOBS} backLabel="Jobs" />
        <PageContent>
          <EmptyState
            icon="work_off"
            title="Job not found"
            description="The job you're looking for doesn't exist or has been deleted."
            action={{ label: 'Back to Jobs', to: ROUTES.JOBS }}
          />
        </PageContent>
      </div>
    );
  }

  const status = getJobStatus();

  return (
    <div>
      <PageHeader
        title={job.title || `Job #${job.id.slice(0, 6)}`}
        backTo={ROUTES.JOBS}
        backLabel="Jobs"
        actions={[
          ...(status === 'draft' ? [{
            label: 'Assign Tech',
            icon: 'person_add',
            onClick: () => setShowAssignModal(true),
            variant: 'primary' as const,
          }] : []),
          ...(status === 'review' ? [{
            label: 'Review & Seal',
            icon: 'verified',
            to: route(ROUTES.JOB_EVIDENCE, { id: job.id }),
            variant: 'primary' as const,
          }] : []),
          ...(status === 'sealed' && !job.invoiceId ? [{
            label: 'Generate Invoice',
            icon: 'receipt',
            to: `${ROUTES.INVOICES}?jobId=${job.id}`,
            variant: 'primary' as const,
          }] : []),
          { label: 'Edit', icon: 'edit', to: route(ROUTES.JOB_EDIT, { id: job.id }) },
          { label: 'Delete', icon: 'delete', onClick: () => setShowDeleteDialog(true), variant: 'danger' as const },
        ]}
      />

      <PageContent>
        {/* Status Banner */}
        <div className={`
          p-4 rounded-2xl mb-6 flex items-center gap-4
          ${status === 'sealed' ? 'bg-emerald-500/10 border border-emerald-500/20' :
            status === 'review' ? 'bg-purple-500/10 border border-purple-500/20' :
            status === 'active' ? 'bg-amber-500/10 border border-amber-500/20' :
            status === 'dispatched' ? 'bg-blue-500/10 border border-blue-500/20' :
            status === 'invoiced' ? 'bg-cyan-500/10 border border-cyan-500/20' :
            'bg-slate-800 border border-white/10'}
        `}>
          <div className={`
            size-12 rounded-xl flex items-center justify-center
            ${status === 'sealed' ? 'bg-emerald-500/20 text-emerald-400' :
              status === 'review' ? 'bg-purple-500/20 text-purple-400' :
              status === 'active' ? 'bg-amber-500/20 text-amber-400' :
              status === 'dispatched' ? 'bg-blue-500/20 text-blue-400' :
              status === 'invoiced' ? 'bg-cyan-500/20 text-cyan-400' :
              'bg-slate-700 text-slate-400'}
          `}>
            <span className="material-symbols-outlined text-2xl">
              {status === 'sealed' ? 'verified' :
               status === 'review' ? 'rate_review' :
               status === 'active' ? 'pending' :
               status === 'dispatched' ? 'send' :
               status === 'invoiced' ? 'receipt' :
               'edit_note'}
            </span>
          </div>
          <div className="flex-1">
            <p className="font-medium text-white">
              {status === 'sealed' ? 'Cryptographically Sealed' :
               status === 'review' ? 'Ready for Review' :
               status === 'active' ? 'Work In Progress' :
               status === 'dispatched' ? 'Dispatched to Technician' :
               status === 'invoiced' ? 'Invoiced' :
               'Draft - Needs Technician'}
            </p>
            <p className="text-sm text-slate-400">
              {status === 'sealed' ? 'Evidence has been sealed and verified' :
               status === 'review' ? 'Evidence uploaded, awaiting seal' :
               status === 'active' ? 'Technician is working on this job' :
               status === 'dispatched' ? 'Awaiting technician to start' :
               status === 'invoiced' ? 'Invoice has been generated' :
               'Assign a technician to dispatch this job'}
            </p>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Seal Badge (if sealed) */}
        {job.sealedAt && (
          <div className="mb-6">
            <SealBadge jobId={job.id} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Job Details */}
            <Card>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
                Job Details
              </h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-slate-500">calendar_today</span>
                  <div>
                    <p className="text-white">
                      {new Date(job.date).toLocaleDateString('en-AU', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                    <p className="text-sm text-slate-500">Scheduled Date</p>
                  </div>
                </div>

                {job.address && (
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-slate-500">location_on</span>
                    <div>
                      <p className="text-white">{job.address}</p>
                      <p className="text-sm text-slate-500">Location</p>
                    </div>
                  </div>
                )}

                {job.description && (
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-slate-500">description</span>
                    <div>
                      <p className="text-white">{job.description}</p>
                      <p className="text-sm text-slate-500">Description</p>
                    </div>
                  </div>
                )}

                {job.total && (
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-slate-500">payments</span>
                    <div>
                      <p className="text-white text-lg font-semibold">${job.total.toFixed(2)}</p>
                      <p className="text-sm text-slate-500">Total</p>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Evidence Preview */}
            {job.photos && job.photos.length > 0 && (
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
                    Evidence ({job.photos.length} items)
                  </h3>
                  <ActionButton
                    variant="ghost"
                    size="sm"
                    to={route(ROUTES.JOB_EVIDENCE, { id: job.id })}
                  >
                    View All
                  </ActionButton>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {job.photos.slice(0, 4).map((photo, i) => (
                    <div
                      key={i}
                      className="aspect-square rounded-lg bg-slate-800 overflow-hidden"
                    >
                      <img
                        src={photo.url || photo.localPath}
                        alt={`Evidence ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Client Info */}
            <Card>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
                Client
              </h3>
              {client ? (
                <Link to={route(ROUTES.CLIENT_DETAIL, { id: client.id })}>
                  <div className="flex items-center gap-3 p-3 -m-3 rounded-xl hover:bg-white/5 transition-colors">
                    <div className="size-10 rounded-lg bg-gradient-to-br from-primary/20 to-blue-500/20 flex items-center justify-center">
                      <span className="text-primary font-bold">{client.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{client.name}</p>
                      <p className="text-sm text-slate-400 truncate">{client.address || client.email}</p>
                    </div>
                    <span className="material-symbols-outlined text-slate-500">chevron_right</span>
                  </div>
                </Link>
              ) : (
                <p className="text-slate-400">No client assigned</p>
              )}
            </Card>

            {/* Technician Info */}
            <Card>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
                Technician
              </h3>
              {technician ? (
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                    <span className="text-amber-400 font-bold">{technician.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">{technician.name}</p>
                    <p className="text-sm text-slate-400 truncate">{technician.phone || technician.email}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-slate-400 mb-3">No technician assigned</p>
                  <ActionButton
                    variant="primary"
                    size="sm"
                    icon="person_add"
                    onClick={() => setShowAssignModal(true)}
                  >
                    Assign Technician
                  </ActionButton>
                </div>
              )}
            </Card>
          </div>
        </div>
      </PageContent>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title="Delete Job"
        message="Are you sure you want to delete this job? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />

      {/* Assign Technician Modal */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title="Assign Technician"
        description="Select a technician to dispatch this job"
        size="md"
      >
        {technicians.length === 0 ? (
          <EmptyState
            icon="engineering"
            title="No technicians"
            description="Add a technician first."
            action={{ label: 'Add Technician', to: ROUTES.TECHNICIAN_NEW }}
          />
        ) : (
          <div className="space-y-2">
            {technicians.map(tech => (
              <button
                key={tech.id}
                onClick={() => handleAssignTech(tech.id)}
                disabled={assigning}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors text-left disabled:opacity-50"
              >
                <div className="size-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                  <span className="text-amber-400 font-bold">{tech.name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white">{tech.name}</p>
                  <p className="text-sm text-slate-400">{tech.phone || tech.email}</p>
                </div>
                {tech.id === technician?.id && (
                  <span className="material-symbols-outlined text-primary">check_circle</span>
                )}
              </button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default JobDetail;
