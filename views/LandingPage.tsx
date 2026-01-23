import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { JobProofLogo } from '../components/branding/jobproof-logo';

/**
 * Landing Page - Commanding hero with clear CTAs
 * PWA install prompt for mobile users
 *
 * DARK MODE ONLY - Clean, professional aesthetic
 */
const LandingPage: React.FC = () => {
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // PWA Install prompt detection
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show prompt for mobile users
      if (window.innerWidth < 768) {
        setShowInstallPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const dismissInstallPrompt = () => {
    setShowInstallPrompt(false);
    sessionStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  return (
    <div className="min-h-screen bg-slate-950 selection:bg-primary/30 selection:text-white">
      {/* PWA Install Banner for Mobile */}
      {showInstallPrompt && !sessionStorage.getItem('pwa_prompt_dismissed') && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-primary p-4 shadow-2xl animate-in slide-in-from-bottom safe-area-bottom">
          <div className="max-w-md mx-auto flex items-center gap-3">
            <div className="bg-white/20 size-10 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-white text-xl">add_to_home_screen</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm truncate">Add to Home Screen</p>
              <p className="text-white/80 text-xs truncate">Quick access from your phone</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={dismissInstallPrompt}
                className="text-white/60 hover:text-white text-xs font-bold px-2 py-1"
              >
                Later
              </button>
              <button
                onClick={handleInstall}
                className="bg-white text-primary font-bold text-xs px-3 py-2 rounded-lg active:scale-95 transition-transform"
              >
                Install
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navbar - Improved mobile */}
      <nav className="fixed w-full z-50 bg-slate-950/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <Link to="/home">
            <JobProofLogo variant="full" size="sm" />
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link to="/pricing" className="hidden sm:block text-slate-400 hover:text-white text-sm font-bold uppercase tracking-widest transition-colors">
              Pricing
            </Link>
            <Link to="/auth" className="text-white bg-primary hover:bg-primary-hover px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-widest transition-all active:scale-95 press-spring">
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero - Commanding Headline - Improved mobile */}
      <section className="pt-20 sm:pt-28 pb-12 sm:pb-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center space-y-6 sm:space-y-8">
          {/* Main Headline - Responsive sizing */}
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight leading-[0.9] text-white uppercase">
            Get Proof.<br />
            <span className="text-primary">Get Paid.</span>
          </h1>

          {/* Subheadline - Better mobile readability */}
          <p className="text-base sm:text-xl md:text-2xl text-slate-300 max-w-2xl mx-auto leading-relaxed font-medium px-2">
            Capture timestamped, geo-verified evidence of completed work.
            <span className="text-white font-bold"> Eliminate payment disputes forever.</span>
          </p>

          {/* Entry Points - Stack on mobile */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-4 sm:pt-8">
            <Link
              to="/auth"
              className="w-full sm:w-auto px-8 sm:px-10 py-4 sm:py-5 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black text-sm sm:text-base shadow-xl shadow-primary/30 transition-all flex items-center justify-center gap-2 sm:gap-3 uppercase tracking-widest active:scale-95 press-spring"
            >
              <span className="material-symbols-outlined text-lg sm:text-xl">rocket_launch</span>
              Start Free Trial
            </Link>
            <Link
              to="/track-lookup"
              className="w-full sm:w-auto px-8 sm:px-10 py-4 sm:py-5 bg-slate-800 hover:bg-slate-700 border border-white/10 text-white rounded-2xl font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-2 sm:gap-3 uppercase tracking-widest active:scale-95 press-spring"
            >
              <span className="material-symbols-outlined text-lg sm:text-xl">engineering</span>
              Technician Portal
            </Link>
          </div>

          <p className="text-xs sm:text-sm text-slate-500">
            No credit card required • 14-day free trial • Cancel anytime
          </p>
        </div>
      </section>

      {/* Features - Improved mobile grid */}
      <section className="py-12 sm:py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
          <Feature
            icon="verified"
            title="Immutable Proof"
            desc="SHA-256 sealed evidence with timestamps and GPS location. Legally defensible."
          />
          <Feature
            icon="wifi_off"
            title="Works Offline"
            desc="Capture evidence anywhere. Auto-sync when connected. Never lose data."
          />
          <Feature
            icon="draw"
            title="Client Signatures"
            desc="Digital sign-off captured on mobile. No paper, no disputes."
          />
        </div>
      </section>

      {/* How It Works - Improved mobile layout */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 bg-slate-900/50">
        <div className="max-w-4xl mx-auto space-y-8 sm:space-y-12">
          <h2 className="text-2xl sm:text-3xl font-black text-white text-center uppercase tracking-tight">How It Works</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            <Step num="1" title="Create Job" desc="Assign technician and send magic link" />
            <Step num="2" title="Capture Evidence" desc="Photos, location, and notes on mobile" />
            <Step num="3" title="Client Signs" desc="Digital signature confirms satisfaction" />
            <Step num="4" title="Get Paid" desc="Sealed proof eliminates disputes" />
          </div>
        </div>
      </section>

      {/* Pricing - Improved mobile cards */}
      <section id="pricing" className="py-12 sm:py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto space-y-8 sm:space-y-12">
          <div className="text-center space-y-3 sm:space-y-4">
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight uppercase">Simple Pricing</h2>
            <p className="text-slate-400 text-base sm:text-lg">Start free, upgrade when you're ready</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <PriceCard tier="Solo" price="Free" desc="5 jobs/month" features={['1 User', 'Email Support', 'Basic Reports']} />
            <PriceCard tier="Team" price="£49" desc="Unlimited jobs" features={['5 Users', 'Priority Support', 'Custom Branding']} active />
            <PriceCard tier="Agency" price="£199" desc="Unlimited everything" features={['Unlimited Users', 'API Access', 'Dedicated Support']} />
          </div>
        </div>
      </section>

      {/* CTA - Improved mobile */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 bg-primary">
        <div className="max-w-3xl mx-auto text-center space-y-6 sm:space-y-8">
          <h2 className="text-2xl sm:text-4xl font-black text-white uppercase tracking-tight leading-tight">
            Stop Losing Money to Disputes
          </h2>
          <p className="text-base sm:text-xl text-white/80 px-2">
            Join thousands of contractors who get paid faster with sealed evidence.
          </p>
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 sm:gap-3 px-8 sm:px-12 py-4 sm:py-5 bg-white text-primary rounded-2xl font-black text-sm sm:text-lg uppercase tracking-widest shadow-2xl transition-all hover:scale-105 active:scale-95"
          >
            <span className="material-symbols-outlined text-xl sm:text-2xl">verified</span>
            Start Your Free Trial
          </Link>
        </div>
      </section>

      {/* Footer - Improved mobile */}
      <footer className="py-8 sm:py-12 px-4 sm:px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
          <JobProofLogo variant="full" size="sm" />
          <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm text-slate-500">
            <Link to="/pricing" className="hover:text-white transition-colors">Pricing</Link>
            <Link to="/help" className="hover:text-white transition-colors">Help</Link>
            <span>© {new Date().getFullYear()} JobProof</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Feature Card - Mobile optimized
const Feature = ({ icon, title, desc }: { icon: string; title: string; desc: string }) => (
  <div className="text-center space-y-3 sm:space-y-4 p-4 sm:p-6">
    <div className="inline-flex items-center justify-center size-12 sm:size-16 rounded-xl sm:rounded-2xl bg-primary/10">
      <span className="material-symbols-outlined text-primary text-2xl sm:text-3xl">{icon}</span>
    </div>
    <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight">{title}</h3>
    <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">{desc}</p>
  </div>
);

// Step Card - Mobile optimized
const Step = ({ num, title, desc }: { num: string; title: string; desc: string }) => (
  <div className="text-center space-y-2 sm:space-y-3">
    <div className="inline-flex items-center justify-center size-10 sm:size-12 rounded-full bg-primary text-white font-black text-sm sm:text-lg">
      {num}
    </div>
    <h3 className="text-xs sm:text-base font-black text-white uppercase">{title}</h3>
    <p className="text-slate-400 text-[10px] sm:text-xs leading-relaxed">{desc}</p>
  </div>
);

// Price Card - Mobile optimized
const PriceCard = ({ tier, price, desc, features, active }: { tier: string; price: string; desc: string; features: string[]; active?: boolean }) => (
  <div className={`p-6 sm:p-8 rounded-2xl border transition-all ${active ? 'bg-primary border-primary md:scale-105 shadow-2xl shadow-primary/30 relative' : 'bg-slate-900 border-white/10'}`}>
    {active && (
      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white text-primary text-[10px] sm:text-xs font-black px-3 py-1 rounded-full uppercase">
        Popular
      </span>
    )}
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h3 className={`text-xs sm:text-sm font-black uppercase tracking-widest ${active ? 'text-white/80' : 'text-slate-500'}`}>{tier}</h3>
        <p className={`text-3xl sm:text-4xl font-black ${active ? 'text-white' : 'text-white'}`}>{price}<span className="text-base sm:text-lg font-normal">/mo</span></p>
        <p className={`text-xs sm:text-sm ${active ? 'text-white/80' : 'text-slate-500'}`}>{desc}</p>
      </div>
      <ul className="space-y-2">
        {features.map((f, i) => (
          <li key={i} className={`text-xs sm:text-sm flex items-center gap-2 ${active ? 'text-white' : 'text-slate-400'}`}>
            <span className={`material-symbols-outlined text-xs sm:text-sm ${active ? 'text-white' : 'text-primary'}`}>check</span>
            {f}
          </li>
        ))}
      </ul>
      <Link
        to={tier === 'Solo' ? '/auth' : '/pricing'}
        className={`block w-full py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm text-center uppercase tracking-widest transition-all active:scale-95 ${
          active ? 'bg-white text-primary hover:bg-white/90' : 'bg-primary text-white hover:bg-primary-hover'
        }`}
      >
        {tier === 'Solo' ? 'Start Free' : 'Get Started'}
      </Link>
    </div>
  </div>
);

export default LandingPage;
