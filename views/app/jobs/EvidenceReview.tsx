/**
 * EvidenceReview - Evidence Gallery and Sealing
 *
 * Displays job evidence and allows managers to seal the job.
 *
 * Phase E: Job Lifecycle / Phase H: Seal & Verify
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader, PageContent } from '../../../components/layout';
import { Card, ActionButton, EmptyState, LoadingSkeleton, ConfirmDialog } from '../../../components/ui';
import { getJobs } from '../../../hooks/useWorkspaceData';
import { sealEvidence } from '../../../lib/sealing';
import { Job } from '../../../types';
import { route, ROUTES } from '../../../lib/routes';
import SealBadge from '../../../components/SealBadge';

interface Photo {
  url?: string;
  localPath?: string;
  type?: 'before' | 'during' | 'after';
  timestamp?: string;
  location?: { lat: number; lng: number };
}

const EvidenceReview: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<Job | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [showSealDialog, setShowSealDialog] = useState(false);
  const [sealing, setSealing] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;

      try {
        const jobs = await getJobs();
        const foundJob = jobs.find(j => j.id === id);
        setJob(foundJob || null);
      } catch (error) {
        console.error('Failed to load job:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  const handleSeal = async () => {
    if (!job) return;

    setSealing(true);
    try {
      const result = await sealEvidence(job.id);

      if (result.success) {
        // Refresh job data
        const jobs = await getJobs();
        const updatedJob = jobs.find(j => j.id === id);
        setJob(updatedJob || null);
        setShowSealDialog(false);
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
            {/* Before Photos */}
            {grouped.before.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
                  Before ({grouped.before.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {grouped.before.map((photo, i) => (
                    <PhotoCard
                      key={i}
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
                      key={i}
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
                      key={i}
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
                      key={i}
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

// Photo Card Component
interface PhotoCardProps {
  photo: Photo;
  locked: boolean;
  onClick: () => void;
}

const PhotoCard: React.FC<PhotoCardProps> = ({ photo, locked, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="relative aspect-square rounded-xl overflow-hidden bg-slate-800 border border-white/10 hover:border-white/20 transition-all group"
    >
      <img
        src={photo.url || photo.localPath}
        alt="Evidence"
        className="w-full h-full object-cover"
      />

      {/* Locked indicator */}
      {locked && (
        <div className="absolute top-2 right-2 size-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-sm text-emerald-400">lock</span>
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <span className="material-symbols-outlined text-white text-3xl">zoom_in</span>
      </div>

      {/* Metadata */}
      {photo.timestamp && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950/80 to-transparent p-2">
          <p className="text-[10px] text-slate-300">
            {new Date(photo.timestamp).toLocaleTimeString('en-AU', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      )}
    </button>
  );
};

export default EvidenceReview;
