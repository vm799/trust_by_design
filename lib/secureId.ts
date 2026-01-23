/**
 * Secure ID Generation Utilities
 *
 * Provides cryptographically secure random ID generation
 * using Web Crypto API instead of Math.random().
 *
 * SECURITY: Math.random() is NOT cryptographically secure and
 * produces predictable values. All IDs that could be guessed
 * or enumerated must use these secure alternatives.
 */

/**
 * Generate a cryptographically secure random string
 * @param length - Length of the output string (default 9)
 * @returns Random alphanumeric string
 */
export function secureRandomString(length: number = 9): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map(b => b.toString(36).padStart(2, '0').slice(-1))
    .join('')
    .slice(0, length);
}

/**
 * Generate a secure job ID
 * Format: JP-{timestamp}-{random}
 */
export function generateSecureJobId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = secureRandomString(5).toUpperCase();
  return `JP-${timestamp}-${random}`;
}

/**
 * Generate a secure entity ID with prefix
 * Format: {prefix}-{timestamp}-{random}
 */
export function generateSecureEntityId(prefix: string): string {
  const timestamp = Date.now();
  const random = secureRandomString(9);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Generate a secure workspace slug suffix
 * @returns 5-character alphanumeric string
 */
export function generateSecureSlugSuffix(): string {
  return secureRandomString(5);
}

/**
 * Generate a secure invoice ID
 * Format: INV-{4 random digits}
 */
export function generateSecureInvoiceId(): string {
  const array = new Uint8Array(2);
  crypto.getRandomValues(array);
  const num = ((array[0] << 8) | array[1]) % 9000 + 1000;
  return `INV-${num}`;
}

/**
 * Generate a secure message/local ID
 * Format: {prefix}_{timestamp}_{random}
 */
export function generateSecureLocalId(prefix: string = 'local'): string {
  const timestamp = Date.now();
  const random = secureRandomString(9);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Generate secure jitter for retry delays
 * Uses crypto for randomness but result is for timing, not security
 * @param baseDelay - Base delay in milliseconds
 * @param jitterFactor - Factor of jitter (0-1)
 * @returns Jittered delay
 */
export function secureJitter(baseDelay: number, jitterFactor: number = 0.3): number {
  const array = new Uint8Array(4);
  crypto.getRandomValues(array);
  // Convert to number between 0 and 1
  const randomValue = (array[0] << 24 | array[1] << 16 | array[2] << 8 | array[3]) / 0xFFFFFFFF;
  // Apply jitter: baseDelay * jitterFactor * (random * 2 - 1)
  return baseDelay * jitterFactor * (randomValue * 2 - 1);
}

export default {
  secureRandomString,
  generateSecureJobId,
  generateSecureEntityId,
  generateSecureSlugSuffix,
  generateSecureInvoiceId,
  generateSecureLocalId,
  secureJitter,
};
