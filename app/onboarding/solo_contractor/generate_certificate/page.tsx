'use client';

/**
 * Solo Contractor - Step 4: Generate Certificate
 * Final step - Shows preview of compliance certificate
 */

import { useState, useEffect } from 'react';
import OnboardingFactory from '@/components/OnboardingFactory';
import { createClient } from '@/utils/supabase/client';

export default function GenerateCertificatePage() {
  const supabase = createClient();

  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const mockCertificate = {
    job_title: 'Electrical Safety Inspection',
    client_name: 'Johnson Residence',
    location: '42 Oak Street, Manchester M1 1AB',
    completed_date: new Date().toISOString().split('T')[0],
    technician_name: '',
    certification_number: `CERT-${Date.now().toString().slice(-8)}`,
    safety_checks_passed: 5,
    photos_uploaded: 12,
    blockchain_sealed: true,
  };

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      setUserProfile(profile);
      mockCertificate.technician_name = profile?.full_name || user.email || 'Your Name';
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    return {
      certificate_generated: true,
      certification_number: mockCertificate.certification_number,
      demo_mode: true,
    };
  };

  if (loading) {
    return (
      <OnboardingFactory persona="solo_contractor" step="generate_certificate">
        <div className="flex items-center justify-center py-12">
          <span className="material-symbols-outlined animate-spin text-6xl text-blue-500">
            progress_activity
          </span>
        </div>
      </OnboardingFactory>
    );
  }

  return (
    <OnboardingFactory persona="solo_contractor" step="generate_certificate">
      <div className="space-y-8">
        {/* Certificate Preview */}
        <div className="border-4 border-blue-200 rounded-3xl overflow-hidden shadow-2xl">
          {/* Certificate Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-medium opacity-90">JobProof.pro</div>
                <div className="text-3xl font-bold">Compliance Certificate</div>
              </div>
              <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center">
                <span className="material-symbols-outlined text-blue-600 text-5xl">
                  workspace_premium
                </span>
              </div>
            </div>
            <div className="text-sm opacity-90">
              Certification No: {mockCertificate.certification_number}
            </div>
          </div>

          {/* Certificate Body */}
          <div className="bg-white p-8 space-y-6">
            {/* Job Details */}
            <div>
              <div className="text-sm font-semibold text-gray-500 mb-2">JOB DETAILS</div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Job:</span>
                  <span className="font-semibold text-gray-900">{mockCertificate.job_title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Client:</span>
                  <span className="font-semibold text-gray-900">{mockCertificate.client_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Location:</span>
                  <span className="font-semibold text-gray-900">{mockCertificate.location}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Completed:</span>
                  <span className="font-semibold text-gray-900">{mockCertificate.completed_date}</span>
                </div>
              </div>
            </div>

            <div className="border-t-2 border-gray-100"></div>

            {/* Compliance Checks */}
            <div>
              <div className="text-sm font-semibold text-gray-500 mb-3">COMPLIANCE VERIFICATION</div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-green-600">check_circle</span>
                  <span className="text-gray-900">
                    {mockCertificate.safety_checks_passed} safety checks passed
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-green-600">check_circle</span>
                  <span className="text-gray-900">
                    {mockCertificate.photos_uploaded} photos uploaded as evidence
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-green-600">check_circle</span>
                  <span className="text-gray-900">
                    Blockchain sealed for tamper-proof verification
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t-2 border-gray-100"></div>

            {/* Technician */}
            <div>
              <div className="text-sm font-semibold text-gray-500 mb-2">CERTIFIED BY</div>
              <div className="font-semibold text-gray-900 text-lg">
                {mockCertificate.technician_name}
              </div>
              <div className="text-sm text-gray-600">Licensed Contractor</div>
            </div>

            {/* Blockchain Badge */}
            <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-blue-600 text-3xl">
                  verified
                </span>
                <div>
                  <div className="font-semibold text-blue-900">Blockchain Verified</div>
                  <div className="text-sm text-blue-700">
                    Immutable evidence • Tamper-proof • Instant verification
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Success Message */}
        <div className="p-6 bg-green-50 border-2 border-green-200 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <span className="material-symbols-outlined text-green-600 text-4xl">
              celebration
            </span>
            <div>
              <h3 className="font-semibold text-green-900 text-xl mb-1">
                🎉 You're Ready to Go!
              </h3>
              <p className="text-green-700">
                Your dashboard is now configured to manage jobs, track compliance, and generate certificates.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mt-4">
            <div className="p-3 bg-white rounded-xl">
              <div className="font-semibold text-gray-900 mb-1">📱 Mobile First</div>
              <div className="text-sm text-gray-600">Take photos and complete jobs on-site from your iPhone</div>
            </div>
            <div className="p-3 bg-white rounded-xl">
              <div className="font-semibold text-gray-900 mb-1">🔒 Blockchain Sealed</div>
              <div className="text-sm text-gray-600">Evidence is tamper-proof and instantly verifiable</div>
            </div>
            <div className="p-3 bg-white rounded-xl">
              <div className="font-semibold text-gray-900 mb-1">⚡ Quick Certificates</div>
              <div className="text-sm text-gray-600">Generate compliance PDFs in seconds, not hours</div>
            </div>
          </div>
        </div>

        {/* What's Next */}
        <div className="p-6 bg-blue-50 border-2 border-blue-200 rounded-2xl">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined">info</span>
            <span>What's next?</span>
          </h3>
          <ul className="space-y-2 text-sm text-blue-700">
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
              <span>Access your dashboard to create real jobs</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
              <span>Upload photos directly from your iPhone on-site</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
              <span>Generate and share certificates with clients instantly</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-blue-500 text-lg">check_circle</span>
              <span>Upgrade to Pro (£49/mo) for unlimited jobs and Stripe billing</span>
            </li>
          </ul>
        </div>

        {/* Pricing Teaser */}
        <div className="p-6 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-purple-900 text-lg mb-1">
                Ready to go Pro?
              </h3>
              <p className="text-purple-700 text-sm">
                Unlock unlimited jobs, team management, and premium support
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-purple-900">£49</div>
              <div className="text-sm text-purple-700">/month</div>
            </div>
          </div>
        </div>
      </div>
    </OnboardingFactory>
  );
}
