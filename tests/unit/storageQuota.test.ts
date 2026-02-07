/**
 * Storage Quota Tests
 *
 * Tests for safe localStorage handling when quota is exceeded
 * - safeSetItem graceful error handling
 * - Quota exceeded callbacks
 * - Storage quota detection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { safeSetItem, safeRemoveItem, onQuotaExceeded, getStorageSummary } from '../../lib/utils/safeLocalStorage';

describe('safeLocalStorage', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('safeSetItem', () => {
    it('returns true when successfully setting item', async () => {
      const result = await safeSetItem('test-key', 'test-value');
      expect(result).toBe(true);
      expect(localStorage.getItem('test-key')).toBe('test-value');
    });

    it('returns true for JSON stringified data', async () => {
      const data = { id: '123', name: 'Test Job' };
      const result = await safeSetItem('jobs', JSON.stringify(data));
      expect(result).toBe(true);

      const retrieved = JSON.parse(localStorage.getItem('jobs') || '{}');
      expect(retrieved.id).toBe('123');
    });

    it('returns false when QuotaExceededError is thrown', async () => {
      // Mock localStorage.setItem to throw QuotaExceededError
      const originalSetItem = Storage.prototype.setItem;
      const quotaError = new DOMException('QuotaExceededError', 'QuotaExceededError');

      Storage.prototype.setItem = vi.fn(() => {
        throw quotaError;
      });

      try {
        const result = await safeSetItem('test-key', 'large-value');
        expect(result).toBe(false);
      } finally {
        Storage.prototype.setItem = originalSetItem;
      }
    });

    it('throws on non-quota errors', async () => {
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = vi.fn(() => {
        throw new Error('Unexpected error');
      });

      try {
        await expect(safeSetItem('test-key', 'value')).rejects.toThrow('Unexpected error');
      } finally {
        Storage.prototype.setItem = originalSetItem;
      }
    });

    it('triggers onQuotaExceeded callbacks when quota exceeded', async () => {
      const callback = vi.fn();
      onQuotaExceeded(callback);

      // Mock storage.estimate API for quota check
      const originalEstimate = navigator.storage?.estimate;
      if (!navigator.storage) {
        (navigator as any).storage = {};
      }
      navigator.storage.estimate = vi.fn().mockResolvedValue({
        usage: 4500000, // 4.5MB
        quota: 5000000, // 5MB
      });

      const originalSetItem = Storage.prototype.setItem;
      const quotaError = new DOMException('QuotaExceededError', 'QuotaExceededError');

      Storage.prototype.setItem = vi.fn(() => {
        throw quotaError;
      });

      try {
        await safeSetItem('test-key', 'value');

        // Callback should be called with usage info
        expect(callback).toHaveBeenCalled();
        const callArg = callback.mock.calls[0][0];
        expect(callArg).toHaveProperty('usage');
        expect(callArg).toHaveProperty('quota');
        expect(callArg).toHaveProperty('percent');
      } finally {
        Storage.prototype.setItem = originalSetItem;
        if (originalEstimate) {
          navigator.storage.estimate = originalEstimate;
        }
      }
    });
  });

  describe('safeRemoveItem', () => {
    it('removes item from localStorage', () => {
      localStorage.setItem('test-key', 'test-value');
      expect(localStorage.getItem('test-key')).toBe('test-value');

      safeRemoveItem('test-key');
      expect(localStorage.getItem('test-key')).toBeNull();
    });

    it('handles errors gracefully', () => {
      const originalRemoveItem = Storage.prototype.removeItem;
      Storage.prototype.removeItem = vi.fn(() => {
        throw new Error('Remove failed');
      });

      try {
        // Should not throw
        expect(() => safeRemoveItem('test-key')).not.toThrow();
      } finally {
        Storage.prototype.removeItem = originalRemoveItem;
      }
    });
  });

  describe('onQuotaExceeded callbacks', () => {
    it('registers callback and returns unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = onQuotaExceeded(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('multiple callbacks can be registered', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      onQuotaExceeded(callback1);
      onQuotaExceeded(callback2);

      // Mock storage.estimate
      if (!navigator.storage) {
        (navigator as any).storage = {};
      }
      navigator.storage.estimate = vi.fn().mockResolvedValue({
        usage: 4900000,
        quota: 5000000,
      });

      const originalSetItem = Storage.prototype.setItem;
      const quotaError = new DOMException('QuotaExceededError', 'QuotaExceededError');

      Storage.prototype.setItem = vi.fn(() => {
        throw quotaError;
      });

      try {
        await safeSetItem('test', 'value');

        // Both callbacks should be called
        expect(callback1).toHaveBeenCalled();
        expect(callback2).toHaveBeenCalled();
      } finally {
        Storage.prototype.setItem = originalSetItem;
      }
    });
  });

  describe('getStorageSummary', () => {
    it('returns storage summary object with required properties', async () => {
      // Note: getStorageSummary uses cached values from storageQuota.ts,
      // so we test that it returns proper structure when storage API is available
      const result = await getStorageSummary();

      // Should return null or object with required properties
      if (result !== null) {
        expect(result).toHaveProperty('message');
        expect(result).toHaveProperty('isCritical');
        expect(result).toHaveProperty('isLow');
        expect(result).toHaveProperty('percent');
        expect(result).toHaveProperty('available');

        // Verify types
        expect(typeof result.message).toBe('string');
        expect(typeof result.isCritical).toBe('boolean');
        expect(typeof result.isLow).toBe('boolean');
        expect(typeof result.percent).toBe('number');
        expect(typeof result.available).toBe('string');

        // Percent should be 0-100
        expect(result.percent).toBeGreaterThanOrEqual(0);
        expect(result.percent).toBeLessThanOrEqual(100);
      }
    });

    it('returns message indicating storage status', async () => {
      const result = await getStorageSummary();

      if (result !== null) {
        // Message should contain status information
        expect(result.message.length).toBeGreaterThan(0);

        // If critical, message should indicate that
        if (result.isCritical) {
          expect(result.message.toLowerCase()).toContain('full');
        }

        // If low, message should indicate that
        if (result.isLow && !result.isCritical) {
          expect(result.message.toLowerCase()).toMatch(/full|available/i);
        }
      }
    });
  });
});
