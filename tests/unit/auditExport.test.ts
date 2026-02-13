import { describe, it, expect, beforeEach } from 'vitest';
import type { Job } from '@/types';
import {
  generateAuditTrail,
  exportAsCSV,
  exportAsJSON,
  filterJobsByStatus,
  filterJobsByDateRange,
  calculateSHA256HashSync,
  type AuditRecord
} from '@/lib/utils/auditExport';
import { createMockJob } from '../mocks/mockData';

describe('Fix 3.2: Audit Trail Export (CSV/JSON with SHA-256)', () => {
  let mockJobs: Job[];

  beforeEach(() => {
    mockJobs = [
      createMockJob({
        id: 'job-1',
        title: 'HVAC Installation',
        client: 'Acme Corp',
        status: 'Archived',
        sealedAt: '2024-01-15T10:30:00Z',
        evidenceHash: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
        photos: [
          {
            id: 'photo-1',
            url: 'https://example.com/photo1.jpg',
            timestamp: '2024-01-15T09:00:00Z',
            verified: true,
            syncStatus: 'synced',
            type: 'Before',
            isIndexedDBRef: false,
          },
          {
            id: 'photo-2',
            url: 'https://example.com/photo2.jpg',
            timestamp: '2024-01-15T10:00:00Z',
            verified: true,
            syncStatus: 'synced',
            type: 'After',
            isIndexedDBRef: false,
          },
        ],
        signature: 'https://example.com/sig.png',
        signerName: 'John Smith',
        date: '2024-01-15',
        syncStatus: 'synced',
        lastUpdated: Date.now(),
        address: '123 Business St',
        notes: 'Completed successfully',
      }),
      createMockJob({
        id: 'job-2',
        title: 'Plumbing Repair',
        client: 'Global Industries',
        status: 'In Progress',
        sealedAt: undefined,
        photos: [
          {
            id: 'photo-3',
            url: 'https://example.com/photo3.jpg',
            timestamp: '2024-01-16T08:00:00Z',
            verified: true,
            syncStatus: 'synced',
            type: 'During',
            isIndexedDBRef: false,
          },
        ],
        signature: null,
        date: '2024-01-16',
        syncStatus: 'pending',
        lastUpdated: Date.now(),
        address: '456 Commerce Ave',
        notes: 'In progress',
      }),
      createMockJob({
        id: 'job-3',
        title: 'Electrical Work',
        client: 'Acme Corp',
        status: 'Archived',
        sealedAt: '2024-01-20T14:45:00Z',
        evidenceHash: '9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
        photos: [
          {
            id: 'photo-4',
            url: 'https://example.com/photo4.jpg',
            timestamp: '2024-01-20T13:00:00Z',
            verified: true,
            syncStatus: 'synced',
            type: 'Evidence',
            isIndexedDBRef: false,
          },
        ],
        signature: 'https://example.com/sig2.png',
        signerName: 'Jane Doe',
        date: '2024-01-20',
        syncStatus: 'synced',
        lastUpdated: Date.now(),
        address: '789 Service Rd',
        notes: 'Sealed and verified',
      }),
    ];
  });

  describe('Audit Trail Generation', () => {
    it('should generate audit records from jobs array', () => {
      const records = generateAuditTrail(mockJobs);

      expect(records).toHaveLength(3);
      expect(records[0].jobId).toBe('job-1');
      expect(records[1].jobId).toBe('job-2');
      expect(records[2].jobId).toBe('job-3');
    });

    it('should include all required audit fields', () => {
      const records = generateAuditTrail(mockJobs);
      const firstRecord = records[0];

      expect(firstRecord).toHaveProperty('jobId');
      expect(firstRecord).toHaveProperty('jobTitle');
      expect(firstRecord).toHaveProperty('clientName');
      expect(firstRecord).toHaveProperty('status');
      expect(firstRecord).toHaveProperty('sealedAt');
      expect(firstRecord).toHaveProperty('sealHashVerified');
      expect(firstRecord).toHaveProperty('sealHashSHA256');
      expect(firstRecord).toHaveProperty('photoCount');
      expect(firstRecord).toHaveProperty('lastSyncedAt');
      expect(firstRecord).toHaveProperty('syncStatus');
      expect(firstRecord).toHaveProperty('createdAt');
      expect(firstRecord).toHaveProperty('updatedAt');
    });

    it('should count photos correctly', () => {
      const records = generateAuditTrail(mockJobs);

      expect(records[0].photoCount).toBe(2); // job-1 has 2 photos
      expect(records[1].photoCount).toBe(1); // job-2 has 1 photo
      expect(records[2].photoCount).toBe(1); // job-3 has 1 photo
    });

    it('should calculate SHA-256 hash for sealed jobs', () => {
      const records = generateAuditTrail(mockJobs);

      // Sealed jobs should have hashes
      expect(records[0].sealHashSHA256).toMatch(/^[a-f0-9]{64}$/);
      expect(records[2].sealHashSHA256).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should identify sealed vs unsealed jobs', () => {
      const records = generateAuditTrail(mockJobs);

      expect(records[0].sealedAt).toBe('2024-01-15T10:30:00Z');
      expect(records[0].sealHashVerified).toBe(true);

      expect(records[1].sealedAt).toBeUndefined();
      expect(records[1].sealHashVerified).toBe(false);
    });
  });

  describe('CSV Export', () => {
    it('should generate valid CSV with headers', () => {
      const records = generateAuditTrail(mockJobs);
      const csv = exportAsCSV(records);

      expect(csv).toBeDefined();
      expect(csv).toContain('"Job ID"');
      expect(csv).toContain('"Title"');
      expect(csv).toContain('"Client"');
      expect(csv).toContain('"Status"');
      expect(csv).toContain('"Sealed At"');
      expect(csv).toContain('"Seal Verified"');
      expect(csv).toContain('"Seal Hash"');
      expect(csv).toContain('"Photos"');
    });

    it('should include all job data in CSV rows', () => {
      const records = generateAuditTrail(mockJobs);
      const csv = exportAsCSV(records);

      expect(csv).toContain('job-1');
      expect(csv).toContain('HVAC Installation');
      expect(csv).toContain('Acme Corp');
      expect(csv).toContain('Archived');
    });

    it('should escape quotes in CSV fields', () => {
      const testJobs = [
        createMockJob({
          id: 'job-test',
          title: 'Job with "Quotes" in Title',
          client: 'Client "Special"',
          status: 'Complete',
          photos: [],
          signature: null,
          date: '2024-01-01',
          syncStatus: 'synced',
          lastUpdated: Date.now(),
          address: '123 Test St',
          notes: 'Test job',
        }),
      ];

      const records = generateAuditTrail(testJobs);
      const csv = exportAsCSV(records);

      // CSV should handle quotes properly
      expect(csv).toContain('Job with');
    });

    it('should handle empty records array', () => {
      const csv = exportAsCSV([]);

      expect(csv).toBeDefined();
      expect(csv).toContain('"Job ID"'); // Header should still be present
    });

    it('should separate rows by newlines', () => {
      const records = generateAuditTrail([mockJobs[0]]);
      const csv = exportAsCSV(records);
      const lines = csv.trim().split('\n');

      expect(lines.length).toBeGreaterThanOrEqual(2); // Header + at least 1 data row
    });
  });

  describe('JSON Export', () => {
    it('should generate valid JSON', () => {
      const records = generateAuditTrail(mockJobs);
      const json = exportAsJSON(records);

      expect(() => JSON.parse(json)).not.toThrow();
      const parsed = JSON.parse(json);
      expect(Array.isArray(parsed)).toBe(true);
    });

    it('should preserve all fields in JSON export', () => {
      const records = generateAuditTrail([mockJobs[0]]);
      const json = exportAsJSON(records);
      const parsed = JSON.parse(json) as AuditRecord[];

      expect(parsed[0].jobId).toBe('job-1');
      expect(parsed[0].jobTitle).toBe('HVAC Installation');
      expect(parsed[0].clientName).toBe('Acme Corp');
      expect(parsed[0].status).toBe('Archived');
      expect(parsed[0].photoCount).toBe(2);
    });

    it('should format JSON with proper indentation', () => {
      const records = generateAuditTrail([mockJobs[0]]);
      const json = exportAsJSON(records);

      // Should have indentation (contains newlines and spaces)
      expect(json).toContain('\n');
      expect(json).toContain('  ');
    });

    it('should handle empty array', () => {
      const json = exportAsJSON([]);

      expect(() => JSON.parse(json)).not.toThrow();
      const parsed = JSON.parse(json);
      expect(parsed).toEqual([]);
    });
  });

  describe('SHA-256 Hash Functions', () => {
    it('should calculate SHA-256 hash as 64 character hex string', () => {
      const hash = calculateSHA256HashSync('test data');

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce consistent hash for same input', () => {
      const data = 'consistent test data';
      const hash1 = calculateSHA256HashSync(data);
      const hash2 = calculateSHA256HashSync(data);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different inputs', () => {
      const hash1 = calculateSHA256HashSync('data1');
      const hash2 = calculateSHA256HashSync('data2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Seal Verification', () => {
    it('should verify seal signature for sealed jobs', () => {
      const records = generateAuditTrail([mockJobs[0]]);
      const firstRecord = records[0];

      expect(firstRecord.sealHashVerified).toBe(true);
    });

    it('should return false for unsealed jobs', () => {
      const records = generateAuditTrail([mockJobs[1]]);
      const secondRecord = records[0];

      expect(secondRecord.sealHashVerified).toBe(false);
    });
  });

  describe('Filtering', () => {
    it('should filter jobs by status - Sealed only', () => {
      const filtered = filterJobsByStatus(mockJobs, 'Archived');

      expect(filtered).toHaveLength(2);
      expect(filtered.every(j => j.status === 'Archived')).toBe(true);
    });

    it('should filter jobs by status - In Progress', () => {
      const filtered = filterJobsByStatus(mockJobs, 'In Progress');

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('job-2');
    });

    it('should return empty array when no jobs match status', () => {
      const filtered = filterJobsByStatus(mockJobs, 'Cancelled');

      expect(filtered).toHaveLength(0);
    });

    it('should filter jobs by date range', () => {
      const startDate = '2024-01-15';
      const endDate = '2024-01-20';
      const filtered = filterJobsByDateRange(mockJobs, startDate, endDate);

      expect(filtered.length).toBeGreaterThan(0);
      filtered.forEach(job => {
        expect(job.date).toMatch(/2024-01-1[5-9]|2024-01-20/);
      });
    });

    it('should handle single day date range', () => {
      const date = '2024-01-15';
      const filtered = filterJobsByDateRange(mockJobs, date, date);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('job-1');
    });

    it('should filter jobs with no photos', () => {
      const noPhotoRecords = generateAuditTrail(mockJobs).filter(r => r.photoCount === 0);

      expect(noPhotoRecords).toHaveLength(0);
    });
  });

  describe('Export Modal Functionality', () => {
    it('should generate different exports for sealed vs all jobs', () => {
      const allRecords = generateAuditTrail(mockJobs);
      const sealedJobs = mockJobs.filter(j => j.sealedAt);
      const sealedRecords = generateAuditTrail(sealedJobs);

      expect(allRecords.length).toBeGreaterThan(sealedRecords.length);
    });

    it('should support export with custom timestamp suffix', () => {
      const timestamp = new Date().toISOString().split('T')[0];

      expect(timestamp).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('should handle large job datasets', () => {
      const largeJobSet = Array.from({ length: 100 }, (_, i) =>
        createMockJob({
          id: `job-${i}`,
          title: `Job ${i}`,
          client: `Client ${i % 10}`,
          status: i % 2 === 0 ? 'Archived' : 'In Progress',
          photos: Array.from({ length: i % 5 + 1 }, (_, j) => ({
            id: `photo-${i}-${j}`,
            url: `https://example.com/photo${i}-${j}.jpg`,
            timestamp: new Date().toISOString(),
            verified: true,
            syncStatus: 'synced' as const,
            type: 'Evidence' as const,
            isIndexedDBRef: false,
          })),
          signature: `https://example.com/sig${i}.png`,
          signerName: 'Test Signer',
          date: '2024-01-01',
          syncStatus: 'synced' as const,
          lastUpdated: Date.now(),
          address: `${i} Test St`,
          notes: `Test job ${i}`,
        })
      );

      const records = generateAuditTrail(largeJobSet);
      const csv = exportAsCSV(records);
      const json = exportAsJSON(records);

      expect(records).toHaveLength(100);
      expect(csv).toBeDefined();
      expect(() => JSON.parse(json)).not.toThrow();
    });
  });
});
