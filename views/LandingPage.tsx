
import React from 'react';
import { Link } from 'react-router-dom';
import { JobProofLogo } from '../components/branding/jobproof-logo';

/**
 * Landing Page - Clean, professional V1 MVP
 * Clear entry points for Manager vs Technician flows
 */
const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 selection:bg-primary/30 selection:text-white">
      {/* Navbar */}
      <nav className="fixed w-full z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/home">
            <JobProofLogo variant="full" size="sm" />
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/pricing" className="text-slate-400 hover:text-white text-sm font-bold uppercase tracking-widest transition-colors">
              Pricing
            </Link>
            <Link to="/auth" className="text-white bg-primary hover:bg-primary-hover px-5 py-2 rounded-xl text-sm font-bold uppercase tracking-widest transition-all">
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight text-white">
            Evidence-First<br />
            <span className="text-primary">Job Documentation</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Capture timestamped, geo-verified evidence of completed work.
            Eliminate payment disputes. Magic link access — no app install required.
          </p>

          {/* Entry Points - Clear Manager vs Technician */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            <Link
              to="/auth"
              className="w-full sm:w-auto px-8 py-4 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-3 uppercase tracking-widest"
            >
              <span className="material-symbols-outlined">admin_panel_settings</span>
              Manager Sign In
            </Link>
            <Link
              to="/track-lookup"
              className="w-full sm:w-auto px-8 py-4 bg-slate-800 hover:bg-slate-700 border border-white/10 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-3 uppercase tracking-widest"
            >
              <span className="material-symbols-outlined">engineering</span>
              Technician Access
            </Link>
          </div>

          <p className="text-xs text-slate-500 pt-2">
            Technicians: Use the link sent by your manager to access jobs
          </p>
        </div>
      </section>

      {/* Features - Clean grid without heavy boxes */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <Feature
            icon="verified"
            title="Immutable Proof"
            desc="SHA-256 sealed evidence with timestamps and geolocation."
          />
          <Feature
            icon="wifi_off"
            title="Works Offline"
            desc="Capture evidence anywhere. Auto-sync when connected."
          />
          <Feature
            icon="signature"
            title="Client Signatures"
            desc="Digital sign-off captured on completion."
          />
        </div>
      </section>

      {/* Pricing - Aligned with PricingView.tsx */}
      <section id="pricing" className="py-16 px-6">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-black text-white tracking-tight">Simple Pricing</h2>
            <p className="text-slate-400">14-day free trial on all plans</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <PriceCard tier="Solo" price="Free" desc="5 jobs/month" features={['1 User', 'Email Support', 'Basic Reports']} />
            <PriceCard tier="Team" price="£49" desc="Unlimited jobs" features={['5 Users', 'Priority Support', 'Custom Branding']} active />
            <PriceCard tier="Agency" price="£199" desc="Unlimited everything" features={['Unlimited Users', 'API Access', 'Dedicated Support']} />
          </div>
        </div>
      </section>

      {/* Simple CTA */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-2xl font-black text-white">Ready to get started?</h2>
          <p className="text-slate-400">Create your workspace and dispatch your first job in minutes.</p>
          <Link
            to="/auth"
            className="inline-block px-8 py-4 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-sm uppercase tracking-widest transition-all"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <JobProofLogo variant="mark" size="xs" />
          <span className="font-bold text-white">JobProof</span>
        </div>
        <p className="text-slate-500 text-xs">&copy; 2026 JobProof. All rights reserved.</p>
      </footer>
    </div>
  );
};

const Feature = ({ icon, title, desc }: { icon: string; title: string; desc: string }) => (
  <div className="text-center space-y-3">
    <div className="inline-flex items-center justify-center size-12 rounded-xl bg-primary/10 text-primary">
      <span className="material-symbols-outlined text-2xl">{icon}</span>
    </div>
    <h3 className="text-lg font-bold text-white">{title}</h3>
    <p className="text-slate-400 text-sm">{desc}</p>
  </div>
);

const PriceCard = ({ tier, price, desc, features, active }: { tier: string; price: string; desc: string; features: string[]; active?: boolean }) => (
  <div className={`p-6 rounded-2xl border transition-all ${active ? 'bg-primary border-primary' : 'bg-slate-900 border-white/10'}`}>
    <h3 className={`text-sm font-bold uppercase tracking-widest mb-1 ${active ? 'text-blue-200' : 'text-slate-400'}`}>{tier}</h3>
    <div className="flex items-baseline gap-1 mb-1">
      <span className="text-3xl font-black text-white">{price}</span>
      {price !== 'Free' && <span className={`text-sm ${active ? 'text-blue-200' : 'text-slate-400'}`}>/mo</span>}
    </div>
    <p className={`text-sm mb-4 ${active ? 'text-blue-100' : 'text-slate-400'}`}>{desc}</p>
    <ul className="space-y-2 mb-6">
      {features.map((f) => (
        <li key={f} className={`flex items-center gap-2 text-sm ${active ? 'text-white' : 'text-slate-300'}`}>
          <span className={`material-symbols-outlined text-sm ${active ? 'text-white' : 'text-emerald-500'}`}>check</span>
          {f}
        </li>
      ))}
    </ul>
    <Link
      to="/auth"
      className={`block w-full py-3 rounded-xl font-bold text-sm text-center uppercase tracking-widest transition-all ${
        active ? 'bg-white text-primary hover:bg-blue-50' : 'bg-slate-800 text-white hover:bg-slate-700'
      }`}
    >
      {price === 'Free' ? 'Start Free' : 'Start Trial'}
    </Link>
  </div>
);

export default LandingPage;
