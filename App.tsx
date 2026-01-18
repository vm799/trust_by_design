
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './views/LandingPage';
import AdminDashboard from './views/AdminDashboard';
import CreateJob from './views/CreateJob';
import TechnicianPortal from './views/TechnicianPortal';
import JobReport from './views/JobReport';
import Settings from './views/Settings';
import ClientsView from './views/ClientsView';
import TechniciansView from './views/TechniciansView';
import TemplatesView from './views/TemplatesView';
import AuditReport from './views/docs/AuditReport';
import HelpCenter from './views/HelpCenter';
import LegalPage from './views/LegalPage';
import PricingView from './views/PricingView';
import ProfileView from './views/ProfileView';
import AuthView from './views/AuthView';
import EmailFirstAuth from './views/EmailFirstAuth';
import SignupSuccess from './views/SignupSuccess';
import InvoicesView from './views/InvoicesView';
import RoadmapView from './views/RoadmapView';
import { Job, Client, Technician, JobTemplate, UserProfile, Invoice } from './types';
import { startSyncWorker } from './lib/syncQueue';
import { onAuthStateChange, signOut, getUserProfile } from './lib/auth';
import { getJobs, getClients, getTechnicians } from './lib/db';
import type { Session } from '@supabase/supabase-js';

const App: React.FC = () => {
  // Phase C.1: Real authentication with Supabase sessions
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

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
      { id: 't1', name: 'General Maintenance', description: 'Standard check-up and evidence capture.', defaultTasks: [] },
      { id: 't2', name: 'Emergency Callout', description: 'Priority documentation for reactive repairs.', defaultTasks: [] }
    ];
  });

  // Phase C.1: Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (newSession) => {
      setSession(newSession);

      if (newSession?.user) {
        // Load user profile from database
        const profile = await getUserProfile(newSession.user.id);
        if (profile) {
          // Map database profile to UserProfile type
          const userProfile: UserProfile = {
            name: profile.full_name || profile.email,
            email: profile.email,
            avatar: profile.avatar_url,
            role: profile.role,
            workspaceName: profile.workspace?.name || 'My Workspace'
          };
          setUser(userProfile);

          // Phase C.2: Load workspace data from Supabase
          loadWorkspaceData(profile.workspace_id);
        }
      } else {
        setUser(null);
        // Fallback to localStorage if not authenticated
        loadLocalStorageData();
      }

      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

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

  // Persist localStorage data
  useEffect(() => {
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

  // Start background sync worker on app mount
  useEffect(() => {
    startSyncWorker();
    console.log('🚀 Trust by Design v2 - Background sync worker started');
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

  const completeOnboarding = () => setHasSeenOnboarding(true);

  // Phase C.1: Real authentication callbacks
  const handleLogin = () => {
    // Session is set automatically by onAuthStateChange
    // This callback just exists for compatibility with AuthView
  };

  const handleLogout = async () => {
    await signOut();
    // onAuthStateChange will automatically clear session and user
  };

  // Computed: User is authenticated if session exists
  const isAuthenticated = !!session;

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

  return (
    <HashRouter>
      <Routes>
        <Route path="/home" element={<LandingPage />} />
        <Route path="/pricing" element={<PricingView />} />
        <Route path="/roadmap" element={<RoadmapView />} />

        {/* Email-First Authentication (Primary) */}
        <Route path="/auth" element={<EmailFirstAuth />} />
        <Route path="/auth/signup-success" element={<SignupSuccess />} />

        {/* Legacy Auth Routes (Fallback) */}
        <Route path="/auth/login" element={<AuthView type="login" onAuth={handleLogin} />} />
        <Route path="/auth/signup" element={<AuthView type="signup" onAuth={handleLogin} />} />

        {/* Admin Hub - Protected by real session */}
        <Route path="/admin" element={
          isAuthenticated ? (
            <AdminDashboard
              jobs={jobs}
              showOnboarding={!hasSeenOnboarding}
              onCloseOnboarding={completeOnboarding}
            />
          ) : <Navigate to="/auth" replace />
        } />
        <Route path="/admin/create" element={isAuthenticated ? <CreateJob onAddJob={addJob} clients={clients} technicians={technicians} templates={templates} /> : <Navigate to="/auth" replace />} />
        <Route path="/admin/clients" element={isAuthenticated ? <ClientsView clients={clients} onAdd={addClient} onDelete={deleteClient} /> : <Navigate to="/auth" replace />} />
        <Route path="/admin/technicians" element={isAuthenticated ? <TechniciansView techs={technicians} onAdd={addTech} onDelete={deleteTech} /> : <Navigate to="/auth" replace />} />
        <Route path="/admin/templates" element={isAuthenticated ? <TemplatesView templates={templates} /> : <Navigate to="/auth" replace />} />
        <Route path="/admin/invoices" element={isAuthenticated ? <InvoicesView invoices={invoices} updateStatus={updateInvoiceStatus} /> : <Navigate to="/auth" replace />} />
        <Route path="/admin/settings" element={isAuthenticated ? <Settings user={user!} setUser={setUser} /> : <Navigate to="/auth" replace />} />
        <Route path="/admin/profile" element={isAuthenticated ? <ProfileView user={user!} setUser={setUser} onLogout={handleLogout} /> : <Navigate to="/auth" replace />} />
        <Route path="/admin/help" element={isAuthenticated ? <HelpCenter /> : <Navigate to="/auth" replace />} />
        <Route path="/admin/report/:jobId" element={isAuthenticated ? <JobReport jobs={jobs} invoices={invoices} onGenerateInvoice={addInvoice} /> : <Navigate to="/auth" replace />} />

        {/* Technician Entry - Public (Phase C.2: Token-based access) */}
        <Route path="/track/:token" element={<TechnicianPortal jobs={jobs} onUpdateJob={updateJob} />} />

        {/* Public Client Entry - Public */}
        <Route path="/report/:jobId" element={<JobReport jobs={jobs} invoices={invoices} publicView />} />

        {/* System & Docs */}
        <Route path="/docs/audit" element={<AuditReport />} />
        <Route path="/legal/:type" element={<LegalPage />} />

        {/* Fallbacks */}
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
