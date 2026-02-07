/**
 * SealingProgressModal - Auto-Seal Progress Indicator
 *
 * Shows cryptographic sealing progress when job status changes to "Submitted".
 * Displays real-time status of RSA-2048 + SHA-256 evidence sealing process.
 *
 * Constitution: NO hardcoded statuses, NO mock data, DELETE on completion
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeInScale, transitionSmooth } from '../../lib/animations';

export type SealingStatus = 'hashing' | 'signing' | 'storing' | 'complete' | 'error';

interface SealingProgressModalProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Current sealing status */
  status: SealingStatus;
  /** Progress percentage (0-100) */
  progress: number;
  /** Error message if status is 'error' */
  errorMessage?: string;
  /** Called when user dismisses modal after completion or error */
  onClose: () => void;
  /** Called when user clicks retry after error */
  onRetry?: () => void;
}

const SealingProgressModal: React.FC<SealingProgressModalProps> = ({
  isOpen,
  status,
  progress,
  errorMessage,
  onClose,
  onRetry,
}) => {
  const [autoCloseTimer, setAutoCloseTimer] = useState<NodeJS.Timeout | null>(null);

  // Auto-dismiss after 2 seconds on completion
  useEffect(() => {
    if (status === 'complete' && isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 2000);
      setAutoCloseTimer(timer);
      return () => clearTimeout(timer);
    }
  }, [status, isOpen, onClose]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoCloseTimer) {
        clearTimeout(autoCloseTimer);
      }
    };
  }, [autoCloseTimer]);

  if (!isOpen) {
    return null;
  }

  const getStatusConfig = () => {
    switch (status) {
      case 'hashing':
        return {
          icon: 'tag',
          label: 'Computing SHA-256 Hash',
          description: 'Creating cryptographic fingerprint of evidence bundle',
          color: 'text-[#00FFCC]',
          bgColor: 'bg-[#00FFCC]/20',
          glowColor: 'shadow-[0_0_20px_rgba(0,255,204,0.5)]',
        };
      case 'signing':
        return {
          icon: 'key',
          label: 'Applying RSA-2048 Signature',
          description: 'Cryptographically signing evidence with private key',
          color: 'text-[#00FFCC]',
          bgColor: 'bg-[#00FFCC]/20',
          glowColor: 'shadow-[0_0_20px_rgba(0,255,204,0.5)]',
        };
      case 'storing':
        return {
          icon: 'cloud_upload',
          label: 'Storing Seal',
          description: 'Saving cryptographic seal to secure storage',
          color: 'text-[#00FFCC]',
          bgColor: 'bg-[#00FFCC]/20',
          glowColor: 'shadow-[0_0_20px_rgba(0,255,204,0.5)]',
        };
      case 'complete':
        return {
          icon: 'lock',
          label: 'Evidence Sealed',
          description: 'Job locked with cryptographic proof of integrity',
          color: 'text-emerald-400',
          bgColor: 'bg-emerald-500/20',
          glowColor: 'shadow-[0_0_30px_rgba(16,185,129,0.6)]',
        };
      case 'error':
        return {
          icon: 'error',
          label: 'Sealing Failed',
          description: errorMessage || 'Failed to seal evidence',
          color: 'text-red-400',
          bgColor: 'bg-red-500/20',
          glowColor: 'shadow-[0_0_20px_rgba(239,68,68,0.5)]',
        };
    }
  };

  const config = getStatusConfig();
  const showActions = status === 'complete' || status === 'error';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            variants={fadeInScale}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={transitionSmooth}
            className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sealing-title"
          >
            {/* Animated Glow Background */}
            <motion.div
              animate={{
                opacity: [0.3, 0.6, 0.3],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 2,
                repeat: status === 'complete' || status === 'error' ? 0 : Infinity,
                ease: 'easeInOut',
              }}
              className={`absolute inset-0 ${config.bgColor} blur-3xl`}
            />

            {/* Content */}
            <div className="relative p-6">
              {/* Icon */}
              <div className="flex justify-center mb-4">
                <motion.div
                  animate={
                    status === 'complete'
                      ? { scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }
                      : status === 'error'
                      ? { x: [-5, 5, -5, 5, 0] }
                      : { rotate: [0, 360] }
                  }
                  transition={
                    status === 'complete'
                      ? { duration: 0.6 }
                      : status === 'error'
                      ? { duration: 0.4 }
                      : { duration: 2, repeat: Infinity, ease: 'linear' }
                  }
                  className={`size-20 rounded-2xl ${config.bgColor} flex items-center justify-center ${config.glowColor}`}
                >
                  <span className={`material-symbols-outlined text-4xl ${config.color}`}>
                    {config.icon}
                  </span>
                </motion.div>
              </div>

              {/* Title */}
              <h2
                id="sealing-title"
                className="text-xl font-semibold text-white text-center mb-2"
              >
                {config.label}
              </h2>

              {/* Description */}
              <p className="text-sm text-slate-400 text-center mb-6">
                {config.description}
              </p>

              {/* Progress Bar */}
              {status !== 'complete' && status !== 'error' && (
                <div className="mb-6">
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                      className="h-full bg-gradient-to-r from-[#00FFCC] to-[#00CC99] shadow-[0_0_10px_rgba(0,255,204,0.6)]"
                    />
                  </div>
                  <p className="text-xs text-slate-500 text-center mt-2">
                    {Math.round(progress)}% Complete
                  </p>
                </div>
              )}

              {/* Cryptographic Details Badge */}
              {(status === 'hashing' || status === 'signing') && (
                <div className="bg-slate-800/50 border border-white/5 rounded-xl p-3 mb-4">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="material-symbols-outlined text-base text-[#00FFCC]">
                      shield
                    </span>
                    <span>
                      {status === 'hashing' ? 'SHA-256' : 'RSA-2048'} Algorithm Active
                    </span>
                  </div>
                </div>
              )}

              {/* Actions */}
              {showActions && (
                <div className="flex gap-3">
                  {status === 'error' && onRetry && (
                    <button
                      onClick={onRetry}
                      className="flex-1 min-h-[44px] px-4 py-3 bg-[#00FFCC]/20 hover:bg-[#00FFCC]/30 text-[#00FFCC] rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined">refresh</span>
                      Retry
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className={`flex-1 min-h-[44px] px-4 py-3 rounded-xl font-medium transition-colors ${
                      status === 'complete'
                        ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400'
                        : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                  >
                    {status === 'complete' ? 'Done' : 'Close'}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default SealingProgressModal;
