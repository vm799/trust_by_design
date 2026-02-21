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
import { safeSetItem, safeRemoveItem } from './utils/safeLocalStorage';
import { getSyncQueueStatus } from './syncQueue';

// Safe JSON parse: returns fallback on corrupted/truncated localStorage data
function safeJsonParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

// REMEDIATION ITEM 5: Lazy load heavy db module (2,445 lines)
// Dynamic import defers parsing until actually needed
const getDbModule = () => import('./db');

// CLAUDE.md mandate: Dexie for offline-first persistence
const getOfflineDbModule = () => import('./offline/db');

// FIX 1.3: IndexedDB cleanup for synced photos and expired drafts
const getCleanupModule = () => import('./offline/cleanup');

// FIX 3.1: Auto-archive sealed jobs >180 days
const getArchiveModule = () => import('./offline/archive');

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

  // Sync queue status: reactive counts of pending/failed items
  syncStatus: { pending: number; failed: number };

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
    return saved ? safeJsonParse<JobTemplate[]>(saved, DEFAULT_TEMPLATES) : DEFAULT_TEMPLATES;
  });

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);  // REMEDIATION ITEM 8
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync queue status: reactive counts polled every 3 seconds
  const SYNC_POLL_INTERVAL = 3000;
  const [syncStatus, setSyncStatus] = useState<{ pending: number; failed: number }>({ pending: 0, failed: 0 });

  useEffect(() => {
    const poll = () => {
      const status = getSyncQueueStatus();
      setSyncStatus(prev =>
        prev.pending !== status.pending || prev.failed !== status.failed
          ? status
          : prev
      );
    };
    poll(); // Immediate read
    const id = setInterval(poll, SYNC_POLL_INTERVAL);
    return () => clearInterval(id);
  }, []);

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
      if (savedJobs) setJobs(normalizeJobs(safeJsonParse<Job[]>(savedJobs, [])));
      if (savedInvoices) setInvoices(safeJsonParse<Invoice[]>(savedInvoices, []));
      if (savedTemplates) setTemplates(safeJsonParse<JobTemplate[]>(savedTemplates, DEFAULT_TEMPLATES));

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
        if (savedClients) setClients(safeJsonParse<Client[]>(savedClients, []));
      }
      if (!techniciansLoaded) {
        const savedTechs = localStorage.getItem(techsKey);
        if (savedTechs) setTechnicians(safeJsonParse<Technician[]>(savedTechs, []));
      }
    } catch (err) {
      console.error('[DataContext] Failed to load from localStorage:', err);
    }
  }, []);

  // Load data from Supabase with localStorage fallback
  // REMEDIATION ITEM 5: Uses dynamic import for lazy loading
  // FIX: Merge local-only items to prevent data loss during workspace ID race condition
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
        // Sprint 2 Task 2.6: Normalize technician IDs on load
        const serverJobs = normalizeJobs(jobsResult.data);
        // FIX: Merge local-only jobs (created before workspaceId was available)
        // Uses setState callback to access current state without stale closure
        const serverJobIds = new Set(serverJobs.map(j => j.id));
        setJobs(prev => {
          const localOnly = prev.filter(j => !serverJobIds.has(j.id));
          if (localOnly.length > 0) {
            // Re-queue orphaned items in background (non-blocking)
            getOfflineDbModule().then(offlineDb => {
              for (const j of localOnly) {
                const jobWithWs = { ...j, workspaceId: wsId };
                offlineDb.saveJobLocal({ ...jobWithWs, syncStatus: 'pending' as const, lastUpdated: Date.now() }).catch(() => {});
                offlineDb.queueAction('CREATE_JOB', jobWithWs).catch(() => {});
              }
            }).catch(() => {});
            return [...serverJobs, ...localOnly];
          }
          return serverJobs;
        });
      } else {
        console.warn('[DataContext] Supabase jobs failed, using localStorage');
        // WORKSPACE_ISOLATED_STORAGE: Use workspace-scoped key when enabled
        const jobsKey = getWorkspaceStorageKey(STORAGE_KEYS.jobs, wsId);
        const saved = localStorage.getItem(jobsKey);
        // Sprint 2 Task 2.6: Normalize technician IDs on load
        if (saved) setJobs(normalizeJobs(safeJsonParse<Job[]>(saved, [])));
      }

      if (clientsResult.success && clientsResult.data) {
        // FIX: Merge local-only clients (created before workspaceId was available)
        const serverClientIds = new Set(clientsResult.data.map(c => c.id));
        setClients(prev => {
          const localOnly = prev.filter(c => !serverClientIds.has(c.id));
          // Re-queue orphaned local clients in Dexie with correct workspaceId (non-blocking)
          if (localOnly.length > 0) {
            getOfflineDbModule().then(offlineDb => {
              for (const c of localOnly) {
                offlineDb.saveClientLocal({ ...c, totalJobs: c.totalJobs || 0, workspaceId: wsId, syncStatus: 'pending' as const, lastUpdated: Date.now() }).catch(() => {});
                offlineDb.queueAction('CREATE_CLIENT', { ...c, workspaceId: wsId }).catch(() => {});
              }
            }).catch(() => {});
            return [...clientsResult.data, ...localOnly];
          }
          return clientsResult.data;
        });

        // CLAUDE.md mandate: Persist server data to Dexie for offline access
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
            if (saved) setClients(safeJsonParse<Client[]>(saved, []));
          }
        } catch (dexieErr) {
          const saved = localStorage.getItem(clientsKey);
          if (saved) setClients(safeJsonParse<Client[]>(saved, []));
        }
      }

      if (techsResult.success && techsResult.data) {
        // FIX: Merge local-only technicians (created before workspaceId was available)
        const serverTechIds = new Set(techsResult.data.map(t => t.id));
        setTechnicians(prev => {
          const localOnly = prev.filter(t => !serverTechIds.has(t.id));
          // Re-queue orphaned local techs in Dexie with correct workspaceId (non-blocking)
          if (localOnly.length > 0) {
            getOfflineDbModule().then(offlineDb => {
              for (const t of localOnly) {
                offlineDb.saveTechnicianLocal({ ...t, status: t.status || 'Available', rating: t.rating || 0, jobsCompleted: t.jobsCompleted || 0, workspaceId: wsId, syncStatus: 'pending' as const, lastUpdated: Date.now() }).catch(() => {});
                offlineDb.queueAction('CREATE_TECHNICIAN', { ...t, workspaceId: wsId }).catch(() => {});
              }
            }).catch(() => {});
            return [...techsResult.data, ...localOnly];
          }
          return techsResult.data;
        });

        // CLAUDE.md mandate: Persist server data to Dexie for offline access
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
            if (saved) setTechnicians(safeJsonParse<Technician[]>(saved, []));
          }
        } catch (dexieErr) {
          const saved = localStorage.getItem('jobproof_technicians_v2');
          if (saved) setTechnicians(safeJsonParse<Technician[]>(saved, []));
        }
      }

      // Invoices still localStorage only
      const savedInvoices = localStorage.getItem('jobproof_invoices_v2');
      if (savedInvoices) setInvoices(safeJsonParse<Invoice[]>(savedInvoices, []));

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

  // FIX 1.3: Schedule IndexedDB cleanup on app startup
  // Removes orphaned photos from synced jobs and expired form drafts
  useEffect(() => {
    const scheduleCleanupAsync = async () => {
      try {
        const cleanupModule = await getCleanupModule();
        await cleanupModule.scheduleCleanup();
      } catch (error) {
        console.error('[DataContext] Failed to schedule cleanup:', error);
        // Non-fatal - app continues even if cleanup fails
      }
    };

    scheduleCleanupAsync();
  }, []); // Run once on mount

  // FIX 3.1: Schedule auto-archive of sealed jobs >180 days on app startup
  // Prevents IndexedDB storage bloat (10K jobs @ 50KB = 500MB+)
  useEffect(() => {
    const scheduleArchiveAsync = async () => {
      try {
        const archiveModule = await getArchiveModule();
        const offlineDb = await getOfflineDbModule();
        const db = await offlineDb.getDatabase();

        // Run archive immediately on startup
        await archiveModule.scheduleArchive(db);

        // Schedule daily at 2 AM
        await archiveModule.scheduleArchiveDaily(db, 2);
      } catch (error) {
        console.error('[DataContext] Failed to schedule archive:', error);
        // Non-fatal - app continues even if archive fails
      }
    };

    scheduleArchiveAsync();
  }, []); // Run once on mount

  // Debounced localStorage persistence
  // WORKSPACE_ISOLATED_STORAGE: When feature flag is enabled, uses workspace-scoped keys
  const saveToLocalStorage = useCallback(async () => {
    // Get workspace-scoped keys (falls back to base keys when isolation disabled)
    const jobsKey = getWorkspaceStorageKey(STORAGE_KEYS.jobs, workspaceId);
    const clientsKey = getWorkspaceStorageKey(STORAGE_KEYS.clients, workspaceId);
    const techsKey = getWorkspaceStorageKey(STORAGE_KEYS.technicians, workspaceId);
    const invoicesKey = getWorkspaceStorageKey(STORAGE_KEYS.invoices, workspaceId);
    const templatesKey = getWorkspaceStorageKey(STORAGE_KEYS.templates, workspaceId);

    try {
      // Try to save all items, using safeSetItem which detects QuotaExceededError
      // and notifies subscribers via onQuotaExceeded callback
      const jobsSaved = await safeSetItem(jobsKey, JSON.stringify(jobs));
      const clientsSaved = await safeSetItem(clientsKey, JSON.stringify(clients));
      const techsSaved = await safeSetItem(techsKey, JSON.stringify(technicians));
      const invoicesSaved = await safeSetItem(invoicesKey, JSON.stringify(invoices));
      const templatesSaved = await safeSetItem(templatesKey, JSON.stringify(templates));

      // If quota exceeded on jobs (largest), try removing it and saving others
      if (!jobsSaved) {
        console.warn('[DataContext] localStorage quota exceeded for jobs, freeing space');
        safeRemoveItem(jobsKey);
        // Try smaller items again
        await safeSetItem(clientsKey, JSON.stringify(clients));
        await safeSetItem(techsKey, JSON.stringify(technicians));
        await safeSetItem(invoicesKey, JSON.stringify(invoices));
        await safeSetItem(templatesKey, JSON.stringify(templates));
      } else if (!clientsSaved || !techsSaved || !invoicesSaved || !templatesSaved) {
        // Quota exceeded on smaller items - this is critical
        console.error('[DataContext] localStorage quota exceeded even after removing jobs');
      }
    } catch (err) {
      // safeSetItem already handles QuotaExceededError and notifies subscribers
      // This catch is for unexpected errors
      console.error('[DataContext] Unexpected error during localStorage save:', err);
    }
  }, [jobs, clients, technicians, invoices, templates, workspaceId]);

  const debouncedSave = useRef(debounce(saveToLocalStorage, 1000));

  useEffect(() => {
    debouncedSave.current = debounce(saveToLocalStorage, 1000);
  }, [saveToLocalStorage]);

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
  // FIX: Storage continuity - persist to Supabase (online) or Dexie queue (offline)
  const addJob = useCallback(async (job: Job) => {
    const normalizedJob = normalizeJobTechnicianId(job);

    // Ensure workspaceId is present for Dexie queryability (matches addClient/addTechnician pattern)
    const jobWithWorkspace = { ...normalizedJob, workspaceId: normalizedJob.workspaceId || workspaceId || '' };

    // Optimistic update: Always succeeds locally
    setJobs(prev => [jobWithWorkspace, ...prev]);

    // Persist to backend (non-blocking for UI)
    try {
      if (navigator.onLine && workspaceId) {
        const dbModule = await getDbModule();
        const result = await dbModule.createJob(jobWithWorkspace, workspaceId);
        if (!result.success) {
          // Backend rejected - queue for later sync
          const offlineDb = await getOfflineDbModule();
          await offlineDb.saveJobLocal({ ...jobWithWorkspace, syncStatus: 'pending' as const, lastUpdated: Date.now() });
          await offlineDb.queueAction('CREATE_JOB', { ...jobWithWorkspace, workspaceId: workspaceId || '' });
        }
      } else {
        // Offline - save to Dexie and queue for sync when online
        const offlineDb = await getOfflineDbModule();
        await offlineDb.saveJobLocal({ ...jobWithWorkspace, syncStatus: 'pending' as const, lastUpdated: Date.now() });
        await offlineDb.queueAction('CREATE_JOB', { ...jobWithWorkspace, workspaceId: workspaceId || '' });
      }
    } catch {
      // Non-blocking: Data is safe in React state + localStorage (debounced save)
      // Queue for later sync on next opportunity
      try {
        const offlineDb = await getOfflineDbModule();
        await offlineDb.saveJobLocal({ ...jobWithWorkspace, syncStatus: 'pending' as const, lastUpdated: Date.now() });
        await offlineDb.queueAction('CREATE_JOB', { ...jobWithWorkspace, workspaceId: workspaceId || '' });
      } catch {
        // Last resort: data is in React state and will be saved to localStorage
      }
    }
  }, [workspaceId]);

  const updateJob = useCallback(async (updatedJob: Job) => {
    // Sprint 2 Task 2.6: Normalize technician IDs on mutation
    const normalizedJob = normalizeJobTechnicianId(updatedJob);

    // Ensure workspaceId is present for Dexie queryability (matches addClient/addTechnician pattern)
    const jobWithWorkspace = { ...normalizedJob, workspaceId: normalizedJob.workspaceId || workspaceId || '' };

    // Optimistic update: Always succeeds locally
    setJobs(prev => prev.map(j => j.id === jobWithWorkspace.id ? jobWithWorkspace : j));

    // Persist to backend (non-blocking for UI)
    try {
      if (navigator.onLine && workspaceId) {
        const dbModule = await getDbModule();
        const result = await dbModule.updateJob(jobWithWorkspace.id, jobWithWorkspace);
        if (!result.success) {
          const offlineDb = await getOfflineDbModule();
          await offlineDb.saveJobLocal({ ...jobWithWorkspace, syncStatus: 'pending' as const, lastUpdated: Date.now() });
          await offlineDb.queueAction('UPDATE_JOB', { ...jobWithWorkspace, workspaceId: workspaceId || '' });
        }
      } else {
        const offlineDb = await getOfflineDbModule();
        await offlineDb.saveJobLocal({ ...jobWithWorkspace, syncStatus: 'pending' as const, lastUpdated: Date.now() });
        await offlineDb.queueAction('UPDATE_JOB', { ...jobWithWorkspace, workspaceId: workspaceId || '' });
      }
    } catch {
      try {
        const offlineDb = await getOfflineDbModule();
        await offlineDb.saveJobLocal({ ...jobWithWorkspace, syncStatus: 'pending' as const, lastUpdated: Date.now() });
        await offlineDb.queueAction('UPDATE_JOB', { ...jobWithWorkspace, workspaceId: workspaceId || '' });
      } catch {
        // Data is in React state and will be saved to localStorage
      }
    }
  }, [workspaceId]);

  const deleteJob = useCallback(async (id: string) => {
    // Store original job before removal (for rollback on failure)
    const originalJob = jobs.find(j => j.id === id);

    // Optimistic update: Remove from local state immediately
    setJobs(prev => prev.filter(j => j.id !== id));

    // Persist to backend
    try {
      const dbModule = await getDbModule();
      const result = await dbModule.deleteJob(id);

      if (!result.success) {
        const errorMessage = result.error || 'Failed to delete job';
        // Restore to state if delete failed (prevent duplicates)
        if (originalJob) {
          setJobs(prev => prev.some(j => j.id === id) ? prev : [...prev, originalJob]);
        }
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    } catch (err) {
      // Restore to state if network/unexpected error occurred (prevent duplicates)
      if (originalJob) {
        setJobs(prev => prev.some(j => j.id === id) ? prev : [...prev, originalJob]);
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete job';
      setError(errorMessage);
      throw err instanceof Error ? err : new Error(errorMessage);
    }
  }, [jobs]);

  // Client mutations
  // FIX: Storage continuity - persist to Supabase (online) or Dexie queue (offline)
  const addClient = useCallback(async (client: Client) => {
    // Optimistic update: Always succeeds locally
    setClients(prev => [...prev, client]);

    try {
      if (navigator.onLine && workspaceId) {
        const dbModule = await getDbModule();
        const result = await dbModule.createClient(client, workspaceId);
        if (!result.success) {
          const offlineDb = await getOfflineDbModule();
          await offlineDb.saveClientLocal({ ...client, totalJobs: client.totalJobs || 0, workspaceId, syncStatus: 'pending' as const, lastUpdated: Date.now() });
          await offlineDb.queueAction('CREATE_CLIENT', { ...client, workspaceId });
        }
      } else {
        const offlineDb = await getOfflineDbModule();
        await offlineDb.saveClientLocal({ ...client, totalJobs: client.totalJobs || 0, workspaceId: workspaceId || '', syncStatus: 'pending' as const, lastUpdated: Date.now() });
        await offlineDb.queueAction('CREATE_CLIENT', { ...client, workspaceId: workspaceId || '' });
      }
    } catch {
      try {
        const offlineDb = await getOfflineDbModule();
        await offlineDb.saveClientLocal({ ...client, totalJobs: client.totalJobs || 0, workspaceId: workspaceId || '', syncStatus: 'pending' as const, lastUpdated: Date.now() });
        await offlineDb.queueAction('CREATE_CLIENT', { ...client, workspaceId: workspaceId || '' });
      } catch {
        // Data is in React state and will be saved to localStorage
      }
    }
  }, [workspaceId]);

  const updateClient = useCallback(async (updatedClient: Client) => {
    // Optimistic update: Always succeeds locally
    setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));

    try {
      if (navigator.onLine && workspaceId) {
        const dbModule = await getDbModule();
        const result = await dbModule.updateClient(updatedClient.id, updatedClient);
        if (!result.success) {
          const offlineDb = await getOfflineDbModule();
          await offlineDb.saveClientLocal({ ...updatedClient, totalJobs: updatedClient.totalJobs || 0, workspaceId, syncStatus: 'pending' as const, lastUpdated: Date.now() });
          await offlineDb.queueAction('UPDATE_CLIENT', { ...updatedClient, workspaceId });
        }
      } else {
        const offlineDb = await getOfflineDbModule();
        await offlineDb.saveClientLocal({ ...updatedClient, totalJobs: updatedClient.totalJobs || 0, workspaceId: workspaceId || '', syncStatus: 'pending' as const, lastUpdated: Date.now() });
        await offlineDb.queueAction('UPDATE_CLIENT', { ...updatedClient, workspaceId: workspaceId || '' });
      }
    } catch {
      try {
        const offlineDb = await getOfflineDbModule();
        await offlineDb.saveClientLocal({ ...updatedClient, totalJobs: updatedClient.totalJobs || 0, workspaceId: workspaceId || '', syncStatus: 'pending' as const, lastUpdated: Date.now() });
        await offlineDb.queueAction('UPDATE_CLIENT', { ...updatedClient, workspaceId: workspaceId || '' });
      } catch {
        // Data is in React state and will be saved to localStorage
      }
    }
  }, [workspaceId]);

  const deleteClient = useCallback(async (id: string) => {
    // Store original client in case we need to restore
    const originalClient = clients.find(c => c.id === id);

    // Optimistic update: Remove from local state immediately
    setClients(prev => prev.filter(c => c.id !== id));

    // Persist to backend
    try {
      const dbModule = await getDbModule();
      const result = await dbModule.deleteClient(id);

      if (!result.success) {
        const errorMessage = result.error || 'Failed to delete client';
        // Restore to state if delete failed (prevent duplicates)
        if (originalClient) {
          setClients(prev => prev.some(c => c.id === id) ? prev : [...prev, originalClient]);
        }
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    } catch (err) {
      // Restore to state if network/unexpected error occurred (prevent duplicates)
      if (originalClient) {
        setClients(prev => prev.some(c => c.id === id) ? prev : [...prev, originalClient]);
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete client';
      setError(errorMessage);
      throw err instanceof Error ? err : new Error(errorMessage);
    }
  }, [clients]);

  // Technician mutations
  // FIX: Storage continuity - persist to Supabase (online) or Dexie queue (offline)
  const addTechnician = useCallback(async (tech: Technician) => {
    // Optimistic update: Always succeeds locally
    setTechnicians(prev => [...prev, tech]);

    try {
      if (navigator.onLine && workspaceId) {
        const dbModule = await getDbModule();
        const result = await dbModule.createTechnician(tech, workspaceId);
        if (!result.success) {
          const offlineDb = await getOfflineDbModule();
          await offlineDb.saveTechnicianLocal({ ...tech, status: tech.status || 'Available', rating: tech.rating || 0, jobsCompleted: tech.jobsCompleted || 0, workspaceId, syncStatus: 'pending' as const, lastUpdated: Date.now() });
          await offlineDb.queueAction('CREATE_TECHNICIAN', { ...tech, workspaceId });
        }
      } else {
        const offlineDb = await getOfflineDbModule();
        await offlineDb.saveTechnicianLocal({ ...tech, status: tech.status || 'Available', rating: tech.rating || 0, jobsCompleted: tech.jobsCompleted || 0, workspaceId: workspaceId || '', syncStatus: 'pending' as const, lastUpdated: Date.now() });
        await offlineDb.queueAction('CREATE_TECHNICIAN', { ...tech, workspaceId: workspaceId || '' });
      }
    } catch {
      try {
        const offlineDb = await getOfflineDbModule();
        await offlineDb.saveTechnicianLocal({ ...tech, status: tech.status || 'Available', rating: tech.rating || 0, jobsCompleted: tech.jobsCompleted || 0, workspaceId: workspaceId || '', syncStatus: 'pending' as const, lastUpdated: Date.now() });
        await offlineDb.queueAction('CREATE_TECHNICIAN', { ...tech, workspaceId: workspaceId || '' });
      } catch {
        // Data is in React state and will be saved to localStorage
      }
    }
  }, [workspaceId]);

  const updateTechnician = useCallback(async (updatedTech: Technician) => {
    // Optimistic update: Always succeeds locally
    setTechnicians(prev => prev.map(t => t.id === updatedTech.id ? updatedTech : t));

    try {
      if (navigator.onLine && workspaceId) {
        const dbModule = await getDbModule();
        const result = await dbModule.updateTechnician(updatedTech.id, updatedTech);
        if (!result.success) {
          const offlineDb = await getOfflineDbModule();
          await offlineDb.saveTechnicianLocal({ ...updatedTech, status: updatedTech.status || 'Available', rating: updatedTech.rating || 0, jobsCompleted: updatedTech.jobsCompleted || 0, workspaceId: workspaceId || '', syncStatus: 'pending' as const, lastUpdated: Date.now() });
          await offlineDb.queueAction('UPDATE_TECHNICIAN', { ...updatedTech, workspaceId: workspaceId || '' });
        }
      } else {
        const offlineDb = await getOfflineDbModule();
        await offlineDb.saveTechnicianLocal({ ...updatedTech, status: updatedTech.status || 'Available', rating: updatedTech.rating || 0, jobsCompleted: updatedTech.jobsCompleted || 0, workspaceId: workspaceId || '', syncStatus: 'pending' as const, lastUpdated: Date.now() });
        await offlineDb.queueAction('UPDATE_TECHNICIAN', { ...updatedTech, workspaceId: workspaceId || '' });
      }
    } catch {
      try {
        const offlineDb = await getOfflineDbModule();
        await offlineDb.saveTechnicianLocal({ ...updatedTech, status: updatedTech.status || 'Available', rating: updatedTech.rating || 0, jobsCompleted: updatedTech.jobsCompleted || 0, workspaceId: workspaceId || '', syncStatus: 'pending' as const, lastUpdated: Date.now() });
        await offlineDb.queueAction('UPDATE_TECHNICIAN', { ...updatedTech, workspaceId: workspaceId || '' });
      } catch {
        // Data is in React state and will be saved to localStorage
      }
    }
  }, [workspaceId]);

  const deleteTechnician = useCallback(async (id: string) => {
    // Store original technician in case we need to restore
    const originalTechnician = technicians.find(t => t.id === id);

    // Optimistic update: Remove from local state immediately
    setTechnicians(prev => prev.filter(t => t.id !== id));

    // Persist to backend
    try {
      const dbModule = await getDbModule();
      const result = await dbModule.deleteTechnician(id);

      if (!result.success) {
        const errorMessage = result.error || 'Failed to delete technician';
        // Restore to state if delete failed (prevent duplicates)
        if (originalTechnician) {
          setTechnicians(prev => prev.some(t => t.id === id) ? prev : [...prev, originalTechnician]);
        }
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    } catch (err) {
      // Restore to state if network/unexpected error occurred (prevent duplicates)
      if (originalTechnician) {
        setTechnicians(prev => prev.some(t => t.id === id) ? prev : [...prev, originalTechnician]);
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete technician';
      setError(errorMessage);
      throw err instanceof Error ? err : new Error(errorMessage);
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

  // Auto-resync on network reconnect: push queued changes then pull fresh data
  useEffect(() => {
    const handleOnline = async () => {
      try {
        // 1. Push any queued offline actions to server
        const offlineSync = await import('./offline/sync');
        await offlineSync.pushQueue();
        // 2. Pull fresh data from server
        if (workspaceId) {
          loadedWorkspaceRef.current = null;
          await loadFromSupabase(workspaceId);
        }
      } catch {
        // Non-blocking: next poll cycle or manual refresh will catch up
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [workspaceId, loadFromSupabase]);

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

    // Sync queue status
    syncStatus,

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
