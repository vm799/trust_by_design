/**
 * Navigation Intent Service Tests
 * ================================
 *
 * Tests for the UX Flow Contract navigation intent persistence system.
 * Verifies that navigation intent is properly captured, stored, retrieved,
 * and cleared during the auth flow.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  captureNavigationIntent,
  captureNavigationIntentFromUrl,
  getNavigationIntent,
  clearNavigationIntent,
  hasValidIntent,
  isIntentExpired,
  getIntentExpiryInfo,
  createJobIntent,
  resumeIntentAndGetPath,
  isAtIntendedDestination,
  NavigationIntent,
} from '../../lib/navigationIntent';

// Mock sessionStorage
const mockStorage: Record<string, string> = {};
const mockSessionStorage = {
  getItem: vi.fn((key: string) => mockStorage[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    mockStorage[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStorage[key];
  }),
  clear: vi.fn(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
  }),
  length: 0,
  key: vi.fn(),
};

// Mock window.location
const mockLocation = {
  hash: '',
  pathname: '/',
  search: '',
  origin: 'https://jobproof.pro',
};

describe('navigationIntent', () => {
  beforeEach(() => {
    // Reset mocks
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    vi.stubGlobal('sessionStorage', mockSessionStorage);
    vi.stubGlobal('window', {
      location: mockLocation,
    });
    mockLocation.hash = '';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('captureNavigationIntent', () => {
    it('stores intent in sessionStorage', () => {
      const intent: NavigationIntent = {
        type: 'JOB_LINK',
        path: '/admin/jobs/123',
        jobId: '123',
        action: 'VIEW',
        timestamp: Date.now(),
      };

      captureNavigationIntent(intent);

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'jobproof_navigation_intent',
        JSON.stringify(intent)
      );
    });
  });

  describe('getNavigationIntent', () => {
    it('retrieves stored intent', () => {
      const intent: NavigationIntent = {
        type: 'JOB_LINK',
        path: '/admin/jobs/123',
        jobId: '123',
        action: 'VIEW',
        timestamp: Date.now(),
      };

      mockStorage['jobproof_navigation_intent'] = JSON.stringify(intent);

      const retrieved = getNavigationIntent();

      expect(retrieved).toEqual(intent);
    });

    it('returns null if no intent stored', () => {
      const retrieved = getNavigationIntent();

      expect(retrieved).toBeNull();
    });

    it('returns null and clears expired intent', () => {
      const expiredIntent: NavigationIntent = {
        type: 'JOB_LINK',
        path: '/admin/jobs/123',
        jobId: '123',
        action: 'VIEW',
        timestamp: Date.now() - 31 * 60 * 1000, // 31 minutes ago (expired)
      };

      mockStorage['jobproof_navigation_intent'] = JSON.stringify(expiredIntent);

      const retrieved = getNavigationIntent();

      expect(retrieved).toBeNull();
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(
        'jobproof_navigation_intent'
      );
    });
  });

  describe('clearNavigationIntent', () => {
    it('removes intent from sessionStorage', () => {
      mockStorage['jobproof_navigation_intent'] = JSON.stringify({
        type: 'GENERAL',
        path: '/admin',
        timestamp: Date.now(),
      });

      clearNavigationIntent();

      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(
        'jobproof_navigation_intent'
      );
    });
  });

  describe('hasValidIntent', () => {
    it('returns true when valid intent exists', () => {
      const intent: NavigationIntent = {
        type: 'JOB_LINK',
        path: '/admin/jobs/123',
        timestamp: Date.now(),
      };

      mockStorage['jobproof_navigation_intent'] = JSON.stringify(intent);

      expect(hasValidIntent()).toBe(true);
    });

    it('returns false when no intent exists', () => {
      expect(hasValidIntent()).toBe(false);
    });

    it('returns false when intent is expired', () => {
      const expiredIntent: NavigationIntent = {
        type: 'JOB_LINK',
        path: '/admin/jobs/123',
        timestamp: Date.now() - 31 * 60 * 1000,
      };

      mockStorage['jobproof_navigation_intent'] = JSON.stringify(expiredIntent);

      expect(hasValidIntent()).toBe(false);
    });
  });

  describe('isIntentExpired', () => {
    it('returns false for fresh intent', () => {
      const intent: NavigationIntent = {
        type: 'JOB_LINK',
        path: '/admin/jobs/123',
        timestamp: Date.now(),
      };

      expect(isIntentExpired(intent)).toBe(false);
    });

    it('returns true for intent older than 30 minutes', () => {
      const intent: NavigationIntent = {
        type: 'JOB_LINK',
        path: '/admin/jobs/123',
        timestamp: Date.now() - 31 * 60 * 1000,
      };

      expect(isIntentExpired(intent)).toBe(true);
    });

    it('returns false for intent exactly at 30 minutes', () => {
      const intent: NavigationIntent = {
        type: 'JOB_LINK',
        path: '/admin/jobs/123',
        timestamp: Date.now() - 30 * 60 * 1000,
      };

      expect(isIntentExpired(intent)).toBe(false);
    });
  });

  describe('getIntentExpiryInfo', () => {
    it('returns correct expiry info for fresh intent', () => {
      const intent: NavigationIntent = {
        type: 'JOB_LINK',
        path: '/admin/jobs/123',
        timestamp: Date.now(),
      };

      const info = getIntentExpiryInfo(intent);

      expect(info.isExpired).toBe(false);
      expect(info.remainingMinutes).toBe(30);
    });

    it('returns expired info for old intent', () => {
      const intent: NavigationIntent = {
        type: 'JOB_LINK',
        path: '/admin/jobs/123',
        timestamp: Date.now() - 31 * 60 * 1000,
      };

      const info = getIntentExpiryInfo(intent);

      expect(info.isExpired).toBe(true);
      expect(info.remainingMs).toBe(0);
      expect(info.remainingMinutes).toBe(0);
    });
  });

  describe('createJobIntent', () => {
    it('creates VIEW intent with correct path', () => {
      const intent = createJobIntent('JOB-123', 'VIEW');

      expect(intent.type).toBe('JOB_LINK');
      expect(intent.path).toBe('/admin/jobs/JOB-123');
      expect(intent.action).toBe('VIEW');
      expect(intent.jobId).toBe('JOB-123');
    });

    it('creates EDIT intent with correct path', () => {
      const intent = createJobIntent('JOB-456', 'EDIT');

      expect(intent.path).toBe('/admin/jobs/JOB-456/edit');
      expect(intent.action).toBe('EDIT');
    });

    it('creates COMPLETE intent with correct path', () => {
      const intent = createJobIntent('JOB-789', 'COMPLETE');

      expect(intent.path).toBe('/tech/jobs/JOB-789/complete');
      expect(intent.action).toBe('COMPLETE');
    });

    it('creates UPLOAD intent with correct path', () => {
      const intent = createJobIntent('JOB-ABC', 'UPLOAD');

      expect(intent.path).toBe('/tech/jobs/JOB-ABC/evidence');
      expect(intent.action).toBe('UPLOAD');
    });

    it('includes email when provided', () => {
      const intent = createJobIntent('JOB-123', 'VIEW', 'user@example.com');

      expect(intent.email).toBe('user@example.com');
    });
  });

  describe('resumeIntentAndGetPath', () => {
    it('returns stored path and clears intent', () => {
      const intent: NavigationIntent = {
        type: 'JOB_LINK',
        path: '/admin/jobs/123',
        timestamp: Date.now(),
      };

      mockStorage['jobproof_navigation_intent'] = JSON.stringify(intent);

      const path = resumeIntentAndGetPath();

      expect(path).toBe('/admin/jobs/123');
      expect(mockSessionStorage.removeItem).toHaveBeenCalled();
    });

    it('returns "/" when no intent exists', () => {
      const path = resumeIntentAndGetPath();

      expect(path).toBe('/');
    });
  });

  describe('captureNavigationIntentFromUrl', () => {
    it('returns null for root path', () => {
      mockLocation.hash = '#/';

      const intent = captureNavigationIntentFromUrl();

      expect(intent).toBeNull();
    });

    it('returns null for auth routes', () => {
      mockLocation.hash = '#/auth';

      const intent = captureNavigationIntentFromUrl();

      expect(intent).toBeNull();
    });

    it('returns null for auth callback', () => {
      mockLocation.hash = '#/auth/callback';

      const intent = captureNavigationIntentFromUrl();

      expect(intent).toBeNull();
    });

    it('captures job link intent from admin job path', () => {
      mockLocation.hash = '#/admin/jobs/JOB-123';

      const intent = captureNavigationIntentFromUrl();

      expect(intent).not.toBeNull();
      expect(intent?.type).toBe('JOB_LINK');
      expect(intent?.jobId).toBe('JOB-123');
      expect(intent?.action).toBe('VIEW');
    });

    it('captures edit action from path', () => {
      mockLocation.hash = '#/admin/jobs/JOB-456/edit';

      const intent = captureNavigationIntentFromUrl();

      expect(intent?.action).toBe('EDIT');
    });

    it('captures general intent from non-job path', () => {
      mockLocation.hash = '#/admin/clients';

      const intent = captureNavigationIntentFromUrl();

      expect(intent).not.toBeNull();
      expect(intent?.type).toBe('GENERAL');
      expect(intent?.path).toBe('/admin/clients');
    });

    it('captures run job intent', () => {
      mockLocation.hash = '#/run/JOB-789';

      const intent = captureNavigationIntentFromUrl();

      expect(intent?.type).toBe('JOB_LINK');
      expect(intent?.jobId).toBe('JOB-789');
    });

    it('captures QR code intent', () => {
      mockLocation.hash = '#/qr/JOB-ABC';

      const intent = captureNavigationIntentFromUrl();

      expect(intent?.type).toBe('QR_CODE');
    });

    it('captures notification intent from query param', () => {
      mockLocation.hash = '#/admin/jobs/JOB-123?source=notification';

      const intent = captureNavigationIntentFromUrl();

      expect(intent?.type).toBe('NOTIFICATION');
    });
  });

  describe('isAtIntendedDestination', () => {
    it('returns true when no intent exists', () => {
      expect(isAtIntendedDestination()).toBe(true);
    });

    it('returns true when at intended path', () => {
      mockLocation.hash = '#/admin/jobs/123';

      const intent: NavigationIntent = {
        type: 'JOB_LINK',
        path: '/admin/jobs/123',
        timestamp: Date.now(),
      };

      mockStorage['jobproof_navigation_intent'] = JSON.stringify(intent);

      expect(isAtIntendedDestination()).toBe(true);
    });

    it('returns false when not at intended path', () => {
      mockLocation.hash = '#/admin';

      const intent: NavigationIntent = {
        type: 'JOB_LINK',
        path: '/admin/jobs/123',
        timestamp: Date.now(),
      };

      mockStorage['jobproof_navigation_intent'] = JSON.stringify(intent);

      expect(isAtIntendedDestination()).toBe(false);
    });
  });
});
