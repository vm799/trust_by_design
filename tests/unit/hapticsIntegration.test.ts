/**
 * Haptics Integration Tests
 *
 * Verifies that critical save/submit actions have haptic feedback wired.
 * Tests import analysis - confirms haptics module is imported in key files.
 */

import { describe, it, expect, vi } from 'vitest';
import * as haptics from '../../lib/haptics';

describe('Haptics Integration', () => {
  describe('haptics module', () => {
    it('should export hapticTap function', () => {
      expect(typeof haptics.hapticTap).toBe('function');
    });

    it('should export hapticSuccess function', () => {
      expect(typeof haptics.hapticSuccess).toBe('function');
    });

    it('should export hapticConfirm function', () => {
      expect(typeof haptics.hapticConfirm).toBe('function');
    });

    it('should export hapticWarning function', () => {
      expect(typeof haptics.hapticWarning).toBe('function');
    });

    it('should export hapticCritical function', () => {
      expect(typeof haptics.hapticCritical).toBe('function');
    });

    it('should export isHapticsSupported function', () => {
      expect(typeof haptics.isHapticsSupported).toBe('function');
    });
  });

  describe('graceful degradation', () => {
    it('should not throw when vibrate API is missing', () => {
      // jsdom does not have navigator.vibrate
      expect(() => haptics.hapticTap()).not.toThrow();
      expect(() => haptics.hapticSuccess()).not.toThrow();
      expect(() => haptics.hapticConfirm()).not.toThrow();
      expect(() => haptics.hapticWarning()).not.toThrow();
      expect(() => haptics.hapticCritical()).not.toThrow();
    });

    it('should return false for isHapticsSupported in test environment', () => {
      // jsdom does not support vibrate
      expect(haptics.isHapticsSupported()).toBe(false);
    });

    it('should call navigator.vibrate when supported', () => {
      // Temporarily add vibrate to navigator
      const mockVibrate = vi.fn();
      Object.defineProperty(navigator, 'vibrate', {
        value: mockVibrate,
        writable: true,
        configurable: true,
      });

      haptics.hapticTap();
      expect(mockVibrate).toHaveBeenCalledWith(10);

      haptics.hapticSuccess();
      expect(mockVibrate).toHaveBeenCalledWith([15, 50, 15]);

      haptics.hapticConfirm();
      expect(mockVibrate).toHaveBeenCalledWith([20, 100, 20, 100, 30]);

      // Clean up
      Object.defineProperty(navigator, 'vibrate', {
        value: undefined,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('critical file imports', () => {
    it('EvidenceCapture should import haptics', async () => {
      // Verify the file contains haptic imports via static analysis
      const fs = await import('fs');
      const content = fs.readFileSync('views/tech/EvidenceCapture.tsx', 'utf-8');
      expect(content).toContain("import");
      expect(content).toContain("haptic");
    });

    it('TechJobDetail should import haptics', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('views/tech/TechJobDetail.tsx', 'utf-8');
      expect(content).toContain("haptic");
    });

    it('JobForm should import haptics', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('views/app/jobs/JobForm.tsx', 'utf-8');
      expect(content).toContain("haptic");
    });

    it('TechEvidenceReview should import haptics', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('views/tech/TechEvidenceReview.tsx', 'utf-8');
      expect(content).toContain("haptic");
    });
  });
});
