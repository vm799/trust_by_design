/**
 * TechEvidenceReview - Technician Evidence Review with Client Signature
 *
 * Shows evidence gallery → client satisfaction statement → signature → auto-seal
 *
 * Workflow:
 * 1. Technician reviews all captured photos
 * 2. Client reviews satisfaction statement
 * 3. Client signs to approve evidence
 * 4. Status changes to 'Submitted' and auto-seal triggers
 *
 * Phase G: Technician Portal - Evidence Flow
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '../../lib/DataContext';
import { Job } from '../../types';
import { EmptyState, LoadingSkeleton, ActionButton } from '../../components/ui';
import SealingProgressModal, { SealingStatus } from '../../components/ui/SealingProgressModal';
import { OfflineIndicator } from '../../components/OfflineIndicator';
import { fadeInUp } from '../../lib/animations';
import { invokeSealing } from '../../lib/supabase';

interface Photo {
  id?: string;
  url?: string;
  localPath?: string;
  type?: 'before' | 'during' | 'after';
  timestamp?: string;
  lat?: number;
  lng?: number;
  w3w?: string;
  w3w_verified?: boolean;
}

// Client satisfaction statement (as per requirements)
const SATISFACTION_STATEMENT =
  "I confirm I am satisfied with the completed work and approve this evidence for submission";

const TechEvidenceReview: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  // Use DataContext for centralized state management
  const { jobs, clients, updateJob: contextUpdateJob, isLoading } = useData();

  // Derive job and client from DataContext (memoized)
  const job = useMemo(() => jobs.find(j => j.id === jobId) || null, [jobs, jobId]);
  const client = useMemo(
    () => (job ? clients.find(c => c.id === job.clientId) || null : null),
    [clients, job]
  );

  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Auto-seal state
  const [sealingModalOpen, setSealingModalOpen] = useState(false);
  const [sealingStatus, setSealingStatus] = useState<SealingStatus>('hashing');
  const [sealingProgress, setSealingProgress] = useState(0);
  const [sealingError, setSealingError] = useState<string | undefined>();

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Initialize canvas
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
      ctx.strokeStyle = '#1e293b'; // slate-800

      // Light background
      ctx.fillStyle = '#f8fafc'; // slate-50
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Draw signature line guide
      ctx.strokeStyle = '#cbd5e1'; // slate-300
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(20, rect.height - 40);
      ctx.lineTo(rect.width - 20, rect.height - 40);
      ctx.stroke();

      // Reset for drawing
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 3;
    }
  }, [showSignaturePad]);

  const getCoordinates = useCallback(
    (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();

      if ('touches' in e) {
        const touch = e.touches[0];
        return {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
        };
      }
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    []
  );

  const startDrawing = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      setIsDrawing(true);
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        const { x, y } = getCoordinates(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
      }
    },
    [getCoordinates]
  );

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing) return;
      e.preventDefault();

      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        const { x, y } = getCoordinates(e);
        ctx.lineTo(x, y);
        ctx.stroke();
        setHasSignature(true);
      }
    },
    [isDrawing, getCoordinates]
  );

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.closePath();
    }
  }, []);

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    const rect = container.getBoundingClientRect();

    if (ctx) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Redraw signature line
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(20, rect.height - 40);
      ctx.lineTo(rect.width - 20, rect.height - 40);
      ctx.stroke();

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 3;

      setHasSignature(false);
      setIsConfirmed(false);
    }
  }, []);

  // Auto-seal evidence after job submission
  const autoSealJob = useCallback(async (jobId: string) => {
    setSealingModalOpen(true);
    setSealingStatus('hashing');
    setSealingProgress(0);
    setSealingError(undefined);

    try {
      // Phase 1: Hashing (0-33%)
      setSealingProgress(10);
      await new Promise(resolve => setTimeout(resolve, 300));
      setSealingProgress(33);

      // Phase 2: Signing (33-66%)
      setSealingStatus('signing');
      setSealingProgress(40);
      await new Promise(resolve => setTimeout(resolve, 300));
      setSealingProgress(66);

      // Phase 3: Storing (66-90%)
      setSealingStatus('storing');
      setSealingProgress(75);

      // Invoke seal-evidence edge function
      const result = await invokeSealing(jobId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to seal evidence');
      }

      setSealingProgress(90);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Phase 4: Complete (90-100%)
      setSealingProgress(100);
      setSealingStatus('complete');

      // Update job with seal data
      if (job) {
        const sealedJob: Job = {
          ...job,
          sealedAt: result.sealedAt,
          evidenceHash: result.evidenceHash,
        };
        contextUpdateJob(sealedJob);
      }
    } catch (error) {
      console.error('Auto-seal failed:', error);
      setSealingStatus('error');
      setSealingError(error instanceof Error ? error.message : 'Failed to seal evidence');
    }
  }, [job, contextUpdateJob]);

  // Retry sealing on failure
  const handleSealRetry = useCallback(() => {
    if (job) {
      autoSealJob(job.id);
    }
  }, [job, autoSealJob]);

  const handleSubmitWithSignature = useCallback(async () => {
    if (!hasSignature || !isConfirmed || !canvasRef.current || !job) return;

    setSubmitting(true);
    try {
      const signatureDataUrl = canvasRef.current.toDataURL('image/png');
      const timestamp = new Date().toISOString();

      const updatedJob: Job = {
        ...job,
        clientConfirmation: {
          signature: signatureDataUrl,
          timestamp,
          confirmed: true,
        },
        status: 'Submitted', // Auto-advance to Submitted - triggers auto-seal
      };

      contextUpdateJob(updatedJob);

      // AUTO-SEAL: Trigger cryptographic sealing on job submission
      await autoSealJob(job.id);

      // Navigate back to job detail after sealing completes
      navigate(`/tech/job/${job.id}`);
    } catch (error) {
      console.error('Failed to submit evidence:', error);
      alert('Failed to submit evidence. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [hasSignature, isConfirmed, job, contextUpdateJob, navigate, autoSealJob]);

  // Group photos by type
  const groupedPhotos = useMemo(() => {
    const photos = (job?.photos || []) as Photo[];
    return {
      before: photos.filter(p => p.type === 'before'),
      during: photos.filter(p => p.type === 'during'),
      after: photos.filter(p => p.type === 'after'),
    };
  }, [job?.photos]);

  const totalPhotos = groupedPhotos.before.length + groupedPhotos.during.length + groupedPhotos.after.length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-6">
        <LoadingSkeleton variant="card" count={2} />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
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
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-xl border-b border-white/5 px-4 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/tech/job/${job.id}`)}
            className="p-1 text-slate-400 hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex-1">
            <h1 className="font-medium text-white">Evidence Review</h1>
            <p className="text-xs text-slate-500">{client?.name}</p>
          </div>
          <OfflineIndicator />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-6 pb-32 overflow-y-auto">
        {/* Photo Gallery Section */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
              Captured Evidence
            </h2>
            <span className="text-xs text-emerald-400 font-medium">
              {totalPhotos} photo{totalPhotos !== 1 ? 's' : ''}
            </span>
          </div>

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
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">
                    Before ({groupedPhotos.before.length})
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {groupedPhotos.before.map((photo, i) => (
                      <PhotoThumbnail
                        key={photo.id || photo.url || photo.timestamp || `before-${i}`}
                        photo={photo}
                        onClick={() => setSelectedPhoto(photo)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* During Photos */}
              {groupedPhotos.during.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">
                    During ({groupedPhotos.during.length})
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {groupedPhotos.during.map((photo, i) => (
                      <PhotoThumbnail
                        key={photo.id || photo.url || photo.timestamp || `during-${i}`}
                        photo={photo}
                        onClick={() => setSelectedPhoto(photo)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* After Photos */}
              {groupedPhotos.after.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">
                    After ({groupedPhotos.after.length})
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {groupedPhotos.after.map((photo, i) => (
                      <PhotoThumbnail
                        key={photo.id || photo.url || photo.timestamp || `after-${i}`}
                        photo={photo}
                        onClick={() => setSelectedPhoto(photo)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Client Satisfaction & Signature Section */}
        {!showSignaturePad ? (
          <motion.section variants={fadeInUp} initial="hidden" animate="visible">
            <div className="bg-emerald-950/30 border-2 border-emerald-500/20 rounded-2xl p-6">
              <div className="flex items-start gap-4 mb-6">
                <div className="size-12 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-emerald-400 text-2xl">
                    verified
                  </span>
                </div>
                <div className="flex-1">
                  <h2 className="font-bold text-white text-lg mb-2">
                    Client Satisfaction Confirmation
                  </h2>
                  <p className="text-slate-300 leading-relaxed">
                    {SATISFACTION_STATEMENT}
                  </p>
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
                Request Client Signature
              </ActionButton>

              {totalPhotos === 0 && (
                <p className="text-xs text-center text-amber-400 mt-2">
                  Capture photos before requesting signature
                </p>
              )}
            </div>
          </motion.section>
        ) : (
          /* Signature Pad */
          <motion.section
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="bg-slate-900 border-2 border-slate-800 rounded-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-emerald-950/20">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-emerald-400">
                    verified
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-white">Client Confirmation</h3>
                  <p className="text-sm text-slate-400">
                    {client?.name || 'Client'}, please sign below
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowSignaturePad(false);
                  clearSignature();
                }}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 min-h-[44px] min-w-[44px]"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Satisfaction Statement */}
            <div className="p-4 bg-slate-800/50 border-b border-slate-800">
              <p className="text-sm text-slate-300 leading-relaxed">
                <strong className="text-white">{SATISFACTION_STATEMENT}</strong>
              </p>
            </div>

            {/* Canvas */}
            <div className="p-4">
              <div
                ref={containerRef}
                className="h-[200px] rounded-xl overflow-hidden border-2 border-dashed border-slate-600 bg-slate-50"
              >
                <canvas
                  ref={canvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-full cursor-crosshair touch-none"
                />
              </div>

              {!hasSignature && (
                <p className="text-xs text-slate-500 text-center mt-2">
                  Sign above the line with your finger or stylus
                </p>
              )}

              {hasSignature && (
                <button
                  onClick={clearSignature}
                  className="mt-2 px-4 py-2 text-sm text-slate-400 hover:text-white"
                >
                  Clear signature
                </button>
              )}
            </div>

            {/* Confirmation Checkbox */}
            <div className="px-4 pb-4">
              <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl bg-slate-800/50 border-2 border-slate-700 hover:border-emerald-700 transition-colors">
                <input
                  type="checkbox"
                  checked={isConfirmed}
                  onChange={(e) => setIsConfirmed(e.target.checked)}
                  className="mt-1 w-6 h-6 rounded accent-emerald-500"
                />
                <span className="text-slate-300 leading-relaxed text-sm">
                  I confirm the statement above is true and authorize submission of this evidence.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <div className="p-4 border-t border-slate-800 bg-slate-800/30">
              <ActionButton
                variant="primary"
                icon="check_circle"
                onClick={handleSubmitWithSignature}
                disabled={!hasSignature || !isConfirmed}
                loading={submitting}
                fullWidth
                size="lg"
              >
                {submitting ? 'Submitting...' : 'Submit & Seal Evidence'}
              </ActionButton>

              {!hasSignature && (
                <p className="text-xs text-center text-slate-500 mt-2">
                  Signature required
                </p>
              )}
              {hasSignature && !isConfirmed && (
                <p className="text-xs text-center text-amber-400 mt-2">
                  Please confirm the statement above
                </p>
              )}
            </div>
          </motion.section>
        )}
      </main>

      {/* Photo Viewer Modal */}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/95 flex items-center justify-center p-4"
            onClick={() => setSelectedPhoto(null)}
          >
            <button
              className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-lg min-w-[44px] min-h-[44px]"
              onClick={() => setSelectedPhoto(null)}
            >
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>
            <button
              onClick={(e) => e.stopPropagation()}
              className="max-w-full max-h-[80vh]"
              type="button"
              aria-label="View evidence photo"
            >
              <img
                src={selectedPhoto.url || selectedPhoto.localPath}
                alt="Evidence"
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
              />
            </button>
            {selectedPhoto.timestamp && (
              <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur px-3 py-2 rounded-lg">
                <p className="text-xs text-slate-400">
                  {new Date(selectedPhoto.timestamp).toLocaleString('en-GB')}
                </p>
                {selectedPhoto.w3w && (
                  <p className="text-xs text-emerald-400 font-mono">
                    {`///${selectedPhoto.w3w}`}
                  </p>
                )}
              </div>
            )}
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

// Photo Thumbnail Component
interface PhotoThumbnailProps {
  photo: Photo;
  onClick: () => void;
}

const PhotoThumbnail: React.FC<PhotoThumbnailProps> = ({ photo, onClick }) => {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      className="relative aspect-square rounded-lg overflow-hidden bg-slate-800 border border-white/10 hover:border-primary/50 transition-colors"
    >
      <img
        src={photo.url || photo.localPath}
        alt={photo.type || 'Evidence'}
        className="w-full h-full object-cover"
      />
      {photo.type && (
        <span
          className={`absolute top-1 left-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
            photo.type === 'before'
              ? 'bg-blue-500/80 text-white'
              : photo.type === 'during'
              ? 'bg-amber-500/80 text-white'
              : 'bg-emerald-500/80 text-white'
          }`}
        >
          {photo.type}
        </span>
      )}
    </motion.button>
  );
};

export default TechEvidenceReview;
