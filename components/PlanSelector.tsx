import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/theme';

type Tier = 'solo' | 'team' | 'agency';
type BillingPeriod = 'monthly' | 'annual';

interface PlanConfig {
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  features: string[];
  limits: {
    jobs: number | 'Unlimited';
    users: number | 'Unlimited';
  };
  popular?: boolean;
}

const PLANS: Record<Tier, PlanConfig> = {
  solo: {
    name: 'Solo',
    description: 'Perfect for individual contractors',
    monthlyPrice: 0,
    annualPrice: 0,
    features: [
      '5 Jobs / Month',
      'Email Support',
      'Mobile Evidence Capture',
      'Standard Reports',
    ],
    limits: { jobs: 5, users: 1 },
  },
  team: {
    name: 'Team',
    description: 'Built for growing field service teams',
    monthlyPrice: 49,
    annualPrice: 39,
    features: [
      'Unlimited Jobs',
      'Up to 5 Team Members',
      'Priority Support',
      'Custom Branding',
      'Audit Trail',
    ],
    limits: { jobs: 'Unlimited', users: 5 },
    popular: true,
  },
  agency: {
    name: 'Agency',
    description: 'Enterprise-grade for large operations',
    monthlyPrice: 199,
    annualPrice: 159,
    features: [
      'Unlimited Jobs',
      'Unlimited Users',
      'Dedicated Account Manager',
      'White-label Reports',
      'API Access',
      'Legal SLA',
    ],
    limits: { jobs: 'Unlimited', users: 'Unlimited' },
  },
};

interface PlanSelectorProps {
  onSelect?: (tier: Tier, billingPeriod: BillingPeriod) => void;
  showTrialBadge?: boolean;
  preselectedTier?: Tier;
  className?: string;
}

export const PlanSelector: React.FC<PlanSelectorProps> = ({
  onSelect,
  showTrialBadge = true,
  preselectedTier,
  className = '',
}) => {
  const navigate = useNavigate();
  const { session, isAuthenticated } = useAuth();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [selectedTier, setSelectedTier] = useState<Tier | null>(preselectedTier || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getPriceId = (tier: Tier): string | undefined => {
    if (tier === 'solo') return undefined;

    if (tier === 'team') {
      return billingPeriod === 'annual'
        ? import.meta.env.VITE_STRIPE_PRICE_TEAM_ANNUAL
        : import.meta.env.VITE_STRIPE_PRICE_TEAM_MONTHLY;
    }

    if (tier === 'agency') {
      return billingPeriod === 'annual'
        ? import.meta.env.VITE_STRIPE_PRICE_AGENCY_ANNUAL
        : import.meta.env.VITE_STRIPE_PRICE_AGENCY_MONTHLY;
    }

    return undefined;
  };

  const handleSelectPlan = async (tier: Tier) => {
    setSelectedTier(tier);
    setError(null);

    if (onSelect) {
      onSelect(tier, billingPeriod);
      return;
    }

    // Solo tier - redirect to dashboard
    if (tier === 'solo') {
      navigate(isAuthenticated ? '/admin' : '/auth');
      return;
    }

    // Check authentication
    if (!session) {
      sessionStorage.setItem('pricing_redirect', JSON.stringify({ tier, billingPeriod }));
      navigate('/auth');
      return;
    }

    // Get price ID
    const priceId = getPriceId(tier);
    if (!priceId) {
      setError('Stripe pricing not configured');
      return;
    }

    setLoading(true);

    try {
      const supabase = getSupabase();
      if (!supabase) {
        throw new Error('Service unavailable');
      }

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
            tier,
          }),
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err) {
      console.error('Plan selection error:', err);
      // Detect CORS/network errors vs API errors
      const errorMessage = err instanceof Error ? err.message : 'Failed to start checkout';
      const isCorsOrNetwork = errorMessage.includes('Failed to fetch') ||
                              errorMessage.includes('NetworkError') ||
                              errorMessage.includes('CORS');

      setError(isCorsOrNetwork
        ? 'Payment service unavailable. Please try again later or contact support.'
        : errorMessage
      );
      setLoading(false);
    }
  };

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Billing Toggle */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => setBillingPeriod('monthly')}
          className={`
            px-6 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all
            ${billingPeriod === 'monthly'
              ? 'bg-primary text-white'
              : isDark
                ? 'bg-white/5 text-slate-400 hover:bg-white/10'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }
          `}
        >
          Monthly
        </button>
        <button
          onClick={() => setBillingPeriod('annual')}
          className={`
            px-6 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all relative
            ${billingPeriod === 'annual'
              ? 'bg-primary text-white'
              : isDark
                ? 'bg-white/5 text-slate-400 hover:bg-white/10'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }
          `}
        >
          Annual
          <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black">
            -20%
          </span>
        </button>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(Object.entries(PLANS) as [Tier, PlanConfig][]).map(([tier, plan]) => {
          const price = billingPeriod === 'annual' ? plan.annualPrice : plan.monthlyPrice;
          const isSelected = selectedTier === tier;
          const isPopular = plan.popular;

          return (
            <div
              key={tier}
              role="button"
              tabIndex={0}
              aria-label={`Select ${plan.name} plan`}
              className={`
                relative p-6 rounded-2xl border transition-all cursor-pointer
                ${isPopular
                  ? 'bg-primary border-primary md:scale-105 z-10'
                  : isDark
                    ? 'bg-slate-900 border-white/10 hover:border-white/20'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }
                ${isSelected && !isPopular ? 'ring-2 ring-primary' : ''}
                focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
              `}
              onClick={() => !loading && handleSelectPlan(tier)}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !loading) {
                  e.preventDefault();
                  handleSelectPlan(tier);
                }
              }}
            >
              {/* Popular Badge */}
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-3 py-1 rounded-full shadow">
                  <span className="text-primary text-[10px] font-black uppercase tracking-wide">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Trial Badge */}
              {showTrialBadge && tier !== 'solo' && (
                <div className={`
                  absolute -top-3 right-4 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase
                  ${isPopular ? 'bg-white/20 text-white' : 'bg-emerald-500/20 text-emerald-600'}
                `}>
                  14-Day Free Trial
                </div>
              )}

              <div className="space-y-4">
                {/* Plan Name & Description */}
                <div>
                  <h3 className={`
                    text-lg font-black uppercase tracking-tight
                    ${isPopular ? 'text-white/80' : isDark ? 'text-slate-400' : 'text-slate-500'}
                  `}>
                    {plan.name}
                  </h3>
                  <p className={`
                    text-sm mt-1
                    ${isPopular ? 'text-blue-100' : isDark ? 'text-slate-400' : 'text-slate-600'}
                  `}>
                    {plan.description}
                  </p>
                </div>

                {/* Price */}
                <div className="flex items-baseline gap-1">
                  <span className={`
                    text-4xl font-black
                    ${isPopular ? 'text-white' : isDark ? 'text-white' : 'text-slate-900'}
                  `}>
                    {price === 0 ? 'Free' : `£${price}`}
                  </span>
                  {price > 0 && (
                    <span className={`
                      text-sm font-medium
                      ${isPopular ? 'text-blue-200' : isDark ? 'text-slate-500' : 'text-slate-500'}
                    `}>
                      /mo
                    </span>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className={`
                        flex items-center gap-2 text-sm
                        ${isPopular ? 'text-white' : isDark ? 'text-slate-300' : 'text-slate-700'}
                      `}
                    >
                      <span className={`
                        material-symbols-outlined text-base
                        ${isPopular ? 'text-white' : 'text-emerald-500'}
                      `}>
                        check_circle
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <button
                  disabled={loading && isSelected}
                  className={`
                    w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${isPopular
                      ? 'bg-white text-primary hover:bg-blue-50'
                      : isDark
                        ? 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }
                  `}
                >
                  {loading && isSelected ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Processing...
                    </span>
                  ) : tier === 'solo' ? (
                    'Continue Free'
                  ) : (
                    'Start Free Trial'
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Error Message */}
      {error && (
        <div className={`
          p-4 rounded-xl text-center
          ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}
        `}>
          <p className="text-red-500 text-sm font-medium flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-lg">error</span>
            {error}
          </p>
        </div>
      )}

      {/* Trust Indicators */}
      <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-bold uppercase tracking-wider opacity-60">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-500 text-sm">verified</span>
          No Credit Card Required
        </div>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-500 text-sm">lock</span>
          Secure via Stripe
        </div>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-500 text-sm">cancel</span>
          Cancel Anytime
        </div>
      </div>
    </div>
  );
};

export default PlanSelector;
