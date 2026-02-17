/**
 * ForensicPhotoCard - Industrial-Themed Evidence Photo Card
 *
 * Displays evidence photos with forensic-grade styling:
 * - Dark industrial theme (#121212 background)
 * - Integrity badges (GPS verified, W3W verified, hash verified)
 * - Neon teal glow when verified (box-shadow: 0 0 10px #00FFCC)
 * - Monospaced metadata (Roboto Mono feel)
 * - Chain of custody timeline
 * - Sync status indicator
 *
 * Designed to communicate security and unchangeability.
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ForensicPhotoCardProps {
  /** Photo ID */
  id: string;

  /** Photo URL */
  url: string;

  /** Photo type (before/during/after) */
  type: 'before' | 'during' | 'after' | 'other';

  /** Capture timestamp */
  timestamp: number;

  /** GPS coordinates */
  location?: {
    lat: number;
    lng: number;
    accuracy?: number;
  } | null;

  /** What3Words address */
  w3w?: string | null;

  /** Whether W3W is verified */
  w3wVerified?: boolean;

  /** Photo hash */
  hash?: string;

  /** Whether hash has been verified */
  hashVerified?: boolean;

  /** Whether evidence is sealed */
  isSealed?: boolean;

  /** Sync status */
  syncStatus?: 'pending' | 'synced' | 'failed';

  /** Chain of custody events */
  custody?: Array<{
    action: 'captured' | 'sealed' | 'synced' | 'verified';
    timestamp: number;
  }>;

  /** Click handler */
  onClick?: () => void;

  /** Optional className */
  className?: string;
}

/**
 * Photo type colors
 */
const TYPE_COLORS = {
  before: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Before' },
  during: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'During' },
  after: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'After' },
  other: { bg: 'bg-slate-500/20', text: 'text-slate-400', label: 'Other' },
};

/**
 * Sync status configs
 */
const SYNC_CONFIGS = {
  pending: { icon: 'cloud_upload', color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'Pending' },
  synced: { icon: 'cloud_done', color: 'text-emerald-400', bg: 'bg-emerald-500/20', label: 'Synced' },
  failed: { icon: 'cloud_off', color: 'text-red-400', bg: 'bg-red-500/20', label: 'Failed' },
};

/**
 * Format timestamp for display
 */
function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Truncate hash for display
 */
function truncateHash(hash: string, length = 12): string {
  if (hash.length <= length * 2) return hash;
  return `${hash.slice(0, length)}...${hash.slice(-length)}`;
}

const ForensicPhotoCard: React.FC<ForensicPhotoCardProps> = ({
  url,
  type,
  timestamp,
  location,
  w3w,
  w3wVerified = false,
  hash,
  hashVerified = false,
  isSealed = false,
  syncStatus = 'pending',
  custody = [],
  onClick,
  className = '',
}) => {
  const [showMetadata, setShowMetadata] = useState(false);
  const typeConfig = TYPE_COLORS[type];
  const syncConfig = SYNC_CONFIGS[syncStatus];

  // Calculate integrity score
  const integrityChecks = [
    { key: 'gps', verified: !!location, label: 'GPS' },
    { key: 'w3w', verified: !!w3w && w3wVerified, label: 'W3W' },
    { key: 'hash', verified: !!hash && hashVerified, label: 'Hash' },
    { key: 'seal', verified: isSealed, label: 'Sealed' },
  ];
  const verifiedCount = integrityChecks.filter(c => c.verified).length;
  const isFullyVerified = verifiedCount === integrityChecks.length;

  // Format W3W for display
  const displayW3W = w3w?.replace(/^\/\/\//, '') || null;

  const handleMetadataToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMetadata(prev => !prev);
  }, []);

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`relative group ${className}`}
    >
      <button
        onClick={onClick}
        className={`
          relative w-full aspect-square rounded-xl overflow-hidden
          bg-forensic-dark border-2 transition-all duration-300
          ${isFullyVerified
            ? 'border-sealed-glow/50 shadow-[0_0_15px_rgba(0,255,204,0.3)]'
            : isSealed
            ? 'border-sealed-glow/40 shadow-lg shadow-sealed-glow/20'
            : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
          }
        `}
      >
        {/* Photo */}
        <img
          src={url}
          alt={`${type} evidence`}
          className="w-full h-full object-cover"
        />

        {/* Sealed evidence gradient overlay */}
        {isSealed && (
          <div className="absolute inset-0 bg-gradient-to-br from-teal-500/20 to-cyan-500/20 pointer-events-none" />
        )}

        {/* Scan lines overlay for forensic feel */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.3) 3px, rgba(0,0,0,0.3) 4px)',
          }}
        />

        {/* Top badges row */}
        <div className="absolute top-2 left-2 right-2 flex items-start justify-between">
          {/* Type badge */}
          <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${typeConfig.bg} ${typeConfig.text}`}>
            {typeConfig.label}
          </span>

          {/* Integrity badges */}
          <div className="flex items-center gap-1">
            {isSealed && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="size-7 rounded-full bg-sealed-glow/20 flex items-center justify-center shadow-[0_0_10px_rgba(0,255,204,0.5)]"
              >
                <span className="material-symbols-outlined text-sm text-sealed-glow">verified_user</span>
              </motion.div>
            )}
            {syncStatus !== 'synced' && (
              <div className={`size-7 rounded-full ${syncConfig.bg} flex items-center justify-center`}>
                <span className={`material-symbols-outlined text-sm ${syncConfig.color}`}>
                  {syncConfig.icon}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Metadata toggle button */}
        <button
          onClick={handleMetadataToggle}
          className="absolute top-2 right-12 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-colors min-h-[44px] min-w-[44px]"
        >
          <span className="material-symbols-outlined text-sm text-white">info</span>
        </button>

        {/* Bottom gradient with metadata */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/80 to-transparent p-3 pt-8">
          {/* Timestamp */}
          <p className="font-mono text-[10px] text-slate-700 dark:text-slate-300">
            {formatTimestamp(timestamp)}
          </p>

          {/* Integrity indicators */}
          <div className="flex items-center gap-2 mt-1">
            {integrityChecks.map(check => (
              <span
                key={check.key}
                className={`flex items-center gap-0.5 text-[9px] font-mono ${
                  check.verified ? 'text-sealed-glow' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <span className="material-symbols-outlined text-[10px]">
                  {check.verified ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                {check.label}
              </span>
            ))}
          </div>
        </div>
      </button>

      {/* Expanded metadata panel */}
      <AnimatePresence>
        {showMetadata && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-full left-0 right-0 mt-2 z-20 rounded-xl bg-forensic-dark border border-slate-200 dark:border-white/10 p-3 shadow-xl"
          >
            <div className="space-y-2 font-mono text-xs">
              {/* GPS */}
              <div className="flex items-center gap-2">
                <span className={`material-symbols-outlined text-sm ${location ? 'text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                  gps_fixed
                </span>
                {location ? (
                  <span className="text-slate-700 dark:text-slate-300">
                    {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                    {location.accuracy && (
                      <span className="text-slate-500 dark:text-slate-400 ml-2">({Math.round(location.accuracy)}m)</span>
                    )}
                  </span>
                ) : (
                  <span className="text-slate-500 dark:text-slate-400">No GPS data</span>
                )}
              </div>

              {/* W3W */}
              <div className="flex items-center gap-2">
                <span className={`material-symbols-outlined text-sm ${displayW3W && w3wVerified ? 'text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                  grid_3x3
                </span>
                {displayW3W ? (
                  <span className="text-cyan-400">
                    {'///'}{displayW3W}
                    {w3wVerified && (
                      <span className="ml-2 text-emerald-400 text-[10px]">VERIFIED</span>
                    )}
                  </span>
                ) : (
                  <span className="text-slate-500 dark:text-slate-400">No W3W address</span>
                )}
              </div>

              {/* Hash */}
              {hash && (
                <div className="flex items-center gap-2">
                  <span className={`material-symbols-outlined text-sm ${hashVerified ? 'text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                    fingerprint
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">{truncateHash(hash)}</span>
                  {hashVerified && (
                    <span className="text-emerald-400 text-[10px]">VERIFIED</span>
                  )}
                </div>
              )}

              {/* Chain of custody */}
              {custody.length > 0 && (
                <div className="pt-2 mt-2 border-t border-slate-200 dark:border-white/10">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase mb-1">Chain of Custody</p>
                  {custody.map((event) => (
                    <div key={`custody-${event.action}-${event.timestamp}`} className="flex items-center gap-2 text-[10px]">
                      <span className={`size-1.5 rounded-full ${
                        event.action === 'captured' ? 'bg-blue-400' :
                        event.action === 'sealed' ? 'bg-emerald-400' :
                        event.action === 'synced' ? 'bg-cyan-400' :
                        'bg-amber-400'
                      }`} />
                      <span className="text-slate-500 dark:text-slate-400 capitalize">{event.action}</span>
                      <span className="text-slate-600">{formatTimestamp(event.timestamp)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default React.memo(ForensicPhotoCard);
