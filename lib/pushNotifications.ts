/**
 * Push Notification Service
 *
 * Web Push notification management for real-time alerts.
 * Integrates with the existing service worker (public/sw.js).
 *
 * Supports:
 * - Subscription management (register/unregister)
 * - Event-specific payload building with actions
 * - Permission status tracking
 * - Offline queuing (falls back to in-app notifications)
 *
 * Events: job_assigned, job_completed, job_sealed, evidence_submitted,
 *         sync_complete, sync_failed, team_invite, payment_failed
 */

import { getSupabase, isSupabaseAvailable } from './supabase';

// ============================================================================
// TYPES
// ============================================================================

export type PushEventType =
  | 'job_assigned'
  | 'job_completed'
  | 'job_sealed'
  | 'evidence_submitted'
  | 'sync_complete'
  | 'sync_failed'
  | 'team_invite'
  | 'payment_failed';

export interface PushSubscriptionRecord {
  id: string;
  user_id: string;
  workspace_id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  user_agent: string | null;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon: string;
  badge: string;
  tag: string;
  data: {
    event: PushEventType;
    url: string;
    jobId?: string;
    workspaceId: string;
    timestamp: string;
  };
  actions?: Array<{
    action: string;
    title: string;
  }>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const ALL_PUSH_EVENTS: PushEventType[] = [
  'job_assigned', 'job_completed', 'job_sealed',
  'evidence_submitted', 'sync_complete', 'sync_failed',
  'team_invite', 'payment_failed',
];

const EVENT_TITLES: Record<PushEventType, string> = {
  job_assigned: 'New Job Assigned',
  job_completed: 'Job Completed',
  job_sealed: 'Evidence Sealed',
  evidence_submitted: 'Evidence Submitted',
  sync_complete: 'Sync Complete',
  sync_failed: 'Sync Failed',
  team_invite: 'Team Invitation',
  payment_failed: 'Payment Failed',
};

// ============================================================================
// VALIDATION
// ============================================================================

export function isValidPushEvent(event: string): event is PushEventType {
  return ALL_PUSH_EVENTS.includes(event as PushEventType);
}

export function getEventTitle(event: PushEventType): string {
  return EVENT_TITLES[event];
}

// ============================================================================
// BROWSER SUPPORT
// ============================================================================

export function isPushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export function getPermissionStatus(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as 'granted' | 'denied' | 'default';
}

export function canRequestPermission(): boolean {
  return getPermissionStatus() === 'default';
}

export function shouldShowPermissionPrompt(
  status: 'granted' | 'denied' | 'default' | 'unsupported',
  dismissedAt: string | null
): boolean {
  if (status !== 'default') return false;
  if (!dismissedAt) return true;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return new Date(dismissedAt) < sevenDaysAgo;
}

// ============================================================================
// PAYLOAD BUILDING
// ============================================================================

export function buildPushPayload(
  event: PushEventType,
  title: string,
  body: string,
  workspaceId: string,
  options?: { jobId?: string; url?: string }
): PushNotificationPayload {
  const baseUrl = '/#';
  const defaultUrl = options?.url || `${baseUrl}/home`;

  const payload: PushNotificationPayload = {
    title,
    body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-96x96.png',
    tag: `${event}-${Date.now()}`,
    data: {
      event,
      url: defaultUrl,
      workspaceId,
      timestamp: new Date().toISOString(),
    },
  };

  if (options?.jobId) {
    payload.data.jobId = options.jobId;
    payload.data.url = `${baseUrl}/jobs/${options.jobId}`;
  }

  switch (event) {
    case 'job_assigned':
      payload.actions = [
        { action: 'view', title: 'View Job' },
        { action: 'accept', title: 'Accept' },
      ];
      break;
    case 'evidence_submitted':
      payload.actions = [
        { action: 'review', title: 'Review Evidence' },
      ];
      break;
    case 'sync_failed':
      payload.actions = [
        { action: 'retry', title: 'Retry Sync' },
      ];
      break;
  }

  return payload;
}

// ============================================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================================

export async function requestPermission(): Promise<'granted' | 'denied' | 'default'> {
  if (!isPushSupported()) return 'denied';
  const result = await Notification.requestPermission();
  return result;
}

export async function subscribeToPush(
  userId: string,
  workspaceId: string,
  vapidPublicKey: string
): Promise<PushSubscriptionRecord | null> {
  if (!isPushSupported()) return null;

  const permission = await requestPermission();
  if (permission !== 'granted') return null;

  const registration = await navigator.serviceWorker.ready;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys) return null;

  // Save to database
  if (isSupabaseAvailable()) {
    const supabase = getSupabase()!;
    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        workspace_id: workspaceId,
        endpoint: json.endpoint,
        p256dh_key: json.keys.p256dh,
        auth_key: json.keys.auth,
        is_active: true,
        user_agent: navigator.userAgent,
      }, { onConflict: 'user_id,endpoint' })
      .select()
      .single();

    if (error) {
      console.error('Failed to save push subscription:', error);
      return null;
    }

    return data as PushSubscriptionRecord;
  }

  return null;
}

export async function unsubscribeFromPush(userId: string): Promise<void> {
  if (!isPushSupported()) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    await subscription.unsubscribe();
  }

  if (isSupabaseAvailable()) {
    const supabase = getSupabase()!;
    await supabase
      .from('push_subscriptions')
      .update({ is_active: false })
      .eq('user_id', userId);
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Record that the user dismissed the push notification prompt
 */
export function dismissPushPrompt(): void {
  try {
    localStorage.setItem('jobproof_push_dismissed_at', new Date().toISOString());
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Get the timestamp when the user last dismissed the push prompt
 */
export function getPushDismissedAt(): string | null {
  try {
    return localStorage.getItem('jobproof_push_dismissed_at');
  } catch {
    return null;
  }
}
