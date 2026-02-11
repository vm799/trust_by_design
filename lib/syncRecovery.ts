/**
 * Sync Recovery Service
 *
 * Robust sync failure handling with:
 * - Categorized error codes
 * - Exponential backoff with jitter
 * - Automatic recovery strategies
 * - User-actionable error messages
 * - Sync health monitoring
 */

import { getSupabase, isSupabaseAvailable } from './supabase';

// ============================================================================
// ERROR CODES
// ============================================================================

export enum SyncErrorCode {
  // Network Errors (1xx)
  NETWORK_OFFLINE = 'SYNC_100',
  NETWORK_TIMEOUT = 'SYNC_101',
  NETWORK_DNS_FAILURE = 'SYNC_102',
  NETWORK_SSL_ERROR = 'SYNC_103',

  // Authentication Errors (2xx)
  AUTH_EXPIRED = 'SYNC_200',
  AUTH_INVALID = 'SYNC_201',
  AUTH_REVOKED = 'SYNC_202',
  AUTH_WORKSPACE_MISMATCH = 'SYNC_203',

  // Data Errors (3xx)
  DATA_VALIDATION_FAILED = 'SYNC_300',
  DATA_CONFLICT = 'SYNC_301',
  DATA_TOO_LARGE = 'SYNC_302',
  DATA_CORRUPTED = 'SYNC_303',
  DATA_MISSING_REQUIRED = 'SYNC_304',

  // Server Errors (4xx)
  SERVER_ERROR = 'SYNC_400',
  SERVER_UNAVAILABLE = 'SYNC_401',
  SERVER_RATE_LIMITED = 'SYNC_402',
  SERVER_MAINTENANCE = 'SYNC_403',

  // Storage Errors (5xx)
  STORAGE_QUOTA_EXCEEDED = 'SYNC_500',
  STORAGE_UPLOAD_FAILED = 'SYNC_501',
  STORAGE_FILE_TOO_LARGE = 'SYNC_502',
  STORAGE_INVALID_TYPE = 'SYNC_503',

  // Unknown
  UNKNOWN = 'SYNC_999',
}

export interface SyncError {
  code: SyncErrorCode;
  message: string;
  userMessage: string;
  recoveryAction: RecoveryAction;
  retryable: boolean;
  details?: Record<string, any>;
  timestamp: string;
}

export type RecoveryAction =
  | 'retry_auto'       // Will retry automatically
  | 'retry_manual'     // User should click retry
  | 'reauthenticate'   // User needs to log in again
  | 'reduce_data'      // Reduce payload size
  | 'contact_support'  // Escalate to support
  | 'wait'             // Wait for server/network
  | 'none';            // No recovery possible

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

/**
 * Classify an error and return structured SyncError
 */
export function classifyError(error: unknown, context?: string): SyncError {
  const timestamp = new Date().toISOString();

  // Network offline
  if (!navigator.onLine) {
    return {
      code: SyncErrorCode.NETWORK_OFFLINE,
      message: 'Device is offline',
      userMessage: 'You appear to be offline. Your data is saved locally and will sync when you reconnect.',
      recoveryAction: 'retry_auto',
      retryable: true,
      timestamp,
    };
  }

  // Handle Error objects
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    // Timeout errors
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return {
        code: SyncErrorCode.NETWORK_TIMEOUT,
        message: error.message,
        userMessage: 'The connection timed out. This usually means slow internet. We\'ll retry automatically.',
        recoveryAction: 'retry_auto',
        retryable: true,
        timestamp,
      };
    }

    // Auth errors
    if (msg.includes('unauthorized') || msg.includes('401') || msg.includes('jwt')) {
      return {
        code: SyncErrorCode.AUTH_EXPIRED,
        message: error.message,
        userMessage: 'Your session has expired. Please refresh the page or log in again.',
        recoveryAction: 'reauthenticate',
        retryable: false,
        timestamp,
      };
    }

    // Rate limiting
    if (msg.includes('rate limit') || msg.includes('429') || msg.includes('too many')) {
      return {
        code: SyncErrorCode.SERVER_RATE_LIMITED,
        message: error.message,
        userMessage: 'Too many requests. Please wait a moment and try again.',
        recoveryAction: 'wait',
        retryable: true,
        timestamp,
      };
    }

    // Server errors
    if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504')) {
      return {
        code: SyncErrorCode.SERVER_ERROR,
        message: error.message,
        userMessage: 'The server is having issues. We\'ll retry automatically. Your data is safe.',
        recoveryAction: 'retry_auto',
        retryable: true,
        timestamp,
      };
    }

    // Storage/quota errors
    if (msg.includes('quota') || msg.includes('storage')) {
      return {
        code: SyncErrorCode.STORAGE_QUOTA_EXCEEDED,
        message: error.message,
        userMessage: 'Storage limit reached. Try removing old photos or contact support.',
        recoveryAction: 'reduce_data',
        retryable: false,
        timestamp,
      };
    }

    // Payload too large
    if (msg.includes('payload too large') || msg.includes('413') || msg.includes('too large')) {
      return {
        code: SyncErrorCode.DATA_TOO_LARGE,
        message: error.message,
        userMessage: 'The data is too large to sync. Try reducing photo quality or splitting into smaller batches.',
        recoveryAction: 'reduce_data',
        retryable: false,
        timestamp,
      };
    }

    // Validation errors
    if (msg.includes('validation') || msg.includes('invalid') || msg.includes('required')) {
      return {
        code: SyncErrorCode.DATA_VALIDATION_FAILED,
        message: error.message,
        userMessage: 'Some data is invalid or missing. Please check all required fields.',
        recoveryAction: 'retry_manual',
        retryable: false,
        details: { context },
        timestamp,
      };
    }
  }

  // Default unknown error
  return {
    code: SyncErrorCode.UNKNOWN,
    message: error instanceof Error ? error.message : String(error),
    userMessage: 'An unexpected error occurred. We\'ll retry automatically. If this persists, contact support.',
    recoveryAction: 'retry_auto',
    retryable: true,
    details: { context, raw: error },
    timestamp,
  };
}

// ============================================================================
// EXPONENTIAL BACKOFF
// ============================================================================

export interface BackoffConfig {
  initialDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
  jitterFactor: number; // 0-1, adds randomness
  maxRetries: number;
}

const DEFAULT_BACKOFF: BackoffConfig = {
  initialDelayMs: 1000,      // 1 second
  maxDelayMs: 300000,        // 5 minutes
  multiplier: 2,
  jitterFactor: 0.2,         // 20% jitter
  maxRetries: 10,
};

/**
 * Calculate delay for retry attempt
 */
export function calculateBackoffDelay(
  attempt: number,
  config: BackoffConfig = DEFAULT_BACKOFF
): number {
  // Base delay with exponential growth
  let delay = config.initialDelayMs * Math.pow(config.multiplier, attempt);

  // Cap at max delay
  delay = Math.min(delay, config.maxDelayMs);

  // Add jitter to prevent thundering herd
  const jitter = delay * config.jitterFactor * (Math.random() * 2 - 1);
  delay = Math.max(0, delay + jitter);

  return Math.round(delay);
}

/**
 * Check if should retry based on attempt count
 */
export function shouldRetry(
  attempt: number,
  error: SyncError,
  config: BackoffConfig = DEFAULT_BACKOFF
): boolean {
  if (!error.retryable) return false;
  if (attempt >= config.maxRetries) return false;
  return true;
}

// ============================================================================
// SYNC STATE MANAGEMENT
// ============================================================================

export interface SyncState {
  status: 'idle' | 'syncing' | 'error' | 'recovering';
  lastSyncAt?: string;
  lastErrorAt?: string;
  lastError?: SyncError;
  pendingItems: number;
  failedItems: number;
  currentAttempt: number;
  nextRetryAt?: string;
  health: 'healthy' | 'degraded' | 'unhealthy';
}

const SYNC_STATE_KEY = 'jobproof_sync_state';

/**
 * Get current sync state
 */
export function getSyncState(): SyncState {
  try {
    const stored = localStorage.getItem(SYNC_STATE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore
  }

  return {
    status: 'idle',
    pendingItems: 0,
    failedItems: 0,
    currentAttempt: 0,
    health: 'healthy',
  };
}

/**
 * Update sync state
 */
export function updateSyncState(updates: Partial<SyncState>): void {
  const current = getSyncState();
  const updated = { ...current, ...updates };

  // Calculate health based on recent errors
  if (updated.failedItems > 5) {
    updated.health = 'unhealthy';
  } else if (updated.failedItems > 0 || updated.status === 'error') {
    updated.health = 'degraded';
  } else {
    updated.health = 'healthy';
  }

  try {
    localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Record sync success
 */
export function recordSyncSuccess(): void {
  updateSyncState({
    status: 'idle',
    lastSyncAt: new Date().toISOString(),
    currentAttempt: 0,
    nextRetryAt: undefined,
    lastError: undefined,
  });
}

/**
 * Record sync failure
 */
export function recordSyncFailure(error: SyncError): void {
  const state = getSyncState();
  const nextAttempt = state.currentAttempt + 1;

  let nextRetryAt: string | undefined;
  if (shouldRetry(nextAttempt, error)) {
    const delay = calculateBackoffDelay(nextAttempt);
    nextRetryAt = new Date(Date.now() + delay).toISOString();
  }

  updateSyncState({
    status: 'error',
    lastErrorAt: new Date().toISOString(),
    lastError: error,
    currentAttempt: nextAttempt,
    nextRetryAt,
    failedItems: state.failedItems + 1,
  });

  // Notify user if critical
  if (!error.retryable || nextAttempt >= 5) {
    notifyUser(error);
  }
}

// ============================================================================
// USER NOTIFICATION
// ============================================================================

/**
 * Notify user of sync issue
 */
function notifyUser(error: SyncError): void {
  // Store for UI display
  const notifications = JSON.parse(localStorage.getItem('jobproof_sync_notifications') || '[]');
  notifications.push({
    id: crypto.randomUUID(),
    code: error.code,
    message: error.userMessage,
    action: error.recoveryAction,
    timestamp: error.timestamp,
    dismissed: false,
  });
  localStorage.setItem('jobproof_sync_notifications', JSON.stringify(notifications.slice(-10)));
}

/**
 * Get pending sync notifications for UI
 */
export function getSyncNotifications(): Array<{
  id: string;
  code: SyncErrorCode;
  message: string;
  action: RecoveryAction;
  timestamp: string;
  dismissed: boolean;
}> {
  try {
    return JSON.parse(localStorage.getItem('jobproof_sync_notifications') || '[]')
      .filter((n: any) => !n.dismissed);
  } catch {
    return [];
  }
}

/**
 * Dismiss a sync notification
 */
export function dismissSyncNotification(id: string): void {
  try {
    const notifications = JSON.parse(localStorage.getItem('jobproof_sync_notifications') || '[]');
    const updated = notifications.map((n: any) =>
      n.id === id ? { ...n, dismissed: true } : n
    );
    localStorage.setItem('jobproof_sync_notifications', JSON.stringify(updated));
  } catch {
    // Ignore
  }
}

// ============================================================================
// RECOVERY STRATEGIES
// ============================================================================

/**
 * Execute recovery strategy for an error
 */
export async function executeRecovery(error: SyncError): Promise<boolean> {
  switch (error.recoveryAction) {
    case 'retry_auto':
      // Will be handled by backoff system
      return true;

    case 'reauthenticate':
      // Clear auth and redirect
      localStorage.removeItem('jobproof_auth_token');
      // Don't redirect automatically - let UI handle it
      return false;

    case 'reduce_data':
      // Try to reduce pending data size
      return await attemptDataReduction();

    case 'wait':
      // Just wait for next retry
      return true;

    case 'retry_manual':
    case 'contact_support':
    case 'none':
    default:
      return false;
  }
}

/**
 * Attempt to reduce data size for sync
 */
async function attemptDataReduction(): Promise<boolean> {
  try {
    // Get pending sync queue
    const queue = JSON.parse(localStorage.getItem('jobproof_sync_queue') || '[]');

    // Sort by size (largest first)
    queue.sort((a: any, b: any) => {
      const sizeA = JSON.stringify(a).length;
      const sizeB = JSON.stringify(b).length;
      return sizeB - sizeA;
    });

    // Try to compress photos in queue
    for (const item of queue) {
      if (item.type === 'photo' && item.data) {
        // Mark for lower quality re-upload
        item.needsCompression = true;
      }
    }

    localStorage.setItem('jobproof_sync_queue', JSON.stringify(queue));

    return true;
  } catch (e) {
    console.error('[SyncRecovery] Data reduction failed:', e);
    return false;
  }
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * Perform sync health check
 */
export async function checkSyncHealth(): Promise<{
  online: boolean;
  supabaseReachable: boolean;
  storageAvailable: boolean;
  pendingItems: number;
  health: 'healthy' | 'degraded' | 'unhealthy';
}> {
  const online = navigator.onLine;
  let supabaseReachable = false;
  let storageAvailable = true;

  // Check Supabase connectivity
  if (online && isSupabaseAvailable()) {
    try {
      const supabase = getSupabase();
      if (supabase) {
        // Simple health check query
        const { error } = await supabase.from('jobs').select('id').limit(1);
        supabaseReachable = !error;
      }
    } catch {
      supabaseReachable = false;
    }
  }

  // Check localStorage availability
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
  } catch {
    storageAvailable = false;
  }

  // Count pending items
  const queue = JSON.parse(localStorage.getItem('jobproof_sync_queue') || '[]');
  const pendingItems = queue.length;

  // Determine health
  let health: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (!online || !storageAvailable) {
    health = 'unhealthy';
  } else if (!supabaseReachable || pendingItems > 10) {
    health = 'degraded';
  }

  return {
    online,
    supabaseReachable,
    storageAvailable,
    pendingItems,
    health,
  };
}

// ============================================================================
// RETRY SCHEDULER
// ============================================================================

let retryTimeout: number | null = null;

/**
 * Schedule next retry based on current state
 */
export function scheduleRetry(
  retryFn: () => Promise<void>,
  config: BackoffConfig = DEFAULT_BACKOFF
): void {
  const state = getSyncState();

  if (!state.lastError?.retryable) return;
  if (state.currentAttempt >= config.maxRetries) return;

  const delay = calculateBackoffDelay(state.currentAttempt, config);


  updateSyncState({
    status: 'recovering',
    nextRetryAt: new Date(Date.now() + delay).toISOString(),
  });

  if (retryTimeout) {
    clearTimeout(retryTimeout);
  }

  retryTimeout = window.setTimeout(async () => {
    updateSyncState({ status: 'syncing' });

    try {
      await retryFn();
      recordSyncSuccess();
    } catch (e) {
      const error = classifyError(e, 'scheduled_retry');
      recordSyncFailure(error);

      // Schedule next retry if applicable
      if (shouldRetry(state.currentAttempt + 1, error, config)) {
        scheduleRetry(retryFn, config);
      }
    }
  }, delay);
}

/**
 * Cancel any pending retry
 */
export function cancelRetry(): void {
  if (retryTimeout) {
    clearTimeout(retryTimeout);
    retryTimeout = null;
  }
  updateSyncState({
    status: 'idle',
    nextRetryAt: undefined,
  });
}

// ============================================================================
// AUTO-RECOVERY ON ONLINE
// ============================================================================

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    const state = getSyncState();

    if (state.status === 'error' && state.lastError?.retryable) {
      // Reset attempt count on network recovery
      updateSyncState({ currentAttempt: 0 });
    }
  });
}
