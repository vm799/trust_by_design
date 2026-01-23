/**
 * Workspace Data Hooks
 *
 * Provides easy access to workspace-scoped data without needing to pass workspaceId manually.
 * These hooks automatically get the workspaceId from AuthContext and handle DbResult unwrapping.
 *
 * Phase A: Foundation
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import {
  getJobs as dbGetJobs,
  getClients as dbGetClients,
  getTechnicians as dbGetTechnicians,
  createJob,
  updateJob as dbUpdateJob,
  deleteJob as dbDeleteJob,
  createClient,
  updateClient as dbUpdateClient,
  deleteClient as dbDeleteClient,
  createTechnician,
  updateTechnician,
  deleteTechnician as dbDeleteTechnician,
} from '../lib/db';
import { generateSecureEntityId } from '../lib/secureId';
import type { Job, Client, Technician, Invoice } from '../types';

/**
 * Hook to get the current workspace ID
 */
export const useWorkspaceId = (): string | null => {
  const { session } = useAuth();

  // TODO: Get workspace ID from user profile or session
  // For now, try to extract from user metadata or use a default
  const workspaceId = session?.user?.user_metadata?.workspace_id || null;

  return workspaceId;
};

/**
 * Simple data fetching functions that use localStorage fallback for demo
 * These are temporary wrappers that work without requiring workspaceId
 */

// Jobs
export const getJobs = async (): Promise<Job[]> => {
  try {
    // Try localStorage first for demo
    const stored = localStorage.getItem('jobproof_jobs_v2');
    if (stored) {
      return JSON.parse(stored);
    }

    // Fallback to empty array
    return [];
  } catch {
    return [];
  }
};

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

export const updateJob = async (id: string, updates: Partial<Job>): Promise<Job> => {
  const jobs = await getJobs();
  const index = jobs.findIndex(j => j.id === id);
  if (index === -1) throw new Error('Job not found');

  jobs[index] = { ...jobs[index], ...updates };
  localStorage.setItem('jobproof_jobs_v2', JSON.stringify(jobs));
  return jobs[index];
};

export const deleteJob = async (id: string): Promise<void> => {
  const jobs = await getJobs();
  const filtered = jobs.filter(j => j.id !== id);
  localStorage.setItem('jobproof_jobs_v2', JSON.stringify(filtered));
};

// Clients
export const getClients = async (): Promise<Client[]> => {
  try {
    const stored = localStorage.getItem('jobproof_clients_v2');
    if (stored) {
      return JSON.parse(stored);
    }
    return [];
  } catch {
    return [];
  }
};

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

export const updateClient = async (id: string, updates: Partial<Client>): Promise<Client> => {
  const clients = await getClients();
  const index = clients.findIndex(c => c.id === id);
  if (index === -1) throw new Error('Client not found');

  clients[index] = { ...clients[index], ...updates };
  localStorage.setItem('jobproof_clients_v2', JSON.stringify(clients));
  return clients[index];
};

export const deleteClient = async (id: string): Promise<void> => {
  const clients = await getClients();
  const filtered = clients.filter(c => c.id !== id);
  localStorage.setItem('jobproof_clients_v2', JSON.stringify(filtered));
};

// Technicians
export const getTechnicians = async (): Promise<Technician[]> => {
  try {
    const stored = localStorage.getItem('jobproof_technicians_v2');
    if (stored) {
      return JSON.parse(stored);
    }
    return [];
  } catch {
    return [];
  }
};

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

export const deleteTechnician = async (id: string): Promise<void> => {
  const techs = await getTechnicians();
  const filtered = techs.filter(t => t.id !== id);
  localStorage.setItem('jobproof_technicians_v2', JSON.stringify(filtered));
};

// Invoices
export const getInvoices = async (): Promise<Invoice[]> => {
  try {
    const stored = localStorage.getItem('jobproof_invoices_v2');
    if (stored) {
      return JSON.parse(stored);
    }
    return [];
  } catch {
    return [];
  }
};

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

export const updateInvoice = async (id: string, updates: Partial<Invoice>): Promise<Invoice> => {
  const invoices = await getInvoices();
  const index = invoices.findIndex(i => i.id === id);
  if (index === -1) throw new Error('Invoice not found');

  invoices[index] = { ...invoices[index], ...updates };
  localStorage.setItem('jobproof_invoices_v2', JSON.stringify(invoices));
  return invoices[index];
};

export const deleteInvoice = async (id: string): Promise<void> => {
  const invoices = await getInvoices();
  const filtered = invoices.filter(i => i.id !== id);
  localStorage.setItem('jobproof_invoices_v2', JSON.stringify(filtered));
};
