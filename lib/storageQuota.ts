/**
 * Storage Quota Detection Service
 *
 * Monitors browser storage usage and warns users before
 * hitting quota limits. Critical for offline-first app
 * that stores photos locally.
 */

import { logger } from './errorLogger';

export interface StorageQuotaInfo {
  usage: number;
  quota: number;
  available: number;
  usagePercent: number;
  isLow: boolean;
  isCritical: boolean;
}

// Thresholds
const LOW_STORAGE_THRESHOLD = 0.75; // 75% usage
const CRITICAL_STORAGE_THRESHOLD = 0.90; // 90% usage

// Cache the last check to avoid repeated API calls
let lastQuotaCheck: StorageQuotaInfo | null = null;
let lastCheckTime = 0;
const CHECK_CACHE_TTL = 30000; // 30 seconds

/**
 * Clear quota cache (for testing)
 * @internal
 */
export function _clearQuotaCache(): void {
  lastQuotaCheck = null;
  lastCheckTime = 0;
}

/**
 * Get current storage quota information
 */
export async function getStorageQuota(): Promise<StorageQuotaInfo | null> {
  // Return cached value if recent
  if (lastQuotaCheck && Date.now() - lastCheckTime < CHECK_CACHE_TTL) {
    return lastQuotaCheck;
  }

  // Check if Storage API is available
  if (!navigator?.storage?.estimate) {
    logger.warn('storage', 'Storage API not available in this browser');
    return null;
  }

  try {
    const estimate = await navigator.storage.estimate();

    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const available = quota - usage;
    const usagePercent = quota > 0 ? usage / quota : 0;

    const info: StorageQuotaInfo = {
      usage,
      quota,
      available,
      usagePercent,
      isLow: usagePercent >= LOW_STORAGE_THRESHOLD,
      isCritical: usagePercent >= CRITICAL_STORAGE_THRESHOLD
    };

    // Update cache
    lastQuotaCheck = info;
    lastCheckTime = Date.now();

    // Log warnings if needed
    if (info.isCritical) {
      logger.critical('storage', 'Storage quota critical', undefined, {
        usagePercent: `${(usagePercent * 100).toFixed(1)}%`,
        available: formatBytes(available)
      });
    } else if (info.isLow) {
      logger.warn('storage', 'Storage quota low', undefined, {
        usagePercent: `${(usagePercent * 100).toFixed(1)}%`,
        available: formatBytes(available)
      });
    }

    return info;
  } catch (error) {
    logger.error('storage', 'Failed to check storage quota', error);
    return null;
  }
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Check if there's enough space for a given size
 */
export async function hasSpaceFor(sizeInBytes: number): Promise<boolean> {
  const quota = await getStorageQuota();
  if (!quota) return true; // Assume OK if we can't check

  // Add 10% buffer
  const requiredSpace = sizeInBytes * 1.1;
  return quota.available >= requiredSpace;
}

/**
 * Request persistent storage (prevents automatic eviction)
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator?.storage?.persist) {
    logger.info('storage', 'Persistent storage not available');
    return false;
  }

  try {
    // Check if already persistent
    const isPersisted = await navigator.storage.persisted();
    if (isPersisted) {
      logger.debug('storage', 'Storage is already persistent');
      return true;
    }

    // Request persistence
    const granted = await navigator.storage.persist();
    if (granted) {
      logger.info('storage', 'Persistent storage granted');
    } else {
      logger.warn('storage', 'Persistent storage denied by browser');
    }
    return granted;
  } catch (error) {
    logger.error('storage', 'Failed to request persistent storage', error);
    return false;
  }
}

/**
 * Get a user-friendly storage status message
 */
export async function getStorageStatusMessage(): Promise<string> {
  const quota = await getStorageQuota();

  if (!quota) {
    return 'Storage status unavailable';
  }

  const usedStr = formatBytes(quota.usage);
  const totalStr = formatBytes(quota.quota);
  const percentStr = `${(quota.usagePercent * 100).toFixed(0)}%`;

  if (quota.isCritical) {
    return `⚠️ Storage critical: ${usedStr} / ${totalStr} (${percentStr}). Clear old jobs to continue.`;
  } else if (quota.isLow) {
    return `⚡ Storage low: ${usedStr} / ${totalStr} (${percentStr}). Consider clearing completed jobs.`;
  } else {
    return `Storage: ${usedStr} / ${totalStr} (${percentStr})`;
  }
}

/**
 * Calculate approximate photo storage cost
 * Average JPEG photo ~500KB-2MB
 */
export function estimatePhotoStorageCost(photoCount: number, avgSizeKB: number = 1000): number {
  return photoCount * avgSizeKB * 1024;
}

/**
 * Subscribe to storage warnings (for UI notifications)
 */
type StorageWarningCallback = (info: StorageQuotaInfo) => void;
const warningCallbacks: StorageWarningCallback[] = [];

export function onStorageWarning(callback: StorageWarningCallback): () => void {
  warningCallbacks.push(callback);
  return () => {
    const index = warningCallbacks.indexOf(callback);
    if (index > -1) {
      warningCallbacks.splice(index, 1);
    }
  };
}

/**
 * Check storage and notify subscribers if low
 */
export async function checkAndNotify(): Promise<void> {
  const quota = await getStorageQuota();
  if (quota && (quota.isLow || quota.isCritical)) {
    warningCallbacks.forEach(cb => cb(quota));
  }
}

// Auto-check storage periodically (every 5 minutes)
// DEFERRED: Don't block app startup
if (typeof window !== 'undefined') {
  // Delay initial setup to not interfere with app startup
  setTimeout(() => {
    setInterval(checkAndNotify, 5 * 60 * 1000);
    // Initial check after app has loaded
    checkAndNotify().catch(() => {
      // Silently fail - storage check is not critical
    });
  }, 10000); // 10 second delay before first check
}
