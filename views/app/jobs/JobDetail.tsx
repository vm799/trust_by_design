/**
 * JobDetail - Job Detail View with Dispatch to Technician
 *
 * Shows complete job information with the critical ability to:
 * - Generate magic link for technician access
 * - Send via email, copy link, or share
 * - Track job status through completion
 */

import React, { useState, useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { PageHeader, PageContent } from '../../../components/layout';
import { Card, StatusBadge, ActionButton, EmptyState, LoadingSkeleton, ConfirmDialog, Modal } from '../../../components/ui';
import { useData } from '../../../lib/DataContext';
import { generateMagicLink } from '../../../lib/db';
import { useAuth } from '../../../lib/AuthContext';
import { Job } from '../../../types';
import { route, ROUTES } from '../../../lib/routes';
import SealBadge from '../../../components/SealBadge';
import SyncConflictResolver from '../../../components/SyncConflictResolver';
import { resolveTechnicianId } from '../../../lib/utils/technicianIdNormalization';
import { sealEvidence } from '../../../lib/sealing';
import { isFeatureEnabled } from '../../../lib/featureFlags';
import { toast } from '../../../lib/toast';

const JobDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userEmail } = useAuth();

  // Use DataContext for centralized state management (CLAUDE.md mandate)
  const {
    jobs,
    clients,
    technicians,
    updateJob: contextUpdateJob,
    deleteJob: contextDeleteJob,
    isLoading: dataLoading
  } = useData();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [, setDeleteError] = useState<string | null>(null);

  // Magic link state
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [mailClientOpened, setMailClientOpened] = useState(false);

  // Seal-on-dispatch state (Phase C.3)
  const [, setSealingOnDispatch] = useState(false);
  const [, setSealError] = useState<string | null>(null);

  // Report generation state
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // Sync conflict state (Fix 3.3)
  const [unresolvedConflict, setUnresolvedConflict] = useState(false);

  // Derive job, client, technician from DataContext (memoized for performance)
  const job = useMemo(() => jobs.find(j => j.id === id) || null, [jobs, id]);
  const client = useMemo(() =>
    job ? clients.find(c => c.id === job.clientId) || null : null,
    [clients, job]
  );
  // Sprint 2 Task 2.6: Use normalized technician ID for consistent lookup
  const technician = useMemo(() => {
    if (!job) return null;
    const resolved = resolveTechnicianId(job);
    return resolved.assignedTechnicianId
      ? technicians.find(t => t.id === resolved.assignedTechnicianId) || null
      : null;
  }, [technicians, job]);

  // Initialize magic link from job data
  useEffect(() => {
    if (job?.magicLinkUrl && !magicLink) {
      setMagicLink(job.magicLinkUrl);
    }
  }, [job, magicLink]);

  const loading = dataLoading;

  const handleDelete = async () => {
    if (!job) return;

    // Prevent deletion of sealed or invoiced jobs
    if (job.sealedAt) {
      setDeleteError('Cannot delete a sealed job. Sealed evidence must be preserved.');
      return;
    }
    if (job.invoiceId) {
      setDeleteError('Cannot delete a job with an invoice. Delete the invoice first.');
      return;
    }

    setDeleting(true);
    setDeleteError(null);
    try {
      await contextDeleteJob(job.id);
      navigate(ROUTES.JOBS);
    } catch {
      setDeleteError('Failed to delete job. Please try again.');
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  // Check if job can be deleted
  const canDelete = job && !job.sealedAt && !job.invoiceId;

  // Handle conflict resolution (Fix 3.3)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleResolveConflict = (_resolution: 'local' | 'remote' | 'manual') => {
    // In a full implementation, this would:
    // 1. Save the resolution to IndexedDB syncConflicts table
    // 2. Apply the resolution (merge local/remote/manual)
    // 3. Sync the result back to server
    setUnresolvedConflict(false);
  };

  const handleAssignTech = async (techId: string) => {
    if (!job) return;

    // Validate technician exists
    const tech = technicians.find(t => t.id === techId);
    if (!tech) {
      toast.error('Technician not found. Please try again.');
      return;
    }

    setAssigning(true);
    try {
      // Sprint 2 Task 2.6: Use single field - DataContext normalizes to both techId and technicianId
      const updatedJob: Job = {
        ...job,
        technicianId: techId,
        technician: tech.name, // Update display name too
        techEmail: tech.email, // Store email for TechPortal matching (tech table ID != auth UID)
      };
      contextUpdateJob(updatedJob);
      setShowAssignModal(false);
    } catch (error) {
      console.error('Failed to assign technician:', error);
      toast.error('Failed to assign technician. Please try again.');
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
        toast.error('Cannot generate link: Your email is not available. Please log in again.');
        setGeneratingLink(false);
        return;
      }
      const result = await generateMagicLink(job.id, userEmail);
      if (result.success && result.data) {
        setMagicLink(result.data.url);
        // Store magic link on job via DataContext
        const updatedJob: Job = {
          ...job,
          magicLinkToken: result.data.token,
          magicLinkUrl: result.data.url,
        };
        contextUpdateJob(updatedJob);
      } else {
        throw new Error(result.error || 'Failed to generate link');
      }
    } catch (error) {
      console.error('Failed to generate magic link:', error);
      toast.error('Failed to generate link. Please try again.');
    } finally {
      setGeneratingLink(false);
    }
  };

  // Seal-on-dispatch helper - seals evidence before any dispatch action
  const performSealOnDispatch = async (): Promise<boolean> => {
    if (!job || !isFeatureEnabled('SEAL_ON_DISPATCH') || job.sealedAt) return true;

    setSealingOnDispatch(true);
    setSealError(null);
    try {
      const sealResult = await sealEvidence(job.id);
      if (!sealResult.success) {
        setSealError(sealResult.error || 'Failed to seal evidence before dispatch');
        return false;
      }
      const updatedJob: Job = {
        ...job,
        sealedAt: sealResult.sealedAt,
        evidenceHash: sealResult.evidenceHash,
      };
      contextUpdateJob(updatedJob);
      return true;
    } catch (error) {
      console.error('[JobDetail] Seal-on-dispatch error:', error);
      setSealError(error instanceof Error ? error.message : 'Sealing failed');
      return false;
    } finally {
      setSealingOnDispatch(false);
    }
  };

  // Send Report — triggers edge function to generate PDF + email
  const handleSendReport = async () => {
    if (!job) return;
    setGeneratingReport(true);
    setReportError(null);
    setReportSent(false);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseKey) {
        setReportError('Supabase not configured');
        return;
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/generate-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          jobId: job.id,
          title: job.title,
          client: client?.name || job.client || '',
          address: job.address || '',
          managerEmail: userEmail || '',
          clientEmail: client?.email || '',
          technicianName: technician?.name || job.technician || '',
          completedAt: job.completedAt || job.date,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setReportSent(true);
        if (result.emailError) {
          setReportError(`PDF generated but email failed: ${result.emailError}`);
        }
        setTimeout(() => setReportSent(false), 5000);
      } else {
        setReportError(`Report generation failed (${response.status})`);
      }
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setGeneratingReport(false);
    }
  };

  // Copy magic link to clipboard (with seal-on-dispatch)
  const handleCopyLink = async () => {
    if (!magicLink) return;

    const sealed = await performSealOnDispatch();
    if (!sealed) return;

    try {
      await navigator.clipboard.writeText(magicLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Send email to technician (with seal-on-dispatch)
  const handleSendEmail = async () => {
    if (!magicLink || !technician || !job) return;

    setSealError(null);
    const sealed = await performSealOnDispatch();
    if (!sealed) return;

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
    // Note: This only opens the mail client - we cannot confirm if user actually sends
    setMailClientOpened(true);
    setTimeout(() => setMailClientOpened(false), 3000);
  };

  // Share via Web Share API (with seal-on-dispatch)
  const handleShare = async () => {
    if (!magicLink || !navigator.share) return;

    const sealed = await performSealOnDispatch();
    if (!sealed) return;

    try {
      await navigator.share({
        title: `Job: ${job?.title || 'New Job'}`,
        text: `Access your assigned job: ${job?.title}`,
        url: magicLink,
      });
    } catch (error) {
      // User cancelled or share failed
    }
  };

  // Calculate magic link expiry countdown
  const getExpiryInfo = (): { text: string; isUrgent: boolean; isExpired: boolean } => {
    if (!job?.magicLinkCreatedAt && !job?.magicLinkToken) {
      return { text: 'Expires in 7 days', isUrgent: false, isExpired: false };
    }

    const createdAt = job.magicLinkCreatedAt ? new Date(job.magicLinkCreatedAt).getTime() : Date.now();
    const expiresAt = createdAt + 7 * 24 * 60 * 60 * 1000; // 7 days
    const remaining = expiresAt - Date.now();

    if (remaining <= 0) {
      return { text: 'Link expired - generate a new one', isUrgent: true, isExpired: true };
    }

    const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
    const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

    if (days > 1) {
      return { text: `Expires in ${days} days`, isUrgent: false, isExpired: false };
    }
    if (days === 1) {
      return { text: `Expires in ${days} day, ${hours} hours`, isUrgent: true, isExpired: false };
    }
    if (hours > 0) {
      return { text: `Expires in ${hours} hours`, isUrgent: true, isExpired: false };
    }
    return { text: 'Expires soon!', isUrgent: true, isExpired: false };
  };

  const expiryInfo = getExpiryInfo();

  // Get computed status - proof-based: each stage requires evidence of progression
  const getJobStatus = (): 'draft' | 'assigned' | 'sent' | 'active' | 'review' | 'sealed' | 'invoiced' | 'archived' => {
    if (!job) return 'draft';
    if (job.status === 'Archived') return 'archived';
    if (job.invoiceId) return 'invoiced';
    if (job.sealedAt) return 'sealed';
    if (job.status === 'Complete' || job.status === 'Submitted') return 'review';
    if (job.status === 'In Progress') return 'active';
    if (job.magicLinkUrl) return 'sent';
    if (job.technicianId || job.techId) return 'assigned';
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
  const canSend = (status === 'assigned' || status === 'sent' || technician) && !job.sealedAt && status !== 'archived';

  // Show conflict resolver if conflict is unresolved (Fix 3.3)
  if (unresolvedConflict && job) {
    return (
      <div>
        <PageHeader title={job.title || `Job #${job.id.slice(0, 6)}`} backTo={ROUTES.JOBS} backLabel="Jobs" />
        <PageContent>
          <SyncConflictResolver
            conflict={{
              jobId: job.id,
              local: job,
              remote: job, // In real scenario, would fetch from conflict history
              conflictFields: ['status'],
              detectedAt: new Date().toISOString(),
              resolved: false,
              resolution: null,
            }}
            onResolve={handleResolveConflict}
            onDismiss={() => setUnresolvedConflict(false)}
          />
        </PageContent>
      </div>
    );
  }

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
          ...(status === 'sealed' ? [{
            label: generatingReport ? 'Sending...' : reportSent ? 'Report Sent' : 'Send Report',
            icon: reportSent ? 'check_circle' : 'summarize',
            onClick: handleSendReport,
            variant: 'primary' as const,
            disabled: generatingReport || reportSent,
          }] : []),
          ...(status === 'sealed' && !job.invoiceId ? [{
            label: 'Generate Invoice',
            icon: 'receipt',
            to: `${ROUTES.INVOICES}?jobId=${job.id}`,
            variant: 'secondary' as const,
          }] : []),
          { label: 'Edit', icon: 'edit', to: route(ROUTES.JOB_EDIT, { id: job.id }) },
          // Only show delete for jobs that can be deleted (not sealed, not invoiced)
          ...(canDelete ? [{
            label: 'Delete',
            icon: 'delete',
            onClick: () => setShowDeleteDialog(true),
            variant: 'danger' as const,
          }] : []),
        ]}
      />

      <PageContent>
        {/* Status Banner - proof-based: shows actual stage, not assumed progress */}
        <div className={`p-4 rounded-2xl mb-6 flex items-center gap-4 ${
          status === 'archived' ? 'bg-slate-700/50 border border-slate-600/50' :
          status === 'sealed' ? 'bg-emerald-500/10 border border-emerald-500/20' :
          status === 'review' ? 'bg-purple-500/10 border border-purple-500/20' :
          status === 'active' ? 'bg-amber-500/10 border border-amber-500/20' :
          status === 'sent' ? 'bg-blue-500/10 border border-blue-500/20' :
          status === 'assigned' ? 'bg-indigo-500/10 border border-indigo-500/20' :
          status === 'invoiced' ? 'bg-cyan-500/10 border border-cyan-500/20' :
          'bg-slate-800 border border-white/10'
        }`}>
          <div className={`size-12 rounded-xl flex items-center justify-center ${
            status === 'archived' ? 'bg-slate-600 text-slate-300' :
            status === 'sealed' ? 'bg-emerald-500/20 text-emerald-400' :
            status === 'review' ? 'bg-purple-500/20 text-purple-400' :
            status === 'active' ? 'bg-amber-500/20 text-amber-400' :
            status === 'sent' ? 'bg-blue-500/20 text-blue-400' :
            status === 'assigned' ? 'bg-indigo-500/20 text-indigo-400' :
            status === 'invoiced' ? 'bg-cyan-500/20 text-cyan-400' :
            'bg-slate-700 text-slate-400'
          }`}>
            <span className="material-symbols-outlined text-2xl">
              {status === 'archived' ? 'archive' :
               status === 'sealed' ? 'verified' :
               status === 'review' ? 'rate_review' :
               status === 'active' ? 'pending' :
               status === 'sent' ? 'mark_email_read' :
               status === 'assigned' ? 'person' :
               status === 'invoiced' ? 'receipt' :
               'edit_note'}
            </span>
          </div>
          <div className="flex-1">
            <p className="font-medium text-white">
              {status === 'archived' ? 'Archived' :
               status === 'sealed' ? 'Cryptographically Sealed' :
               status === 'review' ? 'Ready for Review' :
               status === 'active' ? 'Work In Progress' :
               status === 'sent' ? 'Link Sent to Technician' :
               status === 'assigned' ? 'Technician Assigned' :
               status === 'invoiced' ? 'Invoiced' :
               'Draft - Needs Technician'}
            </p>
            <p className="text-sm text-slate-400">
              {status === 'archived' ? job?.archivedAt ? `Archived on ${new Date(job.archivedAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}` : 'Job archived' :
               status === 'sealed' ? 'Evidence has been sealed and verified' :
               status === 'review' ? 'Evidence uploaded, awaiting seal' :
               status === 'active' ? 'Technician is working on this job' :
               status === 'sent' ? 'Waiting for technician to start work' :
               status === 'assigned' ? 'Generate and send link to technician' :
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
            <span className="text-red-400 text-sm font-medium">Urgent Priority</span>
          </div>
        )}

        {/* Seal Badge (if sealed) */}
        {job.sealedAt && (
          <div className="mb-6">
            <SealBadge jobId={job.id} />
          </div>
        )}

        {/* Report status feedback */}
        {reportError && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
            <span className="material-symbols-outlined text-red-400">error</span>
            <span className="text-red-400 text-sm font-medium flex-1">{reportError}</span>
            <button onClick={() => setReportError(null)} className="text-red-400 hover:text-red-300 min-h-[44px] min-w-[44px] flex items-center justify-center">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        )}
        {reportSent && !reportError && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
            <span className="material-symbols-outlined text-emerald-400">check_circle</span>
            <span className="text-emerald-400 text-sm font-medium">Report generated and sent successfully</span>
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
              {/* Magic Link Display with Dynamic Expiry */}
              <div className="p-4 bg-slate-800 rounded-xl">
                <p className="text-xs text-slate-400 uppercase font-bold mb-2">Job Access Link</p>
                <p className="text-sm text-white font-mono break-all">{magicLink}</p>
                <p className={`text-xs mt-2 flex items-center gap-1 ${
                  expiryInfo.isExpired ? 'text-red-400' :
                  expiryInfo.isUrgent ? 'text-amber-400' :
                  'text-slate-500'
                }`}>
                  {expiryInfo.isUrgent && (
                    <span className="material-symbols-outlined text-sm">warning</span>
                  )}
                  {expiryInfo.text}
                </p>
              </div>

              {/* Prominent Resend Button - Show when link exists */}
              <button
                onClick={handleGenerateMagicLink}
                disabled={generatingLink}
                className={`w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                  expiryInfo.isExpired || expiryInfo.isUrgent
                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                    : 'bg-slate-700 hover:bg-slate-600 text-white'
                }`}
              >
                {generatingLink ? (
                  <>
                    <span className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">refresh</span>
                    {expiryInfo.isExpired ? 'Generate New Link' : 'Resend with New Link'}
                  </>
                )}
              </button>

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
                      mailClientOpened
                        ? 'bg-amber-500 text-white'
                        : 'bg-primary hover:bg-primary-hover text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">
                      {mailClientOpened ? 'open_in_new' : 'email'}
                    </span>
                    {mailClientOpened ? 'Mail App Opened' : 'Open Mail App'}
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
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default JobDetail;
