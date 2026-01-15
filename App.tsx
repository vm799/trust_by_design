
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
import { Job, Client, Technician, JobTemplate, UserProfile } from './types';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('jobproof_auth') === 'true';
  });

  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(() => {
    return localStorage.getItem('jobproof_onboarding_v4') === 'true';
  });

  const [user, setUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('jobproof_user_v2');
    return saved ? JSON.parse(saved) : {
      name: 'Alex Sterling',
      email: 'alex@fieldops-pro.com',
      role: 'Administrator',
      workspaceName: 'Field-Ops Pro'
    };
  });

  const [jobs, setJobs] = useState<Job[]>(() => {
    const saved = localStorage.getItem('jobproof_jobs_v2');
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

  useEffect(() => {
    localStorage.setItem('jobproof_jobs_v2', JSON.stringify(jobs));
    localStorage.setItem('jobproof_clients_v2', JSON.stringify(clients));
    localStorage.setItem('jobproof_techs_v2', JSON.stringify(technicians));
    localStorage.setItem('jobproof_templates_v2', JSON.stringify(templates));
    localStorage.setItem('jobproof_user_v2', JSON.stringify(user));
    localStorage.setItem('jobproof_auth', isAuthenticated.toString());
    localStorage.setItem('jobproof_onboarding_v4', hasSeenOnboarding.toString());
  }, [jobs, clients, technicians, templates, user, isAuthenticated, hasSeenOnboarding]);

  const addJob = (newJob: Job) => setJobs(prev => [newJob, ...prev]);
  const updateJob = (updatedJob: Job) => setJobs(prev => prev.map(j => j.id === updatedJob.id ? updatedJob : j));
  
  const addClient = (c: Client) => setClients(prev => [...prev, c]);
  const deleteClient = (id: string) => setClients(prev => prev.filter(c => c.id !== id));
  
  const addTech = (t: Technician) => setTechnicians(prev => [...prev, t]);
  const deleteTech = (id: string) => setTechnicians(prev => prev.filter(t => t.id !== id));

  const completeOnboarding = () => setHasSeenOnboarding(true);
  const handleLogin = () => setIsAuthenticated(true);
  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('jobproof_auth');
  };

  return (
    <HashRouter>
      <Routes>
        <Route path="/home" element={<LandingPage />} />
        <Route path="/pricing" element={<PricingView />} />
        <Route path="/auth/login" element={<AuthView type="login" onAuth={handleLogin} />} />
        <Route path="/auth/signup" element={<AuthView type="signup" onAuth={handleLogin} />} />
        
        {/* Admin Hub - Protected */}
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
        <Route path="/admin/settings" element={isAuthenticated ? <Settings user={user} setUser={setUser} /> : <Navigate to="/auth/login" replace />} />
        <Route path="/admin/profile" element={isAuthenticated ? <ProfileView user={user} setUser={setUser} onLogout={handleLogout} /> : <Navigate to="/auth/login" replace />} />
        <Route path="/admin/billing" element={isAuthenticated ? <BillingView /> : <Navigate to="/auth/login" replace />} />
        <Route path="/admin/help" element={isAuthenticated ? <HelpCenter /> : <Navigate to="/auth/login" replace />} />
        <Route path="/admin/report/:jobId" element={isAuthenticated ? <JobReport jobs={jobs} /> : <Navigate to="/auth/login" replace />} />
        
        {/* Technician Entry - Public */}
        <Route path="/track/:jobId" element={<TechnicianPortal jobs={jobs} onUpdateJob={updateJob} />} />
        
        {/* Public Client Entry - Public */}
        <Route path="/report/:jobId" element={<JobReport jobs={jobs} publicView />} />
        
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
