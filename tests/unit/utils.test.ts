import { describe, it, expect } from 'vitest';
import type { Photo, SafetyCheck, JobStatus, SyncStatus, PhotoType } from '@/types';
import { createMockJob } from '../mocks/mockData';

/**
 * UNIT TEST SUITE: TYPE VALIDATION & UTILITY FUNCTIONS
 *
 * Tests type safety, data validation, and utility helper functions
 */

describe('Type Validation & Utilities', () => {
  describe('Job Type Validation', () => {
    it('should validate Job type structure', () => {
      const job = createMockJob({
        id: 'job-1',
        title: 'Test Job',
        client: 'Test Client',
        status: 'Pending',
      });

      // Validate required fields
      expect(job).toHaveProperty('id');
      expect(job).toHaveProperty('title');
      expect(job).toHaveProperty('client');
      expect(job).toHaveProperty('status');
      expect(job).toHaveProperty('photos');
      expect(job).toHaveProperty('signature');
      expect(job).toHaveProperty('safetyChecklist');
      expect(job).toHaveProperty('syncStatus');

      // Validate types
      expect(typeof job.id).toBe('string');
      expect(typeof job.title).toBe('string');
      expect(Array.isArray(job.photos)).toBe(true);
      expect(Array.isArray(job.safetyChecklist)).toBe(true);
    });

    it('should support all JobStatus values', () => {
      const statuses: JobStatus[] = ['Pending', 'In Progress', 'Submitted', 'Archived'];

      statuses.forEach((status) => {
        const job = createMockJob({ status });
        expect(job.status).toBe(status);
      });
    });

    it('should support all SyncStatus values', () => {
      const syncStatuses: SyncStatus[] = ['synced', 'pending', 'failed'];

      syncStatuses.forEach((syncStatus) => {
        const job = createMockJob({ syncStatus });
        expect(job.syncStatus).toBe(syncStatus);
      });
    });

    it('should validate sealing-related fields', () => {
      const job = createMockJob({
        sealedAt: '2024-01-15T10:00:00Z',
        sealedBy: 'test@example.com',
        evidenceHash: 'abc123',
        isSealed: true,
      });

      expect(job.sealedAt).toBe('2024-01-15T10:00:00Z');
      expect(job.sealedBy).toBe('test@example.com');
      expect(job.evidenceHash).toBe('abc123');
      expect(job.isSealed).toBe(true);
    });

    it('should validate workspace isolation', () => {
      const job1 = createMockJob({ workspaceId: 'workspace-1' });
      const job2 = createMockJob({ workspaceId: 'workspace-2' });

      expect(job1.workspaceId).not.toBe(job2.workspaceId);
    });
  });

  describe('Photo Type Validation', () => {
    it('should validate Photo type structure', () => {
      const photo: Photo = {
        id: 'photo-1',
        url: 'https://example.com/photo.jpg',
        timestamp: new Date().toISOString(),
        verified: true,
        syncStatus: 'synced',
        type: 'Before',
        isIndexedDBRef: false,
      };

      expect(photo).toHaveProperty('id');
      expect(photo).toHaveProperty('url');
      expect(photo).toHaveProperty('timestamp');
      expect(photo).toHaveProperty('verified');
      expect(photo).toHaveProperty('syncStatus');
      expect(photo).toHaveProperty('type');
    });

    it('should support all PhotoType values', () => {
      const types: PhotoType[] = ['Before', 'During', 'After', 'Evidence'];

      types.forEach((type) => {
        const photo: Photo = {
          id: `photo-${type}`,
          url: 'https://example.com/photo.jpg',
          timestamp: new Date().toISOString(),
          verified: true,
          syncStatus: 'synced',
          type,
          isIndexedDBRef: false,
        };

        expect(photo.type).toBe(type);
      });
    });

    it('should differentiate between cloud URL and IndexedDB reference', () => {
      const cloudPhoto: Photo = {
        id: 'photo-1',
        url: 'https://storage.supabase.co/photo.jpg',
        timestamp: new Date().toISOString(),
        verified: true,
        syncStatus: 'synced',
        type: 'Before',
        isIndexedDBRef: false,
      };

      const offlinePhoto: Photo = {
        id: 'photo-2',
        url: 'media_abc123',
        timestamp: new Date().toISOString(),
        verified: false,
        syncStatus: 'pending',
        type: 'Before',
        isIndexedDBRef: true,
      };

      expect(cloudPhoto.isIndexedDBRef).toBe(false);
      expect(cloudPhoto.syncStatus).toBe('synced');

      expect(offlinePhoto.isIndexedDBRef).toBe(true);
      expect(offlinePhoto.syncStatus).toBe('pending');
    });

    it('should include optional geolocation data', () => {
      const photo: Photo = {
        id: 'photo-1',
        url: 'https://example.com/photo.jpg',
        timestamp: new Date().toISOString(),
        lat: 40.7128,
        lng: -74.006,
        w3w: 'index.home.raft',
        verified: true,
        syncStatus: 'synced',
        type: 'Before',
        isIndexedDBRef: false,
      };

      expect(photo.lat).toBe(40.7128);
      expect(photo.lng).toBe(-74.006);
      expect(photo.w3w).toBe('index.home.raft');
    });
  });

  describe('SafetyCheck Type Validation', () => {
    it('should validate SafetyCheck type structure', () => {
      const check: SafetyCheck = {
        id: 'safety-1',
        label: 'PPE worn',
        checked: true,
        required: true,
      };

      expect(check).toHaveProperty('id');
      expect(check).toHaveProperty('label');
      expect(check).toHaveProperty('checked');
      expect(check).toHaveProperty('required');
    });

    it('should differentiate between required and optional checks', () => {
      const requiredCheck: SafetyCheck = {
        id: 'safety-1',
        label: 'Hard hat worn',
        checked: true,
        required: true,
      };

      const optionalCheck: SafetyCheck = {
        id: 'safety-2',
        label: 'Additional protective equipment',
        checked: false,
        required: false,
      };

      expect(requiredCheck.required).toBe(true);
      expect(optionalCheck.required).toBe(false);
    });
  });

  describe('Data Validation Helpers', () => {
    describe('isValidEmail', () => {
      const isValidEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      };

      it('should validate correct email addresses', () => {
        expect(isValidEmail('test@example.com')).toBe(true);
        expect(isValidEmail('user.name@company.co.uk')).toBe(true);
        expect(isValidEmail('admin+tag@domain.org')).toBe(true);
      });

      it('should reject invalid email addresses', () => {
        expect(isValidEmail('invalid')).toBe(false);
        expect(isValidEmail('missing@domain')).toBe(false);
        expect(isValidEmail('@nodomain.com')).toBe(false);
        expect(isValidEmail('spaces in@email.com')).toBe(false);
      });
    });

    describe('isValidPhoneNumber', () => {
      const isValidPhoneNumber = (phone: string): boolean => {
        // Basic validation for international format
        const cleaned = phone.replace(/[\s\-()]/g, '');
        const phoneRegex = /^\+?[1-9]\d{7,14}$/; // Minimum 8 digits (including country code)
        return phoneRegex.test(cleaned);
      };

      it('should validate correct phone numbers', () => {
        expect(isValidPhoneNumber('+1234567890')).toBe(true);
        expect(isValidPhoneNumber('+44 20 1234 5678')).toBe(true);
        expect(isValidPhoneNumber('(555) 123-4567')).toBe(true);
      });

      it('should reject invalid phone numbers', () => {
        expect(isValidPhoneNumber('abc')).toBe(false);
        expect(isValidPhoneNumber('123')).toBe(false);
        expect(isValidPhoneNumber('+0000000000')).toBe(false);
      });
    });

    describe('isValidURL', () => {
      const isValidURL = (url: string): boolean => {
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      };

      it('should validate correct URLs', () => {
        expect(isValidURL('https://example.com')).toBe(true);
        expect(isValidURL('http://localhost:3000')).toBe(true);
        expect(isValidURL('https://api.example.com/path?query=value')).toBe(true);
      });

      it('should reject invalid URLs', () => {
        expect(isValidURL('not a url')).toBe(false);
        expect(isValidURL('missing-protocol.com')).toBe(false);
        expect(isValidURL('')).toBe(false);
      });
    });

    describe('isValidCoordinates', () => {
      const isValidCoordinates = (lat: number, lng: number): boolean => {
        return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
      };

      it('should validate correct coordinates', () => {
        expect(isValidCoordinates(40.7128, -74.006)).toBe(true);
        expect(isValidCoordinates(0, 0)).toBe(true);
        expect(isValidCoordinates(90, 180)).toBe(true);
        expect(isValidCoordinates(-90, -180)).toBe(true);
      });

      it('should reject out-of-range coordinates', () => {
        expect(isValidCoordinates(91, 0)).toBe(false);
        expect(isValidCoordinates(-91, 0)).toBe(false);
        expect(isValidCoordinates(0, 181)).toBe(false);
        expect(isValidCoordinates(0, -181)).toBe(false);
      });
    });

    describe('isValidWhat3Words', () => {
      const isValidWhat3Words = (w3w: string): boolean => {
        // Format: word.word.word (each word is 3+ chars, lowercase/numbers)
        const w3wRegex = /^[a-z0-9]{3,}\.[a-z0-9]{3,}\.[a-z0-9]{3,}$/;
        return w3wRegex.test(w3w);
      };

      it('should validate correct what3words addresses', () => {
        expect(isValidWhat3Words('index.home.raft')).toBe(true);
        expect(isValidWhat3Words('filled.count.soap')).toBe(true);
        expect(isValidWhat3Words('abc123.def456.ghi789')).toBe(true);
      });

      it('should reject invalid what3words addresses', () => {
        expect(isValidWhat3Words('invalid')).toBe(false);
        expect(isValidWhat3Words('one.two')).toBe(false);
        expect(isValidWhat3Words('AB.CD.EF')).toBe(false); // Uppercase
        expect(isValidWhat3Words('a.b.c')).toBe(false); // Too short
      });
    });
  });

  describe('Date & Time Helpers', () => {
    describe('formatDate', () => {
      const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
      };

      it('should format ISO date strings', () => {
        const formatted = formatDate('2024-01-15T10:00:00Z');
        expect(formatted).toMatch(/\d{2}\s\w{3}\s\d{4}/);
      });

      it('should handle different date formats', () => {
        expect(formatDate('2024-01-15')).toBeDefined();
        expect(formatDate('2024-01-15T00:00:00')).toBeDefined();
      });
    });

    describe('formatTimestamp', () => {
      const formatTimestamp = (timestamp: number): string => {
        const date = new Date(timestamp);
        return date.toLocaleString('en-GB');
      };

      it('should format Unix timestamps', () => {
        const now = Date.now();
        const formatted = formatTimestamp(now);

        expect(formatted).toBeDefined();
        expect(typeof formatted).toBe('string');
      });
    });

    describe('isExpired', () => {
      const isExpired = (expiresAt: string): boolean => {
        return new Date(expiresAt) < new Date();
      };

      it('should detect expired timestamps', () => {
        const pastDate = new Date(Date.now() - 1000).toISOString();
        expect(isExpired(pastDate)).toBe(true);
      });

      it('should detect non-expired timestamps', () => {
        const futureDate = new Date(Date.now() + 1000).toISOString();
        expect(isExpired(futureDate)).toBe(false);
      });
    });
  });

  describe('Data Sanitization', () => {
    describe('sanitizeString', () => {
      const sanitizeString = (input: string): string => {
        return input.trim().replace(/\s+/g, ' ');
      };

      it('should trim whitespace', () => {
        expect(sanitizeString('  hello  ')).toBe('hello');
        expect(sanitizeString('\n\ttest\n')).toBe('test');
      });

      it('should collapse multiple spaces', () => {
        expect(sanitizeString('hello    world')).toBe('hello world');
        expect(sanitizeString('test   multiple   spaces')).toBe('test multiple spaces');
      });
    });

    describe('truncateString', () => {
      const truncateString = (str: string, maxLength: number): string => {
        if (str.length <= maxLength) return str;
        return str.substring(0, maxLength - 3) + '...';
      };

      it('should truncate long strings', () => {
        expect(truncateString('Hello World', 8)).toBe('Hello...');
        expect(truncateString('Short', 10)).toBe('Short');
      });

      it('should handle edge cases', () => {
        expect(truncateString('', 10)).toBe('');
        expect(truncateString('abc', 3)).toBe('abc');
      });
    });
  });

  describe('Array Helpers', () => {
    describe('groupBy', () => {
      const groupBy = <T, K extends keyof any>(
        array: T[],
        key: (item: T) => K
      ): Record<K, T[]> => {
        return array.reduce((result, item) => {
          const groupKey = key(item);
          if (!result[groupKey]) {
            result[groupKey] = [];
          }
          result[groupKey].push(item);
          return result;
        }, {} as Record<K, T[]>);
      };

      it('should group photos by type', () => {
        const photos: Photo[] = [
          {
            id: '1',
            type: 'Before',
            url: 'url1',
            timestamp: '',
            verified: true,
            syncStatus: 'synced',
            isIndexedDBRef: false,
          },
          {
            id: '2',
            type: 'Before',
            url: 'url2',
            timestamp: '',
            verified: true,
            syncStatus: 'synced',
            isIndexedDBRef: false,
          },
          {
            id: '3',
            type: 'After',
            url: 'url3',
            timestamp: '',
            verified: true,
            syncStatus: 'synced',
            isIndexedDBRef: false,
          },
        ];

        const grouped = groupBy(photos, (p) => p.type);

        expect(grouped.Before).toHaveLength(2);
        expect(grouped.After).toHaveLength(1);
      });

      it('should group jobs by status', () => {
        const jobs = [
          createMockJob({ status: 'Pending' }),
          createMockJob({ status: 'Pending' }),
          createMockJob({ status: 'Submitted' }),
        ];

        const grouped = groupBy(jobs, (j) => j.status);

        expect(grouped.Pending).toHaveLength(2);
        expect(grouped.Submitted).toHaveLength(1);
      });
    });

    describe('sortBy', () => {
      const sortBy = <T>(array: T[], key: keyof T, order: 'asc' | 'desc' = 'asc'): T[] => {
        return [...array].sort((a, b) => {
          const aVal = a[key];
          const bVal = b[key];

          if (aVal < bVal) return order === 'asc' ? -1 : 1;
          if (aVal > bVal) return order === 'asc' ? 1 : -1;
          return 0;
        });
      };

      it('should sort jobs by date ascending', () => {
        const jobs = [
          createMockJob({ id: '1', date: '2024-01-15' }),
          createMockJob({ id: '2', date: '2024-01-10' }),
          createMockJob({ id: '3', date: '2024-01-20' }),
        ];

        const sorted = sortBy(jobs, 'date', 'asc');

        expect(sorted[0].date).toBe('2024-01-10');
        expect(sorted[2].date).toBe('2024-01-20');
      });

      it('should sort jobs by date descending', () => {
        const jobs = [
          createMockJob({ id: '1', date: '2024-01-15' }),
          createMockJob({ id: '2', date: '2024-01-10' }),
          createMockJob({ id: '3', date: '2024-01-20' }),
        ];

        const sorted = sortBy(jobs, 'date', 'desc');

        expect(sorted[0].date).toBe('2024-01-20');
        expect(sorted[2].date).toBe('2024-01-10');
      });
    });
  });
});
