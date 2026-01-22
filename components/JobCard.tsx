import React from 'react';
import { Job } from '../types';

interface JobCardProps {
  job: Job;
  onClick: () => void;
  onRetry?: (job: Job, event: React.MouseEvent) => void;
  photoDataUrls?: Map<string, string>;
}

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
 */
const JobCard: React.FC<JobCardProps> = ({ job, onClick, onRetry, photoDataUrls }) => {
  return (
    <button
      onClick={onClick}
      className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 hover:border-primary/30 transition-all text-left group"
    >
      {/* Header: Title + Status */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-white tracking-tighter uppercase group-hover:text-primary transition-colors truncate">
            {job.title}
          </h3>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
            {job.id}
          </p>
        </div>

        <div className={`
          inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-tight flex-shrink-0
          ${job.status === 'Submitted'
            ? 'bg-success/10 text-success border-success/20'
            : job.status === 'In Progress'
              ? 'bg-primary/10 text-primary border-primary/20'
              : 'bg-slate-800 text-slate-500 border-slate-700'
          }
        `}>
          {job.status}
        </div>
      </div>

      {/* Client Info */}
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/5">
        <span className="material-symbols-outlined text-slate-500 text-sm">business</span>
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
            <span className="material-symbols-outlined text-slate-500 text-xs">photo_library</span>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
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
                      <span className="material-symbols-outlined text-[10px] text-slate-600">image</span>
                    </div>
                  )}
                </div>
              );
            })}
            {job.photos.length > 4 && (
              <div className="size-8 rounded-md border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-[9px] font-black text-slate-500">
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
};

export default JobCard;
