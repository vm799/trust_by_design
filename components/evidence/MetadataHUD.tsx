/**
 * MetadataHUD - Heads-Up Display for Evidence Capture
 *
 * Displays live-updating metadata overlay on camera view:
 * - GPS coordinates with accuracy indicator
 * - What3Words address (verified or pending)
 * - Timestamp
 * - Device ID
 * - Bunker mode status
 *
 * Designed for "bunker-proof" evidence capture with forensic-grade display.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeInDownSmall, scalePop, pulseOpacityFade, transitionPulse } from '../../lib/animations';

interface MetadataHUDProps {
  /** GPS coordinates */
  location?: {
    lat: number;
    lng: number;
    accuracy?: number;
  } | null;

  /** What3Words address */
  w3w?: string | null;

  /** Whether W3W is API-verified */
  w3wVerified?: boolean;

  /** Whether currently acquiring GPS */
  isAcquiringGPS?: boolean;

  /** Timestamp for display */
  timestamp?: number;

  /** Device identifier */
  deviceId?: string;

  /** Whether device is offline */
  isOffline?: boolean;

  /** Whether to show compact version */
  compact?: boolean;

  /** Optional className */
  className?: string;
}

/**
 * GPS accuracy thresholds (meters)
 */
const GPS_ACCURACY = {
  HIGH: 10,    // < 10m = high accuracy (green)
  MEDIUM: 50,  // 10-50m = medium accuracy (amber)
  LOW: 100,    // 50-100m = low accuracy (red)
};

/**
 * Get accuracy color based on GPS accuracy
 */
function getAccuracyColor(accuracy: number | undefined): string {
  if (!accuracy) return 'text-slate-400';
  if (accuracy <= GPS_ACCURACY.HIGH) return 'text-emerald-400';
  if (accuracy <= GPS_ACCURACY.MEDIUM) return 'text-amber-400';
  return 'text-red-400';
}

/**
 * Get accuracy label
 */
function getAccuracyLabel(accuracy: number | undefined): string {
  if (!accuracy) return 'Unknown';
  if (accuracy <= GPS_ACCURACY.HIGH) return 'High';
  if (accuracy <= GPS_ACCURACY.MEDIUM) return 'Medium';
  if (accuracy <= GPS_ACCURACY.LOW) return 'Low';
  return 'Poor';
}

const MetadataHUD: React.FC<MetadataHUDProps> = ({
  location,
  w3w,
  w3wVerified = false,
  isAcquiringGPS = false,
  timestamp,
  deviceId,
  isOffline = false,
  compact = false,
  className = '',
}) => {
  const displayTimestamp = timestamp || Date.now();
  const formattedTime = new Date(displayTimestamp).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // Format W3W for display (remove /// prefix if present)
  const displayW3W = w3w?.replace(/^\/\/\//, '') || null;

  if (compact) {
    return (
      <div className={`bg-black/80 backdrop-blur-sm rounded-lg px-3 py-2 font-mono text-xs ${className}`}>
        <div className="flex items-center gap-3">
          {/* GPS Status */}
          {isAcquiringGPS ? (
            <span className="text-amber-400 animate-pulse">GPS...</span>
          ) : location ? (
            <span className={getAccuracyColor(location.accuracy)}>
              {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
            </span>
          ) : (
            <span className="text-red-400">No GPS</span>
          )}

          {/* Bunker indicator */}
          {isOffline && (
            <span className="text-amber-400 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">shield</span>
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={fadeInDownSmall.initial}
      animate={fadeInDownSmall.animate}
      className={`bg-slate-950/90 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden ${className}`}
    >
      {/* HUD Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-white/10 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-sm text-primary">verified_user</span>
          <span className="text-xs font-bold text-white uppercase tracking-wider">Evidence Capture</span>
        </div>

        {/* Bunker Mode Badge */}
        <AnimatePresence>
          {isOffline && (
            <motion.div
              initial={scalePop.hidden}
              animate={scalePop.visible}
              exit={scalePop.exit}
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/20"
            >
              <motion.span
                animate={pulseOpacityFade}
                transition={transitionPulse}
                className="material-symbols-outlined text-xs text-amber-400"
              >
                shield
              </motion.span>
              <span className="text-[10px] font-bold text-amber-400 uppercase">Bunker</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Metadata Grid */}
      <div className="p-3 space-y-2 font-mono text-xs">
        {/* Timestamp Row */}
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-sm text-slate-400">schedule</span>
          <span className="text-slate-300">{formattedTime}</span>
          <span className="text-slate-400">UTC</span>
        </div>

        {/* GPS Row */}
        <div className="flex items-center gap-2">
          <span className={`material-symbols-outlined text-sm ${
            isAcquiringGPS ? 'text-amber-400 animate-pulse' :
            location ? getAccuracyColor(location.accuracy) : 'text-red-400'
          }`}>
            {isAcquiringGPS ? 'gps_not_fixed' : location ? 'gps_fixed' : 'gps_off'}
          </span>

          {isAcquiringGPS ? (
            <span className="text-amber-400">Acquiring GPS signal...</span>
          ) : location ? (
            <div className="flex items-center gap-2">
              <span className="text-slate-300">
                {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
              </span>
              {location.accuracy && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                  location.accuracy <= GPS_ACCURACY.HIGH
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : location.accuracy <= GPS_ACCURACY.MEDIUM
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {getAccuracyLabel(location.accuracy)} ({Math.round(location.accuracy)}m)
                </span>
              )}
            </div>
          ) : (
            <span className="text-red-400">GPS unavailable</span>
          )}
        </div>

        {/* W3W Row */}
        <div className="flex items-center gap-2">
          <span className={`material-symbols-outlined text-sm ${
            displayW3W
              ? w3wVerified ? 'text-emerald-400' : 'text-amber-400'
              : 'text-slate-400'
          }`}>
            grid_3x3
          </span>

          {displayW3W ? (
            <div className="flex items-center gap-2">
              <span className="text-cyan-400">{'///'}</span>
              <span className="text-slate-300">{displayW3W}</span>
              {w3wVerified ? (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400">
                  Verified
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400">
                  Pending
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400">W3W pending...</span>
          )}
        </div>

        {/* Device ID Row (if provided) */}
        {deviceId && (
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-slate-400">smartphone</span>
            <span className="text-slate-400 truncate">{deviceId}</span>
          </div>
        )}
      </div>

      {/* Sync Status Footer */}
      <div className={`px-3 py-2 border-t border-white/10 flex items-center gap-2 ${
        isOffline ? 'bg-amber-500/10' : 'bg-emerald-500/10'
      }`}>
        <span className={`material-symbols-outlined text-sm ${
          isOffline ? 'text-amber-400' : 'text-emerald-400'
        }`}>
          {isOffline ? 'cloud_off' : 'cloud_done'}
        </span>
        <span className={`text-[10px] font-bold uppercase ${
          isOffline ? 'text-amber-400' : 'text-emerald-400'
        }`}>
          {isOffline ? 'Local Vault Only' : 'Ready to Sync'}
        </span>
      </div>
    </motion.div>
  );
};

export default React.memo(MetadataHUD);
