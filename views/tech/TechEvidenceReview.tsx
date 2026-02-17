/**
 * TechEvidenceReview - Technician Evidence Review with Client Signature
 *
 * Guided 3-step completion flow:
 *   Step 1: Review Evidence (photo gallery with larger thumbnails)
 *   Step 2: Completion Notes (technician documents work performed)
 *   Step 3: Client Attestation (handoff screen + signature + seal)
 *
 * UX Principles:
 * - Stepper progress gives technicians confidence and orientation
 * - Completion notes capture critical field observations
 * - "Hand to Client" transition creates a clean handoff moment
 * - 280px signature canvas for comfortable signing
 * - 2-column photo grid for better visibility in bright sunlight
 * - Color-coded sections: blue (review) → amber (notes) → emerald (sign)
 *
 * Phase G: Technician Portal - Evidence Flow
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '../../lib/DataContext';
import { Job, Photo } from '../../types';
import { EmptyState, LoadingSkeleton, ActionButton, ErrorState } from '../../components/ui';
import SealingProgressModal, { SealingStatus } from '../../components/ui/SealingProgressModal';
import ClientConfirmationCanvas from '../../components/ClientConfirmationCanvas';
import { OfflineIndicator } from '../../components/OfflineIndicator';
import { fadeInUp, stepSlide, stepSlideTransition, fadeOverlay, tapShrink } from '../../lib/animations';
import { invokeSealing } from '../../lib/supabase';
import { celebrateSuccess, hapticFeedback, showToast } from '../../lib/microInteractions';

const SATISFACTION_STATEMENT =
  "I confirm I am satisfied with the completed work and approve this evidence for submission";

const COMPLETION_STEPS = [
  { id: 'review', label: 'Review Evidence', icon: 'photo_library' },
  { id: 'notes', label: 'Completion Notes', icon: 'edit_note' },
  { id: 'sign', label: 'Client Attestation', icon: 'draw' },
] as const;

const NOTE_PROMPTS = [
  'Work performed',
  'Issues found',
  'Follow-up needed',
  'Safety concerns',
] as const;

const PHOTO_COLOR_MAP = {
  blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', badge: 'bg-blue-500/80' },
  amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', badge: 'bg-amber-500/80' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', badge: 'bg-emerald-500/80' },
} as const;

const TechEvidenceReview: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  const { jobs, clients, updateJob: contextUpdateJob, isLoading, error: dataError, refresh } = useData();

  const job = useMemo(() => jobs.find(j => j.id === jobId) || null, [jobs, jobId]);
  const client = useMemo(
    () => (job ? clients.find(c => c.id === job.clientId) || null : null),
    [clients, job]
  );

  // Stepper state
  const [currentStep, setCurrentStep] = useState(0);

  // Notes state
  const [completionNotes, setCompletionNotes] = useState('');
  const [activeNotePrompt, setActiveNotePrompt] = useState<string | null>(null);

  // Photo viewer
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  // Signature state
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [, setHasSignature] = useState(false);
  const [, setIsConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Auto-seal state
  const [sealingModalOpen, setSealingModalOpen] = useState(false);
  const [sealingStatus, setSealingStatus] = useState<SealingStatus>('hashing');
  const [sealingProgress, setSealingProgress] = useState(0);
  const [sealingError, setSealingError] = useState<string | undefined>();

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const notesRef = React.useRef<HTMLTextAreaElement>(null);

  // Initialize canvas with gradient background
  React.useEffect(() => {
    if (!showSignaturePad) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#10b981';

      const gradient = ctx.createLinearGradient(0, 0, 0, rect.height);
      gradient.addColorStop(0, '#0f172a');
      gradient.addColorStop(1, '#1e293b');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Signature line guide
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(24, rect.height - 48);
      ctx.lineTo(rect.width - 24, rect.height - 48);
      ctx.stroke();

      // "Sign here" label
      ctx.font = '12px system-ui';
      ctx.fillStyle = '#10b981';
      ctx.globalAlpha = 0.4;
      ctx.fillText('Sign here', 24, rect.height - 56);

      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3;
    }
  }, [showSignaturePad]);

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    const rect = container.getBoundingClientRect();

    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 0, rect.height);
      gradient.addColorStop(0, '#0f172a');
      gradient.addColorStop(1, '#1e293b');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, rect.width, rect.height);

      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(24, rect.height - 48);
      ctx.lineTo(rect.width - 24, rect.height - 48);
      ctx.stroke();

      ctx.font = '12px system-ui';
      ctx.fillStyle = '#10b981';
      ctx.globalAlpha = 0.4;
      ctx.fillText('Sign here', 24, rect.height - 56);

      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3;

      setHasSignature(false);
      setIsConfirmed(false);
    }
  }, []);

  const autoSealJob = useCallback(async (sealJobId: string) => {
    setSealingModalOpen(true);
    setSealingStatus('hashing');
    setSealingProgress(0);
    setSealingError(undefined);

    try {
      setSealingProgress(10);
      await new Promise(resolve => setTimeout(resolve, 300));
      setSealingProgress(33);

      setSealingStatus('signing');
      setSealingProgress(40);
      await new Promise(resolve => setTimeout(resolve, 300));
      setSealingProgress(66);

      setSealingStatus('storing');
      setSealingProgress(75);

      const result = await invokeSealing(sealJobId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to seal evidence');
      }

      setSealingProgress(90);
      await new Promise(resolve => setTimeout(resolve, 200));

      setSealingProgress(100);
      setSealingStatus('complete');

      if (job) {
        const sealedJob: Job = {
          ...job,
          sealedAt: result.sealedAt,
          evidenceHash: result.evidenceHash,
        };
        contextUpdateJob(sealedJob);
      }
    } catch (error) {
      setSealingStatus('error');
      setSealingError(error instanceof Error ? error.message : 'Failed to seal evidence');
    }
  }, [job, contextUpdateJob]);

  const handleSealRetry = useCallback(() => {
    if (job) {
      autoSealJob(job.id);
    }
  }, [job, autoSealJob]);

  const handleCanvasConfirmed = useCallback(async (signature: string, timestamp: string) => {
    if (!job) return;

    setSubmitting(true);
    try {
      celebrateSuccess();
      hapticFeedback('success');

      const updatedJob: Job = {
        ...job,
        clientConfirmation: {
          signature,
          timestamp,
          confirmed: true,
        },
        completionNotes: completionNotes || undefined,
        status: 'Submitted',
      };

      contextUpdateJob(updatedJob);

      await autoSealJob(job.id);

      navigate(`/tech/job/${job.id}`);
    } catch (error) {
      showToast('Failed to submit evidence. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [job, contextUpdateJob, navigate, autoSealJob, completionNotes]);

  // Group photos by type (case-insensitive matching for canonical PhotoType)
  const groupedPhotos = useMemo(() => {
    const photos = job?.photos || [];
    return {
      before: photos.filter(p => p.type?.toLowerCase() === 'before'),
      during: photos.filter(p => p.type?.toLowerCase() === 'during'),
      after: photos.filter(p => p.type?.toLowerCase() === 'after'),
    };
  }, [job?.photos]);

  const totalPhotos = useMemo(
    () => groupedPhotos.before.length + groupedPhotos.during.length + groupedPhotos.after.length,
    [groupedPhotos]
  );

  // Step navigation
  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step <= 2) {
      setCurrentStep(step);
      hapticFeedback('light');
    }
  }, []);

  const handleNextStep = useCallback(() => {
    if (currentStep < 2) {
      setCurrentStep(prev => prev + 1);
      hapticFeedback('light');
      // Scroll to top of content on step change
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentStep]);

  const handlePrevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      hapticFeedback('light');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentStep]);

  // Insert note prompt chip
  const handleNotePrompt = useCallback((prompt: string) => {
    const prefix = completionNotes.length > 0 ? '\n\n' : '';
    const newText = `${completionNotes}${prefix}${prompt}: `;
    setCompletionNotes(newText);
    setActiveNotePrompt(prompt);
    // Focus textarea
    setTimeout(() => notesRef.current?.focus(), 100);
  }, [completionNotes]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 px-4 py-6">
        <LoadingSkeleton variant="card" count={2} />
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center px-4">
        <ErrorState message={dataError} onRetry={refresh} />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center px-4">
        <EmptyState
          icon="work_off"
          title="Job not found"
          description="This job doesn't exist or you don't have access."
          action={{ label: 'Back to Jobs', to: '/tech' }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200 dark:border-white/15 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => currentStep > 0 ? handlePrevStep() : navigate(`/tech/job/${job.id}`)}
            aria-label={currentStep > 0 ? 'Go to previous step' : 'Back to job details'}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100/70 dark:hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-slate-900 dark:text-white text-sm truncate">
              {COMPLETION_STEPS[currentStep].label}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {job.title} {client ? `\u2022 ${client.name}` : ''}
            </p>
          </div>
          <OfflineIndicator />
        </div>

        {/* Stepper Progress Bar */}
        <div className="flex items-center gap-1.5 mt-3">
          {COMPLETION_STEPS.map((step, i) => (
            <button
              key={step.id}
              onClick={() => goToStep(i)}
              aria-label={`Go to step: ${step.label}`}
              className="flex-1 flex flex-col items-center gap-1 group min-h-[44px]"
            >
              <div className="w-full flex items-center gap-1">
                <div className={`
                  h-1.5 flex-1 rounded-full transition-all duration-500
                  ${i < currentStep
                    ? 'bg-emerald-500'
                    : i === currentStep
                    ? step.id === 'review' ? 'bg-blue-500' : step.id === 'notes' ? 'bg-amber-500' : 'bg-emerald-500'
                    : 'bg-gray-100 dark:bg-slate-800'
                  }
                `} />
              </div>
              <span className={`
                text-[10px] font-medium transition-colors
                ${i <= currentStep ? 'text-slate-700 dark:text-slate-300' : 'text-slate-600'}
              `}>
                {step.label}
              </span>
            </button>
          ))}
        </div>
      </header>

      {/* Content - Step Based */}
      <main className="flex-1 px-4 py-5 pb-32 overflow-y-auto">
        <AnimatePresence mode="wait">
          {/* STEP 1: Review Evidence */}
          {currentStep === 0 && (
            <motion.div
              key="review"
              variants={stepSlide}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={stepSlideTransition}
            >
              {/* Evidence Summary Card */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="size-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-blue-400">photo_library</span>
                  </div>
                  <div className="flex-1">
                    <h2 className="font-semibold text-slate-900 dark:text-white">Evidence Summary</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {totalPhotos} photo{totalPhotos !== 1 ? 's' : ''} captured
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {groupedPhotos.before.length > 0 && (
                    <span className="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 text-xs font-medium">
                      {groupedPhotos.before.length} Before
                    </span>
                  )}
                  {groupedPhotos.during.length > 0 && (
                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-medium">
                      {groupedPhotos.during.length} During
                    </span>
                  )}
                  {groupedPhotos.after.length > 0 && (
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-medium">
                      {groupedPhotos.after.length} After
                    </span>
                  )}
                </div>
              </div>

              {/* Photo Gallery */}
              {totalPhotos === 0 ? (
                <EmptyState
                  icon="photo_camera"
                  title="No evidence captured"
                  description="Return to job and capture photos first."
                />
              ) : (
                <div className="space-y-6">
                  {/* Before Photos */}
                  {groupedPhotos.before.length > 0 && (
                    <PhotoSection
                      title="Before"
                      count={groupedPhotos.before.length}
                      color="blue"
                      photos={groupedPhotos.before}
                      onPhotoClick={setSelectedPhoto}
                    />
                  )}

                  {/* During Photos */}
                  {groupedPhotos.during.length > 0 && (
                    <PhotoSection
                      title="During"
                      count={groupedPhotos.during.length}
                      color="amber"
                      photos={groupedPhotos.during}
                      onPhotoClick={setSelectedPhoto}
                    />
                  )}

                  {/* After Photos */}
                  {groupedPhotos.after.length > 0 && (
                    <PhotoSection
                      title="After"
                      count={groupedPhotos.after.length}
                      color="emerald"
                      photos={groupedPhotos.after}
                      onPhotoClick={setSelectedPhoto}
                    />
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* STEP 2: Completion Notes */}
          {currentStep === 1 && (
            <motion.div
              key="notes"
              variants={stepSlide}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={stepSlideTransition}
            >
              {/* Notes Header */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-amber-400">edit_note</span>
                  </div>
                  <div className="flex-1">
                    <h2 className="font-semibold text-slate-900 dark:text-white">Completion Notes</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Document work performed, issues found, or follow-up needed
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Note Prompts */}
              <div className="flex flex-wrap gap-2 mb-4">
                {NOTE_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleNotePrompt(prompt)}
                    className={`
                      px-3.5 py-2 rounded-xl text-sm font-medium transition-all min-h-[44px]
                      ${activeNotePrompt === prompt
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-gray-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/15 hover:bg-gray-200 dark:hover:bg-slate-700'
                      }
                    `}
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {/* Notes Textarea */}
              <div className="relative">
                <textarea
                  ref={notesRef}
                  value={completionNotes}
                  onChange={(e) => {
                    setCompletionNotes(e.target.value);
                    setActiveNotePrompt(null);
                  }}
                  placeholder="Describe the work completed, any issues found, or important notes for the client and office..."
                  rows={8}
                  className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-slate-600 focus:border-amber-500/50 rounded-2xl p-4 text-slate-900 dark:text-white text-base placeholder:text-slate-600 resize-none focus:outline-none transition-colors leading-relaxed"
                />
                <div className="absolute bottom-3 right-3 text-xs text-slate-600">
                  {completionNotes.length > 0 ? `${completionNotes.length} chars` : 'Optional'}
                </div>
              </div>

              {/* Helpful tip */}
              <div className="mt-4 flex items-start gap-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/15 rounded-xl p-3">
                <span className="material-symbols-outlined text-sm text-amber-400 mt-0.5">lightbulb</span>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Good notes help with invoicing, dispute resolution, and follow-up scheduling. Include what was done, any problems discovered, and recommended next steps.
                </p>
              </div>
            </motion.div>
          )}

          {/* STEP 3: Client Attestation */}
          {currentStep === 2 && (
            <motion.div
              key="sign"
              variants={stepSlide}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={stepSlideTransition}
            >
              {!showSignaturePad ? (
                /* Client Handoff Screen */
                <motion.div variants={fadeInUp} initial="hidden" animate="visible">
                  {/* Handoff Card */}
                  <div className="bg-gradient-to-br from-emerald-950/60 to-emerald-900/30 border-2 border-emerald-500/30 rounded-3xl p-6 mb-6 text-center">
                    <div className="size-16 mx-auto mb-4 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-3xl text-emerald-400">
                        phone_forwarded
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                      Hand Device to Client
                    </h2>
                    <p className="text-slate-700 dark:text-slate-300 text-sm mb-1">
                      Please pass the device to
                    </p>
                    <p className="text-emerald-400 text-lg font-bold">
                      {client?.name || 'the client'}
                    </p>
                  </div>

                  {/* Evidence Summary for Client */}
                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4 mb-6">
                    <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                      Evidence to be sealed
                    </h3>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-blue-400">photo_camera</span>
                        <span className="text-sm text-slate-900 dark:text-white font-medium">{totalPhotos} photos</span>
                      </div>
                      {completionNotes && (
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm text-amber-400">description</span>
                          <span className="text-sm text-slate-900 dark:text-white font-medium">Notes attached</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Satisfaction Statement */}
                  <div className="bg-emerald-500/10 border-2 border-emerald-500/20 rounded-2xl p-5 mb-6">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="size-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="material-symbols-outlined text-emerald-400">verified</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wide mb-2">
                          Client Satisfaction Confirmation
                        </h3>
                        <p className="text-base text-slate-900 dark:text-white leading-relaxed font-medium">
                          {SATISFACTION_STATEMENT}
                        </p>
                      </div>
                    </div>
                  </div>

                  <ActionButton
                    variant="primary"
                    icon="draw"
                    onClick={() => setShowSignaturePad(true)}
                    fullWidth
                    size="lg"
                    disabled={totalPhotos === 0}
                  >
                    Sign to Confirm
                  </ActionButton>

                  {totalPhotos === 0 && (
                    <p className="text-xs text-center text-amber-400 mt-2">
                      Capture photos before requesting signature
                    </p>
                  )}
                </motion.div>
              ) : (
                /* Client Confirmation Canvas - Full signature + attestation component */
                <ClientConfirmationCanvas
                  clientName={client?.name}
                  onConfirmed={handleCanvasConfirmed}
                  onCancel={() => {
                    setShowSignaturePad(false);
                    clearSignature();
                  }}
                  disabled={submitting}
                  locationW3W={job.photos?.[0]?.w3w}
                  photosSealed={totalPhotos}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation - Step Controls */}
      {!showSignaturePad && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200 dark:border-white/10 px-4 py-4 pb-safe">
          <div className="flex gap-3">
            {currentStep > 0 && (
              <ActionButton
                variant="ghost"
                icon="arrow_back"
                onClick={handlePrevStep}
                size="lg"
              >
                Back
              </ActionButton>
            )}
            {currentStep < 2 ? (
              <ActionButton
                variant="primary"
                icon="arrow_forward"
                iconPosition="right"
                onClick={handleNextStep}
                fullWidth
                size="lg"
              >
                {currentStep === 0 ? 'Continue to Notes' : 'Continue to Signing'}
              </ActionButton>
            ) : (
              <ActionButton
                variant="primary"
                icon="draw"
                onClick={() => setShowSignaturePad(true)}
                fullWidth
                size="lg"
                disabled={totalPhotos === 0 || submitting}
              >
                {submitting ? 'Submitting...' : 'Sign to Confirm'}
              </ActionButton>
            )}
          </div>
          {/* Step hint */}
          <p className="text-[10px] text-slate-600 text-center mt-2">
            Step {currentStep + 1} of {COMPLETION_STEPS.length}
          </p>
        </div>
      )}

      {/* Photo Viewer Modal */}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div
            variants={fadeOverlay}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 bg-white/95 dark:bg-slate-950/95 flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Photo viewer"
            onClick={() => setSelectedPhoto(null)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setSelectedPhoto(null); } }}
            tabIndex={0}
          >
            {/* Close bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-black/50">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${
                selectedPhoto.type === 'before' ? 'bg-blue-500/20 text-blue-400' :
                selectedPhoto.type === 'during' ? 'bg-amber-500/20 text-amber-400' :
                'bg-emerald-500/20 text-emerald-400'
              }`}>
                {selectedPhoto.type}
              </span>
              <button
                aria-label="Close photo viewer"
                className="p-2 text-white hover:bg-slate-100/70 dark:hover:bg-white/10 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
                onClick={() => setSelectedPhoto(null)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Photo */}
            <div className="flex-1 flex items-center justify-center p-4" role="presentation" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              <img
                src={selectedPhoto.url || selectedPhoto.localPath}
                alt="Evidence"
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>

            {/* Metadata bar */}
            <div className="px-4 py-3 bg-black/50 flex items-center gap-4">
              {selectedPhoto.timestamp && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {new Date(selectedPhoto.timestamp).toLocaleString('en-GB')}
                </span>
              )}
              {selectedPhoto.w3w && (
                <span className="text-xs text-emerald-400 font-mono">
                  {'///'}{selectedPhoto.w3w}
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auto-Seal Progress Modal */}
      <SealingProgressModal
        isOpen={sealingModalOpen}
        status={sealingStatus}
        progress={sealingProgress}
        errorMessage={sealingError}
        onClose={() => setSealingModalOpen(false)}
        onRetry={handleSealRetry}
      />
    </div>
  );
};

// Photo Section Component - 2-column grid with color coding
interface PhotoSectionProps {
  title: string;
  count: number;
  color: 'blue' | 'amber' | 'emerald';
  photos: Photo[];
  onPhotoClick: (photo: Photo) => void;
}

const PhotoSection: React.FC<PhotoSectionProps> = ({ title, count, color, photos, onPhotoClick }) => {
  const c = PHOTO_COLOR_MAP[color];

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-1.5 h-5 rounded-full ${c.badge}`} />
        <h3 className={`text-xs font-bold uppercase tracking-wider ${c.text}`}>
          {title}
        </h3>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${c.bg} ${c.text}`}>
          {count}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {photos.map((photo, i) => (
          <PhotoThumbnail
            key={photo.id || photo.url || photo.timestamp || `${title}-${i}`}
            photo={photo}
            color={color}
            onClick={() => onPhotoClick(photo)}
          />
        ))}
      </div>
    </div>
  );
};

// Photo Thumbnail Component - Larger with better touch target
interface PhotoThumbnailProps {
  photo: Photo;
  color: 'blue' | 'amber' | 'emerald';
  onClick: () => void;
}

const PhotoThumbnail: React.FC<PhotoThumbnailProps> = ({ photo, color, onClick }) => {
  return (
    <motion.button
      onClick={onClick}
      whileTap={tapShrink}
      aria-label={`View ${photo.type || 'evidence'} photo`}
      className="relative aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
    >
      <img
        src={photo.url || photo.localPath}
        alt={photo.type || 'Evidence'}
        className="w-full h-full object-cover"
      />
      {/* Type badge */}
      <span className={`absolute top-2 left-2 px-2 py-1 rounded-lg text-[10px] font-bold uppercase text-white ${PHOTO_COLOR_MAP[color].badge}`}>
        {photo.type}
      </span>
      {/* Timestamp */}
      {photo.timestamp && (
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6">
          <p className="text-[10px] text-slate-700 dark:text-slate-300 font-mono">
            {new Date(photo.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}
    </motion.button>
  );
};

export default TechEvidenceReview;
