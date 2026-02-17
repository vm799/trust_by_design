/**
 * SealingAnimation - High-Tech Evidence Sealing Animation
 *
 * Displays a forensic "encoding" animation when evidence is being sealed:
 * - Laser scan line moving down the photo
 * - Progress text: "Hashing Evidence... Mapping W3W... Encrypting to Vault"
 * - Hash generation visual
 * - Final lock animation
 *
 * Designed to communicate security and finality.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SealingAnimationProps {
  /** Whether the animation is active */
  isActive: boolean;

  /** Called when animation completes */
  onComplete?: () => void;

  /** Duration of the animation in ms */
  duration?: number;

  /** Photo URL to show behind the animation */
  photoUrl?: string;

  /** Optional className */
  className?: string;
}

/**
 * Sealing stages with their messages and icons
 */
const SEALING_STAGES = [
  { key: 'hash', message: 'Hashing Evidence...', icon: 'fingerprint', duration: 0.3 },
  { key: 'coords', message: 'Verifying Coordinates...', icon: 'gps_fixed', duration: 0.2 },
  { key: 'w3w', message: 'Mapping what3words...', icon: 'grid_3x3', duration: 0.2 },
  { key: 'encrypt', message: 'Encrypting to Vault...', icon: 'lock', duration: 0.2 },
  { key: 'seal', message: 'Evidence Sealed', icon: 'verified_user', duration: 0.1 },
];

/**
 * Generate random hex string for animation display only.
 * This is purely visual - actual hashes come from the sealing library.
 */
function generateAnimationHash(): string {
  const chars = '0123456789abcdef';
  return Array.from({ length: 64 }, () => chars[Math.floor(Math.random() * 16)]).join('');
}

const SealingAnimation: React.FC<SealingAnimationProps> = ({
  isActive,
  onComplete,
  duration = 3000,
  photoUrl,
  className = '',
}) => {
  const [currentStage, setCurrentStage] = useState(0);
  const [visualHash, setVisualHash] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  // Check if user prefers reduced motion
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Calculate stage durations based on total duration
  const stageDuration = duration / SEALING_STAGES.length;

  useEffect(() => {
    if (!isActive) {
      setCurrentStage(0);
      setIsComplete(false);
      setVisualHash('');
      return;
    }

    // Start hash scramble effect
    const hashInterval = setInterval(() => {
      setVisualHash(generateAnimationHash());
    }, 50);

    // Progress through stages
    const stageTimers: NodeJS.Timeout[] = [];
    SEALING_STAGES.forEach((_, index) => {
      const timer = setTimeout(() => {
        setCurrentStage(index);
      }, stageDuration * index);
      stageTimers.push(timer);
    });

    // Complete animation
    const completeTimer = setTimeout(() => {
      clearInterval(hashInterval);
      setVisualHash(generateAnimationHash()); // Final hash
      setIsComplete(true);
      onComplete?.();
    }, duration);

    return () => {
      clearInterval(hashInterval);
      stageTimers.forEach(clearTimeout);
      clearTimeout(completeTimer);
    };
  }, [isActive, duration, stageDuration, onComplete]);

  const stage = SEALING_STAGES[currentStage];

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/95 ${className}`}
        >
          {/* Background photo with darkening effect */}
          {photoUrl && (
            <div className="absolute inset-0">
              <img
                src={photoUrl}
                alt=""
                role="presentation"
                aria-hidden="true"
                className="w-full h-full object-cover opacity-20 blur-sm"
              />
            </div>
          )}

          {/* Scan lines overlay */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Horizontal scan lines */}
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,204,0.1) 2px, rgba(0,255,204,0.1) 4px)',
              }}
            />

            {/* Moving laser scan line - skip if reduced motion */}
            {!isComplete && !reducedMotion && (
              <motion.div
                initial={{ top: '0%' }}
                animate={{ top: '100%' }}
                transition={{
                  duration: duration / 1000,
                  ease: 'linear',
                }}
                className="absolute left-0 right-0 h-1"
                style={{
                  background: 'linear-gradient(90deg, transparent, #00FFCC, #00FFCC, transparent)',
                  boxShadow: '0 0 20px #00FFCC, 0 0 40px #00FFCC, 0 0 60px #00FFCC',
                }}
              />
            )}
          </div>

          {/* Central content */}
          <div className="relative z-10 w-full max-w-md px-6 text-center">
            {/* Lock icon with glow and morph animation */}
            <motion.div
              animate={
                reducedMotion
                  ? {} // No animation if reduced motion
                  : isComplete
                  ? { scale: [1, 1.2, 1], rotate: [0, -10, 0] }
                  : { rotate: [0, 5, -5, 0] }
              }
              transition={
                reducedMotion
                  ? {}
                  : isComplete
                  ? { duration: 0.6, ease: 'easeInOut' }
                  : { duration: 0.5, repeat: Infinity }
              }
              className="mx-auto mb-6"
            >
              <motion.div
                animate={
                  reducedMotion
                    ? {} // No animation if reduced motion
                    : {
                        background: isComplete
                          ? ['rgba(6, 182, 212, 0.2)', 'rgba(16, 185, 129, 0.2)']
                          : undefined,
                        boxShadow: isComplete
                          ? [
                              '0 0 40px rgba(0, 255, 204, 0.3)',
                              '0 0 60px rgba(16, 185, 129, 0.5)',
                              '0 0 40px rgba(16, 185, 129, 0.5)',
                            ]
                          : undefined,
                      }
                }
                transition={{ duration: 0.6 }}
                className={`
                  size-24 rounded-full flex items-center justify-center
                  ${isComplete
                    ? 'bg-emerald-500/20 shadow-[0_0_40px_rgba(16,185,129,0.5)]'
                    : 'bg-cyan-500/20 shadow-[0_0_40px_rgba(0,255,204,0.3)]'
                  }
                `}
              >
                <motion.span
                  key={stage.icon}
                  initial={reducedMotion ? {} : { scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={
                    reducedMotion
                      ? {}
                      : {
                          type: 'spring',
                          stiffness: 260,
                          damping: 20,
                        }
                  }
                  className={`material-symbols-outlined text-5xl ${
                    isComplete ? 'text-emerald-400' : 'text-cyan-400'
                  }`}
                >
                  {stage.icon}
                </motion.span>
              </motion.div>
            </motion.div>

            {/* Status message */}
            <motion.div
              key={stage.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4"
            >
              <h2 className={`text-xl font-bold ${
                isComplete ? 'text-emerald-400' : 'text-white'
              }`}>
                {stage.message}
              </h2>
            </motion.div>

            {/* Hash display */}
            <div className="mb-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10">
              <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                SHA-256 Hash
              </div>
              <div className="font-mono text-xs text-cyan-400 break-all leading-relaxed">
                {visualHash.slice(0, 32)}
                <br />
                {visualHash.slice(32)}
              </div>
            </div>

            {/* Progress stages */}
            <div className="flex justify-center gap-2 mb-6">
              {SEALING_STAGES.map((s, index) => (
                <motion.div
                  key={s.key}
                  initial={{ scale: 0.8, opacity: 0.5 }}
                  animate={{
                    scale: index <= currentStage ? 1 : 0.8,
                    opacity: index <= currentStage ? 1 : 0.5,
                  }}
                  className={`size-3 rounded-full ${
                    index < currentStage
                      ? 'bg-emerald-500'
                      : index === currentStage
                      ? isComplete ? 'bg-emerald-500' : 'bg-cyan-500'
                      : 'bg-slate-600'
                  }`}
                />
              ))}
            </div>

            {/* Algorithm info */}
            <div className="flex items-center justify-center gap-4 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">enhanced_encryption</span>
                AES-256-GCM
              </span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">fingerprint</span>
                SHA-256
              </span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">key</span>
                RSA-2048
              </span>
            </div>

            {/* Completion message */}
            <AnimatePresence>
              {isComplete && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/30"
                >
                  <div className="flex items-center justify-center gap-2 text-emerald-400">
                    <span className="material-symbols-outlined">verified_user</span>
                    <span className="font-bold">Cryptographically Sealed</span>
                  </div>
                  <p className="text-xs text-emerald-400/70 mt-1">
                    Evidence is tamper-proof and ready for sync
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Corner decorations */}
          <div className="absolute top-4 left-4 text-cyan-500/30">
            <span className="material-symbols-outlined text-4xl">crop_free</span>
          </div>
          <div className="absolute top-4 right-4 text-cyan-500/30 rotate-90">
            <span className="material-symbols-outlined text-4xl">crop_free</span>
          </div>
          <div className="absolute bottom-4 left-4 text-cyan-500/30 -rotate-90">
            <span className="material-symbols-outlined text-4xl">crop_free</span>
          </div>
          <div className="absolute bottom-4 right-4 text-cyan-500/30 rotate-180">
            <span className="material-symbols-outlined text-4xl">crop_free</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default React.memo(SealingAnimation);
