/**
 * Safe localStorage wrapper that handles QuotaExceededError gracefully
 *
 * When localStorage reaches ~5MB limit, provides:
 * - Graceful error detection
 * - Callback-based warning system
 * - Fallback to IndexedDB-only storage
 */

import { getStorageQuota, formatBytes } from '../storageQuota';

// Warning callback type
type QuotaExceededCallback = (info: { usage: number; quota: number; percent: number }) => void;
const quotaExceededCallbacks: QuotaExceededCallback[] = [];

// Critical threshold: 80% of quota
const CRITICAL_QUOTA_THRESHOLD = 0.80;

/**
 * Register a callback to be called when quota is exceeded
 * Returns unsubscribe function
 */
export function onQuotaExceeded(callback: QuotaExceededCallback): () => void {
  quotaExceededCallbacks.push(callback);
  return () => {
    const index = quotaExceededCallbacks.indexOf(callback);
    if (index > -1) {
      quotaExceededCallbacks.splice(index, 1);
    }
  };
}

/**
 * Notify all subscribers that quota is critical
 */
function notifyQuotaExceeded(usage: number, quota: number, percent: number): void {
  quotaExceededCallbacks.forEach(cb => {
    try {
      cb({ usage, quota, percent });
    } catch (err) {
      console.error('[safeLocalStorage] Callback error:', err);
    }
  });
}

/**
 * Safely attempt to set an item in localStorage
 * Returns true if successful, false if quota exceeded
 *
 * @param key - localStorage key
 * @param value - JSON string value
 * @returns Promise<boolean> - true if saved, false if quota exceeded
 *
 * Usage:
 *   const success = await safeSetItem('jobs', JSON.stringify(jobs));
 *   if (!success) {
 *     // Fall back to IndexedDB only
 *   }
 */
export async function safeSetItem(key: string, value: string): Promise<boolean> {
  try {
    localStorage.setItem(key, value);

    // Check if we're approaching quota after successful save
    const quota = await getStorageQuota();
    if (quota && quota.usagePercent >= CRITICAL_QUOTA_THRESHOLD) {
      console.warn(
        '[safeLocalStorage] Storage critical at',
        `${(quota.usagePercent * 100).toFixed(0)}% - notifying watchers`
      );
      notifyQuotaExceeded(quota.usage, quota.quota, quota.usagePercent);
    }

    return true;
  } catch (err) {
    // Check error type
    const isQuotaError =
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' ||
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        err.code === 22); // QuotaExceededError code

    if (isQuotaError) {
      console.error(
        '[safeLocalStorage] QuotaExceededError on key:',
        key,
        '- falling back to IndexedDB only'
      );

      // Get current quota info for callback
      const quota = await getStorageQuota();
      if (quota) {
        notifyQuotaExceeded(quota.usage, quota.quota, quota.usagePercent);
      }

      return false;
    }

    // Other errors - log and rethrow
    console.error('[safeLocalStorage] Unexpected error:', err);
    throw err;
  }
}

/**
 * Remove an item from localStorage (for freeing space)
 */
export function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.error('[safeLocalStorage] Error removing item:', err);
  }
}

/**
 * Get current storage usage summary
 */
export async function getStorageSummary(): Promise<{
  message: string;
  isCritical: boolean;
  isLow: boolean;
  percent: number;
  available: string;
} | null> {
  const quota = await getStorageQuota();
  if (!quota) {
    return null;
  }

  return {
    message:
      quota.usagePercent >= 0.9
        ? `⚠️ Storage nearly full - ${formatBytes(quota.available)} remaining`
        : quota.usagePercent >= 0.75
          ? `⚡ Storage getting full - ${formatBytes(quota.available)} remaining`
          : `Storage OK - ${formatBytes(quota.available)} available`,
    isCritical: quota.usagePercent >= 0.9,
    isLow: quota.usagePercent >= 0.75,
    percent: Math.round(quota.usagePercent * 100),
    available: formatBytes(quota.available),
  };
}
