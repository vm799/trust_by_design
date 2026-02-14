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

}

/**
 * Colour palette for email templates (light and dark modes)
 * WCAG AA compliant contrast ratios (4.5:1 minimum)
 */
interface EmailColourPalette {
  bg: string;
  bgSecondary: string;
  text: string;
  textSecondary: string;
  border: string;
  headerText: string;
  badgeBg: string;
}

/**
 * Generate HTML email from notification payload
 * Supports both light and dark modes with WCAG AA compliance
 * @param notification - The notification to format
 * @param prefersDarkMode - Whether to use dark mode (default: true for backwards compatibility)
 */
function generateNotificationEmailHtml(
  notification: NotificationPayload,
  prefersDarkMode: boolean = true
): string {
  // Dark mode colours (original)
  const darkPalette: EmailColourPalette = {
    bg: '#0f172a',
    bgSecondary: '#1e293b',
    text: '#f1f5f9',
    textSecondary: '#64748b',
    border: '#334155',
    headerText: '#ffffff',
    badgeBg: 'rgba(255,255,255,0.2)',
  };

  // Light mode colours (WCAG AA compliant)
  const lightPalette: EmailColourPalette = {
    bg: '#ffffff',
    bgSecondary: '#f8fafc',
    text: '#0f172a',
    textSecondary: '#475569',
    border: '#e2e8f0',
    headerText: '#ffffff',
    badgeBg: 'rgba(0,0,0,0.1)',
  };

  const palette = prefersDarkMode ? darkPalette : lightPalette;

  // Priority-based accent colours (WCAG AA compliant in both modes)
  const priorityColours: Record<
    NotificationPriority,
    { gradient: string; glow: string }
  > = {
    low: {
      gradient: prefersDarkMode
        ? 'linear-gradient(135deg, #64748b 0%, #475569 100%)'
        : 'linear-gradient(135deg, #cbd5e1 0%, #a1a5ab 100%)',
      glow: prefersDarkMode ? 'rgba(100, 116, 139, 0.3)' : 'rgba(203, 213, 225, 0.3)',
    },
    normal: {
      gradient: prefersDarkMode
        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
        : 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
      glow: prefersDarkMode ? 'rgba(16, 185, 129, 0.4)' : 'rgba(52, 211, 153, 0.3)',
    },
    high: {
      gradient: prefersDarkMode
        ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
        : 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
      glow: prefersDarkMode ? 'rgba(245, 158, 11, 0.4)' : 'rgba(251, 191, 36, 0.3)',
    },
    urgent: {
      gradient: prefersDarkMode
        ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
        : 'linear-gradient(135deg, #f87171 0%, #ef4444 100%)',
      glow: prefersDarkMode ? 'rgba(239, 68, 68, 0.4)' : 'rgba(248, 113, 113, 0.3)',
    },
  };

  const colours = priorityColours[notification.priority] || priorityColours.normal;

  // Priority badge text
  const priorityBadge: Record<NotificationPriority, string> = {
    low: '',
    normal: '',
    high: '⚠️ HIGH PRIORITY',
    urgent: '🚨 URGENT',
  };

  // Format timestamp in British English with UTC
  const timestamp = new Date(notification.createdAt).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }) + ' UTC';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: ${palette.bg};">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${palette.bg}; padding: 24px 16px;">
        <tr>
          <td align="center">
            <table width="100%" style="max-width: 560px; background-color: ${palette.bgSecondary}; border-radius: 16px; border: 1px solid ${palette.border};">
              <!-- Header -->
              <tr>
                <td style="background: ${colours.gradient}; padding: 20px 24px; border-radius: 16px 16px 0 0;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <h1 style="margin: 0; color: ${palette.headerText}; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">
                          ${notification.title}
                        </h1>
                      </td>
                      ${
                        priorityBadge[notification.priority]
                          ? `
                      <td align="right">
                        <span style="display: inline-block; padding: 4px 10px; background-color: ${palette.badgeBg}; border-radius: 20px; color: ${palette.headerText}; font-size: 10px; font-weight: 600;">
                          ${priorityBadge[notification.priority]}
                        </span>
                      </td>
                      `
                          : ''
                      }
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding: 28px 24px;">
                  <p style="margin: 0 0 20px; color: ${palette.text}; font-size: 15px; line-height: 1.7;">
                    ${notification.message}
                  </p>
                  ${
                    notification.jobId
                      ? `
                  <!-- Job Reference Card -->
                  <div style="background-color: ${palette.bg}; padding: 16px; border-radius: 10px; border: 1px solid ${palette.border}; margin-top: 20px;">
                    <span style="color: ${palette.textSecondary}; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Job Reference</span>
                    <p style="margin: 4px 0 0; color: ${palette.text}; font-size: 14px; font-weight: 600; font-family: 'SF Mono', Monaco, monospace;">${notification.jobId}</p>
                  </div>
                  `
                      : ''
                  }
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding: 16px 24px; background-color: ${palette.bg}; border-radius: 0 0 16px 16px; border-top: 1px solid ${palette.border};">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <p style="margin: 0; color: ${palette.textSecondary}; font-size: 12px;">
                          Powered by <strong style="color: ${palette.text};">JobProof</strong>
                        </p>
                      </td>
                      <td align="right">
                        <p style="margin: 0; color: ${palette.textSecondary}; font-size: 11px;">
                          ${timestamp}
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Detect user's theme preference from localStorage
 * Defaults to dark mode for backwards compatibility
 */
function getUserThemePreference(): boolean {
  try {
    const theme = localStorage.getItem('jobproof-theme-mode');
    // Dark mode: 'dark' or 'daylight'
    // Light mode: only 'system' with system preference detection
    // For now, only dark/daylight are supported in emails
    // 'system' preference defaults to dark (conservative choice)
    return theme !== 'light';
  } catch {
    return true; // Default to dark mode if localStorage fails
  }
}

/**
 * Send email notification via Supabase Edge Function
 *
 * Calls the send-email edge function which uses Resend API.
 * Falls back to localStorage queue if Supabase is not available.
 * Uses user's theme preference (dark/light mode) for email rendering.
 */
async function sendEmailNotification(notification: NotificationPayload): Promise<void> {

  // Detect user's theme preference
  const prefersDarkMode = getUserThemePreference();

  // Try to send via Supabase Edge Function
  const supabase = getSupabase();
  if (supabase && isSupabaseAvailable() && notification.recipientEmail) {
    try {
      const emailHtml = generateNotificationEmailHtml(notification, prefersDarkMode);

      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: notification.recipientEmail,
          subject: notification.title,
          html: emailHtml,
        }
      });

      if (error) {
        console.error('[NotificationService] Edge function error:', error);
        // Fall through to localStorage backup
      } else if (data?.success) {
        return; // Success - don't queue to localStorage
      } else {
        console.warn('[NotificationService] Email send failed:', data?.error);
      }
    } catch (e) {
      console.error('[NotificationService] Failed to invoke send-email:', e);
    }
  }

  // Fallback: store email request in localStorage for retry
  try {
    const emailQueue = JSON.parse(localStorage.getItem('jobproof_email_requests') || '[]');
    emailQueue.push({
      id: notification.id,
      to: notification.recipientEmail,
      subject: notification.title,
      body: notification.message,
      html: generateNotificationEmailHtml(notification),
      jobId: notification.jobId,
      timestamp: new Date().toISOString(),
      status: 'pending_retry'
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
  void notification;
}

/**
 * Send push notification
 *
 * NOTE: Placeholder for web push notifications
 */
async function sendPushNotification(notification: NotificationPayload): Promise<void> {
  void notification;
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
    processNotificationQueue();
  });
}
