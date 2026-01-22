
import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { Job, Client, Technician, JobTemplate, UserProfile, Invoice } from './types';
import { startSyncWorker } from './lib/syncQueue';
import { signOut, getUserProfile } from './lib/auth';
import { getJobs, getClients, getTechnicians } from './lib/db';
import { getSupabase } from './lib/supabase';
import { pushQueue, pullJobs } from './lib/offline/sync';
import { AuthProvider, useAuth } from './lib/AuthContext';

// PERFORMANCE: Custom debounce utility to batch localStorage writes
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Lazy load all route components for optimal code splitting
const LandingPage = lazy(() => import('./views/LandingPage'));
const AdminDashboard = lazy(() => import('./views/AdminDashboard'));
const CreateJob = lazy(() => import('./views/CreateJob'));
const ContractorDashboard = lazy(() => import('./views/ContractorDashboard'));
const TechnicianPortal = lazy(() => import('./views/TechnicianPortal'));
const JobReport = lazy(() => import('./views/JobReport'));
const Settings = lazy(() => import('./views/Settings'));
const ClientsView = lazy(() => import('./views/ClientsView'));
const TechniciansView = lazy(() => import('./views/TechniciansView'));
const TemplatesView = lazy(() => import('./views/TemplatesView'));
const AuditReport = lazy(() => import('./views/docs/AuditReport'));
const HelpCenter = lazy(() => import('./views/HelpCenter'));
const OnboardingTour = lazy(() => import('./components/OnboardingTour'));
const ClientDashboard = lazy(() => import('./views/ClientDashboard'));
const LegalPage = lazy(() => import('./views/LegalPage'));
const PricingView = lazy(() => import('./views/PricingView'));
const ProfileView = lazy(() => import('./views/ProfileView'));
const AuthView = lazy(() => import('./views/AuthView'));
const EmailFirstAuth = lazy(() => import('./views/EmailFirstAuth'));
const SignupSuccess = lazy(() => import('./views/SignupSuccess'));
const CompleteOnboarding = lazy(() => import('./views/CompleteOnboarding'));
const OAuthSetup = lazy(() => import('./views/OAuthSetup'));
const InvoicesView = lazy(() => import('./views/InvoicesView'));
const RoadmapView = lazy(() => import('./views/RoadmapView'));
const TrackLookup = lazy(() => import('./views/TrackLookup'));

// Dynamic onboarding step loader component
// Note: Onboarding pages are currently Next.js format and need adaptation to React Router
const OnboardingStepLoader: React.FC = () => {
  const { persona, step } = useParams<{ persona: string; step: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    // For now, redirect to the main onboarding page
    // TODO: Adapt Next.js onboarding pages to React Router
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

// Inner component that consumes AuthContext
const AppContent: React.FC = () => {
  // CRITICAL FIX: Consume AuthContext instead of managing own auth state
  const { session, isAuthenticated, isLoading: authLoading } = useAuth();

  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(() => {
    return localStorage.getItem('jobproof_onboarding_v4') === 'true';
  });

  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('jobproof_user_v2');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  // Offline Sync Engine - Optimized with throttling
  // PERFORMANCE FIX: Reduced from 60s/90s to 5 minutes to minimize Supabase API calls
  useEffect(() => {
    let lastSyncTime = 0;
    const MIN_SYNC_INTERVAL = 300000; // Throttle: minimum 5 minutes (300s) between syncs

    const performSync = () => {
      const now = Date.now();
      if (now - lastSyncTime < MIN_SYNC_INTERVAL) {
        return; // Throttle: skip if synced too recently
      }

      if (navigator.onLine && user?.workspace?.id) {
        lastSyncTime = now;
        pushQueue();
        pullJobs(user.workspace.id);
      }
    };

    // Initial Pull (no throttle on mount)
    if (user?.workspace?.id) {
      pullJobs(user.workspace.id);
      lastSyncTime = Date.now();
    }

    // Consolidated Background Sync Interval (every 5 minutes, with throttle check)
    // Reduced from 90s to minimize Supabase REST API usage
    const interval = setInterval(() => {
      performSync();
    }, 300000); // 5 minutes

    // Online Listener with throttle
    const handleOnline = () => {
      console.log('[App] Online - Triggering throttled sync');
      performSync();
    };
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
    };
  }, [user?.workspace?.id]);

  // Data state (Phase C.2: Load from Supabase with localStorage fallback)
  const [jobs, setJobs] = useState<Job[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Templates still in localStorage (Phase D.6 will migrate to Protocols)
  const [templates, setTemplates] = useState<JobTemplate[]>(() => {
    const saved = localStorage.getItem('jobproof_templates_v2');
    return saved ? JSON.parse(saved) : [
      { id: 't1', name: 'Electrical Safety Audit', description: 'Standard 20-point precision audit for commercial infrastructure.', defaultTasks: ['Verify PPE', 'Lockout Tagout', 'Voltage Check', 'Evidence Capture'] },
      { id: 't2', name: 'Mechanical Systems Check', description: 'Quarterly operational protocol for HVAC/R units.', defaultTasks: ['Filter Inspection', 'Fluid Levels', 'Acoustic Test', 'Final Evidence'] },
      { id: 't3', name: 'Rapid Proof Capture', description: 'Priority evidence sequence for emergency callouts.', defaultTasks: ['Emergency Snapshot', 'Hazard ID', 'Signature Capture'] }
    ];
  });

  // CRITICAL FIX: Load user profile when AuthContext session changes
  // This replaces the duplicate onAuthStateChange listener
  useEffect(() => {
    const loadProfile = async () => {
      if (!session?.user) {
        setUser(null);
        // Clear user data from localStorage on logout
        localStorage.removeItem('jobproof_user_v2');
        // Fallback to localStorage if not authenticated
        loadLocalStorageData();
        return;
      }

      // Load user profile from database
      let profile = await getUserProfile(session.user.id);

      // PhD Level UX: If profile is missing but we have metadata, auto-heal in background
      if (!profile && session.user.user_metadata?.workspace_name) {
        console.log('[App] Profile missing but metadata found. Attempting auto-healing...');
        const meta = session.user.user_metadata;
        const workspaceSlug = (meta.workspace_name as string)
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        const finalSlug = `${workspaceSlug}-${Math.random().toString(36).substring(2, 5)}`;

        const supabase = getSupabase();
        if (supabase) {
          try {
            const { error } = await supabase.rpc('create_workspace_with_owner', {
              p_user_id: session.user.id,
              p_email: session.user.email,
              p_workspace_name: meta.workspace_name,
              p_workspace_slug: finalSlug,
              p_full_name: meta.full_name || null
            });
            if (error) {
              console.error('[App] Auto-heal workspace creation failed:', error);
            } else {
              console.log('[App] Workspace auto-healing successful, retrying profile load');
              // Try fetching again after creation
              profile = await getUserProfile(session.user.id);
            }
          } catch (err) {
            console.error('[App] Auto-heal exception:', err);
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
          workspace: profile.workspace ? { id: profile.workspace_id, name: profile.workspace.name } : undefined
        };
        setUser(userProfile);

        // Phase C.2: Load workspace data from Supabase
        loadWorkspaceData(profile.workspace_id);
      } else {
        // CRITICAL FIX: Profile load failed - handle gracefully
        console.warn('[App] Session exists but profile missing. Redirecting to setup.');

        // Create minimal user profile from session data for routing
        const fallbackProfile: UserProfile = {
          name: session.user.email || 'User',
          email: session.user.email || '',
          role: 'member',
          workspaceName: 'Setup Required',
          persona: undefined
        };
        setUser(fallbackProfile);
      }
    };

    loadProfile();
  }, [session]);

  // Phase C.2: Load data from Supabase
  const loadWorkspaceData = async (workspaceId: string) => {
    setDataLoading(true);

    try {
      // Load jobs, clients, and technicians in parallel
      const [jobsResult, clientsResult, techsResult] = await Promise.all([
        getJobs(workspaceId),
        getClients(workspaceId),
        getTechnicians(workspaceId)
      ]);

      if (jobsResult.success && jobsResult.data) {
        setJobs(jobsResult.data);
      } else {
        console.warn('Failed to load jobs from Supabase, falling back to localStorage:', jobsResult.error);
        loadLocalStorageJobs();
      }

      if (clientsResult.success && clientsResult.data) {
        setClients(clientsResult.data);
      } else {
        console.warn('Failed to load clients from Supabase, falling back to localStorage:', clientsResult.error);
        loadLocalStorageClients();
      }

      if (techsResult.success && techsResult.data) {
        setTechnicians(techsResult.data);
      } else {
        console.warn('Failed to load technicians from Supabase, falling back to localStorage:', techsResult.error);
        loadLocalStorageTechnicians();
      }

      // Invoices still from localStorage (Phase E.1)
      loadLocalStorageInvoices();
    } catch (error) {
      console.error('Error loading workspace data:', error);
      loadLocalStorageData();
    } finally {
      setDataLoading(false);
    }
  };

  // Fallback: Load from localStorage
  const loadLocalStorageData = () => {
    loadLocalStorageJobs();
    loadLocalStorageClients();
    loadLocalStorageTechnicians();
    loadLocalStorageInvoices();
  };

  const loadLocalStorageJobs = () => {
    const saved = localStorage.getItem('jobproof_jobs_v2');
    if (saved) {
      try {
        setJobs(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to parse jobs from localStorage:', error);
      }
    }
  };

  const loadLocalStorageClients = () => {
    const saved = localStorage.getItem('jobproof_clients_v2');
    if (saved) {
      try {
        setClients(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to parse clients from localStorage:', error);
      }
    }
  };

  const loadLocalStorageTechnicians = () => {
    const saved = localStorage.getItem('jobproof_techs_v2');
    if (saved) {
      try {
        setTechnicians(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to parse technicians from localStorage:', error);
      }
    }
  };

  const loadLocalStorageInvoices = () => {
    const saved = localStorage.getItem('jobproof_invoices_v2');
    if (saved) {
      try {
        setInvoices(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to parse invoices from localStorage:', error);
      }
    }
  };

  // PERFORMANCE OPTIMIZATION: Debounced localStorage persistence
  // Previously: 8 writes per state change (causing performance issues)
  // Now: Batched writes with 1000ms debounce, immediate save on unmount
  const saveToLocalStorage = useCallback(() => {
    localStorage.setItem('jobproof_jobs_v2', JSON.stringify(jobs));
    localStorage.setItem('jobproof_invoices_v2', JSON.stringify(invoices));
    localStorage.setItem('jobproof_clients_v2', JSON.stringify(clients));
    localStorage.setItem('jobproof_techs_v2', JSON.stringify(technicians));
    localStorage.setItem('jobproof_templates_v2', JSON.stringify(templates));
    localStorage.setItem('jobproof_onboarding_v4', hasSeenOnboarding.toString());

    // Persist user profile
    if (user) {
      localStorage.setItem('jobproof_user_v2', JSON.stringify(user));
    }
  }, [jobs, invoices, clients, technicians, templates, user, hasSeenOnboarding]);

  // Create debounced version once
  const debouncedSave = useRef(debounce(saveToLocalStorage, 1000)).current;

  // Trigger debounced save on state changes
  useEffect(() => {
    debouncedSave();

    // CRITICAL: Save immediately on unmount to ensure final state is persisted
    return () => {
      saveToLocalStorage();
    };
  }, [jobs, invoices, clients, technicians, templates, user, hasSeenOnboarding, debouncedSave, saveToLocalStorage]);

  // Start background sync worker on app mount
  useEffect(() => {
    startSyncWorker();
  }, []);

  const addJob = (newJob: Job) => setJobs(prev => [newJob, ...prev]);
  const updateJob = (updatedJob: Job) => setJobs(prev => prev.map(j => j.id === updatedJob.id ? updatedJob : j));

  const addInvoice = (inv: Invoice) => setInvoices(prev => [inv, ...prev]);
  const updateInvoiceStatus = (id: string, status: Invoice['status']) =>
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status } : inv));

  const addClient = (c: Client) => setClients(prev => [...prev, c]);
  const deleteClient = (id: string) => setClients(prev => prev.filter(c => c.id !== id));

  const addTech = (t: Technician) => setTechnicians(prev => [...prev, t]);
  const deleteTech = (id: string) => setTechnicians(prev => prev.filter(t => t.id !== id));

  const completeOnboarding = () => {
    setHasSeenOnboarding(true);
    localStorage.setItem('jobproof_onboarding_v4', 'true');
  };

  // Phase C.1: Real authentication callbacks
  const handleLogin = () => {
    // Session is managed by AuthContext
    // This callback just exists for compatibility with AuthView
  };

  const handleLogout = async () => {
    await signOut();
    // AuthContext will automatically update session state
  };

  // Show loading spinner while checking auth state
  if (authLoading) {
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
  const PersonaRedirect: React.FC<{ user: UserProfile | null }> = ({ user }) => {
    // CRITICAL FIX: Handle missing profile gracefully
    if (!user) {
      console.warn('[PersonaRedirect] No user profile, redirecting to setup');
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

    // Default to Admin Dashboard for Managers/Owners
    return <Navigate to="/admin" replace />;
  };

  return (
    <HashRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Redirect root to Landing or Dashboard based on Auth */}
          <Route path="/" element={isAuthenticated ? <PersonaRedirect user={user} /> : <Navigate to="/home" replace />} />
        <Route path="/home" element={isAuthenticated ? <PersonaRedirect user={user} /> : <LandingPage />} />
        <Route path="/pricing" element={<PricingView />} />
        <Route path="/roadmap" element={<RoadmapView />} />

        {/* Technician Entry Point - Public */}
        <Route path="/track-lookup" element={<TrackLookup />} />

        {/* Email-First Authentication (Primary) */}
        <Route path="/auth" element={isAuthenticated ? <PersonaRedirect user={user} /> : <EmailFirstAuth />} />
        <Route path="/auth/signup-success" element={<SignupSuccess />} />
        <Route path="/auth/setup" element={isAuthenticated ? <OAuthSetup /> : <Navigate to="/auth" replace />} />
        <Route path="/onboarding" element={isAuthenticated ? <CompleteOnboarding /> : <Navigate to="/auth" replace />} />
        <Route path="/onboarding/:persona/:step" element={isAuthenticated ? <OnboardingStepLoader /> : <Navigate to="/auth" replace />} />

        {/* Legacy Auth Routes (Fallback) */}
        <Route path="/auth/login" element={isAuthenticated ? <PersonaRedirect user={user} /> : <AuthView type="login" onAuth={handleLogin} />} />
        <Route path="/auth/signup" element={isAuthenticated ? <PersonaRedirect user={user} /> : <AuthView type="signup" onAuth={handleLogin} />} />

        {/* Onboarding & Setup */}
        <Route path="/setup" element={
          isAuthenticated ? <SignupSuccess /> : <Navigate to="/auth" replace />
        } />
        <Route path="/complete-onboarding" element={
          isAuthenticated ? <OnboardingTour onComplete={completeOnboarding} persona={user?.persona} /> : <Navigate to="/auth" replace />
        } />

        {/* Contractor Persona Flow */}
        {/* Contractor Persona Flow */}
        <Route path="/contractor" element={
          isAuthenticated ? (
            user ? (
              hasSeenOnboarding ? (
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
              )
            ) : (
              <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="size-10 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            )
          ) : <Navigate to="/auth" replace />
        } />

        {/* Client Persona Flow */}
        <Route path="/client" element={
          isAuthenticated ? (
            <ClientDashboard jobs={jobs} invoices={invoices} user={user} />
          ) : <Navigate to="/auth" replace />
        } />

        {/* Admin Hub - Protected by real session */}
        <Route path="/admin" element={
          isAuthenticated ? (
            user ? (
              hasSeenOnboarding ? (
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
              )
            ) : (
              <Navigate to="/auth/setup" replace />
            )
          ) : <Navigate to="/auth" replace />
        } />
        <Route path="/admin/create" element={isAuthenticated ? <CreateJob onAddJob={addJob} user={user} clients={clients} technicians={technicians} templates={templates} /> : <Navigate to="/auth" replace />} />
        <Route path="/admin/clients" element={isAuthenticated ? <ClientsView user={user} clients={clients} onAdd={addClient} onDelete={deleteClient} /> : <Navigate to="/auth" replace />} />
        <Route path="/admin/technicians" element={isAuthenticated ? <TechniciansView user={user} techs={technicians} onAdd={addTech} onDelete={deleteTech} /> : <Navigate to="/auth" replace />} />
        <Route path="/admin/templates" element={isAuthenticated ? <TemplatesView user={user} /> : <Navigate to="/auth" replace />} />
        <Route path="/admin/invoices" element={isAuthenticated ? <InvoicesView user={user} invoices={invoices} updateStatus={updateInvoiceStatus} /> : <Navigate to="/auth" replace />} />
        <Route path="/admin/settings" element={isAuthenticated ? <Settings user={user!} setUser={setUser} /> : <Navigate to="/auth" replace />} />
        <Route path="/admin/profile" element={isAuthenticated ? <ProfileView user={user!} setUser={setUser} onLogout={handleLogout} /> : <Navigate to="/auth" replace />} />
        <Route path="/admin/help" element={isAuthenticated ? <HelpCenter user={user} /> : <Navigate to="/auth" replace />} />
        <Route path="/admin/report/:jobId" element={isAuthenticated ? <JobReport user={user} jobs={jobs} invoices={invoices} onGenerateInvoice={addInvoice} /> : <Navigate to="/auth" replace />} />

        {/* Technician Entry - Public (Phase C.2: Token-based access) */}
        <Route path="/track/:token" element={<TechnicianPortal jobs={jobs} onUpdateJob={updateJob} />} />

        {/* Public Client Entry - Public */}
        <Route path="/report/:jobId" element={<JobReport jobs={jobs} invoices={invoices} publicView />} />

        {/* System & Docs */}
        <Route path="/docs/audit" element={<AuditReport />} />
        <Route path="/legal/:type" element={<LegalPage />} />

        {/* Fallbacks */}
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
};

// Main App component that provides AuthContext
const App: React.FC = () => {
  // We need to lift user state out to pass workspaceId to AuthProvider
  // But we'll use a temporary approach: pass null initially, AuthContext manages its own
  return (
    <AuthProvider workspaceId={null}>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
