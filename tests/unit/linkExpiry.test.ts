/**
 * Link Expiry Validation Tests
 * Tests that technician links expire after 24 hours
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HandshakeService } from '../../lib/handshakeService';
import { getValidatedHandshakeUrl } from '../../lib/redirects';

describe('Link Expiry Validation', () => {
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getValidatedHandshakeUrl', () => {
    it('should include createdAt timestamp in access code payload', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const url = getValidatedHandshakeUrl(
        'JP-test-123',
        'manager@example.com',
        'client@example.com'
      );

      // Extract access code from URL
      const accessCodeMatch = url.match(/\/#\/go\/(.+)$/);
      expect(accessCodeMatch).not.toBeNull();

      const accessCode = decodeURIComponent(accessCodeMatch![1]);
      const decoded = JSON.parse(atob(accessCode));

      expect(decoded.createdAt).toBeDefined();
      expect(typeof decoded.createdAt).toBe('number');
      expect(decoded.createdAt).toBe(now);
    });
  });

  describe('HandshakeService.parseAccessCode', () => {
    it('should extract createdAt from access code', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const url = getValidatedHandshakeUrl(
        'JP-test-123',
        'manager@example.com'
      );

      const accessCodeMatch = url.match(/\/#\/go\/(.+)$/);
      const accessCode = decodeURIComponent(accessCodeMatch![1]);

      const parsed = HandshakeService.parseAccessCode(accessCode);

      expect(parsed).not.toBeNull();
      expect(parsed?.createdAt).toBe(now);
    });

    it('should handle legacy access codes without createdAt', () => {
      // Legacy payload without createdAt
      const legacyPayload = {
        jobId: 'JP-legacy-123',
        checksum: 'abc123',
        deliveryEmail: 'manager@example.com',
      };
      const legacyAccessCode = btoa(JSON.stringify(legacyPayload));

      const parsed = HandshakeService.parseAccessCode(legacyAccessCode);

      expect(parsed).not.toBeNull();
      expect(parsed?.jobId).toBe('JP-legacy-123');
      expect(parsed?.createdAt).toBeUndefined();
    });
  });

  describe('HandshakeService.validate', () => {
    it('should accept fresh links (within 24 hours)', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const url = getValidatedHandshakeUrl(
        'JP-fresh-123',
        'manager@example.com'
      );

      const accessCodeMatch = url.match(/\/#\/go\/(.+)$/);
      const accessCode = decodeURIComponent(accessCodeMatch![1]);

      const result = HandshakeService.validate(accessCode);

      expect(result.success).toBe(true);
      expect(result.context).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should reject expired links (older than 24 hours)', () => {
      const linkCreatedAt = Date.now();
      vi.setSystemTime(linkCreatedAt);

      const url = getValidatedHandshakeUrl(
        'JP-expired-123',
        'manager@example.com'
      );

      const accessCodeMatch = url.match(/\/#\/go\/(.+)$/);
      const accessCode = decodeURIComponent(accessCodeMatch![1]);

      // Fast-forward time by 25 hours
      vi.setSystemTime(linkCreatedAt + TWENTY_FOUR_HOURS_MS + (60 * 60 * 1000));

      const result = HandshakeService.validate(accessCode);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('EXPIRED_LINK');
      expect(result.error?.message).toContain('expired');
      expect(result.error?.message).toContain('request a new link');
    });

    it('should accept links at exactly 24 hours (boundary case)', () => {
      const linkCreatedAt = Date.now();
      vi.setSystemTime(linkCreatedAt);

      const url = getValidatedHandshakeUrl(
        'JP-boundary-123',
        'manager@example.com'
      );

      const accessCodeMatch = url.match(/\/#\/go\/(.+)$/);
      const accessCode = decodeURIComponent(accessCodeMatch![1]);

      // Fast-forward time to exactly 24 hours (should still be valid)
      vi.setSystemTime(linkCreatedAt + TWENTY_FOUR_HOURS_MS);

      const result = HandshakeService.validate(accessCode);

      // At exactly 24 hours, should still be valid
      expect(result.success).toBe(true);
    });

    it('should accept legacy links without createdAt (backwards compatibility)', () => {
      // Create a legacy access code with valid checksum but no createdAt
      const jobId = 'JP-legacy-456';

      // Use HandshakeService to generate a proper checksum
      const accessCode = HandshakeService.generateAccessCode(
        jobId,
        'manager@example.com'
      );

      // Manually create a legacy payload without createdAt
      const decoded = JSON.parse(atob(accessCode));
      delete decoded.createdAt;
      const legacyAccessCode = btoa(JSON.stringify(decoded));

      const result = HandshakeService.validate(legacyAccessCode);

      // Legacy links should still work (no expiry check if createdAt missing)
      expect(result.success).toBe(true);
    });

    it('should include hours expired in error message', () => {
      const linkCreatedAt = Date.now();
      vi.setSystemTime(linkCreatedAt);

      const url = getValidatedHandshakeUrl(
        'JP-hours-123',
        'manager@example.com'
      );

      const accessCodeMatch = url.match(/\/#\/go\/(.+)$/);
      const accessCode = decodeURIComponent(accessCodeMatch![1]);

      // Fast-forward time by 48 hours
      vi.setSystemTime(linkCreatedAt + (48 * 60 * 60 * 1000));

      const result = HandshakeService.validate(accessCode);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('EXPIRED_LINK');
      // Should mention how many hours ago it expired
      expect(result.error?.message).toMatch(/\d+\s*hours?\s*ago/i);
    });
  });
});
