/**
 * Webhook Dispatcher
 *
 * General-purpose webhook system for dispatching events to third-party
 * integrations. Supports:
 * - HMAC-SHA256 signature verification
 * - Configurable event subscriptions
 * - Exponential backoff retry logic
 * - Automatic endpoint disabling after max failures
 * - Workspace-isolated endpoints
 *
 * Events: job.*, client.*, technician.*, invoice.*, evidence.*
 */

import { getSupabase, isSupabaseAvailable } from './supabase';

// ============================================================================
// TYPES
// ============================================================================

export type WebhookEvent =
  | 'job.created' | 'job.updated' | 'job.completed' | 'job.sealed' | 'job.deleted'
  | 'client.created' | 'client.updated'
  | 'technician.assigned' | 'technician.completed'
  | 'invoice.created' | 'invoice.paid'
  | 'evidence.sealed' | 'evidence.verified';

export interface WebhookEndpoint {
  id: string;
  workspace_id: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  is_active: boolean;
  description: string;
  created_at: string;
  last_triggered_at: string | null;
  failure_count: number;
  max_retries: number;
}

export interface WebhookDelivery {
  id: string;
  endpoint_id: string;
  event: WebhookEvent;
  payload: Record<string, unknown>;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  response_status: number | null;
  response_body: string | null;
  attempts: number;
  next_retry_at: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface CreateWebhookRequest {
  url: string;
  events: WebhookEvent[];
  description?: string;
  max_retries?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const ALL_WEBHOOK_EVENTS: WebhookEvent[] = [
  'job.created', 'job.updated', 'job.completed', 'job.sealed', 'job.deleted',
  'client.created', 'client.updated',
  'technician.assigned', 'technician.completed',
  'invoice.created', 'invoice.paid',
  'evidence.sealed', 'evidence.verified',
];

const RETRY_DELAYS = [5000, 30000, 120000, 600000, 3600000]; // 5s, 30s, 2m, 10m, 1h
const DEFAULT_MAX_RETRIES = 5;
const MAX_ENDPOINTS_PER_WORKSPACE = 10;

// ============================================================================
// VALIDATION
// ============================================================================

export function isValidWebhookEvent(event: string): event is WebhookEvent {
  return ALL_WEBHOOK_EVENTS.includes(event as WebhookEvent);
}

export function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// ============================================================================
// SECURITY
// ============================================================================

export function generateWebhookSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return 'whsec_' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function computeHmacSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// PAYLOAD
// ============================================================================

export function buildWebhookPayload(
  event: WebhookEvent,
  data: Record<string, unknown>,
  workspaceId: string
): Record<string, unknown> {
  return {
    id: crypto.randomUUID(),
    event,
    created_at: new Date().toISOString(),
    workspace_id: workspaceId,
    data,
  };
}

// ============================================================================
// RETRY LOGIC
// ============================================================================

export function getRetryDelay(attempt: number): number | null {
  if (attempt >= DEFAULT_MAX_RETRIES) return null;
  return RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)];
}

export function shouldDisableEndpoint(failureCount: number, maxRetries: number): boolean {
  return failureCount >= maxRetries;
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

export async function createWebhookEndpoint(
  workspaceId: string,
  request: CreateWebhookRequest
): Promise<WebhookEndpoint> {
  if (!isSupabaseAvailable()) {
    throw new Error('Database not available');
  }

  if (!isValidWebhookUrl(request.url)) {
    throw new Error('Webhook URL must use HTTPS');
  }

  for (const event of request.events) {
    if (!isValidWebhookEvent(event)) {
      throw new Error(`Invalid webhook event: ${event}`);
    }
  }

  const supabase = getSupabase()!;

  // Check endpoint limit
  const { count } = await supabase
    .from('webhook_endpoints')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('is_active', true);

  if ((count ?? 0) >= MAX_ENDPOINTS_PER_WORKSPACE) {
    throw new Error(`Maximum ${MAX_ENDPOINTS_PER_WORKSPACE} active webhook endpoints per workspace`);
  }

  const secret = generateWebhookSecret();

  const record = {
    workspace_id: workspaceId,
    url: request.url,
    events: request.events,
    secret,
    is_active: true,
    description: request.description ?? '',
    failure_count: 0,
    max_retries: request.max_retries ?? DEFAULT_MAX_RETRIES,
  };

  const { data, error } = await supabase
    .from('webhook_endpoints')
    .insert(record)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create webhook endpoint: ${error.message}`);
  }

  return data as WebhookEndpoint;
}

export async function listWebhookEndpoints(workspaceId: string): Promise<WebhookEndpoint[]> {
  if (!isSupabaseAvailable()) return [];

  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from('webhook_endpoints')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list webhook endpoints: ${error.message}`);
  }

  return (data || []) as WebhookEndpoint[];
}

export async function deleteWebhookEndpoint(
  endpointId: string,
  workspaceId: string
): Promise<void> {
  if (!isSupabaseAvailable()) {
    throw new Error('Database not available');
  }

  const supabase = getSupabase()!;
  const { error } = await supabase
    .from('webhook_endpoints')
    .delete()
    .eq('id', endpointId)
    .eq('workspace_id', workspaceId);

  if (error) {
    throw new Error(`Failed to delete webhook endpoint: ${error.message}`);
  }
}

export async function toggleWebhookEndpoint(
  endpointId: string,
  workspaceId: string,
  isActive: boolean
): Promise<void> {
  if (!isSupabaseAvailable()) {
    throw new Error('Database not available');
  }

  const supabase = getSupabase()!;
  const { error } = await supabase
    .from('webhook_endpoints')
    .update({ is_active: isActive, failure_count: isActive ? 0 : undefined })
    .eq('id', endpointId)
    .eq('workspace_id', workspaceId);

  if (error) {
    throw new Error(`Failed to toggle webhook endpoint: ${error.message}`);
  }
}

// ============================================================================
// DISPATCH
// ============================================================================

export async function dispatchWebhookEvent(
  workspaceId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  if (!isSupabaseAvailable()) return;

  const supabase = getSupabase()!;

  // Get active endpoints subscribed to this event
  const { data: endpoints, error } = await supabase
    .from('webhook_endpoints')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)
    .contains('events', [event]);

  if (error || !endpoints?.length) return;

  const payload = buildWebhookPayload(event, data, workspaceId);
  const payloadStr = JSON.stringify(payload);

  // Dispatch to each endpoint
  for (const endpoint of endpoints as WebhookEndpoint[]) {
    try {
      const signature = await computeHmacSignature(payloadStr, endpoint.secret);

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event,
          'X-Webhook-Timestamp': new Date().toISOString(),
        },
        body: payloadStr,
      });

      // Log delivery
      await supabase.from('webhook_deliveries').insert({
        endpoint_id: endpoint.id,
        event,
        payload,
        status: response.ok ? 'success' : 'failed',
        response_status: response.status,
        attempts: 1,
        completed_at: response.ok ? new Date().toISOString() : null,
      });

      if (response.ok) {
        // Reset failure count on success
        await supabase
          .from('webhook_endpoints')
          .update({ last_triggered_at: new Date().toISOString(), failure_count: 0 })
          .eq('id', endpoint.id);
      } else {
        // Increment failure count
        const newFailureCount = endpoint.failure_count + 1;
        const updates: Record<string, unknown> = { failure_count: newFailureCount };

        if (shouldDisableEndpoint(newFailureCount, endpoint.max_retries)) {
          updates.is_active = false;
        }

        await supabase
          .from('webhook_endpoints')
          .update(updates)
          .eq('id', endpoint.id);
      }
    } catch (err) {
      // Network error - log and increment failure count
      await supabase.from('webhook_deliveries').insert({
        endpoint_id: endpoint.id,
        event,
        payload,
        status: 'failed',
        response_status: null,
        response_body: err instanceof Error ? err.message : 'Network error',
        attempts: 1,
      });

      const newFailureCount = endpoint.failure_count + 1;
      const updates: Record<string, unknown> = { failure_count: newFailureCount };

      if (shouldDisableEndpoint(newFailureCount, endpoint.max_retries)) {
        updates.is_active = false;
      }

      await supabase
        .from('webhook_endpoints')
        .update(updates)
        .eq('id', endpoint.id);
    }
  }
}

export async function getWebhookDeliveries(
  endpointId: string,
  workspaceId: string,
  limit: number = 25
): Promise<WebhookDelivery[]> {
  if (!isSupabaseAvailable()) return [];

  const supabase = getSupabase()!;

  // Verify endpoint belongs to workspace
  const { data: endpoint } = await supabase
    .from('webhook_endpoints')
    .select('id')
    .eq('id', endpointId)
    .eq('workspace_id', workspaceId)
    .single();

  if (!endpoint) return [];

  const { data, error } = await supabase
    .from('webhook_deliveries')
    .select('*')
    .eq('endpoint_id', endpointId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return [];

  return (data || []) as WebhookDelivery[];
}
