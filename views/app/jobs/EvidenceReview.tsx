/**
 * EvidenceReview - Evidence Gallery and Sealing
 *
 * Displays job evidence and allows managers to seal the job.
 *
 * Phase E: Job Lifecycle / Phase H: Seal & Verify
 */

import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PageHeader, PageContent } from '../../../components/layout';
import { ActionButton, EmptyState, LoadingSkeleton, ConfirmDialog } from '../../../components/ui';
import { useData } from '../../../lib/DataContext';
import { sealEvidence } from '../../../lib/sealing';
import { Job } from '../../../types';
import { route, ROUTES } from '../../../lib/routes';
import SealBadge from '../../../components/SealBadge';
import { SealingAnimation, ForensicPhotoCard } from '../../../components/evidence';

interface Photo {
  id?: string;  // REMEDIATION ITEM 9: Added for stable React keys
  url?: string;
  localPath?: string;
  type?: 'before' | 'during' | 'after';
  timestamp?: string;
  location?: { lat: number; lng: number; accuracy?: number };
  w3w?: string;
  w3w_verified?: boolean;
  hash?: string;
  syncStatus?: 'pending' | 'synced' | 'failed';
}

const EvidenceReview: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  useNavigate();

  // Use DataContext for state management
  const { jobs, updateJob: contextUpdateJob, isLoading: loading, refresh } = useData();

  // Memoized job derivation from DataContext
  const job = useMemo(() => jobs.find(j => j.id === id) || null, [jobs, id]);

  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [showSealDialog, setShowSealDialog] = useState(false);
  const [sealing, setSealing] = useState(false);
  const [showSealingAnimation, setShowSealingAnimation] = useState(false);

  const handleSeal = async () => {
    if (!job) return;

    setSealing(true);
    setShowSealDialog(false);
    // NOTE: Animation starts ONLY after cryptographic sealing succeeds
    // Never show "Sealed" status until real sealing is confirmed

    try {
      const result = await sealEvidence(job.id);

      if (result.success) {
        // ONLY NOW show the sealing animation - after real cryptographic seal
        setShowSealingAnimation(true);

        // Update job in DataContext with sealed state
        const sealedJob: Job = {
          ...job,
          sealedAt: new Date().toISOString(),
          evidenceHash: result.evidenceHash,
        };
        contextUpdateJob(sealedJob);
        // Also refresh from server to ensure consistency
        await refresh();
      } else {
        throw new Error(result.error || 'Failed to seal evidence');
      }
    } catch (error) {
      console.error('Failed to seal job:', error);
      alert(error instanceof Error ? error.message : 'Failed to seal evidence. Please try again.');
    } finally {
      setSealing(false);
    }
  };

  const handleSealingComplete = () => {
    setShowSealingAnimation(false);
  };

  // Group photos by type
  const getPhotosByType = (photos: Photo[]) => {
    const before = photos.filter(p => p.type === 'before');
    const during = photos.filter(p => p.type === 'during');
    const after = photos.filter(p => p.type === 'after');
    const other = photos.filter(p => !p.type);

    return { before, during, after, other };
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Evidence Review" backTo={ROUTES.JOBS} backLabel="Jobs" />
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

  const photos = (job.photos || []) as Photo[];
  const isSealed = Boolean(job.sealedAt);
  const grouped = getPhotosByType(photos);

  return (
    <div>
      {/* Sealing Animation - Bunker-Proof UI */}
      <SealingAnimation
        isActive={showSealingAnimation}
        duration={3000}
        onComplete={handleSealingComplete}
      />

      <PageHeader
        title="Evidence Review"
        subtitle={job.title || `Job #${job.id.slice(0, 6)}`}
        backTo={route(ROUTES.JOB_DETAIL, { id: job.id })}
        backLabel="Job Details"
        actions={!isSealed ? [
          {
            label: 'Seal Evidence',
            icon: 'verified',
            onClick: () => setShowSealDialog(true),
            variant: 'primary',
            disabled: photos.length === 0,
          },
        ] : []}
      />

      <PageContent>
        {/* Seal Status */}
        {isSealed && (
          <div className="mb-6">
            <SealBadge jobId={job.id} />
          </div>
        )}

        {/* Unsealed Warning */}
        {!isSealed && photos.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-6 flex items-center gap-4">
            <div className="size-12 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl text-amber-400">warning</span>
            </div>
            <div className="flex-1">
              <p className="font-medium text-white">Evidence Not Sealed</p>
              <p className="text-sm text-slate-400">
                Review the evidence below and seal to create a cryptographic proof of integrity.
              </p>
            </div>
            <ActionButton
              variant="primary"
              icon="verified"
              onClick={() => setShowSealDialog(true)}
            >
              Seal Now
            </ActionButton>
          </div>
        )}

        {photos.length === 0 ? (
          <EmptyState
            icon="photo_camera"
            title="No evidence yet"
            description="Evidence will appear here once the technician uploads photos."
          />
        ) : (
          <div className="space-y-8">
            {/* Before Photos - REMEDIATION ITEM 9: Use stable keys */}
            {grouped.before.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
                  Before ({grouped.before.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {grouped.before.map((photo, i) => (
                    <PhotoCard
                      key={photo.id || photo.url || photo.timestamp || `before-${i}`}
                      photo={photo}
                      locked={isSealed}
                      onClick={() => setSelectedPhoto(photo)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* During Photos */}
            {grouped.during.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
                  During ({grouped.during.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {grouped.during.map((photo, i) => (
                    <PhotoCard
                      key={photo.id || photo.url || photo.timestamp || `during-${i}`}
                      photo={photo}
                      locked={isSealed}
                      onClick={() => setSelectedPhoto(photo)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* After Photos */}
            {grouped.after.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
                  After ({grouped.after.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {grouped.after.map((photo, i) => (
                    <PhotoCard
                      key={photo.id || photo.url || photo.timestamp || `after-${i}`}
                      photo={photo}
                      locked={isSealed}
                      onClick={() => setSelectedPhoto(photo)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Other Photos */}
            {grouped.other.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
                  Other ({grouped.other.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {grouped.other.map((photo, i) => (
                    <PhotoCard
                      key={photo.id || photo.url || photo.timestamp || `other-${i}`}
                      photo={photo}
                      locked={isSealed}
                      onClick={() => setSelectedPhoto(photo)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </PageContent>

      {/* Photo Viewer Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/95 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-lg"
            onClick={() => setSelectedPhoto(null)}
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
          <img
            src={selectedPhoto.url || selectedPhoto.localPath}
            alt="Evidence"
            className="max-w-full max-h-[80vh] object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
          {selectedPhoto.timestamp && (
            <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur px-3 py-2 rounded-lg">
              <p className="text-xs text-slate-400">
                {new Date(selectedPhoto.timestamp).toLocaleString('en-AU')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Seal Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showSealDialog}
        onClose={() => setShowSealDialog(false)}
        onConfirm={handleSeal}
        title="Seal Evidence"
        message="This will create a cryptographic hash of all evidence and lock it from further modification. This action cannot be undone."
        confirmLabel="Seal Evidence"
        variant="warning"
        icon="verified"
        loading={sealing}
      />
    </div>
  );
};

// Forensic Photo Card Component - Enhanced with integrity badges
interface PhotoCardProps {
  photo: Photo;
  locked: boolean;
  onClick: () => void;
}

const PhotoCard: React.FC<PhotoCardProps> = ({ photo, locked, onClick }) => {
  // Calculate integrity checks
  const hasGPS = Boolean(photo.location);
  const hasW3W = Boolean(photo.w3w);

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`
        relative aspect-square rounded-xl overflow-hidden
        bg-[#121212] border-2 transition-all duration-300 group
        ${locked
          ? 'border-[#00FFCC]/50 shadow-[0_0_15px_rgba(0,255,204,0.3)]'
          : 'border-white/10 hover:border-white/20'
        }
      `}
    >
      <img
        src={photo.url || photo.localPath}
        alt="Evidence"
        className="w-full h-full object-cover"
      />

      {/* Scan lines overlay for forensic feel */}
      <div
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.3) 3px, rgba(0,0,0,0.3) 4px)',
        }}
      />

      {/* Top badges row */}
      <div className="absolute top-2 left-2 right-2 flex items-start justify-between">
        {/* Type badge */}
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

        {/* Sealed/Sync indicator */}
        {locked ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="size-7 rounded-full bg-[#00FFCC]/20 flex items-center justify-center shadow-[0_0_10px_rgba(0,255,204,0.5)]"
          >
            <span className="material-symbols-outlined text-sm text-[#00FFCC]">verified_user</span>
          </motion.div>
        ) : photo.syncStatus === 'pending' ? (
          <div className="size-6 rounded-full bg-amber-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-xs text-amber-400">cloud_upload</span>
          </div>
        ) : photo.syncStatus === 'failed' ? (
          <div className="size-6 rounded-full bg-red-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-xs text-red-400">cloud_off</span>
          </div>
        ) : null}
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <span className="material-symbols-outlined text-white text-3xl">zoom_in</span>
      </div>

      {/* Bottom metadata with integrity indicators */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-2 pt-6">
        {/* Timestamp */}
        {photo.timestamp && (
          <p className="font-mono text-[10px] text-slate-300 mb-1">
            {new Date(photo.timestamp).toLocaleString('en-GB', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}

        {/* Integrity indicators */}
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-0.5 text-[9px] font-mono ${
            hasGPS ? 'text-[#00FFCC]' : 'text-slate-500'
          }`}>
            <span className="material-symbols-outlined text-[10px]">
              {hasGPS ? 'check_circle' : 'radio_button_unchecked'}
            </span>
            GPS
          </span>
          <span className={`flex items-center gap-0.5 text-[9px] font-mono ${
            hasW3W && photo.w3w_verified ? 'text-[#00FFCC]' : 'text-slate-500'
          }`}>
            <span className="material-symbols-outlined text-[10px]">
              {hasW3W && photo.w3w_verified ? 'check_circle' : 'radio_button_unchecked'}
            </span>
            W3W
          </span>
          <span className={`flex items-center gap-0.5 text-[9px] font-mono ${
            locked ? 'text-[#00FFCC]' : 'text-slate-500'
          }`}>
            <span className="material-symbols-outlined text-[10px]">
              {locked ? 'check_circle' : 'radio_button_unchecked'}
            </span>
            Sealed
          </span>
        </div>
      </div>
    </motion.button>
  );
};

export default EvidenceReview;
