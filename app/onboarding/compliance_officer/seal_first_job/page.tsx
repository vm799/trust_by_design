'use client';

/**
 * Compliance Officer - Step 3: Seal First Job
 * Learn the blockchain sealing process for tamper-proof evidence
 */

import { useState } from 'react';
import OnboardingFactory from '@/components/OnboardingFactory';

export default function SealFirstJobPage() {
  const [sealingStep, setSealingStep] = useState(1); // 1: review, 2: sealing, 3: complete
  const [sealed, setSealed] = useState(false);

  const mockJob = {
    id: '12345',
    title: 'Electrical Safety Inspection - Unit 4B',
    client: 'Riverside Apartments',
    technician: 'Mike Johnson',
    completed_at: '2026-01-17T14:30:00',
    photos: 12,
    safety_checks: 5,
    evidence_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    blockchain_tx: '0x' + Math.random().toString(16).substring(2),
  };

  const handleSeal = async () => {
    setSealingStep(2);
    // Simulate blockchain sealing
    await new Promise(resolve => setTimeout(resolve, 2000));
    setSealingStep(3);
    setSealed(true);
  };

  const handleComplete = async () => {
    return {
      sealed_job_id: mockJob.id,
      blockchain_tx: mockJob.blockchain_tx,
      evidence_hash: mockJob.evidence_hash,
      seal_timestamp: new Date().toISOString(),
    };
  };

  return (
    <OnboardingFactory persona="compliance_officer" step="seal_first_job">
      <div className="space-y-8">
        {/* Sealing Progress */}
        {sealingStep === 1 && (
          <>
            {/* Job Summary */}
            <div className="p-6 bg-white border-2 border-gray-200 rounded-2xl">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-green-600">work</span>
                <span>Job Ready for Sealing</span>
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Job:</span>
                  <span className="font-semibold text-gray-900">{mockJob.title}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Client:</span>
                  <span className="font-semibold text-gray-900">{mockJob.client}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Technician:</span>
                  <span className="font-semibold text-gray-900">{mockJob.technician}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Evidence:</span>
                  <span className="font-semibold text-gray-900">{mockJob.photos} photos, {mockJob.safety_checks} checks</span>
                </div>
              </div>
            </div>

            {/* What Happens When You Seal */}
            <div className="p-6 bg-blue-50 border-2 border-blue-200 rounded-2xl">
              <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined">info</span>
                <span>What happens when you seal?</span>
              </h3>
              <ul className="space-y-2 text-sm text-blue-700">
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
                  <span>SHA-256 hash generated from all photos + metadata</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
                  <span>Hash recorded on Ethereum blockchain (immutable)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
                  <span>Job locked - no further edits possible</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
                  <span>Certificate generated with blockchain proof</span>
                </li>
              </ul>
            </div>

            {/* Seal Button */}
            <button
              onClick={handleSeal}
              className="w-full py-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-2xl font-semibold text-lg hover:from-green-700 hover:to-green-800 transition-all shadow-xl flex items-center justify-center gap-3"
            >
              <span className="material-symbols-outlined text-2xl">lock</span>
              <span>Seal Job with Blockchain</span>
            </button>
          </>
        )}

        {/* Sealing in Progress */}
        {sealingStep === 2 && (
          <div className="p-12 text-center">
            <div className="w-24 h-24 border-8 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-6" />
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              Sealing Evidence...
            </h3>
            <p className="text-gray-600 mb-6">
              Generating cryptographic hash and recording to blockchain
            </p>
            <div className="max-w-md mx-auto space-y-2 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-green-600">check_circle</span>
                <span>Hashing {mockJob.photos} photos...</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-green-600">check_circle</span>
                <span>Computing SHA-256...</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                <span>Broadcasting to Ethereum...</span>
              </div>
            </div>
          </div>
        )}

        {/* Sealed Successfully */}
        {sealingStep === 3 && (
          <>
            <div className="p-8 bg-green-50 border-2 border-green-200 rounded-2xl text-center">
              <span className="material-symbols-outlined text-green-600 text-6xl mb-4 inline-block">
                verified
              </span>
              <h3 className="text-2xl font-bold text-green-900 mb-2">
                🎉 Job Successfully Sealed
              </h3>
              <p className="text-green-700 mb-6">
                Evidence is now tamper-proof and legally admissible
              </p>

              {/* Blockchain Details */}
              <div className="p-4 bg-white border border-green-200 rounded-xl text-left space-y-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Evidence Hash (SHA-256)</div>
                  <div className="font-mono text-xs text-gray-900 break-all bg-gray-50 p-2 rounded">
                    {mockJob.evidence_hash}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Blockchain Transaction</div>
                  <div className="font-mono text-xs text-gray-900 break-all bg-gray-50 p-2 rounded">
                    {mockJob.blockchain_tx}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Seal Timestamp</div>
                  <div className="text-sm text-gray-900">
                    {new Date().toLocaleString('en-GB', {
                      dateStyle: 'full',
                      timeStyle: 'long',
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Legal Standing */}
            <div className="p-6 bg-blue-50 border-2 border-blue-200 rounded-2xl">
              <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined">gavel</span>
                <span>Legal Standing</span>
              </h3>
              <ul className="space-y-2 text-sm text-blue-700">
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
                  <span>Admissible in UK courts under Electronic Communications Act 2000</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
                  <span>eIDAS compliant for EU cross-border recognition</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
                  <span>NIST SP 800-57 cryptographic standards</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
                  <span>Tamper detection: Any modification invalidates the seal</span>
                </li>
              </ul>
            </div>

            {/* Verification Link */}
            <div className="p-6 bg-gray-50 border-2 border-gray-200 rounded-2xl text-center">
              <h3 className="font-semibold text-gray-900 mb-3">
                Public Verification
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Anyone can verify this seal using the blockchain transaction ID:
              </p>
              <button className="px-6 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors inline-flex items-center gap-2">
                <span className="material-symbols-outlined">open_in_new</span>
                <span>View on Etherscan</span>
              </button>
            </div>
          </>
        )}
      </div>
    </OnboardingFactory>
  );
}
