/**
 * EvidenceReview - Stepped Evidence Review + Seal Workflow
 *
 * 3-step guided flow for manager evidence review and sealing:
 *   Step 1: Review Evidence (photo gallery + integrity metrics)
 *   Step 2: Client Attestation (signature via ClientConfirmationCanvas)
 *   Step 3: Seal & Certificate (inline cryptographic sealing)
 *
 * Once sealed, displays the full forensic report in read-only mode.
 *
 * Phase E: Job Lifecycle / Phase H: Seal & Verify
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PageHeader, PageContent } from '../../../components/layout';
import { Card, EmptyState, LoadingSkeleton, ActionButton } from '../../../components/ui';
import { useData } from '../../../lib/DataContext';
import { route, ROUTES } from '../../../lib/routes';
import { fadeInUp, staggerContainer, tapShrink } from '../../../lib/animations';
import SealBadge from '../../../components/SealBadge';
import BottomSheet from '../../../components/ui/BottomSheet';
import { resolveTechnicianId } from '../../../lib/utils/technicianIdNormalization';
import { sealEvidence, canSealJob } from '../../../lib/sealing';
import SealingProgressModal, { SealingStatus } from '../../../components/ui/SealingProgressModal';
import ClientConfirmationCanvas from '../../../components/ClientConfirmationCanvas';
import SealCertificate from '../../../components/SealCertificate';
import { Job, JobStatus } from '../../../types';
import { hapticFeedback, showToast, celebrateSuccess } from '../../../lib/microInteractions';

interface Photo {
  id?: string;
  url?: string;
  localPath?: string;
  type?: 'before' | 'during' | 'after';
  timestamp?: string;
  location?: { lat: number; lng: number; accuracy?: number };
  lat?: number;
  lng?: number;
  gps_accuracy?: number;
  w3w?: string;
  w3w_verified?: boolean;
  photo_hash?: string;
  hash?: string;
  syncStatus?: 'pending' | 'synced' | 'failed';
  device_info?: { make?: string; model?: string; os?: string };
}

const REVIEW_STEPS = [
  { id: 'review', label: 'Review Evidence', icon: 'photo_library' },
  { id: 'attest', label: 'Client Attestation', icon: 'draw' },
  { id: 'seal', label: 'Seal & Certify', icon: 'verified' },
] as const;

const EvidenceReview: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const { jobs, clients, technicians, isLoading: loading, updateJob: contextUpdateJob } = useData();

  const job = useMemo(() => jobs.find(j => j.id === id) || null, [jobs, id]);
  const client = useMemo(() =>
    job ? clients.find(c => c.id === job.clientId) || null : null,
    [clients, job]
  );
  const technician = useMemo(() => {
    if (!job) return null;
    const resolved = resolveTechnicianId(job);
    return resolved.assignedTechnicianId
      ? technicians.find(t => t.id === resolved.assignedTechnicianId) || null
      : null;
  }, [technicians, job]);

  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  // Stepper state - skip steps if already sealed
  const [currentStep, setCurrentStep] = useState(0);

  // Sealing state
  const [sealingModalOpen, setSealingModalOpen] = useState(false);
  const [sealingStatus, setSealingStatus] = useState<SealingStatus>('hashing');
  const [sealingProgress, setSealingProgress] = useState(0);
  const [sealingError, setSealingError] = useState<string | undefined>();
  const [showCertificate, setShowCertificate] = useState(false);

  const photos = useMemo(() => (job?.photos || []) as Photo[], [job]);
  const isSealed = Boolean(job?.sealedAt);

  const grouped = useMemo(() => {
    const before = photos.filter(p => p.type === 'before');
    const during = photos.filter(p => p.type === 'during');
    const after = photos.filter(p => p.type === 'after');
    const other = photos.filter(p => !p.type);
    return { before, during, after, other };
  }, [photos]);

  // Compute integrity summary
  const integritySummary = useMemo(() => {
    const total = photos.length;
    const withGPS = photos.filter(p => p.lat || p.lng || p.location).length;
    const withW3W = photos.filter(p => p.w3w).length;
    const w3wVerified = photos.filter(p => p.w3w_verified).length;
    const withHash = photos.filter(p => p.photo_hash || p.hash).length;
    return { total, withGPS, withW3W, w3wVerified, withHash };
  }, [photos]);

  // Handle client attestation confirmation
  const handleAttestationConfirmed = useCallback((signature: string, timestamp: string) => {
    if (!job) return;
    const updatedJob: Job = {
      ...job,
      signature,
      clientConfirmation: {
        confirmed: true,
        signature,
        timestamp,
      },
    };
    contextUpdateJob(updatedJob);
    hapticFeedback('success');
    showToast('Client attestation saved', 'success');
    setCurrentStep(2); // Advance to seal step
  }, [job, contextUpdateJob]);

  // Handle inline sealing
  const handleSealJob = useCallback(async () => {
    if (!job) return;

    setSealingModalOpen(true);
    setSealingStatus('hashing');
    setSealingProgress(15);
    setSealingError(undefined);

    try {
      // Progress simulation for UX feedback
      const progressTimer = setInterval(() => {
        setSealingProgress(prev => {
          if (prev >= 85) { clearInterval(progressTimer); return prev; }
          return prev + 10;
        });
      }, 400);

      setSealingStatus('signing');
      setSealingProgress(40);

      const result = await sealEvidence(job.id);

      clearInterval(progressTimer);

      if (result.success) {
        setSealingStatus('storing');
        setSealingProgress(90);

        // Update job in DataContext with seal metadata
        const sealedJob: Job = {
          ...job,
          status: (result.job_status as JobStatus) || 'Submitted',
          sealedAt: result.sealedAt,
          evidenceHash: result.evidenceHash,
          isSealed: true,
        };
        contextUpdateJob(sealedJob);

        setSealingProgress(100);
        setSealingStatus('complete');
        celebrateSuccess();
      } else {
        setSealingStatus('error');
        setSealingError(result.error || 'Sealing failed. Please try again.');
      }
    } catch (err) {
      setSealingStatus('error');
      setSealingError(err instanceof Error ? err.message : 'Unexpected error during sealing');
    }
  }, [job, contextUpdateJob]);

  // Handle seal retry
  const handleSealRetry = useCallback(() => {
    setSealingModalOpen(false);
    setSealingError(undefined);
    handleSealJob();
  }, [handleSealJob]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Evidence Report" backTo={ROUTES.JOBS} backLabel="Jobs" />
        <PageContent>
          <LoadingSkeleton variant="card" count={3} />
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

  return (
    <div>
      <PageHeader
        title="Evidence Report"
        subtitle={job.title || `Job #${job.id.slice(0, 6)}`}
        backTo={route(ROUTES.JOB_DETAIL, { id: job.id })}
        backLabel="Job Details"
      />

      <PageContent>
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-8 max-w-5xl mx-auto"
        >
          {/* ============================================================ */}
          {/* SECTION 1: REPORT HEADER */}
          {/* ============================================================ */}
          <motion.div variants={fadeInUp}>
            <div className={`rounded-2xl p-6 border-2 ${
              isSealed
                ? 'bg-gradient-to-br from-emerald-950/50 to-slate-900 border-emerald-500/30'
                : 'bg-gradient-to-br from-slate-50 dark:from-slate-900 to-gray-100 dark:to-slate-800 border-slate-200 dark:border-white/10'
            }`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`material-symbols-outlined text-3xl ${isSealed ? 'text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                      {isSealed ? 'verified' : 'description'}
                    </span>
                    <div>
                      <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
                        {job.title || 'Untitled Job'}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        REF: {job.id.slice(0, 8).toUpperCase()}
                      </p>
                    </div>
                  </div>
                </div>
                <div className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest ${
                  isSealed
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : job.status === 'Submitted'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'bg-gray-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10'
                }`}>
                  {isSealed ? 'Cryptographically Sealed' : job.status === 'Submitted' ? 'Awaiting Seal' : 'Under Review'}
                </div>
              </div>
            </div>
          </motion.div>

          {/* ============================================================ */}
          {/* SECTION 2: JOB SUMMARY */}
          {/* ============================================================ */}
          <motion.div variants={fadeInUp}>
            <Card>
              <h3 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-4">
                Job Summary
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Date */}
                <div>
                  <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Date</p>
                  <p className="text-sm text-slate-900 dark:text-white font-medium">
                    {new Date(job.date).toLocaleDateString('en-GB', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>

                {/* Client */}
                <div>
                  <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Client</p>
                  <p className="text-sm text-slate-900 dark:text-white font-medium">{client?.name || job.client || 'N/A'}</p>
                  {client?.email && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">{client.email}</p>
                  )}
                </div>

                {/* Technician */}
                <div>
                  <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Technician</p>
                  <p className="text-sm text-slate-900 dark:text-white font-medium">{technician?.name || job.technician || 'N/A'}</p>
                  {technician?.email && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">{technician.email}</p>
                  )}
                </div>

                {/* Location */}
                <div>
                  <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Location</p>
                  <p className="text-sm text-slate-900 dark:text-white font-medium">{job.address || 'N/A'}</p>
                  {job.w3w && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-mono">{'///'}{job.w3w}</p>
                  )}
                </div>
              </div>

              {/* Description */}
              {(job.description || job.notes) && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/15">
                  <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Description</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{job.description || job.notes}</p>
                </div>
              )}

              {/* Amount */}
              {(job.total || job.price) && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/15 flex items-center justify-between">
                  <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Total Amount</p>
                  <p className="text-lg font-black text-slate-900 dark:text-white">£{(job.total || job.price || 0).toFixed(2)}</p>
                </div>
              )}
            </Card>
          </motion.div>

          {/* ============================================================ */}
          {/* SECTION 3: EVIDENCE INTEGRITY SUMMARY */}
          {/* ============================================================ */}
          <motion.div variants={fadeInUp}>
            <Card>
              <h3 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-4">
                Evidence Integrity
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <IntegrityMetric
                  label="Total Photos"
                  value={integritySummary.total}
                  icon="photo_camera"
                  color="text-white"
                />
                <IntegrityMetric
                  label="GPS Tagged"
                  value={integritySummary.withGPS}
                  total={integritySummary.total}
                  icon="location_on"
                  color={integritySummary.withGPS === integritySummary.total ? 'text-emerald-400' : 'text-amber-400'}
                />
                <IntegrityMetric
                  label="W3W Tagged"
                  value={integritySummary.withW3W}
                  total={integritySummary.total}
                  icon="grid_3x3"
                  color={integritySummary.withW3W === integritySummary.total ? 'text-emerald-400' : 'text-amber-400'}
                />
                <IntegrityMetric
                  label="W3W Verified"
                  value={integritySummary.w3wVerified}
                  total={integritySummary.withW3W}
                  icon="verified"
                  color={integritySummary.w3wVerified === integritySummary.withW3W && integritySummary.withW3W > 0 ? 'text-emerald-400' : 'text-amber-400'}
                />
                <IntegrityMetric
                  label="Hash Verified"
                  value={integritySummary.withHash}
                  total={integritySummary.total}
                  icon="fingerprint"
                  color={integritySummary.withHash === integritySummary.total ? 'text-emerald-400' : 'text-amber-400'}
                />
              </div>
            </Card>
          </motion.div>

          {/* ============================================================ */}
          {/* SECTION 4: STEPPED WORKFLOW (unsealed) OR SEAL CERTIFICATE (sealed) */}
          {/* ============================================================ */}
          {isSealed ? (
            <>
              <motion.div variants={fadeInUp}>
                <SealBadge jobId={job.id} />
              </motion.div>
              <motion.div variants={fadeInUp}>
                <button
                  onClick={() => setShowCertificate(true)}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-2xl text-emerald-400 font-bold text-sm uppercase tracking-widest transition-all min-h-[56px]"
                >
                  <span className="material-symbols-outlined text-xl">download</span>
                  Download Seal Certificate
                </button>
              </motion.div>
            </>
          ) : photos.length > 0 && (
            <motion.div variants={fadeInUp}>
              {/* Step Progress Bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  {REVIEW_STEPS.map((step, idx) => {
                    const isActive = idx === currentStep;
                    const isComplete = idx < currentStep || isSealed;
                    const stepColor = idx === 0 ? 'blue' : idx === 1 ? 'amber' : 'emerald';
                    return (
                      <button
                        key={step.id}
                        onClick={() => setCurrentStep(idx)}
                        className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all min-h-[44px] ${
                          isActive
                            ? `bg-${stepColor}-500/20 text-${stepColor}-400 border border-${stepColor}-500/30`
                            : isComplete
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-gray-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10'
                        }`}
                      >
                        <span className="material-symbols-outlined text-lg">
                          {isComplete && !isActive ? 'check_circle' : step.icon}
                        </span>
                        <span className="hidden sm:inline">{step.label}</span>
                        <span className="sm:hidden">{idx + 1}</span>
                      </button>
                    );
                  })}
                </div>
                {/* Progress track */}
                <div className="h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-blue-500 via-amber-500 to-emerald-500 rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: `${((currentStep + 1) / REVIEW_STEPS.length) * 100}%` }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                  />
                </div>
              </div>

              {/* Step Content */}
              <AnimatePresence mode="wait">
                {/* STEP 1: Review Evidence - handled by gallery sections below */}
                {currentStep === 0 && (
                  <motion.div
                    key="step-review"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="size-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                          <span className="material-symbols-outlined text-xl text-blue-400">photo_library</span>
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Step 1: Review Evidence</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Verify all photos and metadata below before proceeding</p>
                        </div>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">
                        {photos.length} photo{photos.length !== 1 ? 's' : ''} captured
                        ({grouped.before.length} before, {grouped.during.length} during, {grouped.after.length} after)
                      </p>
                      <button
                        onClick={() => { hapticFeedback('light'); setCurrentStep(1); }}
                        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-black uppercase tracking-widest transition-all min-h-[56px]"
                      >
                        Evidence Reviewed — Continue
                        <span className="material-symbols-outlined text-lg">arrow_forward</span>
                      </button>
                    </Card>
                  </motion.div>
                )}

                {/* STEP 2: Client Attestation */}
                {currentStep === 1 && (
                  <motion.div
                    key="step-attest"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {job.clientConfirmation?.confirmed ? (
                      <Card>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="size-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                            <span className="material-symbols-outlined text-xl text-emerald-400">check_circle</span>
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Client Already Attested</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Signed {job.clientConfirmation.timestamp
                                ? new Date(job.clientConfirmation.timestamp).toLocaleString('en-GB')
                                : 'previously'}
                            </p>
                          </div>
                        </div>
                        {job.clientConfirmation.signature && (
                          <div className="bg-slate-50 dark:bg-slate-900 border border-emerald-500/20 rounded-xl p-4 mb-4">
                            <img src={job.clientConfirmation.signature} alt="Client Signature" className="max-h-24 mx-auto" />
                          </div>
                        )}
                        <button
                          onClick={() => { hapticFeedback('light'); setCurrentStep(2); }}
                          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-black uppercase tracking-widest transition-all min-h-[56px]"
                        >
                          Proceed to Seal
                          <span className="material-symbols-outlined text-lg">arrow_forward</span>
                        </button>
                      </Card>
                    ) : (
                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="size-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                            <span className="material-symbols-outlined text-xl text-amber-400">draw</span>
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Step 2: Client Attestation</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Hand device to client for signature confirmation</p>
                          </div>
                        </div>
                        <ClientConfirmationCanvas
                          clientName={client?.name || job.client || 'Client'}
                          onConfirmed={handleAttestationConfirmed}
                          onCancel={() => setCurrentStep(0)}
                          locationW3W={job.w3w}
                          photosSealed={photos.length}
                        />
                      </div>
                    )}
                  </motion.div>
                )}

                {/* STEP 3: Seal & Certify */}
                {currentStep === 2 && (
                  <motion.div
                    key="step-seal"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="size-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                          <span className="material-symbols-outlined text-xl text-emerald-400">verified</span>
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Step 3: Seal Evidence</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Create tamper-proof cryptographic record</p>
                        </div>
                      </div>

                      {/* Pre-seal checklist */}
                      <div className="space-y-2 mb-6">
                        <div className={`flex items-center gap-2 text-sm ${photos.length > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          <span className="material-symbols-outlined text-lg">{photos.length > 0 ? 'check_circle' : 'cancel'}</span>
                          {photos.length} photo{photos.length !== 1 ? 's' : ''} captured
                        </div>
                        <div className={`flex items-center gap-2 text-sm ${job.clientConfirmation?.confirmed ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          <span className="material-symbols-outlined text-lg">{job.clientConfirmation?.confirmed ? 'check_circle' : 'radio_button_unchecked'}</span>
                          Client attestation {job.clientConfirmation?.confirmed ? 'complete' : '(optional)'}
                        </div>
                        <div className={`flex items-center gap-2 text-sm ${job.w3w ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          <span className="material-symbols-outlined text-lg">{job.w3w ? 'check_circle' : 'radio_button_unchecked'}</span>
                          Location {job.w3w ? `///\u200b${job.w3w}` : '(optional)'}
                        </div>
                      </div>

                      <button
                        onClick={handleSealJob}
                        className="w-full flex items-center justify-center gap-3 px-6 py-5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl text-base font-black uppercase tracking-widest transition-all min-h-[56px] shadow-lg shadow-emerald-500/20"
                      >
                        <span className="material-symbols-outlined text-2xl">lock</span>
                        Seal Evidence Now
                      </button>

                      <p className="text-[10px] text-slate-500 dark:text-slate-400 text-center mt-3">
                        Creates RSA-2048 + SHA-256 cryptographic proof. Once sealed, evidence cannot be modified.
                      </p>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ============================================================ */}
          {/* SECTION 5: EVIDENCE GALLERY */}
          {/* ============================================================ */}
          {photos.length === 0 ? (
            <EmptyState
              icon="photo_camera"
              title="No evidence yet"
              description="Evidence will appear here once the technician uploads photos."
            />
          ) : (
            <>
              {/* Before Photos */}
              {grouped.before.length > 0 && (
                <motion.section variants={fadeInUp}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="size-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-blue-400 text-lg">photo_camera_front</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Before Work ({grouped.before.length})</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Conditions documented prior to work commencing</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {grouped.before.map((photo, i) => (
                      <PhotoCard
                        key={photo.id || photo.url || photo.timestamp || `before-${i}`}
                        photo={photo}
                        locked={isSealed}
                        onClick={() => setSelectedPhoto(photo)}
                      />
                    ))}
                  </div>
                </motion.section>
              )}

              {/* During Photos */}
              {grouped.during.length > 0 && (
                <motion.section variants={fadeInUp}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="size-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-amber-400 text-lg">construction</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">During Work ({grouped.during.length})</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Progress documentation during work execution</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {grouped.during.map((photo, i) => (
                      <PhotoCard
                        key={photo.id || photo.url || photo.timestamp || `during-${i}`}
                        photo={photo}
                        locked={isSealed}
                        onClick={() => setSelectedPhoto(photo)}
                      />
                    ))}
                  </div>
                </motion.section>
              )}

              {/* After Photos */}
              {grouped.after.length > 0 && (
                <motion.section variants={fadeInUp}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="size-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-emerald-400 text-lg">check_circle</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">After Work ({grouped.after.length})</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Completed work evidence and final state</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {grouped.after.map((photo, i) => (
                      <PhotoCard
                        key={photo.id || photo.url || photo.timestamp || `after-${i}`}
                        photo={photo}
                        locked={isSealed}
                        onClick={() => setSelectedPhoto(photo)}
                      />
                    ))}
                  </div>
                </motion.section>
              )}

              {/* Other Photos */}
              {grouped.other.length > 0 && (
                <motion.section variants={fadeInUp}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="size-8 rounded-lg bg-slate-500/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-slate-400 text-lg">image</span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Other ({grouped.other.length})</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {grouped.other.map((photo, i) => (
                      <PhotoCard
                        key={photo.id || photo.url || photo.timestamp || `other-${i}`}
                        photo={photo}
                        locked={isSealed}
                        onClick={() => setSelectedPhoto(photo)}
                      />
                    ))}
                  </div>
                </motion.section>
              )}
            </>
          )}

          {/* ============================================================ */}
          {/* SECTION 6: CLIENT SIGNATURE & CONFIRMATION */}
          {/* ============================================================ */}
          {(job.signature || job.clientConfirmation) && (
            <motion.div variants={fadeInUp}>
              <Card>
                <h3 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-4">
                  Client Confirmation
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Signature */}
                  <div>
                    <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Signature</p>
                    <div className={`rounded-xl p-4 border-2 ${
                      isSealed
                        ? 'bg-slate-50 dark:bg-slate-900 border-emerald-500/20'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-white/10'
                    }`}>
                      {(job.clientConfirmation?.signature || job.signature) ? (
                        <img
                          src={job.clientConfirmation?.signature || job.signature || ''}
                          alt="Client Signature"
                          className="max-h-32 mx-auto"
                        />
                      ) : (
                        <p className="text-center text-slate-500 dark:text-slate-400 text-sm py-4">No signature captured</p>
                      )}
                    </div>
                    {job.signerName && (
                      <p className="text-sm text-slate-900 dark:text-white font-medium mt-2">{job.signerName}</p>
                    )}
                    {job.signerRole && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">{job.signerRole}</p>
                    )}
                  </div>

                  {/* Confirmation Details */}
                  <div className="space-y-3">
                    <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Confirmation Details</p>

                    {job.clientConfirmation?.confirmed && (
                      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <span className="material-symbols-outlined text-lg">check_circle</span>
                        <span className="text-sm font-medium">Client confirmed satisfaction</span>
                      </div>
                    )}

                    {job.clientConfirmation?.timestamp && (
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Signed At</p>
                        <p className="text-sm text-slate-900 dark:text-white font-mono">
                          {new Date(job.clientConfirmation.timestamp).toLocaleString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            timeZone: 'UTC',
                          })} UTC
                        </p>
                      </div>
                    )}

                    {job.signatureHash && (
                      <div>
                        <p className="text-xs text-slate-400 mb-0.5">Signature Hash</p>
                        <p className="text-[10px] text-slate-300 font-mono break-all">
                          {job.signatureHash.slice(0, 32)}...
                        </p>
                      </div>
                    )}

                    {job.completedAt && (
                      <div>
                        <p className="text-xs text-slate-400 mb-0.5">Job Completed</p>
                        <p className="text-sm text-white font-mono">
                          {new Date(job.completedAt).toLocaleString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'UTC',
                          })} UTC
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ============================================================ */}
          {/* SECTION 7: REPORT FOOTER */}
          {/* ============================================================ */}
          <motion.div variants={fadeInUp}>
            <div className="text-center py-6 border-t border-white/15">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">
                Generated by JobProof
              </p>
              <p className="text-[9px] text-slate-600">
                This report was generated on {new Date().toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}. Evidence integrity is verified via SHA-256 hashing and RSA-2048 digital signatures.
              </p>
            </div>
          </motion.div>
        </motion.div>
      </PageContent>

      {/* ============================================================ */}
      {/* PHOTO VIEWER - BottomSheet with GPS/W3W metadata */}
      {/* ============================================================ */}
      <BottomSheet
        isOpen={!!selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
        title="Evidence Photo"
        subtitle={selectedPhoto?.type ? `${selectedPhoto.type.charAt(0).toUpperCase() + selectedPhoto.type.slice(1)} Work` : undefined}
        maxHeight={90}
      >
        {selectedPhoto && (
          <div className="p-4 space-y-4">
            {/* Photo */}
            <img
              src={selectedPhoto.url || selectedPhoto.localPath}
              alt="Evidence"
              className="w-full max-h-[50vh] object-contain rounded-lg bg-black"
            />

            {/* Metadata Panel */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {/* Timestamp */}
                {selectedPhoto.timestamp && (
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Captured</p>
                    <p className="text-xs text-white font-mono">
                      {new Date(selectedPhoto.timestamp).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </p>
                  </div>
                )}

                {/* GPS */}
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">GPS</p>
                  {(selectedPhoto.lat || selectedPhoto.location) ? (
                    <div>
                      <p className="text-xs text-emerald-400 font-mono">
                        {(selectedPhoto.lat || selectedPhoto.location?.lat)?.toFixed(6)},
                        {(selectedPhoto.lng || selectedPhoto.location?.lng)?.toFixed(6)}
                      </p>
                      {(selectedPhoto.gps_accuracy || selectedPhoto.location?.accuracy) && (
                        <p className="text-[10px] text-slate-400">
                          ±{Math.round(selectedPhoto.gps_accuracy || selectedPhoto.location?.accuracy || 0)}m accuracy
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">Not captured</p>
                  )}
                </div>

                {/* W3W */}
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">What3Words</p>
                  {selectedPhoto.w3w ? (
                    <div>
                      <p className="text-xs text-emerald-400 font-mono">
                        {'///'}{selectedPhoto.w3w}
                      </p>
                      <p className={`text-[10px] flex items-center gap-1 ${
                        selectedPhoto.w3w_verified ? 'text-emerald-400' : 'text-amber-400'
                      }`}>
                        <span className="material-symbols-outlined text-[10px]">
                          {selectedPhoto.w3w_verified ? 'verified' : 'warning'}
                        </span>
                        {selectedPhoto.w3w_verified ? 'API Verified' : 'Unverified'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">Not captured</p>
                  )}
                </div>

                {/* Integrity */}
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Integrity</p>
                  {(selectedPhoto.photo_hash || selectedPhoto.hash) ? (
                    <p className="text-[10px] text-emerald-400 font-mono break-all">
                      {(selectedPhoto.photo_hash || selectedPhoto.hash || '').slice(0, 16)}...
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400">No hash</p>
                  )}
                </div>
              </div>

              {/* Type badge and seal status */}
              <div className="flex items-center gap-3 pt-3 border-t border-white/15">
                {selectedPhoto.type && (
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                    selectedPhoto.type === 'before' ? 'bg-blue-500/20 text-blue-400' :
                    selectedPhoto.type === 'during' ? 'bg-amber-500/20 text-amber-400' :
                    selectedPhoto.type === 'after' ? 'bg-emerald-500/20 text-emerald-400' :
                    'bg-slate-500/20 text-slate-400'
                  }`}>
                    {selectedPhoto.type}
                  </span>
                )}
                {isSealed && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold uppercase">
                    <span className="material-symbols-outlined text-sm">verified</span>
                    Sealed
                  </span>
                )}
                {selectedPhoto.syncStatus && (
                  <span className={`flex items-center gap-1 text-[10px] font-bold uppercase ${
                    selectedPhoto.syncStatus === 'synced' ? 'text-emerald-400' :
                    selectedPhoto.syncStatus === 'pending' ? 'text-amber-400' :
                    'text-red-400'
                  }`}>
                    <span className="material-symbols-outlined text-sm">
                      {selectedPhoto.syncStatus === 'synced' ? 'cloud_done' :
                       selectedPhoto.syncStatus === 'pending' ? 'cloud_upload' : 'cloud_off'}
                    </span>
                    {selectedPhoto.syncStatus}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* Sealing Progress Modal */}
      <SealingProgressModal
        isOpen={sealingModalOpen}
        status={sealingStatus}
        progress={sealingProgress}
        errorMessage={sealingError}
        onClose={() => setSealingModalOpen(false)}
        onRetry={handleSealRetry}
      />

      {/* Seal Certificate Download Modal */}
      {job && (
        <SealCertificate
          job={job}
          isOpen={showCertificate}
          onClose={() => setShowCertificate(false)}
        />
      )}
    </div>
  );
};

// ============================================================================
// INTEGRITY METRIC COMPONENT
// ============================================================================

interface IntegrityMetricProps {
  label: string;
  value: number;
  total?: number;
  icon: string;
  color: string;
}

const IntegrityMetric: React.FC<IntegrityMetricProps> = ({ label, value, total, icon, color }) => (
  <div className="text-center p-3 bg-slate-800 rounded-xl">
    <span className={`material-symbols-outlined text-2xl ${color}`}>{icon}</span>
    <p className="text-lg font-black text-white mt-1">
      {value}{total !== undefined && <span className="text-slate-400 text-sm">/{total}</span>}
    </p>
    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
  </div>
);

// ============================================================================
// PHOTO CARD COMPONENT - Forensic enhanced
// ============================================================================

interface PhotoCardProps {
  photo: Photo;
  locked: boolean;
  onClick: () => void;
}

const PhotoCard: React.FC<PhotoCardProps> = ({ photo, locked, onClick }) => {
  const hasGPS = Boolean(photo.lat || photo.lng || photo.location);
  const hasW3W = Boolean(photo.w3w);

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`
        relative rounded-xl overflow-hidden
        bg-[#121212] border-2 transition-all duration-300 group text-left w-full
        ${locked
          ? 'border-[#00FFCC]/50 shadow-[0_0_15px_rgba(0,255,204,0.3)]'
          : 'border-white/10 hover:border-white/20'
        }
      `}
    >
      {/* Photo */}
      <div className="aspect-[4/3]">
        <img
          src={photo.url || photo.localPath}
          alt="Evidence"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Scan lines overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.3) 3px, rgba(0,0,0,0.3) 4px)',
        }}
      />

      {/* Top badges */}
      <div className="absolute top-2 left-2 right-2 flex items-start justify-between">
        {photo.type && (
          <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
            photo.type === 'before' ? 'bg-blue-500/20 text-blue-400' :
            photo.type === 'during' ? 'bg-amber-500/20 text-amber-400' :
            photo.type === 'after' ? 'bg-emerald-500/20 text-emerald-400' :
            'bg-slate-500/20 text-slate-400'
          }`}>
            {photo.type}
          </span>
        )}
        {locked && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="size-7 rounded-full bg-[#00FFCC]/20 flex items-center justify-center shadow-[0_0_10px_rgba(0,255,204,0.5)]"
          >
            <span className="material-symbols-outlined text-sm text-[#00FFCC]">verified_user</span>
          </motion.div>
        )}
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <span className="material-symbols-outlined text-white text-3xl">zoom_in</span>
      </div>

      {/* Bottom metadata panel */}
      <div className="bg-slate-900 p-3 space-y-2">
        {/* Timestamp */}
        {photo.timestamp && (
          <p className="font-mono text-[10px] text-slate-300">
            {new Date(photo.timestamp).toLocaleString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}

        {/* Location info */}
        {(hasGPS || hasW3W) && (
          <div className="space-y-1">
            {hasGPS && (
              <p className="text-[9px] text-slate-400 font-mono flex items-center gap-1">
                <span className="material-symbols-outlined text-[10px] text-emerald-400">location_on</span>
                {(photo.lat || photo.location?.lat)?.toFixed(4)}, {(photo.lng || photo.location?.lng)?.toFixed(4)}
                {(photo.gps_accuracy || photo.location?.accuracy) && (
                  <span className="text-slate-400 ml-1">±{Math.round(photo.gps_accuracy || photo.location?.accuracy || 0)}m</span>
                )}
              </p>
            )}
            {hasW3W && (
              <p className="text-[9px] font-mono flex items-center gap-1">
                <span className="material-symbols-outlined text-[10px] text-emerald-400">grid_3x3</span>
                <span className={photo.w3w_verified ? 'text-emerald-400' : 'text-amber-400'}>
                  {'///'}{photo.w3w}
                </span>
              </p>
            )}
          </div>
        )}

        {/* Integrity indicators */}
        <div className="flex items-center gap-2 pt-1 border-t border-white/15">
          <span className={`flex items-center gap-0.5 text-[9px] font-mono ${hasGPS ? 'text-[#00FFCC]' : 'text-slate-400'}`}>
            <span className="material-symbols-outlined text-[10px]">
              {hasGPS ? 'check_circle' : 'radio_button_unchecked'}
            </span>
            GPS
          </span>
          <span className={`flex items-center gap-0.5 text-[9px] font-mono ${hasW3W && photo.w3w_verified ? 'text-[#00FFCC]' : 'text-slate-400'}`}>
            <span className="material-symbols-outlined text-[10px]">
              {hasW3W && photo.w3w_verified ? 'check_circle' : 'radio_button_unchecked'}
            </span>
            W3W
          </span>
          <span className={`flex items-center gap-0.5 text-[9px] font-mono ${locked ? 'text-[#00FFCC]' : 'text-slate-400'}`}>
            <span className="material-symbols-outlined text-[10px]">
              {locked ? 'check_circle' : 'radio_button_unchecked'}
            </span>
            Sealed
          </span>
          {photo.syncStatus === 'pending' && (
            <span className="flex items-center gap-0.5 text-[9px] font-mono text-amber-400">
              <span className="material-symbols-outlined text-[10px]">cloud_upload</span>
              Sync
            </span>
          )}
          {photo.syncStatus === 'failed' && (
            <span className="flex items-center gap-0.5 text-[9px] font-mono text-red-400">
              <span className="material-symbols-outlined text-[10px]">cloud_off</span>
              Failed
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
};

export default EvidenceReview;
