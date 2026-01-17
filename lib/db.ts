import { getSupabase } from './supabase';
import type { Job, Client, Technician } from '../types';

/**
 * Database Helper Library
 *
 * Provides CRUD operations for jobs, clients, and technicians with:
 * - Workspace-scoped access via RLS
 * - Magic link generation and validation
 * - Graceful degradation to localStorage if Supabase not configured
 * - Error handling with typed results
 */

// ============================================================================
// TYPES
// ============================================================================

export interface DbResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error | string;
}

export interface MagicLinkResult {
  success: boolean;
  token?: string;
  url?: string;
  expiresAt?: string;
  error?: Error | string;
}

export interface TokenValidationResult {
  success: boolean;
  jobId?: string;
  workspaceId?: string;
  error?: Error | string;
}

// ============================================================================
// JOBS
// ============================================================================

/**
 * Create a new job in the database
 * Automatically adds workspace_id from current user session
 */
export const createJob = async (jobData: Partial<Job>): Promise<DbResult<Job>> => {
  const supabase = getSupabase();

  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured - using localStorage fallback'
    };
  }

  try {
    // Get current user's workspace
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('workspace_id')
      .eq('id', user.id)
      .single();

    if (!userProfile?.workspace_id) {
      return { success: false, error: 'User has no workspace' };
    }

    // Insert job with workspace_id
    const { data, error } = await supabase
      .from('jobs')
      .insert({
        workspace_id: userProfile.workspace_id,
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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Map database row to Job type
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
      syncStatus: 'synced',
      lastUpdated: Date.now(),
      price: data.price
    };

    return { success: true, data: job };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create job'
    };
  }
};

/**
 * Get all jobs for the current user's workspace
 */
export const getJobs = async (workspaceId: string): Promise<DbResult<Job[]>> => {
  const supabase = getSupabase();

  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured'
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

    // Map database rows to Job type
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
      syncStatus: 'synced',
      lastUpdated: new Date(row.updated_at).getTime(),
      price: row.price
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
 * Uses RLS to ensure user has access
 */
export const getJobById = async (jobId: string): Promise<DbResult<Job>> => {
  const supabase = getSupabase();

  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured'
    };
  }

  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: 'Job not found' };
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
      syncStatus: 'synced',
      lastUpdated: new Date(data.updated_at).getTime(),
      price: data.price
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
 * RLS ensures only workspace members can update
 */
export const updateJob = async (jobId: string, updates: Partial<Job>): Promise<DbResult<Job>> => {
  const supabase = getSupabase();

  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured'
    };
  }

  try {
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    // Map Job fields to database columns
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
      syncStatus: 'synced',
      lastUpdated: new Date(data.updated_at).getTime(),
      price: data.price
    };

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
 * RLS ensures only workspace members can delete
 */
export const deleteJob = async (jobId: string): Promise<DbResult<void>> => {
  const supabase = getSupabase();

  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured'
    };
  }

  try {
    const { error } = await supabase
      .from('jobs')
      .delete()
      .eq('id', jobId);

    if (error) {
      return { success: false, error: error.message };
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
// CLIENTS
// ============================================================================

/**
 * Create a new client in the database
 */
export const createClient = async (clientData: Partial<Client>): Promise<DbResult<Client>> => {
  const supabase = getSupabase();

  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured'
    };
  }

  try {
    // Get current user's workspace
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('workspace_id')
      .eq('id', user.id)
      .single();

    if (!userProfile?.workspace_id) {
      return { success: false, error: 'User has no workspace' };
    }

    const { data, error } = await supabase
      .from('clients')
      .insert({
        workspace_id: userProfile.workspace_id,
        name: clientData.name,
        email: clientData.email,
        address: clientData.address,
        created_at: new Date().toISOString()
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

    return { success: true, data: client };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create client'
    };
  }
};

/**
 * Get all clients for the current user's workspace
 */
export const getClients = async (workspaceId: string): Promise<DbResult<Client[]>> => {
  const supabase = getSupabase();

  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured'
    };
  }

  try {
    const { data, error } = await supabase
      .from('clients')
      .select(`
        *,
        jobs:jobs(count)
      `)
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
      totalJobs: row.jobs?.[0]?.count || 0
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
 * Update a client
 */
export const updateClient = async (clientId: string, updates: Partial<Client>): Promise<DbResult<Client>> => {
  const supabase = getSupabase();

  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured'
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
  const supabase = getSupabase();

  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured'
    };
  }

  try {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', clientId);

    if (error) {
      return { success: false, error: error.message };
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
 * Create a new technician in the database
 */
export const createTechnician = async (techData: Partial<Technician>): Promise<DbResult<Technician>> => {
  const supabase = getSupabase();

  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured'
    };
  }

  try {
    // Get current user's workspace
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('workspace_id')
      .eq('id', user.id)
      .single();

    if (!userProfile?.workspace_id) {
      return { success: false, error: 'User has no workspace' };
    }

    const { data, error } = await supabase
      .from('technicians')
      .insert({
        workspace_id: userProfile.workspace_id,
        name: techData.name,
        email: techData.email,
        status: techData.status || 'Available',
        created_at: new Date().toISOString()
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
      rating: 0,
      jobsCompleted: 0
    };

    return { success: true, data: technician };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create technician'
    };
  }
};

/**
 * Get all technicians for the current user's workspace
 */
export const getTechnicians = async (workspaceId: string): Promise<DbResult<Technician[]>> => {
  const supabase = getSupabase();

  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured'
    };
  }

  try {
    const { data, error } = await supabase
      .from('technicians')
      .select(`
        *,
        jobs:jobs(count)
      `)
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
      jobsCompleted: row.jobs?.[0]?.count || 0
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
 * Update a technician
 */
export const updateTechnician = async (techId: string, updates: Partial<Technician>): Promise<DbResult<Technician>> => {
  const supabase = getSupabase();

  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured'
    };
  }

  try {
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.rating !== undefined) updateData.rating = updates.rating;

    const { data, error } = await supabase
      .from('technicians')
      .update(updateData)
      .eq('id', techId)
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
      jobsCompleted: 0
    };

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
  const supabase = getSupabase();

  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured'
    };
  }

  try {
    const { error } = await supabase
      .from('technicians')
      .delete()
      .eq('id', techId);

    if (error) {
      return { success: false, error: error.message };
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
// MAGIC LINKS
// ============================================================================

/**
 * Generate a magic link token for a job
 * Returns token and full URL for sharing with technicians
 */
export const generateMagicLink = async (jobId: string): Promise<MagicLinkResult> => {
  const supabase = getSupabase();

  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured'
    };
  }

  try {
    // Call database function to generate token
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

    // Construct full URL
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/#/track/${data.token}`;

    return {
      success: true,
      token: data.token,
      url: url,
      expiresAt: data.expires_at
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
 * Returns job_id and workspace_id if valid
 */
export const validateMagicLink = async (token: string): Promise<TokenValidationResult> => {
  const supabase = getSupabase();

  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured'
    };
  }

  try {
    // Query token from database
    const { data, error } = await supabase
      .from('job_access_tokens')
      .select('job_id, workspace_id, expires_at, used_at')
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

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(data.expires_at);

    if (now > expiresAt) {
      return { success: false, error: 'This link has expired' };
    }

    // Check if job is sealed (via job query)
    const { data: job } = await supabase
      .from('jobs')
      .select('sealed_at')
      .eq('id', data.job_id)
      .single();

    if (job?.sealed_at) {
      return { success: false, error: 'This job has been sealed and can no longer be modified' };
    }

    return {
      success: true,
      jobId: data.job_id,
      workspaceId: data.workspace_id
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
 * Special RLS bypass for token-based access
 */
export const getJobByToken = async (token: string): Promise<DbResult<Job>> => {
  const supabase = getSupabase();

  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured'
    };
  }

  try {
    // First validate token
    const validation = await validateMagicLink(token);

    if (!validation.success || !validation.jobId) {
      return {
        success: false,
        error: validation.error || 'Invalid token'
      };
    }

    // Fetch job (RLS allows access via token policy)
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', validation.jobId)
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
      syncStatus: 'synced',
      lastUpdated: new Date(data.updated_at).getTime(),
      price: data.price
    };

    return { success: true, data: job };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch job'
    };
  }
};
