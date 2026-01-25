import { getSupabase } from './supabase';
import { getMagicLinkUrl } from './redirects';
import type { Job, Client, Technician } from '../types';
import { mockJobs } from '../tests/mocks/mockData';
import { requestCache, generateCacheKey } from './performanceUtils';

/**
 * Database Helper Library
 *
 * Provides CRUD operations for jobs, clients, and technicians with:
 * - Workspace-scoped access via RLS
 * - Magic link generation and validation
 * - In-memory mock DB for testing
 * - Error handling with typed results
 */

// ============================================================================
// TYPES
// ============================================================================

export interface DbResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface MagicLinkData {
  token: string;
  url: string;
  expiresAt: string;
}

export interface TokenValidationData {
  job_id: string;
  workspace_id?: string;
  is_valid: boolean;
}

// ============================================================================
// IN-MEMORY MOCK DATABASE (for testing)
// ============================================================================

let MOCK_DB_ENABLED = false;
const mockDatabase: {
  jobs: Map<string, Job>;
  clients: Map<string, Client>;
  technicians: Map<string, Technician>;
  magicLinks: Map<string, { job_id: string; workspace_id: string; expires_at: string; is_sealed: boolean }>;
} = {
  jobs: new Map(),
  clients: new Map(),
  technicians: new Map(),
  magicLinks: new Map()
};

// Initialize mock database with test data
export const initMockDatabase = () => {
  MOCK_DB_ENABLED = true;

  // Load mock jobs
  mockJobs.forEach(job => {
    mockDatabase.jobs.set(job.id, { ...job });
  });

  // Setup magic link tokens
  mockDatabase.magicLinks.set('mock-token-123', {
    job_id: 'job-1',
    workspace_id: 'workspace-123',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    is_sealed: false
  });

  mockDatabase.magicLinks.set('expired-token', {
    job_id: 'job-1',
    workspace_id: 'workspace-123',
    expires_at: new Date(Date.now() - 1000).toISOString(), // Expired
    is_sealed: false
  });

  mockDatabase.magicLinks.set('sealed-job-token', {
    job_id: 'job-4',
    workspace_id: 'workspace-123',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    is_sealed: true
  });
};

export const resetMockDatabase = () => {
  mockDatabase.jobs.clear();
  mockDatabase.clients.clear();
  mockDatabase.technicians.clear();
  mockDatabase.magicLinks.clear();
  MOCK_DB_ENABLED = false;
};

// Check if we should use mock database (for testing)
const shouldUseMockDB = () => {
  return MOCK_DB_ENABLED || process.env.NODE_ENV === 'test' || typeof (globalThis as any).vi !== 'undefined';
};

// ============================================================================
// JOBS
// ============================================================================

/**
 * Create a new job in the database
 * PERFORMANCE FIX: Now accepts workspaceId as parameter instead of calling getUser()
 *
 * @param jobData - Job data to create
 * @param workspaceId - Workspace ID (required, pass from context)
 */
export const createJob = async (jobData: Partial<Job>, workspaceId: string): Promise<DbResult<Job>> => {
  if (shouldUseMockDB()) {
    if (!workspaceId) {
      return {
        success: false,
        error: 'workspaceId is required'
      };
    }

    const newJob: Job = {
      id: crypto.randomUUID(),
      title: jobData.title || 'Untitled Job',
      client: jobData.client || '',
      clientId: jobData.clientId || '',
      technician: jobData.technician || '',
      techId: jobData.techId || '',
      status: jobData.status || 'Pending',
      date: jobData.date || new Date().toISOString().split('T')[0],
      address: jobData.address || '',
      lat: jobData.lat,
      lng: jobData.lng,
      w3w: jobData.w3w,
      notes: jobData.notes || '',
      workSummary: jobData.workSummary,
      photos: jobData.photos || [],
      signature: jobData.signature || null,
      signerName: jobData.signerName,
      signerRole: jobData.signerRole,
      safetyChecklist: jobData.safetyChecklist || [],
      siteHazards: jobData.siteHazards || [],
      completedAt: jobData.completedAt,
      templateId: jobData.templateId,
      syncStatus: jobData.syncStatus || 'synced',
      lastUpdated: jobData.lastUpdated || Date.now(),
      price: jobData.price,
      workspaceId: workspaceId,
      sealedAt: jobData.sealedAt,
      sealedBy: jobData.sealedBy,
      evidenceHash: jobData.evidenceHash,
      isSealed: !!jobData.sealedAt
    };

    mockDatabase.jobs.set(newJob.id, newJob);
    return { success: true, data: { ...newJob, workspace_id: newJob.workspaceId } as any };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured. Running in offline-only mode.'
    };
  }

  if (!workspaceId) {
    return { success: false, error: 'Workspace ID is required' };
  }

  try {

    const { data, error } = await supabase
      .from('jobs')
      .insert({
        workspace_id: workspaceId,
        title: jobData.title,
        client_name: jobData.client,
        client_id: jobData.clientId,
        technician_name: jobData.technician,
        technician_id: jobData.techId,
        status: jobData.status || 'Pending',
        scheduled_date: jobData.date,
        address: jobData.address,
        lat: jobData.lat,
        lng: jobData.lng,
        w3w: jobData.w3w,
        notes: jobData.notes,
        work_summary: jobData.workSummary,
        safety_checklist: jobData.safetyChecklist || [],
        site_hazards: jobData.siteHazards || [],
        template_id: jobData.templateId,
        price: jobData.price,
        sync_status: jobData.syncStatus || 'synced',
        last_updated: jobData.lastUpdated || Date.now(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    const job: Job = {
      id: data.id,
      title: data.title,
      client: data.client_name,
      clientId: data.client_id,
      technician: data.technician_name,
      techId: data.technician_id,
      status: data.status,
      date: data.scheduled_date,
      address: data.address,
      lat: data.lat,
      lng: data.lng,
      w3w: data.w3w,
      notes: data.notes,
      workSummary: data.work_summary,
      photos: [],
      signature: null,
      safetyChecklist: data.safety_checklist || [],
      siteHazards: data.site_hazards || [],
      templateId: data.template_id,
      syncStatus: data.sync_status || 'synced',
      lastUpdated: data.last_updated || Date.now(),
      price: data.price,
      workspaceId: data.workspace_id,
      sealedAt: data.sealed_at,
      sealedBy: data.sealed_by,
      evidenceHash: data.evidence_hash,
      isSealed: !!data.sealed_at
    };

    // Invalidate cache for jobs list
    requestCache.clearKey(generateCacheKey('getJobs', workspaceId));

    return { success: true, data: job };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create job'
    };
  }
};

/**
 * Get all jobs for a workspace
 * Uses request deduplication to prevent duplicate concurrent requests
 */
export const getJobs = async (workspaceId: string): Promise<DbResult<Job[]>> => {
  // Use request deduplication with 60 second cache to reduce API calls
  const cacheKey = generateCacheKey('getJobs', workspaceId);
  return requestCache.dedupe(cacheKey, () => _getJobsImpl(workspaceId), 60000);
};

/**
 * Internal implementation of getJobs
 */
const _getJobsImpl = async (workspaceId: string): Promise<DbResult<Job[]>> => {
  if (shouldUseMockDB()) {
    if (!workspaceId) {
      return {
        success: false,
        error: 'workspace_id is required'
      };
    }

    const jobs = Array.from(mockDatabase.jobs.values())
      .filter(job => job.workspaceId === workspaceId)
      .map(job => ({ ...job, workspace_id: job.workspaceId })) as any[];

    return { success: true, data: jobs };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured. Running in offline-only mode.'
    };
  }

  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    const jobs: Job[] = (data || []).map(row => ({
      id: row.id,
      title: row.title,
      client: row.client_name,
      clientId: row.client_id,
      technician: row.technician_name,
      techId: row.technician_id,
      status: row.status,
      date: row.scheduled_date,
      address: row.address,
      lat: row.lat,
      lng: row.lng,
      w3w: row.w3w,
      notes: row.notes,
      workSummary: row.work_summary,
      photos: row.photos || [],
      signature: row.signature_url,
      signerName: row.signer_name,
      signerRole: row.signer_role,
      safetyChecklist: row.safety_checklist || [],
      siteHazards: row.site_hazards || [],
      completedAt: row.completed_at,
      templateId: row.template_id,
      syncStatus: row.sync_status || 'synced',
      lastUpdated: row.last_updated || new Date(row.updated_at).getTime(),
      price: row.price,
      workspaceId: row.workspace_id,
      sealedAt: row.sealed_at,
      sealedBy: row.sealed_by,
      evidenceHash: row.evidence_hash,
      isSealed: !!row.sealed_at
    }));

    return { success: true, data: jobs };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch jobs'
    };
  }
};

/**
 * Get a single job by ID
 * Uses request deduplication to prevent duplicate concurrent requests
 */
export const getJob = async (jobId: string, workspaceId: string): Promise<DbResult<Job>> => {
  // Use request deduplication with 30 second cache to reduce API calls
  const cacheKey = generateCacheKey('getJob', jobId, workspaceId);
  return requestCache.dedupe(cacheKey, () => _getJobImpl(jobId, workspaceId), 30000);
};

/**
 * Internal implementation of getJob
 */
const _getJobImpl = async (jobId: string, workspaceId: string): Promise<DbResult<Job>> => {
  if (shouldUseMockDB()) {
    const job = mockDatabase.jobs.get(jobId);

    if (!job) {
      return {
        success: false,
        error: 'Job not found'
      };
    }

    if (job.workspaceId !== workspaceId) {
      return {
        success: false,
        error: 'Job not found'
      };
    }

    return { success: true, data: job };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured. Running in offline-only mode.'
    };
  }

  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .eq('workspace_id', workspaceId)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    const job: Job = {
      id: data.id,
      title: data.title,
      client: data.client_name,
      clientId: data.client_id,
      technician: data.technician_name,
      techId: data.technician_id,
      status: data.status,
      date: data.scheduled_date,
      address: data.address,
      lat: data.lat,
      lng: data.lng,
      w3w: data.w3w,
      notes: data.notes,
      workSummary: data.work_summary,
      photos: data.photos || [],
      signature: data.signature_url,
      signerName: data.signer_name,
      signerRole: data.signer_role,
      safetyChecklist: data.safety_checklist || [],
      siteHazards: data.site_hazards || [],
      completedAt: data.completed_at,
      templateId: data.template_id,
      syncStatus: data.sync_status || 'synced',
      lastUpdated: data.last_updated || new Date(data.updated_at).getTime(),
      price: data.price,
      workspaceId: data.workspace_id,
      sealedAt: data.sealed_at,
      sealedBy: data.sealed_by,
      evidenceHash: data.evidence_hash,
      isSealed: !!data.sealed_at
    };

    return { success: true, data: job };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch job'
    };
  }
};

/**
 * Update an existing job
 */
export const updateJob = async (jobId: string, updates: Partial<Job>): Promise<DbResult<Job>> => {
  if (shouldUseMockDB()) {
    const job = mockDatabase.jobs.get(jobId);

    if (!job) {
      return {
        success: false,
        error: 'Job not found'
      };
    }

    if (job.sealedAt) {
      return {
        success: false,
        error: 'Cannot update a sealed job'
      };
    }

    const updatedJob = {
      ...job,
      ...updates,
      lastUpdated: Date.now()
    };

    mockDatabase.jobs.set(jobId, updatedJob);
    return { success: true, data: updatedJob };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured. Running in offline-only mode.'
    };
  }

  try {
    const { data: existingJob, error: fetchError } = await supabase
      .from('jobs')
      .select('sealed_at')
      .eq('id', jobId)
      .single();

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    if (existingJob?.sealed_at) {
      return { success: false, error: 'Cannot update a sealed job' };
    }

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.client !== undefined) updateData.client_name = updates.client;
    if (updates.clientId !== undefined) updateData.client_id = updates.clientId;
    if (updates.technician !== undefined) updateData.technician_name = updates.technician;
    if (updates.techId !== undefined) updateData.technician_id = updates.techId;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.date !== undefined) updateData.scheduled_date = updates.date;
    if (updates.address !== undefined) updateData.address = updates.address;
    if (updates.lat !== undefined) updateData.lat = updates.lat;
    if (updates.lng !== undefined) updateData.lng = updates.lng;
    if (updates.w3w !== undefined) updateData.w3w = updates.w3w;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.workSummary !== undefined) updateData.work_summary = updates.workSummary;
    if (updates.photos !== undefined) updateData.photos = updates.photos;
    if (updates.signature !== undefined) updateData.signature_url = updates.signature;
    if (updates.signerName !== undefined) updateData.signer_name = updates.signerName;
    if (updates.signerRole !== undefined) updateData.signer_role = updates.signerRole;
    if (updates.safetyChecklist !== undefined) updateData.safety_checklist = updates.safetyChecklist;
    if (updates.siteHazards !== undefined) updateData.site_hazards = updates.siteHazards;
    if (updates.completedAt !== undefined) updateData.completed_at = updates.completedAt;
    if (updates.templateId !== undefined) updateData.template_id = updates.templateId;
    if (updates.price !== undefined) updateData.price = updates.price;
    if (updates.syncStatus !== undefined) updateData.sync_status = updates.syncStatus;
    if (updates.lastUpdated !== undefined) updateData.last_updated = updates.lastUpdated;

    // Security: Prevent updating seal-related fields directly. 
    // These must be set via the seal-evidence Edge Function.
    // if (updates.sealedAt !== undefined) updateData.sealed_at = updates.sealedAt;
    // if (updates.sealedBy !== undefined) updateData.sealed_by = updates.sealedBy;
    // if (updates.evidenceHash !== undefined) updateData.evidence_hash = updates.evidenceHash;

    const { data, error } = await supabase
      .from('jobs')
      .update(updateData)
      .eq('id', jobId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    const job: Job = {
      id: data.id,
      title: data.title,
      client: data.client_name,
      clientId: data.client_id,
      technician: data.technician_name,
      techId: data.technician_id,
      status: data.status,
      date: data.scheduled_date,
      address: data.address,
      lat: data.lat,
      lng: data.lng,
      w3w: data.w3w,
      notes: data.notes,
      workSummary: data.work_summary,
      photos: data.photos || [],
      signature: data.signature_url,
      signerName: data.signer_name,
      signerRole: data.signer_role,
      safetyChecklist: data.safety_checklist || [],
      siteHazards: data.site_hazards || [],
      completedAt: data.completed_at,
      templateId: data.template_id,
      syncStatus: data.sync_status || 'synced',
      lastUpdated: data.last_updated || new Date(data.updated_at).getTime(),
      price: data.price,
      workspaceId: data.workspace_id,
      sealedAt: data.sealed_at,
      sealedBy: data.sealed_by,
      evidenceHash: data.evidence_hash,
      isSealed: !!data.sealed_at
    };

    // Invalidate cache for jobs list and individual job
    requestCache.clearKey(generateCacheKey('getJobs', data.workspace_id));
    requestCache.clearKey(generateCacheKey('getJob', jobId, data.workspace_id));

    return { success: true, data: job };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update job'
    };
  }
};

/**
 * Delete a job
 */
export const deleteJob = async (jobId: string): Promise<DbResult<void>> => {
  if (shouldUseMockDB()) {
    const job = mockDatabase.jobs.get(jobId);

    if (!job) {
      return {
        success: false,
        error: 'Job not found'
      };
    }

    if (job.sealedAt) {
      return {
        success: false,
        error: 'Cannot delete a sealed job'
      };
    }

    mockDatabase.jobs.delete(jobId);
    return { success: true };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured. Running in offline-only mode.'
    };
  }

  try {
    // Fetch job first to get workspace_id for cache invalidation
    const { data: jobData } = await supabase
      .from('jobs')
      .select('workspace_id')
      .eq('id', jobId)
      .single();

    const { error } = await supabase
      .from('jobs')
      .delete()
      .eq('id', jobId);

    if (error) {
      return { success: false, error: error.message };
    }

    // Invalidate cache if we have workspace_id
    if (jobData?.workspace_id) {
      requestCache.clearKey(generateCacheKey('getJobs', jobData.workspace_id));
      requestCache.clearKey(generateCacheKey('getJob', jobId, jobData.workspace_id));
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete job'
    };
  }
};

// ============================================================================
// MAGIC LINKS
// ============================================================================

/**
 * Generate a magic link token for a job
 */
export const generateMagicLink = async (jobId: string): Promise<DbResult<MagicLinkData>> => {
  if (shouldUseMockDB()) {
    const job = mockDatabase.jobs.get(jobId);

    if (!job) {
      return {
        success: false,
        error: 'Job not found'
      };
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const url = getMagicLinkUrl(token, jobId);

    mockDatabase.magicLinks.set(token, {
      job_id: jobId,
      workspace_id: job.workspaceId || 'workspace-123',
      expires_at: expiresAt,
      is_sealed: !!job.sealedAt
    });

    return {
      success: true,
      data: {
        token,
        url,
        expiresAt
      }
    };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured. Running in offline-only mode.'
    };
  }

  try {
    const { data, error } = await supabase
      .rpc('generate_job_access_token', {
        p_job_id: jobId
      });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: 'Failed to generate token' };
    }

    const url = getMagicLinkUrl(data.token, jobId);

    return {
      success: true,
      data: {
        token: data.token,
        url: url,
        expiresAt: data.expires_at
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate magic link'
    };
  }
};

/**
 * Store a magic link locally (for offline/local-only mode)
 * This creates a token and stores the mapping directly in mockDatabase
 * Use this when the database is unavailable but you need a working magic link
 */
export const storeMagicLinkLocal = (jobId: string, workspaceId: string = 'local'): MagicLinkData => {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days for local links
  const url = getMagicLinkUrl(token, jobId);

  // Store in mockDatabase for later validation
  mockDatabase.magicLinks.set(token, {
    job_id: jobId,
    workspace_id: workspaceId,
    expires_at: expiresAt,
    is_sealed: false
  });

  // Also persist to localStorage for survival across page refreshes
  try {
    const localLinks = JSON.parse(localStorage.getItem('jobproof_magic_links') || '{}');
    localLinks[token] = {
      job_id: jobId,
      workspace_id: workspaceId,
      expires_at: expiresAt,
      is_sealed: false
    };
    localStorage.setItem('jobproof_magic_links', JSON.stringify(localLinks));
  } catch (e) {
    console.warn('Failed to persist magic link to localStorage:', e);
  }

  return { token, url, expiresAt };
};

/**
 * Load magic links from localStorage into mockDatabase on startup
 * Call this during app initialization
 */
export const loadMagicLinksFromStorage = (): void => {
  try {
    const localLinks = JSON.parse(localStorage.getItem('jobproof_magic_links') || '{}');
    const now = new Date();

    Object.entries(localLinks).forEach(([token, data]: [string, any]) => {
      // Only load non-expired links
      if (new Date(data.expires_at) > now) {
        mockDatabase.magicLinks.set(token, data);
      }
    });
  } catch (e) {
    console.warn('Failed to load magic links from localStorage:', e);
  }
};

/**
 * Validate a magic link token
 * Checks mockDatabase first, then localStorage, then Supabase
 */
export const validateMagicLink = async (token: string): Promise<DbResult<TokenValidationData>> => {
  // Helper function to validate link data
  const validateLinkData = (linkData: { job_id: string; workspace_id: string; expires_at: string; is_sealed: boolean }): DbResult<TokenValidationData> => {
    const now = new Date();
    const expiresAt = new Date(linkData.expires_at);

    if (now > expiresAt) {
      return { success: false, error: 'Token expired' };
    }

    if (linkData.is_sealed) {
      return { success: false, error: 'This job has been sealed and can no longer be modified' };
    }

    return {
      success: true,
      data: {
        job_id: linkData.job_id,
        workspace_id: linkData.workspace_id,
        is_valid: true
      }
    };
  };

  // 1. Check mockDatabase first (includes pre-loaded localStorage links)
  let linkData = mockDatabase.magicLinks.get(token);
  if (linkData) {
    return validateLinkData(linkData);
  }

  // 2. Check localStorage directly (in case not yet loaded into mockDatabase)
  try {
    const localLinks = JSON.parse(localStorage.getItem('jobproof_magic_links') || '{}');
    if (localLinks[token]) {
      // Add to mockDatabase for faster subsequent lookups
      mockDatabase.magicLinks.set(token, localLinks[token]);
      return validateLinkData(localLinks[token]);
    }
  } catch (e) {
    console.warn('Failed to check localStorage for magic link:', e);
  }

  // 3. If in mock mode and not found anywhere local, token is invalid
  if (shouldUseMockDB()) {
    return { success: false, error: 'Invalid token' };
  }

  // 4. Try Supabase
  const supabase = getSupabase();
  if (!supabase) {
    return {
      success: false,
      error: 'Token not found locally and Supabase not configured.'
    };
  }

  try {
    const { data, error } = await supabase
      .from('job_access_tokens')
      .select('job_id, expires_at, used_at')
      .eq('token', token)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: false, error: 'Invalid or expired link' };
      }
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: 'Invalid or expired link' };
    }

    const now = new Date();
    const expiresAt = new Date(data.expires_at);

    if (now > expiresAt) {
      return { success: false, error: 'This link has expired' };
    }

    const { data: job } = await supabase
      .from('jobs')
      .select('sealed_at, workspace_id')
      .eq('id', data.job_id)
      .single();

    if (job?.sealed_at) {
      return { success: false, error: 'This job has been sealed and can no longer be modified' };
    }

    return {
      success: true,
      data: {
        job_id: data.job_id,
        workspace_id: job?.workspace_id,
        is_valid: true
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to validate token'
    };
  }
};

// ============================================================================
// MAGIC LINK MANAGEMENT - Revoke, Reassign, Extend, Status
// ============================================================================

/**
 * Link expiration duration constants (in milliseconds)
 */
export const LINK_EXPIRATION = {
  SHORT: 24 * 60 * 60 * 1000,        // 24 hours
  STANDARD: 7 * 24 * 60 * 60 * 1000, // 7 days (default)
  EXTENDED: 30 * 24 * 60 * 60 * 1000, // 30 days
  LONG: 90 * 24 * 60 * 60 * 1000,    // 90 days
  UNTIL_COMPLETE: null,               // No expiration until job is sealed
} as const;

export type LinkStatus = 'active' | 'expired' | 'revoked' | 'used' | 'sealed';

/**
 * Link Lifecycle Stages for tracking/notifications
 * SENT → DELIVERED → OPENED → JOB_STARTED → JOB_COMPLETED → REPORT_SENT
 */
export type LinkLifecycleStage =
  | 'sent'           // Link created and shared
  | 'delivered'      // Confirmed delivered (SMS/email callback)
  | 'opened'         // Technician clicked the link
  | 'job_started'    // Technician started working (photos added)
  | 'job_completed'  // Job sealed/submitted
  | 'report_sent';   // Report shared with client

export interface MagicLinkInfo {
  token: string;
  job_id: string;
  workspace_id: string;
  expires_at: string;
  status: LinkStatus;
  created_at?: string;
  first_accessed_at?: string;
  revoked_at?: string;
  assigned_to_tech_id?: string;

  // Lifecycle tracking (Phase: Link Notifications)
  lifecycle_stage?: LinkLifecycleStage;
  sent_at?: string;              // When link was shared/dispatched
  sent_via?: 'sms' | 'email' | 'qr' | 'copy' | 'share';  // How it was sent
  delivered_at?: string;         // Delivery confirmation (if available)
  job_started_at?: string;       // When first photo was added
  job_completed_at?: string;     // When job was sealed/submitted
  report_sent_at?: string;       // When report was shared with client

  // Alert tracking
  flagged_at?: string;           // When flagged for attention (e.g., 2hr threshold)
  flag_reason?: string;          // Why it was flagged
  flag_acknowledged_at?: string; // When manager acknowledged the flag
  creator_user_id?: string;      // Who created the job (for notifications)
}

// Alert threshold constants
export const LINK_ALERT_THRESHOLDS = {
  UNOPENED_WARNING: 2 * 60 * 60 * 1000,    // 2 hours - flag if not opened
  UNOPENED_URGENT: 4 * 60 * 60 * 1000,     // 4 hours - urgent flag
  STALE_JOB: 24 * 60 * 60 * 1000,          // 24 hours - job started but not completed
} as const;

/**
 * Revoke a specific magic link token
 * The link will no longer be valid for access
 */
export const revokeMagicLink = (token: string): DbResult<void> => {
  // Check if token exists
  const linkData = mockDatabase.magicLinks.get(token);
  if (!linkData) {
    // Also check localStorage
    try {
      const localLinks = JSON.parse(localStorage.getItem('jobproof_magic_links') || '{}');
      if (!localLinks[token]) {
        return { success: false, error: 'Token not found' };
      }
      // Remove from localStorage
      delete localLinks[token];
      localStorage.setItem('jobproof_magic_links', JSON.stringify(localLinks));
    } catch (e) {
      return { success: false, error: 'Failed to revoke token from localStorage' };
    }
  }

  // Remove from mockDatabase
  mockDatabase.magicLinks.delete(token);

  // Also remove from localStorage
  try {
    const localLinks = JSON.parse(localStorage.getItem('jobproof_magic_links') || '{}');
    if (localLinks[token]) {
      delete localLinks[token];
      localStorage.setItem('jobproof_magic_links', JSON.stringify(localLinks));
    }
  } catch (e) {
    console.warn('Failed to remove revoked token from localStorage:', e);
  }

  console.log(`[MagicLink] Revoked token: ${token.substring(0, 8)}...`);
  return { success: true };
};

/**
 * Revoke all magic links for a specific job
 * Use this before reassigning to a different technician
 */
export const revokeAllLinksForJob = (jobId: string): DbResult<{ revokedCount: number }> => {
  let revokedCount = 0;

  // Find and remove from mockDatabase
  const tokensToRemove: string[] = [];
  mockDatabase.magicLinks.forEach((data, token) => {
    if (data.job_id === jobId) {
      tokensToRemove.push(token);
    }
  });

  tokensToRemove.forEach(token => {
    mockDatabase.magicLinks.delete(token);
    revokedCount++;
  });

  // Also clean up localStorage
  try {
    const localLinks = JSON.parse(localStorage.getItem('jobproof_magic_links') || '{}');
    let localRevokedCount = 0;
    Object.entries(localLinks).forEach(([token, data]: [string, any]) => {
      if (data.job_id === jobId) {
        delete localLinks[token];
        localRevokedCount++;
      }
    });
    localStorage.setItem('jobproof_magic_links', JSON.stringify(localLinks));
    revokedCount = Math.max(revokedCount, localRevokedCount);
  } catch (e) {
    console.warn('Failed to revoke tokens from localStorage:', e);
  }

  console.log(`[MagicLink] Revoked ${revokedCount} links for job ${jobId}`);
  return { success: true, data: { revokedCount } };
};

/**
 * Regenerate magic link for a job
 * This revokes all existing links and creates a new one
 * Use for reassignment or when a link needs to be refreshed
 */
export const regenerateMagicLink = (
  jobId: string,
  workspaceId: string,
  options?: {
    expirationMs?: number | null; // null = no expiration until sealed
    techId?: string; // Track which technician this link is for
  }
): DbResult<MagicLinkData> => {
  // Revoke all existing links for this job
  revokeAllLinksForJob(jobId);

  // Generate new token
  const token = crypto.randomUUID();
  const expirationMs = options?.expirationMs ?? LINK_EXPIRATION.STANDARD;
  const expiresAt = expirationMs === null
    ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year as "no expiration"
    : new Date(Date.now() + expirationMs).toISOString();

  const url = getMagicLinkUrl(token, jobId);

  const linkData = {
    job_id: jobId,
    workspace_id: workspaceId,
    expires_at: expiresAt,
    is_sealed: false,
    created_at: new Date().toISOString(),
    assigned_to_tech_id: options?.techId,
  };

  // Store in mockDatabase
  mockDatabase.magicLinks.set(token, linkData);

  // Persist to localStorage
  try {
    const localLinks = JSON.parse(localStorage.getItem('jobproof_magic_links') || '{}');
    localLinks[token] = linkData;
    localStorage.setItem('jobproof_magic_links', JSON.stringify(localLinks));
  } catch (e) {
    console.warn('Failed to persist regenerated magic link:', e);
  }

  console.log(`[MagicLink] Regenerated link for job ${jobId}: ${token.substring(0, 8)}...`);
  return {
    success: true,
    data: { token, url, expiresAt }
  };
};

/**
 * Extend the expiration of an existing magic link
 */
export const extendMagicLinkExpiration = (
  token: string,
  additionalMs: number = LINK_EXPIRATION.STANDARD
): DbResult<{ newExpiresAt: string }> => {
  // Check mockDatabase
  let linkData = mockDatabase.magicLinks.get(token);

  // If not in mockDatabase, check localStorage
  if (!linkData) {
    try {
      const localLinks = JSON.parse(localStorage.getItem('jobproof_magic_links') || '{}');
      if (localLinks[token]) {
        linkData = localLinks[token];
      }
    } catch (e) {
      // Ignore
    }
  }

  if (!linkData) {
    return { success: false, error: 'Token not found' };
  }

  // Calculate new expiration (extend from now, not from old expiration)
  const newExpiresAt = new Date(Date.now() + additionalMs).toISOString();

  // Update mockDatabase
  mockDatabase.magicLinks.set(token, { ...linkData, expires_at: newExpiresAt });

  // Update localStorage
  try {
    const localLinks = JSON.parse(localStorage.getItem('jobproof_magic_links') || '{}');
    if (localLinks[token]) {
      localLinks[token] = { ...localLinks[token], expires_at: newExpiresAt };
      localStorage.setItem('jobproof_magic_links', JSON.stringify(localLinks));
    }
  } catch (e) {
    console.warn('Failed to update localStorage:', e);
  }

  console.log(`[MagicLink] Extended token ${token.substring(0, 8)}... to ${newExpiresAt}`);
  return { success: true, data: { newExpiresAt } };
};

/**
 * Get all active magic links for a job
 */
export const getMagicLinksForJob = (jobId: string): MagicLinkInfo[] => {
  const links: MagicLinkInfo[] = [];
  const now = new Date();

  // Check mockDatabase
  mockDatabase.magicLinks.forEach((data, token) => {
    if (data.job_id === jobId) {
      const expiresAt = new Date(data.expires_at);
      let status: LinkStatus = 'active';

      if (data.is_sealed) {
        status = 'sealed';
      } else if (now > expiresAt) {
        status = 'expired';
      }

      links.push({
        token,
        job_id: data.job_id,
        workspace_id: data.workspace_id,
        expires_at: data.expires_at,
        status,
        created_at: (data as any).created_at,
        first_accessed_at: (data as any).first_accessed_at,
        assigned_to_tech_id: (data as any).assigned_to_tech_id,
      });
    }
  });

  // Also check localStorage for any not yet loaded
  try {
    const localLinks = JSON.parse(localStorage.getItem('jobproof_magic_links') || '{}');
    Object.entries(localLinks).forEach(([token, data]: [string, any]) => {
      if (data.job_id === jobId && !links.find(l => l.token === token)) {
        const expiresAt = new Date(data.expires_at);
        let status: LinkStatus = 'active';

        if (data.is_sealed) {
          status = 'sealed';
        } else if (now > expiresAt) {
          status = 'expired';
        }

        links.push({
          token,
          job_id: data.job_id,
          workspace_id: data.workspace_id,
          expires_at: data.expires_at,
          status,
          created_at: data.created_at,
          first_accessed_at: data.first_accessed_at,
          assigned_to_tech_id: data.assigned_to_tech_id,
        });
      }
    });
  } catch (e) {
    // Ignore
  }

  return links;
};

/**
 * Get detailed status of a magic link
 */
export const getMagicLinkStatus = (token: string): DbResult<MagicLinkInfo> => {
  let linkData = mockDatabase.magicLinks.get(token);

  if (!linkData) {
    try {
      const localLinks = JSON.parse(localStorage.getItem('jobproof_magic_links') || '{}');
      if (localLinks[token]) {
        linkData = localLinks[token];
      }
    } catch (e) {
      // Ignore
    }
  }

  if (!linkData) {
    return { success: false, error: 'Token not found' };
  }

  const now = new Date();
  const expiresAt = new Date(linkData.expires_at);
  let status: LinkStatus = 'active';

  if (linkData.is_sealed) {
    status = 'sealed';
  } else if (now > expiresAt) {
    status = 'expired';
  }

  return {
    success: true,
    data: {
      token,
      job_id: linkData.job_id,
      workspace_id: linkData.workspace_id,
      expires_at: linkData.expires_at,
      status,
      created_at: (linkData as any).created_at,
      first_accessed_at: (linkData as any).first_accessed_at,
      assigned_to_tech_id: (linkData as any).assigned_to_tech_id,
    }
  };
};

/**
 * Record that a magic link was accessed
 * Call this when a technician opens a job via magic link
 * Phase 11: Also updates Job.technicianLinkOpened flag for easy filtering
 */
export const recordMagicLinkAccess = (token: string): void => {
  let linkData = mockDatabase.magicLinks.get(token);

  // Also check localStorage if not in mockDatabase
  if (!linkData) {
    try {
      const localLinks = JSON.parse(localStorage.getItem('jobproof_magic_links') || '{}');
      if (localLinks[token]) {
        linkData = localLinks[token];
      }
    } catch (e) {
      // Ignore
    }
  }

  if (linkData && !(linkData as any).first_accessed_at) {
    const now = new Date().toISOString();
    const updatedData = {
      ...linkData,
      first_accessed_at: now,
      lifecycle_stage: 'opened' as LinkLifecycleStage,
      // Clear any flags since link was opened
      flag_acknowledged_at: (linkData as any).flagged_at ? now : undefined,
    };
    mockDatabase.magicLinks.set(token, updatedData);

    // Update localStorage for magic links
    try {
      const localLinks = JSON.parse(localStorage.getItem('jobproof_magic_links') || '{}');
      localLinks[token] = updatedData;
      localStorage.setItem('jobproof_magic_links', JSON.stringify(localLinks));
    } catch (e) {
      // Ignore
    }

    // Phase 11: Update Job.technicianLinkOpened flag for easy query filtering
    const jobId = (linkData as any).job_id;
    if (jobId) {
      try {
        const jobs = JSON.parse(localStorage.getItem('jobproof_jobs_v2') || '[]');
        const jobIndex = jobs.findIndex((j: any) => j.id === jobId);
        if (jobIndex !== -1) {
          jobs[jobIndex].technicianLinkOpened = true;
          jobs[jobIndex].technicianLinkOpenedAt = now;
          localStorage.setItem('jobproof_jobs_v2', JSON.stringify(jobs));
          console.log(`[MagicLink] Updated job ${jobId} with technicianLinkOpened=true`);
        }
      } catch (e) {
        console.warn('[MagicLink] Failed to update job technicianLinkOpened flag:', e);
      }
    }

    console.log(`[MagicLink] Recorded first access for token ${token.substring(0, 8)}...`);
  }
};

// ============================================================================
// LINK LIFECYCLE TRACKING & ALERTS
// ============================================================================

/**
 * Update the lifecycle stage of a magic link
 */
export const updateLinkLifecycle = (
  token: string,
  stage: LinkLifecycleStage,
  metadata?: { sent_via?: string }
): DbResult<void> => {
  let linkData = mockDatabase.magicLinks.get(token);

  // Also check localStorage
  if (!linkData) {
    try {
      const localLinks = JSON.parse(localStorage.getItem('jobproof_magic_links') || '{}');
      if (localLinks[token]) {
        linkData = localLinks[token];
      }
    } catch (e) {
      // Ignore
    }
  }

  if (!linkData) {
    return { success: false, error: 'Token not found' };
  }

  const now = new Date().toISOString();
  const updates: Record<string, any> = {
    lifecycle_stage: stage,
  };

  // Set timestamp based on stage
  switch (stage) {
    case 'sent':
      updates.sent_at = now;
      if (metadata?.sent_via) updates.sent_via = metadata.sent_via;
      break;
    case 'delivered':
      updates.delivered_at = now;
      break;
    case 'opened':
      updates.first_accessed_at = now;
      break;
    case 'job_started':
      updates.job_started_at = now;
      break;
    case 'job_completed':
      updates.job_completed_at = now;
      break;
    case 'report_sent':
      updates.report_sent_at = now;
      break;
  }

  const updatedData = { ...linkData, ...updates };

  // Update mockDatabase
  mockDatabase.magicLinks.set(token, updatedData);

  // Update localStorage
  try {
    const localLinks = JSON.parse(localStorage.getItem('jobproof_magic_links') || '{}');
    localLinks[token] = updatedData;
    localStorage.setItem('jobproof_magic_links', JSON.stringify(localLinks));
  } catch (e) {
    console.warn('Failed to update localStorage:', e);
  }

  console.log(`[MagicLink] Updated lifecycle to ${stage} for token ${token.substring(0, 8)}...`);
  return { success: true };
};

/**
 * Mark a link as sent (after sharing via SMS, email, copy, etc.)
 */
export const markLinkAsSent = (
  token: string,
  sentVia: 'sms' | 'email' | 'qr' | 'copy' | 'share'
): DbResult<void> => {
  return updateLinkLifecycle(token, 'sent', { sent_via: sentVia });
};

/**
 * Check for links that need attention (unopened after threshold)
 * Returns links that should be flagged to the job creator
 */
export const getLinksNeedingAttention = (): MagicLinkInfo[] => {
  const now = Date.now();
  const needsAttention: MagicLinkInfo[] = [];

  // Helper to check a link
  const checkLink = (token: string, data: any) => {
    // Skip if already opened, revoked, or job is complete
    if (data.first_accessed_at || data.is_sealed || data.lifecycle_stage === 'job_completed') {
      return;
    }

    // Skip if already acknowledged
    if (data.flag_acknowledged_at) {
      return;
    }

    // Check if sent_at or created_at exists to calculate age
    const sentAt = data.sent_at || data.created_at;
    if (!sentAt) return;

    const ageMs = now - new Date(sentAt).getTime();

    // Check if past the 2-hour threshold and not expired
    const expiresAt = new Date(data.expires_at).getTime();
    if (ageMs >= LINK_ALERT_THRESHOLDS.UNOPENED_WARNING && now < expiresAt) {
      const isUrgent = ageMs >= LINK_ALERT_THRESHOLDS.UNOPENED_URGENT;

      needsAttention.push({
        token,
        job_id: data.job_id,
        workspace_id: data.workspace_id,
        expires_at: data.expires_at,
        status: 'active',
        created_at: data.created_at,
        sent_at: data.sent_at,
        sent_via: data.sent_via,
        lifecycle_stage: data.lifecycle_stage || 'sent',
        flagged_at: data.flagged_at || new Date().toISOString(),
        flag_reason: isUrgent
          ? `Link unopened for ${Math.floor(ageMs / (60 * 60 * 1000))} hours - URGENT`
          : `Link unopened for ${Math.floor(ageMs / (60 * 60 * 1000))} hours`,
        assigned_to_tech_id: data.assigned_to_tech_id,
        creator_user_id: data.creator_user_id,
      });
    }
  };

  // Check mockDatabase
  mockDatabase.magicLinks.forEach((data, token) => checkLink(token, data));

  // Check localStorage
  try {
    const localLinks = JSON.parse(localStorage.getItem('jobproof_magic_links') || '{}');
    Object.entries(localLinks).forEach(([token, data]: [string, any]) => {
      // Avoid duplicates
      if (!needsAttention.find(l => l.token === token)) {
        checkLink(token, data);
      }
    });
  } catch (e) {
    // Ignore
  }

  // Sort by age (oldest first - most urgent)
  return needsAttention.sort((a, b) => {
    const aTime = new Date(a.sent_at || a.created_at || 0).getTime();
    const bTime = new Date(b.sent_at || b.created_at || 0).getTime();
    return aTime - bTime;
  });
};

/**
 * Flag a link for manager attention
 */
export const flagLinkForAttention = (token: string, reason: string): DbResult<void> => {
  let linkData = mockDatabase.magicLinks.get(token);

  if (!linkData) {
    try {
      const localLinks = JSON.parse(localStorage.getItem('jobproof_magic_links') || '{}');
      if (localLinks[token]) {
        linkData = localLinks[token];
      }
    } catch (e) {
      // Ignore
    }
  }

  if (!linkData) {
    return { success: false, error: 'Token not found' };
  }

  const updatedData = {
    ...linkData,
    flagged_at: new Date().toISOString(),
    flag_reason: reason,
  };

  mockDatabase.magicLinks.set(token, updatedData);

  try {
    const localLinks = JSON.parse(localStorage.getItem('jobproof_magic_links') || '{}');
    localLinks[token] = updatedData;
    localStorage.setItem('jobproof_magic_links', JSON.stringify(localLinks));
  } catch (e) {
    // Ignore
  }

  console.log(`[MagicLink] Flagged token ${token.substring(0, 8)}... for attention: ${reason}`);
  return { success: true };
};

/**
 * Acknowledge a flag (manager has seen it)
 */
export const acknowledgeLinkFlag = (token: string): DbResult<void> => {
  let linkData = mockDatabase.magicLinks.get(token);

  if (!linkData) {
    try {
      const localLinks = JSON.parse(localStorage.getItem('jobproof_magic_links') || '{}');
      if (localLinks[token]) {
        linkData = localLinks[token];
      }
    } catch (e) {
      // Ignore
    }
  }

  if (!linkData) {
    return { success: false, error: 'Token not found' };
  }

  const updatedData = {
    ...linkData,
    flag_acknowledged_at: new Date().toISOString(),
  };

  mockDatabase.magicLinks.set(token, updatedData);

  try {
    const localLinks = JSON.parse(localStorage.getItem('jobproof_magic_links') || '{}');
    localLinks[token] = updatedData;
    localStorage.setItem('jobproof_magic_links', JSON.stringify(localLinks));
  } catch (e) {
    // Ignore
  }

  return { success: true };
};

/**
 * Get full lifecycle status summary for display
 */
export const getLinkLifecycleSummary = (token: string): {
  stages: { stage: LinkLifecycleStage; timestamp?: string; completed: boolean }[];
  currentStage: LinkLifecycleStage;
  needsAttention: boolean;
  flagReason?: string;
} | null => {
  let linkData = mockDatabase.magicLinks.get(token);

  if (!linkData) {
    try {
      const localLinks = JSON.parse(localStorage.getItem('jobproof_magic_links') || '{}');
      if (localLinks[token]) {
        linkData = localLinks[token];
      }
    } catch (e) {
      // Ignore
    }
  }

  if (!linkData) return null;

  const data = linkData as any;

  const stages: { stage: LinkLifecycleStage; timestamp?: string; completed: boolean }[] = [
    { stage: 'sent', timestamp: data.sent_at || data.created_at, completed: !!(data.sent_at || data.created_at) },
    { stage: 'delivered', timestamp: data.delivered_at, completed: !!data.delivered_at },
    { stage: 'opened', timestamp: data.first_accessed_at, completed: !!data.first_accessed_at },
    { stage: 'job_started', timestamp: data.job_started_at, completed: !!data.job_started_at },
    { stage: 'job_completed', timestamp: data.job_completed_at, completed: !!data.job_completed_at },
    { stage: 'report_sent', timestamp: data.report_sent_at, completed: !!data.report_sent_at },
  ];

  // Determine current stage
  let currentStage: LinkLifecycleStage = 'sent';
  for (let i = stages.length - 1; i >= 0; i--) {
    if (stages[i].completed) {
      currentStage = stages[i].stage;
      break;
    }
  }

  // Check if needs attention
  const needsAttention = !!data.flagged_at && !data.flag_acknowledged_at && !data.first_accessed_at;

  return {
    stages,
    currentStage,
    needsAttention,
    flagReason: data.flag_reason,
  };
};

/**
 * Get job by magic link token
 * Checks multiple sources: mockDatabase, localStorage, and Supabase
 */
export const getJobByToken = async (token: string): Promise<DbResult<Job>> => {
  const validation = await validateMagicLink(token);

  if (!validation.success || !validation.data) {
    return {
      success: false,
      error: validation.error || 'Invalid token'
    };
  }

  const jobId = validation.data.job_id;

  // 1. Check mockDatabase first
  const mockJob = mockDatabase.jobs.get(jobId);
  if (mockJob) {
    return { success: true, data: mockJob };
  }

  // 2. Check localStorage (where App.tsx stores jobs)
  // App.tsx uses 'jobproof_jobs_v2' as the key
  try {
    const storedJobs = localStorage.getItem('jobproof_jobs_v2');
    if (storedJobs) {
      const jobs: Job[] = JSON.parse(storedJobs);
      const localJob = jobs.find(j => j.id === jobId);
      if (localJob) {
        // Add to mockDatabase for faster future lookups
        mockDatabase.jobs.set(jobId, localJob);
        console.log(`[getJobByToken] Found job ${jobId} in localStorage`);
        return { success: true, data: localJob };
      }
    }
  } catch (e) {
    console.warn('Failed to check localStorage for job:', e);
  }

  // 3. If mock mode and not found locally, return error
  if (shouldUseMockDB()) {
    return {
      success: false,
      error: 'Job not found in local storage'
    };
  }

  // 4. Try Supabase
  const supabase = getSupabase();
  if (!supabase) {
    return {
      success: false,
      error: 'Job not found locally and Supabase not configured.'
    };
  }

  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', validation.data.job_id)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    const job: Job = {
      id: data.id,
      title: data.title,
      client: data.client_name,
      clientId: data.client_id,
      technician: data.technician_name,
      techId: data.technician_id,
      status: data.status,
      date: data.scheduled_date,
      address: data.address,
      lat: data.lat,
      lng: data.lng,
      w3w: data.w3w,
      notes: data.notes,
      workSummary: data.work_summary,
      photos: data.photos || [],
      signature: data.signature_url,
      signerName: data.signer_name,
      signerRole: data.signer_role,
      safetyChecklist: data.safety_checklist || [],
      siteHazards: data.site_hazards || [],
      completedAt: data.completed_at,
      templateId: data.template_id,
      syncStatus: data.sync_status || 'synced',
      lastUpdated: data.last_updated || new Date(data.updated_at).getTime(),
      price: data.price,
      workspaceId: data.workspace_id,
      sealedAt: data.sealed_at,
      sealedBy: data.sealed_by,
      evidenceHash: data.evidence_hash,
      isSealed: !!data.sealed_at
    };

    return { success: true, data: job };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch job'
    };
  }
};

// ============================================================================
// CLIENTS
// ============================================================================

/**
 * Get all clients for a workspace
 * Uses request deduplication to prevent duplicate concurrent requests
 */
export const getClients = async (workspaceId: string): Promise<DbResult<Client[]>> => {
  // Use request deduplication with 60 second cache to reduce API calls
  const cacheKey = generateCacheKey('getClients', workspaceId);
  return requestCache.dedupe(cacheKey, () => _getClientsImpl(workspaceId), 60000);
};

/**
 * Internal implementation of getClients
 */
const _getClientsImpl = async (workspaceId: string): Promise<DbResult<Client[]>> => {
  if (shouldUseMockDB()) {
    const clients = Array.from(mockDatabase.clients.values())
      .filter(client => (client as any).workspaceId === workspaceId);
    return { success: true, data: clients };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured. Running in offline-only mode.'
    };
  }

  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('name', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    const clients: Client[] = (data || []).map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      address: row.address,
      totalJobs: 0
    }));

    return { success: true, data: clients };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch clients'
    };
  }
};

/**
 * Create a new client
 * PERFORMANCE FIX: Now accepts workspaceId as parameter instead of calling getUser()
 *
 * @param clientData - Client data to create
 * @param workspaceId - Workspace ID (required, pass from context)
 */
export const createClient = async (clientData: Partial<Client>, workspaceId: string): Promise<DbResult<Client>> => {
  if (shouldUseMockDB()) {
    const newClient: Client = {
      id: crypto.randomUUID(),
      name: clientData.name || '',
      email: clientData.email || '',
      address: clientData.address || '',
      totalJobs: 0
    };
    mockDatabase.clients.set(newClient.id, newClient);
    return { success: true, data: newClient };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured. Running in offline-only mode.'
    };
  }

  if (!workspaceId) {
    return { success: false, error: 'Workspace ID is required' };
  }

  try {

    const { data, error } = await supabase
      .from('clients')
      .insert({
        workspace_id: workspaceId,
        name: clientData.name,
        email: clientData.email,
        address: clientData.address
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    const client: Client = {
      id: data.id,
      name: data.name,
      email: data.email,
      address: data.address,
      totalJobs: 0
    };

    // Invalidate cache for clients list
    requestCache.clearKey(generateCacheKey('getClients', workspaceId));

    return { success: true, data: client };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create client'
    };
  }
};

/**
 * Update a client
 */
export const updateClient = async (clientId: string, updates: Partial<Client>): Promise<DbResult<Client>> => {
  if (shouldUseMockDB()) {
    const client = mockDatabase.clients.get(clientId);
    if (!client) {
      return { success: false, error: 'Client not found' };
    }
    const updatedClient = { ...client, ...updates };
    mockDatabase.clients.set(clientId, updatedClient);
    return { success: true, data: updatedClient };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured. Running in offline-only mode.'
    };
  }

  try {
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.address !== undefined) updateData.address = updates.address;

    const { data, error } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', clientId)
      .select('*, workspace_id')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    const client: Client = {
      id: data.id,
      name: data.name,
      email: data.email,
      address: data.address,
      totalJobs: 0
    };

    // Invalidate cache for clients list
    if (data.workspace_id) {
      requestCache.clearKey(generateCacheKey('getClients', data.workspace_id));
    }

    return { success: true, data: client };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update client'
    };
  }
};

/**
 * Delete a client
 */
export const deleteClient = async (clientId: string): Promise<DbResult<void>> => {
  if (shouldUseMockDB()) {
    const exists = mockDatabase.clients.has(clientId);
    if (!exists) {
      return { success: false, error: 'Client not found' };
    }
    mockDatabase.clients.delete(clientId);
    return { success: true };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured. Running in offline-only mode.'
    };
  }

  try {
    // Fetch client first to get workspace_id for cache invalidation
    const { data: clientData } = await supabase
      .from('clients')
      .select('workspace_id')
      .eq('id', clientId)
      .single();

    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', clientId);

    if (error) {
      return { success: false, error: error.message };
    }

    // Invalidate cache if we have workspace_id
    if (clientData?.workspace_id) {
      requestCache.clearKey(generateCacheKey('getClients', clientData.workspace_id));
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete client'
    };
  }
};

// ============================================================================
// TECHNICIANS
// ============================================================================

/**
 * Get all technicians for a workspace
 * Uses request deduplication to prevent duplicate concurrent requests
 */
export const getTechnicians = async (workspaceId: string): Promise<DbResult<Technician[]>> => {
  // Use request deduplication with 60 second cache to reduce API calls
  const cacheKey = generateCacheKey('getTechnicians', workspaceId);
  return requestCache.dedupe(cacheKey, () => _getTechniciansImpl(workspaceId), 60000);
};

/**
 * Internal implementation of getTechnicians
 */
const _getTechniciansImpl = async (workspaceId: string): Promise<DbResult<Technician[]>> => {
  if (shouldUseMockDB()) {
    const technicians = Array.from(mockDatabase.technicians.values())
      .filter(tech => (tech as any).workspaceId === workspaceId);
    return { success: true, data: technicians };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured. Running in offline-only mode.'
    };
  }

  try {
    const { data, error } = await supabase
      .from('technicians')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('name', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    const technicians: Technician[] = (data || []).map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      status: row.status,
      rating: row.rating || 0,
      jobsCompleted: row.jobs_completed || 0
    }));

    return { success: true, data: technicians };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch technicians'
    };
  }
};

/**
 * Create a new technician
 * PERFORMANCE FIX: Now accepts workspaceId as parameter instead of calling getUser()
 *
 * @param techData - Technician data to create
 * @param workspaceId - Workspace ID (required, pass from context)
 */
export const createTechnician = async (techData: Partial<Technician>, workspaceId: string): Promise<DbResult<Technician>> => {
  if (shouldUseMockDB()) {
    const newTechnician: Technician = {
      id: crypto.randomUUID(),
      name: techData.name || '',
      email: techData.email || '',
      status: techData.status || 'Available',
      rating: techData.rating || 0,
      jobsCompleted: techData.jobsCompleted || 0
    };
    mockDatabase.technicians.set(newTechnician.id, newTechnician);
    return { success: true, data: newTechnician };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured. Running in offline-only mode.'
    };
  }

  if (!workspaceId) {
    return { success: false, error: 'Workspace ID is required' };
  }

  try {

    const { data, error } = await supabase
      .from('technicians')
      .insert({
        workspace_id: workspaceId,
        name: techData.name,
        email: techData.email,
        status: techData.status || 'Available',
        rating: techData.rating || 0,
        jobs_completed: techData.jobsCompleted || 0
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    const technician: Technician = {
      id: data.id,
      name: data.name,
      email: data.email,
      status: data.status,
      rating: data.rating || 0,
      jobsCompleted: data.jobs_completed || 0
    };

    // Invalidate cache for technicians list
    requestCache.clearKey(generateCacheKey('getTechnicians', workspaceId));

    return { success: true, data: technician };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create technician'
    };
  }
};

/**
 * Update a technician
 */
export const updateTechnician = async (techId: string, updates: Partial<Technician>): Promise<DbResult<Technician>> => {
  if (shouldUseMockDB()) {
    const technician = mockDatabase.technicians.get(techId);
    if (!technician) {
      return { success: false, error: 'Technician not found' };
    }
    const updatedTechnician = { ...technician, ...updates };
    mockDatabase.technicians.set(techId, updatedTechnician);
    return { success: true, data: updatedTechnician };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured. Running in offline-only mode.'
    };
  }

  try {
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.rating !== undefined) updateData.rating = updates.rating;
    if (updates.jobsCompleted !== undefined) updateData.jobs_completed = updates.jobsCompleted;

    const { data, error } = await supabase
      .from('technicians')
      .update(updateData)
      .eq('id', techId)
      .select('*, workspace_id')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    const technician: Technician = {
      id: data.id,
      name: data.name,
      email: data.email,
      status: data.status,
      rating: data.rating || 0,
      jobsCompleted: data.jobs_completed || 0
    };

    // Invalidate cache for technicians list
    if (data.workspace_id) {
      requestCache.clearKey(generateCacheKey('getTechnicians', data.workspace_id));
    }

    return { success: true, data: technician };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update technician'
    };
  }
};

/**
 * Delete a technician
 */
export const deleteTechnician = async (techId: string): Promise<DbResult<void>> => {
  if (shouldUseMockDB()) {
    const exists = mockDatabase.technicians.has(techId);
    if (!exists) {
      return { success: false, error: 'Technician not found' };
    }
    mockDatabase.technicians.delete(techId);
    return { success: true };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured. Running in offline-only mode.'
    };
  }

  try {
    // Fetch technician first to get workspace_id for cache invalidation
    const { data: technicianData } = await supabase
      .from('technicians')
      .select('workspace_id')
      .eq('id', techId)
      .single();

    const { error } = await supabase
      .from('technicians')
      .delete()
      .eq('id', techId);

    if (error) {
      return { success: false, error: error.message };
    }

    // Invalidate cache if we have workspace_id
    if (technicianData?.workspace_id) {
      requestCache.clearKey(generateCacheKey('getTechnicians', technicianData.workspace_id));
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete technician'
    };
  }
};

// ============================================================================
// TECHNICIAN-INITIATED JOBS & NOTIFICATIONS
// ============================================================================

import type { TechJobNotification, TechJobMetadata, ClientReceipt } from '../types';

// Re-export types for convenience
export type { TechJobNotification, TechJobMetadata, ClientReceipt } from '../types';

// In-memory notification storage (would be Supabase in production)
const techNotifications: Map<string, TechJobNotification> = new Map();

/**
 * Create a notification for managers when technician creates a job
 */
export const notifyManagerOfTechJob = (
  workspaceId: string,
  jobId: string,
  jobTitle: string,
  techId: string,
  techName: string,
  notificationType: TechJobNotification['type'] = 'tech_job_created'
): TechJobNotification => {
  const notification: TechJobNotification = {
    id: crypto.randomUUID(),
    workspace_id: workspaceId,
    job_id: jobId,
    type: notificationType,
    title: notificationType === 'tech_job_created'
      ? `New Job Created by ${techName}`
      : notificationType === 'tech_job_completed'
        ? `Job Completed by ${techName}`
        : `Job Needs Review`,
    message: notificationType === 'tech_job_created'
      ? `${techName} created a new job: "${jobTitle}". Review and approve if appropriate.`
      : notificationType === 'tech_job_completed'
        ? `${techName} has completed and sealed job: "${jobTitle}".`
        : `Job "${jobTitle}" requires your attention.`,
    created_by_tech_id: techId,
    created_by_tech_name: techName,
    created_at: new Date().toISOString(),
    is_read: false,
  };

  // Store in memory
  techNotifications.set(notification.id, notification);

  // Persist to localStorage
  try {
    const storedNotifs = JSON.parse(localStorage.getItem('jobproof_tech_notifications') || '[]');
    storedNotifs.push(notification);
    localStorage.setItem('jobproof_tech_notifications', JSON.stringify(storedNotifs));
  } catch (e) {
    console.warn('Failed to persist notification to localStorage:', e);
  }

  console.log(`[Notification] Manager notified: ${notification.title}`);
  return notification;
};

/**
 * Get all unread tech job notifications for a workspace
 */
export const getTechJobNotifications = (workspaceId: string, includeRead = false): TechJobNotification[] => {
  const notifications: TechJobNotification[] = [];

  // Load from localStorage
  try {
    const storedNotifs = JSON.parse(localStorage.getItem('jobproof_tech_notifications') || '[]');
    storedNotifs.forEach((notif: TechJobNotification) => {
      if (notif.workspace_id === workspaceId) {
        if (includeRead || !notif.is_read) {
          notifications.push(notif);
          // Also add to in-memory map for consistency
          techNotifications.set(notif.id, notif);
        }
      }
    });
  } catch (e) {
    console.warn('Failed to load notifications from localStorage:', e);
  }

  // Also check in-memory (may have notifications not yet persisted)
  techNotifications.forEach((notif) => {
    if (notif.workspace_id === workspaceId) {
      if ((includeRead || !notif.is_read) && !notifications.find(n => n.id === notif.id)) {
        notifications.push(notif);
      }
    }
  });

  // Sort by created_at descending (newest first)
  return notifications.sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
};

/**
 * Mark a tech job notification as read
 */
export const markTechNotificationRead = (notificationId: string): DbResult<void> => {
  const notif = techNotifications.get(notificationId);

  // Also check localStorage
  try {
    const storedNotifs = JSON.parse(localStorage.getItem('jobproof_tech_notifications') || '[]');
    const idx = storedNotifs.findIndex((n: TechJobNotification) => n.id === notificationId);
    if (idx >= 0) {
      storedNotifs[idx].is_read = true;
      storedNotifs[idx].read_at = new Date().toISOString();
      localStorage.setItem('jobproof_tech_notifications', JSON.stringify(storedNotifs));

      // Update in-memory too
      if (notif) {
        notif.is_read = true;
        notif.read_at = storedNotifs[idx].read_at;
      }

      return { success: true };
    }
  } catch (e) {
    console.warn('Failed to update notification in localStorage:', e);
  }

  if (!notif) {
    return { success: false, error: 'Notification not found' };
  }

  notif.is_read = true;
  notif.read_at = new Date().toISOString();
  return { success: true };
};

/**
 * Take action on a tech job notification (approve, reject, reassign)
 */
export const actionTechNotification = (
  notificationId: string,
  action: 'approved' | 'rejected' | 'reassigned',
  actionBy: string
): DbResult<void> => {
  // Update in localStorage
  try {
    const storedNotifs = JSON.parse(localStorage.getItem('jobproof_tech_notifications') || '[]');
    const idx = storedNotifs.findIndex((n: TechJobNotification) => n.id === notificationId);
    if (idx >= 0) {
      storedNotifs[idx].action_taken = action;
      storedNotifs[idx].action_at = new Date().toISOString();
      storedNotifs[idx].action_by = actionBy;
      storedNotifs[idx].is_read = true;
      storedNotifs[idx].read_at = storedNotifs[idx].read_at || new Date().toISOString();
      localStorage.setItem('jobproof_tech_notifications', JSON.stringify(storedNotifs));

      // Update in-memory
      const notif = techNotifications.get(notificationId);
      if (notif) {
        notif.action_taken = action;
        notif.action_at = storedNotifs[idx].action_at;
        notif.action_by = actionBy;
        notif.is_read = true;
      }

      console.log(`[Notification] Action ${action} taken on notification ${notificationId}`);
      return { success: true };
    }
  } catch (e) {
    console.warn('Failed to update notification action:', e);
  }

  return { success: false, error: 'Notification not found' };
};

/**
 * Generate a client receipt for a completed job (self-employed mode)
 */
export const generateClientReceipt = (job: Job): ClientReceipt => {
  const receipt: ClientReceipt = {
    id: crypto.randomUUID(),
    job_id: job.id,
    workspace_id: job.workspaceId || 'local',

    client_name: job.client,
    client_address: job.address,

    job_title: job.title,
    job_description: job.description || job.notes,
    work_date: job.date,
    work_location: job.address,
    work_location_w3w: job.w3w,

    photos_count: job.photos.length,
    has_signature: !!job.signature,
    signer_name: job.signerName,
    sealed_at: job.sealedAt,
    evidence_hash: job.evidenceHash,

    amount: job.price,
    currency: 'GBP',
    payment_status: 'pending',

    generated_at: new Date().toISOString(),
  };

  // Store locally
  try {
    const receipts = JSON.parse(localStorage.getItem('jobproof_client_receipts') || '[]');
    receipts.push(receipt);
    localStorage.setItem('jobproof_client_receipts', JSON.stringify(receipts));
  } catch (e) {
    console.warn('Failed to persist receipt:', e);
  }

  return receipt;
};

/**
 * Get client receipt for a job
 */
export const getClientReceipt = (jobId: string): ClientReceipt | null => {
  try {
    const receipts = JSON.parse(localStorage.getItem('jobproof_client_receipts') || '[]');
    return receipts.find((r: ClientReceipt) => r.job_id === jobId) || null;
  } catch (e) {
    return null;
  }
};

/**
 * Mark a client receipt as sent
 */
export const markReceiptSent = (
  receiptId: string,
  sentVia: 'email' | 'sms' | 'copy' | 'share'
): DbResult<void> => {
  try {
    const receipts = JSON.parse(localStorage.getItem('jobproof_client_receipts') || '[]');
    const idx = receipts.findIndex((r: ClientReceipt) => r.id === receiptId);
    if (idx >= 0) {
      receipts[idx].sent_at = new Date().toISOString();
      receipts[idx].sent_via = sentVia;
      localStorage.setItem('jobproof_client_receipts', JSON.stringify(receipts));
      return { success: true };
    }
    return { success: false, error: 'Receipt not found' };
  } catch (e) {
    return { success: false, error: 'Failed to update receipt' };
  }
};

/**
 * Get technician work mode from localStorage settings
 */
export const getTechnicianWorkMode = (): 'employed' | 'self_employed' => {
  try {
    return (localStorage.getItem('jobproof_work_mode') as 'employed' | 'self_employed') || 'employed';
  } catch {
    return 'employed';
  }
};

/**
 * Set technician work mode
 */
export const setTechnicianWorkMode = (mode: 'employed' | 'self_employed'): void => {
  localStorage.setItem('jobproof_work_mode', mode);
  console.log(`[WorkMode] Set to ${mode}`);
};

// Auto-init mock database if in test environment
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
  initMockDatabase();
}
