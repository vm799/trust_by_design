import React from 'react';
import { Job } from '../types';

interface JobCardProps {
  job: Job;
  onClick: () => void;
  onRetry?: (job: Job, event: React.MouseEvent) => void;
  photoDataUrls?: Map<string, string>;
}

/**
 * Job Lifecycle Stage Determination
 * Maps job state to operational spine: DISPATCH → CAPTURE → SEAL → VERIFY → DELIVER
 */
type LifecycleStage = 'dispatched' | 'capture' | 'awaiting_seal' | 'sealed' | 'verified';

interface LifecycleInfo {
  stage: LifecycleStage;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const getJobLifecycle = (job: Job): LifecycleInfo => {
  // VERIFIED: Submitted status (already sealed and verified)
  if (job.status === 'Submitted') {
    return {
      stage: 'verified',
      label: 'Verified',
      icon: 'verified',
      color: 'text-success',
      bgColor: 'bg-success/10',
      borderColor: 'border-success/20',
    };
  }

  // SEALED: Has sealedAt timestamp
  if (job.sealedAt || job.isSealed) {
    return {
      stage: 'sealed',
      label: 'Sealed',
      icon: 'lock',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      borderColor: 'border-primary/20',
    };
  }

  // AWAITING SEAL: Has evidence and signature, ready to seal
  if (job.photos.length > 0 && job.signature) {
    return {
      stage: 'awaiting_seal',
      label: 'Awaiting Seal',
      icon: 'signature',
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      borderColor: 'border-warning/20',
    };
  }

  // CAPTURE: In progress with photos
  if (job.status === 'In Progress' && job.photos.length > 0) {
    return {
      stage: 'capture',
      label: 'Capturing',
      icon: 'photo_camera',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      borderColor: 'border-primary/20',
    };
  }

  // DISPATCHED: Created but not yet started or no evidence
  return {
    stage: 'dispatched',
    label: 'Dispatched',
    icon: 'send',
    color: 'text-slate-400',
    bgColor: 'bg-slate-800',
    borderColor: 'border-slate-700',
  };
};

/**
 * Mobile-Optimized Job Card
 * Replaces table view on small screens
 *
 * Features:
 * - Touch-friendly (min 48px tap targets)
 * - Visual hierarchy optimized for mobile
 * - Status badges and sync indicators
 * - Photo thumbnails
 * - Retry action for failed syncs
 * - Memoized to prevent unnecessary re-renders
 */
const JobCard: React.FC<JobCardProps> = React.memo(({ job, onClick, onRetry, photoDataUrls }) => {
  const lifecycle = getJobLifecycle(job);

  return (
    <button
      onClick={onClick}
      className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 hover:border-primary/30 transition-all text-left group"
    >
      {/* Header: Title + Lifecycle Status */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-white tracking-tighter uppercase group-hover:text-primary transition-colors truncate">
            {job.title}
          </h3>
          <p className="text-[10px] text-slate-300 font-mono mt-0.5 truncate">
            {job.id}
          </p>
        </div>

        <div className={`
          inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-tight flex-shrink-0
          ${lifecycle.bgColor} ${lifecycle.color} ${lifecycle.borderColor}
        `}>
          <span className="material-symbols-outlined text-xs font-black">{lifecycle.icon}</span>
          {lifecycle.label}
        </div>
      </div>

      {/* Client Info */}
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/5">
        <span className="material-symbols-outlined text-slate-300 text-sm">business</span>
        <span className="text-xs text-slate-300 font-bold truncate">{job.client}</span>
      </div>

      {/* Technician Info */}
      <div className="flex items-center gap-2 mb-3">
        <div className="size-6 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-400 uppercase flex-shrink-0">
          {job.technician[0]}
        </div>
        <span className="text-xs text-slate-400 font-medium truncate">{job.technician}</span>
      </div>

      {/* Evidence Photos */}
      {job.photos.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="material-symbols-outlined text-slate-300 text-xs">photo_library</span>
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
              {job.photos.length} Photo{job.photos.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex -space-x-2">
            {job.photos.slice(0, 4).map((p, i) => {
              const displayUrl = p.isIndexedDBRef ? (photoDataUrls?.get(p.id) || '') : p.url;
              return (
                <div key={i} className="size-8 rounded-md border-2 border-slate-900 overflow-hidden bg-slate-800 flex-shrink-0">
                  {displayUrl ? (
                    <img
                      src={displayUrl}
                      className="w-full h-full object-cover grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all"
                      alt="Evidence"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="material-symbols-outlined text-[10px] text-slate-400">image</span>
                    </div>
                  )}
                </div>
              );
            })}
            {job.photos.length > 4 && (
              <div className="size-8 rounded-md border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-[9px] font-black text-slate-300">
                +{job.photos.length - 4}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sync Status */}
      <div className="flex items-center justify-between pt-3 border-t border-white/5">
        <div className="flex items-center gap-2">
          <span className={`
            material-symbols-outlined text-sm font-black
            ${job.syncStatus === 'synced'
              ? 'text-success'
              : job.syncStatus === 'failed'
                ? 'text-danger'
                : 'text-primary animate-spin'
            }
          `}>
            {job.syncStatus === 'synced'
              ? 'cloud_done'
              : job.syncStatus === 'failed'
                ? 'sync_problem'
                : 'sync'
            }
          </span>
          <span className={`
            text-[9px] font-black uppercase tracking-widest
            ${job.syncStatus === 'synced'
              ? 'text-success'
              : job.syncStatus === 'failed'
                ? 'text-danger'
                : 'text-primary'
            }
          `}>
            {job.syncStatus}
          </span>
        </div>

        {job.syncStatus === 'failed' && onRetry && (
          <button
            onClick={(e) => onRetry(job, e)}
            className="px-3 py-2 bg-danger/10 hover:bg-danger/20 border border-danger/20 text-danger rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-xs">refresh</span>
            Retry
          </button>
        )}
      </div>
    </button>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for optimal memoization
  // Only re-render if job data, onClick, onRetry, or photoDataUrls actually changed
  return (
    prevProps.job.id === nextProps.job.id &&
    prevProps.job.status === nextProps.job.status &&
    prevProps.job.syncStatus === nextProps.job.syncStatus &&
    prevProps.job.photos.length === nextProps.job.photos.length &&
    prevProps.onClick === nextProps.onClick &&
    prevProps.onRetry === nextProps.onRetry &&
    prevProps.photoDataUrls === nextProps.photoDataUrls
  );
});

JobCard.displayName = 'JobCard';

export default JobCard;
