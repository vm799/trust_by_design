/**
 * Workspace Data Hooks
 *
 * REMEDIATION ITEM 2: Single source of truth via DataContext
 *
 * These hooks provide easy access to workspace-scoped data through DataContext.
 * All data operations go through the centralized state management.
 *
 * Usage:
 *   // Hook-based (preferred - reactive)
 *   const { jobs, addJob, updateJob } = useWorkspaceData();
 *
 *   // Standalone (for non-React code - reads from localStorage)
 *   const jobs = await getJobsStandalone();
 */

import { useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useData } from '../lib/DataContext';
import { generateSecureEntityId } from '../lib/secureId';
import type { Job, Client, Technician, Invoice } from '../types';

/**
 * Hook to get the current workspace ID
 */
export const useWorkspaceId = (): string | null => {
  const { session } = useAuth();
  const workspaceId = session?.user?.user_metadata?.workspace_id || null;
  return workspaceId;
};

/**
 * Main hook for workspace data - uses DataContext (PREFERRED)
 * This is reactive and will re-render when data changes
 */
export const useWorkspaceData = () => {
  const data = useData();

  // Job operations with ID generation
  const createJob = useCallback((jobData: Omit<Job, 'id'>): Job => {
    const newJob: Job = {
      ...jobData,
      id: generateSecureEntityId('job'),
    };
    data.addJob(newJob);
    return newJob;
  }, [data]);

  // Client operations with ID generation
  const createClient = useCallback((clientData: Omit<Client, 'id'>): Client => {
    const newClient: Client = {
      ...clientData,
      id: generateSecureEntityId('client'),
    };
    data.addClient(newClient);
    return newClient;
  }, [data]);

  // Technician operations with ID generation
  const createTechnician = useCallback((techData: Omit<Technician, 'id'>): Technician => {
    const newTech: Technician = {
      ...techData,
      id: generateSecureEntityId('tech'),
    };
    data.addTechnician(newTech);
    return newTech;
  }, [data]);

  // Invoice operations with ID generation
  const createInvoice = useCallback((invoiceData: Omit<Invoice, 'id'>): Invoice => {
    const newInvoice: Invoice = {
      ...invoiceData,
      id: generateSecureEntityId('inv'),
    };
    data.addInvoice(newInvoice);
    return newInvoice;
  }, [data]);

  return {
    // Data arrays (reactive)
    jobs: data.jobs,
    clients: data.clients,
    technicians: data.technicians,
    invoices: data.invoices,
    templates: data.templates,

    // Loading states
    isLoading: data.isLoading,
    isInitialized: data.isInitialized,
    error: data.error,

    // Job operations
    createJob,
    addJob: data.addJob,
    updateJob: data.updateJob,
    deleteJob: data.deleteJob,

    // Client operations
    createClient,
    addClient: data.addClient,
    updateClient: data.updateClient,
    deleteClient: data.deleteClient,

    // Technician operations
    createTechnician,
    addTechnician: data.addTechnician,
    updateTechnician: data.updateTechnician,
    deleteTechnician: data.deleteTechnician,

    // Invoice operations
    createInvoice,
    addInvoice: data.addInvoice,
    updateInvoice: data.updateInvoice,
    updateInvoiceStatus: data.updateInvoiceStatus,
    deleteInvoice: data.deleteInvoice,

    // Template operations
    addTemplate: data.addTemplate,
    updateTemplate: data.updateTemplate,
    deleteTemplate: data.deleteTemplate,

    // Refresh
    refresh: data.refresh,
  };
};

// ============================================================================
// STANDALONE FUNCTIONS (for non-React code)
// These read from localStorage which is kept in sync by DataContext
// NOTE: Mutations should use the hook when possible for proper state updates
// ============================================================================

/**
 * @deprecated Use useWorkspaceData() hook instead for reactive updates
 * Standalone function for reading jobs from localStorage
 */
export const getJobs = async (): Promise<Job[]> => {
  try {
    const stored = localStorage.getItem('jobproof_jobs_v2');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

/**
 * @deprecated Use useWorkspaceData().createJob() instead
 * Standalone function - writes to localStorage (DataContext will sync on next load)
 */
export const addJob = async (job: Omit<Job, 'id'>): Promise<Job> => {
  const jobs = await getJobs();
  const newJob: Job = {
    ...job,
    id: generateSecureEntityId('job'),
  };
  jobs.push(newJob);
  localStorage.setItem('jobproof_jobs_v2', JSON.stringify(jobs));
  return newJob;
};

/**
 * @deprecated Use useWorkspaceData().updateJob() instead
 */
export const updateJob = async (id: string, updates: Partial<Job>): Promise<Job> => {
  const jobs = await getJobs();
  const index = jobs.findIndex(j => j.id === id);
  if (index === -1) throw new Error('Job not found');
  jobs[index] = { ...jobs[index], ...updates };
  localStorage.setItem('jobproof_jobs_v2', JSON.stringify(jobs));
  return jobs[index];
};

/**
 * @deprecated Use useWorkspaceData().deleteJob() instead
 */
export const deleteJob = async (id: string): Promise<void> => {
  const jobs = await getJobs();
  const filtered = jobs.filter(j => j.id !== id);
  localStorage.setItem('jobproof_jobs_v2', JSON.stringify(filtered));
};

/**
 * @deprecated Use useWorkspaceData() hook instead
 */
export const getClients = async (): Promise<Client[]> => {
  try {
    const stored = localStorage.getItem('jobproof_clients_v2');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

/**
 * @deprecated Use useWorkspaceData().createClient() instead
 */
export const addClient = async (client: Omit<Client, 'id'>): Promise<Client> => {
  const clients = await getClients();
  const newClient: Client = {
    ...client,
    id: generateSecureEntityId('client'),
  };
  clients.push(newClient);
  localStorage.setItem('jobproof_clients_v2', JSON.stringify(clients));
  return newClient;
};

/**
 * @deprecated Use useWorkspaceData().updateClient() instead
 */
export const updateClient = async (id: string, updates: Partial<Client>): Promise<Client> => {
  const clients = await getClients();
  const index = clients.findIndex(c => c.id === id);
  if (index === -1) throw new Error('Client not found');
  clients[index] = { ...clients[index], ...updates };
  localStorage.setItem('jobproof_clients_v2', JSON.stringify(clients));
  return clients[index];
};

/**
 * @deprecated Use useWorkspaceData().deleteClient() instead
 */
export const deleteClient = async (id: string): Promise<void> => {
  const clients = await getClients();
  const filtered = clients.filter(c => c.id !== id);
  localStorage.setItem('jobproof_clients_v2', JSON.stringify(filtered));
};

/**
 * @deprecated Use useWorkspaceData() hook instead
 */
export const getTechnicians = async (): Promise<Technician[]> => {
  try {
    const stored = localStorage.getItem('jobproof_technicians_v2');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

/**
 * @deprecated Use useWorkspaceData().createTechnician() instead
 */
export const addTechnician = async (tech: Omit<Technician, 'id'>): Promise<Technician> => {
  const techs = await getTechnicians();
  const newTech: Technician = {
    ...tech,
    id: generateSecureEntityId('tech'),
  };
  techs.push(newTech);
  localStorage.setItem('jobproof_technicians_v2', JSON.stringify(techs));
  return newTech;
};

/**
 * @deprecated Use useWorkspaceData().updateTechnician() instead
 */
export const updateTechnician = async (id: string, updates: Partial<Technician>): Promise<Technician> => {
  const techs = await getTechnicians();
  const index = techs.findIndex(t => t.id === id);
  if (index === -1) throw new Error('Technician not found');
  techs[index] = { ...techs[index], ...updates };
  localStorage.setItem('jobproof_technicians_v2', JSON.stringify(techs));
  return techs[index];
};

/**
 * @deprecated Use useWorkspaceData().deleteTechnician() instead
 */
export const deleteTechnician = async (id: string): Promise<void> => {
  const techs = await getTechnicians();
  const filtered = techs.filter(t => t.id !== id);
  localStorage.setItem('jobproof_technicians_v2', JSON.stringify(filtered));
};

/**
 * @deprecated Use useWorkspaceData() hook instead
 */
export const getInvoices = async (): Promise<Invoice[]> => {
  try {
    const stored = localStorage.getItem('jobproof_invoices_v2');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

/**
 * @deprecated Use useWorkspaceData().createInvoice() instead
 */
export const addInvoice = async (invoice: Omit<Invoice, 'id'>): Promise<Invoice> => {
  const invoices = await getInvoices();
  const newInvoice: Invoice = {
    ...invoice,
    id: generateSecureEntityId('inv'),
  };
  invoices.push(newInvoice);
  localStorage.setItem('jobproof_invoices_v2', JSON.stringify(invoices));
  return newInvoice;
};

/**
 * @deprecated Use useWorkspaceData().updateInvoice() instead
 */
export const updateInvoice = async (id: string, updates: Partial<Invoice>): Promise<Invoice> => {
  const invoices = await getInvoices();
  const index = invoices.findIndex(i => i.id === id);
  if (index === -1) throw new Error('Invoice not found');
  invoices[index] = { ...invoices[index], ...updates };
  localStorage.setItem('jobproof_invoices_v2', JSON.stringify(invoices));
  return invoices[index];
};

/**
 * @deprecated Use useWorkspaceData().deleteInvoice() instead
 */
export const deleteInvoice = async (id: string): Promise<void> => {
  const invoices = await getInvoices();
  const filtered = invoices.filter(i => i.id !== id);
  localStorage.setItem('jobproof_invoices_v2', JSON.stringify(filtered));
};
