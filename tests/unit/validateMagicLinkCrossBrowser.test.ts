/**
 * validateMagicLink Cross-Browser Validation Tests
 *
 * Tests the PRODUCTION scenario where:
 * 1. Manager creates job + magic link in Browser A
 * 2. Technician opens link in Browser B (different localStorage)
 * 3. Validation must work via Supabase, NOT localStorage
 *
 * This test suite validates the fix for the recurring "invalid link" bug.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Supabase client
const mockSupabaseFrom = vi.fn();
const mockSupabase = {
  from: mockSupabaseFrom
};

// Mock the supabase module
vi.mock('../../lib/supabase', () => ({
  getSupabase: () => mockSupabase,
  isSupabaseAvailable: () => true
}));

describe('validateMagicLink - Cross-Browser Supabase Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage to simulate fresh browser
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Supabase job_access_tokens validation', () => {
    it('should validate token found in job_access_tokens table', async () => {
      const testToken = 'valid-supabase-token-123';
      const testJobId = 'JP-test-job-001';
      const testWorkspaceId = 'workspace-123';
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // Mock job_access_tokens query
      const mockTokenQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            job_id: testJobId,
            expires_at: futureDate,
            used_at: null
          },
          error: null
        })
      };

      // Mock jobs query for sealed check
      const mockJobQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            sealed_at: null,
            workspace_id: testWorkspaceId
          },
          error: null
        })
      };

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'job_access_tokens') return mockTokenQuery;
        if (table === 'jobs') return mockJobQuery;
        return mockTokenQuery;
      });

      // Import after mocking
      const { validateMagicLink } = await import('../../lib/db');

      const result = await validateMagicLink(testToken);

      expect(result.success).toBe(true);
      expect(result.data?.job_id).toBe(testJobId);
      expect(result.data?.workspace_id).toBe(testWorkspaceId);
    });

    it('should reject expired token from job_access_tokens', async () => {
      const testToken = 'expired-token-456';
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const mockTokenQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            job_id: 'JP-expired-job',
            expires_at: pastDate,
            used_at: null
          },
          error: null
        })
      };

      mockSupabaseFrom.mockReturnValue(mockTokenQuery);

      const { validateMagicLink } = await import('../../lib/db');

      const result = await validateMagicLink(testToken);

      expect(result.success).toBe(false);
      expect(result.error).toContain('expired');
    });
  });

  describe('Supabase jobs.magic_link_token validation (fallback)', () => {
    it('should validate token found directly on job record', async () => {
      const testToken = 'job-embedded-token-789';
      const testJobId = 'JP-job-with-token';
      const testWorkspaceId = 'workspace-456';

      // Mock job_access_tokens query - NOT FOUND
      const mockTokenQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'Row not found' }
        })
      };

      // Mock jobs query by magic_link_token - FOUND
      const mockJobByTokenQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: testJobId,
            workspace_id: testWorkspaceId,
            sealed_at: null
          },
          error: null
        })
      };

      let jobQueryCount = 0;
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'job_access_tokens') return mockTokenQuery;
        if (table === 'jobs') {
          jobQueryCount++;
          // First call is from job_access_tokens path, second is fallback
          return mockJobByTokenQuery;
        }
        return mockTokenQuery;
      });

      const { validateMagicLink } = await import('../../lib/db');

      const result = await validateMagicLink(testToken);

      expect(result.success).toBe(true);
      expect(result.data?.job_id).toBe(testJobId);
      expect(result.data?.workspace_id).toBe(testWorkspaceId);
    });

    it('should reject sealed job found via magic_link_token', async () => {
      const testToken = 'sealed-job-token';
      const testJobId = 'JP-sealed-job';

      // Mock job_access_tokens - NOT FOUND
      const mockTokenQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'Row not found' }
        })
      };

      // Mock jobs query - FOUND but SEALED
      const mockJobByTokenQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: testJobId,
            workspace_id: 'workspace',
            sealed_at: '2026-01-20T10:00:00Z'
          },
          error: null
        })
      };

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'job_access_tokens') return mockTokenQuery;
        if (table === 'jobs') return mockJobByTokenQuery;
        return mockTokenQuery;
      });

      const { validateMagicLink } = await import('../../lib/db');

      const result = await validateMagicLink(testToken);

      expect(result.success).toBe(false);
      expect(result.error).toContain('sealed');
    });
  });

  describe('Error messages for different failure modes', () => {
    it('should provide clear error when token not found anywhere', async () => {
      const testToken = 'completely-invalid-token';

      // Mock both queries - NOT FOUND
      const mockNotFoundQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'Row not found' }
        })
      };

      mockSupabaseFrom.mockReturnValue(mockNotFoundQuery);

      const { validateMagicLink } = await import('../../lib/db');

      const result = await validateMagicLink(testToken);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // Should suggest asking manager for new link
      expect(result.error?.toLowerCase()).toMatch(/invalid|expired|new.*link/i);
    });
  });
});

describe('Cross-Browser E2E Scenario', () => {
  it('should validate link when technician has empty localStorage', async () => {
    // Simulate technician's fresh browser with no local data
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    const testToken = 'manager-created-token';
    const testJobId = 'JP-cross-browser-job';
    const testWorkspaceId = 'ws-cross-browser';
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Mock Supabase responses - token found in job_access_tokens
    const mockTokenQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          job_id: testJobId,
          expires_at: futureDate,
          used_at: null
        },
        error: null
      })
    };

    const mockJobQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          sealed_at: null,
          workspace_id: testWorkspaceId
        },
        error: null
      })
    };

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'job_access_tokens') return mockTokenQuery;
      if (table === 'jobs') return mockJobQuery;
      return mockTokenQuery;
    });

    const { validateMagicLink } = await import('../../lib/db');

    // This simulates technician opening link in different browser
    // with NO localStorage data from manager's browser
    const result = await validateMagicLink(testToken);

    expect(result.success).toBe(true);
    expect(result.data?.job_id).toBe(testJobId);
    expect(result.data?.workspace_id).toBe(testWorkspaceId);
    expect(result.data?.is_valid).toBe(true);
  });
});
