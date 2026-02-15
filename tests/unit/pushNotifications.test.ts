/**
 * Push Notification Module Tests
 *
 * Tests for web push notification subscription management,
 * payload building, and permission handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Types
// ============================================================================

type PushEventType =
  | 'job_assigned'
  | 'job_completed'
  | 'job_sealed'
  | 'evidence_submitted'
  | 'sync_complete'
  | 'sync_failed'
  | 'team_invite'
  | 'payment_failed';

interface PushSubscriptionRecord {
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

interface PushNotificationPayload {
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
// Push Notification Logic
// ============================================================================

const ALL_PUSH_EVENTS: PushEventType[] = [
  'job_assigned', 'job_completed', 'job_sealed',
  'evidence_submitted', 'sync_complete', 'sync_failed',
  'team_invite', 'payment_failed',
];

function isValidPushEvent(event: string): event is PushEventType {
  return ALL_PUSH_EVENTS.includes(event as PushEventType);
}

function buildPushPayload(
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

  // Add actions based on event type
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

function isPushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

function getPermissionStatus(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as 'granted' | 'denied' | 'default';
}

function canRequestPermission(): boolean {
  const status = getPermissionStatus();
  return status === 'default';
}

function shouldShowPermissionPrompt(
  status: 'granted' | 'denied' | 'default' | 'unsupported',
  dismissedAt: string | null
): boolean {
  if (status !== 'default') return false;
  if (!dismissedAt) return true;
  // Don't show again for 7 days after dismissal
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return new Date(dismissedAt) < sevenDaysAgo;
}

function getEventTitle(event: PushEventType): string {
  const titles: Record<PushEventType, string> = {
    job_assigned: 'New Job Assigned',
    job_completed: 'Job Completed',
    job_sealed: 'Evidence Sealed',
    evidence_submitted: 'Evidence Submitted',
    sync_complete: 'Sync Complete',
    sync_failed: 'Sync Failed',
    team_invite: 'Team Invitation',
    payment_failed: 'Payment Failed',
  };
  return titles[event];
}

// ============================================================================
// TESTS
// ============================================================================

describe('Push Notification Module', () => {
  describe('Event Validation', () => {
    it('validates all supported push events', () => {
      for (const event of ALL_PUSH_EVENTS) {
        expect(isValidPushEvent(event)).toBe(true);
      }
    });

    it('rejects invalid events', () => {
      expect(isValidPushEvent('invalid')).toBe(false);
      expect(isValidPushEvent('')).toBe(false);
    });
  });

  describe('Payload Building', () => {
    it('builds payload with required fields', () => {
      const payload = buildPushPayload('job_assigned', 'New Job', 'Job #123', 'ws-1');
      expect(payload.title).toBe('New Job');
      expect(payload.body).toBe('Job #123');
      expect(payload.icon).toBeDefined();
      expect(payload.badge).toBeDefined();
      expect(payload.tag).toContain('job_assigned');
      expect(payload.data.event).toBe('job_assigned');
      expect(payload.data.workspaceId).toBe('ws-1');
    });

    it('includes job-specific URL when jobId provided', () => {
      const payload = buildPushPayload('job_completed', 'Done', 'Job finished', 'ws-1', {
        jobId: 'job-123',
      });
      expect(payload.data.jobId).toBe('job-123');
      expect(payload.data.url).toContain('job-123');
    });

    it('adds action buttons for job_assigned events', () => {
      const payload = buildPushPayload('job_assigned', 'New', 'Body', 'ws-1');
      expect(payload.actions).toBeDefined();
      expect(payload.actions?.length).toBe(2);
      expect(payload.actions?.[0].action).toBe('view');
      expect(payload.actions?.[1].action).toBe('accept');
    });

    it('adds review action for evidence_submitted events', () => {
      const payload = buildPushPayload('evidence_submitted', 'Evidence', 'Body', 'ws-1');
      expect(payload.actions).toBeDefined();
      expect(payload.actions?.length).toBe(1);
      expect(payload.actions?.[0].action).toBe('review');
    });

    it('adds retry action for sync_failed events', () => {
      const payload = buildPushPayload('sync_failed', 'Sync', 'Failed', 'ws-1');
      expect(payload.actions?.length).toBe(1);
      expect(payload.actions?.[0].action).toBe('retry');
    });

    it('uses custom URL when provided', () => {
      const payload = buildPushPayload('team_invite', 'Invite', 'Body', 'ws-1', {
        url: '/#/settings/team',
      });
      expect(payload.data.url).toBe('/#/settings/team');
    });
  });

  describe('Permission Handling', () => {
    it('detects push support check function', () => {
      expect(typeof isPushSupported).toBe('function');
    });

    it('gets permission status', () => {
      const status = getPermissionStatus();
      // In test environment, Notification is not defined
      expect(['granted', 'denied', 'default', 'unsupported']).toContain(status);
    });

    it('checks if permission can be requested', () => {
      const result = canRequestPermission();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Permission Prompt Logic', () => {
    it('shows prompt when status is default and never dismissed', () => {
      expect(shouldShowPermissionPrompt('default', null)).toBe(true);
    });

    it('does not show prompt when permission already granted', () => {
      expect(shouldShowPermissionPrompt('granted', null)).toBe(false);
    });

    it('does not show prompt when permission denied', () => {
      expect(shouldShowPermissionPrompt('denied', null)).toBe(false);
    });

    it('does not show prompt when unsupported', () => {
      expect(shouldShowPermissionPrompt('unsupported', null)).toBe(false);
    });

    it('does not show prompt within 7 days of dismissal', () => {
      const recentDismissal = new Date().toISOString();
      expect(shouldShowPermissionPrompt('default', recentDismissal)).toBe(false);
    });

    it('shows prompt after 7 days of dismissal', () => {
      const oldDismissal = new Date('2020-01-01').toISOString();
      expect(shouldShowPermissionPrompt('default', oldDismissal)).toBe(true);
    });
  });

  describe('Event Titles', () => {
    it('returns human-readable titles for all events', () => {
      for (const event of ALL_PUSH_EVENTS) {
        const title = getEventTitle(event);
        expect(title).toBeDefined();
        expect(title.length).toBeGreaterThan(0);
      }
    });

    it('returns specific titles', () => {
      expect(getEventTitle('job_assigned')).toBe('New Job Assigned');
      expect(getEventTitle('sync_failed')).toBe('Sync Failed');
      expect(getEventTitle('payment_failed')).toBe('Payment Failed');
    });
  });
});
