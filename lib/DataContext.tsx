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
 * REMEDIATION ITEM 8: Loading States Pattern
 * - Global isLoading: For initial data fetch and refresh operations
 * - Local component states: Forms handle their own 'saving' state for specific operations
 * - This separation provides better UX - users see specific feedback per action
 *
 * Usage:
 *   const { jobs, clients, addJob, updateJob, isLoading } = useData();
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Job, Client, Technician, Invoice, JobTemplate } from '../types';
import { useAuth } from './AuthContext';
import { normalizeJobs, normalizeJobTechnicianId } from './utils/technicianIdNormalization';
import { getWorkspaceStorageKey } from './testingControlPlane';

// REMEDIATION ITEM 5: Lazy load heavy db module (2,445 lines)
// Dynamic import defers parsing until actually needed
const getDbModule = () => import('./db');

// CLAUDE.md mandate: Dexie for offline-first persistence
const getOfflineDbModule = () => import('./offline/db');

// Base localStorage keys (may be suffixed with :workspaceId when isolation is enabled)
const STORAGE_KEYS = {
  jobs: 'jobproof_jobs_v2',
  clients: 'jobproof_clients_v2',
  technicians: 'jobproof_technicians_v2',
  invoices: 'jobproof_invoices_v2',
  templates: 'jobproof_templates_v2',
} as const;

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
  isRefreshing: boolean;  // REMEDIATION ITEM 8: Separate state for background refresh
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
  const { session, userId } = useAuth();

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
  const [isRefreshing, setIsRefreshing] = useState(false);  // REMEDIATION ITEM 8
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track loaded workspace to prevent duplicate loads
  const loadedWorkspaceRef = useRef<string | null>(null);

  // Workspace ID state - fetched from profile when session available
  const [fetchedWorkspaceId, setFetchedWorkspaceId] = useState<string | null>(null);

  // Get workspace ID from props, fetched profile, or session metadata
  const workspaceId = propWorkspaceId || fetchedWorkspaceId || session?.user?.user_metadata?.workspace_id || null;

  // Fetch workspace_id from profile when session is available
  useEffect(() => {
    const fetchProfile = async () => {
      if (!userId) {
        setFetchedWorkspaceId(null);
        return;
      }

      try {
        const db = await getDbModule();
        const supabase = db.getSupabase?.();
        if (!supabase) {
          return;
        }

        // Use maybeSingle() to avoid 406 error for new users who don't have a profile yet
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('workspace_id')
          .eq('id', userId)
          .maybeSingle();

        if (profileError) {
          console.warn('[DataContext] Profile fetch failed:', profileError.message);
          return;
        }

        // No profile found - new user, workspace_id will be set after OAuthSetup
        if (!profile) {
          return;
        }

        if (profile?.workspace_id) {
          setFetchedWorkspaceId(profile.workspace_id);
        }
      } catch (err) {
        console.error('[DataContext] Failed to fetch profile:', err);
      }
    };

    fetchProfile();
  }, [userId]);

  // Load data from localStorage with Dexie fallback for clients/technicians
  // WORKSPACE_ISOLATED_STORAGE: When feature flag is enabled, uses workspace-scoped keys
  const loadFromLocalStorage = useCallback(async (wsId?: string | null) => {
    try {
      // Get workspace-scoped keys (falls back to base keys when isolation disabled)
      const jobsKey = getWorkspaceStorageKey(STORAGE_KEYS.jobs, wsId);
      const invoicesKey = getWorkspaceStorageKey(STORAGE_KEYS.invoices, wsId);
      const clientsKey = getWorkspaceStorageKey(STORAGE_KEYS.clients, wsId);
      const techsKey = getWorkspaceStorageKey(STORAGE_KEYS.technicians, wsId);
      const templatesKey = getWorkspaceStorageKey(STORAGE_KEYS.templates, wsId);

      const savedJobs = localStorage.getItem(jobsKey);
      const savedInvoices = localStorage.getItem(invoicesKey);
      const savedTemplates = localStorage.getItem(templatesKey);

      // Sprint 2 Task 2.6: Normalize technician IDs on load
      if (savedJobs) setJobs(normalizeJobs(JSON.parse(savedJobs)));
      if (savedInvoices) setInvoices(JSON.parse(savedInvoices));
      if (savedTemplates) setTemplates(JSON.parse(savedTemplates));

      // CLAUDE.md mandate: Try Dexie first for clients/technicians (offline-first)
      let clientsLoaded = false;
      let techniciansLoaded = false;

      if (wsId) {
        try {
          const offlineDb = await getOfflineDbModule();
          const dexieClients = await offlineDb.getClientsLocal(wsId);
          const dexieTechs = await offlineDb.getTechniciansLocal(wsId);

          if (dexieClients.length > 0) {
            setClients(dexieClients);
            clientsLoaded = true;
          }
          if (dexieTechs.length > 0) {
            setTechnicians(dexieTechs);
            techniciansLoaded = true;
          }
        } catch (dexieErr) {
          console.warn('[DataContext] Dexie read failed, falling back to localStorage:', dexieErr);
        }
      }

      // Fall back to localStorage if Dexie didn't have data
      if (!clientsLoaded) {
        const savedClients = localStorage.getItem(clientsKey);
        if (savedClients) setClients(JSON.parse(savedClients));
      }
      if (!techniciansLoaded) {
        const savedTechs = localStorage.getItem(techsKey);
        if (savedTechs) setTechnicians(JSON.parse(savedTechs));
      }
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
        // FIX: Also fetch from bunker_jobs to include magic link completed jobs
        // BunkerRun.tsx syncs completed jobs to bunker_jobs table, not jobs table
        let allJobs = jobsResult.data;

        try {
          const supabase = db.getSupabase?.();
          if (supabase) {
            const { data: bunkerJobs, error: bunkerError } = await supabase
              .from('bunker_jobs')
              .select('*')
              .order('last_updated', { ascending: false });

            if (!bunkerError && bunkerJobs && bunkerJobs.length > 0) {
              // Map bunker_jobs to Job type and merge with existing jobs
              const bunkerJobsMapped: Job[] = bunkerJobs.map((row: any) => ({
                id: row.id,
                title: row.title || 'Untitled Job',
                client: row.client || row.client_name || '',
                clientId: row.client_id,
                technician: row.technician_name || '',
                techId: row.technician_id,
                status: row.status || 'Complete',
                date: row.scheduled_date || row.created_at?.split('T')[0],
                address: row.address || '',
                lat: row.lat,
                lng: row.lng,
                w3w: row.w3w,
                notes: row.notes || '',
                workSummary: row.work_summary,
                photos: row.before_photo_data || row.after_photo_data ? [
                  ...(row.before_photo_data ? [{ id: 'before', url: row.before_photo_data, type: 'before' as const, timestamp: row.created_at, verified: true, syncStatus: 'synced' as const }] : []),
                  ...(row.after_photo_data ? [{ id: 'after', url: row.after_photo_data, type: 'after' as const, timestamp: row.completed_at || row.created_at, verified: true, syncStatus: 'synced' as const }] : [])
                ] : [],
                signature: row.signature_data || null,
                signerName: row.signer_name,
                safetyChecklist: [],
                siteHazards: [],
                completedAt: row.completed_at,
                syncStatus: 'synced' as const,
                lastUpdated: row.last_updated ? new Date(row.last_updated).getTime() : Date.now(),
                workspaceId: wsId,
                // Flag to indicate this came from bunker_jobs (magic link flow)
                source: 'bunker' as const,
              }));

              // Merge: bunker jobs take precedence if same ID exists (they have the evidence)
              const existingIds = new Set(allJobs.map(j => j.id));
              const newBunkerJobs = bunkerJobsMapped.filter(bj => !existingIds.has(bj.id));

              // For jobs that exist in both, prefer the one with more data (photos/signature)
              const mergedJobs = allJobs.map(job => {
                const bunkerVersion = bunkerJobsMapped.find(bj => bj.id === job.id);
                if (bunkerVersion && (bunkerVersion.photos.length > 0 || bunkerVersion.signature)) {
                  // Bunker version has evidence, merge it
                  return {
                    ...job,
                    ...bunkerVersion,
                    // Preserve original job metadata
                    clientId: job.clientId || bunkerVersion.clientId,
                    techId: job.techId || bunkerVersion.techId,
                  };
                }
                return job;
              });

              allJobs = [...mergedJobs, ...newBunkerJobs];
            }
          }
        } catch (bunkerErr) {
          console.warn('[DataContext] bunker_jobs fetch failed (non-critical):', bunkerErr);
          // Continue with regular jobs - bunker_jobs is additive, not required
        }

        // Sprint 2 Task 2.6: Normalize technician IDs on load
        setJobs(normalizeJobs(allJobs));
      } else {
        console.warn('[DataContext] Supabase jobs failed, using localStorage');
        // WORKSPACE_ISOLATED_STORAGE: Use workspace-scoped key when enabled
        const jobsKey = getWorkspaceStorageKey(STORAGE_KEYS.jobs, wsId);
        const saved = localStorage.getItem(jobsKey);
        // Sprint 2 Task 2.6: Normalize technician IDs on load
        if (saved) setJobs(normalizeJobs(JSON.parse(saved)));
      }

      if (clientsResult.success && clientsResult.data) {
        setClients(clientsResult.data);
        // CLAUDE.md mandate: Persist to Dexie for offline access
        try {
          const offlineDb = await getOfflineDbModule();
          const localClients = clientsResult.data.map(c => ({
            ...c,
            workspaceId: wsId,
            syncStatus: 'synced' as const,
            lastUpdated: Date.now()
          }));
          await offlineDb.saveClientsBatch(localClients);
        } catch (dexieErr) {
          console.warn('[DataContext] Failed to persist clients to Dexie:', dexieErr);
        }
      } else {
        console.warn('[DataContext] Supabase clients failed, trying Dexie then localStorage');
        // WORKSPACE_ISOLATED_STORAGE: Use workspace-scoped key when enabled
        const clientsKey = getWorkspaceStorageKey(STORAGE_KEYS.clients, wsId);
        // Try Dexie first, then localStorage
        try {
          const offlineDb = await getOfflineDbModule();
          const dexieClients = await offlineDb.getClientsLocal(wsId);
          if (dexieClients.length > 0) {
            setClients(dexieClients);
          } else {
            const saved = localStorage.getItem(clientsKey);
            if (saved) setClients(JSON.parse(saved));
          }
        } catch (dexieErr) {
          const saved = localStorage.getItem(clientsKey);
          if (saved) setClients(JSON.parse(saved));
        }
      }

      if (techsResult.success && techsResult.data) {
        setTechnicians(techsResult.data);
        // CLAUDE.md mandate: Persist to Dexie for offline access
        try {
          const offlineDb = await getOfflineDbModule();
          const localTechs = techsResult.data.map(t => ({
            ...t,
            workspaceId: wsId,
            syncStatus: 'synced' as const,
            lastUpdated: Date.now()
          }));
          await offlineDb.saveTechniciansBatch(localTechs);
        } catch (dexieErr) {
          console.warn('[DataContext] Failed to persist technicians to Dexie:', dexieErr);
        }
      } else {
        console.warn('[DataContext] Supabase technicians failed, trying Dexie then localStorage');
        // Try Dexie first, then localStorage
        try {
          const offlineDb = await getOfflineDbModule();
          const dexieTechs = await offlineDb.getTechniciansLocal(wsId);
          if (dexieTechs.length > 0) {
            setTechnicians(dexieTechs);
          } else {
            const saved = localStorage.getItem('jobproof_technicians_v2');
            if (saved) setTechnicians(JSON.parse(saved));
          }
        } catch (dexieErr) {
          const saved = localStorage.getItem('jobproof_technicians_v2');
          if (saved) setTechnicians(JSON.parse(saved));
        }
      }

      // Invoices still localStorage only
      const savedInvoices = localStorage.getItem('jobproof_invoices_v2');
      if (savedInvoices) setInvoices(JSON.parse(savedInvoices));

      loadedWorkspaceRef.current = wsId;
    } catch (err) {
      console.error('[DataContext] Supabase load failed:', err);
      setError('Failed to load data from server');
      await loadFromLocalStorage(wsId);
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
      // Handle async loadFromLocalStorage call
      loadFromLocalStorage(workspaceId).then(() => {
        setIsLoading(false);
        setIsInitialized(true);
      });
    }
  }, [workspaceId, loadFromSupabase, loadFromLocalStorage]);

  // Debounced localStorage persistence
  // WORKSPACE_ISOLATED_STORAGE: When feature flag is enabled, uses workspace-scoped keys
  const saveToLocalStorage = useCallback(() => {
    // Get workspace-scoped keys (falls back to base keys when isolation disabled)
    const jobsKey = getWorkspaceStorageKey(STORAGE_KEYS.jobs, workspaceId);
    const clientsKey = getWorkspaceStorageKey(STORAGE_KEYS.clients, workspaceId);
    const techsKey = getWorkspaceStorageKey(STORAGE_KEYS.technicians, workspaceId);
    const invoicesKey = getWorkspaceStorageKey(STORAGE_KEYS.invoices, workspaceId);
    const templatesKey = getWorkspaceStorageKey(STORAGE_KEYS.templates, workspaceId);

    try {
      localStorage.setItem(jobsKey, JSON.stringify(jobs));
      localStorage.setItem(clientsKey, JSON.stringify(clients));
      localStorage.setItem(techsKey, JSON.stringify(technicians));
      localStorage.setItem(invoicesKey, JSON.stringify(invoices));
      localStorage.setItem(templatesKey, JSON.stringify(templates));
    } catch (err) {
      // QuotaExceededError: localStorage is full (~5MB limit).
      // This is non-fatal — data is still in memory and Supabase.
      // Attempt to free space by removing the largest key (jobs) and retrying smaller items.
      console.warn('[DataContext] localStorage save failed (quota exceeded):', err);
      try {
        localStorage.removeItem(jobsKey);
        localStorage.setItem(clientsKey, JSON.stringify(clients));
        localStorage.setItem(techsKey, JSON.stringify(technicians));
        localStorage.setItem(invoicesKey, JSON.stringify(invoices));
        localStorage.setItem(templatesKey, JSON.stringify(templates));
      } catch {
        // Still failing — localStorage is critically full. Silently degrade.
        // Dexie/IndexedDB and Supabase are the primary persistence layers anyway.
        console.warn('[DataContext] localStorage critically full, skipping persistence');
      }
    }
  }, [jobs, clients, technicians, invoices, templates, workspaceId]);

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
  // Sprint 2 Task 2.6: Normalize technician IDs on mutation
  const addJob = useCallback((job: Job) => {
    setJobs(prev => [normalizeJobTechnicianId(job), ...prev]);
  }, []);

  const updateJob = useCallback((updatedJob: Job) => {
    // Sprint 2 Task 2.6: Normalize technician IDs on mutation
    const normalizedJob = normalizeJobTechnicianId(updatedJob);
    setJobs(prev => prev.map(j => j.id === normalizedJob.id ? normalizedJob : j));
  }, []);

  const deleteJob = useCallback(async (id: string) => {
    // Optimistic update: Remove from local state immediately
    setJobs(prev => prev.filter(j => j.id !== id));

    // Persist to backend
    try {
      const dbModule = await getDbModule();
      const result = await dbModule.deleteJob(id);

      if (!result.success) {
        // Restore to state if delete failed
        setJobs(prev => [...prev, jobs.find(j => j.id === id)!].filter(Boolean) as Job[]);
        console.error('[DataContext] Job delete failed:', result.error);
      }
    } catch (err) {
      // Restore to state if error occurred
      setJobs(prev => [...prev, jobs.find(j => j.id === id)!].filter(Boolean) as Job[]);
      console.error('[DataContext] Job delete error:', err);
    }
  }, [jobs]);

  // Client mutations
  const addClient = useCallback((client: Client) => {
    setClients(prev => [...prev, client]);
  }, []);

  const updateClient = useCallback((updatedClient: Client) => {
    setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
  }, []);

  const deleteClient = useCallback(async (id: string) => {
    // Optimistic update: Remove from local state immediately
    setClients(prev => prev.filter(c => c.id !== id));

    // Persist to backend
    try {
      const dbModule = await getDbModule();
      const result = await dbModule.deleteClient(id);

      if (!result.success) {
        // Restore to state if delete failed
        setClients(prev => [...prev, clients.find(c => c.id === id)!].filter(Boolean) as Client[]);
        console.error('[DataContext] Client delete failed:', result.error);
      }
    } catch (err) {
      // Restore to state if error occurred
      setClients(prev => [...prev, clients.find(c => c.id === id)!].filter(Boolean) as Client[]);
      console.error('[DataContext] Client delete error:', err);
    }
  }, [clients]);

  // Technician mutations
  const addTechnician = useCallback((tech: Technician) => {
    setTechnicians(prev => [...prev, tech]);
  }, []);

  const updateTechnician = useCallback((updatedTech: Technician) => {
    setTechnicians(prev => prev.map(t => t.id === updatedTech.id ? updatedTech : t));
  }, []);

  const deleteTechnician = useCallback(async (id: string) => {
    // Optimistic update: Remove from local state immediately
    setTechnicians(prev => prev.filter(t => t.id !== id));

    // Persist to backend
    try {
      const dbModule = await getDbModule();
      const result = await dbModule.deleteTechnician(id);

      if (!result.success) {
        // Restore to state if delete failed
        setTechnicians(prev => [...prev, technicians.find(t => t.id === id)!].filter(Boolean) as Technician[]);
        console.error('[DataContext] Technician delete failed:', result.error);
      }
    } catch (err) {
      // Restore to state if error occurred
      setTechnicians(prev => [...prev, technicians.find(t => t.id === id)!].filter(Boolean) as Technician[]);
      console.error('[DataContext] Technician delete error:', err);
    }
  }, [technicians]);

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
    // Remove from local state
    setInvoices(prev => prev.filter(i => i.id !== id));
    // Note: Backend delete for invoices not yet implemented in db.ts
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

  // Refresh function - REMEDIATION ITEM 8: Uses separate isRefreshing state
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (workspaceId) {
        loadedWorkspaceRef.current = null; // Force reload
        await loadFromSupabase(workspaceId);
      } else {
        await loadFromLocalStorage(workspaceId);
      }
    } finally {
      setIsRefreshing(false);
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
    isRefreshing,
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
