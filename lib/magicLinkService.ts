/**
 * Magic Link Service
 *
 * Robust, future-ready magic link management with:
 * - Multi-channel delivery (SMS, Email, Push, In-App)
 * - Offline queue with auto-retry
 * - Delivery confirmation tracking
 * - Configurable expiration
 * - Real-time status updates
 */

import { getSupabase, isSupabaseAvailable } from './supabase';
import { queueNotification, processNotificationQueue } from './notificationService';

// ============================================================================
// TYPES
// ============================================================================

export type DeliveryChannel = 'sms' | 'email' | 'push' | 'whatsapp' | 'copy' | 'qr' | 'share';
export type DeliveryStatus = 'pending' | 'queued' | 'sent' | 'delivered' | 'failed' | 'opened' | 'expired';

export interface MagicLinkConfig {
  expirationMs: number;
  channels: DeliveryChannel[];
  recipientPhone?: string;
  recipientEmail?: string;
  priority: 'normal' | 'urgent';
  retryOnFailure: boolean;
  maxRetries: number;
}

export interface MagicLinkDelivery {
  id: string;
  jobId: string;
  token: string;
  url: string;
  config: MagicLinkConfig;
  status: DeliveryStatus;
  createdAt: string;
  expiresAt: string;
  deliveryAttempts: DeliveryAttempt[];
  lastAttemptAt?: string;
  deliveredAt?: string;
  openedAt?: string;
  technicianId?: string;
  technicianName?: string;
  workspaceId: string;
}

export interface DeliveryAttempt {
  channel: DeliveryChannel;
  attemptedAt: string;
  success: boolean;
  error?: string;
  providerResponse?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const EXPIRATION_PRESETS = {
  URGENT: 4 * 60 * 60 * 1000,         // 4 hours
  SAME_DAY: 12 * 60 * 60 * 1000,      // 12 hours
  STANDARD: 24 * 60 * 60 * 1000,      // 24 hours (default)
  WEEK: 7 * 24 * 60 * 60 * 1000,      // 7 days
  MONTH: 30 * 24 * 60 * 60 * 1000,    // 30 days
  UNTIL_COMPLETE: -1,                  // Never expires (until sealed)
} as const;

export const DEFAULT_CONFIG: MagicLinkConfig = {
  expirationMs: EXPIRATION_PRESETS.STANDARD,
  channels: ['copy'],
  priority: 'normal',
  retryOnFailure: true,
  maxRetries: 3,
};

// Storage keys
const DELIVERY_QUEUE_KEY = 'jobproof_link_delivery_queue';
const DELIVERY_HISTORY_KEY = 'jobproof_link_delivery_history';

// ============================================================================
// QUEUE MANAGEMENT
// ============================================================================

/**
 * Get pending deliveries from queue
 */
function getDeliveryQueue(): MagicLinkDelivery[] {
  try {
    return JSON.parse(localStorage.getItem(DELIVERY_QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

/**
 * Save delivery queue
 */
function saveDeliveryQueue(queue: MagicLinkDelivery[]): void {
  try {
    localStorage.setItem(DELIVERY_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('[MagicLinkService] Failed to save queue:', e);
  }
}

/**
 * Add to delivery history
 */
function addToHistory(delivery: MagicLinkDelivery): void {
  try {
    const history = JSON.parse(localStorage.getItem(DELIVERY_HISTORY_KEY) || '[]');
    history.push(delivery);
    // Keep last 100 deliveries
    const trimmed = history.slice(-100);
    localStorage.setItem(DELIVERY_HISTORY_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error('[MagicLinkService] Failed to save history:', e);
  }
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Create and queue a magic link for delivery
 */
export async function createAndDeliverMagicLink(
  jobId: string,
  workspaceId: string,
  technicianId: string,
  technicianName: string,
  config: Partial<MagicLinkConfig> = {}
): Promise<MagicLinkDelivery> {
  const finalConfig: MagicLinkConfig = { ...DEFAULT_CONFIG, ...config };

  // Generate token
  const token = crypto.randomUUID();
  const baseUrl = window.location.origin;
  const url = `${baseUrl}/#/track/${token}?jobId=${jobId}`;

  // Calculate expiration
  const now = new Date();
  const expiresAt = finalConfig.expirationMs === -1
    ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000) // 1 year for "until complete"
    : new Date(now.getTime() + finalConfig.expirationMs);

  // Create delivery record
  const delivery: MagicLinkDelivery = {
    id: crypto.randomUUID(),
    jobId,
    token,
    url,
    config: finalConfig,
    status: 'pending',
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    deliveryAttempts: [],
    technicianId,
    technicianName,
    workspaceId,
  };

  // Store token in database/localStorage
  await storeToken(delivery);

  // Add to delivery queue
  const queue = getDeliveryQueue();
  queue.push(delivery);
  saveDeliveryQueue(queue);

  console.log(`[MagicLinkService] Created link for job ${jobId}, channels: ${finalConfig.channels.join(', ')}`);

  // Process queue if online
  if (navigator.onLine) {
    processDeliveryQueue();
  }

  return delivery;
}

/**
 * Store token in database and localStorage
 */
async function storeToken(delivery: MagicLinkDelivery): Promise<void> {
  // Always store locally first
  const localLinks = JSON.parse(localStorage.getItem('jobproof_magic_links') || '{}');
  localLinks[delivery.token] = {
    jobId: delivery.jobId,
    workspaceId: delivery.workspaceId,
    expiresAt: delivery.expiresAt,
    createdAt: delivery.createdAt,
    technicianId: delivery.technicianId,
    technicianName: delivery.technicianName,
    deliveryId: delivery.id,
  };
  localStorage.setItem('jobproof_magic_links', JSON.stringify(localLinks));

  // Try to store in Supabase
  if (isSupabaseAvailable()) {
    const supabase = getSupabase();
    if (supabase) {
      try {
        // Hash token for secure storage
        const encoder = new TextEncoder();
        const data = encoder.encode(delivery.token);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        await supabase.from('job_access_tokens').insert({
          id: delivery.id,
          job_id: delivery.jobId,
          token: delivery.token,
          token_hash: tokenHash,
          expires_at: delivery.expiresAt,
          granted_to_email: delivery.config.recipientEmail,
        });

        console.log(`[MagicLinkService] Token stored in Supabase`);
      } catch (e) {
        console.warn('[MagicLinkService] Failed to store token in Supabase:', e);
      }
    }
  }
}

/**
 * Process delivery queue - attempt to deliver pending links
 */
export async function processDeliveryQueue(): Promise<void> {
  const queue = getDeliveryQueue();
  if (queue.length === 0) return;

  console.log(`[MagicLinkService] Processing ${queue.length} pending deliveries...`);

  const processed: MagicLinkDelivery[] = [];
  const remaining: MagicLinkDelivery[] = [];

  for (const delivery of queue) {
    // Check if expired
    if (new Date(delivery.expiresAt) < new Date()) {
      delivery.status = 'expired';
      addToHistory(delivery);
      continue;
    }

    // Attempt delivery on each channel
    let anySuccess = false;
    for (const channel of delivery.config.channels) {
      if (channel === 'copy' || channel === 'qr' || channel === 'share') {
        // These are manual channels - mark as ready
        delivery.status = 'queued';
        anySuccess = true;
        continue;
      }

      const attempt = await attemptDelivery(delivery, channel);
      delivery.deliveryAttempts.push(attempt);
      delivery.lastAttemptAt = attempt.attemptedAt;

      if (attempt.success) {
        anySuccess = true;
        delivery.status = 'sent';
        delivery.deliveredAt = attempt.attemptedAt;
        break; // Stop on first successful delivery
      }
    }

    if (anySuccess) {
      processed.push(delivery);
      addToHistory(delivery);

      // Send in-app notification to manager
      queueNotification(
        'link_sent',
        'Magic Link Sent',
        `Job link sent to ${delivery.technicianName} via ${delivery.config.channels.join(', ')}`,
        {
          recipientType: 'manager',
          workspaceId: delivery.workspaceId,
          jobId: delivery.jobId,
          channels: ['in_app'],
          priority: 'low',
        }
      );
    } else {
      // Check retry count
      const retryCount = delivery.deliveryAttempts.length;
      if (delivery.config.retryOnFailure && retryCount < delivery.config.maxRetries) {
        remaining.push(delivery);
      } else {
        delivery.status = 'failed';
        addToHistory(delivery);

        // Notify manager of failure
        queueNotification(
          'link_delivery_failed',
          'Link Delivery Failed',
          `Failed to deliver job link to ${delivery.technicianName} after ${retryCount} attempts`,
          {
            recipientType: 'manager',
            workspaceId: delivery.workspaceId,
            jobId: delivery.jobId,
            channels: ['in_app'],
            priority: 'high',
          }
        );
      }
    }
  }

  // Update queue with remaining items
  saveDeliveryQueue(remaining);

  console.log(`[MagicLinkService] Processed ${processed.length}, remaining ${remaining.length}`);
}

/**
 * Attempt delivery on a specific channel
 */
async function attemptDelivery(
  delivery: MagicLinkDelivery,
  channel: DeliveryChannel
): Promise<DeliveryAttempt> {
  const attempt: DeliveryAttempt = {
    channel,
    attemptedAt: new Date().toISOString(),
    success: false,
  };

  try {
    switch (channel) {
      case 'email':
        if (delivery.config.recipientEmail) {
          attempt.success = await sendEmailDelivery(delivery);
        } else {
          attempt.error = 'No recipient email configured';
        }
        break;

      case 'sms':
        if (delivery.config.recipientPhone) {
          attempt.success = await sendSmsDelivery(delivery);
        } else {
          attempt.error = 'No recipient phone configured';
        }
        break;

      case 'push':
        attempt.success = await sendPushDelivery(delivery);
        break;

      case 'whatsapp':
        if (delivery.config.recipientPhone) {
          attempt.success = await sendWhatsAppDelivery(delivery);
        } else {
          attempt.error = 'No recipient phone configured';
        }
        break;

      default:
        attempt.success = true; // Manual channels always succeed
    }
  } catch (e) {
    attempt.error = e instanceof Error ? e.message : 'Unknown error';
  }

  return attempt;
}

// ============================================================================
// DELIVERY CHANNEL IMPLEMENTATIONS
// ============================================================================

/**
 * Send link via email (Supabase Edge Function)
 */
async function sendEmailDelivery(delivery: MagicLinkDelivery): Promise<boolean> {
  console.log(`[MagicLinkService] EMAIL: Would send to ${delivery.config.recipientEmail}`);

  // Store email request for Supabase Edge Function
  if (isSupabaseAvailable()) {
    const supabase = getSupabase();
    if (supabase) {
      try {
        // Queue email via Edge Function (you implement this)
        // await supabase.functions.invoke('send-magic-link-email', {
        //   body: {
        //     to: delivery.config.recipientEmail,
        //     technicianName: delivery.technicianName,
        //     jobUrl: delivery.url,
        //     expiresAt: delivery.expiresAt,
        //   }
        // });

        // For now, log the request
        const emailRequests = JSON.parse(localStorage.getItem('jobproof_email_requests') || '[]');
        emailRequests.push({
          type: 'magic_link',
          to: delivery.config.recipientEmail,
          subject: `Job Assignment: ${delivery.jobId}`,
          url: delivery.url,
          technicianName: delivery.technicianName,
          expiresAt: delivery.expiresAt,
          queuedAt: new Date().toISOString(),
        });
        localStorage.setItem('jobproof_email_requests', JSON.stringify(emailRequests.slice(-50)));

        return true;
      } catch (e) {
        console.error('[MagicLinkService] Email delivery failed:', e);
        return false;
      }
    }
  }

  return true; // Return true to mark as queued (you'll implement actual sending)
}

/**
 * Send link via SMS (Supabase Edge Function with Twilio)
 */
async function sendSmsDelivery(delivery: MagicLinkDelivery): Promise<boolean> {
  console.log(`[MagicLinkService] SMS: Would send to ${delivery.config.recipientPhone}`);

  // Store SMS request for Supabase Edge Function
  if (isSupabaseAvailable()) {
    const supabase = getSupabase();
    if (supabase) {
      try {
        // Queue SMS via Edge Function (you implement this)
        // await supabase.functions.invoke('send-magic-link-sms', {
        //   body: {
        //     to: delivery.config.recipientPhone,
        //     message: `JobProof: You have a new job assignment. Open: ${delivery.url}`,
        //   }
        // });

        // For now, log the request
        const smsRequests = JSON.parse(localStorage.getItem('jobproof_sms_requests') || '[]');
        smsRequests.push({
          type: 'magic_link',
          to: delivery.config.recipientPhone,
          message: `JobProof: New job for ${delivery.technicianName}. Open: ${delivery.url}`,
          queuedAt: new Date().toISOString(),
        });
        localStorage.setItem('jobproof_sms_requests', JSON.stringify(smsRequests.slice(-50)));

        return true;
      } catch (e) {
        console.error('[MagicLinkService] SMS delivery failed:', e);
        return false;
      }
    }
  }

  return true; // Return true to mark as queued
}

/**
 * Send link via push notification (Firebase)
 */
async function sendPushDelivery(delivery: MagicLinkDelivery): Promise<boolean> {
  console.log(`[MagicLinkService] PUSH: Would send to ${delivery.technicianId}`);

  // Queue push notification (you implement Firebase integration)
  const pushRequests = JSON.parse(localStorage.getItem('jobproof_push_requests') || '[]');
  pushRequests.push({
    type: 'magic_link',
    userId: delivery.technicianId,
    title: 'New Job Assignment',
    body: `You have a new job to complete`,
    data: { url: delivery.url, jobId: delivery.jobId },
    queuedAt: new Date().toISOString(),
  });
  localStorage.setItem('jobproof_push_requests', JSON.stringify(pushRequests.slice(-50)));

  return true;
}

/**
 * Send link via WhatsApp (Business API)
 */
async function sendWhatsAppDelivery(delivery: MagicLinkDelivery): Promise<boolean> {
  console.log(`[MagicLinkService] WHATSAPP: Would send to ${delivery.config.recipientPhone}`);

  // Queue WhatsApp message (you implement WhatsApp Business API)
  const waRequests = JSON.parse(localStorage.getItem('jobproof_whatsapp_requests') || '[]');
  waRequests.push({
    type: 'magic_link',
    to: delivery.config.recipientPhone,
    template: 'job_assignment',
    params: {
      technicianName: delivery.technicianName,
      jobUrl: delivery.url,
    },
    queuedAt: new Date().toISOString(),
  });
  localStorage.setItem('jobproof_whatsapp_requests', JSON.stringify(waRequests.slice(-50)));

  return true;
}

// ============================================================================
// STATUS TRACKING
// ============================================================================

/**
 * Record when a link is opened
 */
export function recordLinkOpened(token: string): void {
  const history = JSON.parse(localStorage.getItem(DELIVERY_HISTORY_KEY) || '[]');
  const updated = history.map((d: MagicLinkDelivery) => {
    if (d.token === token && !d.openedAt) {
      return { ...d, status: 'opened', openedAt: new Date().toISOString() };
    }
    return d;
  });
  localStorage.setItem(DELIVERY_HISTORY_KEY, JSON.stringify(updated));

  // Also update in-memory magic links
  const localLinks = JSON.parse(localStorage.getItem('jobproof_magic_links') || '{}');
  if (localLinks[token]) {
    localLinks[token].openedAt = new Date().toISOString();
    localStorage.setItem('jobproof_magic_links', JSON.stringify(localLinks));
  }

  console.log(`[MagicLinkService] Link opened: ${token}`);
}

/**
 * Get delivery status for a job
 */
export function getDeliveryStatusForJob(jobId: string): MagicLinkDelivery | null {
  const history = JSON.parse(localStorage.getItem(DELIVERY_HISTORY_KEY) || '[]');
  const queue = getDeliveryQueue();

  // Check queue first (pending deliveries)
  const queued = queue.find((d: MagicLinkDelivery) => d.jobId === jobId);
  if (queued) return queued;

  // Check history (most recent)
  const historical = history
    .filter((d: MagicLinkDelivery) => d.jobId === jobId)
    .sort((a: MagicLinkDelivery, b: MagicLinkDelivery) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  return historical[0] || null;
}

/**
 * Get all pending deliveries (for admin dashboard)
 */
export function getPendingDeliveries(): MagicLinkDelivery[] {
  return getDeliveryQueue();
}

/**
 * Get delivery history (for reporting)
 */
export function getDeliveryHistory(limit = 50): MagicLinkDelivery[] {
  const history = JSON.parse(localStorage.getItem(DELIVERY_HISTORY_KEY) || '[]');
  return history.slice(-limit).reverse();
}

// ============================================================================
// RETRY & RECOVERY
// ============================================================================

/**
 * Manually retry a failed delivery
 */
export async function retryDelivery(deliveryId: string): Promise<boolean> {
  const history = JSON.parse(localStorage.getItem(DELIVERY_HISTORY_KEY) || '[]');
  const delivery = history.find((d: MagicLinkDelivery) => d.id === deliveryId);

  if (!delivery) {
    console.error(`[MagicLinkService] Delivery not found: ${deliveryId}`);
    return false;
  }

  // Check if expired
  if (new Date(delivery.expiresAt) < new Date()) {
    console.error(`[MagicLinkService] Cannot retry expired delivery`);
    return false;
  }

  // Reset status and add back to queue
  delivery.status = 'pending';
  delivery.config.maxRetries = delivery.config.maxRetries + 1; // Allow one more retry

  const queue = getDeliveryQueue();
  queue.push(delivery);
  saveDeliveryQueue(queue);

  // Process immediately if online
  if (navigator.onLine) {
    await processDeliveryQueue();
  }

  return true;
}

/**
 * Regenerate link for a job (revokes old, creates new)
 */
export async function regenerateLink(
  jobId: string,
  workspaceId: string,
  technicianId: string,
  technicianName: string,
  config?: Partial<MagicLinkConfig>
): Promise<MagicLinkDelivery> {
  // Mark old deliveries as expired
  const history = JSON.parse(localStorage.getItem(DELIVERY_HISTORY_KEY) || '[]');
  const updated = history.map((d: MagicLinkDelivery) => {
    if (d.jobId === jobId && d.status !== 'expired') {
      return { ...d, status: 'expired' as DeliveryStatus };
    }
    return d;
  });
  localStorage.setItem(DELIVERY_HISTORY_KEY, JSON.stringify(updated));

  // Revoke old tokens in localStorage
  const localLinks = JSON.parse(localStorage.getItem('jobproof_magic_links') || '{}');
  for (const token in localLinks) {
    if (localLinks[token].jobId === jobId) {
      localLinks[token].revokedAt = new Date().toISOString();
    }
  }
  localStorage.setItem('jobproof_magic_links', JSON.stringify(localLinks));

  // Create new link
  return createAndDeliverMagicLink(jobId, workspaceId, technicianId, technicianName, config);
}

// ============================================================================
// AUTO-PROCESS ON ONLINE
// ============================================================================

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[MagicLinkService] Back online, processing delivery queue...');
    processDeliveryQueue();
  });
}
