import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

// Pricing configuration - single source of truth
const PRICING = {
  solo: {
    monthly: 0,
    annual: 0,
    jobs: 5,
    users: 1,
  },
  team: {
    monthly: 49,
    annual: 39, // ~20% discount
    jobs: 'Unlimited',
    users: 5,
  },
  agency: {
    monthly: 199,
    annual: 159, // ~20% discount
    jobs: 'Unlimited',
    users: 'Unlimited',
  },
} as const;

const PricingView: React.FC = () => {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 selection:bg-primary/30 px-4 py-6 md:px-6 md:py-8 lg:px-8 lg:py-12">
      <div className="max-w-7xl mx-auto space-y-12">
        <header className="text-center space-y-4">
          <Link
            to="/home"
            className="inline-flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest mb-4 hover:scale-105 transition-all"
          >
            <span className="material-symbols-outlined text-lg font-black">
              arrow_back
            </span>
            Back to Product
          </Link>
          <h1 className="text-5xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">
            Simple, <span className="text-primary">Transparent</span>
            <br />
            Pricing
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg max-w-2xl mx-auto font-medium">
            Choose the plan that fits your field service operation. All plans include a 14-day free trial.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 pt-6">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                billingPeriod === 'monthly'
                  ? 'bg-primary text-white'
                  : 'bg-slate-100/70 dark:bg-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/10'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('annual')}
              className={`px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all relative ${
                billingPeriod === 'annual'
                  ? 'bg-primary text-white'
                  : 'bg-slate-100/70 dark:bg-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/10'
              }`}
            >
              Annual
              <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black">
                -20%
              </span>
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          <PriceCard
            tier="Solo"
            price={PRICING.solo[billingPeriod]}
            billingPeriod={billingPeriod}
            desc="Perfect for individual contractors testing the platform."
            features={[
              `${PRICING.solo.jobs} Jobs / Month`,
              'Email Support',
              'Mobile Evidence Capture',
              'Standard Reports',
              'Basic Analytics',
            ]}
          />
          <PriceCard
            tier="Team"
            price={PRICING.team[billingPeriod]}
            billingPeriod={billingPeriod}
            desc="Built for growing field service teams."
            features={[
              `${PRICING.team.jobs} Jobs`,
              `Up to ${PRICING.team.users} Team Members`,
              'Priority Support',
              'Custom Branding',
              'Audit Trail & Logs',
              'Advanced Reports',
            ]}
            active
          />
          <PriceCard
            tier="Agency"
            price={PRICING.agency[billingPeriod]}
            billingPeriod={billingPeriod}
            desc="Enterprise-grade verification for large operations."
            features={[
              `${PRICING.agency.jobs} Jobs`,
              `${PRICING.agency.users} Users`,
              'Dedicated Account Manager',
              'White-label Reports',
              'API Access',
              'Legal SLA & Compliance',
            ]}
          />
        </div>

        {/* Trust Indicators */}
        <div className="text-center space-y-6 pt-8">
          <div className="flex flex-wrap items-center justify-center gap-8 text-slate-500 dark:text-slate-400 text-xs font-medium tracking-widest">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-500">verified</span>
              14-Day Free Trial
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-500">lock</span>
              Secure Payments via Stripe
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-500">cancel</span>
              Cancel Anytime
            </div>
          </div>
          <p className="text-slate-600 text-sm">
            Questions? <Link to="/help" className="text-primary hover:underline">Contact our sales team</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

const PriceCard = ({
  tier,
  price,
  billingPeriod,
  desc,
  features,
  active,
}: {
  tier: string;
  price: number;
  billingPeriod: 'monthly' | 'annual';
  desc: string;
  features: string[];
  active?: boolean;
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use AuthContext instead of direct API calls
  const { session, isAuthenticated } = useAuth();

  // Get the appropriate Stripe price ID based on tier and billing period
  const getPriceId = (): string | undefined => {
    const tierLower = tier.toLowerCase();
    if (tierLower === 'solo') return undefined; // Free tier, no Stripe

    if (tierLower === 'team') {
      return billingPeriod === 'annual'
        ? import.meta.env.VITE_STRIPE_PRICE_TEAM_ANNUAL
        : import.meta.env.VITE_STRIPE_PRICE_TEAM_MONTHLY;
    }

    if (tierLower === 'agency') {
      return billingPeriod === 'annual'
        ? import.meta.env.VITE_STRIPE_PRICE_AGENCY_ANNUAL
        : import.meta.env.VITE_STRIPE_PRICE_AGENCY_MONTHLY;
    }

    return undefined;
  };

  const handleSubscribe = async () => {
    setError(null);

    // Solo tier - just redirect to signup
    if (tier === 'Solo') {
      navigate(isAuthenticated ? '/admin' : '/auth');
      return;
    }

    // Check Supabase configuration
    const supabase = getSupabase();
    if (!supabase) {
      setError('Service temporarily unavailable. Please try again later.');
      return;
    }

    // Check authentication - redirect to auth if not logged in
    if (!session) {
      // Store intent to return after auth
      sessionStorage.setItem('pricing_redirect', JSON.stringify({ tier, billingPeriod }));
      navigate('/auth');
      return;
    }

    // Get the price ID for this tier/period
    const priceId = getPriceId();
    if (!priceId) {
      // Debug: Show which env vars are missing
      console.error(`Missing Stripe price ID for ${tier} ${billingPeriod}`);
      console.error('Available env vars:', {
        TEAM_MONTHLY: !!import.meta.env.VITE_STRIPE_PRICE_TEAM_MONTHLY,
        TEAM_ANNUAL: !!import.meta.env.VITE_STRIPE_PRICE_TEAM_ANNUAL,
        AGENCY_MONTHLY: !!import.meta.env.VITE_STRIPE_PRICE_AGENCY_MONTHLY,
        AGENCY_ANNUAL: !!import.meta.env.VITE_STRIPE_PRICE_AGENCY_ANNUAL,
      });
      setError('Stripe pricing not configured. Check environment variables.');
      return;
    }

    setLoading(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Service not configured');
      }


      const res = await fetch(
        `${supabaseUrl}/functions/v1/stripe-checkout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            priceId,
            billingPeriod,
            tier: tier.toLowerCase(),
          }),
        }
      );


      if (!res.ok) {
        const errorText = await res.text();
        console.error('Stripe checkout error response:', errorText);
        let errorMessage = `Server error: ${res.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          // JSON parsing failed - use default error message
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();

      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to start checkout. Please try again.'
      );
      setLoading(false);
    }
  };

  const annualSavings = tier !== 'Solo' && billingPeriod === 'annual';

  return (
    <div
      className={`p-8 lg:p-12 rounded-[2rem] lg:rounded-[3.5rem] border transition-all flex flex-col relative ${
        active
          ? 'bg-primary border-primary shadow-2xl md:scale-105 z-10'
          : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-white/15 hover:border-slate-200 dark:hover:border-white/10'
      }`}
    >
      {active && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white px-4 py-1.5 rounded-full shadow-lg">
          <span className="text-primary text-xs font-semibold tracking-wide">
            Most Popular
          </span>
        </div>
      )}

      <div className="flex-1 space-y-6 lg:space-y-8">
        <div>
          <h3
            className={`text-lg lg:text-xl font-bold tracking-tighter mb-2 ${
              active ? 'text-white' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {tier}
          </h3>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl lg:text-5xl font-black text-slate-900 dark:text-white">
              {price === 0 ? 'Free' : `£${price}`}
            </span>
            {price > 0 && (
              <span
                className={`text-sm font-bold ${
                  active ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                /{billingPeriod === 'annual' ? 'mo' : 'mo'}
              </span>
            )}
          </div>
          {annualSavings && (
            <p className={`text-xs mt-1 ${active ? 'text-blue-200' : 'text-emerald-500'}`}>
              Billed annually (save 20%)
            </p>
          )}
        </div>

        <p
          className={`text-sm leading-relaxed font-medium ${
            active ? 'text-blue-50' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {desc}
        </p>

        <ul className="space-y-3 lg:space-y-4">
          {features.map((f: string) => (
            <li
              key={f}
              className={`flex items-start gap-3 text-sm font-bold ${
                active ? 'text-white' : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              <span className={`material-symbols-outlined text-lg ${
                active ? 'text-white' : 'text-emerald-500'
              }`}>
                check_circle
              </span>
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-red-400 text-xs font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">error</span>
            {error}
          </p>
        </div>
      )}

      <button
        onClick={handleSubscribe}
        disabled={loading}
        className={`w-full py-4 lg:py-5 rounded-xl lg:rounded-2xl font-black text-xs lg:text-sm uppercase tracking-widest mt-8 lg:mt-12 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
          active
            ? 'bg-white text-primary hover:bg-blue-50'
            : 'bg-slate-100/70 dark:bg-white/10 text-slate-900 dark:text-white hover:bg-slate-100/70 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10'
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Processing...
          </span>
        ) : tier === 'Solo' ? (
          isAuthenticated ? 'Go to Dashboard' : 'Start Free'
        ) : (
          `Start ${tier} Trial`
        )}
      </button>
    </div>
  );
};

export default PricingView;
