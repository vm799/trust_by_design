/**
 * Storage Utilities - FIX 2.2
 *
 * Safe form draft persistence with:
 * - Quota checking BEFORE write
 * - Workspace isolation (wsId prefix)
 * - Migration from localStorage to IndexedDB
 * - Graceful error handling
 *
 * DEFENSIVE PATTERNS:
 * 1. Pre-flight quota check (never write then check)
 * 2. Workspace isolation in key (formType:wsId)
 * 3. Retry on transient errors (VersionError, etc)
 * 4. Migration from old localStorage format
 * 5. All errors caught, never crash caller
 */

import { getDatabase, DRAFT_EXPIRY_MS, type FormDraft } from '../offline/db';
import { getStorageQuota } from '../storageQuota';

// Quota thresholds
const CRITICAL_QUOTA_THRESHOLD = 0.95; // 95% full
const WARNING_QUOTA_THRESHOLD = 0.80;  // 80% full

// Retry configuration for transient errors
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 100;

/**
 * Check if enough storage quota is available for a given size
 *
 * DEFENSIVE: Always check BEFORE attempting write
 *
 * @param sizeInBytes - Size of data to write
 * @returns true if space available, false if quota critical
 */
export async function hasSpaceFor(sizeInBytes: number): Promise<boolean> {
  try {
    const quota = await getStorageQuota();
    if (!quota) {
      // Quota API not available - optimistically allow write
      console.warn('[storageUtils] Quota API unavailable, allowing write');
      return true;
    }

    // Check if usage is critical (>95%)
    if (quota.usagePercent >= CRITICAL_QUOTA_THRESHOLD) {
      console.error(
        `[storageUtils] Storage critical: ${(quota.usagePercent * 100).toFixed(1)}% full`
      );
      return false;
    }

    // Check if adding this data would exceed critical threshold
    const projectedUsage = quota.usage + sizeInBytes;
    const projectedPercent = projectedUsage / quota.quota;

    if (projectedPercent >= CRITICAL_QUOTA_THRESHOLD) {
      console.warn(
        `[storageUtils] Write would exceed quota: ${(projectedPercent * 100).toFixed(1)}%`
      );
      return false;
    }

    // Warn if approaching quota
    if (quota.usagePercent >= WARNING_QUOTA_THRESHOLD) {
      console.warn(
        `[storageUtils] Storage getting full: ${(quota.usagePercent * 100).toFixed(1)}%`
      );
    }

    return true;
  } catch (error) {
    // If quota check fails, allow write (optimistic)
    console.warn('[storageUtils] Quota check failed, allowing write:', error);
    return true;
  }
}

/**
 * Safely save form draft to IndexedDB with quota checking and workspace isolation
 *
 * DEFENSIVE FEATURES:
 * - Pre-flight quota check
 * - Workspace isolation (formType:wsId key)
 * - Retry on transient errors
 * - Never throws (returns false on failure)
 *
 * @param formType - Type of form ('job', 'client', 'technician')
 * @param data - Form data object
 * @param wsId - Workspace ID for isolation
 * @returns true if saved, false if quota exceeded or error
 */
export async function safeSaveDraft(
  formType: string,
  data: Record<string, unknown>,
  wsId: string
): Promise<boolean> {
  try {
    // DEFENSIVE RULE #1: Quota check BEFORE write
    const dataSize = JSON.stringify(data).length;
    const hasSpace = await hasSpaceFor(dataSize);

    if (!hasSpace) {
      console.error('[storageUtils] Quota exceeded, cannot save draft');
      return false;
    }

    // DEFENSIVE RULE #2: Workspace isolation
    const isolatedKey = `${formType}:${wsId}`;

    const draft: FormDraft = {
      formType: isolatedKey,
      data,
      savedAt: Date.now(),
    };

    // DEFENSIVE RULE #3: Retry on transient errors
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const db = await getDatabase();
        await db.formDrafts.put(draft);
        return true;
      } catch (error: any) {
        lastError = error;

        // Check if error is transient (retry) or fatal (fail)
        const isTransient =
          error.name === 'VersionError' ||
          error.name === 'AbortError' ||
          error.message?.includes('transaction');

        if (!isTransient) {
          // Fatal error (quota, permissions, etc) - don't retry
          break;
        }

        // Transient error - retry after delay
        if (attempt < MAX_RETRIES - 1) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
          console.warn(`[storageUtils] Retrying save after ${error.name} (attempt ${attempt + 1})`);
        }
      }
    }

    // All retries failed
    if (lastError) {
      // Check for quota exceeded
      const isQuotaError =
        lastError.name === 'QuotaExceededError' ||
        lastError.message?.includes('QuotaExceededError');

      if (isQuotaError) {
        console.error('[storageUtils] IndexedDB quota exceeded');
      } else {
        console.error('[storageUtils] Failed to save draft after retries:', lastError);
      }
    }

    return false;
  } catch (error) {
    // DEFENSIVE RULE #5: Never crash caller
    console.error('[storageUtils] Unexpected error in safeSaveDraft:', error);
    return false;
  }
}

/**
 * Load form draft from IndexedDB with workspace isolation and expiry check
 *
 * DEFENSIVE FEATURES:
 * - Workspace isolation (formType:wsId key)
 * - Expiry check (8 hour limit)
 * - Auto-cleanup expired drafts
 * - Returns null on error (never throws)
 *
 * @param formType - Type of form ('job', 'client', 'technician')
 * @param wsId - Workspace ID for isolation
 * @returns Form data or null if not found/expired
 */
export async function loadDraft(
  formType: string,
  wsId: string
): Promise<Record<string, unknown> | null> {
  try {
    // DEFENSIVE RULE #2: Workspace isolation
    const isolatedKey = `${formType}:${wsId}`;

    const db = await getDatabase();
    const draft = await db.formDrafts.get(isolatedKey);

    if (!draft) {
      return null;
    }

    // Check expiry (8 hours)
    const age = Date.now() - draft.savedAt;
    if (age >= DRAFT_EXPIRY_MS) {
      // Auto-cleanup expired draft
      await db.formDrafts.delete(isolatedKey);
      return null;
    }

    return draft.data as Record<string, unknown>;
  } catch (error) {
    // DEFENSIVE RULE #5: Never crash caller
    console.error('[storageUtils] Failed to load draft:', error);
    return null;
  }
}

/**
 * Migrate old localStorage draft to IndexedDB
 *
 * DEFENSIVE FEATURES:
 * - Idempotent (safe to call multiple times)
 * - Cleans up localStorage after migration
 * - Never throws on error
 *
 * @param formType - Type of form ('job', 'client', 'technician')
 * @param wsId - Workspace ID for isolation
 */
export async function migrateDraftFromLocalStorage(
  formType: string,
  wsId: string
): Promise<void> {
  try {
    // Old localStorage key format (pre-migration)
    const oldKey = `jobproof_${formType}_draft`;
    const oldDraftJson = localStorage.getItem(oldKey);

    if (!oldDraftJson) {
      // No old draft to migrate
      return;
    }

    // Parse old draft
    let oldDraft: Record<string, unknown>;
    try {
      oldDraft = JSON.parse(oldDraftJson);
    } catch (parseError) {
      console.warn('[storageUtils] Failed to parse old draft, removing:', parseError);
      localStorage.removeItem(oldKey);
      return;
    }

    // Migrate to IndexedDB with workspace isolation
    const success = await safeSaveDraft(formType, oldDraft, wsId);

    if (success) {
      // Migration successful - remove old localStorage draft
      localStorage.removeItem(oldKey);
    } else {
      console.warn('[storageUtils] Migration failed, keeping localStorage draft as fallback');
    }
  } catch (error) {
    // DEFENSIVE RULE #5: Never crash caller
    console.error('[storageUtils] Migration error:', error);
  }
}

/**
 * Clear form draft (after successful submission)
 *
 * @param formType - Type of form ('job', 'client', 'technician')
 * @param wsId - Workspace ID for isolation
 */
export async function clearDraft(formType: string, wsId: string): Promise<void> {
  try {
    const isolatedKey = `${formType}:${wsId}`;
    const db = await getDatabase();
    await db.formDrafts.delete(isolatedKey);
  } catch (error) {
    console.error('[storageUtils] Failed to clear draft:', error);
    // Non-critical - draft will expire after 8h anyway
  }
}
