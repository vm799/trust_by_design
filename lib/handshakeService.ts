/**
 * HandshakeService - Type-Safe Technician Handshake State Management
 *
 * This service manages the Public-Private handshake for technician links.
 * It ensures that every technician accessing a job has valid, immutable context.
 *
 * The handshake is WRITE-ONCE until job sync:
 * - When tech clicks link: handshake written to localStorage
 * - During job work: handshake is read-only
 * - After sync success: handshake can be cleared for next job
 *
 * @author Claude Code - Architectural Refactor
 */

// ============================================================================
// TYPES - No 'any' types allowed
// ============================================================================

/**
 * Handshake context interface - defines the contract for technician access
 */
export interface HandshakeContext {
  /** The job ID being accessed */
  jobId: string;
  /** The delivery email for the report (manager or job creator) */
  deliveryEmail: string;
  /** Optional client email for CC on report */
  clientEmail?: string;
  /** Access code from the URL (for validation) */
  accessCode: string;
  /** Checksum for tamper detection */
  checksum: string;
  /** Whether the handshake has been validated */
  isValid: boolean;
  /** Timestamp when handshake was created */
  createdAt: number;
  /** Whether handshake is locked (immutable until sync) */
  isLocked: boolean;
}

/**
 * Result of handshake validation
 */
export interface HandshakeValidationResult {
  success: boolean;
  context?: HandshakeContext;
  error?: HandshakeError;
}

/**
 * Structured error types for handshake failures
 */
export type HandshakeError =
  | { type: 'INVALID_ACCESS_CODE'; message: string }
  | { type: 'EXPIRED_LINK'; message: string }
  | { type: 'CHECKSUM_MISMATCH'; message: string }
  | { type: 'MISSING_PARAMS'; message: string; missingFields: string[] }
  | { type: 'LOCKED'; message: string }
  | { type: 'UNKNOWN'; message: string };

// ============================================================================
// STORAGE KEYS - Centralized for consistency
// ============================================================================

const STORAGE_PREFIX = 'handshake_' as const;
const STORAGE_KEYS = {
  CONTEXT: `${STORAGE_PREFIX}context`,
  LOCKED: `${STORAGE_PREFIX}locked`,
  CREATED_AT: `${STORAGE_PREFIX}created_at`,
} as const;

// ============================================================================
// CHECKSUM UTILITIES - Imported from redirects for consistency
// ============================================================================

import { generateChecksum, validateChecksum as validateChecksumFn } from './redirects';

// ============================================================================
// LINK EXPIRY CONFIGURATION
// ============================================================================

/** Link expiry window: 24 hours in milliseconds */
const LINK_EXPIRY_MS = 24 * 60 * 60 * 1000;

// ============================================================================
// HANDSHAKE SERVICE CLASS
// ============================================================================

class HandshakeServiceClass {
  /**
   * Parse an access code to extract embedded data
   * Access code format: {jobId}_{checksum}_{encodedEmail}
   */
  parseAccessCode(accessCode: string): {
    jobId: string;
    checksum: string;
    deliveryEmail: string;
    clientEmail?: string;
    createdAt?: number;
  } | null {
    try {
      // Access code format: base64(JSON)
      const decoded = atob(accessCode);
      const data = JSON.parse(decoded);

      if (!data.jobId || !data.checksum || !data.deliveryEmail) {
        console.error('[HandshakeService] Invalid access code structure:', data);
        return null;
      }

      return {
        jobId: data.jobId,
        checksum: data.checksum,
        deliveryEmail: data.deliveryEmail,
        clientEmail: data.clientEmail,
        createdAt: data.createdAt,
      };
    } catch (error) {
      console.error('[HandshakeService] Failed to parse access code:', error);
      return null;
    }
  }

  /**
   * Generate an access code from job data
   * This is the inverse of parseAccessCode
   */
  generateAccessCode(
    jobId: string,
    deliveryEmail: string,
    clientEmail?: string
  ): string {
    const checksum = generateChecksum(jobId);
    const data = {
      jobId,
      checksum,
      deliveryEmail,
      clientEmail,
    };
    return btoa(JSON.stringify(data));
  }

  /**
   * Validate and create a handshake context from an access code
   * This is the main entry point for the /go/:accessCode route
   */
  validate(accessCode: string): HandshakeValidationResult {
    // Check if already locked with different job
    const existingContext = this.get();
    if (existingContext?.isLocked) {
      const parsed = this.parseAccessCode(accessCode);
      if (parsed && parsed.jobId !== existingContext.jobId) {
        return {
          success: false,
          error: {
            type: 'LOCKED',
            message: `Cannot access new job while current job (${existingContext.jobId}) is in progress. Complete or cancel current job first.`,
          },
        };
      }
      // Same job, return existing context
      return { success: true, context: existingContext };
    }

    // Parse the access code
    const parsed = this.parseAccessCode(accessCode);
    if (!parsed) {
      return {
        success: false,
        error: {
          type: 'INVALID_ACCESS_CODE',
          message: 'The access code is malformed or corrupted.',
        },
      };
    }

    // Check link expiry (if createdAt is present)
    if (parsed.createdAt) {
      const age = Date.now() - parsed.createdAt;
      if (age > LINK_EXPIRY_MS) {
        const hoursAgo = Math.floor(age / (60 * 60 * 1000));
        return {
          success: false,
          error: {
            type: 'EXPIRED_LINK',
            message: `This link expired ${hoursAgo} hours ago. Please request a new link from your manager.`,
          },
        };
      }
    }

    // Validate required fields
    const missingFields: string[] = [];
    if (!parsed.jobId) missingFields.push('jobId');
    if (!parsed.deliveryEmail) missingFields.push('deliveryEmail');
    if (!parsed.checksum) missingFields.push('checksum');

    if (missingFields.length > 0) {
      return {
        success: false,
        error: {
          type: 'MISSING_PARAMS',
          message: `Missing required parameters: ${missingFields.join(', ')}`,
          missingFields,
        },
      };
    }

    // Validate checksum
    if (!validateChecksumFn(parsed.jobId, parsed.checksum)) {
      return {
        success: false,
        error: {
          type: 'CHECKSUM_MISMATCH',
          message: 'The link appears to be tampered with or corrupted. Please request a new link from your manager.',
        },
      };
    }

    // Create the handshake context
    const context: HandshakeContext = {
      jobId: parsed.jobId,
      deliveryEmail: parsed.deliveryEmail,
      clientEmail: parsed.clientEmail,
      accessCode,
      checksum: parsed.checksum,
      isValid: true,
      createdAt: Date.now(),
      isLocked: false,
    };

    return { success: true, context };
  }

  /**
   * Store and lock the handshake context
   * Called after successful validation when tech starts working
   */
  commit(context: HandshakeContext): void {
    const lockedContext: HandshakeContext = {
      ...context,
      isLocked: true,
    };

    try {
      localStorage.setItem(STORAGE_KEYS.CONTEXT, JSON.stringify(lockedContext));
      localStorage.setItem(STORAGE_KEYS.LOCKED, 'true');
      localStorage.setItem(STORAGE_KEYS.CREATED_AT, String(lockedContext.createdAt));
      console.log('[HandshakeService] Context committed and locked:', lockedContext.jobId);
    } catch (error) {
      console.error('[HandshakeService] Failed to commit context:', error);
    }
  }

  /**
   * Get the current handshake context
   * Returns null if no context exists
   */
  get(): HandshakeContext | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CONTEXT);
      if (!stored) return null;

      const context = JSON.parse(stored) as HandshakeContext;
      return context;
    } catch (error) {
      console.error('[HandshakeService] Failed to get context:', error);
      return null;
    }
  }

  /**
   * Check if a handshake exists and is locked
   */
  isLocked(): boolean {
    return localStorage.getItem(STORAGE_KEYS.LOCKED) === 'true';
  }

  /**
   * Clear the handshake context
   * Only allowed after job sync success
   */
  clear(): void {
    localStorage.removeItem(STORAGE_KEYS.CONTEXT);
    localStorage.removeItem(STORAGE_KEYS.LOCKED);
    localStorage.removeItem(STORAGE_KEYS.CREATED_AT);
    console.log('[HandshakeService] Context cleared');
  }

  /**
   * Force unlock the handshake - Emergency escape hatch
   *
   * Use Case: Technician abandoned a job mid-flow and needs to start fresh.
   * This clears all handshake state unconditionally, allowing new magic links.
   *
   * WARNING: This discards any in-progress work that hasn't been synced.
   * The UI should warn the user before calling this.
   *
   * @returns The jobId that was unlocked (for logging/UI feedback), or null if nothing was locked
   */
  forceUnlock(): string | null {
    const existingContext = this.get();
    const unlockedJobId = existingContext?.jobId ?? null;

    // Clear all handshake storage
    localStorage.removeItem(STORAGE_KEYS.CONTEXT);
    localStorage.removeItem(STORAGE_KEYS.LOCKED);
    localStorage.removeItem(STORAGE_KEYS.CREATED_AT);

    console.log('[HandshakeService] Force unlock executed:', unlockedJobId ? `Unlocked from job ${unlockedJobId}` : 'No job was locked');

    return unlockedJobId;
  }

  /**
   * Get the job ID from the current context
   * Convenience method for routing
   */
  getJobId(): string | null {
    const context = this.get();
    return context?.jobId ?? null;
  }

  /**
   * Get the delivery email from the current context
   */
  getDeliveryEmail(): string | null {
    const context = this.get();
    return context?.deliveryEmail ?? null;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const HandshakeService = new HandshakeServiceClass();
export default HandshakeService;
