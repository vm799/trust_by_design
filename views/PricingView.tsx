import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';

const PricingView: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 selection:bg-primary/30 px-4 py-6 md:px-6 md:py-8 lg:px-8 lg:py-12">
      <div className="max-w-7xl mx-auto space-y-16">
        <header className="text-center space-y-4">
          <Link
            to="/home"
            className="inline-flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest mb-4 hover:scale-105 transition-all"
          >
            <span className="material-symbols-outlined text-lg font-black">
              arrow_back
            </span>
            Product
          </Link>
          <h1 className="text-6xl font-black text-white tracking-tighter uppercase leading-none">
            Operational <br />
            <span className="text-primary">Scaling</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto font-medium">
            Clear infrastructure plans for professional field-service teams.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <PriceCard
            tier="Solo"
            price="0"
            desc="Perfect for individual contractors testing the platform."
            features={[
              '5 Jobs / Month',
              'Email Support',
              'Mobile Access',
              'Standard Reports'
            ]}
          />
          <PriceCard
            tier="Team"
            price="49"
            desc="Built for growing field service teams."
            features={[
              'Unlimited Jobs',
              'Custom Branding',
              'Priority Support',
              'Audit Logs',
              '5 Team Members'
            ]}
            active
          />
          <PriceCard
            tier="Agency"
            price="199"
            desc="Enterprise-grade verification for large operations."
            features={[
              'Unlimited Users',
              'White-label Reports',
              'Dedicated Support',
              'API Access',
              'Legal SLA'
            ]}
          />
        </div>
      </div>
    </div>
  );
};

const PriceCard = ({
  tier,
  price,
  desc,
  features,
  active
}: {
  tier: string;
  price: string;
  desc: string;
  features: string[];
  active?: boolean;
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    if (tier === 'Solo') {
      navigate('/auth');
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      alert('Supabase not configured');
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }

    setLoading(true);

    const priceId =
      tier === 'Team'
        ? import.meta.env.VITE_STRIPE_PRICE_TEAM_MONTHLY
        : import.meta.env.VITE_STRIPE_PRICE_AGENCY_MONTHLY;

    if (!priceId) {
      alert('Stripe not configured. Please contact support.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ priceId })
        }
      );

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create checkout session');
      }
    } catch (err) {
      setLoading(false);
      alert('Failed to start checkout. Please try again.');
    }
  };

  return (
    <div
      className={`p-12 rounded-[3.5rem] border transition-all flex flex-col relative ${
        active
          ? 'bg-primary border-primary shadow-2xl scale-105 z-10'
          : 'bg-slate-900 border-white/5'
      }`}
    >
      {active && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white px-4 py-1.5 rounded-full">
          <span className="text-primary text-xs font-black uppercase">
            Most Popular
          </span>
        </div>
      )}
      <div className="flex-1 space-y-8">
        <div>
          <h3
            className={`text-xl font-black uppercase tracking-tighter mb-2 ${
              active ? 'text-white' : 'text-slate-500'
            }`}
          >
            {tier}
          </h3>
          <div className="flex items-baseline gap-1">
            <span className="text-5xl font-black text-white">£{price}</span>
            <span
              className={`text-sm font-bold ${
                active ? 'text-blue-100' : 'text-slate-500'
              }`}
            >
              /mo
            </span>
          </div>
        </div>
        <p
          className={`text-sm leading-relaxed font-medium ${
            active ? 'text-blue-50' : 'text-slate-400'
          }`}
        >
          {desc}
        </p>
        <ul className="space-y-4">
          {features.map((f: string) => (
            <li
              key={f}
              className={`flex items-start gap-3 text-sm font-bold ${
                active ? 'text-white' : 'text-slate-300'
              }`}
            >
              <span className="material-symbols-outlined text-lg font-black">
                check_circle
              </span>
              {f}
            </li>
          ))}
        </ul>
      </div>
      <button
        onClick={handleSubscribe}
        disabled={loading}
        className={`w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest mt-12 transition-all disabled:opacity-50 ${
          active
            ? 'bg-white text-primary hover:bg-blue-50'
            : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
        }`}
      >
        {loading
          ? 'Loading...'
          : tier === 'Solo'
          ? 'Start Free'
          : `Start ${tier} Trial`}
      </button>
    </div>
  );
};

export default PricingView;
