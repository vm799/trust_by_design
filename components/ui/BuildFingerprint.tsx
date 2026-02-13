/**
 * Build Fingerprint Debug Badge
 *
 * Displays build info in the corner of the screen for debugging.
 * Shows: Build hash, Schema version, SW status
 *
 * Only visible when:
 * - Dev mode is enabled (localStorage: jobproof_dev_mode=true)
 * - Or import.meta.env.DEV is true
 * - Or ?debug=1 query param is present
 *
 * Click to expand full details, long-press (5s) to trigger dev reset.
 */

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { getBuildInfo, isDevMode, developerReset } from '../../lib/devReset';

interface BuildFingerprintProps {
  /** Force show even in production */
  forceShow?: boolean;
  /** Position on screen */
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
}

interface ServiceWorkerStatus {
  active: boolean;
  version: string | null;
  updateAvailable: boolean;
}

const BuildFingerprint: React.FC<BuildFingerprintProps> = memo(({
  forceShow = false,
  position = 'bottom-right',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [swStatus, setSwStatus] = useState<ServiceWorkerStatus>({
    active: false,
    version: null,
    updateAvailable: false,
  });
  const [isResetting, setIsResetting] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);

  const holdTimerRef = useRef<number | null>(null);
  const holdStartRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  const buildInfo = getBuildInfo();

  // Check if should be visible
  const shouldShow =
    forceShow ||
    isDevMode() ||
    (typeof window !== 'undefined' && window.location.search.includes('debug=1'));

  // Check service worker status
  useEffect(() => {
    if (!shouldShow) return;

    const checkSW = async () => {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          // Get version from SW
          if (registration.active) {
            // Request version from SW
            const messageChannel = new MessageChannel();
            messageChannel.port1.onmessage = (event) => {
              if (event.data?.type === 'VERSION_INFO') {
                setSwStatus({
                  active: true,
                  version: event.data.version,
                  updateAvailable: !!registration.waiting,
                });
              }
            };
            registration.active.postMessage({ type: 'GET_VERSION' }, [messageChannel.port2]);
          }

          setSwStatus(prev => ({
            ...prev,
            active: !!registration.active,
            updateAvailable: !!registration.waiting,
          }));
        }
      }
    };

    checkSW();
  }, [shouldShow]);

  // Handle long press for dev reset
  const handlePointerDown = useCallback(() => {
    holdStartRef.current = Date.now();

    // Start progress animation
    const animate = () => {
      const elapsed = Date.now() - holdStartRef.current;
      const progress = Math.min(elapsed / 5000, 1); // 5 seconds
      setHoldProgress(progress);

      if (progress >= 1) {
        // Trigger reset
        setIsResetting(true);
        developerReset(true);
        return;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, []);

  const handlePointerUp = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setHoldProgress(0);
    holdStartRef.current = 0;
  }, []);

  // Cleanup on unmount
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refs are stable; cleanup reads .current at unmount time
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
      }
    };
  }, []);

  if (!shouldShow) return null;

  // Position styles
  const positionStyles: Record<string, string> = {
    'bottom-left': 'bottom-2 left-2',
    'bottom-right': 'bottom-2 right-2',
    'top-left': 'top-2 left-2',
    'top-right': 'top-2 right-2',
  };

  return (
    <div
      className={`fixed ${positionStyles[position]} z-[9999] select-none`}
      style={{ touchAction: 'none' }}
    >
      {/* Hold progress ring */}
      {holdProgress > 0 && (
        <div className="absolute inset-0 pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="rgba(239, 68, 68, 0.3)"
              strokeWidth="4"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#ef4444"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${holdProgress * 283} 283`}
              transform="rotate(-90 50 50)"
            />
          </svg>
        </div>
      )}

      {/* Main badge */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
        disabled={isResetting}
        className={`
          flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-mono
          transition-all duration-200
          ${isResetting
            ? 'bg-red-600 text-white animate-pulse'
            : 'bg-slate-800/90 text-slate-400 hover:bg-slate-700/90 hover:text-slate-300'
          }
          backdrop-blur-sm border border-slate-600/50
        `}
        title="Build info (hold 5s to reset)"
      >
        {isResetting ? (
          <>
            <span className="size-2 bg-red-400 rounded-full animate-ping" />
            <span>Resetting...</span>
          </>
        ) : (
          <>
            <span
              className={`size-2 rounded-full ${
                swStatus.active ? 'bg-green-500' : 'bg-yellow-500'
              } ${swStatus.updateAvailable ? 'animate-pulse' : ''}`}
            />
            <span>{buildInfo.commit.slice(0, 7)}</span>
            <span className="text-slate-400">v{buildInfo.schemaVersion}</span>
          </>
        )}
      </button>

      {/* Expanded panel */}
      {isExpanded && !isResetting && (
        <div
          className={`
            absolute ${position.includes('bottom') ? 'bottom-full mb-2' : 'top-full mt-2'}
            ${position.includes('right') ? 'right-0' : 'left-0'}
            w-64 p-3 rounded-lg
            bg-slate-800/95 backdrop-blur-sm border border-slate-600/50
            text-xs font-mono text-slate-300
            shadow-xl
          `}
        >
          <div className="space-y-2">
            <div className="flex justify-between items-center border-b border-slate-600 pb-2 mb-2">
              <span className="font-semibold text-slate-200">Build Info</span>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="text-slate-400 hover:text-slate-300"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1">
              <span className="text-slate-400">Commit:</span>
              <span className="text-right">{buildInfo.commit}</span>

              <span className="text-slate-400">Schema:</span>
              <span className="text-right">v{buildInfo.schemaVersion}</span>

              <span className="text-slate-400">SW:</span>
              <span className="text-right">
                {swStatus.active ? (
                  <span className="text-green-400">
                    {swStatus.version || 'active'}
                    {swStatus.updateAvailable && (
                      <span className="ml-1 text-yellow-400">↑</span>
                    )}
                  </span>
                ) : (
                  <span className="text-yellow-400">inactive</span>
                )}
              </span>

              <span className="text-slate-400">Mode:</span>
              <span className="text-right">
                {import.meta.env.DEV ? (
                  <span className="text-yellow-400">dev</span>
                ) : (
                  <span className="text-green-400">prod</span>
                )}
              </span>

              <span className="text-slate-400">Built:</span>
              <span className="text-right text-[9px]">
                {new Date(buildInfo.buildTime).toLocaleDateString()}
              </span>
            </div>

            {/* Reset instructions */}
            <div className="mt-3 pt-2 border-t border-slate-600">
              <p className="text-slate-400 text-[10px] leading-tight">
                Hold badge for 5s to trigger full reset
                (clears all caches, IndexedDB, localStorage)
              </p>
            </div>

            {/* Quick actions */}
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 px-2 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-[10px] text-slate-300"
              >
                Reload
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm('Clear ALL data and reload?')) {
                    developerReset(true);
                  }
                }}
                className="flex-1 px-2 py-1.5 bg-red-900/50 hover:bg-red-800/50 rounded text-[10px] text-red-300"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

BuildFingerprint.displayName = 'BuildFingerprint';

export default BuildFingerprint;
