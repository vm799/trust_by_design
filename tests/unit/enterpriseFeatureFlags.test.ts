/**
 * Enterprise Feature Flags Tests
 *
 * Tests for the enterprise feature flag configuration ensuring
 * proper gating of REST API, webhooks, SSO, push, and team features.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  FEATURE_FLAGS,
  isFeatureEnabled,
  evaluateFlag,
  clearAllFlagOverrides,
  setFlagOverride,
  type FeatureFlagKey,
} from '../../lib/featureFlags';

describe('Enterprise Feature Flags', () => {
  beforeEach(() => {
    clearAllFlagOverrides();
  });

  describe('Flag Configuration', () => {
    it('defines REST_API_V1 as paid-only', () => {
      expect(FEATURE_FLAGS.REST_API_V1).toBeDefined();
      expect(FEATURE_FLAGS.REST_API_V1.paidOnly).toBe(true);
      expect(FEATURE_FLAGS.REST_API_V1.rolloutPercentage).toBe(100);
    });

    it('defines WEBHOOK_SYSTEM as paid-only', () => {
      expect(FEATURE_FLAGS.WEBHOOK_SYSTEM).toBeDefined();
      expect(FEATURE_FLAGS.WEBHOOK_SYSTEM.paidOnly).toBe(true);
      expect(FEATURE_FLAGS.WEBHOOK_SYSTEM.rolloutPercentage).toBe(100);
    });

    it('defines SSO_ENTERPRISE as paid-only and staging-only initially', () => {
      expect(FEATURE_FLAGS.SSO_ENTERPRISE).toBeDefined();
      expect(FEATURE_FLAGS.SSO_ENTERPRISE.paidOnly).toBe(true);
      expect(FEATURE_FLAGS.SSO_ENTERPRISE.rolloutPercentage).toBe(0);
      expect(FEATURE_FLAGS.SSO_ENTERPRISE.enabledEnvironments).not.toContain('production');
    });

    it('defines PUSH_NOTIFICATIONS as available to all users', () => {
      expect(FEATURE_FLAGS.PUSH_NOTIFICATIONS).toBeDefined();
      expect(FEATURE_FLAGS.PUSH_NOTIFICATIONS.paidOnly).toBe(false);
      expect(FEATURE_FLAGS.PUSH_NOTIFICATIONS.rolloutPercentage).toBe(100);
    });

    it('defines TEAM_MANAGEMENT as available to all users', () => {
      expect(FEATURE_FLAGS.TEAM_MANAGEMENT).toBeDefined();
      expect(FEATURE_FLAGS.TEAM_MANAGEMENT.paidOnly).toBe(false);
      expect(FEATURE_FLAGS.TEAM_MANAGEMENT.rolloutPercentage).toBe(100);
    });
  });

  describe('Paid-Only Gating', () => {
    it('blocks REST API for free users', () => {
      const result = evaluateFlag('REST_API_V1', 'user-1', false);
      expect(result.enabled).toBe(false);
      expect(result.reason).toBe('paid_only');
    });

    it('allows REST API for paid users', () => {
      const result = evaluateFlag('REST_API_V1', 'user-1', true);
      expect(result.enabled).toBe(true);
    });

    it('blocks webhooks for free users', () => {
      const result = evaluateFlag('WEBHOOK_SYSTEM', 'user-1', false);
      expect(result.enabled).toBe(false);
    });

    it('allows webhooks for paid users', () => {
      const result = evaluateFlag('WEBHOOK_SYSTEM', 'user-1', true);
      expect(result.enabled).toBe(true);
    });
  });

  describe('Free Tier Features', () => {
    it('enables push notifications for free users', () => {
      expect(isFeatureEnabled('PUSH_NOTIFICATIONS', 'user-1', false)).toBe(true);
    });

    it('enables team management for free users', () => {
      expect(isFeatureEnabled('TEAM_MANAGEMENT', 'user-1', false)).toBe(true);
    });
  });

  describe('Feature Flag Overrides', () => {
    it('allows overriding SSO flag in non-production', () => {
      const overrideSet = setFlagOverride('SSO_ENTERPRISE', true);
      expect(overrideSet).toBe(true);
    });

    it('clears overrides properly', () => {
      setFlagOverride('REST_API_V1', false);
      clearAllFlagOverrides();
      // After clearing, should evaluate normally
      const result = evaluateFlag('REST_API_V1', 'user-1', true);
      expect(result.enabled).toBe(true);
    });
  });

  describe('All Enterprise Flags Exist', () => {
    const enterpriseFlags: FeatureFlagKey[] = [
      'REST_API_V1',
      'WEBHOOK_SYSTEM',
      'SSO_ENTERPRISE',
      'PUSH_NOTIFICATIONS',
      'TEAM_MANAGEMENT',
    ];

    for (const flag of enterpriseFlags) {
      it(`${flag} is defined in FEATURE_FLAGS`, () => {
        expect(FEATURE_FLAGS[flag]).toBeDefined();
        expect(FEATURE_FLAGS[flag].key).toBe(flag);
        expect(FEATURE_FLAGS[flag].description.length).toBeGreaterThan(0);
      });
    }
  });
});
