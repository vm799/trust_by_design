/**
 * validateMagicLink Cross-Browser Validation Tests
 *
 * Tests the PRODUCTION scenario where:
 * 1. Manager creates job + magic link in Browser A
 * 2. Technician opens link in Browser B (different localStorage)
 * 3. Validation must work via Supabase RPC, NOT localStorage
 *
 * This test suite validates the fix for the recurring "invalid link" bug.
 * FIX: Now uses validate_magic_link_token RPC which bypasses RLS for anonymous access.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Supabase client with RPC support
const mockSupabaseRpc = vi.fn();
const mockSupabase = {
  rpc: mockSupabaseRpc
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

  describe('Supabase RPC validation (validate_magic_link_token)', () => {
    it('should validate token found via RPC', async () => {
      const testToken = 'valid-supabase-token-123';
      const testJobId = 'JP-test-job-001';
      const testWorkspaceId = 'workspace-123';

      // Mock RPC response - token found
      mockSupabaseRpc.mockResolvedValue({
        data: [{
          job_id: testJobId,
          workspace_id: testWorkspaceId,
          is_sealed: false,
          is_expired: false
        }],
        error: null
      });

      // Import after mocking
      const { validateMagicLink } = await import('../../lib/db');

      const result = await validateMagicLink(testToken);

      expect(result.success).toBe(true);
      expect(result.data?.job_id).toBe(testJobId);
      expect(result.data?.workspace_id).toBe(testWorkspaceId);

      // Verify RPC was called with correct function name and token
      expect(mockSupabaseRpc).toHaveBeenCalledWith('validate_magic_link_token', { p_token: testToken });
    });

    it('should reject expired token from RPC', async () => {
      const testToken = 'expired-token-456';

      // Mock RPC response - token expired
      mockSupabaseRpc.mockResolvedValue({
        data: [{
          job_id: 'JP-expired-job',
          workspace_id: 'workspace-123',
          is_sealed: false,
          is_expired: true
        }],
        error: null
      });

      const { validateMagicLink } = await import('../../lib/db');

      const result = await validateMagicLink(testToken);

      expect(result.success).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('should reject sealed job via RPC', async () => {
      const testToken = 'sealed-job-token';

      // Mock RPC response - job sealed
      mockSupabaseRpc.mockResolvedValue({
        data: [{
          job_id: 'JP-sealed-job',
          workspace_id: 'workspace-123',
          is_sealed: true,
          is_expired: false
        }],
        error: null
      });

      const { validateMagicLink } = await import('../../lib/db');

      const result = await validateMagicLink(testToken);

      expect(result.success).toBe(false);
      expect(result.error).toContain('sealed');
    });
  });

  describe('Error messages for different failure modes', () => {
    it('should provide clear error when token not found', async () => {
      const testToken = 'completely-invalid-token';

      // Mock RPC response - no results (empty array)
      mockSupabaseRpc.mockResolvedValue({
        data: [],
        error: null
      });

      const { validateMagicLink } = await import('../../lib/db');

      const result = await validateMagicLink(testToken);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // Should suggest asking manager for new link
      expect(result.error?.toLowerCase()).toMatch(/invalid|expired|new.*link/i);
    });

    it('should handle RPC errors gracefully', async () => {
      const testToken = 'error-token';

      // Mock RPC error
      mockSupabaseRpc.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' }
      });

      const { validateMagicLink } = await import('../../lib/db');

      const result = await validateMagicLink(testToken);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

describe('Cross-Browser E2E Scenario', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate link when technician has empty localStorage', async () => {
    // Simulate technician's fresh browser with no local data
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    const testToken = 'manager-created-token';
    const testJobId = 'JP-cross-browser-job';
    const testWorkspaceId = 'ws-cross-browser';

    // Mock RPC response - token found
    mockSupabaseRpc.mockResolvedValue({
      data: [{
        job_id: testJobId,
        workspace_id: testWorkspaceId,
        is_sealed: false,
        is_expired: false
      }],
      error: null
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

describe('RPC Function Contract', () => {
  it('should call validate_magic_link_token with correct parameter', async () => {
    const testToken = 'test-token';

    mockSupabaseRpc.mockResolvedValue({
      data: [{
        job_id: 'JP-123',
        workspace_id: 'ws-123',
        is_sealed: false,
        is_expired: false
      }],
      error: null
    });

    const { validateMagicLink } = await import('../../lib/db');
    await validateMagicLink(testToken);

    expect(mockSupabaseRpc).toHaveBeenCalledWith(
      'validate_magic_link_token',
      { p_token: testToken }
    );
  });

  it('RPC function name should be validate_magic_link_token', () => {
    // Document the RPC function contract
    const expectedFunctionName = 'validate_magic_link_token';
    const expectedGrant = 'anon'; // Should be GRANT EXECUTE TO anon

    expect(expectedFunctionName).toBe('validate_magic_link_token');
    expect(expectedGrant).toBe('anon');
  });
});
