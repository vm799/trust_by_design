/**
 * DataContext - Centralized Data State Management
 *
 * REMEDIATION ITEM 1: Replaces prop drilling in App.tsx
 *
 * This context provides:
 * - Single source of truth for jobs, clients, technicians, invoices, templates
 * - Supabase sync with localStorage fallback
 * - Mutation functions accessible from any component
 * - Loading and error states
 *
 * Usage:
 *   const { jobs, clients, addJob, updateJob, isLoading } = useData();
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Job, Client, Technician, Invoice, JobTemplate } from '../types';
import { useAuth } from './AuthContext';

// REMEDIATION ITEM 5: Lazy load heavy db module (2,445 lines)
// Dynamic import defers parsing until actually needed
const getDbModule = () => import('./db');

// Debounce utility for batched localStorage writes
function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Default templates
const DEFAULT_TEMPLATES: JobTemplate[] = [
  { id: 't1', name: 'Electrical Safety Audit', description: 'Standard 20-point precision audit for commercial infrastructure.', defaultTasks: ['Verify PPE', 'Lockout Tagout', 'Voltage Check', 'Evidence Capture'] },
  { id: 't2', name: 'Mechanical Systems Check', description: 'Quarterly operational protocol for HVAC/R units.', defaultTasks: ['Filter Inspection', 'Fluid Levels', 'Acoustic Test', 'Final Evidence'] },
  { id: 't3', name: 'Rapid Proof Capture', description: 'Priority evidence sequence for emergency callouts.', defaultTasks: ['Emergency Snapshot', 'Hazard ID', 'Signature Capture'] }
];

interface DataContextType {
  // Data arrays
  jobs: Job[];
  clients: Client[];
  technicians: Technician[];
  invoices: Invoice[];
  templates: JobTemplate[];

  // Loading states
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Job mutations
  addJob: (job: Job) => void;
  updateJob: (job: Job) => void;
  deleteJob: (id: string) => void;

  // Client mutations
  addClient: (client: Client) => void;
  updateClient: (client: Client) => void;
  deleteClient: (id: string) => void;

  // Technician mutations
  addTechnician: (tech: Technician) => void;
  updateTechnician: (tech: Technician) => void;
  deleteTechnician: (id: string) => void;

  // Invoice mutations
  addInvoice: (invoice: Invoice) => void;
  updateInvoice: (invoice: Invoice) => void;
  updateInvoiceStatus: (id: string, status: Invoice['status']) => void;
  deleteInvoice: (id: string) => void;

  // Template mutations
  addTemplate: (template: JobTemplate) => void;
  updateTemplate: (template: JobTemplate) => void;
  deleteTemplate: (id: string) => void;

  // Refresh data from source
  refresh: () => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

interface DataProviderProps {
  children: ReactNode;
  workspaceId?: string | null;
}

export function DataProvider({ children, workspaceId: propWorkspaceId }: DataProviderProps) {
  const { session } = useAuth();

  // Data state
  const [jobs, setJobs] = useState<Job[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [templates, setTemplates] = useState<JobTemplate[]>(() => {
    const saved = localStorage.getItem('jobproof_templates_v2');
    return saved ? JSON.parse(saved) : DEFAULT_TEMPLATES;
  });

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track loaded workspace to prevent duplicate loads
  const loadedWorkspaceRef = useRef<string | null>(null);

  // Get workspace ID from props or session
  const workspaceId = propWorkspaceId || session?.user?.user_metadata?.workspace_id || null;

  // Load data from localStorage
  const loadFromLocalStorage = useCallback(() => {
    try {
      const savedJobs = localStorage.getItem('jobproof_jobs_v2');
      const savedClients = localStorage.getItem('jobproof_clients_v2');
      const savedTechs = localStorage.getItem('jobproof_technicians_v2');
      const savedInvoices = localStorage.getItem('jobproof_invoices_v2');

      if (savedJobs) setJobs(JSON.parse(savedJobs));
      if (savedClients) setClients(JSON.parse(savedClients));
      if (savedTechs) setTechnicians(JSON.parse(savedTechs));
      if (savedInvoices) setInvoices(JSON.parse(savedInvoices));
    } catch (err) {
      console.error('[DataContext] Failed to load from localStorage:', err);
    }
  }, []);

  // Load data from Supabase with localStorage fallback
  // REMEDIATION ITEM 5: Uses dynamic import for lazy loading
  const loadFromSupabase = useCallback(async (wsId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Lazy load db module only when needed
      const db = await getDbModule();

      const [jobsResult, clientsResult, techsResult] = await Promise.all([
        db.getJobs(wsId),
        db.getClients(wsId),
        db.getTechnicians(wsId)
      ]);

      if (jobsResult.success && jobsResult.data) {
        setJobs(jobsResult.data);
      } else {
        console.warn('[DataContext] Supabase jobs failed, using localStorage');
        const saved = localStorage.getItem('jobproof_jobs_v2');
        if (saved) setJobs(JSON.parse(saved));
      }

      if (clientsResult.success && clientsResult.data) {
        setClients(clientsResult.data);
      } else {
        console.warn('[DataContext] Supabase clients failed, using localStorage');
        const saved = localStorage.getItem('jobproof_clients_v2');
        if (saved) setClients(JSON.parse(saved));
      }

      if (techsResult.success && techsResult.data) {
        setTechnicians(techsResult.data);
      } else {
        console.warn('[DataContext] Supabase technicians failed, using localStorage');
        const saved = localStorage.getItem('jobproof_technicians_v2');
        if (saved) setTechnicians(JSON.parse(saved));
      }

      // Invoices still localStorage only
      const savedInvoices = localStorage.getItem('jobproof_invoices_v2');
      if (savedInvoices) setInvoices(JSON.parse(savedInvoices));

      loadedWorkspaceRef.current = wsId;
    } catch (err) {
      console.error('[DataContext] Supabase load failed:', err);
      setError('Failed to load data from server');
      loadFromLocalStorage();
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
    }
  }, [loadFromLocalStorage]);

  // Initial data load
  useEffect(() => {
    if (workspaceId && loadedWorkspaceRef.current !== workspaceId) {
      loadFromSupabase(workspaceId);
    } else if (!workspaceId) {
      loadFromLocalStorage();
      setIsLoading(false);
      setIsInitialized(true);
    }
  }, [workspaceId, loadFromSupabase, loadFromLocalStorage]);

  // Debounced localStorage persistence
  const saveToLocalStorage = useCallback(() => {
    localStorage.setItem('jobproof_jobs_v2', JSON.stringify(jobs));
    localStorage.setItem('jobproof_clients_v2', JSON.stringify(clients));
    localStorage.setItem('jobproof_technicians_v2', JSON.stringify(technicians));
    localStorage.setItem('jobproof_invoices_v2', JSON.stringify(invoices));
    localStorage.setItem('jobproof_templates_v2', JSON.stringify(templates));
  }, [jobs, clients, technicians, invoices, templates]);

  const debouncedSave = useRef(debounce(saveToLocalStorage, 1000));

  // Save on data changes
  useEffect(() => {
    if (isInitialized) {
      debouncedSave.current();
    }

    // Save immediately on unmount
    return () => {
      if (isInitialized) {
        saveToLocalStorage();
      }
    };
  }, [jobs, clients, technicians, invoices, templates, isInitialized, saveToLocalStorage]);

  // Job mutations
  const addJob = useCallback((job: Job) => {
    setJobs(prev => [job, ...prev]);
  }, []);

  const updateJob = useCallback((updatedJob: Job) => {
    setJobs(prev => prev.map(j => j.id === updatedJob.id ? updatedJob : j));
  }, []);

  const deleteJob = useCallback((id: string) => {
    setJobs(prev => prev.filter(j => j.id !== id));
  }, []);

  // Client mutations
  const addClient = useCallback((client: Client) => {
    setClients(prev => [...prev, client]);
  }, []);

  const updateClient = useCallback((updatedClient: Client) => {
    setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
  }, []);

  const deleteClient = useCallback((id: string) => {
    setClients(prev => prev.filter(c => c.id !== id));
  }, []);

  // Technician mutations
  const addTechnician = useCallback((tech: Technician) => {
    setTechnicians(prev => [...prev, tech]);
  }, []);

  const updateTechnician = useCallback((updatedTech: Technician) => {
    setTechnicians(prev => prev.map(t => t.id === updatedTech.id ? updatedTech : t));
  }, []);

  const deleteTechnician = useCallback((id: string) => {
    setTechnicians(prev => prev.filter(t => t.id !== id));
  }, []);

  // Invoice mutations
  const addInvoice = useCallback((invoice: Invoice) => {
    setInvoices(prev => [invoice, ...prev]);
  }, []);

  const updateInvoice = useCallback((updatedInvoice: Invoice) => {
    setInvoices(prev => prev.map(i => i.id === updatedInvoice.id ? updatedInvoice : i));
  }, []);

  const updateInvoiceStatus = useCallback((id: string, status: Invoice['status']) => {
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status } : inv));
  }, []);

  const deleteInvoice = useCallback((id: string) => {
    setInvoices(prev => prev.filter(i => i.id !== id));
  }, []);

  // Template mutations
  const addTemplate = useCallback((template: JobTemplate) => {
    setTemplates(prev => [...prev, template]);
  }, []);

  const updateTemplate = useCallback((updatedTemplate: JobTemplate) => {
    setTemplates(prev => prev.map(t => t.id === updatedTemplate.id ? updatedTemplate : t));
  }, []);

  const deleteTemplate = useCallback((id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
  }, []);

  // Refresh function
  const refresh = useCallback(async () => {
    if (workspaceId) {
      loadedWorkspaceRef.current = null; // Force reload
      await loadFromSupabase(workspaceId);
    } else {
      loadFromLocalStorage();
    }
  }, [workspaceId, loadFromSupabase, loadFromLocalStorage]);

  const value: DataContextType = {
    // Data
    jobs,
    clients,
    technicians,
    invoices,
    templates,

    // Loading states
    isLoading,
    isInitialized,
    error,

    // Mutations
    addJob,
    updateJob,
    deleteJob,
    addClient,
    updateClient,
    deleteClient,
    addTechnician,
    updateTechnician,
    deleteTechnician,
    addInvoice,
    updateInvoice,
    updateInvoiceStatus,
    deleteInvoice,
    addTemplate,
    updateTemplate,
    deleteTemplate,

    // Actions
    refresh,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

/**
 * Hook to access data context
 * Throws if used outside DataProvider
 */
export function useData(): DataContextType {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}

/**
 * Hook for optional data access (returns null if outside provider)
 * Useful for components that may or may not be in provider tree
 */
export function useDataOptional(): DataContextType | null {
  return useContext(DataContext);
}

export { DataContext };
