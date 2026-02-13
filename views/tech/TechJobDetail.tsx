/**
 * TechJobDetail - Technician Job Detail View
 *
 * Shows job details and evidence capture for technicians.
 * UX improvements:
 * - Workflow progress indicator (Start → Capture → Review → Seal)
 * - Before/During/After photo sections with color coding
 * - Photo count badges per type
 * - Better visual hierarchy with clearer CTAs
 * - Larger touch targets for field use
 *
 * Phase G: Technician Portal
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, ActionButton, EmptyState, LoadingSkeleton, ErrorState } from '../../components/ui';
import { useData } from '../../lib/DataContext';
import { useAuth } from '../../lib/AuthContext';
import { Job, Photo } from '../../types';
import { OfflineIndicator } from '../../components/OfflineIndicator';
import { fadeInUp, staggerContainer } from '../../lib/animations';
import { hapticConfirm, hapticTap } from '../../lib/haptics';

const formatDateUTC = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

const formatTimeUTC = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }) + ' UTC';
};

// Workflow steps for progress indicator
const WORKFLOW_STEPS = [
  { id: 'start', label: 'Start', icon: 'play_arrow' },
  { id: 'capture', label: 'Capture', icon: 'photo_camera' },
  { id: 'review', label: 'Review', icon: 'rate_review' },
  { id: 'sealed', label: 'Sealed', icon: 'lock' },
] as const;

const getWorkflowStep = (job: Job, canComplete: boolean): number => {
  if (job.sealedAt) return 3;
  if (job.status === 'Submitted' || job.status === 'Complete') return 3;
  if (canComplete) return 2;
  if (job.status === 'In Progress') return 1;
  return 0;
};

const TechJobDetail: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  const { jobs, clients, technicians, updateJob: contextUpdateJob, isLoading, error: dataError, refresh } = useData();
  const { userId, userEmail } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<{ type: 'start' | 'complete' | 'review'; message: string } | null>(null);

  // Find the current user's technician record by email
  // Managers assign jobs using the technician table ID (not auth UID), so we need
  // to look up our tech record to match by that ID too
  const myTechRecord = useMemo(() =>
    technicians.find(t => t.email && userEmail && t.email.toLowerCase() === userEmail.toLowerCase()),
    [technicians, userEmail]
  );

  // SECURITY FIX: Only find jobs assigned to this technician
  const job = useMemo(() => {
    const found = jobs.find(j => j.id === jobId) || null;
    if (!found || !userId) return found;
    // Ownership check: technician can only view their own jobs
    // Match by auth UID, tech table ID (via email lookup), or email
    const isOwner = found.technicianId === userId ||
      found.techId === userId ||
      found.techMetadata?.createdByTechId === userId ||
      // Match by technician table ID (managers assign using tech table ID, not auth UID)
      (myTechRecord && (found.technicianId === myTechRecord.id || found.techId === myTechRecord.id)) ||
      (userEmail && found.techEmail && found.techEmail.toLowerCase() === userEmail.toLowerCase());
    return isOwner ? found : null;
  }, [jobs, jobId, userId, userEmail, myTechRecord]);
  const client = useMemo(() =>
    job ? clients.find(c => c.id === job.clientId) || null : null,
    [clients, job]
  );

  // Memoize derived photo data
  const { photos, beforePhotos, duringPhotos, afterPhotos, isActive, canComplete, isSealed, isSubmitted, currentWorkflowStep } = useMemo(() => {
    if (!job) return { photos: [] as Photo[], beforePhotos: [] as Photo[], duringPhotos: [] as Photo[], afterPhotos: [] as Photo[], isActive: false, canComplete: false, isSealed: false, isSubmitted: false, currentWorkflowStep: 0 };
    const p = job.photos || [];
    const before = p.filter(ph => ph.type?.toLowerCase() === 'before');
    const during = p.filter(ph => ph.type?.toLowerCase() === 'during');
    const after = p.filter(ph => ph.type?.toLowerCase() === 'after');
    const active = job.status === 'In Progress';
    const complete = before.length >= 1 && after.length >= 1;
    return {
      photos: p,
      beforePhotos: before,
      duringPhotos: during,
      afterPhotos: after,
      isActive: active,
      canComplete: complete,
      isSealed: !!job.sealedAt,
      isSubmitted: job.status === 'Submitted' || job.status === 'Complete',
      currentWorkflowStep: getWorkflowStep(job, complete),
    };
  }, [job]);

  const handleStartJob = useCallback(async () => {
    if (!job) return;
    setActionError(null);

    try {
      const updatedJob: Job = { ...job, status: 'In Progress' };
      contextUpdateJob(updatedJob);
      hapticConfirm();
    } catch {
      setActionError({ type: 'start', message: 'Failed to start job. Tap to retry.' });
    }
  }, [job, contextUpdateJob]);

  const handleReviewEvidence = useCallback(async () => {
    if (!job) return;
    setActionError(null);

    setSubmitting(true);
    try {
      hapticTap();
      navigate(`/tech/job/${job.id}/review`);
    } catch {
      setActionError({ type: 'review', message: 'Failed to open evidence review. Tap to retry.' });
    } finally {
      setSubmitting(false);
    }
  }, [job, navigate]);

  const handleRetry = useCallback(() => {
    if (actionError?.type === 'start') {
      handleStartJob();
    } else if (actionError?.type === 'complete' || actionError?.type === 'review') {
      handleReviewEvidence();
    }
  }, [actionError, handleStartJob, handleReviewEvidence]);

  const openMaps = useCallback(() => {
    if (!job?.address) return;

    const encodedAddress = encodeURIComponent(job.address);
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    window.open(mapsUrl, '_blank');
  }, [job?.address]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-6">
        <LoadingSkeleton variant="card" count={2} />
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <ErrorState message={dataError} onRetry={refresh} />
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
      <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-xl border-b border-white/15 px-4 py-4">
        <div className="flex items-center gap-4">
          <Link to="/tech" aria-label="Back to jobs list" className="p-1 text-slate-400 hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div className="flex-1">
            <h1 className="font-medium text-white truncate">
              {job.title || `Job #${job.id.slice(0, 6)}`}
            </h1>
            <p className="text-xs text-slate-500">{client?.name}</p>
          </div>
          <OfflineIndicator />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-6 pb-32">
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">

          {/* Workflow Progress */}
          <motion.div variants={fadeInUp} className="flex items-center gap-1 px-2">
            {WORKFLOW_STEPS.map((step, i) => (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div className={`
                    size-9 rounded-xl flex items-center justify-center transition-all
                    ${i <= currentWorkflowStep
                      ? i < currentWorkflowStep
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-primary/20 text-primary ring-2 ring-primary/30'
                      : 'bg-slate-800 text-slate-600'
                    }
                  `}>
                    <span className="material-symbols-outlined text-sm">
                      {i < currentWorkflowStep ? 'check' : step.icon}
                    </span>
                  </div>
                  <span className={`text-[10px] font-medium ${
                    i <= currentWorkflowStep ? 'text-slate-300' : 'text-slate-600'
                  }`}>
                    {step.label}
                  </span>
                </div>
                {i < WORKFLOW_STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 rounded-full mt-[-18px] ${
                    i < currentWorkflowStep ? 'bg-emerald-500/40' : 'bg-slate-800'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </motion.div>

          {/* Status Banner */}
          <motion.div variants={fadeInUp}>
            <div className={`
              p-4 rounded-2xl flex items-center gap-4
              ${isSealed ? 'bg-emerald-500/10 border border-emerald-500/20' :
                isActive ? 'bg-primary/10 border border-primary/20' :
                'bg-slate-800 border border-white/15'}
            `}>
              <div className={`
                size-12 rounded-xl flex items-center justify-center
                ${isSealed ? 'bg-emerald-500/20 text-emerald-400' :
                  isActive ? 'bg-primary/20 text-primary' :
                  'bg-slate-700 text-slate-400'}
              `}>
                <span className="material-symbols-outlined text-2xl">
                  {isSealed ? 'lock' : isActive ? 'play_circle' : 'schedule'}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-white">
                    {isSealed ? 'Evidence Sealed' : isSubmitted ? 'Submitted' : isActive ? 'Job In Progress' : 'Ready to Start'}
                  </p>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    isSealed ? 'bg-emerald-500/20 text-emerald-400' :
                    isActive ? 'bg-primary/20 text-primary' :
                    'bg-slate-600 text-slate-300'
                  }`}>
                    {job.status}
                  </span>
                </div>
                <p className="text-sm text-slate-400">
                  {isSealed
                    ? 'Evidence cryptographically sealed and locked'
                    : isSubmitted
                    ? 'Awaiting evidence sealing'
                    : isActive
                    ? 'Capture evidence and complete when done'
                    : 'Tap below to start this job'}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Error Banner with Retry */}
          {actionError && (
            <motion.div variants={fadeInUp}>
              <button
                onClick={handleRetry}
                className="w-full p-4 rounded-2xl flex items-center gap-4 bg-red-500/10 border border-red-500/20 text-left min-h-[56px]"
              >
                <div className="size-12 rounded-xl flex items-center justify-center bg-red-500/20 text-red-400 flex-shrink-0">
                  <span className="material-symbols-outlined text-2xl">error</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-red-400">{actionError.message}</p>
                  <p className="text-sm text-slate-400">Tap to try again</p>
                </div>
                <span className="material-symbols-outlined text-red-400">refresh</span>
              </button>
            </motion.div>
          )}

          {/* Job Info */}
          <motion.div variants={fadeInUp}>
            <Card>
              <div className="space-y-4">
                {/* Date & Time */}
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-slate-500">schedule</span>
                  <div>
                    <p className="text-white">{formatDateUTC(job.date)}</p>
                    <p className="text-sm text-slate-500">{formatTimeUTC(job.date)}</p>
                  </div>
                </div>

                {/* Address */}
                {job.address && (
                  <button
                    onClick={openMaps}
                    aria-label="Open address in Google Maps"
                    className="w-full flex items-center gap-3 p-3 -mx-3 rounded-xl hover:bg-white/5 transition-colors text-left min-h-[44px]"
                  >
                    <span className="material-symbols-outlined text-primary">location_on</span>
                    <div className="flex-1">
                      <p className="text-white">{job.address}</p>
                      <p className="text-sm text-primary">Open in Maps</p>
                    </div>
                    <span className="material-symbols-outlined text-slate-500">open_in_new</span>
                  </button>
                )}

                {/* Description */}
                {job.description && (
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-slate-500">description</span>
                    <p className="text-white">{job.description}</p>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          {/* Evidence Section */}
          <motion.section variants={fadeInUp}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
                Evidence
              </h3>
              <span className="text-xs text-slate-500">
                {photos.length} photo{photos.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Photo Count Summary */}
            {photos.length > 0 && (
              <div className="flex gap-2 mb-4">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                  beforePhotos.length > 0 ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-800 text-slate-600'
                }`}>
                  {beforePhotos.length} Before
                </span>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                  duringPhotos.length > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-600'
                }`}>
                  {duringPhotos.length} During
                </span>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                  afterPhotos.length > 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-600'
                }`}>
                  {afterPhotos.length} After
                </span>
              </div>
            )}

            {/* Before Photos */}
            <Card className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-blue-500" />
                  <h4 className="font-medium text-white">Before</h4>
                </div>
                <span className={`text-xs ${beforePhotos.length > 0 ? 'text-blue-400' : 'text-slate-500'}`}>
                  {beforePhotos.length} captured
                </span>
              </div>
              {beforePhotos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {beforePhotos.map((photo) => (
                    <div key={photo.id} className="aspect-square rounded-lg bg-slate-800 overflow-hidden border border-blue-500/20">
                      <img
                        src={photo.url || photo.localPath}
                        alt={`Before - ${job.title}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No before photos captured yet</p>
              )}
            </Card>

            {/* During Photos */}
            <Card className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-amber-500" />
                  <h4 className="font-medium text-white">During</h4>
                </div>
                <span className={`text-xs ${duringPhotos.length > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                  {duringPhotos.length} captured
                </span>
              </div>
              {duringPhotos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {duringPhotos.map((photo) => (
                    <div key={photo.id} className="aspect-square rounded-lg bg-slate-800 overflow-hidden border border-amber-500/20">
                      <img
                        src={photo.url || photo.localPath}
                        alt={`During - ${job.title}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No during photos captured yet</p>
              )}
            </Card>

            {/* After Photos */}
            <Card className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-emerald-500" />
                  <h4 className="font-medium text-white">After</h4>
                </div>
                <span className={`text-xs ${afterPhotos.length > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {afterPhotos.length} captured
                </span>
              </div>
              {afterPhotos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {afterPhotos.map((photo) => (
                    <div key={photo.id} className="aspect-square rounded-lg bg-slate-800 overflow-hidden border border-emerald-500/20">
                      <img
                        src={photo.url || photo.localPath}
                        alt={`After - ${job.title}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No after photos captured yet</p>
              )}
            </Card>
          </motion.section>

          {/* Completion Notes (if present) */}
          {job.completionNotes && (
            <motion.section variants={fadeInUp}>
              <Card className="bg-amber-950/20 border-amber-500/20">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-amber-400">edit_note</span>
                  <div className="flex-1">
                    <h4 className="font-medium text-amber-400 text-sm mb-1">Completion Notes</h4>
                    <p className="text-slate-300 text-sm whitespace-pre-wrap">{job.completionNotes}</p>
                  </div>
                </div>
              </Card>
            </motion.section>
          )}

          {/* Confirmed Badge - Shows when client has signed */}
          {job.clientConfirmation && (
            <motion.section variants={fadeInUp}>
              <Card className="bg-emerald-950/30 border-emerald-500/20">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-emerald-400 text-xl">check_circle</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-emerald-400">Client Confirmed</p>
                    <p className="text-sm text-slate-400">
                      Signed {formatDateUTC(job.clientConfirmation.timestamp)} at {formatTimeUTC(job.clientConfirmation.timestamp)}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.section>
          )}
        </motion.div>
      </main>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-white/10 px-4 py-4 pb-safe">
        <div className="flex gap-3">
          {!isActive && !isSubmitted && !isSealed ? (
            <ActionButton
              variant="primary"
              icon="play_arrow"
              onClick={handleStartJob}
              fullWidth
              size="lg"
            >
              Start Job
            </ActionButton>
          ) : isActive ? (
            <>
              <Link to={`/tech/job/${job.id}/capture`} className="flex-1">
                <ActionButton
                  variant="primary"
                  icon="photo_camera"
                  fullWidth
                  size="lg"
                >
                  Capture
                </ActionButton>
              </Link>
              <ActionButton
                variant={canComplete ? 'secondary' : 'ghost'}
                icon="rate_review"
                onClick={handleReviewEvidence}
                disabled={!canComplete}
                loading={submitting}
                size="lg"
              >
                Review
              </ActionButton>
            </>
          ) : null}
        </div>
        {isActive && !canComplete && (
          <p className="text-xs text-slate-500 text-center mt-2">
            Capture at least 1 before and 1 after photo to review
          </p>
        )}
      </div>
    </div>
  );
};

export default TechJobDetail;
