
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
import BillingView from './views/BillingView';
import HelpCenter from './views/HelpCenter';
import LegalPage from './views/LegalPage';
import PricingView from './views/PricingView';
import ProfileView from './views/ProfileView';
import AuthView from './views/AuthView';
import InvoicesView from './views/InvoicesView';
import RoadmapView from './views/RoadmapView';
import { Job, Client, Technician, JobTemplate, UserProfile, Invoice } from './types';
import { startSyncWorker } from './lib/syncQueue';
import { onAuthStateChange, signOut, getUserProfile } from './lib/auth';
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

  // localStorage data (Phase C.2 will migrate to Supabase)
  const [jobs, setJobs] = useState<Job[]>(() => {
    const saved = localStorage.getItem('jobproof_jobs_v2');
    return saved ? JSON.parse(saved) : [];
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const saved = localStorage.getItem('jobproof_invoices_v2');
    return saved ? JSON.parse(saved) : [];
  });

  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem('jobproof_clients_v2');
    return saved ? JSON.parse(saved) : [];
  });

  const [technicians, setTechnicians] = useState<Technician[]>(() => {
    const saved = localStorage.getItem('jobproof_techs_v2');
    return saved ? JSON.parse(saved) : [];
  });

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
        }
      } else {
        setUser(null);
      }

      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

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
          ) : <Navigate to="/auth/login" replace />
        } />
        <Route path="/admin/create" element={isAuthenticated ? <CreateJob onAddJob={addJob} clients={clients} technicians={technicians} templates={templates} /> : <Navigate to="/auth/login" replace />} />
        <Route path="/admin/clients" element={isAuthenticated ? <ClientsView clients={clients} onAdd={addClient} onDelete={deleteClient} /> : <Navigate to="/auth/login" replace />} />
        <Route path="/admin/technicians" element={isAuthenticated ? <TechniciansView techs={technicians} onAdd={addTech} onDelete={deleteTech} /> : <Navigate to="/auth/login" replace />} />
        <Route path="/admin/templates" element={isAuthenticated ? <TemplatesView templates={templates} /> : <Navigate to="/auth/login" replace />} />
        <Route path="/admin/invoices" element={isAuthenticated ? <InvoicesView invoices={invoices} updateStatus={updateInvoiceStatus} /> : <Navigate to="/auth/login" replace />} />
        <Route path="/admin/settings" element={isAuthenticated ? <Settings user={user!} setUser={setUser} /> : <Navigate to="/auth/login" replace />} />
        <Route path="/admin/profile" element={isAuthenticated ? <ProfileView user={user!} setUser={setUser} onLogout={handleLogout} /> : <Navigate to="/auth/login" replace />} />
        <Route path="/admin/billing" element={isAuthenticated ? <BillingView /> : <Navigate to="/auth/login" replace />} />
        <Route path="/admin/help" element={isAuthenticated ? <HelpCenter /> : <Navigate to="/auth/login" replace />} />
        <Route path="/admin/report/:jobId" element={isAuthenticated ? <JobReport jobs={jobs} invoices={invoices} onGenerateInvoice={addInvoice} /> : <Navigate to="/auth/login" replace />} />

        {/* Technician Entry - Public (Phase C.2 will add token validation) */}
        <Route path="/track/:jobId" element={<TechnicianPortal jobs={jobs} onUpdateJob={updateJob} />} />

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
