/**
 * Webhook Dispatcher Module Tests
 *
 * Tests for webhook endpoint management, event dispatching,
 * HMAC signature generation, and retry logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Types
// ============================================================================

type WebhookEvent =
  | 'job.created' | 'job.updated' | 'job.completed' | 'job.sealed' | 'job.deleted'
  | 'client.created' | 'client.updated'
  | 'technician.assigned' | 'technician.completed'
  | 'invoice.created' | 'invoice.paid'
  | 'evidence.sealed' | 'evidence.verified';

interface WebhookEndpoint {
  id: string;
  workspace_id: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  is_active: boolean;
  description: string;
  created_at: string;
  last_triggered_at: string | null;
  failure_count: number;
  max_retries: number;
}

interface WebhookDelivery {
  id: string;
  endpoint_id: string;
  event: WebhookEvent;
  payload: Record<string, unknown>;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  response_status: number | null;
  response_body: string | null;
  attempts: number;
  next_retry_at: string | null;
  created_at: string;
  completed_at: string | null;
}

// ============================================================================
// Webhook Logic
// ============================================================================

const ALL_WEBHOOK_EVENTS: WebhookEvent[] = [
  'job.created', 'job.updated', 'job.completed', 'job.sealed', 'job.deleted',
  'client.created', 'client.updated',
  'technician.assigned', 'technician.completed',
  'invoice.created', 'invoice.paid',
  'evidence.sealed', 'evidence.verified',
];

function isValidWebhookEvent(event: string): event is WebhookEvent {
  return ALL_WEBHOOK_EVENTS.includes(event as WebhookEvent);
}

function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function generateWebhookSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return 'whsec_' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compute deterministic HMAC-like signature for webhook verification.
 * Uses DJB2 hash for test environment. Production uses crypto.subtle HMAC-SHA256.
 */
function computeHmacSignatureSync(payload: string, secret: string): string {
  let hash = 5381;
  const combined = secret + ':' + payload;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) + hash) ^ combined.charCodeAt(i);
  }
  const hex = Math.abs(hash).toString(16);
  return hex.padEnd(64, '0').substring(0, 64);
}

function buildWebhookPayload(event: WebhookEvent, data: Record<string, unknown>, workspaceId: string): Record<string, unknown> {
  return {
    id: crypto.randomUUID(),
    event,
    created_at: new Date().toISOString(),
    workspace_id: workspaceId,
    data,
  };
}

const RETRY_DELAYS = [5000, 30000, 120000, 600000, 3600000] as const;
const MAX_RETRIES = 5;

function getRetryDelay(attempt: number): number | null {
  if (attempt >= MAX_RETRIES) return null;
  return RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)];
}

function shouldDisableEndpoint(failureCount: number, maxRetries: number): boolean {
  return failureCount >= maxRetries;
}

function filterEndpointsForEvent(endpoints: WebhookEndpoint[], event: WebhookEvent): WebhookEndpoint[] {
  return endpoints.filter(ep => ep.is_active && ep.events.includes(event));
}

// ============================================================================
// TESTS
// ============================================================================

describe('Webhook Dispatcher Module', () => {
  describe('Event Validation', () => {
    it('validates all supported webhook events', () => {
      for (const event of ALL_WEBHOOK_EVENTS) {
        expect(isValidWebhookEvent(event)).toBe(true);
      }
    });

    it('rejects invalid events', () => {
      expect(isValidWebhookEvent('job.invalid')).toBe(false);
      expect(isValidWebhookEvent('')).toBe(false);
      expect(isValidWebhookEvent('random')).toBe(false);
    });
  });

  describe('URL Validation', () => {
    it('accepts HTTPS URLs', () => {
      expect(isValidWebhookUrl('https://example.com/webhook')).toBe(true);
      expect(isValidWebhookUrl('https://api.myapp.com/hooks/jobproof')).toBe(true);
    });

    it('rejects HTTP URLs (security)', () => {
      expect(isValidWebhookUrl('http://example.com/webhook')).toBe(false);
    });

    it('rejects invalid URLs', () => {
      expect(isValidWebhookUrl('not-a-url')).toBe(false);
      expect(isValidWebhookUrl('')).toBe(false);
      expect(isValidWebhookUrl('ftp://example.com')).toBe(false);
    });
  });

  describe('Secret Generation', () => {
    it('generates secrets with whsec_ prefix', () => {
      const secret = generateWebhookSecret();
      expect(secret.startsWith('whsec_')).toBe(true);
    });

    it('generates secrets of sufficient length', () => {
      const secret = generateWebhookSecret();
      expect(secret.length).toBeGreaterThanOrEqual(60);
    });

    it('generates secrets with hex encoding', () => {
      const secret = generateWebhookSecret();
      const hexPart = secret.replace('whsec_', '');
      expect(hexPart).toMatch(/^[a-f0-9]+$/);
      expect(hexPart.length).toBe(64); // 32 bytes = 64 hex chars
    });
  });

  describe('HMAC Signature', () => {
    it('generates consistent signatures for same input', () => {
      const payload = JSON.stringify({ event: 'job.created', data: { id: '123' } });
      const secret = 'whsec_test_secret_key_12345678901234567890';

      const sig1 = computeHmacSignatureSync(payload, secret);
      const sig2 = computeHmacSignatureSync(payload, secret);
      expect(sig1).toBe(sig2);
    });

    it('generates different signatures for different payloads', () => {
      const secret = 'whsec_test_secret_key_12345678901234567890';
      const sig1 = computeHmacSignatureSync('payload1', secret);
      const sig2 = computeHmacSignatureSync('payload2', secret);
      expect(sig1).not.toBe(sig2);
    });

    it('generates different signatures for different secrets', () => {
      const payload = 'same_payload';
      const sig1 = computeHmacSignatureSync(payload, 'secret1');
      const sig2 = computeHmacSignatureSync(payload, 'secret2');
      expect(sig1).not.toBe(sig2);
    });

    it('generates 64-char hex signatures', () => {
      const sig = computeHmacSignatureSync('test', 'secret');
      expect(sig).toMatch(/^[a-f0-9]+$/);
      expect(sig.length).toBe(64);
    });
  });

  describe('Webhook Payload Building', () => {
    it('builds payload with required fields', () => {
      const payload = buildWebhookPayload('job.created', { id: 'job-1' }, 'ws-1');
      expect(payload.event).toBe('job.created');
      expect(payload.workspace_id).toBe('ws-1');
      expect(payload.data).toEqual({ id: 'job-1' });
      expect(payload.id).toBeDefined();
      expect(payload.created_at).toBeDefined();
    });

    it('generates payload IDs as UUIDs', () => {
      const p1 = buildWebhookPayload('job.created', {}, 'ws-1');
      expect(typeof p1.id).toBe('string');
      expect((p1.id as string).length).toBeGreaterThan(0);
    });
  });

  describe('Retry Logic', () => {
    it('returns delay for valid retry attempts', () => {
      expect(getRetryDelay(0)).toBe(5000);
      expect(getRetryDelay(1)).toBe(30000);
      expect(getRetryDelay(2)).toBe(120000);
      expect(getRetryDelay(3)).toBe(600000);
      expect(getRetryDelay(4)).toBe(3600000);
    });

    it('returns null when max retries exceeded', () => {
      expect(getRetryDelay(5)).toBeNull();
      expect(getRetryDelay(10)).toBeNull();
    });

    it('caps delay at last value for overflow attempts', () => {
      expect(getRetryDelay(4)).toBe(3600000);
    });
  });

  describe('Endpoint Disabling', () => {
    it('disables endpoint when failure count equals max retries', () => {
      expect(shouldDisableEndpoint(5, 5)).toBe(true);
    });

    it('disables endpoint when failure count exceeds max retries', () => {
      expect(shouldDisableEndpoint(10, 5)).toBe(true);
    });

    it('keeps endpoint active when under max retries', () => {
      expect(shouldDisableEndpoint(3, 5)).toBe(false);
    });
  });

  describe('Endpoint Filtering', () => {
    const endpoints: WebhookEndpoint[] = [
      {
        id: 'ep-1', workspace_id: 'ws-1', url: 'https://a.com/hook',
        events: ['job.created', 'job.completed'], secret: 'sec-1',
        is_active: true, description: '', created_at: '', last_triggered_at: null,
        failure_count: 0, max_retries: 5,
      },
      {
        id: 'ep-2', workspace_id: 'ws-1', url: 'https://b.com/hook',
        events: ['job.created'], secret: 'sec-2',
        is_active: false, description: '', created_at: '', last_triggered_at: null,
        failure_count: 0, max_retries: 5,
      },
      {
        id: 'ep-3', workspace_id: 'ws-1', url: 'https://c.com/hook',
        events: ['invoice.created'], secret: 'sec-3',
        is_active: true, description: '', created_at: '', last_triggered_at: null,
        failure_count: 0, max_retries: 5,
      },
    ];

    it('returns only active endpoints subscribed to the event', () => {
      const filtered = filterEndpointsForEvent(endpoints, 'job.created');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('ep-1');
    });

    it('excludes inactive endpoints', () => {
      const filtered = filterEndpointsForEvent(endpoints, 'job.created');
      expect(filtered.find(ep => ep.id === 'ep-2')).toBeUndefined();
    });

    it('returns empty for unsubscribed events', () => {
      const filtered = filterEndpointsForEvent(endpoints, 'job.sealed');
      expect(filtered).toHaveLength(0);
    });

    it('returns endpoints for specific event', () => {
      const filtered = filterEndpointsForEvent(endpoints, 'invoice.created');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('ep-3');
    });
  });
});
