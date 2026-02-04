
import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { UserProfile } from './types';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { DataProvider, useData } from './lib/DataContext';
import { generateSecureSlugSuffix } from './lib/secureId';
import RouteErrorBoundary from './components/RouteErrorBoundary';
import BuildFingerprint from './components/ui/BuildFingerprint';
import UpdateNotification from './components/UpdateNotification';
import { captureNavigationIntentFromUrl } from './lib/navigationIntent';

// REMEDIATION ITEM 5: Lazy load heavy modules to reduce initial bundle
// These are loaded on-demand when first needed
const getSyncQueue = () => import('./lib/syncQueue');
const getAuth = () => import('./lib/auth');
const getOfflineSync = () => import('./lib/offline/sync');
const getDbModule = () => import('./lib/db');

// REMEDIATION ITEM 13: Removed getSupabaseModule - supabase is statically imported
// by auth.ts, db.ts, etc. so dynamic import provides no code splitting benefit.
// When getAuth() loads auth.ts, supabase comes with it.

// PERFORMANCE: Debounce utility moved to DataContext for centralized state management

// Lazy load all route components for optimal code splitting
const LandingPage = lazy(() => import('./views/LandingPage'));
const AdminDashboard = lazy(() => import('./views/AdminDashboard'));
const CreateJob = lazy(() => import('./views/CreateJob'));
const ContractorDashboard = lazy(() => import('./views/ContractorDashboard'));
const TechnicianPortal = lazy(() => import('./views/TechnicianPortal'));
const TechProofScreen = lazy(() => import('./views/TechProofScreen'));
const JobReport = lazy(() => import('./views/JobReport'));
const Settings = lazy(() => import('./views/Settings'));
const ClientsView = lazy(() => import('./views/ClientsView'));
const TechniciansView = lazy(() => import('./views/TechniciansView'));
const TemplatesView = lazy(() => import('./views/TemplatesView'));
const AuditReport = lazy(() => import('./views/docs/AuditReport'));
const HelpCenter = lazy(() => import('./views/HelpCenter'));
const OnboardingTour = lazy(() => import('./components/OnboardingTour'));
const ClientDashboard = lazy(() => import('./views/ClientDashboard'));
const PricingView = lazy(() => import('./views/PricingView'));
const ProfileView = lazy(() => import('./views/ProfileView'));
const AuthView = lazy(() => import('./views/AuthView'));
// Phase 6.5: Dedicated callback handler for magic link auth
const AuthCallback = lazy(() => import('./views/AuthCallback'));
// UX Flow Contract: Dedicated expired link view with resend functionality
const LinkExpiredView = lazy(() => import('./views/LinkExpiredView'));
// V1 MVP: EmailFirstAuth removed - Magic Link only via AuthView
// const EmailFirstAuth = lazy(() => import('./views/EmailFirstAuth'));
const SignupSuccess = lazy(() => import('./views/SignupSuccess'));
const CompleteOnboarding = lazy(() => import('./views/CompleteOnboarding'));
const OAuthSetup = lazy(() => import('./views/OAuthSetup'));
const ManagerOnboarding = lazy(() => import('./views/ManagerOnboarding'));
const JobCreationWizard = lazy(() => import('./views/JobCreationWizard'));
const InvoicesView = lazy(() => import('./views/InvoicesView'));
const RoadmapView = lazy(() => import('./views/RoadmapView'));
const TrackLookup = lazy(() => import('./views/TrackLookup'));
const GoEntryPoint = lazy(() => import('./views/GoEntryPoint'));
const ManagerIntentSelector = lazy(() => import('./views/ManagerIntentSelector'));
const JobsList = lazy(() => import('./views/app/jobs/JobsList'));
const JobDetail = lazy(() => import('./views/app/jobs/JobDetail'));
const JobForm = lazy(() => import('./views/app/jobs/JobForm'));
const EvidenceReview = lazy(() => import('./views/app/jobs/EvidenceReview'));
const ClientForm = lazy(() => import('./views/app/clients/ClientForm'));
const TechnicianForm = lazy(() => import('./views/app/technicians/TechnicianForm'));
// Bunker Mode: Offline-first "God Component" for cement bunker operation
const JobRunner = lazy(() => import('./views/bunker/JobRunner'));
// End-to-End Recovery: Quick Create + Run + Log + Success pages
const QuickCreateJob = lazy(() => import('./views/QuickCreateJob'));
const BunkerRun = lazy(() => import('./views/BunkerRun'));
const JobLog = lazy(() => import('./views/JobLog'));
const BunkerSuccess = lazy(() => import('./views/BunkerSuccess'));
// Tech Portal: Technician job list and detail views (Phase G)
const TechPortal = lazy(() => import('./views/tech/TechPortal'));
const TechJobDetail = lazy(() => import('./views/tech/TechJobDetail'));
const EvidenceCapture = lazy(() => import('./views/tech/EvidenceCapture'));
// Stripe Trial: Plan selection after signup
const SelectPlan = lazy(() => import('./views/SelectPlan'));
// Developer Tools: Reset utility for clearing all persistence layers
const DevReset = lazy(() => import('./views/DevReset'));

// Dynamic onboarding step loader component
// Note: Onboarding pages are currently Next.js format and need adaptation to React Router
const OnboardingStepLoader: React.FC = () => {
  const { persona, step } = useParams<{ persona: string; step: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to the main onboarding page (persona-specific steps handled by OnboardingFactory)
    console.warn(`Onboarding route requested: ${persona}/${step} - Redirecting to main onboarding page`);
    navigate('/onboarding');
  }, [persona, step, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950">
      <div className="text-center space-y-4">
        <div className="size-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
        <p className="text-slate-400 text-sm font-black uppercase tracking-widest">Loading...</p>
      </div>
    </div>
  );
};

// Loading fallback component
const LoadingFallback: React.FC = () => (
  <div className="min-h-screen bg-slate-950 flex items-center justify-center">
    <div className="text-center space-y-4">
      <div className="size-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
      <p className="text-slate-400 text-sm font-black uppercase tracking-widest">Loading...</p>
    </div>
  </div>
);

// Inner component that consumes AuthContext and DataContext
const AppContent: React.FC = () => {
  // UX Flow Contract: Capture navigation intent FIRST, before any auth checks
  // This ensures deep links survive the auth flow
  const hasCapuredIntent = useRef(false);
  useEffect(() => {
    if (!hasCapuredIntent.current) {
      const intent = captureNavigationIntentFromUrl();
      if (intent) {
        console.log('[App] Captured navigation intent:', intent.path, intent.type);
      }
      hasCapuredIntent.current = true;
    }
  }, []);

  // CRITICAL FIX: Consume AuthContext instead of managing own auth state
  const { session, isAuthenticated, isLoading: authLoading } = useAuth();

  // REMEDIATION #1: Use DataContext for centralized data state
  const {
    jobs,
    clients,
    technicians,
    invoices,
    templates,
    addJob,
    updateJob,
    addClient,
    deleteClient,
    addTechnician,
    deleteTechnician,
    addInvoice,
    updateInvoiceStatus,
  } = useData();

  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(() => {
    return localStorage.getItem('jobproof_onboarding_v4') === 'true';
  });

  // AUTH-FIRST GUARD: Do NOT initialize user from localStorage
  // This prevents cached UI from leaking when session is expired.
  // User state is only set AFTER session validation in the loadProfile effect.
  const [user, setUser] = useState<UserProfile | null>(null);

  // Keep localStorage value in ref for potential use during profile loading
  // This allows fast hydration AFTER session is confirmed valid
  // Note: We read this once at mount but DO NOT use it to set initial state
  const cachedUserRef = useRef<UserProfile | null>(
    (() => {
      const saved = localStorage.getItem('jobproof_user_v2');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return null;
        }
      }
      return null;
    })()
  );

  // Offline Sync Engine - Optimized with throttling
  // PERFORMANCE FIX: Reduced from 60s/90s to 5 minutes to minimize Supabase API calls
  // REMEDIATION ITEM 5: Uses lazy-loaded sync module
  useEffect(() => {
    let lastSyncTime = 0;
    const MIN_SYNC_INTERVAL = 300000; // Throttle: minimum 5 minutes (300s) between syncs

    const performSync = async () => {
      const now = Date.now();
      if (now - lastSyncTime < MIN_SYNC_INTERVAL) {
        return; // Throttle: skip if synced too recently
      }

      if (navigator.onLine && user?.workspace?.id) {
        lastSyncTime = now;
        // Lazy load sync module only when needed
        const sync = await getOfflineSync();
        sync.pushQueue();
        sync.pullJobs(user.workspace.id);
      }
    };

    // Initial Pull (no throttle on mount)
    const initialPull = async () => {
      if (user?.workspace?.id) {
        const sync = await getOfflineSync();
        sync.pullJobs(user.workspace.id);
        lastSyncTime = Date.now();
      }
    };
    initialPull();

    // Consolidated Background Sync Interval (every 5 minutes, with throttle check)
    // Reduced from 90s to minimize Supabase REST API usage
    const interval = setInterval(() => {
      performSync();
    }, 300000); // 5 minutes

    // Online Listener with throttle
    const handleOnline = () => {
      performSync();
    };
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
    };
  }, [user?.workspace?.id]);

  // CRITICAL FIX: Track profile loading separately from auth loading
  // This prevents premature redirects that cause the /admin ↔ /auth/setup loop
  const [profileLoading, setProfileLoading] = useState(true);

  // CRITICAL FIX: Use STABLE primitive values instead of session object
  // The session object changes reference on EVERY token refresh (every ~10-50 minutes)
  // This was causing 9+ database calls per token refresh = ~877 requests/hour
  // By using session.user.id (a primitive string), we only trigger on actual login/logout
  const sessionUserId = session?.user?.id;
  const sessionUserEmail = session?.user?.email;
  const sessionUserMetadata = session?.user?.user_metadata;

  // Track if profile has been loaded to prevent duplicate loads
  const profileLoadedRef = useRef<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      // CRITICAL FIX: Always set profileLoading to true at start
      setProfileLoading(true);

      // No user = logged out
      if (!sessionUserId) {
        setUser(null);
        profileLoadedRef.current = null;
        setProfileLoading(false); // Done loading (no profile to load)
        // Clear user data from localStorage on logout
        localStorage.removeItem('jobproof_user_v2');
        // DataContext handles localStorage fallback automatically
        return;
      }

      // Skip if we already loaded this user's profile (prevents duplicate loads)
      if (profileLoadedRef.current === sessionUserId) {
        console.log('[App] Profile already loaded for user, skipping:', sessionUserId);
        setProfileLoading(false); // Ensure loading state is cleared
        return;
      }

      console.log('[App] Loading profile for user:', sessionUserId);

      // REMEDIATION ITEM 5: Lazy load auth module for profile operations
      const auth = await getAuth();

      // Load user profile from database
      let profile = await auth.getUserProfile(sessionUserId);

      // PhD Level UX: If profile is missing but we have metadata, auto-heal in background
      if (!profile && sessionUserMetadata?.workspace_name) {
        const meta = sessionUserMetadata;

        // GUARD: Check if user already exists in users table (prevents 409 conflicts)
        const supabase = auth.getSupabaseClient();
        if (supabase) {
          const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('id', sessionUserId)
            .maybeSingle();

          // Only create workspace if user doesn't exist
          if (!existingUser) {
            const workspaceSlug = (meta.workspace_name as string)
              .toLowerCase()
              .trim()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '');
            const finalSlug = `${workspaceSlug}-${generateSecureSlugSuffix()}`;

            try {
              const { error } = await supabase.rpc('create_workspace_with_owner', {
                p_user_id: sessionUserId,
                p_email: sessionUserEmail,
                p_workspace_name: meta.workspace_name,
                p_workspace_slug: finalSlug,
                p_full_name: meta.full_name || null
              });
              if (error) {
                // 409 = conflict, user/workspace already exists - not a real error
                if (error.code !== '409' && error.code !== '23505') {
                  console.error('[App] Auto-heal workspace creation failed:', error);
                }
              }
              // Try fetching again after creation attempt
              profile = await auth.getUserProfile(sessionUserId);
            } catch (err) {
              console.error('[App] Auto-heal exception:', err);
            }
          } else {
            // User exists but profile fetch failed - try again
            profile = await auth.getUserProfile(sessionUserId);
          }
        }
      }

      if (profile) {
        // Map database profile to UserProfile type
        const userProfile: UserProfile = {
          name: profile.full_name || profile.email,
          email: profile.email,
          avatar: profile.avatar_url,
          role: profile.role,
          workspaceName: profile.workspace?.name || 'My Workspace',
          persona: profile.personas?.[0]?.persona_type,
          workspace: profile.workspace ? {
            id: profile.workspace_id,
            name: profile.workspace.name,
            slug: profile.workspace.slug || profile.workspace_id
          } : undefined
        };
        setUser(userProfile);
        profileLoadedRef.current = sessionUserId;
        setProfileLoading(false); // CRITICAL: Profile loaded successfully
        // DataContext automatically loads workspace data based on workspaceId
      } else {
        // CRITICAL FIX: Profile load failed - handle gracefully
        console.warn('[App] Session exists but profile missing. Redirecting to setup.');

        // SPRINT 2 FIX: Clear stale localStorage cache when Supabase confirms profile doesn't exist
        // This prevents the "flicker to dashboard" bug when a deleted user signs in again
        localStorage.removeItem('jobproof_user_v2');
        localStorage.removeItem('jobproof_onboarding_v4');

        // Create minimal user profile from session data for routing
        // Setting user to null indicates setup is needed (not just loading)
        setUser(null);
        profileLoadedRef.current = sessionUserId;
        setProfileLoading(false); // CRITICAL: Done loading, profile truly missing
      }
    };

    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUserId]); // FIXED: Only depends on primitive userId, not session object

  // REMEDIATION #1: Data loading and mutations now handled by DataContext
  // Start background sync worker on app mount
  // REMEDIATION ITEM 5: Lazy load syncQueue module
  useEffect(() => {
    const initSyncWorker = async () => {
      const syncQueue = await getSyncQueue();
      syncQueue.startSyncWorker();
    };
    initSyncWorker();
  }, []);

  // Initialize magic link system - clean up expired links on app load
  useEffect(() => {
    const initMagicLinks = async () => {
      const db = await getDbModule();
      db.initializeMagicLinks();
    };
    initMagicLinks();
  }, []);

  // Save user profile to localStorage when it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem('jobproof_user_v2', JSON.stringify(user));
    }
    localStorage.setItem('jobproof_onboarding_v4', hasSeenOnboarding.toString());
  }, [user, hasSeenOnboarding]);

  // Alias for technician mutations (matches old API)
  const addTech = addTechnician;
  const deleteTech = deleteTechnician;

  const completeOnboarding = () => {
    setHasSeenOnboarding(true);
    localStorage.setItem('jobproof_onboarding_v4', 'true');
  };

  // REMEDIATION ITEM 5: Lazy load auth module for logout
  const handleLogout = async () => {
    const auth = await getAuth();
    await auth.signOut();
    // AuthContext will automatically update session state
  };

  // CRITICAL FIX: Show loading spinner while checking auth state OR loading profile
  // This prevents the redirect loop where routes fire before profile is loaded
  if (authLoading || (isAuthenticated && profileLoading)) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="size-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-400 text-sm font-black uppercase tracking-widest">Loading...</p>
        </div>
      </div>
    );
  }

  // Helper for Persona-Aware Routing
  // CRITICAL FIX: This component only renders AFTER profileLoading is false (blocked at top level)
  // So if user is null here, it means the profile is truly missing, not just loading
  const PersonaRedirect: React.FC<{ user: UserProfile | null; hasSeenOnboarding: boolean }> = ({ user, hasSeenOnboarding }) => {
    // Profile truly missing (not loading) - redirect to setup
    if (!user) {
      console.log('[PersonaRedirect] Profile missing (load complete), redirecting to setup');
      return <Navigate to="/auth/setup" replace />;
    }

    // If user has no persona, redirect to onboarding
    if (!user.persona) {
      console.log('[PersonaRedirect] No persona set, redirecting to onboarding');
      return <Navigate to="/onboarding" replace />;
    }

    // Normalise persona check
    const persona = user.persona.toLowerCase();

    if (persona === 'technician' || persona === 'contractor' || persona === 'solo_contractor') {
      return <Navigate to="/contractor" replace />;
    }

    if (persona === 'client') {
      return <Navigate to="/client" replace />;
    }

    // CRITICAL FIX: Managers with complete profiles go directly to dashboard
    // The hasSeenOnboarding localStorage flag is unreliable (resets in incognito/new browser)
    // If user has workspace + persona, they've completed setup - go to dashboard
    const hasCompleteProfile = !!(user.workspace?.id && user.persona);

    if (hasCompleteProfile) {
      console.log('[PersonaRedirect] Manager with complete profile, going to dashboard');
      // Auto-set onboarding flag to prevent future confusion
      if (!hasSeenOnboarding) {
        localStorage.setItem('jobproof_onboarding_v4', 'true');
      }
      return <Navigate to="/admin" replace />;
    }

    // Only show Intent Selector for users who just created persona but workspace setup incomplete
    // This should be rare - most users complete both in OAuthSetup
    console.log('[PersonaRedirect] Manager missing workspace, showing intent selector');
    return <Navigate to="/manager/intent" replace />;
  };

  return (
    <HashRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Redirect root to Landing or Dashboard based on Auth */}
          <Route path="/" element={isAuthenticated ? <PersonaRedirect user={user} hasSeenOnboarding={hasSeenOnboarding} /> : <Navigate to="/home" replace />} />
        {/* CRITICAL FIX: Always show LandingPage on /home - don't auto-redirect authenticated users
            Users who want to go to dashboard can click CTAs. This prevents redirect loops for
            users with incomplete profiles (missing persona/workspace). */}
        <Route path="/home" element={<LandingPage />} />
        <Route path="/pricing" element={<PricingView />} />
        <Route path="/roadmap" element={<RoadmapView />} />
        {/* Public Help Center - accessible without auth */}
        <Route path="/help" element={<HelpCenter user={user} />} />

        {/* Technician Entry Point - Public */}
        <Route path="/track-lookup" element={<TrackLookup />} />

        {/* V1 MVP: Magic Link Only Authentication */}
        <Route path="/auth" element={isAuthenticated ? <PersonaRedirect user={user} hasSeenOnboarding={hasSeenOnboarding} /> : <AuthView />} />
        {/* Phase 6.5: Dedicated callback handler for magic link - processes auth tokens */}
        <Route path="/auth/callback" element={<AuthCallback />} />
        {/* UX Flow Contract: Dedicated expired link view - NOT inline error in AuthCallback */}
        <Route path="/auth/expired" element={<LinkExpiredView />} />
        <Route path="/auth/signup-success" element={<SignupSuccess />} />
        <Route path="/auth/setup" element={isAuthenticated ? <OAuthSetup /> : <Navigate to="/auth" replace />} />
        {/* Stripe Trial: Plan selection after account creation */}
        <Route path="/select-plan" element={isAuthenticated ? <SelectPlan /> : <Navigate to="/auth" replace />} />
        <Route path="/onboarding" element={isAuthenticated ? <CompleteOnboarding /> : <Navigate to="/auth" replace />} />
        <Route path="/onboarding/:persona/:step" element={isAuthenticated ? <OnboardingStepLoader /> : <Navigate to="/auth" replace />} />
        {/* Manager Onboarding Wizard - UX Spec Compliant */}
        <Route path="/manager-onboarding" element={isAuthenticated ? <ManagerOnboarding /> : <Navigate to="/auth" replace />} />
        {/* Manager Intent Selector - Intent-First Entry Point */}
        <Route path="/manager/intent" element={
          isAuthenticated ? (
            user ? (
              <ManagerIntentSelector
                user={user}
                pendingJobsCount={jobs.filter(j => j.status !== 'Submitted').length}
                unseenNotificationsCount={0}
              />
            ) : (
              <Navigate to="/auth/setup" replace />
            )
          ) : <Navigate to="/auth" replace />
        } />

        {/* V1 MVP: Magic Link Auth Routes - All redirect to unified auth */}
        <Route path="/auth/login" element={isAuthenticated ? <PersonaRedirect user={user} hasSeenOnboarding={hasSeenOnboarding} /> : <AuthView />} />
        <Route path="/auth/signup" element={isAuthenticated ? <PersonaRedirect user={user} hasSeenOnboarding={hasSeenOnboarding} /> : <AuthView />} />

        {/* Onboarding & Setup */}
        <Route path="/setup" element={
          isAuthenticated ? <SignupSuccess /> : <Navigate to="/auth" replace />
        } />
        <Route path="/complete-onboarding" element={
          isAuthenticated ? <OnboardingTour onComplete={completeOnboarding} persona={user?.persona} /> : <Navigate to="/auth" replace />
        } />

        {/* Contractor Persona Flow - REMEDIATION #3: Error boundary */}
        <Route path="/contractor" element={
          isAuthenticated ? (
            user ? (
              <RouteErrorBoundary sectionName="Contractor Dashboard" fallbackRoute="/home">
                {hasSeenOnboarding ? (
                  <ContractorDashboard
                    jobs={jobs}
                    user={user}
                    showOnboarding={false}
                    onCloseOnboarding={completeOnboarding}
                  />
                ) : (
                  <ContractorDashboard
                    jobs={jobs}
                    user={user}
                    showOnboarding={true}
                    onCloseOnboarding={completeOnboarding}
                  />
                )}
              </RouteErrorBoundary>
            ) : (
              <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="size-10 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            )
          ) : <Navigate to="/auth" replace />
        } />

        {/* Contractor Job Detail - FIX: Missing route that ContractorDashboard navigates to */}
        <Route path="/contractor/job/:jobId" element={
          isAuthenticated ? (
            <RouteErrorBoundary sectionName="Job Detail" fallbackRoute="/contractor">
              <TechJobDetail />
            </RouteErrorBoundary>
          ) : <Navigate to="/auth" replace />
        } />

        {/* Client Persona Flow - REMEDIATION #3: Error boundary */}
        <Route path="/client" element={
          isAuthenticated ? (
            <RouteErrorBoundary sectionName="Client Dashboard" fallbackRoute="/home">
              <ClientDashboard jobs={jobs} invoices={invoices} user={user} />
            </RouteErrorBoundary>
          ) : <Navigate to="/auth" replace />
        } />

        {/* Admin Hub - Protected by real session */}
        {/* REMEDIATION #3: Route-level error boundary prevents crashes */}
        <Route path="/admin" element={
          isAuthenticated ? (
            user ? (
              <RouteErrorBoundary sectionName="Dashboard" fallbackRoute="/home">
                {hasSeenOnboarding ? (
                  <AdminDashboard
                    jobs={jobs}
                    clients={clients}
                    technicians={technicians}
                    user={user}
                    showOnboarding={false}
                    onCloseOnboarding={completeOnboarding}
                  />
                ) : (
                  <AdminDashboard
                    jobs={jobs}
                    clients={clients}
                    technicians={technicians}
                    user={user}
                    showOnboarding={true}
                    onCloseOnboarding={completeOnboarding}
                  />
                )}
              </RouteErrorBoundary>
            ) : (
              <Navigate to="/auth/setup" replace />
            )
          ) : <Navigate to="/auth" replace />
        } />
        {/* Jobs List - REMEDIATION #3: Error boundaries on admin routes */}
        <Route path="/admin/jobs" element={isAuthenticated ? (
          <RouteErrorBoundary sectionName="Jobs" fallbackRoute="/admin">
            <JobsList jobs={jobs} user={user} />
          </RouteErrorBoundary>
        ) : <Navigate to="/auth" replace />} />
        {/* SPRINT 3 FIX: Job Detail - Missing route causing "Assign Tech" button to fail */}
        <Route path="/admin/jobs/new" element={isAuthenticated ? (
          <RouteErrorBoundary sectionName="New Job" fallbackRoute="/admin/jobs">
            <JobForm />
          </RouteErrorBoundary>
        ) : <Navigate to="/auth" replace />} />
        <Route path="/admin/jobs/:id" element={isAuthenticated ? (
          <RouteErrorBoundary sectionName="Job Detail" fallbackRoute="/admin/jobs">
            <JobDetail />
          </RouteErrorBoundary>
        ) : <Navigate to="/auth" replace />} />
        <Route path="/admin/jobs/:id/edit" element={isAuthenticated ? (
          <RouteErrorBoundary sectionName="Edit Job" fallbackRoute="/admin/jobs">
            <JobForm />
          </RouteErrorBoundary>
        ) : <Navigate to="/auth" replace />} />
        <Route path="/admin/jobs/:id/evidence" element={isAuthenticated ? (
          <RouteErrorBoundary sectionName="Evidence Review" fallbackRoute="/admin/jobs">
            <EvidenceReview />
          </RouteErrorBoundary>
        ) : <Navigate to="/auth" replace />} />
        {/* Job Creation - UX Spec: 5-Step Guided Wizard */}
        <Route path="/admin/create" element={isAuthenticated ? (
          <RouteErrorBoundary sectionName="Job Creation" fallbackRoute="/admin">
            <JobCreationWizard onAddJob={addJob} user={user} clients={clients} technicians={technicians} />
          </RouteErrorBoundary>
        ) : <Navigate to="/auth" replace />} />
        {/* Legacy Job Creation (kept for backwards compatibility) */}
        <Route path="/admin/create-quick" element={isAuthenticated ? (
          <RouteErrorBoundary sectionName="Quick Job Creation" fallbackRoute="/admin">
            <CreateJob onAddJob={addJob} user={user} clients={clients} technicians={technicians} templates={templates} />
          </RouteErrorBoundary>
        ) : <Navigate to="/auth" replace />} />
        <Route path="/admin/clients" element={isAuthenticated ? (
          <RouteErrorBoundary sectionName="Clients" fallbackRoute="/admin">
            <ClientsView user={user} clients={clients} onAdd={addClient} onDelete={deleteClient} />
          </RouteErrorBoundary>
        ) : <Navigate to="/auth" replace />} />
        <Route path="/admin/clients/new" element={isAuthenticated ? (
          <RouteErrorBoundary sectionName="New Client" fallbackRoute="/admin/clients">
            <ClientForm />
          </RouteErrorBoundary>
        ) : <Navigate to="/auth" replace />} />
        <Route path="/admin/technicians" element={isAuthenticated ? (
          <RouteErrorBoundary sectionName="Technicians" fallbackRoute="/admin">
            <TechniciansView user={user} techs={technicians} onAdd={addTech} onDelete={deleteTech} />
          </RouteErrorBoundary>
        ) : <Navigate to="/auth" replace />} />
        <Route path="/admin/technicians/new" element={isAuthenticated ? (
          <RouteErrorBoundary sectionName="New Technician" fallbackRoute="/admin/technicians">
            <TechnicianForm />
          </RouteErrorBoundary>
        ) : <Navigate to="/auth" replace />} />
        <Route path="/admin/templates" element={isAuthenticated ? (
          <RouteErrorBoundary sectionName="Templates" fallbackRoute="/admin">
            <TemplatesView user={user} />
          </RouteErrorBoundary>
        ) : <Navigate to="/auth" replace />} />
        <Route path="/admin/invoices" element={isAuthenticated ? (
          <RouteErrorBoundary sectionName="Invoices" fallbackRoute="/admin">
            <InvoicesView user={user} invoices={invoices} updateStatus={updateInvoiceStatus} />
          </RouteErrorBoundary>
        ) : <Navigate to="/auth" replace />} />
        <Route path="/admin/settings" element={isAuthenticated ? (
          <RouteErrorBoundary sectionName="Settings" fallbackRoute="/admin">
            <Settings user={user!} setUser={setUser} />
          </RouteErrorBoundary>
        ) : <Navigate to="/auth" replace />} />
        <Route path="/admin/profile" element={isAuthenticated ? (
          <RouteErrorBoundary sectionName="Profile" fallbackRoute="/admin">
            <ProfileView user={user!} setUser={setUser} onLogout={handleLogout} />
          </RouteErrorBoundary>
        ) : <Navigate to="/auth" replace />} />
        <Route path="/admin/help" element={isAuthenticated ? (
          <RouteErrorBoundary sectionName="Help Center" fallbackRoute="/admin">
            <HelpCenter user={user} />
          </RouteErrorBoundary>
        ) : <Navigate to="/auth" replace />} />
        <Route path="/admin/report/:jobId" element={isAuthenticated ? (
          <RouteErrorBoundary sectionName="Job Report" fallbackRoute="/admin/jobs">
            <JobReport user={user} jobs={jobs} invoices={invoices} technicians={technicians} onGenerateInvoice={addInvoice} onUpdateJob={updateJob} />
          </RouteErrorBoundary>
        ) : <Navigate to="/auth" replace />} />

        {/* Validated Handshake Entry Point - Public (replaces legacy /technician/:token) */}
        <Route path="/go/:accessCode" element={
          <RouteErrorBoundary sectionName="Job Access" fallbackRoute="/track-lookup">
            <GoEntryPoint />
          </RouteErrorBoundary>
        } />

        {/* Technician Entry - Public (Phase C.2: Token-based access) - CRITICAL: Error boundary */}
        <Route path="/track/:token" element={
          <RouteErrorBoundary sectionName="Job Tracking" fallbackRoute="/track-lookup">
            <TechnicianPortal jobs={jobs} onUpdateJob={updateJob} />
          </RouteErrorBoundary>
        } />

        {/* Tech Portal Routes - Modern technician flow (Phase G) */}
        <Route path="/tech" element={
          <RouteErrorBoundary sectionName="Tech Portal" fallbackRoute="/home">
            <TechPortal />
          </RouteErrorBoundary>
        } />
        <Route path="/tech/job/:jobId" element={
          <RouteErrorBoundary sectionName="Job Detail" fallbackRoute="/tech">
            <TechJobDetail />
          </RouteErrorBoundary>
        } />
        <Route path="/tech/job/:jobId/capture" element={
          <RouteErrorBoundary sectionName="Evidence Capture" fallbackRoute="/tech">
            <EvidenceCapture />
          </RouteErrorBoundary>
        } />

        {/* Phase 15: Field Proof System - Public magic link access */}
        <Route path="/job/:jobId/:token" element={
          <RouteErrorBoundary sectionName="Job Proof" fallbackRoute="/home">
            <TechProofScreen />
          </RouteErrorBoundary>
        } />
        <Route path="/job/:jobId" element={
          <RouteErrorBoundary sectionName="Job Proof" fallbackRoute="/home">
            <TechProofScreen />
          </RouteErrorBoundary>
        } />

        {/* Public Client Entry - Public */}
        <Route path="/report/:jobId" element={
          <RouteErrorBoundary sectionName="Report" fallbackRoute="/home">
            <JobReport jobs={jobs} invoices={invoices} publicView />
          </RouteErrorBoundary>
        } />

        {/* Bunker Mode: Offline-first "God Component" - NO AUTH REQUIRED */}
        {/* Works in cement bunkers with zero cell service */}
        <Route path="/bunker" element={
          <RouteErrorBoundary sectionName="Bunker Mode" fallbackRoute="/home">
            <JobRunner />
          </RouteErrorBoundary>
        } />

        {/* End-to-End Recovery: Quick Create Job - Manager creates job and gets bunker link */}
        <Route path="/create-job" element={
          <RouteErrorBoundary sectionName="Quick Create" fallbackRoute="/home">
            <QuickCreateJob />
          </RouteErrorBoundary>
        } />

        {/* End-to-End Recovery: Run Page - Technician executes job (NO AUTH) */}
        {/* The Job ID in the URL is the permission to work */}
        <Route path="/run/:id" element={
          <RouteErrorBoundary sectionName="Run Job" fallbackRoute="/create-job">
            <BunkerRun />
          </RouteErrorBoundary>
        } />

        {/* End-to-End Recovery: Job Log - Technician's completed work receipts */}
        <Route path="/job-log" element={
          <RouteErrorBoundary sectionName="Job Log" fallbackRoute="/home">
            <JobLog />
          </RouteErrorBoundary>
        } />

        {/* End-to-End Recovery: Success Page - Shows after job sync (NO AUTH) */}
        <Route path="/success" element={
          <RouteErrorBoundary sectionName="Job Success" fallbackRoute="/job-log">
            <BunkerSuccess />
          </RouteErrorBoundary>
        } />

        {/* System & Docs */}
        <Route path="/docs/audit" element={<AuditReport />} />

        {/* Developer Tools - Hidden route for cache/storage reset */}
        <Route path="/dev/reset" element={<DevReset />} />

        {/* Fallbacks */}
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      {/* Developer build badge - visible in dev mode or with ?debug=1 */}
      <BuildFingerprint position="bottom-right" />
      {/* Service worker update notification - paid users auto-update off-hours */}
      <UpdateNotification />
    </HashRouter>
  );
};

// Main App component that provides AuthContext and DataContext
const App: React.FC = () => {
  // REMEDIATION #1: DataProvider wraps AppContent for centralized state management
  // AuthProvider → DataProvider → AppContent (data depends on auth)
  return (
    <AuthProvider workspaceId={null}>
      <DataProvider>
        <AppContent />
      </DataProvider>
    </AuthProvider>
  );
};

export default App;
