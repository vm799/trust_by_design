/**
 * Conflict Telemetry
 * P1-1a: Observe conflicts before building resolution UI
 *
 * PURPOSE: Understand real conflict patterns before designing UI.
 * - How often do conflicts occur?
 * - Which object types conflict?
 * - What resolution paths are taken?
 *
 * NO UI - Just silent logging and localStorage storage for analysis.
 */

// Conflict types we track
export type ConflictType =
  | 'DUPLICATE_PHOTO_ID'      // Same photo ID uploaded twice
  | 'JOB_LOCAL_REMOTE_DIFF'   // Job modified both locally and remotely
  | 'UPSERT_VERSION_MISMATCH' // Supabase rejected due to version conflict
  | 'PHOTO_ALREADY_EXISTS'    // Photo file already in storage
  | 'SIGNATURE_ALREADY_EXISTS'; // Signature file already in storage

// Object types that can conflict
export type ConflictObjectType = 'job' | 'photo' | 'signature' | 'checklist';

// Resolution paths
export type ResolutionPath =
  | 'LOCAL_WINS'    // Local data overwrote remote
  | 'REMOTE_WINS'   // Remote data kept, local discarded
  | 'MERGED'        // Both versions merged
  | 'RETRY_SUCCESS' // Retry resolved the conflict
  | 'RETRY_FAILED'  // Retry didn't help
  | 'USER_CHOSE'    // User made explicit choice (future)
  | 'AUTO_RESOLVED' // System resolved automatically
  | 'UNRESOLVED';   // Conflict detected but not resolved

// Conflict event structure
export interface ConflictEvent {
  id: string;
  timestamp: string;
  conflictType: ConflictType;
  objectType: ConflictObjectType;
  objectId: string;
  jobId?: string;
  resolution: ResolutionPath;
  metadata?: {
    localVersion?: string;
    remoteVersion?: string;
    errorMessage?: string;
    retryCount?: number;
  };
}

// Storage key for conflict log
const CONFLICT_LOG_KEY = 'jobproof_conflict_telemetry';
const MAX_LOGGED_CONFLICTS = 100; // Keep last 100 conflicts

/**
 * Log a conflict event
 * Silent - no user notification, just storage
 */
export function logConflict(
  conflictType: ConflictType,
  objectType: ConflictObjectType,
  objectId: string,
  resolution: ResolutionPath,
  options?: {
    jobId?: string;
    localVersion?: string;
    remoteVersion?: string;
    errorMessage?: string;
    retryCount?: number;
  }
): void {
  const event: ConflictEvent = {
    id: `conflict_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    conflictType,
    objectType,
    objectId,
    jobId: options?.jobId,
    resolution,
    metadata: options ? {
      localVersion: options.localVersion,
      remoteVersion: options.remoteVersion,
      errorMessage: options.errorMessage,
      retryCount: options.retryCount,
    } : undefined,
  };

  // Log to console for dev visibility

  // Persist to localStorage for analysis
  try {
    const existing = getConflictLog();
    existing.push(event);

    // Keep only last N conflicts
    const trimmed = existing.slice(-MAX_LOGGED_CONFLICTS);
    localStorage.setItem(CONFLICT_LOG_KEY, JSON.stringify(trimmed));
  } catch (e) {
    // localStorage full or unavailable - just log to console
    console.warn('[ConflictTelemetry] Failed to persist:', e);
  }
}

/**
 * Get all logged conflicts
 */
export function getConflictLog(): ConflictEvent[] {
  try {
    const raw = localStorage.getItem(CONFLICT_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Get conflict summary statistics
 * Useful for debugging and deciding if UI is needed
 */
export function getConflictStats(): {
  total: number;
  byType: Record<ConflictType, number>;
  byObjectType: Record<ConflictObjectType, number>;
  byResolution: Record<ResolutionPath, number>;
  last24h: number;
  last7d: number;
} {
  const log = getConflictLog();
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const stats = {
    total: log.length,
    byType: {} as Record<ConflictType, number>,
    byObjectType: {} as Record<ConflictObjectType, number>,
    byResolution: {} as Record<ResolutionPath, number>,
    last24h: 0,
    last7d: 0,
  };

  for (const event of log) {
    // Count by type
    stats.byType[event.conflictType] = (stats.byType[event.conflictType] || 0) + 1;
    stats.byObjectType[event.objectType] = (stats.byObjectType[event.objectType] || 0) + 1;
    stats.byResolution[event.resolution] = (stats.byResolution[event.resolution] || 0) + 1;

    // Count recent
    const eventTime = new Date(event.timestamp).getTime();
    if (now - eventTime < day) stats.last24h++;
    if (now - eventTime < 7 * day) stats.last7d++;
  }

  return stats;
}

/**
 * Clear conflict log (use for testing/reset)
 */
export function clearConflictLog(): void {
  localStorage.removeItem(CONFLICT_LOG_KEY);
}

/**
 * Helper: Detect if an error indicates a conflict
 */
export function isConflictError(error: unknown): boolean {
  if (!error) return false;

  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  return (
    lowerMessage.includes('conflict') ||
    lowerMessage.includes('already exists') ||
    lowerMessage.includes('duplicate') ||
    lowerMessage.includes('version mismatch') ||
    lowerMessage.includes('409') // HTTP 409 Conflict
  );
}

/**
 * Helper: Extract conflict type from error
 */
export function getConflictTypeFromError(error: unknown): ConflictType | null {
  if (!error) return null;

  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('duplicate') || lowerMessage.includes('already exists')) {
    if (lowerMessage.includes('photo')) return 'PHOTO_ALREADY_EXISTS';
    if (lowerMessage.includes('signature')) return 'SIGNATURE_ALREADY_EXISTS';
    return 'DUPLICATE_PHOTO_ID';
  }

  if (lowerMessage.includes('version') || lowerMessage.includes('409')) {
    return 'UPSERT_VERSION_MISMATCH';
  }

  return null;
}
