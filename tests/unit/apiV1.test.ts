/**
 * REST API v1 Module Tests
 *
 * Tests for the API key validation, request routing, and response formatting
 * used by the api-v1 Edge Function skeleton.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// API Key Validation
// ============================================================================

interface ApiKey {
  id: string;
  workspace_id: string;
  key_hash: string;
  name: string;
  scopes: string[];
  rate_limit: number;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
}

/**
 * Validate API key format: must start with 'jp_' prefix and be 40+ chars
 */
function validateApiKeyFormat(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  if (!key.startsWith('jp_')) return false;
  if (key.length < 40) return false;
  return /^jp_[a-zA-Z0-9_-]+$/.test(key);
}

/**
 * Parse route from URL path: /api/v1/{resource}/{id?}
 */
function parseRoute(path: string): { resource: string; id: string | null; valid: boolean } {
  const match = path.match(/^\/api\/v1\/([a-z_]+)(?:\/([a-zA-Z0-9_-]+))?$/);
  if (!match) return { resource: '', id: null, valid: false };
  return { resource: match[1], id: match[2] || null, valid: true };
}

/**
 * Supported API resources
 */
const SUPPORTED_RESOURCES = ['jobs', 'clients', 'technicians', 'invoices', 'photos', 'webhooks'] as const;
type ApiResource = typeof SUPPORTED_RESOURCES[number];

function isValidResource(resource: string): resource is ApiResource {
  return (SUPPORTED_RESOURCES as readonly string[]).includes(resource);
}

/**
 * Check if API key has required scope for operation
 */
function hasScope(key: ApiKey, resource: string, operation: 'read' | 'write' | 'delete'): boolean {
  const scope = `${resource}:${operation}`;
  const wildcard = `${resource}:*`;
  const globalWildcard = '*:*';
  return key.scopes.includes(scope) || key.scopes.includes(wildcard) || key.scopes.includes(globalWildcard);
}

/**
 * Build standard API response envelope
 */
function buildResponse<T>(data: T, meta?: { page?: number; per_page?: number; total?: number }): {
  data: T;
  meta: { page: number; per_page: number; total: number; timestamp: string };
} {
  return {
    data,
    meta: {
      page: meta?.page ?? 1,
      per_page: meta?.per_page ?? 25,
      total: meta?.total ?? 0,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Build standard API error response
 */
function buildErrorResponse(status: number, code: string, message: string): {
  error: { status: number; code: string; message: string };
} {
  return {
    error: { status, code, message },
  };
}

/**
 * Map HTTP method to operation scope
 */
function methodToOperation(method: string): 'read' | 'write' | 'delete' {
  switch (method.toUpperCase()) {
    case 'GET': return 'read';
    case 'POST': return 'write';
    case 'PUT': return 'write';
    case 'PATCH': return 'write';
    case 'DELETE': return 'delete';
    default: return 'read';
  }
}

// ============================================================================
// TESTS
// ============================================================================

describe('REST API v1 Module', () => {
  describe('API Key Format Validation', () => {
    it('accepts valid API keys with jp_ prefix', () => {
      const validKey = 'jp_' + 'a'.repeat(37);
      expect(validateApiKeyFormat(validKey)).toBe(true);
    });

    it('rejects keys without jp_ prefix', () => {
      expect(validateApiKeyFormat('sk_' + 'a'.repeat(37))).toBe(false);
    });

    it('rejects keys shorter than 40 characters', () => {
      expect(validateApiKeyFormat('jp_short')).toBe(false);
    });

    it('rejects empty or non-string input', () => {
      expect(validateApiKeyFormat('')).toBe(false);
      expect(validateApiKeyFormat(null as any)).toBe(false);
      expect(validateApiKeyFormat(undefined as any)).toBe(false);
    });

    it('rejects keys with special characters', () => {
      expect(validateApiKeyFormat('jp_' + 'a'.repeat(30) + '!@#$%^&')).toBe(false);
    });

    it('accepts keys with alphanumeric, underscore, and hyphen', () => {
      const key = 'jp_abc123-def456_ghi789-jkl012_mnop345qrs';
      expect(validateApiKeyFormat(key)).toBe(true);
    });
  });

  describe('Route Parsing', () => {
    it('parses collection routes correctly', () => {
      const result = parseRoute('/api/v1/jobs');
      expect(result).toEqual({ resource: 'jobs', id: null, valid: true });
    });

    it('parses resource routes with ID', () => {
      const result = parseRoute('/api/v1/jobs/abc-123');
      expect(result).toEqual({ resource: 'jobs', id: 'abc-123', valid: true });
    });

    it('rejects invalid paths', () => {
      expect(parseRoute('/invalid/path').valid).toBe(false);
      expect(parseRoute('/api/v2/jobs').valid).toBe(false);
      expect(parseRoute('').valid).toBe(false);
    });

    it('parses all supported resource types', () => {
      for (const resource of SUPPORTED_RESOURCES) {
        const result = parseRoute(`/api/v1/${resource}`);
        expect(result.valid).toBe(true);
        expect(result.resource).toBe(resource);
      }
    });

    it('rejects paths with too many segments', () => {
      expect(parseRoute('/api/v1/jobs/123/photos').valid).toBe(false);
    });
  });

  describe('Resource Validation', () => {
    it('validates supported resources', () => {
      expect(isValidResource('jobs')).toBe(true);
      expect(isValidResource('clients')).toBe(true);
      expect(isValidResource('technicians')).toBe(true);
      expect(isValidResource('invoices')).toBe(true);
      expect(isValidResource('photos')).toBe(true);
      expect(isValidResource('webhooks')).toBe(true);
    });

    it('rejects unsupported resources', () => {
      expect(isValidResource('users')).toBe(false);
      expect(isValidResource('settings')).toBe(false);
      expect(isValidResource('')).toBe(false);
    });
  });

  describe('Scope Checking', () => {
    const mockKey: ApiKey = {
      id: 'key-1',
      workspace_id: 'ws-1',
      key_hash: 'hash',
      name: 'Test Key',
      scopes: ['jobs:read', 'jobs:write', 'clients:*'],
      rate_limit: 1000,
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      last_used_at: null,
      expires_at: null,
    };

    it('grants access for explicit scope match', () => {
      expect(hasScope(mockKey, 'jobs', 'read')).toBe(true);
      expect(hasScope(mockKey, 'jobs', 'write')).toBe(true);
    });

    it('denies access for missing scope', () => {
      expect(hasScope(mockKey, 'jobs', 'delete')).toBe(false);
      expect(hasScope(mockKey, 'technicians', 'read')).toBe(false);
    });

    it('grants access via wildcard scope', () => {
      expect(hasScope(mockKey, 'clients', 'read')).toBe(true);
      expect(hasScope(mockKey, 'clients', 'write')).toBe(true);
      expect(hasScope(mockKey, 'clients', 'delete')).toBe(true);
    });

    it('grants access via global wildcard', () => {
      const adminKey: ApiKey = { ...mockKey, scopes: ['*:*'] };
      expect(hasScope(adminKey, 'jobs', 'read')).toBe(true);
      expect(hasScope(adminKey, 'technicians', 'delete')).toBe(true);
    });
  });

  describe('Response Building', () => {
    it('builds a standard data response with defaults', () => {
      const response = buildResponse([{ id: '1' }]);
      expect(response.data).toEqual([{ id: '1' }]);
      expect(response.meta.page).toBe(1);
      expect(response.meta.per_page).toBe(25);
      expect(response.meta.total).toBe(0);
      expect(response.meta.timestamp).toBeDefined();
    });

    it('builds a response with custom pagination', () => {
      const response = buildResponse([], { page: 3, per_page: 50, total: 150 });
      expect(response.meta.page).toBe(3);
      expect(response.meta.per_page).toBe(50);
      expect(response.meta.total).toBe(150);
    });

    it('builds an error response', () => {
      const error = buildErrorResponse(404, 'NOT_FOUND', 'Job not found');
      expect(error.error.status).toBe(404);
      expect(error.error.code).toBe('NOT_FOUND');
      expect(error.error.message).toBe('Job not found');
    });
  });

  describe('HTTP Method to Operation Mapping', () => {
    it('maps GET to read', () => {
      expect(methodToOperation('GET')).toBe('read');
    });

    it('maps POST/PUT/PATCH to write', () => {
      expect(methodToOperation('POST')).toBe('write');
      expect(methodToOperation('PUT')).toBe('write');
      expect(methodToOperation('PATCH')).toBe('write');
    });

    it('maps DELETE to delete', () => {
      expect(methodToOperation('DELETE')).toBe('delete');
    });

    it('handles case-insensitive methods', () => {
      expect(methodToOperation('get')).toBe('read');
      expect(methodToOperation('Post')).toBe('write');
    });

    it('defaults unknown methods to read', () => {
      expect(methodToOperation('OPTIONS')).toBe('read');
    });
  });
});
