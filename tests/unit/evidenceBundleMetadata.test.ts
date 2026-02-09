/**
 * Evidence Bundle Metadata Tests
 *
 * Verifies that the evidence sealing bundle includes full forensic
 * metadata: GPS coordinates, W3W addresses, accuracy, photo hashes,
 * signature hashes, and device info for each photo.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { enableMockSealing, disableMockSealing, sealEvidence, canSealJob } from '../../lib/sealing';

// Mock the db module
vi.mock('../../lib/db', () => ({
  getJobs: vi.fn(),
  updateJob: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock supabase
vi.mock('../../lib/supabase', () => ({
  getSupabase: () => null,
}));

describe('Evidence Bundle Metadata', () => {
  beforeEach(() => {
    enableMockSealing();
  });

  afterEach(() => {
    disableMockSealing();
  });

  describe('canSealJob validation', () => {
    it('validates GPS coordinates are present', () => {
      const job = {
        id: 'test-1',
        status: 'Submitted',
        photos: [{ id: 'p1', url: 'test.jpg', type: 'before', syncStatus: 'synced', photo_hash: 'abc' }],
        signature: 'sig-data',
        signerName: 'John',
        lat: undefined,
        lng: undefined,
      };
      const result = canSealJob(job);
      expect(result.warnings).toContain('GPS coordinates not captured');
    });

    it('validates GPS coordinates are in range', () => {
      const job = {
        id: 'test-2',
        status: 'Submitted',
        photos: [{ id: 'p1', url: 'test.jpg', type: 'before', syncStatus: 'synced', photo_hash: 'abc' }],
        signature: 'sig-data',
        signerName: 'John',
        lat: 200, // Invalid
        lng: 50,
      };
      const result = canSealJob(job);
      expect(result.canSeal).toBe(false);
      expect(result.reasons).toContain('Invalid GPS coordinates');
    });

    it('warns about missing photo hashes', () => {
      const job = {
        id: 'test-3',
        status: 'Submitted',
        photos: [{ id: 'p1', url: 'test.jpg', type: 'before', syncStatus: 'synced' }],
        signature: 'sig-data',
        signerName: 'John',
        lat: 51.5,
        lng: -0.1,
      };
      const result = canSealJob(job);
      expect(result.warnings).toContain('Some photos do not have integrity hashes');
    });

    it('warns about unverified location', () => {
      const job = {
        id: 'test-4',
        status: 'Submitted',
        photos: [{ id: 'p1', url: 'test.jpg', type: 'before', syncStatus: 'synced', photo_hash: 'abc' }],
        signature: 'sig-data',
        signerName: 'John',
        lat: 51.5,
        lng: -0.1,
        locationVerified: false,
      };
      const result = canSealJob(job);
      expect(result.warnings).toContain('Location is UNVERIFIED - W3W address is mock/manual');
    });

    it('warns about missing signature hash', () => {
      const job = {
        id: 'test-5',
        status: 'Submitted',
        photos: [{ id: 'p1', url: 'test.jpg', type: 'before', syncStatus: 'synced', photo_hash: 'abc' }],
        signature: 'sig-data',
        signerName: 'John',
        signatureHash: undefined,
        lat: 51.5,
        lng: -0.1,
      };
      const result = canSealJob(job);
      expect(result.warnings).toContain('Signature does not have integrity hash - recommend re-capturing');
    });

    it('passes validation for complete job with all metadata', () => {
      const job = {
        id: 'test-6',
        status: 'Submitted',
        photos: [{
          id: 'p1',
          url: 'https://storage.example.com/photo.jpg',
          type: 'before',
          syncStatus: 'synced',
          photo_hash: 'sha256abc',
          lat: 51.5,
          lng: -0.1,
          gps_accuracy: 5,
          w3w: 'filled.count.soap',
          w3w_verified: true,
        }],
        signature: 'data:image/png;base64,abc',
        signerName: 'John Smith',
        signatureHash: 'sha256def',
        lat: 51.5,
        lng: -0.1,
        locationVerified: true,
      };
      const result = canSealJob(job);
      expect(result.canSeal).toBe(true);
      expect(result.reasons).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('Evidence bundle includes forensic metadata', () => {
    it('should seal with GPS and W3W metadata in bundle', async () => {
      const { getJobs } = await import('../../lib/db');
      (getJobs as any).mockResolvedValue({
        success: true,
        data: [{
          id: 'job-with-metadata',
          title: 'Full Metadata Job',
          client: 'Acme Corp',
          address: '123 Main St',
          status: 'Submitted',
          completedAt: new Date().toISOString(),
          lat: 51.507351,
          lng: -0.127758,
          w3w: 'filled.count.soap',
          locationVerified: true,
          photos: [{
            id: 'photo-1',
            url: 'https://storage.example.com/photo1.jpg',
            timestamp: new Date().toISOString(),
            type: 'before',
            verified: true,
            lat: 51.507351,
            lng: -0.127758,
            gps_accuracy: 3.5,
            w3w: 'filled.count.soap',
            w3w_verified: true,
            photo_hash: 'sha256-abc123def456',
            device_info: { make: 'Samsung', model: 'Galaxy S24', os: 'Android' },
            syncStatus: 'synced',
          }],
          signature: 'data:image/png;base64,iVBORw0KGgo=',
          signerName: 'Jane Doe',
          signerRole: 'Property Manager',
          signatureHash: 'sha256-sig-hash',
          signatureTimestamp: new Date().toISOString(),
          safetyChecklist: [],
        }],
      });

      const result = await sealEvidence('job-with-metadata');
      expect(result.success).toBe(true);
      expect(result.evidenceHash).toBeDefined();
      expect(result.sealedAt).toBeDefined();

      // Verify the bundle includes GPS and W3W for the job
      expect(result.bundle?.job.lat).toBe(51.507351);
      expect(result.bundle?.job.lng).toBe(-0.127758);
      expect(result.bundle?.job.w3w).toBe('filled.count.soap');
      expect(result.bundle?.job.locationVerified).toBe(true);

      // Verify photo metadata
      const photo = result.bundle?.photos[0];
      expect(photo.lat).toBe(51.507351);
      expect(photo.lng).toBe(-0.127758);
      expect(photo.gps_accuracy).toBe(3.5);
      expect(photo.w3w).toBe('filled.count.soap');
      expect(photo.w3w_verified).toBe(true);
      expect(photo.photo_hash).toBe('sha256-abc123def456');
      expect(photo.device_info).toEqual({ make: 'Samsung', model: 'Galaxy S24', os: 'Android' });

      // Verify signature metadata
      expect(result.bundle?.signature.signatureHash).toBe('sha256-sig-hash');
      expect(result.bundle?.signature.signatureTimestamp).toBeDefined();

      // Verify metadata includes algorithm info
      expect(result.bundle?.metadata.algorithm).toBe('SHA-256');
      expect(result.bundle?.metadata.signatureAlgorithm).toBe('RSA-2048');
    });
  });
});
