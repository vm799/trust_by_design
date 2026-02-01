/**
 * Navigation Intent Service
 * ==========================
 *
 * Implements the UX Flow Contract (docs/ux-flow-contract.md) for intent preservation.
 *
 * Core Principle: "Intent is Sacred"
 * If a user arrives with intent (email link, notification, QR), that intent MUST
 * survive auth, reloads, offline, and app restarts.
 *
 * This service captures navigation intent BEFORE auth resolution and restores it
 * AFTER successful authentication, preventing the "email loop" problem.
 *
 * Storage: sessionStorage (survives refresh, clears on tab close)
 */

// Storage key
const INTENT_STORAGE_KEY = 'jobproof_navigation_intent';

// Intent expires after 30 minutes
const INTENT_TTL_MS = 30 * 60 * 1000;

/**
 * Navigation intent types
 */
export type NavigationIntentType = 'JOB_LINK' | 'GENERAL' | 'NOTIFICATION' | 'QR_CODE';

/**
 * Navigation intent actions
 */
export type NavigationIntentAction = 'VIEW' | 'COMPLETE' | 'UPLOAD' | 'EDIT';

/**
 * Navigation intent data structure
 */
export interface NavigationIntent {
  /** Type of intent (how user arrived) */
  type: NavigationIntentType;
  /** Target path (e.g., '/admin/jobs/123') */
  path: string;
  /** Optional action to perform */
  action?: NavigationIntentAction;
  /** Optional job ID if job-related */
  jobId?: string;
  /** Timestamp when intent was captured */
  timestamp: number;
  /** Email for re-auth context (for resend functionality) */
  email?: string;
}

/**
 * Capture navigation intent from the current URL
 *
 * Call this IMMEDIATELY on app load, BEFORE any auth checks.
 * This ensures the user's original destination is preserved.
 *
 * @example
 * // In App.tsx or entry point
 * captureNavigationIntentFromUrl();
 */
export function captureNavigationIntentFromUrl(): NavigationIntent | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const hash = window.location.hash;

  // Skip if already on auth routes (no intent to capture)
  if (!hash || hash === '#/' || hash.startsWith('#/auth') || hash.startsWith('#/landing')) {
    return null;
  }

  // Parse the path from hash (HashRouter format: #/path?params)
  const queryIndex = hash.indexOf('?');
  const path = queryIndex > 0 ? hash.substring(1, queryIndex) : hash.substring(1);
  const queryString = queryIndex > 0 ? hash.substring(queryIndex + 1) : '';
  const params = new URLSearchParams(queryString);

  // Determine intent type based on path
  let type: NavigationIntentType = 'GENERAL';
  let jobId: string | undefined;
  let action: NavigationIntentAction | undefined;

  // Job-related paths
  if (path.includes('/jobs/') || path.includes('/run/') || path.includes('/go/')) {
    type = 'JOB_LINK';

    // Extract job ID from various path patterns
    const jobMatch = path.match(/\/(?:jobs|run|go)\/([^/?]+)/);
    if (jobMatch) {
      jobId = decodeURIComponent(jobMatch[1]);
    }

    // Determine action from path or params
    if (path.includes('/edit') || params.get('edit') === 'true') {
      action = 'EDIT';
    } else if (path.includes('/complete') || params.get('complete') === 'true') {
      action = 'COMPLETE';
    } else if (path.includes('/upload') || params.get('upload') === 'true') {
      action = 'UPLOAD';
    } else {
      action = 'VIEW';
    }
  }

  // QR code links
  if (path.startsWith('/qr/') || params.get('source') === 'qr') {
    type = 'QR_CODE';
  }

  // Notification links
  if (params.get('source') === 'notification' || params.get('notif') === 'true') {
    type = 'NOTIFICATION';
  }

  const intent: NavigationIntent = {
    type,
    path,
    action,
    jobId,
    timestamp: Date.now(),
    email: params.get('email') || undefined,
  };

  // Store the intent
  captureNavigationIntent(intent);

  return intent;
}

/**
 * Manually capture a navigation intent
 *
 * Use this when you need to programmatically set an intent,
 * such as when receiving a push notification.
 */
export function captureNavigationIntent(intent: NavigationIntent): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    sessionStorage.setItem(INTENT_STORAGE_KEY, JSON.stringify(intent));
    console.log('[NavigationIntent] Captured intent:', intent.path, intent.type);
  } catch (error) {
    // sessionStorage may fail in private browsing or when storage is full
    console.warn('[NavigationIntent] Failed to store intent:', error);
  }
}

/**
 * Get the stored navigation intent
 *
 * Returns null if no intent exists or if intent has expired.
 */
export function getNavigationIntent(): NavigationIntent | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = sessionStorage.getItem(INTENT_STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const intent: NavigationIntent = JSON.parse(stored);

    // Check expiration
    if (isIntentExpired(intent)) {
      console.log('[NavigationIntent] Intent expired, clearing');
      clearNavigationIntent();
      return null;
    }

    return intent;
  } catch (error) {
    console.warn('[NavigationIntent] Failed to retrieve intent:', error);
    return null;
  }
}

/**
 * Clear the stored navigation intent
 *
 * Call this after successfully navigating to the intended destination,
 * or when the user explicitly logs out.
 */
export function clearNavigationIntent(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    sessionStorage.removeItem(INTENT_STORAGE_KEY);
    console.log('[NavigationIntent] Cleared intent');
  } catch (error) {
    console.warn('[NavigationIntent] Failed to clear intent:', error);
  }
}

/**
 * Check if there is a valid (non-expired) intent stored
 */
export function hasValidIntent(): boolean {
  return getNavigationIntent() !== null;
}

/**
 * Check if an intent has expired
 *
 * Intents expire after 30 minutes to prevent stale redirects.
 */
export function isIntentExpired(intent: NavigationIntent): boolean {
  const now = Date.now();
  return now - intent.timestamp > INTENT_TTL_MS;
}

/**
 * Get intent expiry info (for displaying countdown in UI)
 */
export function getIntentExpiryInfo(intent: NavigationIntent): {
  isExpired: boolean;
  remainingMs: number;
  remainingMinutes: number;
} {
  const now = Date.now();
  const elapsed = now - intent.timestamp;
  const remainingMs = Math.max(0, INTENT_TTL_MS - elapsed);
  const remainingMinutes = Math.ceil(remainingMs / 60000);

  return {
    isExpired: remainingMs === 0,
    remainingMs,
    remainingMinutes,
  };
}

/**
 * Create a job intent (convenience function)
 *
 * @param jobId - The job ID
 * @param action - Action to perform (default: VIEW)
 * @param email - Optional email for re-auth context
 */
export function createJobIntent(
  jobId: string,
  action: NavigationIntentAction = 'VIEW',
  email?: string
): NavigationIntent {
  // Determine path based on action
  let path: string;
  switch (action) {
    case 'EDIT':
      path = `/admin/jobs/${jobId}/edit`;
      break;
    case 'COMPLETE':
      path = `/tech/jobs/${jobId}/complete`;
      break;
    case 'UPLOAD':
      path = `/tech/jobs/${jobId}/evidence`;
      break;
    case 'VIEW':
    default:
      path = `/admin/jobs/${jobId}`;
      break;
  }

  return {
    type: 'JOB_LINK',
    path,
    action,
    jobId,
    timestamp: Date.now(),
    email,
  };
}

/**
 * Resume intent by returning the target path
 *
 * This is a convenience function that gets the intent, clears it,
 * and returns the path to navigate to.
 *
 * @returns The path to navigate to, or '/' if no intent
 */
export function resumeIntentAndGetPath(): string {
  const intent = getNavigationIntent();

  if (intent) {
    clearNavigationIntent();
    console.log('[NavigationIntent] Resuming intent:', intent.path);
    return intent.path;
  }

  return '/';
}

/**
 * Check if current path matches stored intent
 *
 * Use this to determine if we've successfully navigated to the intended destination.
 */
export function isAtIntendedDestination(): boolean {
  const intent = getNavigationIntent();
  if (!intent) {
    return true; // No intent means we're where we should be
  }

  if (typeof window === 'undefined') {
    return false;
  }

  const currentPath = window.location.hash.substring(1).split('?')[0];
  return currentPath === intent.path || currentPath.startsWith(intent.path);
}
