/**
 * SSO Configuration Module Tests
 *
 * Tests for enterprise SSO (SAML/OIDC) configuration validation,
 * domain extraction, and provider setup.
 */
import { describe, it, expect } from 'vitest';

// ============================================================================
// Types
// ============================================================================

type SSOProvider = 'saml' | 'oidc';

interface SSOConfiguration {
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

// ============================================================================
// SSO Logic
// ============================================================================

function isValidSSOProvider(provider: string): provider is SSOProvider {
  return provider === 'saml' || provider === 'oidc';
}

function extractDomainFromEmail(email: string): string | null {
  const match = email.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/);
  return match ? match[1].toLowerCase() : null;
}

function isValidDomain(domain: string): boolean {
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(domain);
}

function validateSAMLConfig(config: Partial<SSOConfiguration>): string[] {
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

function validateOIDCConfig(config: Partial<SSOConfiguration>): string[] {
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

function validateSSOConfig(config: Partial<SSOConfiguration>): string[] {
  if (!config.provider || !isValidSSOProvider(config.provider)) {
    return ['Invalid SSO provider. Must be saml or oidc'];
  }
  return config.provider === 'saml'
    ? validateSAMLConfig(config)
    : validateOIDCConfig(config);
}

function shouldEnforceSSO(config: SSOConfiguration, email: string): boolean {
  if (!config.is_active) return false;
  if (!config.enforce_sso) return false;
  const emailDomain = extractDomainFromEmail(email);
  return emailDomain === config.domain.toLowerCase();
}

function canUseMagicLink(config: SSOConfiguration | null, email: string): boolean {
  if (!config || !config.is_active) return true;
  if (config.allow_magic_link_fallback) return true;
  const emailDomain = extractDomainFromEmail(email);
  return emailDomain !== config.domain.toLowerCase();
}

// ============================================================================
// TESTS
// ============================================================================

describe('SSO Configuration Module', () => {
  describe('Provider Validation', () => {
    it('accepts valid SSO providers', () => {
      expect(isValidSSOProvider('saml')).toBe(true);
      expect(isValidSSOProvider('oidc')).toBe(true);
    });

    it('rejects invalid providers', () => {
      expect(isValidSSOProvider('oauth')).toBe(false);
      expect(isValidSSOProvider('')).toBe(false);
      expect(isValidSSOProvider('ldap')).toBe(false);
    });
  });

  describe('Domain Extraction', () => {
    it('extracts domain from email addresses', () => {
      expect(extractDomainFromEmail('user@example.com')).toBe('example.com');
      expect(extractDomainFromEmail('admin@corp.example.co.uk')).toBe('corp.example.co.uk');
    });

    it('returns null for invalid emails', () => {
      expect(extractDomainFromEmail('not-an-email')).toBeNull();
      expect(extractDomainFromEmail('')).toBeNull();
      expect(extractDomainFromEmail('@')).toBeNull();
    });

    it('normalizes domain to lowercase', () => {
      expect(extractDomainFromEmail('user@EXAMPLE.COM')).toBe('example.com');
    });
  });

  describe('Domain Validation', () => {
    it('accepts valid domains', () => {
      expect(isValidDomain('example.com')).toBe(true);
      expect(isValidDomain('sub.example.com')).toBe(true);
      expect(isValidDomain('my-company.co.uk')).toBe(true);
    });

    it('rejects invalid domains', () => {
      expect(isValidDomain('localhost')).toBe(false);
      expect(isValidDomain('.com')).toBe(false);
      expect(isValidDomain('example.')).toBe(false);
      expect(isValidDomain('')).toBe(false);
    });
  });

  describe('SAML Config Validation', () => {
    it('accepts valid SAML config with metadata URL', () => {
      const errors = validateSAMLConfig({
        provider: 'saml',
        domain: 'example.com',
        metadata_url: 'https://idp.example.com/metadata.xml',
      });
      expect(errors).toHaveLength(0);
    });

    it('accepts valid SAML config with entity ID', () => {
      const errors = validateSAMLConfig({
        provider: 'saml',
        domain: 'example.com',
        entity_id: 'https://idp.example.com/entity',
      });
      expect(errors).toHaveLength(0);
    });

    it('rejects SAML config without metadata or entity', () => {
      const errors = validateSAMLConfig({
        provider: 'saml',
        domain: 'example.com',
      });
      expect(errors).toContain('SAML requires either metadata_url or entity_id');
    });

    it('rejects SAML config without domain', () => {
      const errors = validateSAMLConfig({
        provider: 'saml',
        metadata_url: 'https://idp.example.com/metadata.xml',
      });
      expect(errors).toContain('Domain is required');
    });

    it('rejects HTTP metadata URL', () => {
      const errors = validateSAMLConfig({
        provider: 'saml',
        domain: 'example.com',
        metadata_url: 'http://idp.example.com/metadata.xml',
      });
      expect(errors).toContain('Metadata URL must use HTTPS');
    });
  });

  describe('OIDC Config Validation', () => {
    it('accepts valid OIDC config', () => {
      const errors = validateOIDCConfig({
        provider: 'oidc',
        domain: 'example.com',
        client_id: 'my-client-id',
        issuer_url: 'https://auth.example.com',
      });
      expect(errors).toHaveLength(0);
    });

    it('rejects OIDC config without client_id', () => {
      const errors = validateOIDCConfig({
        provider: 'oidc',
        domain: 'example.com',
        issuer_url: 'https://auth.example.com',
      });
      expect(errors).toContain('OIDC requires client_id');
    });

    it('rejects OIDC config without issuer_url', () => {
      const errors = validateOIDCConfig({
        provider: 'oidc',
        domain: 'example.com',
        client_id: 'my-client-id',
      });
      expect(errors).toContain('OIDC requires issuer_url');
    });

    it('rejects HTTP issuer URL', () => {
      const errors = validateOIDCConfig({
        provider: 'oidc',
        domain: 'example.com',
        client_id: 'my-client-id',
        issuer_url: 'http://auth.example.com',
      });
      expect(errors).toContain('Issuer URL must use HTTPS');
    });
  });

  describe('SSO Config Validation (Combined)', () => {
    it('rejects invalid provider', () => {
      const errors = validateSSOConfig({ provider: 'ldap' as any });
      expect(errors).toContain('Invalid SSO provider. Must be saml or oidc');
    });

    it('delegates to SAML validator for SAML provider', () => {
      const errors = validateSSOConfig({
        provider: 'saml',
        domain: 'example.com',
        metadata_url: 'https://idp.example.com/metadata.xml',
      });
      expect(errors).toHaveLength(0);
    });

    it('delegates to OIDC validator for OIDC provider', () => {
      const errors = validateSSOConfig({
        provider: 'oidc',
        domain: 'example.com',
        client_id: 'id',
        issuer_url: 'https://auth.example.com',
      });
      expect(errors).toHaveLength(0);
    });
  });

  describe('SSO Enforcement', () => {
    const baseSSOConfig: SSOConfiguration = {
      id: 'sso-1',
      workspace_id: 'ws-1',
      provider: 'saml',
      domain: 'example.com',
      is_active: true,
      metadata_url: 'https://idp.example.com/metadata',
      entity_id: null,
      acs_url: null,
      certificate: null,
      client_id: null,
      client_secret: null,
      issuer_url: null,
      enforce_sso: true,
      allow_magic_link_fallback: false,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    it('enforces SSO for matching domain', () => {
      expect(shouldEnforceSSO(baseSSOConfig, 'user@example.com')).toBe(true);
    });

    it('does not enforce SSO for non-matching domain', () => {
      expect(shouldEnforceSSO(baseSSOConfig, 'user@other.com')).toBe(false);
    });

    it('does not enforce SSO when inactive', () => {
      expect(shouldEnforceSSO({ ...baseSSOConfig, is_active: false }, 'user@example.com')).toBe(false);
    });

    it('does not enforce SSO when enforce_sso is false', () => {
      expect(shouldEnforceSSO({ ...baseSSOConfig, enforce_sso: false }, 'user@example.com')).toBe(false);
    });
  });

  describe('Magic Link Fallback', () => {
    const ssoConfig: SSOConfiguration = {
      id: 'sso-1',
      workspace_id: 'ws-1',
      provider: 'saml',
      domain: 'example.com',
      is_active: true,
      metadata_url: 'https://idp.example.com/metadata',
      entity_id: null,
      acs_url: null,
      certificate: null,
      client_id: null,
      client_secret: null,
      issuer_url: null,
      enforce_sso: true,
      allow_magic_link_fallback: false,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    it('allows magic link when no SSO config exists', () => {
      expect(canUseMagicLink(null, 'user@example.com')).toBe(true);
    });

    it('allows magic link when SSO is inactive', () => {
      expect(canUseMagicLink({ ...ssoConfig, is_active: false }, 'user@example.com')).toBe(true);
    });

    it('allows magic link when fallback is enabled', () => {
      expect(canUseMagicLink({ ...ssoConfig, allow_magic_link_fallback: true }, 'user@example.com')).toBe(true);
    });

    it('blocks magic link for SSO domain users when fallback disabled', () => {
      expect(canUseMagicLink(ssoConfig, 'user@example.com')).toBe(false);
    });

    it('allows magic link for non-SSO domain users', () => {
      expect(canUseMagicLink(ssoConfig, 'user@other.com')).toBe(true);
    });
  });
});
