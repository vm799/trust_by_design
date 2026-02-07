/**
 * Seal Badge Component
 *
 * Displays cryptographic seal status and verification results
 * Phase: C.3 - Cryptographic Sealing
 */

import React, { useState, useEffect } from 'react';
import { getSealStatus, verifyEvidence, formatHash, formatSealDate } from '../lib/sealing';
import type { SealStatus, VerificationResult } from '../lib/sealing';

interface SealBadgeProps {
  jobId: string;
  variant?: 'full' | 'compact';
}

const SealBadge: React.FC<SealBadgeProps> = ({ jobId, variant = 'full' }) => {
  const [sealStatus, setSealStatus] = useState<SealStatus | null>(null);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSealData = async () => {
      setIsLoading(true);

      // Get seal status
      const status = await getSealStatus(jobId);
      setSealStatus(status);

      // Auto-verify if sealed
      if (status.isSealed) {
        setIsVerifying(true);
        const result = await verifyEvidence(jobId);
        setVerification(result);
        setIsVerifying(false);
      }

      setIsLoading(false);
    };

    loadSealData();
  }, [jobId]);

  // Not sealed
  if (!isLoading && !sealStatus?.isSealed) {
    return null;
  }

  // Loading
  if (isLoading) {
    return (
      <div className="bg-slate-800/50 border border-white/5 rounded-2xl p-4 animate-pulse">
        <div className="h-4 bg-slate-700 rounded w-48 mb-2"></div>
        <div className="h-3 bg-slate-700 rounded w-32"></div>
      </div>
    );
  }

  // Compact variant (for lists)
  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2">
        {verification?.isValid ? (
          <>
            <span className="material-symbols-outlined text-success text-sm">verified</span>
            <span className="text-xs font-bold text-success uppercase">Sealed</span>
          </>
        ) : isVerifying ? (
          <>
            <span className="material-symbols-outlined text-slate-400 text-sm animate-spin">progress_activity</span>
            <span className="text-xs font-bold text-slate-400 uppercase">Verifying...</span>
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-danger text-sm">warning</span>
            <span className="text-xs font-bold text-danger uppercase">Invalid Seal</span>
          </>
        )}
      </div>
    );
  }

  // Full variant (for job detail pages)
  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-primary/20 rounded-[2.5rem] p-8 shadow-2xl">
      <div className="flex items-start gap-6">
        {/* Icon */}
        <div className={`size-20 rounded-[2rem] flex items-center justify-center shrink-0 ${
          verification?.isValid
            ? 'bg-success/10 text-success'
            : isVerifying
            ? 'bg-slate-700 text-slate-400'
            : 'bg-danger/10 text-danger'
        }`}>
          {isVerifying ? (
            <span className="material-symbols-outlined text-5xl font-black animate-spin">progress_activity</span>
          ) : verification?.isValid ? (
            <span className="material-symbols-outlined text-5xl font-black">verified</span>
          ) : (
            <span className="material-symbols-outlined text-5xl font-black">warning</span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 space-y-4">
          <div>
            <h3 className={`text-2xl font-bold tracking-tighter ${
              verification?.isValid ? 'text-success' : isVerifying ? 'text-slate-300' : 'text-danger'
            }`}>
              {isVerifying
                ? 'Verifying Seal...'
                : verification?.isValid
                ? 'Cryptographically Sealed'
                : 'Seal Invalid - Tampered'}
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              {verification?.message || 'Evidence integrity verification'}
            </p>
          </div>

          {/* Seal Metadata */}
          <div className="bg-slate-950/50 rounded-2xl p-5 space-y-3 border border-white/5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Evidence Hash</p>
                <p className="text-xs font-mono text-white break-all">
                  {formatHash(sealStatus?.evidenceHash, 24)}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Algorithm</p>
                <p className="text-xs font-bold text-white uppercase">{sealStatus?.algorithm || 'SHA256-HMAC'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-white/5">
              <div>
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Sealed At</p>
                <p className="text-xs font-bold text-white">{formatSealDate(sealStatus?.sealedAt)}</p>
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Sealed By</p>
                <p className="text-xs font-bold text-white">{sealStatus?.sealedBy || 'Unknown'}</p>
              </div>
            </div>

            {/* Verification Details */}
            {verification?.verification && (
              <div className="pt-3 border-t border-white/5">
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2">Verification Status</p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className={`material-symbols-outlined text-sm ${
                      verification.verification.hashMatch ? 'text-success' : 'text-danger'
                    }`}>
                      {verification.verification.hashMatch ? 'check_circle' : 'cancel'}
                    </span>
                    <span className="text-xs text-slate-300">Hash Match</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`material-symbols-outlined text-sm ${
                      verification.verification.signatureValid ? 'text-success' : 'text-danger'
                    }`}>
                      {verification.verification.signatureValid ? 'check_circle' : 'cancel'}
                    </span>
                    <span className="text-xs text-slate-300">Signature Valid</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-slate-400">schedule</span>
                    <span className="text-xs text-slate-400">
                      Verified {new Date(verification.verification.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Warning Message for Tampered Evidence */}
          {!isVerifying && !verification?.isValid && (
            <div className="bg-danger/10 border-2 border-danger/30 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-danger text-2xl">report_problem</span>
                <div>
                  <p className="text-sm font-black text-danger uppercase">Warning: Evidence Tampering Detected</p>
                  <p className="text-xs text-slate-300 mt-1">
                    The cryptographic verification has failed. This evidence may have been modified after sealing.
                    Do not rely on this evidence for legal or compliance purposes.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Legal Disclaimer */}
          {verification?.isValid && (
            <p className="text-[9px] text-slate-300 italic">
              This seal provides cryptographic proof of evidence integrity at the time of sealing.
              It does not guarantee legal admissibility in court.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SealBadge;
