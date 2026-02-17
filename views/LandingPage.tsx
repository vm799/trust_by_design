import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { JobProofLogo } from '../components/branding/jobproof-logo';
// DayNightCarousel removed - features now shown in static sections below
import { useTheme } from '../lib/theme';
import {
  bgOrb1Animate,
  bgOrb1Transition,
  bgOrb2Animate,
  bgOrb2Transition,
  bgOrbCenterAnimate,
  bgOrbCenterTransition,
  hoverLiftQuick,
  stepNumberHover,
} from '../lib/animations';

/**
 * Landing Page - Modern gradient design with glassmorphism
 *
 * Respects user's theme preference (light/dark/system)
 */
const LandingPage: React.FC = () => {
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const { resolvedTheme } = useTheme();

  // Responsive to actual resolved theme
  const isDark = resolvedTheme === 'dark';

  // PWA Install prompt detection
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
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
    <div
      className="min-h-screen selection:bg-primary/30 selection:text-white transition-colors duration-500 bg-gradient-to-br from-slate-50 via-blue-50/50 to-slate-50 dark:from-slate-950 dark:via-indigo-950/50 dark:to-slate-950"
    >
      {/* Animated background orbs - REMEDIATION ITEM 11: Using memoized animation objects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl bg-amber-300/30 dark:bg-primary/20"
          animate={bgOrb1Animate}
          transition={bgOrb1Transition}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl bg-blue-300/20 dark:bg-indigo-500/20"
          animate={bgOrb2Animate}
          transition={bgOrb2Transition}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl bg-rose-200/20 dark:bg-violet-500/10"
          animate={bgOrbCenterAnimate}
          transition={bgOrbCenterTransition}
        />
      </div>

      {/* PWA Install Banner for Mobile */}
      {showInstallPrompt && !sessionStorage.getItem('pwa_prompt_dismissed') && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-0 left-0 right-0 z-50 bg-primary p-4 shadow-2xl safe-area-bottom"
        >
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
        </motion.div>
      )}

      {/* Navbar - Glassmorphism */}
      <nav
        className="fixed w-full z-50 backdrop-blur-xl border-b transition-colors duration-500 bg-white/70 border-slate-200/50 dark:bg-slate-950/70 dark:border-white/15"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <Link to="/home">
            <JobProofLogo variant="full" size="sm" />
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Phase 4.5: Removed theme toggle from landing - always dark */}
            <Link
              to="/pricing"
              className="hidden sm:block text-sm font-medium tracking-widest transition-colors text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              Pricing
            </Link>
            <Link
              to="/auth"
              className="text-white bg-primary hover:bg-primary-hover px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-medium tracking-widest transition-all active:scale-95 press-spring shadow-lg shadow-primary/30"
            >
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero - High-Urgency Hormozi Hook */}
      <section className="relative pt-24 sm:pt-32 pb-12 sm:pb-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center space-y-6 sm:space-y-8">
          {/* Urgency Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <span className="inline-block px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-full text-red-400 text-xs font-medium tracking-widest">
              Stop Losing £2,400/Year to Disputes
            </span>
          </motion.div>

          {/* Main Headline with gradient text */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight leading-[0.9] uppercase text-slate-900 dark:text-white"
          >
            End &quot;He Said,<br />She Said&quot;
            <span className="bg-gradient-to-r from-primary via-indigo-500 to-primary bg-clip-text text-transparent animate-gradient-shift bg-[length:200%_auto]">
              {' '}Forever.
            </span>
          </motion.h1>

          {/* Subheadline - Pain + Solution */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-base sm:text-xl md:text-2xl max-w-2xl mx-auto leading-relaxed font-medium px-2 text-slate-600 dark:text-slate-300"
          >
            The{' '}
            <span className="font-bold text-slate-900 dark:text-white">
              unbreakable digital shield
            </span>
            {' '}that proves your work, protects your reputation, and gets you paid faster.
          </motion.p>

          {/* Entry Points - Glassmorphism buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-4 sm:pt-8"
          >
            <Link
              to="/auth"
              className="w-full sm:w-auto px-8 sm:px-10 py-4 sm:py-5 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black text-sm sm:text-base shadow-xl shadow-primary/30 transition-all flex items-center justify-center gap-2 sm:gap-3 uppercase tracking-widest active:scale-95 press-spring"
            >
              <span className="material-symbols-outlined text-lg sm:text-xl">shield</span>
              Protect My Next Job
            </Link>
            <Link
              to="/track-lookup"
              className="w-full sm:w-auto px-8 sm:px-10 py-4 sm:py-5 rounded-2xl font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-2 sm:gap-3 uppercase tracking-widest active:scale-95 press-spring backdrop-blur-sm bg-slate-900/10 hover:bg-slate-900/20 border border-slate-200 text-slate-900 dark:bg-white/10 dark:hover:bg-white/20 dark:border-white/10 dark:text-white"
            >
              <span className="material-symbols-outlined text-lg sm:text-xl">engineering</span>
              Technician Portal
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-xs sm:text-sm text-slate-400 dark:text-slate-400"
          >
            No credit card required • 14-day free trial • Cancel anytime
          </motion.p>
        </div>
      </section>

      {/* Problem Section - Agitate the Pain */}
      <section
        className="relative py-12 sm:py-16 px-4 sm:px-6 bg-red-50/50 dark:bg-red-950/20"
      >
        <div className="max-w-4xl mx-auto space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center space-y-4"
          >
            <span className="inline-block px-4 py-1 bg-red-500/20 rounded-full text-red-400 text-xs font-medium tracking-widest">
              The Contractor Tax
            </span>
            <h2
              className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white"
            >
              Every Unpaid Dispute<br />
              <span className="text-red-500">Costs You £800</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0 }}
              className="p-6 rounded-xl border text-center space-y-3 bg-white/50 border-red-200 dark:bg-slate-900 dark:border-red-500/20"
            >
              <span className="material-symbols-outlined text-4xl text-red-500">chat_error</span>
              <h3 className="font-black text-lg uppercase text-slate-900 dark:text-white">
                &quot;I Never Approved That&quot;
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Client claims they didn&apos;t agree to the extra work. You have no proof. You eat the cost.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="p-6 rounded-xl border text-center space-y-3 bg-white/50 border-red-200 dark:bg-slate-900 dark:border-red-500/20"
            >
              <span className="material-symbols-outlined text-4xl text-red-500">schedule</span>
              <h3 className="font-black text-lg uppercase text-slate-900 dark:text-white">
                &quot;You Were Only Here 2 Hours&quot;
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                You spent 5 hours on site. Client disputes your invoice. Your word against theirs.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="p-6 rounded-xl border text-center space-y-3 bg-white/50 border-red-200 dark:bg-slate-900 dark:border-red-500/20"
            >
              <span className="material-symbols-outlined text-4xl text-red-500">image_not_supported</span>
              <h3 className="font-black text-lg uppercase text-slate-900 dark:text-white">
                &quot;That Damage Was Already There&quot;
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Pre-existing damage blamed on your team. Without before photos, you&apos;re liable.
              </p>
            </motion.div>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-lg font-bold text-slate-700 dark:text-slate-300"
          >
            3 disputes per year = <span className="text-red-500">£2,400 stolen from your pocket.</span>
          </motion.p>
        </div>
      </section>

      {/* Solution Section - The Unbreakable Digital Shield */}
      <section className="relative py-12 sm:py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto space-y-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center space-y-4"
          >
            <span className="inline-block px-4 py-1 bg-emerald-500/20 rounded-full text-emerald-400 text-xs font-medium tracking-widest">
              Your Unbreakable Shield
            </span>
            <h2
              className={`
                text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight
                ${isDark ? 'text-white' : 'text-slate-900'}
              `}
            >
              Three Layers of<br />
              <span className="bg-gradient-to-r from-primary via-indigo-500 to-primary bg-clip-text text-transparent">
                Bulletproof Protection
              </span>
            </h2>
            <p className={`text-base max-w-2xl mx-auto ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Every photo, every signature, every timestamp - locked down tighter than a bank vault.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            <FeatureCard
              icon="lock"
              title="Zero-Tamper Sealing"
              desc="RSA-2048 cryptographic signatures. If anyone changes a single pixel, we detect it. Evidence that holds up."
              isDark={isDark}
              delay={0}
            />
            <FeatureCard
              icon="wifi_off"
              title="Offline-First Capture"
              desc="No signal? No problem. Capture evidence in basements, rural sites, anywhere. Syncs automatically later."
              isDark={isDark}
              delay={0.1}
            />
            <FeatureCard
              icon="link"
              title="Magic Link Access"
              desc="Send technicians a secure link. No app downloads, no passwords. They click, capture, done."
              isDark={isDark}
              delay={0.2}
            />
          </div>
        </div>
      </section>

      {/* How It Works - Glassmorphism section */}
      <section
        className={`
          relative py-12 sm:py-16 px-4 sm:px-6
          ${isDark ? 'bg-slate-900/30' : 'bg-white/30'}
          backdrop-blur-sm
        `}
      >
        <div className="max-w-4xl mx-auto space-y-8 sm:space-y-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center space-y-3"
          >
            <h2
              className={`
                text-2xl sm:text-3xl font-bold tracking-tight
                ${isDark ? 'text-white' : 'text-slate-900'}
              `}
            >
              How It Works
            </h2>
            <p className={`text-sm sm:text-base ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              From job start to payment in 4 bulletproof steps
            </p>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            <StepCard num="1" title="Create Job" desc="Send a magic link - tech clicks and starts" isDark={isDark} delay={0} />
            <StepCard num="2" title="Capture Proof" desc="GPS-stamped photos, notes, timeline" isDark={isDark} delay={0.1} />
            <StepCard num="3" title="Client Signs" desc="On-site digital signature locks it in" isDark={isDark} delay={0.2} />
            <StepCard num="4" title="Get Paid Fast" desc="Sealed evidence = no disputes = faster payment" isDark={isDark} delay={0.3} />
          </div>
        </div>
      </section>

      {/* FAQ Section - Why Trust JobProof */}
      <FAQSection isDark={isDark} />

      {/* ROA Value Proposition */}
      <section
        className={`
          relative py-10 sm:py-14 px-4 sm:px-6
          ${isDark ? 'bg-emerald-950/30' : 'bg-emerald-50/50'}
        `}
      >
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className={`
              p-6 sm:p-8 rounded-2xl border text-center space-y-4
              ${isDark
                ? 'bg-slate-900 border-emerald-500/30'
                : 'bg-white/80 border-emerald-200'
              }
            `}
          >
            <span className="inline-block px-4 py-1 bg-emerald-500/20 rounded-full text-emerald-400 text-xs font-medium tracking-widest">
              Return on Admin (ROA)
            </span>
            <h2
              className={`
                text-2xl sm:text-3xl font-bold tracking-tight
                ${isDark ? 'text-white' : 'text-slate-900'}
              `}
            >
              One Saved Dispute =<br />
              <span className="text-emerald-500">3 Years Paid For</span>
            </h2>
            <p className={`text-base max-w-xl mx-auto ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Average dispute costs contractors <strong>£800</strong>. JobProof Team costs <strong>£49/month</strong> (£588/year).
              Save <em>one</em> dispute and you&apos;ve covered <strong>36 months</strong> of protection.
            </p>
            <div className="flex justify-center gap-8 pt-2">
              <div className="text-center">
                <div className={`text-3xl sm:text-4xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>£800</div>
                <div className={`text-xs uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>Avg. Dispute Cost</div>
              </div>
              <div className={`text-3xl font-light ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>÷</div>
              <div className="text-center">
                <div className={`text-3xl sm:text-4xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>£49</div>
                <div className={`text-xs uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>Monthly Cost</div>
              </div>
              <div className={`text-3xl font-light ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>=</div>
              <div className="text-center">
                <div className="text-3xl sm:text-4xl font-black text-emerald-500">16×</div>
                <div className={`text-xs uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>ROI</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pricing - Glassmorphism cards */}
      <section id="pricing" className="relative py-12 sm:py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto space-y-8 sm:space-y-12">
          <div className="text-center space-y-3 sm:space-y-4">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className={`
                text-3xl sm:text-4xl font-black tracking-tight uppercase
                ${isDark ? 'text-white' : 'text-slate-900'}
              `}
            >
              Simple Pricing
            </motion.h2>
            <p className={`text-base sm:text-lg ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Protection that pays for itself. One dispute saved = years of coverage.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <PriceCard
              tier="Solo"
              price="Free"
              desc="5 jobs/month"
              features={['1 User', 'Email Support', 'Basic Reports']}
              isDark={isDark}
              delay={0}
            />
            <PriceCard
              tier="Team"
              price="£49"
              desc="Unlimited jobs"
              features={['5 Users', 'Priority Support', 'Custom Branding']}
              active
              isDark={isDark}
              delay={0.1}
            />
            <PriceCard
              tier="Agency"
              price="£199"
              desc="Unlimited everything"
              features={['Unlimited Users', 'API Access', 'Dedicated Support']}
              isDark={isDark}
              delay={0.2}
            />
          </div>
        </div>
      </section>

      {/* Phase 4.5: Roadmap Teasers Section */}
      <section
        className={`
          relative py-12 sm:py-16 px-4 sm:px-6
          ${isDark ? 'bg-slate-900/30' : 'bg-white/30'}
          backdrop-blur-sm
        `}
      >
        <div className="max-w-4xl mx-auto space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center space-y-3"
          >
            <span className="inline-block px-4 py-1 bg-primary/20 rounded-full text-primary text-xs font-medium tracking-widest">
              Coming Soon
            </span>
            <h2
              className={`
                text-2xl sm:text-3xl font-bold tracking-tight
                ${isDark ? 'text-white' : 'text-slate-900'}
              `}
            >
              Version 2.0 Roadmap
            </h2>
            <p className={`text-sm sm:text-base ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              We&apos;re building the future of field service documentation
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0 }}
              className={`
                p-5 rounded-xl border text-center space-y-2
                ${isDark
                  ? 'bg-slate-900 border-primary/20'
                  : 'bg-white/50 border-slate-200'
                }
              `}
            >
              <span className="material-symbols-outlined text-3xl text-primary">description</span>
              <h3 className={`font-black text-sm uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Advanced Evidence Export
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Professional PDF reports with verified timestamps
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className={`
                p-5 rounded-xl border text-center space-y-2
                ${isDark
                  ? 'bg-slate-900 border-primary/20'
                  : 'bg-white/50 border-slate-200'
                }
              `}
            >
              <span className="material-symbols-outlined text-3xl text-primary">verified</span>
              <h3 className={`font-black text-sm uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Secure Verification
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Cryptographic signatures for audit-ready records
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className={`
                p-5 rounded-xl border text-center space-y-2
                ${isDark
                  ? 'bg-slate-900 border-primary/20'
                  : 'bg-white/50 border-slate-200'
                }
              `}
            >
              <span className="material-symbols-outlined text-3xl text-primary">smart_toy</span>
              <h3 className={`font-black text-sm uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>
                AI Job Matching
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Smart technician assignment based on skills and location
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA - Gradient section */}
      <section className="relative py-12 sm:py-20 px-4 sm:px-6 bg-gradient-to-r from-primary via-indigo-600 to-primary bg-[length:200%_auto] animate-gradient-shift">
        <div className="max-w-3xl mx-auto text-center space-y-6 sm:space-y-8">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-2xl sm:text-4xl font-black text-white uppercase tracking-tight leading-tight"
          >
            Your Next Job Could Be<br />Your Next Dispute
          </motion.h2>
          <p className="text-base sm:text-xl text-white/80 px-2">
            Or it could be the one that proves JobProof pays for itself.<br />
            <span className="font-bold text-white">14 days free. No card required. Full protection from day one.</span>
          </p>
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 sm:gap-3 px-8 sm:px-12 py-4 sm:py-5 bg-white text-primary rounded-2xl font-black text-sm sm:text-lg uppercase tracking-widest shadow-2xl transition-all hover:scale-105 active:scale-95"
          >
            <span className="material-symbols-outlined text-xl sm:text-2xl">shield</span>
            Protect My Next Job
          </Link>
          <p className="text-sm text-white/60">
            Takes 30 seconds to sign up. Start capturing evidence on your next job.
          </p>
        </div>
      </section>

      {/* Footer - Glassmorphism */}
      <footer
        className={`
          relative py-8 sm:py-12 px-4 sm:px-6 border-t backdrop-blur-sm
          ${isDark
            ? 'border-white/15 bg-slate-950/50'
            : 'border-slate-200/50 bg-white/50'
          }
        `}
      >
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
          <JobProofLogo variant="full" size="sm" />
          <div
            className={`
              flex items-center gap-4 sm:gap-6 text-xs sm:text-sm
              ${isDark ? 'text-slate-400' : 'text-slate-400'}
            `}
          >
            <Link to="/pricing" className={`transition-colors ${isDark ? 'hover:text-white' : 'hover:text-slate-900'}`}>
              Pricing
            </Link>
            <Link to="/help" className={`transition-colors ${isDark ? 'hover:text-white' : 'hover:text-slate-900'}`}>
              Help
            </Link>
            <span>© {new Date().getFullYear()} JobProof</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Feature Card - Glassmorphism - REMEDIATION ITEM 11: Using memoized animation objects
const FeatureCard = ({
  icon,
  title,
  desc,
  isDark,
  delay,
}: {
  icon: string;
  title: string;
  desc: string;
  isDark: boolean;
  delay: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5, delay }}
    whileHover={hoverLiftQuick}
    className={`
      text-center space-y-3 sm:space-y-4 p-6 sm:p-8 rounded-2xl
      backdrop-blur-xl border transition-all duration-300
      ${isDark
        ? 'bg-slate-900 border-white/10 hover:bg-slate-900/70 hover:border-white/20'
        : 'bg-white/50 border-slate-200/50 hover:bg-white/70 hover:border-slate-300/50 hover:shadow-xl'
      }
    `}
  >
    <div
      className={`
        inline-flex items-center justify-center size-14 sm:size-16 rounded-xl sm:rounded-2xl
        ${isDark
          ? 'bg-gradient-to-br from-primary/30 to-indigo-600/20'
          : 'bg-gradient-to-br from-amber-100 to-orange-100'
        }
      `}
    >
      <span
        className={`
          material-symbols-outlined text-2xl sm:text-3xl
          ${isDark ? 'text-primary' : 'text-amber-600'}
        `}
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        {icon}
      </span>
    </div>
    <h3
      className={`
        text-base sm:text-lg font-bold tracking-tight
        ${isDark ? 'text-white' : 'text-slate-900'}
      `}
    >
      {title}
    </h3>
    <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
      {desc}
    </p>
  </motion.div>
);

// Step Card - Glassmorphism - REMEDIATION ITEM 11: Using memoized animation objects
const StepCard = ({
  num,
  title,
  desc,
  isDark,
  delay,
}: {
  num: string;
  title: string;
  desc: string;
  isDark: boolean;
  delay: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5, delay }}
    className="text-center space-y-2 sm:space-y-3"
  >
    <motion.div
      whileHover={stepNumberHover}
      className={`
        inline-flex items-center justify-center size-10 sm:size-12 rounded-full
        font-black text-sm sm:text-lg shadow-lg
        ${isDark
          ? 'bg-gradient-to-br from-primary to-indigo-600 text-white shadow-primary/30'
          : 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-amber-500/30'
        }
      `}
    >
      {num}
    </motion.div>
    <h3
      className={`
        text-xs sm:text-base font-black uppercase
        ${isDark ? 'text-white' : 'text-slate-900'}
      `}
    >
      {title}
    </h3>
    <p className={`text-[10px] sm:text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
      {desc}
    </p>
  </motion.div>
);

// FAQ Section - Accordion style with expandable items
const FAQSection = ({ isDark }: { isDark: boolean }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      icon: 'payments',
      question: 'How does JobProof help me get paid faster?',
      answer: 'When clients can see timestamped photos, GPS locations, and their own digital signature, there\'s nothing to argue about. No more "I didn\'t approve that" or "You weren\'t here that long." Clear evidence = faster payment. Most users report getting paid 40% faster.',
      badge: 'Faster payment',
    },
    {
      icon: 'shield',
      question: 'What makes the evidence "unbreakable"?',
      answer: 'Every photo and signature is cryptographically sealed with RSA-2048 + SHA-256. If anyone changes a single pixel or byte, the seal breaks and we detect it. It\'s the same level of security banks use. Your evidence can\'t be questioned or manipulated.',
      badge: 'Bank-grade',
    },
    {
      icon: 'wifi_off',
      question: 'What if I\'m on a job site with no signal?',
      answer: 'JobProof works completely offline. Capture photos, notes, and signatures in basements, rural areas, anywhere. Everything syncs automatically when you\'re back online. Zero data loss, zero excuses.',
      badge: 'Offline-first',
    },
    {
      icon: 'link',
      question: 'Do my technicians need to download an app?',
      answer: 'No app downloads, no passwords to remember. You send a magic link, they click it, they\'re in. Works on any phone, any browser. Your crew can start capturing evidence in under 30 seconds.',
      badge: 'Zero friction',
    },
    {
      icon: 'calculate',
      question: 'What\'s the ROI on JobProof?',
      answer: 'The average contractor loses £800 per dispute. JobProof Team costs £49/month. Save ONE dispute and you\'ve paid for 16 months of protection. Most users see ROI within their first month.',
      badge: '16× ROI',
    },
    {
      icon: 'draw',
      question: 'How does client sign-off work?',
      answer: 'When the job is done, hand your phone to the client. They sign on the screen, confirming satisfaction. That signature is timestamped, GPS-tagged, and cryptographically sealed. No more "I never approved that."',
      badge: 'Locked in',
    },
  ];

  return (
    <section className="relative py-12 sm:py-20 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-8 sm:space-y-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center space-y-3"
        >
          <span className="inline-block px-4 py-1 bg-emerald-500/20 rounded-full text-emerald-400 text-xs font-medium tracking-widest">
            Trust & Security
          </span>
          <h2
            className={`
              text-2xl sm:text-3xl font-bold tracking-tight
              ${isDark ? 'text-white' : 'text-slate-900'}
            `}
          >
            Frequently Asked Questions
          </h2>
          <p className={`text-sm sm:text-base ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Everything you need to know about protecting your work
          </p>
        </motion.div>

        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <motion.div
              key={faq.question}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className={`
                rounded-xl border overflow-hidden transition-all
                ${isDark
                  ? 'bg-slate-900 border-white/10 hover:border-white/20'
                  : 'bg-white/50 border-slate-200/50 hover:border-slate-300'
                }
              `}
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full p-4 sm:p-5 flex items-center gap-3 sm:gap-4 text-left"
              >
                <div
                  className={`
                    size-10 sm:size-12 rounded-xl flex items-center justify-center shrink-0
                    ${isDark
                      ? 'bg-primary/20'
                      : 'bg-amber-100'
                    }
                  `}
                >
                  <span
                    className={`
                      material-symbols-outlined text-lg sm:text-xl
                      ${isDark ? 'text-primary' : 'text-amber-600'}
                    `}
                  >
                    {faq.icon}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3
                      className={`
                        text-sm sm:text-base font-bold
                        ${isDark ? 'text-white' : 'text-slate-900'}
                      `}
                    >
                      {faq.question}
                    </h3>
                    <span
                      className={`
                        px-2 py-0.5 text-[10px] font-bold rounded-full uppercase
                        ${isDark
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-emerald-100 text-emerald-700'
                        }
                      `}
                    >
                      {faq.badge}
                    </span>
                  </div>
                </div>
                <span
                  className={`
                    material-symbols-outlined text-xl transition-transform shrink-0
                    ${openIndex === index ? 'rotate-180' : ''}
                    ${isDark ? 'text-slate-400' : 'text-slate-400'}
                  `}
                >
                  expand_more
                </span>
              </button>
              <motion.div
                initial={false}
                animate={{
                  height: openIndex === index ? 'auto' : 0,
                  opacity: openIndex === index ? 1 : 0,
                }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <p
                  className={`
                    px-4 sm:px-5 pb-4 sm:pb-5 pt-0 text-sm leading-relaxed
                    ${isDark ? 'text-slate-300' : 'text-slate-600'}
                  `}
                  style={{ marginLeft: '52px' }}
                >
                  {faq.answer}
                </p>
              </motion.div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <Link
            to="/help"
            className={`
              inline-flex items-center gap-2 text-sm font-bold transition-colors
              ${isDark
                ? 'text-primary hover:text-primary-hover'
                : 'text-amber-600 hover:text-amber-700'
              }
            `}
          >
            <span className="material-symbols-outlined text-lg">help</span>
            View Full Help Center
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

// Price Card - Glassmorphism - REMEDIATION ITEM 11: Using memoized animation objects
const PriceCard = ({
  tier,
  price,
  desc,
  features,
  active,
  isDark,
  delay,
}: {
  tier: string;
  price: string;
  desc: string;
  features: string[];
  active?: boolean;
  isDark: boolean;
  delay: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5, delay }}
    whileHover={hoverLiftQuick}
    className={`
      relative p-6 sm:p-8 rounded-2xl border transition-all duration-300
      ${active
        ? 'bg-gradient-to-br from-primary to-indigo-600 border-primary md:scale-105 shadow-2xl shadow-primary/30'
        : isDark
          ? 'bg-slate-900 border-white/10 backdrop-blur-xl hover:bg-slate-900/70'
          : 'bg-white/50 border-slate-200/50 backdrop-blur-xl hover:bg-white/70 hover:shadow-xl'
      }
    `}
  >
    {active && (
      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white text-primary text-[10px] sm:text-xs font-black px-3 py-1 rounded-full uppercase shadow-lg">
        Popular
      </span>
    )}
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h3
          className={`
            text-xs sm:text-sm font-semibold tracking-widest
            ${active ? 'text-white/80' : isDark ? 'text-slate-400' : 'text-slate-400'}
          `}
        >
          {tier}
        </h3>
        <p className={`text-3xl sm:text-4xl font-black ${active || isDark ? 'text-white' : 'text-slate-900'}`}>
          {price}
          <span className="text-base sm:text-lg font-normal">/mo</span>
        </p>
        <p className={`text-xs sm:text-sm ${active ? 'text-white/80' : isDark ? 'text-slate-400' : 'text-slate-400'}`}>
          {desc}
        </p>
      </div>
      <ul className="space-y-2">
        {features.map((f, i) => (
          <li
            key={`feature-${i}`}
            className={`
              text-xs sm:text-sm flex items-center gap-2
              ${active ? 'text-white' : isDark ? 'text-slate-400' : 'text-slate-600'}
            `}
          >
            <span
              className={`
                material-symbols-outlined text-xs sm:text-sm
                ${active ? 'text-white' : isDark ? 'text-primary' : 'text-amber-500'}
              `}
            >
              check
            </span>
            {f}
          </li>
        ))}
      </ul>
      <Link
        to={tier === 'Solo' ? '/auth' : '/pricing'}
        className={`
          block w-full py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm text-center
          uppercase tracking-widest transition-all active:scale-95
          ${active
            ? 'bg-white text-primary hover:bg-white/90 shadow-lg'
            : isDark
              ? 'bg-primary text-white hover:bg-primary-hover'
              : 'bg-slate-900 text-white hover:bg-slate-800'
          }
        `}
      >
        {tier === 'Solo' ? 'Start Free' : 'Get Started'}
      </Link>
    </div>
  </motion.div>
);

export default LandingPage;
