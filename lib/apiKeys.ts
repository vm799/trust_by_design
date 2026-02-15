/**
 * API Key Management
 *
 * Handles creation, validation, and lifecycle management of API keys
 * for the REST API v1 integration layer.
 *
 * Security:
 * - Keys are hashed with SHA-256 before storage (raw key never persisted)
 * - Keys are scoped to workspaces (workspace isolation)
 * - Keys have configurable scopes (resource:operation)
 * - Keys support expiration dates
 * - Rate limiting per key
 */

import { getSupabase, isSupabaseAvailable } from './supabase';

// ============================================================================
// TYPES
// ============================================================================

export interface ApiKey {
  id: string;
  workspace_id: string;
  key_hash: string;
  key_prefix: string;
  name: string;
  scopes: string[];
  rate_limit: number;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  created_by: string;
}

export interface CreateApiKeyRequest {
  name: string;
  scopes: string[];
  rate_limit?: number;
  expires_at?: string | null;
}

export interface CreateApiKeyResult {
  key: ApiKey;
  rawKey: string;
}

export type ApiScope =
  | 'jobs:read' | 'jobs:write' | 'jobs:delete' | 'jobs:*'
  | 'clients:read' | 'clients:write' | 'clients:delete' | 'clients:*'
  | 'technicians:read' | 'technicians:write' | 'technicians:delete' | 'technicians:*'
  | 'invoices:read' | 'invoices:write' | 'invoices:delete' | 'invoices:*'
  | 'photos:read' | 'photos:write' | 'photos:delete' | 'photos:*'
  | 'webhooks:read' | 'webhooks:write' | 'webhooks:delete' | 'webhooks:*'
  | '*:*';

// ============================================================================
// CONSTANTS
// ============================================================================

const KEY_PREFIX = 'jp_';
const KEY_LENGTH = 48;
const DEFAULT_RATE_LIMIT = 1000;
const MAX_KEYS_PER_WORKSPACE = 10;

export const AVAILABLE_SCOPES: { label: string; value: ApiScope }[] = [
  { label: 'Read Jobs', value: 'jobs:read' },
  { label: 'Write Jobs', value: 'jobs:write' },
  { label: 'Delete Jobs', value: 'jobs:delete' },
  { label: 'Full Jobs Access', value: 'jobs:*' },
  { label: 'Read Clients', value: 'clients:read' },
  { label: 'Write Clients', value: 'clients:write' },
  { label: 'Full Clients Access', value: 'clients:*' },
  { label: 'Read Technicians', value: 'technicians:read' },
  { label: 'Read Invoices', value: 'invoices:read' },
  { label: 'Write Invoices', value: 'invoices:write' },
  { label: 'Full Invoices Access', value: 'invoices:*' },
  { label: 'Read Photos', value: 'photos:read' },
  { label: 'Manage Webhooks', value: 'webhooks:*' },
  { label: 'Full Access (Admin)', value: '*:*' },
];

// ============================================================================
// KEY GENERATION
// ============================================================================

/**
 * Generate a cryptographically random API key
 */
export function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomBytes = new Uint8Array(KEY_LENGTH);
  crypto.getRandomValues(randomBytes);
  let key = KEY_PREFIX;
  for (let i = 0; i < KEY_LENGTH - KEY_PREFIX.length; i++) {
    key += chars[randomBytes[i] % chars.length];
  }
  return key;
}

/**
 * Hash an API key using SHA-256
 */
export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate API key format
 */
export function validateApiKeyFormat(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  if (!key.startsWith(KEY_PREFIX)) return false;
  if (key.length < 40) return false;
  return /^jp_[a-zA-Z0-9_-]+$/.test(key);
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Create a new API key for a workspace
 *
 * @returns The key record AND the raw key (only shown once)
 */
export async function createApiKey(
  workspaceId: string,
  userId: string,
  request: CreateApiKeyRequest
): Promise<CreateApiKeyResult> {
  if (!isSupabaseAvailable()) {
    throw new Error('Database not available');
  }

  const supabase = getSupabase()!;

  // Check key limit
  const { count } = await supabase
    .from('api_keys')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('is_active', true);

  if ((count ?? 0) >= MAX_KEYS_PER_WORKSPACE) {
    throw new Error(`Maximum ${MAX_KEYS_PER_WORKSPACE} active API keys per workspace`);
  }

  // Generate and hash key
  const rawKey = generateApiKey();
  const keyHash = await hashApiKey(rawKey);
  const keyPrefix = rawKey.substring(0, 10) + '...';

  const record = {
    workspace_id: workspaceId,
    key_hash: keyHash,
    key_prefix: keyPrefix,
    name: request.name,
    scopes: request.scopes,
    rate_limit: request.rate_limit ?? DEFAULT_RATE_LIMIT,
    is_active: true,
    expires_at: request.expires_at ?? null,
    created_by: userId,
  };

  const { data, error } = await supabase
    .from('api_keys')
    .insert(record)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create API key: ${error.message}`);
  }

  return { key: data as ApiKey, rawKey };
}

/**
 * List all API keys for a workspace (without hashes)
 */
export async function listApiKeys(workspaceId: string): Promise<ApiKey[]> {
  if (!isSupabaseAvailable()) return [];

  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, workspace_id, key_prefix, name, scopes, rate_limit, is_active, created_at, last_used_at, expires_at, created_by')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list API keys: ${error.message}`);
  }

  return (data || []) as ApiKey[];
}

/**
 * Revoke (deactivate) an API key
 */
export async function revokeApiKey(keyId: string, workspaceId: string): Promise<void> {
  if (!isSupabaseAvailable()) {
    throw new Error('Database not available');
  }

  const supabase = getSupabase()!;
  const { error } = await supabase
    .from('api_keys')
    .update({ is_active: false })
    .eq('id', keyId)
    .eq('workspace_id', workspaceId);

  if (error) {
    throw new Error(`Failed to revoke API key: ${error.message}`);
  }
}

/**
 * Delete an API key permanently
 */
export async function deleteApiKey(keyId: string, workspaceId: string): Promise<void> {
  if (!isSupabaseAvailable()) {
    throw new Error('Database not available');
  }

  const supabase = getSupabase()!;
  const { error } = await supabase
    .from('api_keys')
    .delete()
    .eq('id', keyId)
    .eq('workspace_id', workspaceId);

  if (error) {
    throw new Error(`Failed to delete API key: ${error.message}`);
  }
}
