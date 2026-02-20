import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HandshakeService, type HandshakeContext } from '@/lib/handshakeService';

// Mock the redirects module for checksum utilities
vi.mock('@/lib/redirects', () => ({
  generateChecksum: vi.fn((jobId: string) => `chk_${jobId.slice(-6)}`),
  validateChecksum: vi.fn((jobId: string, checksum: string) => checksum === `chk_${jobId.slice(-6)}`),
}));

// Import mocked functions for test control
import { generateChecksum } from '@/lib/redirects';

describe('lib/handshakeService - HandshakeService', () => {
  // Mock localStorage
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage = {};

    // Mock localStorage methods
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      return mockStorage[key] ?? null;
    });

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
      mockStorage[key] = value;
    });

    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key: string) => {
      delete mockStorage[key];
    });

    // Suppress console.log and console.error during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // generateAccessCode() Tests
  // ============================================================================
  describe('generateAccessCode', () => {
    it('should create valid base64 encoded JSON', () => {
      const jobId = 'JOB-ABC123';
      const deliveryEmail = 'manager@test.com';

      const accessCode = HandshakeService.generateAccessCode(jobId, deliveryEmail);

      // Should be valid base64
      expect(() => atob(accessCode)).not.toThrow();

      // Should be valid JSON
      const decoded = JSON.parse(atob(accessCode));
      expect(decoded).toBeInstanceOf(Object);
    });

    it('should include jobId, checksum, and deliveryEmail', () => {
      const jobId = 'JOB-ABC123';
      const deliveryEmail = 'manager@test.com';

      const accessCode = HandshakeService.generateAccessCode(jobId, deliveryEmail);
      const decoded = JSON.parse(atob(accessCode));

      expect(decoded.jobId).toBe(jobId);
      expect(decoded.deliveryEmail).toBe(deliveryEmail);
      expect(decoded.checksum).toBeDefined();
      expect(typeof decoded.checksum).toBe('string');
    });

    it('should optionally include clientEmail', () => {
      const jobId = 'JOB-ABC123';
      const deliveryEmail = 'manager@test.com';
      const clientEmail = 'client@company.com';

      const accessCode = HandshakeService.generateAccessCode(jobId, deliveryEmail, clientEmail);
      const decoded = JSON.parse(atob(accessCode));

      expect(decoded.clientEmail).toBe(clientEmail);
    });

    it('should generate consistent checksum for same jobId', () => {
      const jobId = 'JOB-XYZ789';
      const deliveryEmail = 'test@example.com';

      const accessCode1 = HandshakeService.generateAccessCode(jobId, deliveryEmail);
      const accessCode2 = HandshakeService.generateAccessCode(jobId, deliveryEmail);

      const decoded1 = JSON.parse(atob(accessCode1));
      const decoded2 = JSON.parse(atob(accessCode2));

      expect(decoded1.checksum).toBe(decoded2.checksum);
    });

    it('should call generateChecksum with jobId', () => {
      const jobId = 'JOB-TEST001';
      const deliveryEmail = 'test@example.com';

      HandshakeService.generateAccessCode(jobId, deliveryEmail);

      expect(generateChecksum).toHaveBeenCalledWith(jobId);
    });
  });

  // ============================================================================
  // parseAccessCode() Tests
  // ============================================================================
  describe('parseAccessCode', () => {
    it('should parse valid access codes correctly', () => {
      const jobId = 'JOB-ABC123';
      const deliveryEmail = 'manager@test.com';
      const clientEmail = 'client@company.com';

      const accessCode = HandshakeService.generateAccessCode(jobId, deliveryEmail, clientEmail);
      const parsed = HandshakeService.parseAccessCode(accessCode);

      expect(parsed).not.toBeNull();
      expect(parsed?.jobId).toBe(jobId);
      expect(parsed?.deliveryEmail).toBe(deliveryEmail);
      expect(parsed?.clientEmail).toBe(clientEmail);
      expect(parsed?.checksum).toBeDefined();
    });

    it('should return null for malformed access codes', () => {
      const malformedCode = btoa('not valid json {{{');
      const result = HandshakeService.parseAccessCode(malformedCode);

      expect(result).toBeNull();
    });

    it('should return null for non-base64 strings', () => {
      const invalidBase64 = '!!!not-base64!!!';
      const result = HandshakeService.parseAccessCode(invalidBase64);

      expect(result).toBeNull();
    });

    it('should return null for JSON missing required fields', () => {
      // Missing deliveryEmail
      const missingEmail = btoa(JSON.stringify({ jobId: 'JOB-123', checksum: 'abc123' }));
      expect(HandshakeService.parseAccessCode(missingEmail)).toBeNull();

      // Missing jobId
      const missingJobId = btoa(JSON.stringify({ deliveryEmail: 'test@example.com', checksum: 'abc123' }));
      expect(HandshakeService.parseAccessCode(missingJobId)).toBeNull();

      // Missing checksum
      const missingChecksum = btoa(JSON.stringify({ jobId: 'JOB-123', deliveryEmail: 'test@example.com' }));
      expect(HandshakeService.parseAccessCode(missingChecksum)).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = HandshakeService.parseAccessCode('');

      expect(result).toBeNull();
    });

    it('should handle access codes without optional clientEmail', () => {
      const jobId = 'JOB-NO-CLIENT';
      const deliveryEmail = 'manager@test.com';

      const accessCode = HandshakeService.generateAccessCode(jobId, deliveryEmail);
      const parsed = HandshakeService.parseAccessCode(accessCode);

      expect(parsed).not.toBeNull();
      expect(parsed?.jobId).toBe(jobId);
      expect(parsed?.deliveryEmail).toBe(deliveryEmail);
      expect(parsed?.clientEmail).toBeUndefined();
    });
  });

  // ============================================================================
  // validate() Tests
  // ============================================================================
  describe('validate', () => {
    it('should return success for valid access codes', () => {
      const jobId = 'JOB-VALID001';
      const deliveryEmail = 'manager@test.com';
      const accessCode = HandshakeService.generateAccessCode(jobId, deliveryEmail);

      const result = HandshakeService.validate(accessCode);

      expect(result.success).toBe(true);
      expect(result.context).toBeDefined();
      expect(result.context?.jobId).toBe(jobId);
      expect(result.context?.deliveryEmail).toBe(deliveryEmail);
      expect(result.context?.isValid).toBe(true);
      expect(result.context?.isLocked).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it('should return INVALID_ACCESS_CODE for malformed codes', () => {
      const malformedCode = 'totally-invalid-garbage';

      const result = HandshakeService.validate(malformedCode);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('INVALID_ACCESS_CODE');
      expect(result.error?.message).toContain('malformed');
    });

    it('should return CHECKSUM_MISMATCH for tampered codes', () => {
      // Create a valid-looking code but with wrong checksum
      const tamperedCode = btoa(JSON.stringify({
        jobId: 'JOB-TAMPERED',
        checksum: 'wrong_checksum_value',
        deliveryEmail: 'hacker@evil.com',
      }));

      const result = HandshakeService.validate(tamperedCode);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('CHECKSUM_MISMATCH');
      expect(result.error?.message).toContain('tampered');
    });

    it('should return MISSING_PARAMS for incomplete codes', () => {
      // Mock parseAccessCode to return partial data (simulating edge case)
      // This tests the validation after parsing but before checksum validation
      // The actual implementation handles this in parseAccessCode, but validate has an extra check

      // Create a code that parses but has empty required fields
      const incompleteCode = btoa(JSON.stringify({
        jobId: '',
        checksum: 'abc',
        deliveryEmail: 'test@example.com',
      }));

      const result = HandshakeService.validate(incompleteCode);

      // Should fail either with INVALID_ACCESS_CODE (from parse) or MISSING_PARAMS
      expect(result.success).toBe(false);
      expect(['INVALID_ACCESS_CODE', 'MISSING_PARAMS']).toContain(result.error?.type);
    });

    it('should return LOCKED when trying to access different job while locked', () => {
      // First, commit a context to lock the handshake
      const firstJobId = 'JOB-FIRST001';
      const firstAccessCode = HandshakeService.generateAccessCode(firstJobId, 'manager@test.com');
      const firstValidation = HandshakeService.validate(firstAccessCode);
      expect(firstValidation.success).toBe(true);
      HandshakeService.commit(firstValidation.context!);

      // Now try to access a different job
      const secondJobId = 'JOB-SECOND002';
      const secondAccessCode = HandshakeService.generateAccessCode(secondJobId, 'other@test.com');

      const result = HandshakeService.validate(secondAccessCode);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('LOCKED');
      expect(result.error?.message).toContain('Cannot access new job');
      expect(result.error?.message).toContain(firstJobId);
    });

    it('should return existing context when validating same job while locked', () => {
      const jobId = 'JOB-SAME001';
      const deliveryEmail = 'manager@test.com';
      const accessCode = HandshakeService.generateAccessCode(jobId, deliveryEmail);

      // Validate and commit
      const firstValidation = HandshakeService.validate(accessCode);
      expect(firstValidation.success).toBe(true);
      HandshakeService.commit(firstValidation.context!);

      // Validate again with same access code
      const secondValidation = HandshakeService.validate(accessCode);

      expect(secondValidation.success).toBe(true);
      expect(secondValidation.context?.jobId).toBe(jobId);
      expect(secondValidation.context?.isLocked).toBe(true);
    });

    it('should include createdAt timestamp in context', () => {
      const beforeTime = Date.now();
      const accessCode = HandshakeService.generateAccessCode('JOB-TIME001', 'test@example.com');

      const result = HandshakeService.validate(accessCode);
      const afterTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.context?.createdAt).toBeGreaterThanOrEqual(beforeTime);
      expect(result.context?.createdAt).toBeLessThanOrEqual(afterTime);
    });

    it('should store accessCode in context', () => {
      const accessCode = HandshakeService.generateAccessCode('JOB-CODE001', 'test@example.com');

      const result = HandshakeService.validate(accessCode);

      expect(result.success).toBe(true);
      expect(result.context?.accessCode).toBe(accessCode);
    });
  });

  // ============================================================================
  // commit() Tests
  // ============================================================================
  describe('commit', () => {
    it('should store context in localStorage', () => {
      const context: HandshakeContext = {
        jobId: 'JOB-COMMIT001',
        deliveryEmail: 'manager@test.com',
        accessCode: 'test-access-code',
        checksum: 'test-checksum',
        isValid: true,
        createdAt: Date.now(),
        isLocked: false,
      };

      HandshakeService.commit(context);

      expect(mockStorage['handshake_context']).toBeDefined();
      const stored = JSON.parse(mockStorage['handshake_context']);
      expect(stored.jobId).toBe(context.jobId);
      expect(stored.deliveryEmail).toBe(context.deliveryEmail);
    });

    it('should set isLocked to true', () => {
      const context: HandshakeContext = {
        jobId: 'JOB-LOCK001',
        deliveryEmail: 'manager@test.com',
        accessCode: 'test-access-code',
        checksum: 'test-checksum',
        isValid: true,
        createdAt: Date.now(),
        isLocked: false,
      };

      HandshakeService.commit(context);

      const stored = JSON.parse(mockStorage['handshake_context']);
      expect(stored.isLocked).toBe(true);
      expect(mockStorage['handshake_locked']).toBe('true');
    });

    it('should persist across page refreshes (mock localStorage)', () => {
      const context: HandshakeContext = {
        jobId: 'JOB-PERSIST001',
        deliveryEmail: 'manager@test.com',
        accessCode: 'persist-access-code',
        checksum: 'persist-checksum',
        isValid: true,
        createdAt: Date.now(),
        isLocked: false,
      };

      HandshakeService.commit(context);

      // Simulate page refresh by calling get() which reads from storage
      const retrieved = HandshakeService.get();

      expect(retrieved).not.toBeNull();
      expect(retrieved?.jobId).toBe(context.jobId);
      expect(retrieved?.isLocked).toBe(true);
    });

    it('should store createdAt timestamp', () => {
      const createdAt = Date.now();
      const context: HandshakeContext = {
        jobId: 'JOB-TIMESTAMP001',
        deliveryEmail: 'manager@test.com',
        accessCode: 'timestamp-access-code',
        checksum: 'timestamp-checksum',
        isValid: true,
        createdAt,
        isLocked: false,
      };

      HandshakeService.commit(context);

      expect(mockStorage['handshake_created_at']).toBe(String(createdAt));
    });

    it('should handle localStorage errors gracefully', () => {
      // Mock setItem to throw error
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      const context: HandshakeContext = {
        jobId: 'JOB-ERROR001',
        deliveryEmail: 'manager@test.com',
        accessCode: 'error-access-code',
        checksum: 'error-checksum',
        isValid: true,
        createdAt: Date.now(),
        isLocked: false,
      };

      // Should not throw
      expect(() => HandshakeService.commit(context)).not.toThrow();
    });
  });

  // ============================================================================
  // get() Tests
  // ============================================================================
  describe('get', () => {
    it('should return null when no context exists', () => {
      const result = HandshakeService.get();

      expect(result).toBeNull();
    });

    it('should return stored context when exists', () => {
      const context: HandshakeContext = {
        jobId: 'JOB-GET001',
        deliveryEmail: 'manager@test.com',
        accessCode: 'get-access-code',
        checksum: 'get-checksum',
        isValid: true,
        createdAt: Date.now(),
        isLocked: true,
      };

      mockStorage['handshake_context'] = JSON.stringify(context);

      const result = HandshakeService.get();

      expect(result).not.toBeNull();
      expect(result?.jobId).toBe(context.jobId);
      expect(result?.deliveryEmail).toBe(context.deliveryEmail);
      expect(result?.isLocked).toBe(true);
    });

    it('should handle localStorage errors gracefully', () => {
      // Mock getItem to throw error
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });

      const result = HandshakeService.get();

      expect(result).toBeNull();
    });

    it('should handle corrupted JSON in localStorage', () => {
      mockStorage['handshake_context'] = 'not valid json {{{';

      const result = HandshakeService.get();

      expect(result).toBeNull();
    });

    it('should preserve all context fields', () => {
      const context: HandshakeContext = {
        jobId: 'JOB-FIELDS001',
        deliveryEmail: 'manager@test.com',
        clientEmail: 'client@company.com',
        accessCode: 'fields-access-code',
        checksum: 'fields-checksum',
        isValid: true,
        createdAt: 1706000000000,
        isLocked: true,
      };

      mockStorage['handshake_context'] = JSON.stringify(context);

      const result = HandshakeService.get();

      expect(result).toEqual(context);
    });
  });

  // ============================================================================
  // clear() Tests
  // ============================================================================
  describe('clear', () => {
    it('should remove all handshake storage keys', () => {
      // Set up storage with handshake data
      mockStorage['handshake_context'] = JSON.stringify({ jobId: 'JOB-CLEAR001' });
      mockStorage['handshake_locked'] = 'true';
      mockStorage['handshake_created_at'] = '1706000000000';

      HandshakeService.clear();

      expect(mockStorage['handshake_context']).toBeUndefined();
      expect(mockStorage['handshake_locked']).toBeUndefined();
      expect(mockStorage['handshake_created_at']).toBeUndefined();
    });

    it('should allow new handshake after clear', () => {
      // Commit a handshake
      const firstContext: HandshakeContext = {
        jobId: 'JOB-FIRST-CLEAR',
        deliveryEmail: 'first@test.com',
        accessCode: 'first-access-code',
        checksum: 'first-checksum',
        isValid: true,
        createdAt: Date.now(),
        isLocked: false,
      };
      HandshakeService.commit(firstContext);

      // Verify it's locked
      expect(HandshakeService.isLocked()).toBe(true);

      // Clear
      HandshakeService.clear();

      // Verify not locked
      expect(HandshakeService.isLocked()).toBe(false);

      // Should be able to validate a new job
      const newAccessCode = HandshakeService.generateAccessCode('JOB-NEW-AFTER-CLEAR', 'new@test.com');
      const result = HandshakeService.validate(newAccessCode);

      expect(result.success).toBe(true);
      expect(result.context?.jobId).toBe('JOB-NEW-AFTER-CLEAR');
    });

    it('should not throw if storage is already empty', () => {
      // Ensure storage is empty
      mockStorage = {};

      expect(() => HandshakeService.clear()).not.toThrow();
    });
  });

  // ============================================================================
  // isLocked() Tests
  // ============================================================================
  describe('isLocked', () => {
    it('should return false initially', () => {
      const result = HandshakeService.isLocked();

      expect(result).toBe(false);
    });

    it('should return true after commit', () => {
      const context: HandshakeContext = {
        jobId: 'JOB-LOCKED001',
        deliveryEmail: 'manager@test.com',
        accessCode: 'locked-access-code',
        checksum: 'locked-checksum',
        isValid: true,
        createdAt: Date.now(),
        isLocked: false,
      };

      HandshakeService.commit(context);

      expect(HandshakeService.isLocked()).toBe(true);
    });

    it('should return false after clear', () => {
      // Commit first
      const context: HandshakeContext = {
        jobId: 'JOB-UNLOCK001',
        deliveryEmail: 'manager@test.com',
        accessCode: 'unlock-access-code',
        checksum: 'unlock-checksum',
        isValid: true,
        createdAt: Date.now(),
        isLocked: false,
      };
      HandshakeService.commit(context);
      expect(HandshakeService.isLocked()).toBe(true);

      // Clear
      HandshakeService.clear();

      expect(HandshakeService.isLocked()).toBe(false);
    });

    it('should check localStorage directly', () => {
      // Set the locked flag directly without going through commit
      mockStorage['handshake_locked'] = 'true';

      expect(HandshakeService.isLocked()).toBe(true);

      mockStorage['handshake_locked'] = 'false';

      expect(HandshakeService.isLocked()).toBe(false);
    });
  });

  // ============================================================================
  // getJobId() Tests
  // ============================================================================
  describe('getJobId', () => {
    it('should return null when no context exists', () => {
      const result = HandshakeService.getJobId();

      expect(result).toBeNull();
    });

    it('should return jobId when context exists', () => {
      const context: HandshakeContext = {
        jobId: 'JOB-GETID001',
        deliveryEmail: 'manager@test.com',
        accessCode: 'getid-access-code',
        checksum: 'getid-checksum',
        isValid: true,
        createdAt: Date.now(),
        isLocked: true,
      };

      mockStorage['handshake_context'] = JSON.stringify(context);

      const result = HandshakeService.getJobId();

      expect(result).toBe('JOB-GETID001');
    });
  });

  // ============================================================================
  // getDeliveryEmail() Tests
  // ============================================================================
  describe('getDeliveryEmail', () => {
    it('should return null when no context exists', () => {
      const result = HandshakeService.getDeliveryEmail();

      expect(result).toBeNull();
    });

    it('should return deliveryEmail when context exists', () => {
      const context: HandshakeContext = {
        jobId: 'JOB-GETEMAIL001',
        deliveryEmail: 'delivery@test.com',
        accessCode: 'getemail-access-code',
        checksum: 'getemail-checksum',
        isValid: true,
        createdAt: Date.now(),
        isLocked: true,
      };

      mockStorage['handshake_context'] = JSON.stringify(context);

      const result = HandshakeService.getDeliveryEmail();

      expect(result).toBe('delivery@test.com');
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================
  describe('integration', () => {
    it('should complete full handshake lifecycle', () => {
      // 1. Generate access code (simulating manager creating invite)
      const jobId = 'JOB-LIFECYCLE001';
      const deliveryEmail = 'manager@company.com';
      const clientEmail = 'client@client.com';
      const accessCode = HandshakeService.generateAccessCode(jobId, deliveryEmail, clientEmail);

      // 2. Validate access code (simulating tech clicking link)
      const validation = HandshakeService.validate(accessCode);
      expect(validation.success).toBe(true);
      expect(validation.context?.isLocked).toBe(false);

      // 3. Commit handshake (simulating tech starting job)
      HandshakeService.commit(validation.context!);
      expect(HandshakeService.isLocked()).toBe(true);

      // 4. Get context during job (simulating reading during work)
      const context = HandshakeService.get();
      expect(context?.jobId).toBe(jobId);
      expect(context?.deliveryEmail).toBe(deliveryEmail);
      expect(context?.clientEmail).toBe(clientEmail);
      expect(context?.isLocked).toBe(true);

      // 5. Try to access different job (should fail)
      const otherAccessCode = HandshakeService.generateAccessCode('JOB-OTHER', 'other@test.com');
      const otherValidation = HandshakeService.validate(otherAccessCode);
      expect(otherValidation.success).toBe(false);
      expect(otherValidation.error?.type).toBe('LOCKED');

      // 6. Clear after sync (simulating job completion)
      HandshakeService.clear();
      expect(HandshakeService.isLocked()).toBe(false);
      expect(HandshakeService.get()).toBeNull();

      // 7. Can start new job now
      const newValidation = HandshakeService.validate(otherAccessCode);
      expect(newValidation.success).toBe(true);
    });

    it('should handle same job re-validation while locked', () => {
      const jobId = 'JOB-REVALIDATE001';
      const deliveryEmail = 'manager@test.com';
      const accessCode = HandshakeService.generateAccessCode(jobId, deliveryEmail);

      // Validate and commit
      const firstValidation = HandshakeService.validate(accessCode);
      HandshakeService.commit(firstValidation.context!);

      // Re-validate (simulating page refresh or re-click of same link)
      const secondValidation = HandshakeService.validate(accessCode);

      expect(secondValidation.success).toBe(true);
      expect(secondValidation.context?.jobId).toBe(jobId);
      expect(secondValidation.context?.isLocked).toBe(true);
    });

    it('should auto-clear stale locks older than 7 days when accessing different job', () => {
      // Commit a handshake for first job
      const firstJobId = 'JOB-STALE001';
      const firstAccessCode = HandshakeService.generateAccessCode(firstJobId, 'manager@test.com');
      const firstValidation = HandshakeService.validate(firstAccessCode);
      expect(firstValidation.success).toBe(true);
      HandshakeService.commit(firstValidation.context!);

      // Manually age the lock beyond 7 days by modifying storage
      const staleContext = JSON.parse(mockStorage['handshake_context']);
      staleContext.createdAt = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 days ago
      mockStorage['handshake_context'] = JSON.stringify(staleContext);

      // Now try to access a different job - should succeed because lock is stale
      const secondJobId = 'JOB-NEW002';
      const secondAccessCode = HandshakeService.generateAccessCode(secondJobId, 'other@test.com');
      const result = HandshakeService.validate(secondAccessCode);

      expect(result.success).toBe(true);
      expect(result.context?.jobId).toBe(secondJobId);
    });

    it('should NOT auto-clear recent locks when accessing different job', () => {
      // Commit a handshake for first job (recent - within 7 days)
      const firstJobId = 'JOB-RECENT001';
      const firstAccessCode = HandshakeService.generateAccessCode(firstJobId, 'manager@test.com');
      const firstValidation = HandshakeService.validate(firstAccessCode);
      expect(firstValidation.success).toBe(true);
      HandshakeService.commit(firstValidation.context!);

      // Try to access a different job - should be blocked (lock is recent)
      const secondJobId = 'JOB-BLOCKED002';
      const secondAccessCode = HandshakeService.generateAccessCode(secondJobId, 'other@test.com');
      const result = HandshakeService.validate(secondAccessCode);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('LOCKED');
    });

    it('should use 7-day link expiry matching the invite table', () => {
      // Create an access code with a createdAt timestamp 6 days ago
      const jobId = 'JOB-EXPIRY6D';
      const payload = {
        jobId,
        checksum: `chk_PIRY6D`, // matches mock: chk_ + last 6 chars
        deliveryEmail: 'manager@test.com',
        createdAt: Date.now() - (6 * 24 * 60 * 60 * 1000), // 6 days ago
      };
      const accessCode = btoa(JSON.stringify(payload));

      // Should still be valid (within 7 days)
      const result = HandshakeService.validate(accessCode);
      expect(result.success).toBe(true);
    });

    it('should reject links older than 7 days', () => {
      // Create an access code with a createdAt timestamp 8 days ago
      const jobId = 'JOB-EXPIRY8D';
      const payload = {
        jobId,
        checksum: `chk_PIRY8D`, // matches mock: chk_ + last 6 chars
        deliveryEmail: 'manager@test.com',
        createdAt: Date.now() - (8 * 24 * 60 * 60 * 1000), // 8 days ago
      };
      const accessCode = btoa(JSON.stringify(payload));

      const result = HandshakeService.validate(accessCode);
      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('EXPIRED_LINK');
    });
  });
});
