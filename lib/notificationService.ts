/**
 * Notification Service
 *
 * Unified notification system for JobProof with:
 * - In-app notifications
 * - Email delivery hooks
 * - SMS delivery hooks (future)
 * - Push notification hooks (future)
 * - Offline queuing
 * - Delivery tracking
 */

import { getSupabase, isSupabaseAvailable } from './supabase';

// Notification Types
export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'push';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'read';

export interface NotificationPayload {
  id: string;
  type: string;
  title: string;
  message: string;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  recipientType: 'manager' | 'technician' | 'client' | 'admin';
  recipientId?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  workspaceId: string;
  jobId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  status: NotificationStatus;
  deliveredAt?: string;
  readAt?: string;
  retryCount: number;
  lastAttempt?: string;
  error?: string;
}

// Notification Queue (localStorage-backed for offline support)
const QUEUE_KEY = 'jobproof_notification_queue';
const SENT_KEY = 'jobproof_notifications_sent';

/**
 * Get notification queue from localStorage
 */
function getQueue(): NotificationPayload[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

/**
 * Save notification queue to localStorage
 */
function saveQueue(queue: NotificationPayload[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('[NotificationService] Failed to save queue:', e);
  }
}

/**
 * Queue a notification for delivery
 */
export function queueNotification(
  type: string,
  title: string,
  message: string,
  options: {
    channels?: NotificationChannel[];
    priority?: NotificationPriority;
    recipientType: 'manager' | 'technician' | 'client' | 'admin';
    recipientId?: string;
    recipientEmail?: string;
    recipientPhone?: string;
    workspaceId: string;
    jobId?: string;
    metadata?: Record<string, any>;
  }
): NotificationPayload {
  const notification: NotificationPayload = {
    id: crypto.randomUUID(),
    type,
    title,
    message,
    channels: options.channels || ['in_app'],
    priority: options.priority || 'normal',
    recipientType: options.recipientType,
    recipientId: options.recipientId,
    recipientEmail: options.recipientEmail,
    recipientPhone: options.recipientPhone,
    workspaceId: options.workspaceId,
    jobId: options.jobId,
    metadata: options.metadata,
    createdAt: new Date().toISOString(),
    status: 'pending',
    retryCount: 0
  };

  const queue = getQueue();
  queue.push(notification);
  saveQueue(queue);

  console.log(`[NotificationService] Queued: ${type} - ${title}`);

  // Try to send immediately if online
  if (navigator.onLine) {
    processNotificationQueue();
  }

  return notification;
}

/**
 * Process notification queue
 */
export async function processNotificationQueue(): Promise<void> {
  const queue = getQueue();
  if (queue.length === 0) return;

  console.log(`[NotificationService] Processing ${queue.length} queued notifications...`);

  const processed: NotificationPayload[] = [];
  const failed: NotificationPayload[] = [];

  for (const notification of queue) {
    try {
      // In-app notification is always instant
      if (notification.channels.includes('in_app')) {
        await sendInAppNotification(notification);
      }

      // Email delivery (if configured)
      if (notification.channels.includes('email') && notification.recipientEmail) {
        await sendEmailNotification(notification);
      }

      // SMS delivery (future - placeholder)
      if (notification.channels.includes('sms') && notification.recipientPhone) {
        await sendSmsNotification(notification);
      }

      // Push notification (future - placeholder)
      if (notification.channels.includes('push')) {
        await sendPushNotification(notification);
      }

      notification.status = 'sent';
      notification.deliveredAt = new Date().toISOString();
      processed.push(notification);
    } catch (error) {
      notification.retryCount++;
      notification.lastAttempt = new Date().toISOString();
      notification.error = error instanceof Error ? error.message : 'Unknown error';

      if (notification.retryCount < 5) {
        failed.push(notification);
      } else {
        notification.status = 'failed';
        processed.push(notification);
        console.error(`[NotificationService] Notification failed after 5 retries:`, notification.id);
      }
    }
  }

  // Update queue with failed items only
  saveQueue(failed);

  // Store processed notifications
  try {
    const sent = JSON.parse(localStorage.getItem(SENT_KEY) || '[]');
    sent.push(...processed);
    // Keep only last 100 sent notifications
    const trimmed = sent.slice(-100);
    localStorage.setItem(SENT_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error('[NotificationService] Failed to save sent notifications:', e);
  }

  console.log(`[NotificationService] Processed ${processed.length}, failed ${failed.length}`);
}

/**
 * Send in-app notification
 */
async function sendInAppNotification(notification: NotificationPayload): Promise<void> {
  // Store in localStorage for in-app display
  try {
    const inAppKey = `jobproof_inapp_${notification.workspaceId}`;
    const inApp = JSON.parse(localStorage.getItem(inAppKey) || '[]');
    inApp.push({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      jobId: notification.jobId,
      createdAt: notification.createdAt,
      isRead: false
    });
    // Keep only last 50 in-app notifications
    const trimmed = inApp.slice(-50);
    localStorage.setItem(inAppKey, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('[NotificationService] Failed to store in-app notification:', e);
  }

  // If Supabase is available, also store in database
  if (isSupabaseAvailable()) {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('notifications').insert({
          id: notification.id,
          workspace_id: notification.workspaceId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          job_id: notification.jobId,
          recipient_type: notification.recipientType,
          recipient_id: notification.recipientId,
          channels: notification.channels,
          status: 'sent',
          created_at: notification.createdAt
        });
      } catch (e) {
        console.warn('[NotificationService] Failed to store notification in Supabase:', e);
      }
    }
  }

  console.log(`[NotificationService] In-app notification sent: ${notification.title}`);
}

/**
 * Send email notification
 *
 * NOTE: This is a placeholder that logs the intent.
 * In production, this would call a Supabase Edge Function or email service like:
 * - Resend (recommended)
 * - SendGrid
 * - AWS SES
 */
async function sendEmailNotification(notification: NotificationPayload): Promise<void> {
  console.log(`[NotificationService] EMAIL HOOK: Would send email to ${notification.recipientEmail}`);
  console.log(`  Subject: ${notification.title}`);
  console.log(`  Body: ${notification.message}`);

  // In production, call Supabase Edge Function:
  // const supabase = getSupabase();
  // if (supabase) {
  //   await supabase.functions.invoke('send-email', {
  //     body: {
  //       to: notification.recipientEmail,
  //       subject: notification.title,
  //       html: generateEmailHtml(notification)
  //     }
  //   });
  // }

  // For now, store email request for manual review
  try {
    const emailQueue = JSON.parse(localStorage.getItem('jobproof_email_requests') || '[]');
    emailQueue.push({
      id: notification.id,
      to: notification.recipientEmail,
      subject: notification.title,
      body: notification.message,
      jobId: notification.jobId,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem('jobproof_email_requests', JSON.stringify(emailQueue.slice(-50)));
  } catch (e) {
    console.warn('[NotificationService] Failed to queue email request:', e);
  }
}

/**
 * Send SMS notification
 *
 * NOTE: Placeholder for SMS delivery via Twilio or similar
 */
async function sendSmsNotification(notification: NotificationPayload): Promise<void> {
  console.log(`[NotificationService] SMS HOOK: Would send SMS to ${notification.recipientPhone}`);
  console.log(`  Message: ${notification.message}`);

  // In production, call Supabase Edge Function:
  // await supabase.functions.invoke('send-sms', {
  //   body: { to: notification.recipientPhone, message: notification.message }
  // });
}

/**
 * Send push notification
 *
 * NOTE: Placeholder for web push notifications
 */
async function sendPushNotification(notification: NotificationPayload): Promise<void> {
  console.log(`[NotificationService] PUSH HOOK: Would send push notification`);
  console.log(`  Title: ${notification.title}`);
  console.log(`  Body: ${notification.message}`);

  // In production, use Web Push API or Firebase Cloud Messaging
}

/**
 * Get in-app notifications for a workspace
 */
export function getInAppNotifications(workspaceId: string): Array<{
  id: string;
  type: string;
  title: string;
  message: string;
  jobId?: string;
  createdAt: string;
  isRead: boolean;
}> {
  try {
    const inAppKey = `jobproof_inapp_${workspaceId}`;
    return JSON.parse(localStorage.getItem(inAppKey) || '[]');
  } catch {
    return [];
  }
}

/**
 * Mark notification as read
 */
export function markNotificationRead(workspaceId: string, notificationId: string): void {
  try {
    const inAppKey = `jobproof_inapp_${workspaceId}`;
    const notifications = JSON.parse(localStorage.getItem(inAppKey) || '[]');
    const updated = notifications.map((n: any) =>
      n.id === notificationId ? { ...n, isRead: true } : n
    );
    localStorage.setItem(inAppKey, JSON.stringify(updated));
  } catch (e) {
    console.warn('[NotificationService] Failed to mark notification read:', e);
  }
}

/**
 * Clear all notifications for a workspace
 */
export function clearNotifications(workspaceId: string): void {
  try {
    const inAppKey = `jobproof_inapp_${workspaceId}`;
    localStorage.removeItem(inAppKey);
  } catch (e) {
    console.warn('[NotificationService] Failed to clear notifications:', e);
  }
}

// ============================================================================
// CONVENIENCE METHODS FOR COMMON NOTIFICATION TYPES
// ============================================================================

/**
 * Notify manager when a job is sealed
 */
export function notifyJobSealed(
  workspaceId: string,
  jobId: string,
  jobTitle: string,
  technicianName: string,
  clientName: string,
  managerEmail?: string
): NotificationPayload {
  return queueNotification(
    'job_sealed',
    `Job Sealed: ${jobTitle}`,
    `${technicianName} has completed and sealed job "${jobTitle}" for ${clientName}. Evidence has been cryptographically secured.`,
    {
      channels: managerEmail ? ['in_app', 'email'] : ['in_app'],
      priority: 'high',
      recipientType: 'manager',
      recipientEmail: managerEmail,
      workspaceId,
      jobId,
      metadata: { technicianName, clientName }
    }
  );
}

/**
 * Notify when photos are synced
 */
export function notifyPhotosSynced(
  workspaceId: string,
  jobId: string,
  photoCount: number
): NotificationPayload {
  return queueNotification(
    'photos_synced',
    `Photos Uploaded`,
    `${photoCount} photo(s) have been synced to the cloud for job ${jobId}.`,
    {
      channels: ['in_app'],
      priority: 'low',
      recipientType: 'technician',
      workspaceId,
      jobId,
      metadata: { photoCount }
    }
  );
}

/**
 * Notify when magic link is opened
 */
export function notifyLinkOpened(
  workspaceId: string,
  jobId: string,
  jobTitle: string,
  technicianName: string
): NotificationPayload {
  return queueNotification(
    'link_opened',
    `Job Link Opened`,
    `${technicianName} has opened the job link for "${jobTitle}".`,
    {
      channels: ['in_app'],
      priority: 'normal',
      recipientType: 'manager',
      workspaceId,
      jobId,
      metadata: { technicianName }
    }
  );
}

/**
 * Notify about sync failures
 */
export function notifySyncFailed(
  workspaceId: string,
  jobId: string,
  errorMessage: string
): NotificationPayload {
  return queueNotification(
    'sync_failed',
    `Sync Failed`,
    `Failed to sync job data: ${errorMessage}. Data is saved locally and will retry automatically.`,
    {
      channels: ['in_app'],
      priority: 'high',
      recipientType: 'technician',
      workspaceId,
      jobId,
      metadata: { errorMessage }
    }
  );
}

// Start processing queue when online status changes
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[NotificationService] Back online, processing queue...');
    processNotificationQueue();
  });
}
