/**
 * JobDetail - Job Detail View with Dispatch to Technician
 *
 * Shows complete job information with the critical ability to:
 * - Generate magic link for technician access
 * - Send via email, copy link, or share
 * - Track job status through completion
 */

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { PageHeader, PageContent } from '../../../components/layout';
import { Card, StatusBadge, ActionButton, EmptyState, LoadingSkeleton, ConfirmDialog, Modal } from '../../../components/ui';
import { getJobs, getClients, getTechnicians, deleteJob, updateJob } from '../../../hooks/useWorkspaceData';
import { generateMagicLink } from '../../../lib/db';
import { useAuth } from '../../../lib/AuthContext';
import { Job, Client, Technician } from '../../../types';
import { route, ROUTES } from '../../../lib/routes';
import SealBadge from '../../../components/SealBadge';

const JobDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userEmail } = useAuth();

  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<Job | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [assigning, setAssigning] = useState(false);

  // Magic link state
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

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
          setTechnician(techsData.find(t => t.id === foundJob.technicianId || t.id === foundJob.techId) || null);
          // Use existing magic link if available
          if (foundJob.magicLinkUrl) {
            setMagicLink(foundJob.magicLinkUrl);
          }
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
      await updateJob(job.id, { technicianId: techId, techId });
      const tech = technicians.find(t => t.id === techId);
      setTechnician(tech || null);
      setJob({ ...job, technicianId: techId, techId });
      setShowAssignModal(false);
    } catch (error) {
      console.error('Failed to assign technician:', error);
      alert('Failed to assign technician. Please try again.');
    } finally {
      setAssigning(false);
    }
  };

  // Generate magic link for technician
  const handleGenerateMagicLink = async () => {
    if (!job) return;

    setGeneratingLink(true);
    try {
      // deliveryEmail is required for validated handshake URLs
      if (!userEmail) {
        alert('Cannot generate link: Your email is not available. Please log in again.');
        setGeneratingLink(false);
        return;
      }
      const result = await generateMagicLink(job.id, userEmail);
      if (result.success && result.data) {
        setMagicLink(result.data.url);
        // Store magic link on job for later reference
        await updateJob(job.id, {
          magicLinkToken: result.data.token,
          magicLinkUrl: result.data.url,
        });
        setJob({ ...job, magicLinkToken: result.data.token, magicLinkUrl: result.data.url });
      } else {
        throw new Error(result.error || 'Failed to generate link');
      }
    } catch (error) {
      console.error('Failed to generate magic link:', error);
      alert('Failed to generate link. Please try again.');
    } finally {
      setGeneratingLink(false);
    }
  };

  // Copy magic link to clipboard
  const handleCopyLink = async () => {
    if (!magicLink) return;

    try {
      await navigator.clipboard.writeText(magicLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Send email to technician
  const handleSendEmail = () => {
    if (!magicLink || !technician) return;

    const subject = encodeURIComponent(`Job Assignment: ${job?.title || 'New Job'}`);
    const body = encodeURIComponent(
      `Hi ${technician.name},\n\n` +
      `You have been assigned a new job:\n\n` +
      `Job: ${job?.title || 'Job'}\n` +
      `Client: ${client?.name || 'N/A'}\n` +
      `Address: ${job?.address || 'N/A'}\n` +
      `Date: ${job?.date ? new Date(job.date).toLocaleDateString('en-GB') : 'N/A'}\n\n` +
      `Click the link below to access the job and start capturing evidence:\n\n` +
      `${magicLink}\n\n` +
      `This link expires in 7 days.\n\n` +
      `Thanks,\n` +
      `JobProof`
    );

    const email = technician.email || '';
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 3000);
  };

  // Share via Web Share API
  const handleShare = async () => {
    if (!magicLink || !navigator.share) return;

    try {
      await navigator.share({
        title: `Job: ${job?.title || 'New Job'}`,
        text: `Access your assigned job: ${job?.title}`,
        url: magicLink,
      });
    } catch (error) {
      // User cancelled or share failed
      console.log('Share cancelled or failed');
    }
  };

  // Get computed status
  const getJobStatus = (): 'draft' | 'dispatched' | 'active' | 'review' | 'sealed' | 'invoiced' => {
    if (!job) return 'draft';
    if (job.invoiceId) return 'invoiced';
    if (job.sealedAt) return 'sealed';
    if (job.status === 'Complete' || job.status === 'Submitted') return 'review';
    if (job.status === 'In Progress') return 'active';
    if (job.technicianId || job.techId) return 'dispatched';
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
  const canSend = (status === 'dispatched' || technician) && !job.sealedAt;

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
          ...(canSend ? [{
            label: 'Send Job',
            icon: 'send',
            onClick: () => setShowSendModal(true),
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
        <div className={`p-4 rounded-2xl mb-6 flex items-center gap-4 ${
          status === 'sealed' ? 'bg-emerald-500/10 border border-emerald-500/20' :
          status === 'review' ? 'bg-purple-500/10 border border-purple-500/20' :
          status === 'active' ? 'bg-amber-500/10 border border-amber-500/20' :
          status === 'dispatched' ? 'bg-blue-500/10 border border-blue-500/20' :
          status === 'invoiced' ? 'bg-cyan-500/10 border border-cyan-500/20' :
          'bg-slate-800 border border-white/10'
        }`}>
          <div className={`size-12 rounded-xl flex items-center justify-center ${
            status === 'sealed' ? 'bg-emerald-500/20 text-emerald-400' :
            status === 'review' ? 'bg-purple-500/20 text-purple-400' :
            status === 'active' ? 'bg-amber-500/20 text-amber-400' :
            status === 'dispatched' ? 'bg-blue-500/20 text-blue-400' :
            status === 'invoiced' ? 'bg-cyan-500/20 text-cyan-400' :
            'bg-slate-700 text-slate-400'
          }`}>
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
               status === 'dispatched' ? 'Send link to technician to start' :
               status === 'invoiced' ? 'Invoice has been generated' :
               'Assign a technician to dispatch this job'}
            </p>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Priority Badge */}
        {job.priority === 'urgent' && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2 mb-6">
            <span className="material-symbols-outlined text-red-400">priority_high</span>
            <span className="text-red-400 text-sm font-bold uppercase">Urgent Priority</span>
          </div>
        )}

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
                      {new Date(job.date).toLocaleDateString('en-GB', {
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
                    <div className="flex-1">
                      <p className="text-white">{job.address}</p>
                      <p className="text-sm text-slate-500">Location</p>
                      {/* Phase 9: Clickable map link */}
                      <button
                        onClick={() => {
                          const encodedAddress = encodeURIComponent(job.address || '');
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

                {(job.description || job.notes) && (
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-slate-500">description</span>
                    <div>
                      <p className="text-white">{job.description || job.notes}</p>
                      <p className="text-sm text-slate-500">Description</p>
                    </div>
                  </div>
                )}

                {(job.total || job.price) && (
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-slate-500">payments</span>
                    <div>
                      <p className="text-white text-lg font-semibold">£{(job.total || job.price || 0).toFixed(2)}</p>
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
                {/* REMEDIATION ITEM 9: Use photo.id or url for stable React keys */}
                <div className="grid grid-cols-4 gap-2">
                  {job.photos.slice(0, 4).map((photo, i) => (
                    <div
                      key={(photo as any).id || photo.url || `photo-${i}`}
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
                <Link to={route(ROUTES.CLIENT_DETAIL, { id: client.id })} className="block">
                  <div className="flex items-center gap-3 p-3 -m-3 rounded-xl hover:bg-white/5 transition-colors active:scale-[0.98]">
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
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                      <span className="text-amber-400 font-bold">{technician.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{technician.name}</p>
                      <p className="text-sm text-slate-400 truncate">{technician.phone || technician.email}</p>
                    </div>
                  </div>
                  {!job.sealedAt && (
                    <button
                      onClick={() => setShowSendModal(true)}
                      className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-sm uppercase tracking-wider transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-lg">send</span>
                      Send Job Link
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-slate-400 mb-3">No technician assigned</p>
                  <button
                    onClick={() => setShowAssignModal(true)}
                    className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-sm uppercase tracking-wider transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg">person_add</span>
                    Assign Technician
                  </button>
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
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors text-left disabled:opacity-50 active:scale-[0.98]"
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

      {/* Send Job Modal */}
      <Modal
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        title="Send Job to Technician"
        size="md"
      >
        <div className="space-y-6">
          {/* Technician Info */}
          {technician && (
            <div className="flex items-center gap-3 p-4 bg-slate-800 rounded-xl">
              <div className="size-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                <span className="text-amber-400 font-bold text-lg">{technician.name.charAt(0)}</span>
              </div>
              <div>
                <p className="font-bold text-white">{technician.name}</p>
                <p className="text-sm text-slate-400">{technician.email || 'No email'}</p>
              </div>
            </div>
          )}

          {/* Generate or Show Link */}
          {!magicLink ? (
            <button
              onClick={handleGenerateMagicLink}
              disabled={generatingLink}
              className="w-full py-4 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-sm uppercase tracking-wider transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {generatingLink ? (
                <>
                  <span className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">link</span>
                  Generate Job Link
                </>
              )}
            </button>
          ) : (
            <div className="space-y-4">
              {/* Magic Link Display */}
              <div className="p-4 bg-slate-800 rounded-xl">
                <p className="text-xs text-slate-400 uppercase font-bold mb-2">Job Access Link</p>
                <p className="text-sm text-white font-mono break-all">{magicLink}</p>
                <p className="text-xs text-slate-500 mt-2">Expires in 7 days</p>
              </div>

              {/* QR Code */}
              <div className="flex justify-center">
                <div className="rounded-xl bg-white p-2">
                  <QRCodeSVG value={magicLink} size={150} level="M" />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleCopyLink}
                  className={`py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                    linkCopied
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-700 hover:bg-slate-600 text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">
                    {linkCopied ? 'check' : 'content_copy'}
                  </span>
                  {linkCopied ? 'Copied!' : 'Copy Link'}
                </button>

                {technician?.email && (
                  <button
                    onClick={handleSendEmail}
                    className={`py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                      emailSent
                        ? 'bg-emerald-500 text-white'
                        : 'bg-primary hover:bg-primary-hover text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">
                      {emailSent ? 'check' : 'email'}
                    </span>
                    {emailSent ? 'Email Opened!' : 'Send Email'}
                  </button>
                )}
              </div>

              {/* Native Share (if supported) */}
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button
                  onClick={handleShare}
                  className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold text-sm uppercase tracking-wider transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">ios_share</span>
                  More Share Options...
                </button>
              )}

              {/* Regenerate Link */}
              <button
                onClick={handleGenerateMagicLink}
                disabled={generatingLink}
                className="w-full py-2 text-slate-400 hover:text-white text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                Generate New Link
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default JobDetail;
