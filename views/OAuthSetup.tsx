import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getSupabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { generateSecureSlugSuffix } from '../lib/secureId';
import { setTechnicianWorkMode } from '../lib/db';
import { clearProfileCache } from '../lib/auth';
import { fadeInUp, staggerContainer } from '../lib/animations';

/**
 * Account Setup View - Delightful Persona-Driven Onboarding
 *
 * Multi-step flow:
 * 1. Name collection (personal & warm)
 * 2. Persona selection (how do you work?)
 * 3. Workspace setup (for managers) or direct to app (sole contractors)
 * 4. PWA install prompt (add to home screen)
 *
 * Design principles:
 * - Frictionless & intuitive
 * - Delightful micro-interactions
 * - Smart routing based on persona
 * - Addictive - makes users want to use daily
 */

type Persona = 'solo' | 'manager' | null;
type Step = 'name' | 'persona' | 'workspace' | 'install';

// PWA install prompt hook
const useInstallPrompt = () => {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const promptInstall = async () => {
    if (!installPrompt) return false;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    setInstallPrompt(null);
    return outcome === 'accepted';
  };

  return { isInstallable, promptInstall };
};

const OAuthSetup: React.FC = () => {
  const navigate = useNavigate();
  const { userId, userEmail, session, isAuthenticated, isLoading: authLoading } = useAuth();
  const { isInstallable, promptInstall } = useInstallPrompt();

  // Extract metadata values to stable primitives
  const metadataFullName = session?.user?.user_metadata?.full_name || '';
  const metadataName = session?.user?.user_metadata?.name || '';

  // Multi-step state
  const [step, setStep] = useState<Step>('name');
  const [fullName, setFullName] = useState('');
  const [persona, setPersona] = useState<Persona>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasCheckedRef = useRef(false);
  const setupStartedRef = useRef(false); // Track if user has started setup flow

  useEffect(() => {
    if (authLoading) return;
    if (hasCheckedRef.current) return;

    const checkUser = async () => {
      // CRITICAL FIX: Don't redirect to /auth if user has already started setup
      // This prevents race condition where auth state changes mid-flow
      if (setupStartedRef.current) {
        return;
      }

      if (!isAuthenticated || !userId) {
        hasCheckedRef.current = true;
        navigate('/auth');
        return;
      }

      // CRITICAL FIX: Mark setup as started immediately once authenticated
      // This prevents any subsequent auth state changes from causing redirects
      setupStartedRef.current = true;
      hasCheckedRef.current = true;

      const supabase = getSupabase();
      if (!supabase) return;

      // Check if profile already exists (use maybeSingle to avoid 406 on new users)
      const { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (profile) {
        navigate('/', { replace: true });
        return;
      }

      // Pre-fill name from OAuth metadata
      if (metadataFullName) {
        setFullName(metadataFullName);
      } else if (metadataName) {
        setFullName(metadataName);
      }
    };

    checkUser();
  }, [authLoading, isAuthenticated, userId, navigate, metadataFullName, metadataName]);

  const firstName = fullName.split(' ')[0] || '';
  const displayWorkspaceName = workspaceName.trim() || (firstName ? `${firstName}'s Workspace` : 'My Workspace');

  // Step handlers
  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Please enter your name');
      return;
    }
    setError(null);
    // CRITICAL FIX: Mark setup as started to prevent auth redirect race condition
    setupStartedRef.current = true;
    setStep('persona');
  };

  const handlePersonaSelect = (selected: Persona) => {
    setPersona(selected);

    // Save work mode preference
    if (selected === 'solo') {
      setTechnicianWorkMode('self_employed');
    }

    // Solo contractors skip workspace setup
    if (selected === 'solo') {
      handleFinalSetup(selected);
    } else {
      setStep('workspace');
    }
  };

  const handleWorkspaceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleFinalSetup(persona);
  };

  const handleFinalSetup = async (selectedPersona: Persona) => {
    if (!userId) {
      console.error('[OAuthSetup] userId is null in handleFinalSetup');
      setError('Session not ready. Please refresh the page and try again.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase not configured');

      const finalWorkspaceName = workspaceName.trim() || `${firstName}'s Workspace`;
      const workspaceSlug = finalWorkspaceName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const finalSlug = `${workspaceSlug}-${generateSecureSlugSuffix()}`;

      // RPC returns workspace UUID on success — capture it to avoid a redundant SELECT
      const { data: rpcWorkspaceId, error: workspaceError } = await supabase.rpc('create_workspace_with_owner', {
        p_user_id: userId,
        p_email: userEmail,
        p_workspace_name: finalWorkspaceName,
        p_workspace_slug: finalSlug,
        p_full_name: fullName.trim()
      });

      // Track workspace_id across both new-user and returning-user paths
      let resolvedWorkspaceId: string | null = rpcWorkspaceId || null;

      if (workspaceError) {
        // Foreign key error = user doesn't exist in auth.users (stale session)
        // CRITICAL FIX: Don't immediately sign out - show error and let user retry
        if (workspaceError.message?.includes('fk_users_auth') || workspaceError.code === '23503') {
          console.error('[OAuthSetup] Foreign key error - session may be stale:', workspaceError);
          setError('Session expired. Please sign in again.');
          setLoading(false);
          // Give user a moment to see the error before redirecting
          setTimeout(() => {
            supabase.auth.signOut();
            navigate('/auth', { replace: true });
          }, 2000);
          return;
        }
        // 409/23505 = conflict, user already exists - update their full_name and continue
        if (workspaceError.code === '409' || workspaceError.code === '23505') {
          // CRITICAL FIX: Update full_name for existing users who may have NULL full_name
          // This fixes the "Welcome to JobProof" bug for returning users
          const { error: updateError } = await supabase
            .from('users')
            .update({ full_name: fullName.trim() })
            .eq('id', userId);
          if (updateError) {
            console.error('[OAuthSetup] Failed to update full_name:', updateError);
            // Non-fatal - continue with flow
          }
          // Returning user: RPC didn't return workspace_id, so query for it
          const { data: existingUser, error: fetchError } = await supabase
            .from('users')
            .select('workspace_id')
            .eq('id', userId)
            .maybeSingle();

          if (fetchError) {
            console.error('[OAuthSetup] Failed to fetch existing user:', fetchError);
          }
          resolvedWorkspaceId = existingUser?.workspace_id || null;
        } else {
          throw new Error(workspaceError.message || 'Workspace creation failed');
        }
      }

      // CRITICAL FIX: Save persona to user_personas table
      // This prevents the redirect loop: OAuthSetup → / → PersonaRedirect → /onboarding
      const personaType = selectedPersona === 'solo' ? 'solo_contractor' : 'agency_owner';

      if (resolvedWorkspaceId) {
        const { error: personaError } = await supabase
          .from('user_personas')
          .upsert({
            user_id: userId,
            workspace_id: resolvedWorkspaceId,
            persona_type: personaType,
            is_active: true,
            is_complete: true, // Mark as complete since OAuthSetup handles full setup
            current_step: null
          }, { onConflict: 'user_id,persona_type' });

        if (personaError) {
          console.error('[OAuthSetup] Failed to save persona:', personaError);
          // Non-fatal - continue with navigation
        }
      } else {
        // workspace_id is required for persona — this shouldn't happen but surface it
        console.error('[OAuthSetup] No workspace_id resolved — persona not saved');
        setError('Setup incomplete. Please refresh and try again.');
        setLoading(false);
        return;
      }

      // Show install prompt if available, otherwise navigate
      if (isInstallable) {
        setStep('install');
        setLoading(false);
      } else {
        navigateToDestination(selectedPersona);
      }
    } catch (err) {
      console.error('Setup error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  const navigateToDestination = (selectedPersona: Persona) => {
    // CRITICAL FIX: Clear stale profile cache (which cached null when profile didn't exist)
    // and signal App.tsx to re-fetch the profile BEFORE navigating.
    // Without this, App.tsx's profileLoadedRef blocks re-fetch and user stays null,
    // causing PersonaRedirect → /auth/setup redirect loop (visible flicker).
    clearProfileCache();
    window.dispatchEvent(new CustomEvent('jobproof:profile-created'));

    // Smart routing based on persona
    if (selectedPersona === 'solo') {
      navigate('/tech', { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  };

  const handleInstall = async () => {
    await promptInstall();
    navigateToDestination(persona);
  };

  const handleSkipInstall = () => {
    navigateToDestination(persona);
  };

  // Render current step
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col items-center justify-center px-4 py-6 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 -left-20 size-96 bg-emerald-500/20 blur-[120px] rounded-full" />
      <div className="absolute bottom-0 -right-20 size-96 bg-primary/20 blur-[120px] rounded-full" />

      {/* Progress Indicator */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
        {['name', 'persona', 'workspace', 'install'].map((s, i) => {
          const stepOrder = ['name', 'persona', 'workspace', 'install'];
          const currentIndex = stepOrder.indexOf(step);
          const isActive = i <= currentIndex;
          const isCurrent = s === step;
          // Hide workspace step indicator for solo contractors
          if (s === 'workspace' && persona === 'solo') return null;
          if (s === 'install' && !isInstallable) return null;

          return (
            <motion.div
              key={s}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.1 }}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                isCurrent ? 'w-8 bg-primary' : isActive ? 'w-4 bg-primary/50' : 'w-4 bg-slate-100/70 dark:bg-white/10'
              }`}
            />
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Name */}
        {step === 'name' && (
          <motion.div
            key="name"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-md space-y-6 relative z-10"
          >
            <div className="text-center space-y-4">
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                className="inline-flex items-center justify-center size-20 bg-gradient-to-br from-emerald-500/30 to-primary/30 rounded-3xl mb-2"
              >
                <span className="material-symbols-outlined text-slate-900 dark:text-white text-4xl">waving_hand</span>
              </motion.div>
              <div className="space-y-2">
                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  Hey there! 👋
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-base">
                  Let&apos;s get you set up in 30 seconds
                </p>
              </div>
            </div>

            <form onSubmit={handleNameSubmit} className="bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-white/10 p-6 rounded-3xl space-y-5">
              {error && (
                <div className="bg-danger/10 border border-danger/20 rounded-xl p-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-danger text-sm">error</span>
                  <p className="text-danger text-sm">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="oauth-full-name" className="text-sm font-bold text-slate-300">What should we call you?</label>
                <input
                  id="oauth-full-name"
                  type="text"
                  placeholder="Your name"
                  className="w-full bg-slate-800 border border-white/10 rounded-2xl py-4 px-5 text-white text-lg placeholder:text-slate-400 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                />
              </div>

              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-4 bg-gradient-to-r from-primary to-emerald-500 text-white rounded-2xl font-black text-base uppercase tracking-wide shadow-xl shadow-primary/25 flex items-center justify-center gap-2"
              >
                Continue
                <span className="material-symbols-outlined">arrow_forward</span>
              </motion.button>
            </form>
          </motion.div>
        )}

        {/* Step 2: Persona Selection */}
        {step === 'persona' && (
          <motion.div
            key="persona"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-lg space-y-6 relative z-10"
          >
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-black text-white tracking-tight">
                Nice to meet you, {firstName}! 🎉
              </h1>
              <p className="text-slate-400">
                How do you work?
              </p>
            </div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="grid gap-4"
            >
              {/* Solo Contractor Card */}
              <motion.button
                variants={fadeInUp}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handlePersonaSelect('solo')}
                className="group relative bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border-2 border-emerald-500/30 hover:border-emerald-400 p-6 rounded-3xl text-left transition-all overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl transform translate-x-10 -translate-y-10 group-hover:scale-150 transition-transform" />

                <div className="relative flex items-start gap-4">
                  <div className="size-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-emerald-400 text-3xl">person</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-black text-white">Solo Contractor</h3>
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase rounded-full">Popular</span>
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      I do my own jobs and need proof of work for clients
                    </p>
                    <div className="flex items-center gap-3 mt-3 text-xs text-emerald-400">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">bolt</span>
                        Start in 10 seconds
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">receipt_long</span>
                        Client receipts
                      </span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-emerald-400 text-2xl group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </div>
              </motion.button>

              {/* Team Manager Card */}
              <motion.button
                variants={fadeInUp}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handlePersonaSelect('manager')}
                className="group relative bg-gradient-to-br from-primary/20 to-blue-600/10 border-2 border-primary/30 hover:border-primary p-6 rounded-3xl text-left transition-all overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl transform translate-x-10 -translate-y-10 group-hover:scale-150 transition-transform" />

                <div className="relative flex items-start gap-4">
                  <div className="size-14 bg-primary/20 rounded-2xl flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary text-3xl">groups</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-black text-white mb-1">Team Manager</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      I manage technicians and need to track their work
                    </p>
                    <div className="flex items-center gap-3 mt-3 text-xs text-primary">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">send</span>
                        Send job links
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">dashboard</span>
                        Team dashboard
                      </span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-primary text-2xl group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </div>
              </motion.button>
            </motion.div>

            <button
              onClick={() => setStep('name')}
              className="w-full text-center text-slate-400 hover:text-white text-sm py-2 transition-colors"
            >
              ← Back
            </button>
          </motion.div>
        )}

        {/* Step 3: Workspace Setup (Managers only) */}
        {step === 'workspace' && (
          <motion.div
            key="workspace"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-md space-y-6 relative z-10"
          >
            <div className="text-center space-y-2">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.1 }}
                className="inline-flex items-center justify-center size-16 bg-primary/20 rounded-2xl mb-2"
              >
                <span className="material-symbols-outlined text-primary text-3xl">business</span>
              </motion.div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                Name your workspace
              </h1>
              <p className="text-slate-400 text-sm">
                This is where your team&apos;s jobs will live
              </p>
            </div>

            <form onSubmit={handleWorkspaceSubmit} className="bg-slate-900/80 backdrop-blur-xl border border-white/10 p-6 rounded-3xl space-y-5">
              {error && (
                <div className="bg-danger/10 border border-danger/20 rounded-xl p-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-danger text-sm">error</span>
                  <p className="text-danger text-sm">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="oauth-workspace-name" className="text-sm font-bold text-slate-300">Company or workspace name</label>
                <input
                  id="oauth-workspace-name"
                  type="text"
                  placeholder={`${firstName}'s Workspace`}
                  className="w-full bg-slate-800 border border-white/10 rounded-2xl py-4 px-5 text-white text-lg placeholder:text-slate-400 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  value={workspaceName}
                  onChange={e => setWorkspaceName(e.target.value)}
                />
                <p className="text-slate-400 text-xs">
                  Leave blank to use &quot;{displayWorkspaceName}&quot;
                </p>
              </div>

              {/* Preview */}
              <div className="bg-slate-800 border border-white/10 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Preview</p>
                <div className="flex items-center gap-3">
                  <div className="size-12 bg-gradient-to-br from-primary to-emerald-500 rounded-xl flex items-center justify-center text-white font-black text-xl">
                    {displayWorkspaceName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white font-bold">{displayWorkspaceName}</p>
                    <p className="text-slate-400 text-xs">{fullName} · Owner</p>
                  </div>
                </div>
              </div>

              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                className="w-full py-4 bg-gradient-to-r from-primary to-emerald-500 text-white rounded-2xl font-black text-base uppercase tracking-wide shadow-xl shadow-primary/25 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="material-symbols-outlined">rocket_launch</span>
                    Create Workspace
                  </>
                )}
              </motion.button>
            </form>

            <button
              onClick={() => setStep('persona')}
              className="w-full text-center text-slate-400 hover:text-white text-sm py-2 transition-colors"
            >
              ← Back
            </button>
          </motion.div>
        )}

        {/* Step 4: PWA Install Prompt */}
        {step === 'install' && (
          <motion.div
            key="install"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.4, type: 'spring' }}
            className="w-full max-w-md space-y-6 relative z-10"
          >
            <div className="text-center space-y-4">
              <motion.div
                initial={{ y: -20 }}
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                className="inline-flex items-center justify-center size-24 bg-gradient-to-br from-primary/30 to-emerald-500/30 rounded-3xl mb-2"
              >
                <span className="material-symbols-outlined text-white text-5xl">install_mobile</span>
              </motion.div>
              <div className="space-y-2">
                <h1 className="text-2xl font-black text-white tracking-tight">
                  Add to Home Screen? 📱
                </h1>
                <p className="text-slate-400 text-sm max-w-xs mx-auto">
                  Access JobProof instantly, works offline, and looks like a native app
                </p>
              </div>
            </div>

            <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 p-6 rounded-3xl space-y-4">
              <div className="space-y-3">
                {[
                  { icon: 'offline_bolt', text: 'Works offline - capture evidence anywhere' },
                  { icon: 'speed', text: 'Instant launch from home screen' },
                  { icon: 'notifications_active', text: 'Get notified about new jobs' },
                ].map((item, i) => (
                  <motion.div
                    key={item.icon}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <div className="size-10 bg-primary/20 rounded-xl flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary text-xl">{item.icon}</span>
                    </div>
                    <p className="text-white text-sm font-medium">{item.text}</p>
                  </motion.div>
                ))}
              </div>

              <motion.button
                onClick={handleInstall}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-4 bg-gradient-to-r from-primary to-emerald-500 text-white rounded-2xl font-black text-base uppercase tracking-wide shadow-xl shadow-primary/25 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined">add_to_home_screen</span>
                Add to Home Screen
              </motion.button>

              <button
                onClick={handleSkipInstall}
                className="w-full text-center text-slate-400 hover:text-white text-sm py-2 transition-colors"
              >
                Maybe later
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Trust Badge */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="absolute bottom-6 left-0 right-0 flex justify-center z-10"
      >
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-emerald-400 text-sm">verified</span>
            14-day free trial
          </span>
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-emerald-400 text-sm">lock</span>
            No credit card
          </span>
        </div>
      </motion.div>
    </div>
  );
};

export default OAuthSetup;
