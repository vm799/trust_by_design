/**
 * Audit Trail Library
 *
 * Provides client-side functions for logging audit events.
 * All logs are stored in append-only audit_logs table with workspace isolation.
 *
 * Phase: C.4 - Audit Trail
 */

import { getSupabase } from './supabase';

// ============================================================================
// TYPES
// ============================================================================

export type AuditEventType =
  | 'job_view'
  | 'job_create'
  | 'job_update'
  | 'job_delete'
  | 'photo_view'
  | 'report_export'
  | 'report_view'
  | 'seal_create'
  | 'seal_verify'
  | 'client_create'
  | 'client_update'
  | 'client_delete'
  | 'technician_create'
  | 'technician_update'
  | 'technician_delete';

export type ResourceType = 'job' | 'photo' | 'seal' | 'report' | 'client' | 'technician';

export interface AuditEvent {
  eventType: AuditEventType;
  resourceType: ResourceType;
  resourceId: string;
  metadata?: Record<string, any>;
}

export interface AuditLog {
  id: string;
  workspace_id: string;
  user_id?: string;
  event_type: AuditEventType;
  resource_type: ResourceType;
  resource_id: string;
  user_email?: string;
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface GetAuditLogsOptions {
  limit?: number;
  offset?: number;
  eventType?: AuditEventType;
  resourceType?: ResourceType;
}

export interface AuditLogsResult {
  success: boolean;
  logs?: AuditLog[];
  total?: number;
  error?: string;
}

// ============================================================================
// LOG AUDIT EVENT
// ============================================================================

/**
 * Log an audit event
 *
 * This function calls the database function log_audit_event() which:
 * - Stores event in append-only audit_logs table
 * - Captures user context (user_id, email)
 * - Associates with workspace
 * - Cannot be deleted or modified
 *
 * @param event - Audit event to log
 * @returns Promise<void> - Does not throw on error (fails silently)
 */
export const logAuditEvent = async (event: AuditEvent): Promise<void> => {
  const supabase = getSupabase();

  // Fail silently if Supabase not configured
  if (!supabase) {
    console.warn('Audit logging skipped: Supabase not configured');
    return;
  }

  try {
    // Get current user (may be null for anonymous/public access)
    const { data: { user } } = await supabase.auth.getUser();

    // Get workspace ID (required for logging)
    let workspaceId: string | null = null;

    if (user) {
      const { data: profile } = await supabase
        .from('users')
        .select('workspace_id')
        .eq('id', user.id)
        .single();

      workspaceId = profile?.workspace_id || null;
    }

    // If no workspace (e.g., public access to report), try to infer from resource
    if (!workspaceId && event.resourceType === 'job') {
      const { data: job } = await supabase
        .from('jobs')
        .select('workspace_id')
        .eq('id', event.resourceId)
        .single();

      workspaceId = job?.workspace_id || null;
    }

    // Cannot log without workspace
    if (!workspaceId) {
      console.warn('Audit logging skipped: No workspace context');
      return;
    }

    // Call database function to log event
    const { error } = await supabase.rpc('log_audit_event', {
      p_workspace_id: workspaceId,
      p_event_type: event.eventType,
      p_resource_type: event.resourceType,
      p_resource_id: event.resourceId,
      p_metadata: event.metadata || null
    });

    if (error) {
      console.error('Failed to log audit event:', error);
    }
  } catch (error) {
    // Fail silently - audit logging should never break user flow
    console.error('Audit logging error:', error);
  }
};

// ============================================================================
// GET AUDIT LOGS
// ============================================================================

/**
 * Get audit logs for the current user's workspace
 *
 * @param options - Pagination and filtering options
 * @returns AuditLogsResult with logs array and total count
 */
export const getAuditLogs = async (options: GetAuditLogsOptions = {}): Promise<AuditLogsResult> => {
  const supabase = getSupabase();

  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured'
    };
  }

  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        success: false,
        error: 'Not authenticated'
      };
    }

    // Get workspace ID
    const { data: profile } = await supabase
      .from('users')
      .select('workspace_id')
      .eq('id', user.id)
      .single();

    if (!profile?.workspace_id) {
      return {
        success: false,
        error: 'No workspace found'
      };
    }

    const {
      limit = 100,
      offset = 0,
      eventType,
      resourceType
    } = options;

    // Get audit logs via database function
    const { data: logs, error: logsError } = await supabase.rpc('get_audit_logs', {
      p_workspace_id: profile.workspace_id,
      p_limit: limit,
      p_offset: offset,
      p_event_type: eventType || null,
      p_resource_type: resourceType || null
    });

    if (logsError) {
      return {
        success: false,
        error: logsError.message
      };
    }

    // Get total count
    const { data: totalCount, error: countError } = await supabase.rpc('count_audit_logs', {
      p_workspace_id: profile.workspace_id,
      p_event_type: eventType || null,
      p_resource_type: resourceType || null
    });

    if (countError) {
      console.error('Failed to get audit log count:', countError);
    }

    return {
      success: true,
      logs: logs || [],
      total: totalCount || 0
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch audit logs'
    };
  }
};

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Format event type for display
 *
 * @param eventType - Raw event type
 * @returns Human-readable event name
 */
export const formatEventType = (eventType: AuditEventType): string => {
  const eventNames: Record<AuditEventType, string> = {
    job_view: 'Job Viewed',
    job_create: 'Job Created',
    job_update: 'Job Updated',
    job_delete: 'Job Deleted',
    photo_view: 'Photo Viewed',
    report_export: 'Report Exported',
    report_view: 'Report Viewed',
    seal_create: 'Evidence Sealed',
    seal_verify: 'Seal Verified',
    client_create: 'Client Created',
    client_update: 'Client Updated',
    client_delete: 'Client Deleted',
    technician_create: 'Technician Created',
    technician_update: 'Technician Updated',
    technician_delete: 'Technician Deleted'
  };

  return eventNames[eventType] || eventType;
};

/**
 * Get icon for event type
 *
 * @param eventType - Event type
 * @returns Material icon name
 */
export const getEventIcon = (eventType: AuditEventType): string => {
  const eventIcons: Record<AuditEventType, string> = {
    job_view: 'visibility',
    job_create: 'add_circle',
    job_update: 'edit',
    job_delete: 'delete',
    photo_view: 'photo',
    report_export: 'download',
    report_view: 'description',
    seal_create: 'lock',
    seal_verify: 'verified',
    client_create: 'person_add',
    client_update: 'person',
    client_delete: 'person_remove',
    technician_create: 'engineering',
    technician_update: 'build',
    technician_delete: 'cancel'
  };

  return eventIcons[eventType] || 'event';
};

/**
 * Get color for event type
 *
 * @param eventType - Event type
 * @returns Tailwind color class
 */
export const getEventColor = (eventType: AuditEventType): string => {
  if (eventType.endsWith('_create')) return 'text-success';
  if (eventType.endsWith('_update')) return 'text-primary';
  if (eventType.endsWith('_delete')) return 'text-danger';
  if (eventType.includes('seal')) return 'text-purple-500';
  if (eventType.includes('view')) return 'text-slate-400';
  return 'text-slate-300';
};

/**
 * Format timestamp for display
 *
 * @param timestamp - ISO timestamp
 * @returns Formatted date and time
 */
export const formatAuditTimestamp = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });
  } catch (error) {
    return timestamp;
  }
};

/**
 * Format relative time (e.g., "2 hours ago")
 *
 * @param timestamp - ISO timestamp
 * @returns Relative time string
 */
export const formatRelativeTime = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
    if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
    if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;

    return formatAuditTimestamp(timestamp);
  } catch (error) {
    return timestamp;
  }
};

// ============================================================================
// EXPORT TO CSV
// ============================================================================

/**
 * Export audit logs to CSV
 *
 * @param logs - Array of audit logs
 * @returns CSV string
 */
export const exportAuditLogsToCSV = (logs: AuditLog[]): string => {
  // CSV header
  const headers = ['Timestamp', 'Event Type', 'Resource Type', 'Resource ID', 'User', 'Metadata'];
  const rows = [headers.join(',')];

  // CSV rows
  for (const log of logs) {
    const row = [
      log.created_at,
      formatEventType(log.event_type),
      log.resource_type,
      log.resource_id,
      log.user_email || 'Anonymous',
      JSON.stringify(log.metadata || {}).replace(/"/g, '""') // Escape quotes
    ];
    rows.push(row.map(cell => `"${cell}"`).join(','));
  }

  return rows.join('\n');
};

/**
 * Download audit logs as CSV file
 *
 * @param logs - Array of audit logs
 * @param filename - Filename for download
 */
export const downloadAuditLogsCSV = (logs: AuditLog[], filename: string = 'audit-logs.csv'): void => {
  const csv = exportAuditLogsToCSV(logs);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
