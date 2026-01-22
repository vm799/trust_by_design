/**
 * CertificateVerify - Public Certificate Verification
 *
 * Public page for verifying sealed evidence certificates.
 *
 * Phase H: Seal & Verify
 */

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card, ActionButton, LoadingSkeleton } from '../../components/ui';
import { JobProofLogo } from '../../components/branding/jobproof-logo';
import { verifyEvidence, getSealStatus, formatHash, formatSealDate } from '../../lib/sealing';
import type { VerificationResult, SealStatus } from '../../lib/sealing';

const CertificateVerify: React.FC = () => {
  const { certificateId } = useParams<{ certificateId: string }>();
  const [searchParams] = useSearchParams();
  const jobId = certificateId || searchParams.get('jobId');

  const [loading, setLoading] = useState(true);
  const [sealStatus, setSealStatus] = useState<SealStatus | null>(null);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verify = async () => {
      if (!jobId) {
        setError('No certificate ID provided');
        setLoading(false);
        return;
      }

      try {
        const [status, result] = await Promise.all([
          getSealStatus(jobId),
          verifyEvidence(jobId),
        ]);

        setSealStatus(status);
        setVerification(result);

        if (!status.isSealed) {
          setError('This evidence has not been sealed');
        }
      } catch (err) {
        console.error('Verification failed:', err);
        setError('Unable to verify certificate. Please check the ID and try again.');
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [jobId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <LoadingSkeleton variant="card" count={1} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center px-4 py-8">
      {/* Logo */}
      <div className="mb-8">
        <JobProofLogo variant="full" size="lg" />
      </div>

      <div className="w-full max-w-lg">
        {error ? (
          /* Error State */
          <Card className="text-center py-8">
            <div className="size-16 mx-auto mb-4 rounded-2xl bg-red-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl text-red-400">error</span>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Verification Failed</h2>
            <p className="text-slate-400 mb-6">{error}</p>
            <ActionButton variant="secondary" to="/">
              Go to Homepage
            </ActionButton>
          </Card>
        ) : verification?.isValid ? (
          /* Valid Certificate */
          <Card className="border-2 border-emerald-500/30">
            {/* Header */}
            <div className="text-center mb-6 pb-6 border-b border-white/10">
              <div className="size-20 mx-auto mb-4 rounded-3xl bg-emerald-500/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-5xl text-emerald-400">verified</span>
              </div>
              <h1 className="text-2xl font-bold text-emerald-400 mb-1">Certificate Verified</h1>
              <p className="text-slate-400">This evidence has been cryptographically sealed</p>
            </div>

            {/* Certificate Details */}
            <div className="space-y-4">
              <div className="bg-slate-800/50 rounded-xl p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  Certificate ID
                </p>
                <p className="font-mono text-sm text-white break-all">
                  {jobId}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    Sealed At
                  </p>
                  <p className="text-sm text-white">
                    {formatSealDate(sealStatus?.sealedAt)}
                  </p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    Sealed By
                  </p>
                  <p className="text-sm text-white">
                    {sealStatus?.sealedBy || 'System'}
                  </p>
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  Evidence Hash
                </p>
                <p className="font-mono text-xs text-white break-all">
                  {sealStatus?.evidenceHash || 'N/A'}
                </p>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  Verification Status
                </p>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-emerald-400">check_circle</span>
                    <span className="text-xs text-slate-300">Hash Match</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-emerald-400">check_circle</span>
                    <span className="text-xs text-slate-300">Signature Valid</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-6 border-t border-white/10">
              <p className="text-[10px] text-slate-500 text-center">
                This certificate provides cryptographic proof of evidence integrity at the time of sealing.
                The hash algorithm used is SHA-256. Verification performed on {new Date().toLocaleString('en-AU')}.
              </p>
            </div>
          </Card>
        ) : (
          /* Invalid Certificate */
          <Card className="border-2 border-red-500/30">
            <div className="text-center mb-6">
              <div className="size-20 mx-auto mb-4 rounded-3xl bg-red-500/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-5xl text-red-400">gpp_bad</span>
              </div>
              <h1 className="text-2xl font-bold text-red-400 mb-1">Verification Failed</h1>
              <p className="text-slate-400">Evidence integrity could not be verified</p>
            </div>

            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-red-400">warning</span>
                <div>
                  <p className="font-medium text-red-400">Warning: Possible Tampering</p>
                  <p className="text-sm text-slate-400 mt-1">
                    The cryptographic verification has failed. This evidence may have been modified
                    after sealing. Do not rely on this evidence for legal or compliance purposes.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-xl p-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                Error Message
              </p>
              <p className="text-sm text-white">
                {verification?.message || 'Hash mismatch detected'}
              </p>
            </div>
          </Card>
        )}

        {/* Back Link */}
        <div className="text-center mt-6">
          <a href="/" className="text-sm text-slate-500 hover:text-white transition-colors">
            Powered by JobProof
          </a>
        </div>
      </div>
    </div>
  );
};

export default CertificateVerify;
