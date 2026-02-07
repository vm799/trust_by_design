/**
 * Sync Utility Functions
 *
 * Helper functions for managing photo sync operations and user notifications
 * during the offline-to-online synchronization process.
 */

import { getDatabase } from '../offline/db';
import { Photo } from '../../types';

/**
 * Escape HTML special characters to prevent XSS attacks.
 * All user-facing text in innerHTML MUST be escaped.
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Wait for photo sync to complete
 *
 * Polls IndexedDB to check if photos have been synced to cloud storage.
 * Returns when all photos have syncStatus === 'synced' and isIndexedDBRef === false.
 *
 * @param photoIds - Array of photo IDs to monitor
 * @param jobId - Job ID to check photos against
 * @param pollInterval - Polling interval in milliseconds (default: 1000ms)
 * @returns Promise that resolves when all photos are synced
 */
export async function waitForPhotoSync(
  photoIds: string[],
  jobId: string,
  pollInterval: number = 1000
): Promise<void> {
  return new Promise((resolve, reject) => {
    Date.now(); // Track start time for potential timeout implementation

    const checkSync = async () => {
      try {
        // Get latest job data from IndexedDB
        const database = await getDatabase();
        const job = await database.jobs.get(jobId);

        if (!job) {
          reject(new Error('Job not found in IndexedDB'));
          return;
        }

        // Check if all photos are synced
        const allSynced = photoIds.every(photoId => {
          const photo = job.photos.find(p => p.id === photoId);
          return photo && photo.syncStatus === 'synced' && !photo.isIndexedDBRef;
        });

        if (allSynced) {
          console.log(`✅ All ${photoIds.length} photos synced successfully`);
          resolve();
        } else {
          // Continue polling
          setTimeout(checkSync, pollInterval);
        }
      } catch (error) {
        reject(error);
      }
    };

    // Start polling
    checkSync();
  });
}

/**
 * Show persistent notification to user
 *
 * Displays a notification that persists until dismissed by user.
 * Used for critical sync failures or important status updates.
 *
 * @param options - Notification configuration
 */
export function showPersistentNotification(options: {
  type: 'error' | 'warning' | 'success' | 'info';
  title: string;
  message: string;
  persistent?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}): void {
  const { type, title, message, persistent = true, actionLabel, onAction } = options;

  // Create notification element
  const notification = document.createElement('div');
  notification.id = `notification-${Date.now()}`;
  notification.className = `fixed top-4 right-4 z-[9999] max-w-md rounded-2xl border shadow-2xl p-6 animate-in slide-in-from-right`;

  // Style based on type
  const styles = {
    error: 'bg-danger/10 border-danger/30 text-danger',
    warning: 'bg-warning/10 border-warning/30 text-warning',
    success: 'bg-success/10 border-success/30 text-success',
    info: 'bg-primary/10 border-primary/30 text-primary'
  };

  const icons = {
    error: 'error',
    warning: 'warning',
    success: 'check_circle',
    info: 'info'
  };

  notification.className += ` ${styles[type]}`;

  notification.innerHTML = `
    <div class="flex items-start gap-4">
      <span class="material-symbols-outlined text-2xl font-black">${icons[type]}</span>
      <div class="flex-1 space-y-2">
        <p class="text-sm font-semibold tracking-tight">${escapeHtml(title)}</p>
        <p class="text-xs text-slate-300 leading-relaxed">${escapeHtml(message)}</p>
        ${actionLabel ? `
          <button
            id="notification-action-${Date.now()}"
            class="mt-3 w-full py-2 px-4 rounded-xl text-xs font-semibold tracking-widest border transition-all hover:opacity-80"
          >
            ${escapeHtml(actionLabel)}
          </button>
        ` : ''}
      </div>
      ${!persistent ? `
        <button
          id="notification-close-${Date.now()}"
          class="size-6 rounded-full hover:bg-white/10 flex items-center justify-center transition-all"
        >
          <span class="material-symbols-outlined text-sm">close</span>
        </button>
      ` : ''}
    </div>
  `;

  document.body.appendChild(notification);

  // Add event listeners
  if (actionLabel && onAction) {
    const actionBtn = notification.querySelector(`[id^="notification-action"]`);
    actionBtn?.addEventListener('click', () => {
      onAction();
      if (!persistent) {
        document.body.removeChild(notification);
      }
    });
  }

  if (!persistent) {
    const closeBtn = notification.querySelector(`[id^="notification-close"]`);
    closeBtn?.addEventListener('click', () => {
      document.body.removeChild(notification);
    });

    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 10000);
  }

  console.log(`[Notification] ${type.toUpperCase()}: ${title} - ${message}`);
}

/**
 * Check if photos are still syncing
 *
 * @param photos - Array of photos to check
 * @returns Array of unsynced photos
 */
export function getUnsyncedPhotos(photos: Photo[]): Photo[] {
  return photos.filter(p =>
    p.isIndexedDBRef ||
    p.syncStatus === 'pending' ||
    p.syncStatus === 'syncing'
  );
}

/**
 * Get sync progress for photos
 *
 * @param photos - Array of photos to check
 * @returns Progress percentage (0-100)
 */
export function getSyncProgress(photos: Photo[]): number {
  if (photos.length === 0) return 100;

  const synced = photos.filter(p => p.syncStatus === 'synced' && !p.isIndexedDBRef).length;
  return Math.round((synced / photos.length) * 100);
}

/**
 * Create sync status modal
 *
 * Shows a modal with sync progress for photo uploads
 *
 * @param totalPhotos - Total number of photos to sync
 * @returns Object with update and close functions
 */
export function createSyncStatusModal(totalPhotos: number): {
  update: (syncedCount: number) => void;
  close: () => void;
} {
  const modal = document.createElement('div');
  modal.id = 'sync-status-modal';
  modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm';

  modal.innerHTML = `
    <div class="bg-slate-900 rounded-3xl border border-white/10 p-8 max-w-md w-full mx-4 shadow-2xl animate-in">
      <div class="text-center space-y-6">
        <div class="size-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <span class="material-symbols-outlined text-4xl text-primary font-black animate-spin">sync</span>
        </div>
        <div class="space-y-2">
          <h3 class="text-2xl font-black text-white uppercase tracking-tight">Syncing Photos</h3>
          <p class="text-sm text-slate-400 uppercase tracking-tight">Uploading evidence to secure cloud storage...</p>
        </div>
        <div class="space-y-3">
          <div class="bg-slate-800 rounded-full h-3 overflow-hidden">
            <div
              id="sync-progress-bar"
              class="h-full bg-primary transition-all duration-500 rounded-full shadow-lg shadow-primary/50"
              style="width: 0%"
            ></div>
          </div>
          <p id="sync-status-text" class="text-xs font-black text-slate-500 uppercase tracking-widest">
            0 / ${totalPhotos} Photos Synced
          </p>
        </div>
        <p class="text-[10px] text-slate-600 uppercase tracking-tight">
          Please do not close this window
        </p>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  return {
    update: (syncedCount: number) => {
      const progressBar = document.getElementById('sync-progress-bar');
      const statusText = document.getElementById('sync-status-text');
      const percentage = Math.round((syncedCount / totalPhotos) * 100);

      if (progressBar) {
        progressBar.style.width = `${percentage}%`;
      }
      if (statusText) {
        statusText.textContent = `${syncedCount} / ${totalPhotos} Photos Synced`;
      }
    },
    close: () => {
      if (document.body.contains(modal)) {
        document.body.removeChild(modal);
      }
    }
  };
}
