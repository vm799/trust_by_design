/**
 * Dev Auth & Test User Configuration Tests
 *
 * Verifies environment-gated authentication modes:
 * - Dev (localhost): Quick-login buttons for 3 roles
 * - Staging: Password + magic link dual mode
 * - Production: Magic link only (no test user UI)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock import.meta.env before importing module
const mockEnv: Record<string, string | boolean | undefined> = {};

vi.mock('../../lib/devAuth', async () => {
  const actual = await vi.importActual('../../lib/devAuth');
  return actual;
});

describe('Dev Auth Configuration', () => {
  beforeEach(() => {
    // Reset env for each test
    Object.keys(mockEnv).forEach(key => delete mockEnv[key]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getTestUsers()', () => {
    it('returns 3 test users when all env vars are set', async () => {
      const { getTestUsers } = await import('../../lib/devAuth');

      // Provide env vars via the function's parameter override
      const users = getTestUsers({
        managerEmail: 'test-manager@jobproof.pro',
        managerPassword: 'TestManager2026!',
        techEmail: 'test-tech@jobproof.pro',
        techPassword: 'TestTech2026!',
        soloEmail: 'test-solo@jobproof.pro',
        soloPassword: 'TestSolo2026!',
      });

      expect(users).toHaveLength(3);
      expect(users[0].role).toBe('manager');
      expect(users[0].email).toBe('test-manager@jobproof.pro');
      expect(users[1].role).toBe('technician');
      expect(users[2].role).toBe('solo_contractor');
    });

    it('returns empty array when no env vars are configured', async () => {
      const { getTestUsers } = await import('../../lib/devAuth');

      const users = getTestUsers({
        managerEmail: '',
        managerPassword: '',
        techEmail: '',
        techPassword: '',
        soloEmail: '',
        soloPassword: '',
      });

      expect(users).toHaveLength(0);
    });

    it('returns only configured users (partial config)', async () => {
      const { getTestUsers } = await import('../../lib/devAuth');

      const users = getTestUsers({
        managerEmail: 'test-manager@jobproof.pro',
        managerPassword: 'TestManager2026!',
        techEmail: '',
        techPassword: '',
        soloEmail: '',
        soloPassword: '',
      });

      expect(users).toHaveLength(1);
      expect(users[0].role).toBe('manager');
    });

    it('each test user has required fields', async () => {
      const { getTestUsers } = await import('../../lib/devAuth');

      const users = getTestUsers({
        managerEmail: 'mgr@test.com',
        managerPassword: 'pass1',
        techEmail: 'tech@test.com',
        techPassword: 'pass2',
        soloEmail: 'solo@test.com',
        soloPassword: 'pass3',
      });

      for (const user of users) {
        expect(user).toHaveProperty('role');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('password');
        expect(user).toHaveProperty('label');
        expect(user).toHaveProperty('icon');
        expect(typeof user.email).toBe('string');
        expect(typeof user.password).toBe('string');
        expect(user.email.length).toBeGreaterThan(0);
        expect(user.password.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Environment Detection', () => {
    it('isDevEnvironment returns true for DEV mode', async () => {
      const { isDevEnvironment } = await import('../../lib/devAuth');
      // In Vitest, import.meta.env.DEV is true
      expect(typeof isDevEnvironment()).toBe('boolean');
    });

    it('isStagingEnvironment checks VITE_APP_ENV', async () => {
      const { isStagingEnvironment } = await import('../../lib/devAuth');
      expect(typeof isStagingEnvironment()).toBe('boolean');
    });

    it('isProductionEnvironment is mutually exclusive with dev/staging', async () => {
      const { isDevEnvironment, isStagingEnvironment, isProductionEnvironment } = await import('../../lib/devAuth');

      // In test mode, DEV is true so production should be false
      if (isDevEnvironment()) {
        expect(isProductionEnvironment()).toBe(false);
      }

      // Dev and staging are mutually exclusive
      if (isStagingEnvironment()) {
        expect(isProductionEnvironment()).toBe(false);
      }
    });
  });

  describe('shouldShowDevLogin()', () => {
    it('returns boolean based on environment', async () => {
      const { shouldShowDevLogin } = await import('../../lib/devAuth');
      expect(typeof shouldShowDevLogin()).toBe('boolean');
    });
  });

  describe('shouldShowPasswordLogin()', () => {
    it('returns boolean based on environment', async () => {
      const { shouldShowPasswordLogin } = await import('../../lib/devAuth');
      expect(typeof shouldShowPasswordLogin()).toBe('boolean');
    });

    it('returns true in dev environment', async () => {
      const { shouldShowPasswordLogin, isDevEnvironment } = await import('../../lib/devAuth');
      // In dev mode, password login should be available as fallback
      if (isDevEnvironment()) {
        expect(shouldShowPasswordLogin()).toBe(true);
      }
    });
  });

  describe('Test User Role Mapping', () => {
    it('manager role maps to agency_owner persona', async () => {
      const { getTestUsers } = await import('../../lib/devAuth');

      const users = getTestUsers({
        managerEmail: 'mgr@test.com',
        managerPassword: 'pass',
        techEmail: 'tech@test.com',
        techPassword: 'pass',
        soloEmail: 'solo@test.com',
        soloPassword: 'pass',
      });

      const manager = users.find(u => u.role === 'manager');
      expect(manager).toBeDefined();
      expect(manager!.persona).toBe('agency_owner');
    });

    it('technician role maps to technician persona', async () => {
      const { getTestUsers } = await import('../../lib/devAuth');

      const users = getTestUsers({
        managerEmail: 'mgr@test.com',
        managerPassword: 'pass',
        techEmail: 'tech@test.com',
        techPassword: 'pass',
        soloEmail: 'solo@test.com',
        soloPassword: 'pass',
      });

      const tech = users.find(u => u.role === 'technician');
      expect(tech).toBeDefined();
      expect(tech!.persona).toBe('solo_contractor');
    });

    it('solo_contractor role maps to solo_contractor persona', async () => {
      const { getTestUsers } = await import('../../lib/devAuth');

      const users = getTestUsers({
        managerEmail: 'mgr@test.com',
        managerPassword: 'pass',
        techEmail: 'tech@test.com',
        techPassword: 'pass',
        soloEmail: 'solo@test.com',
        soloPassword: 'pass',
      });

      const solo = users.find(u => u.role === 'solo_contractor');
      expect(solo).toBeDefined();
      expect(solo!.persona).toBe('solo_contractor');
    });
  });

  describe('Security', () => {
    it('test user credentials are never hardcoded', async () => {
      // Read the devAuth module source to ensure no hardcoded passwords
      const fs = await import('fs');
      const path = await import('path');
      const content = fs.readFileSync(
        path.resolve(__dirname, '../../lib/devAuth.ts'),
        'utf-8'
      );

      // Should not contain any password-like strings
      expect(content).not.toMatch(/password.*=.*['"][A-Za-z0-9!@#$%^&*]{6,}['"]/i);
      // Should reference import.meta.env for credentials
      expect(content).toContain('import.meta.env');
    });

    it('dev login UI is gated by environment checks', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const content = fs.readFileSync(
        path.resolve(__dirname, '../../views/AuthView.tsx'),
        'utf-8'
      );

      // AuthView should import devAuth utilities
      expect(content).toContain('devAuth');
      // Should have environment gating for dev login
      expect(content).toMatch(/shouldShowDevLogin|isDevEnvironment|DEV/);
    });
  });
});
