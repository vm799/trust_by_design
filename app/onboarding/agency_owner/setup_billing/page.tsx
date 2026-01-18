'use client';

import { useState } from 'react';
import OnboardingFactory from '@/components/OnboardingFactory';

export default function SetupBillingPage() {
  const [billingConfigured, setBillingConfigured] = useState(false);

  const handleComplete = async () => {
    return {
      billing_setup: true,
      stripe_connected: true, // Demo mode
    };
  };

  return (
    <OnboardingFactory persona="agency_owner" step="setup_billing">
      <div className="space-y-8">
        <div className="p-8 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-3xl text-center">
          <span className="material-symbols-outlined text-6xl text-purple-600 mb-4 block">
            credit_card
          </span>
          <h3 className="text-2xl font-bold text-purple-900 mb-2">Stripe Integration</h3>
          <p className="text-purple-700 mb-6">
            Connect Stripe to accept payments and manage team billing
          </p>
          <button
            onClick={() => setBillingConfigured(true)}
            className="px-8 py-4 bg-purple-600 text-white rounded-2xl font-semibold hover:bg-purple-700 transition-all"
          >
            Connect Stripe Account
          </button>
        </div>

        {billingConfigured && (
          <div className="p-6 bg-green-50 border-2 border-green-200 rounded-2xl">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-green-600 text-4xl">verified</span>
              <div>
                <h3 className="font-semibold text-green-900 mb-1">✅ Billing Configured</h3>
                <p className="text-sm text-green-700">Your Stripe account is connected and ready</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </OnboardingFactory>
  );
}
