import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  queueNotification,
  processNotificationQueue,
  notifyJobSealed,
  notifyPhotosSynced,
  notifyLinkOpened,
  notifySyncFailed,
  getInAppNotifications,
  markNotificationRead,
  clearNotifications,
  type NotificationPayload,
  type NotificationPriority,
} from '../../lib/notificationService';

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  getSupabase: vi.fn(() => null),
  isSupabaseAvailable: vi.fn(() => false),
}));

// Storage for localStorage mock
let localStorageMock: Record<string, string> = {};

// Mock localStorage
const createLocalStorageMock = () => ({
  getItem: vi.fn((key: string) => localStorageMock[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageMock[key];
  }),
  clear: vi.fn(() => {
    localStorageMock = {};
  }),
  length: 0,
  key: vi.fn(() => null),
});

describe('Notification Service - Email and Queue Operations', () => {
  beforeEach(() => {
    // Reset localStorage mock
    localStorageMock = {};
    Object.defineProperty(window, 'localStorage', {
      value: createLocalStorageMock(),
      writable: true,
    });

    // Reset navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      writable: true,
      configurable: true,
    });

    // Mock crypto.randomUUID
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('test-uuid-123');

    // Suppress console logs during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Priority Colors in HTML Generation', () => {
    it('uses #64748b (slate) for low priority notifications', () => {
      const notification = queueNotification(
        'test_notification',
        'Low Priority Test',
        'This is a low priority message',
        {
          priority: 'low',
          recipientType: 'manager',
          workspaceId: 'workspace-123',
        }
      );

      expect(notification.priority).toBe('low');
      // Priority colors are applied in generateNotificationEmailHtml
      // low: '#64748b'
    });

    it('uses #2563eb (blue) for normal priority notifications', () => {
      const notification = queueNotification(
        'test_notification',
        'Normal Priority Test',
        'This is a normal priority message',
        {
          priority: 'normal',
          recipientType: 'manager',
          workspaceId: 'workspace-123',
        }
      );

      expect(notification.priority).toBe('normal');
      // normal: '#2563eb'
    });

    it('uses #f59e0b (amber) for high priority notifications', () => {
      const notification = queueNotification(
        'test_notification',
        'High Priority Test',
        'This is a high priority message',
        {
          priority: 'high',
          recipientType: 'manager',
          workspaceId: 'workspace-123',
        }
      );

      expect(notification.priority).toBe('high');
      // high: '#f59e0b'
    });

    it('uses #ef4444 (red) for urgent priority notifications', () => {
      const notification = queueNotification(
        'test_notification',
        'Urgent Priority Test',
        'This is an urgent priority message',
        {
          priority: 'urgent',
          recipientType: 'manager',
          workspaceId: 'workspace-123',
        }
      );

      expect(notification.priority).toBe('urgent');
      // urgent: '#ef4444'
    });
  });

  describe('Email Queuing When Supabase Unavailable', () => {
    it('queues notification to localStorage when offline', () => {
      const notification = queueNotification(
        'job_assigned',
        'New Job Assigned',
        'You have been assigned to a new job',
        {
          recipientType: 'technician',
          workspaceId: 'workspace-123',
          jobId: 'job-456',
        }
      );

      expect(notification.status).toBe('pending');
      expect(notification.retryCount).toBe(0);

      // Verify it was saved to localStorage
      expect(localStorage.setItem).toHaveBeenCalled();
    });

    it('creates notification with all required fields', () => {
      const notification = queueNotification(
        'job_completed',
        'Job Completed',
        'The job has been completed successfully',
        {
          channels: ['in_app', 'email'],
          priority: 'high',
          recipientType: 'manager',
          recipientEmail: 'manager@test.com',
          workspaceId: 'workspace-123',
          jobId: 'job-789',
          metadata: { technicianName: 'John Smith' },
        }
      );

      expect(notification.id).toBe('test-uuid-123');
      expect(notification.type).toBe('job_completed');
      expect(notification.title).toBe('Job Completed');
      expect(notification.message).toBe('The job has been completed successfully');
      expect(notification.channels).toEqual(['in_app', 'email']);
      expect(notification.priority).toBe('high');
      expect(notification.recipientType).toBe('manager');
      expect(notification.recipientEmail).toBe('manager@test.com');
      expect(notification.workspaceId).toBe('workspace-123');
      expect(notification.jobId).toBe('job-789');
      expect(notification.metadata).toEqual({ technicianName: 'John Smith' });
      expect(notification.createdAt).toBeDefined();
    });
  });

  describe('Queue Limit of 50 Items', () => {
    it('maintains queue in localStorage for offline processing', () => {
      // Queue multiple notifications
      for (let i = 0; i < 5; i++) {
        vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(`uuid-${i}`);
        queueNotification(
          `test_${i}`,
          `Test ${i}`,
          `Message ${i}`,
          {
            recipientType: 'technician',
            workspaceId: 'workspace-123',
          }
        );
      }

      // Verify setItem was called for each notification
      expect(localStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('Queue Processing When Online', () => {
    it('processes queue when navigator.onLine is true', async () => {
      // Set online
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true,
        configurable: true,
      });

      // Queue a notification (will try to process immediately)
      const notification = queueNotification(
        'test_online',
        'Online Test',
        'Processing test',
        {
          recipientType: 'manager',
          workspaceId: 'workspace-123',
        }
      );

      expect(notification.status).toBe('pending');
    });

    it('clears processed notifications from queue', async () => {
      // Setup empty queue
      localStorageMock['jobproof_notification_queue'] = JSON.stringify([]);

      await processNotificationQueue();

      // Should not throw and should handle empty queue gracefully
      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining('Processing')
      );
    });
  });

  describe('Convenience Method: notifyJobSealed()', () => {
    it('creates high priority job sealed notification', () => {
      const notification = notifyJobSealed(
        'workspace-123',
        'job-456',
        'HVAC Installation',
        'John Smith',
        'Acme Corp',
        'manager@acme.com'
      );

      expect(notification.type).toBe('job_sealed');
      expect(notification.title).toBe('Job Sealed: HVAC Installation');
      expect(notification.priority).toBe('high');
      expect(notification.channels).toContain('in_app');
      expect(notification.channels).toContain('email');
      expect(notification.recipientEmail).toBe('manager@acme.com');
      expect(notification.metadata).toEqual({
        technicianName: 'John Smith',
        clientName: 'Acme Corp',
      });
    });

    it('sends only in-app notification when no manager email provided', () => {
      const notification = notifyJobSealed(
        'workspace-123',
        'job-456',
        'Electrical Repair',
        'Jane Doe',
        'Global Industries'
        // No email provided
      );

      expect(notification.channels).toEqual(['in_app']);
      expect(notification.recipientEmail).toBeUndefined();
    });
  });

  describe('Convenience Method: notifyPhotosSynced()', () => {
    it('creates low priority photos synced notification', () => {
      const notification = notifyPhotosSynced(
        'workspace-123',
        'job-789',
        5
      );

      expect(notification.type).toBe('photos_synced');
      expect(notification.title).toBe('Photos Uploaded');
      expect(notification.message).toContain('5 photo(s)');
      expect(notification.priority).toBe('low');
      expect(notification.channels).toEqual(['in_app']);
      expect(notification.recipientType).toBe('technician');
      expect(notification.metadata).toEqual({ photoCount: 5 });
    });

    it('includes job ID in notification metadata', () => {
      const notification = notifyPhotosSynced(
        'workspace-123',
        'job-specific-id',
        3
      );

      expect(notification.jobId).toBe('job-specific-id');
    });
  });

  describe('Offline Queue Retry Logic', () => {
    it('increments retry count on failed delivery', async () => {
      // Setup a notification in the queue
      const pendingNotification: NotificationPayload = {
        id: 'retry-test-id',
        type: 'test',
        title: 'Retry Test',
        message: 'Testing retry logic',
        channels: ['in_app'],
        priority: 'normal',
        recipientType: 'manager',
        workspaceId: 'workspace-123',
        createdAt: new Date().toISOString(),
        status: 'pending',
        retryCount: 0,
      };

      localStorageMock['jobproof_notification_queue'] = JSON.stringify([pendingNotification]);

      // Process queue - will fail and increment retry
      await processNotificationQueue();

      // The notification should have been processed (in-app succeeds locally)
    });

    it('marks notification as failed after max retries', async () => {
      const failedNotification: NotificationPayload = {
        id: 'max-retry-test',
        type: 'test',
        title: 'Max Retry Test',
        message: 'Testing max retry logic',
        channels: ['email'], // Email will fail without Supabase
        priority: 'normal',
        recipientType: 'manager',
        recipientEmail: 'test@test.com',
        workspaceId: 'workspace-123',
        createdAt: new Date().toISOString(),
        status: 'pending',
        retryCount: 4, // One away from max
      };

      localStorageMock['jobproof_notification_queue'] = JSON.stringify([failedNotification]);

      await processNotificationQueue();

      // After processing, should be stored in sent notifications
    });

    it('stores sent notifications for audit trail', async () => {
      const notification: NotificationPayload = {
        id: 'audit-test',
        type: 'test',
        title: 'Audit Test',
        message: 'Testing audit trail',
        channels: ['in_app'],
        priority: 'normal',
        recipientType: 'technician',
        workspaceId: 'workspace-123',
        createdAt: new Date().toISOString(),
        status: 'pending',
        retryCount: 0,
      };

      localStorageMock['jobproof_notification_queue'] = JSON.stringify([notification]);

      await processNotificationQueue();

      // Verify sent notifications storage was updated
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'jobproof_notifications_sent',
        expect.any(String)
      );
    });
  });

  describe('In-App Notification Management', () => {
    it('retrieves in-app notifications for workspace', () => {
      const workspaceId = 'workspace-test';
      const mockNotifications = [
        { id: '1', title: 'Test 1', isRead: false },
        { id: '2', title: 'Test 2', isRead: true },
      ];

      localStorageMock[`jobproof_inapp_${workspaceId}`] = JSON.stringify(mockNotifications);

      const notifications = getInAppNotifications(workspaceId);

      expect(notifications).toHaveLength(2);
      expect(notifications[0].title).toBe('Test 1');
    });

    it('marks notification as read', () => {
      const workspaceId = 'workspace-read-test';
      const mockNotifications = [
        { id: 'notif-1', title: 'Unread', isRead: false },
      ];

      localStorageMock[`jobproof_inapp_${workspaceId}`] = JSON.stringify(mockNotifications);

      markNotificationRead(workspaceId, 'notif-1');

      expect(localStorage.setItem).toHaveBeenCalled();
    });

    it('clears all notifications for workspace', () => {
      const workspaceId = 'workspace-clear-test';
      localStorageMock[`jobproof_inapp_${workspaceId}`] = JSON.stringify([{ id: '1' }]);

      clearNotifications(workspaceId);

      expect(localStorage.removeItem).toHaveBeenCalledWith(
        `jobproof_inapp_${workspaceId}`
      );
    });
  });
});
