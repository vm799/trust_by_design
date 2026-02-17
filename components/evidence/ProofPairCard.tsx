/**
 * ProofPairCard - Before/After Evidence Comparison Card
 *
 * Manager view for comparing evidence pairs with:
 * - Side-by-side Before/After photos (1:1 ratio)
 * - Header with Job ID, Client Name, Status Badge
 * - Footer with metadata (GPS, Time, Device)
 * - "Verify" or "Flag for Review" actions
 * - Happy Glow (green) when verified, Sad Glow (amber) for issues
 *
 * @see UX Research: "The Proof-Pair Card (Manager View)"
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeInUpSmall, pulseOpacityFade, pulseDot, transitionPulse, transitionPulseFast, collapseExpand } from '../../lib/animations';

interface Photo {
  id?: string;
  url?: string;
  localPath?: string;
  type?: 'before' | 'during' | 'after';
  timestamp?: string;
  location?: { lat: number; lng: number; accuracy?: number };
  w3w?: string;
  w3w_verified?: boolean;
}

interface ProofPairCardProps {
  /** Job ID */
  jobId: string;

  /** Client name */
  clientName: string;

  /** Job status */
  status: 'pending' | 'complete' | 'verified' | 'flagged';

  /** Before photo */
  beforePhoto?: Photo;

  /** After photo */
  afterPhoto?: Photo;

  /** Whether evidence is sealed */
  isSealed?: boolean;

  /** Time gap between before and after (hours) */
  timeGap?: number;

  /** Device ID that captured the photos */
  deviceId?: string;

  /** Handler for verify action */
  onVerify?: () => void;

  /** Handler for flag action */
  onFlag?: () => void;

  /** Handler for photo click */
  onPhotoClick?: (photo: Photo) => void;

  /** Optional className */
  className?: string;
}

/**
 * Status badge configurations
 */
const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    icon: 'schedule',
    color: 'text-amber-400',
    bg: 'bg-amber-500/20',
    glow: '',
  },
  complete: {
    label: 'Complete',
    icon: 'check_circle',
    color: 'text-blue-400',
    bg: 'bg-blue-500/20',
    glow: '',
  },
  verified: {
    label: 'Verified',
    icon: 'verified_user',
    color: 'text-[#00FFCC]',
    bg: 'bg-[#00FFCC]/20',
    glow: 'shadow-[0_0_15px_rgba(0,255,204,0.4)]',
  },
  flagged: {
    label: 'Flagged',
    icon: 'flag',
    color: 'text-red-400',
    bg: 'bg-red-500/20',
    glow: 'shadow-[0_0_15px_rgba(239,68,68,0.4)]',
  },
};

/**
 * Format timestamp for display
 */
function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Format coordinates for display
 */
function formatCoords(location: { lat: number; lng: number }): string {
  return `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
}

const ProofPairCard: React.FC<ProofPairCardProps> = ({
  jobId,
  clientName,
  status,
  beforePhoto,
  afterPhoto,
  isSealed = false,
  timeGap,
  deviceId,
  onVerify,
  onFlag,
  onPhotoClick,
  className = '',
}) => {
  const [showMetadata, setShowMetadata] = useState(false);
  const config = STATUS_CONFIG[status];

  // Check for issues
  const hasGapIssue = timeGap !== undefined && timeGap > 4; // > 4 hours gap
  const missingBefore = !beforePhoto;
  const missingAfter = !afterPhoto;
  const hasIssue = hasGapIssue || missingBefore || missingAfter;

  return (
    <motion.div
      initial={fadeInUpSmall.initial}
      animate={fadeInUpSmall.animate}
      className={`
        rounded-2xl overflow-hidden
        bg-[#121212] border-2 transition-all duration-300
        ${isSealed ? 'border-[#00FFCC]/40' : hasIssue ? 'border-amber-500/40' : 'border-slate-200 dark:border-white/10'}
        ${isSealed ? config.glow : hasIssue ? 'shadow-[0_0_15px_rgba(245,158,11,0.3)]' : ''}
        ${className}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-100/70 dark:bg-white/10 border-b border-slate-200 dark:border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`size-8 rounded-lg ${config.bg} flex items-center justify-center shrink-0`}>
            <span className={`material-symbols-outlined text-lg ${config.color}`}>
              {config.icon}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-mono text-xs text-slate-500 dark:text-slate-400 truncate">{jobId}</p>
            <p className="font-bold text-slate-900 dark:text-white truncate">{clientName}</p>
          </div>
        </div>

        {/* Status badge */}
        <span className={`px-3 py-1.5 rounded-lg text-xs font-medium ${config.bg} ${config.color}`}>
          {config.label}
        </span>
      </div>

      {/* Photo Pair */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-black">
        {/* Before Photo */}
        <div className="relative aspect-square">
          {beforePhoto ? (
            <button
              onClick={() => onPhotoClick?.(beforePhoto)}
              className="w-full h-full group"
            >
              <img
                src={beforePhoto.url || beforePhoto.localPath}
                alt="Before"
                className="w-full h-full object-cover"
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-2xl">zoom_in</span>
              </div>
              {/* Label */}
              <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-blue-500/80 text-white text-[10px] font-bold uppercase">
                Before
              </div>
              {/* Timestamp */}
              {beforePhoto.timestamp && (
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <p className="font-mono text-[9px] text-white/80">
                    {formatTimestamp(beforePhoto.timestamp)}
                  </p>
                </div>
              )}
            </button>
          ) : (
            <div className="w-full h-full bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center gap-2">
              <motion.div
                animate={pulseOpacityFade}
                transition={transitionPulse}
                className="size-12 rounded-full bg-amber-500/20 flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-2xl text-amber-400">photo_camera</span>
              </motion.div>
              <p className="text-xs text-amber-400 font-bold">MISSING</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Before photo</p>
            </div>
          )}
        </div>

        {/* Map Pin Divider (visual only) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
          <div className="size-8 rounded-full bg-primary flex items-center justify-center shadow-lg">
            <span className="material-symbols-outlined text-white text-sm">location_on</span>
          </div>
        </div>

        {/* After Photo */}
        <div className="relative aspect-square">
          {afterPhoto ? (
            <button
              onClick={() => onPhotoClick?.(afterPhoto)}
              className="w-full h-full group"
            >
              <img
                src={afterPhoto.url || afterPhoto.localPath}
                alt="After"
                className="w-full h-full object-cover"
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-2xl">zoom_in</span>
              </div>
              {/* Label */}
              <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-emerald-500/80 text-white text-[10px] font-bold uppercase">
                After
              </div>
              {/* Timestamp */}
              {afterPhoto.timestamp && (
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <p className="font-mono text-[9px] text-white/80">
                    {formatTimestamp(afterPhoto.timestamp)}
                  </p>
                </div>
              )}
            </button>
          ) : (
            <div className="w-full h-full bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center gap-2">
              <motion.div
                animate={pulseDot}
                transition={transitionPulseFast}
                className="size-12 rounded-full bg-red-500/20 flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-2xl text-red-400">warning</span>
              </motion.div>
              <p className="text-xs text-red-400 font-bold">MISSING</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">After photo</p>
            </div>
          )}
        </div>
      </div>

      {/* Gap Warning */}
      {hasGapIssue && (
        <div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/20 flex items-center gap-2">
          <span className="material-symbols-outlined text-sm text-amber-400">schedule</span>
          <span className="text-xs text-amber-400">
            {timeGap}h gap between Before and After
          </span>
        </div>
      )}

      {/* Metadata Footer */}
      <div className="px-4 py-3 border-t border-slate-200 dark:border-white/10">
        <button
          onClick={() => setShowMetadata(!showMetadata)}
          className="w-full flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <span className="font-mono">
            {beforePhoto?.location && formatCoords(beforePhoto.location)}
          </span>
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">
              {showMetadata ? 'expand_less' : 'expand_more'}
            </span>
            Metadata
          </span>
        </button>

        <AnimatePresence>
          {showMetadata && (
            <motion.div
              initial={collapseExpand.hidden}
              animate={collapseExpand.visible}
              exit={collapseExpand.exit}
              className="overflow-hidden"
            >
              <div className="pt-3 space-y-2 font-mono text-[10px]">
                {/* GPS */}
                {beforePhoto?.location && (
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-xs text-emerald-400">gps_fixed</span>
                    <span className="text-slate-700 dark:text-slate-300">GPS: {formatCoords(beforePhoto.location)}</span>
                    {beforePhoto.location.accuracy && (
                      <span className="text-slate-500 dark:text-slate-400">({Math.round(beforePhoto.location.accuracy)}m)</span>
                    )}
                  </div>
                )}

                {/* W3W */}
                {beforePhoto?.w3w && (
                  <div className="flex items-center gap-2">
                    <span className={`material-symbols-outlined text-xs ${beforePhoto.w3w_verified ? 'text-emerald-400' : 'text-amber-400'}`}>
                      grid_3x3
                    </span>
                    <span className="text-cyan-400">{'///'}</span>
                    <span className="text-slate-700 dark:text-slate-300">{beforePhoto.w3w.replace(/^\/\/\//, '')}</span>
                    {beforePhoto.w3w_verified && (
                      <span className="text-emerald-400 text-[9px]">VERIFIED</span>
                    )}
                  </div>
                )}

                {/* Device */}
                {deviceId && (
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-xs text-slate-500 dark:text-slate-400">smartphone</span>
                    <span className="text-slate-500 dark:text-slate-400">Device: {deviceId}</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Actions */}
      {(onVerify || onFlag) && (
        <div className="flex gap-2 p-3 border-t border-slate-200 dark:border-white/10">
          {onVerify && status !== 'verified' && (
            <button
              onClick={onVerify}
              disabled={missingBefore || missingAfter}
              className={`
                flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2
                ${missingBefore || missingAfter
                  ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                  : 'bg-[#00FFCC]/20 text-[#00FFCC] hover:bg-[#00FFCC]/30 transition-colors'
                }
              `}
            >
              <span className="material-symbols-outlined text-lg">verified</span>
              Verify
            </button>
          )}
          {onFlag && status !== 'flagged' && (
            <button
              onClick={onFlag}
              className="flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">flag</span>
              Flag for Review
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default React.memo(ProofPairCard);
