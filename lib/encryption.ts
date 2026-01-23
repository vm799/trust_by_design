/**
 * Encryption Service
 *
 * AES-256-GCM encryption for sensitive localStorage data
 * Uses Web Crypto API for secure client-side encryption
 */

// Key storage name
const KEY_STORAGE = 'jobproof_encryption_key';
const ENCRYPTED_PREFIX = 'enc:';

/**
 * Generate a new encryption key
 */
async function generateKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable for storage
    ['encrypt', 'decrypt']
  );
}

/**
 * Export key to storable format
 */
async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

/**
 * Import key from stored format
 */
async function importKey(keyData: string): Promise<CryptoKey> {
  const rawKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Get or create encryption key
 * Key is stored in localStorage (in production, consider more secure storage)
 */
async function getOrCreateKey(): Promise<CryptoKey> {
  try {
    const storedKey = localStorage.getItem(KEY_STORAGE);
    if (storedKey) {
      return await importKey(storedKey);
    }

    // Generate new key
    const key = await generateKey();
    const exported = await exportKey(key);
    localStorage.setItem(KEY_STORAGE, exported);
    return key;
  } catch (error) {
    console.error('[Encryption] Failed to get/create key:', error);
    throw error;
  }
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
