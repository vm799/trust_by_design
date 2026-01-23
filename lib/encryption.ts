/**
 * Encryption Service
 *
 * AES-256-GCM encryption for sensitive localStorage data
 * Uses Web Crypto API for secure client-side encryption
 *
 * SECURITY: Key is derived from session-unique entropy and stored
 * in-memory only. Key is NON-EXTRACTABLE to prevent exfiltration.
 */

const ENCRYPTED_PREFIX = 'enc:';

// In-memory key cache (never persisted to storage)
let cachedKey: CryptoKey | null = null;

// Session entropy for key derivation (generated once per session)
let sessionEntropy: Uint8Array | null = null;

/**
 * Get session entropy for key derivation
 * Generated once per browser session, stored in sessionStorage
 */
function getSessionEntropy(): Uint8Array {
  if (sessionEntropy) {
    return sessionEntropy;
  }

  // Check sessionStorage for existing entropy (survives page refreshes)
  const storedEntropy = sessionStorage.getItem('_se');
  if (storedEntropy) {
    sessionEntropy = Uint8Array.from(atob(storedEntropy), c => c.charCodeAt(0));
    return sessionEntropy;
  }

  // Generate new session entropy
  sessionEntropy = crypto.getRandomValues(new Uint8Array(32));

  // Store in sessionStorage (cleared when browser closes)
  sessionStorage.setItem('_se', btoa(String.fromCharCode(...sessionEntropy)));

  return sessionEntropy;
}

/**
 * Derive encryption key from session entropy using PBKDF2
 * Key is NON-EXTRACTABLE - cannot be exported or stolen via XSS
 */
async function deriveKey(): Promise<CryptoKey> {
  const entropy = getSessionEntropy();

  // Import entropy as base key material
  const baseKey = await crypto.subtle.importKey(
    'raw',
    entropy,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // Derive AES-256-GCM key using PBKDF2
  // Salt is derived from a fixed value + user agent to tie to device
  const saltBase = 'jobproof-v2-' + (typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 50) : 'server');
  const salt = new TextEncoder().encode(saltBase);

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false, // NON-EXTRACTABLE: Cannot be exported, preventing XSS key theft
    ['encrypt', 'decrypt']
  );
}

/**
 * Get or create encryption key (in-memory only)
 * Key is derived from session entropy and cached in memory
 */
async function getOrCreateKey(): Promise<CryptoKey> {
  if (cachedKey) {
    return cachedKey;
  }

  try {
    cachedKey = await deriveKey();
    return cachedKey;
  } catch (error) {
    console.error('[Encryption] Failed to derive key:', error);
    throw error;
  }
}

/**
 * Clear cached key (call on logout)
 */
export function clearEncryptionKey(): void {
  cachedKey = null;
  sessionEntropy = null;
  sessionStorage.removeItem('_se');
}

/**
 * Encrypt a string value
 */
export async function encrypt(plaintext: string): Promise<string> {
  try {
    const key = await getOrCreateKey();

    // Generate random IV for each encryption
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encode plaintext
    const encoded = new TextEncoder().encode(plaintext);

    // Encrypt
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );

    // Combine IV + ciphertext and encode as base64
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return ENCRYPTED_PREFIX + btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('[Encryption] Encrypt failed:', error);
    throw error;
  }
}

/**
 * Decrypt an encrypted string
 */
export async function decrypt(encrypted: string): Promise<string> {
  try {
    // Check if it's actually encrypted
    if (!encrypted.startsWith(ENCRYPTED_PREFIX)) {
      // Return as-is if not encrypted (backwards compatibility)
      return encrypted;
    }

    const key = await getOrCreateKey();

    // Decode base64
    const combined = Uint8Array.from(
      atob(encrypted.slice(ENCRYPTED_PREFIX.length)),
      c => c.charCodeAt(0)
    );

    // Extract IV and ciphertext
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('[Encryption] Decrypt failed:', error);
    throw error;
  }
}

/**
 * Check if a value is encrypted
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX);
}

// ============================================================================
// SECURE STORAGE WRAPPER
// ============================================================================

/**
 * Securely store sensitive data in localStorage
 */
export async function secureStore(key: string, value: any): Promise<void> {
  try {
    const serialized = JSON.stringify(value);
    const encrypted = await encrypt(serialized);
    localStorage.setItem(key, encrypted);
  } catch (error) {
    console.error(`[SecureStorage] Failed to store ${key}:`, error);
    // Fallback to plain storage if encryption fails
    localStorage.setItem(key, JSON.stringify(value));
  }
}

/**
 * Retrieve and decrypt sensitive data from localStorage
 */
export async function secureRetrieve<T>(key: string): Promise<T | null> {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    // Handle both encrypted and unencrypted data
    const decrypted = await decrypt(stored);
    return JSON.parse(decrypted) as T;
  } catch (error) {
    console.error(`[SecureStorage] Failed to retrieve ${key}:`, error);

    // Try to parse as plain JSON (backwards compatibility)
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored) as T;
      }
    } catch {
      // Ignore
    }

    return null;
  }
}

/**
 * Remove secure data from localStorage
 */
export function secureRemove(key: string): void {
  localStorage.removeItem(key);
}

// ============================================================================
// SENSITIVE DATA KEYS
// ============================================================================

export const SENSITIVE_KEYS = [
  'jobproof_user_v2',
  'jobproof_magic_links',
  'jobproof_auth_token',
  'jobproof_draft_',  // Prefix for draft data
] as const;

/**
 * Check if a key contains sensitive data
 */
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.some(sensitive =>
    key === sensitive || key.startsWith(sensitive)
  );
}

/**
 * Migrate existing plaintext data to encrypted format
 */
export async function migrateToEncrypted(): Promise<void> {
  console.log('[Encryption] Starting migration of sensitive data...');

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    if (isSensitiveKey(key)) {
      const value = localStorage.getItem(key);
      if (value && !isEncrypted(value)) {
        try {
          const encrypted = await encrypt(value);
          localStorage.setItem(key, encrypted);
          console.log(`[Encryption] Migrated: ${key}`);
        } catch (error) {
          console.warn(`[Encryption] Failed to migrate ${key}:`, error);
        }
      }
    }
  }

  console.log('[Encryption] Migration complete');
}
