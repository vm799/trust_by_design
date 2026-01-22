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
  // Use request deduplication with 10 second cache
  const cacheKey = generateCacheKey('getJobs', workspaceId);
  return requestCache.dedupe(cacheKey, () => _getJobsImpl(workspaceId), 10000);
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
  // Use request deduplication with 5 second cache
  const cacheKey = generateCacheKey('getJob', jobId, workspaceId);
  return requestCache.dedupe(cacheKey, () => _getJobImpl(jobId, workspaceId), 5000);
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
 * Validate a magic link token
 */
export const validateMagicLink = async (token: string): Promise<DbResult<TokenValidationData>> => {
  if (shouldUseMockDB()) {
    const linkData = mockDatabase.magicLinks.get(token);

    if (!linkData) {
      return {
        success: false,
        error: 'Invalid token'
      };
    }

    const now = new Date();
    const expiresAt = new Date(linkData.expires_at);

    if (now > expiresAt) {
      return {
        success: false,
        error: 'Token expired'
      };
    }

    if (linkData.is_sealed) {
      return {
        success: false,
        error: 'This job has been sealed and can no longer be modified'
      };
    }

    return {
      success: true,
      data: {
        job_id: linkData.job_id,
        workspace_id: linkData.workspace_id,
        is_valid: true
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

/**
 * Get job by magic link token
 */
export const getJobByToken = async (token: string): Promise<DbResult<Job>> => {
  const validation = await validateMagicLink(token);

  if (!validation.success || !validation.data) {
    return {
      success: false,
      error: validation.error || 'Invalid token'
    };
  }

  if (shouldUseMockDB()) {
    const job = mockDatabase.jobs.get(validation.data.job_id);

    if (!job) {
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
  // Use request deduplication with 10 second cache
  const cacheKey = generateCacheKey('getClients', workspaceId);
  return requestCache.dedupe(cacheKey, () => _getClientsImpl(workspaceId), 10000);
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
  // Use request deduplication with 10 second cache
  const cacheKey = generateCacheKey('getTechnicians', workspaceId);
  return requestCache.dedupe(cacheKey, () => _getTechniciansImpl(workspaceId), 10000);
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

// Auto-init mock database if in test environment
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
  initMockDatabase();
}
