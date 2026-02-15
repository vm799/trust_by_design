/**
 * SSO Configuration Management
 *
 * Enterprise Single Sign-On configuration for SAML and OIDC providers.
 * Supports:
 * - SAML 2.0 (Okta, Azure AD, OneLogin)
 * - OpenID Connect (Google Workspace, Auth0)
 * - Domain-based enforcement
 * - Magic link fallback for non-SSO users
 *
 * Security:
 * - Metadata/issuer URLs must be HTTPS
 * - Client secrets stored encrypted at rest (Supabase encryption)
 * - One SSO config per workspace
 */

import { getSupabase, isSupabaseAvailable } from './supabase';

// ============================================================================
// TYPES
// ============================================================================

export type SSOProvider = 'saml' | 'oidc';

export interface SSOConfiguration {
  id: string;
  workspace_id: string;
  provider: SSOProvider;
  domain: string;
  is_active: boolean;
  metadata_url: string | null;
  entity_id: string | null;
  acs_url: string | null;
  certificate: string | null;
  client_id: string | null;
  client_secret: string | null;
  issuer_url: string | null;
  enforce_sso: boolean;
  allow_magic_link_fallback: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSSOConfigRequest {
  provider: SSOProvider;
  domain: string;
  metadata_url?: string;
  entity_id?: string;
  acs_url?: string;
  certificate?: string;
  client_id?: string;
  client_secret?: string;
  issuer_url?: string;
  enforce_sso?: boolean;
  allow_magic_link_fallback?: boolean;
}

// ============================================================================
// VALIDATION
// ============================================================================

export function isValidSSOProvider(provider: string): provider is SSOProvider {
  return provider === 'saml' || provider === 'oidc';
}

export function extractDomainFromEmail(email: string): string | null {
  const match = email.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/);
  return match ? match[1].toLowerCase() : null;
}

export function isValidDomain(domain: string): boolean {
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(domain);
}

export function validateSAMLConfig(config: Partial<SSOConfiguration>): string[] {
  const errors: string[] = [];
  if (!config.metadata_url && !config.entity_id) {
    errors.push('SAML requires either metadata_url or entity_id');
  }
  if (!config.domain) {
    errors.push('Domain is required');
  }
  if (config.domain && !isValidDomain(config.domain)) {
    errors.push('Invalid domain format');
  }
  if (config.metadata_url) {
    try {
      const url = new URL(config.metadata_url);
      if (url.protocol !== 'https:') {
        errors.push('Metadata URL must use HTTPS');
      }
    } catch {
      errors.push('Invalid metadata URL');
    }
  }
  return errors;
}

export function validateOIDCConfig(config: Partial<SSOConfiguration>): string[] {
  const errors: string[] = [];
  if (!config.client_id) {
    errors.push('OIDC requires client_id');
  }
  if (!config.issuer_url) {
    errors.push('OIDC requires issuer_url');
  }
  if (!config.domain) {
    errors.push('Domain is required');
  }
  if (config.domain && !isValidDomain(config.domain)) {
    errors.push('Invalid domain format');
  }
  if (config.issuer_url) {
    try {
      const url = new URL(config.issuer_url);
      if (url.protocol !== 'https:') {
        errors.push('Issuer URL must use HTTPS');
      }
    } catch {
      errors.push('Invalid issuer URL');
    }
  }
  return errors;
}

export function validateSSOConfig(config: Partial<SSOConfiguration>): string[] {
  if (!config.provider || !isValidSSOProvider(config.provider)) {
    return ['Invalid SSO provider. Must be saml or oidc'];
  }
  return config.provider === 'saml'
    ? validateSAMLConfig(config)
    : validateOIDCConfig(config);
}

export function shouldEnforceSSO(config: SSOConfiguration, email: string): boolean {
  if (!config.is_active) return false;
  if (!config.enforce_sso) return false;
  const emailDomain = extractDomainFromEmail(email);
  return emailDomain === config.domain.toLowerCase();
}

export function canUseMagicLink(config: SSOConfiguration | null, email: string): boolean {
  if (!config || !config.is_active) return true;
  if (config.allow_magic_link_fallback) return true;
  const emailDomain = extractDomainFromEmail(email);
  return emailDomain !== config.domain.toLowerCase();
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

export async function getSSOConfig(workspaceId: string): Promise<SSOConfiguration | null> {
  if (!isSupabaseAvailable()) return null;

  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from('sso_configurations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .single();

  if (error || !data) return null;
  return data as SSOConfiguration;
}

export async function createSSOConfig(
  workspaceId: string,
  request: CreateSSOConfigRequest
): Promise<SSOConfiguration> {
  if (!isSupabaseAvailable()) {
    throw new Error('Database not available');
  }

  const errors = validateSSOConfig({ ...request });
  if (errors.length > 0) {
    throw new Error(`SSO validation failed: ${errors.join(', ')}`);
  }

  const supabase = getSupabase()!;

  const record = {
    workspace_id: workspaceId,
    provider: request.provider,
    domain: request.domain.toLowerCase(),
    is_active: false,
    metadata_url: request.metadata_url ?? null,
    entity_id: request.entity_id ?? null,
    acs_url: request.acs_url ?? null,
    certificate: request.certificate ?? null,
    client_id: request.client_id ?? null,
    client_secret: request.client_secret ?? null,
    issuer_url: request.issuer_url ?? null,
    enforce_sso: request.enforce_sso ?? false,
    allow_magic_link_fallback: request.allow_magic_link_fallback ?? true,
  };

  const { data, error } = await supabase
    .from('sso_configurations')
    .upsert(record, { onConflict: 'workspace_id' })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save SSO config: ${error.message}`);
  }

  return data as SSOConfiguration;
}

export async function updateSSOConfig(
  workspaceId: string,
  updates: Partial<CreateSSOConfigRequest> & { is_active?: boolean }
): Promise<SSOConfiguration> {
  if (!isSupabaseAvailable()) {
    throw new Error('Database not available');
  }

  const supabase = getSupabase()!;

  const { data, error } = await supabase
    .from('sso_configurations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update SSO config: ${error.message}`);
  }

  return data as SSOConfiguration;
}

export async function deleteSSOConfig(workspaceId: string): Promise<void> {
  if (!isSupabaseAvailable()) {
    throw new Error('Database not available');
  }

  const supabase = getSupabase()!;
  const { error } = await supabase
    .from('sso_configurations')
    .delete()
    .eq('workspace_id', workspaceId);

  if (error) {
    throw new Error(`Failed to delete SSO config: ${error.message}`);
  }
}

/**
 * Check if an email's domain has SSO configured for any workspace
 */
export async function findSSOConfigByDomain(domain: string): Promise<SSOConfiguration | null> {
  if (!isSupabaseAvailable()) return null;

  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from('sso_configurations')
    .select('*')
    .eq('domain', domain.toLowerCase())
    .eq('is_active', true)
    .single();

  if (error || !data) return null;
  return data as SSOConfiguration;
}
