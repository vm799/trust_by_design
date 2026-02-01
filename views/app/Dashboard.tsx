/**
 * Dashboard - Action-First Manager Dashboard
 *
 * Redesigned based on UX Architecture v2.0
 * Single question: "Which job needs proof right now?"
 *
 * NO vanity metrics. NO decorative greetings. ONLY actions.
 */

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, PageContent } from '../../components/layout';
import { Card, ActionButton, EmptyState, LoadingSkeleton } from '../../components/ui';
import { useData } from '../../lib/DataContext';
import { route, ROUTES } from '../../lib/routes';
import { Job, Client, Technician } from '../../types';

/**
 * Evidence status determination
 * A job is "defensible" only when it has complete evidence chain
 */
type EvidenceStatus = 'no_evidence' | 'partial_evidence' | 'ready_to_seal' | 'sealed' | 'invoiced';

interface JobWithEvidence {
  job: Job;
  client: Client | undefined;
  technician: Technician | undefined;
  evidenceStatus: EvidenceStatus;
  actionLabel: string;
  actionRoute: string;
  urgencyLevel: 'critical' | 'warning' | 'ready' | 'complete';
}

/**
 * Determine evidence status for a job
 * This is the core business logic - when is a job "defensible"?
 */
function getEvidenceStatus(job: Job): EvidenceStatus {
  // Already invoiced - fully complete
  if (job.invoiceId) {
    return 'invoiced';
  }

    // SPRINT 4 FIX: Jobs ready for sealing (Submitted status, not sealed)
    // Sealing requires: status=Submitted, photos, signature, signer name
    // Jobs in "Complete" need manager review → "Submit" before they can be sealed
    jobs
      .filter(j => j.status === 'Submitted' && !j.sealedAt)
      .slice(0, 3)
      .forEach(job => {
        const hasPhotos = job.photos && job.photos.length > 0;
        const hasSignature = !!job.signature && !!job.signerName;
        items.push({
          id: `seal-${job.id}`,
          type: 'seal',
          title: `Job #${job.id.slice(0, 6)}`,
          subtitle: hasPhotos && hasSignature
            ? 'Ready to seal evidence'
            : `Missing: ${!hasPhotos ? 'photos' : ''}${!hasPhotos && !hasSignature ? ', ' : ''}${!hasSignature ? 'signature' : ''}`,
          action: { label: 'Review & Seal', to: route(ROUTES.JOB_EVIDENCE, { id: job.id }) },
          urgency: hasPhotos && hasSignature ? 'medium' : 'high',
        });
      });

    // Jobs in Complete status need manager review before sealing
    jobs
      .filter(j => j.status === 'Complete' && !j.sealedAt)
      .slice(0, 3)
      .forEach(job => {
        const client = clients.find(c => c.id === job.clientId);
        items.push({
          id: `review-${job.id}`,
          type: 'seal',
          title: `Job #${job.id.slice(0, 6)}`,
          subtitle: `Needs review${client ? ` - ${client.name}` : ''}`,
          action: { label: 'Review Evidence', to: route(ROUTES.JOB_EVIDENCE, { id: job.id }) },
          urgency: 'medium',
        });
      });

  const hasPhotos = job.photos && job.photos.length > 0;
  const hasSignature = !!job.signature;

  // Has both photos and signature - ready to seal
  if (hasPhotos && hasSignature) {
    return 'ready_to_seal';
  }

  // Has some evidence but incomplete
  if (hasPhotos || hasSignature) {
    return 'partial_evidence';
  }

  // No evidence at all
  return 'no_evidence';
}

/**
 * Get action details for a job based on evidence status
 */
function getJobAction(job: Job, status: EvidenceStatus): { label: string; route: string; urgency: 'critical' | 'warning' | 'ready' | 'complete' } {
  switch (status) {
    case 'no_evidence':
      return {
        label: 'Capture Evidence',
        route: route(ROUTES.JOB_DETAIL, { id: job.id }),
        urgency: 'critical',
      };
    case 'partial_evidence':
      return {
        label: job.signature ? 'Add Photos' : 'Get Signature',
        route: route(ROUTES.JOB_DETAIL, { id: job.id }),
        urgency: 'warning',
      };
    case 'ready_to_seal':
      return {
        label: 'Seal Evidence',
        route: route(ROUTES.JOB_EVIDENCE, { id: job.id }),
        urgency: 'ready',
      };
    case 'sealed':
      return {
        label: 'Generate Invoice',
        route: route(ROUTES.JOB_DETAIL, { id: job.id }),
        urgency: 'complete',
      };
    case 'invoiced':
      return {
        label: 'View Invoice',
        route: route(ROUTES.INVOICE_DETAIL, { id: job.invoiceId || '' }),
        urgency: 'complete',
      };
  }
}

const Dashboard: React.FC = () => {
  // Use DataContext - the ONLY source of truth (CLAUDE.md mandate)
  const { jobs, clients, technicians, isLoading, error, refresh } = useData();

  // Memoize job categorization to prevent recalculation
  const { needsProof, readyToSeal, recentlySealed, allJobsWithEvidence } = useMemo(() => {
    const jobsWithEvidence: JobWithEvidence[] = jobs.map(job => {
      const status = getEvidenceStatus(job);
      const action = getJobAction(job, status);
      return {
        job,
        client: clients.find(c => c.id === job.clientId),
        technician: technicians.find(t => t.id === job.technicianId),
        evidenceStatus: status,
        actionLabel: action.label,
        actionRoute: action.route,
        urgencyLevel: action.urgency,
      };
    });

    // Jobs that need proof NOW (no evidence or partial)
    const needsProofJobs = jobsWithEvidence
      .filter(j => j.evidenceStatus === 'no_evidence' || j.evidenceStatus === 'partial_evidence')
      .filter(j => j.job.status !== 'Complete' && j.job.status !== 'Submitted')
      .sort((a, b) => {
        // Critical first, then by date
        if (a.urgencyLevel === 'critical' && b.urgencyLevel !== 'critical') return -1;
        if (b.urgencyLevel === 'critical' && a.urgencyLevel !== 'critical') return 1;
        return new Date(a.job.date).getTime() - new Date(b.job.date).getTime();
      });

    // Jobs ready to seal
    const readyToSealJobs = jobsWithEvidence
      .filter(j => j.evidenceStatus === 'ready_to_seal');

    // Recently sealed (for invoice generation)
    const recentlySealedJobs = jobsWithEvidence
      .filter(j => j.evidenceStatus === 'sealed')
      .slice(0, 5);

    return {
      needsProof: needsProofJobs,
      readyToSeal: readyToSealJobs,
      recentlySealed: recentlySealedJobs,
      allJobsWithEvidence: jobsWithEvidence,
    };
  }, [jobs, clients, technicians]);

  // Loading state
  if (isLoading) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <PageContent>
          <LoadingSkeleton variant="card" count={3} />
        </PageContent>
      </div>
    );
  }

  // Error state with retry
  if (error) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <PageContent>
          <Card className="text-center py-8">
            <span className="material-symbols-outlined text-4xl text-red-400 mb-4">error</span>
            <p className="text-white font-medium mb-2">Failed to load data</p>
            <p className="text-slate-400 text-sm mb-4">{error}</p>
            <ActionButton variant="secondary" onClick={refresh} icon="refresh">
              Retry
            </ActionButton>
          </Card>
        </PageContent>
      </div>
    );
  }

  // Empty state - no jobs yet
  if (jobs.length === 0) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <PageContent>
          <EmptyState
            icon="work"
            title="No jobs yet"
            description="Create your first job to start capturing evidence."
            action={{ label: 'Create First Job', to: ROUTES.JOB_NEW, icon: 'add' }}
          />
        </PageContent>
      </div>
    );
  }

  return (
    <div>
      {/* Minimal header with primary action */}
      <div className="px-4 lg:px-8 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-white">Dashboard</h1>
          {/* Evidence summary - single line */}
          <div className="hidden sm:flex items-center gap-3 text-xs text-slate-400">
            {needsProof.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-red-500" />
                {needsProof.length} need proof
              </span>
            )}
            {readyToSeal.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-amber-500" />
                {readyToSeal.length} ready to seal
              </span>
            )}
          </div>
        </div>
        <ActionButton variant="primary" icon="add" to={ROUTES.JOB_NEW}>
          Start Job
        </ActionButton>
      </div>

      <PageContent>
        {/* SECTION 1: NEEDS PROOF NOW - Primary concern */}
        {needsProof.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="size-8 rounded-xl bg-red-500/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-red-400">priority_high</span>
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Needs Proof Now</h2>
                <p className="text-xs text-slate-400">{needsProof.length} job{needsProof.length !== 1 ? 's' : ''} missing evidence</p>
              </div>
            </div>

            <div className="space-y-3">
              {needsProof.slice(0, 10).map(({ job, client, technician, actionLabel, actionRoute, urgencyLevel, evidenceStatus }) => (
                <Card key={job.id} variant="interactive" className={urgencyLevel === 'critical' ? 'border-red-500/30' : 'border-amber-500/30'}>
                  <div className="flex items-center gap-4">
                    {/* Status indicator */}
                    <div className={`size-10 rounded-xl flex items-center justify-center ${
                      urgencyLevel === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      <span className="material-symbols-outlined">
                        {evidenceStatus === 'no_evidence' ? 'photo_camera' : 'edit_document'}
                      </span>
                    </div>

                    {/* Job info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">
                        {job.title || `Job #${job.id.slice(0, 6)}`}
                      </p>
                      <p className="text-sm text-slate-400 truncate">
                        {client?.name || 'Unknown client'}
                        {technician && ` • ${technician.name}`}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {evidenceStatus === 'no_evidence' ? 'No evidence captured' : 'Missing: ' + (job.signature ? 'photos' : 'signature')}
                      </p>
                    </div>

                    {/* Action button */}
                    <ActionButton
                      variant={urgencyLevel === 'critical' ? 'danger' : 'warning'}
                      size="sm"
                      to={actionRoute}
                    >
                      {actionLabel}
                    </ActionButton>
                  </div>
                </Card>
              ))}

              {needsProof.length > 10 && (
                <Link to={ROUTES.JOBS} className="block text-center py-3 text-sm text-primary hover:text-primary/80">
                  View all {needsProof.length} jobs needing proof
                </Link>
              )}
            </div>
          </section>
        )}

        {/* SECTION 2: READY TO SEAL - Secondary concern */}
        {readyToSeal.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="size-8 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-emerald-400">verified</span>
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Ready to Seal</h2>
                <p className="text-xs text-slate-400">{readyToSeal.length} job{readyToSeal.length !== 1 ? 's' : ''} with complete evidence</p>
              </div>
            </div>

            <div className="space-y-3">
              {readyToSeal.slice(0, 5).map(({ job, client, actionRoute }) => (
                <Card key={job.id} variant="interactive" className="border-emerald-500/30">
                  <div className="flex items-center gap-4">
                    {/* Status indicator */}
                    <div className="size-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <span className="material-symbols-outlined">lock_open</span>
                    </div>

                    {/* Job info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">
                        {job.title || `Job #${job.id.slice(0, 6)}`}
                      </p>
                      <p className="text-sm text-slate-400 truncate">
                        {client?.name || 'Unknown client'}
                      </p>
                      <p className="text-xs text-emerald-400 mt-0.5">
                        Evidence complete • Ready to seal
                      </p>
                    </div>

                    {/* Action button */}
                    <ActionButton variant="success" size="sm" to={actionRoute}>
                      Seal Evidence
                    </ActionButton>
                  </div>
                </Card>
              ))}

              {readyToSeal.length > 5 && (
                <Link to={`${ROUTES.JOBS}?status=review`} className="block text-center py-3 text-sm text-primary hover:text-primary/80">
                  View all {readyToSeal.length} ready to seal
                </Link>
              )}
            </div>
          </section>
        )}

        {/* SECTION 3: RECENTLY SEALED - Tertiary (for invoicing) */}
        {recentlySealed.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-blue-400">receipt_long</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Ready for Invoice</h2>
                  <p className="text-xs text-slate-400">{recentlySealed.length} sealed job{recentlySealed.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <Link to={ROUTES.INVOICES} className="text-sm text-primary hover:text-primary/80">
                View Invoices
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentlySealed.map(({ job, client, actionRoute }) => (
                <Link key={job.id} to={actionRoute}>
                  <Card variant="interactive" padding="sm">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                        <span className="material-symbols-outlined text-sm">lock</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {job.title || `Job #${job.id.slice(0, 6)}`}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {client?.name || 'Unknown'}
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ALL CAUGHT UP STATE */}
        {needsProof.length === 0 && readyToSeal.length === 0 && (
          <section className="mb-8">
            <Card className="text-center py-12">
              <div className="size-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl text-emerald-400">verified_user</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">All Jobs Protected</h3>
              <p className="text-slate-400 text-sm mb-6">
                No jobs need evidence. All active jobs are defensible.
              </p>
              <ActionButton variant="secondary" to={ROUTES.JOBS} icon="list">
                View All Jobs
              </ActionButton>
            </Card>
          </section>
        )}

        {/* Quick links - minimal, collapsed */}
        <section>
          <details className="group">
            <summary className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer hover:text-slate-300 py-2">
              <span className="material-symbols-outlined text-sm transition-transform group-open:rotate-90">chevron_right</span>
              Quick Actions
            </summary>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
              <Link to={ROUTES.JOBS}>
                <Card variant="interactive" padding="sm">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-slate-400">list</span>
                    <span className="text-sm text-white">All Jobs</span>
                  </div>
                </Card>
              </Link>
              <Link to={ROUTES.CLIENTS}>
                <Card variant="interactive" padding="sm">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-slate-400">people</span>
                    <span className="text-sm text-white">Clients</span>
                  </div>
                </Card>
              </Link>
              <Link to={ROUTES.TECHNICIANS}>
                <Card variant="interactive" padding="sm">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-slate-400">engineering</span>
                    <span className="text-sm text-white">Technicians</span>
                  </div>
                </Card>
              </Link>
              <Link to={ROUTES.INVOICES}>
                <Card variant="interactive" padding="sm">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-slate-400">receipt</span>
                    <span className="text-sm text-white">Invoices</span>
                  </div>
                </Card>
              </Link>
            </div>
          </details>
        </section>
      </PageContent>
    </div>
  );
};

export default Dashboard;
