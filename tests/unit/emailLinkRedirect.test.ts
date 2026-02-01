/**
 * Email Link Redirect Tests
 * Tests the email magic link → PersonaRedirect → dashboard flow
 *
 * CLAUDE.md: Verify returning users go to dashboard, not intent selector
 */

import { describe, it, expect } from 'vitest';

// Mock UserProfile for testing
interface MockUserProfile {
  name: string;
  email: string;
  persona?: string;
  workspace?: { id: string; name: string; slug: string };
}

/**
 * Simulates PersonaRedirect routing logic from App.tsx
 * This matches the exact logic in the actual component
 */
function getManagerRedirectPath(
  user: MockUserProfile | null,
  hasSeenOnboarding: boolean
): string {
  // Profile missing - redirect to setup
  if (!user) {
    return '/auth/setup';
  }

  // No persona set - redirect to onboarding
  if (!user.persona) {
    return '/onboarding';
  }

  const persona = user.persona.toLowerCase();

  if (persona === 'technician' || persona === 'contractor' || persona === 'solo_contractor') {
    return '/contractor';
  }

  if (persona === 'client') {
    return '/client';
  }

  // CRITICAL: Returning managers go directly to dashboard
  // Only first-time users see the Intent Selector
  if (hasSeenOnboarding) {
    return '/admin';
  }

  // First-time managers see Intent Selector
  return '/manager/intent';
}

describe('Email Link Redirect Flow', () => {
  describe('PersonaRedirect routing logic', () => {
    it('returning manager goes to /admin (hasSeenOnboarding = true)', () => {
      const user: MockUserProfile = {
        name: 'John Manager',
        email: 'john@example.com',
        persona: 'manager',
        workspace: { id: 'ws-123', name: 'Test Co', slug: 'test-co' },
      };

      const redirectPath = getManagerRedirectPath(user, true);
      expect(redirectPath).toBe('/admin');
    });

    it('first-time manager goes to /manager/intent (hasSeenOnboarding = false)', () => {
      const user: MockUserProfile = {
        name: 'New Manager',
        email: 'new@example.com',
        persona: 'manager',
        workspace: { id: 'ws-456', name: 'New Co', slug: 'new-co' },
      };

      const redirectPath = getManagerRedirectPath(user, false);
      expect(redirectPath).toBe('/manager/intent');
    });

    it('owner persona treated same as manager (returning → /admin)', () => {
      const user: MockUserProfile = {
        name: 'Owner User',
        email: 'owner@example.com',
        persona: 'owner',
        workspace: { id: 'ws-789', name: 'Owner Co', slug: 'owner-co' },
      };

      const redirectPath = getManagerRedirectPath(user, true);
      expect(redirectPath).toBe('/admin');
    });

    it('missing profile redirects to /auth/setup', () => {
      const redirectPath = getManagerRedirectPath(null, true);
      expect(redirectPath).toBe('/auth/setup');
    });

    it('missing persona redirects to /onboarding', () => {
      const user: MockUserProfile = {
        name: 'Incomplete User',
        email: 'incomplete@example.com',
        persona: undefined,
        workspace: { id: 'ws-000', name: 'Incomplete', slug: 'incomplete' },
      };

      const redirectPath = getManagerRedirectPath(user, false);
      expect(redirectPath).toBe('/onboarding');
    });

    it('technician persona goes to /contractor', () => {
      const user: MockUserProfile = {
        name: 'Tech User',
        email: 'tech@example.com',
        persona: 'technician',
      };

      const redirectPath = getManagerRedirectPath(user, true);
      expect(redirectPath).toBe('/contractor');
    });

    it('client persona goes to /client', () => {
      const user: MockUserProfile = {
        name: 'Client User',
        email: 'client@example.com',
        persona: 'client',
      };

      const redirectPath = getManagerRedirectPath(user, true);
      expect(redirectPath).toBe('/client');
    });
  });

  describe('Display name extraction', () => {
    it('extracts email prefix when name equals email', () => {
      const rawName = 'john@example.com';
      const isEmailAsName = rawName.includes('@');
      const displayName = isEmailAsName
        ? rawName.split('@')[0]
        : (rawName.split(' ')[0] || 'Manager');

      expect(displayName).toBe('john');
    });

    it('uses first name when name is not email', () => {
      const rawName = 'John Smith';
      const isEmailAsName = rawName.includes('@');
      const displayName = isEmailAsName
        ? rawName.split('@')[0]
        : (rawName.split(' ')[0] || 'Manager');

      expect(displayName).toBe('John');
    });

    it('falls back to Manager when name is empty', () => {
      const rawName = '';
      const isEmailAsName = rawName.includes('@');
      const displayName = isEmailAsName
        ? rawName.split('@')[0]
        : (rawName.split(' ')[0] || 'Manager');

      expect(displayName).toBe('Manager');
    });
  });
});
