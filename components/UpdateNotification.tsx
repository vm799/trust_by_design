/**
 * UpdateNotification Component
 *
 * Listens for service worker UPDATE_AVAILABLE messages and displays
 * a notification banner for users to update the app.
 *
 * Features:
 * - Shows banner when update is available
 * - "Update Now" button triggers immediate reload
 * - "Later" button dismisses (with localStorage tracking)
 * - Auto-update for paid users during off-hours (2-5 AM local time)
 * - Checks for unsaved work before auto-updating
 * - Works in both dark and light modes
 *
 * @see public/sw.js - checkForUpdates() function
 */

import React, { useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../lib/AuthContext';
import { getBuildInfo } from '../lib/devReset';
import { fadeInUp } from '../lib/animations';

interface UpdateNotificationProps {
  /** Force show for testing */
  forceShow?: boolean;
  /** Custom position class override */
  positionClass?: string;
}

interface UpdateInfo {
  currentVersion: string;
  newVersion: string;
  timestamp: number;
}

// Check interval for off-hours auto-update (every 5 minutes)
const AUTO_UPDATE_CHECK_INTERVAL = 5 * 60 * 1000;

// LocalStorage key for tracking dismissed updates
const DISMISSED_UPDATE_KEY = 'jobproof_dismissed_update';

// LocalStorage key for form drafts (indicates unsaved work)
const FORM_DRAFT_KEY = 'jobproof_form_draft';

/**
 * Check if current time is in off-hours window (2-5 AM local time)
 */
function isOffHours(): boolean {
  const hour = new Date().getHours();
  return hour >= 2 && hour < 5;
}

/**
 * Check if user has unsaved work (form drafts in localStorage)
 */
function hasUnsavedWork(): boolean {
  try {
    const draft = localStorage.getItem(FORM_DRAFT_KEY);
    if (!draft) return false;

    // Check if draft has actual content
    const parsed = JSON.parse(draft);
    return parsed && Object.keys(parsed).length > 0;
  } catch {
    return false;
  }
}

/**
 * Check if user is a paid subscriber
 * Derives from session.user.user_metadata.subscription_status
 */
function isPaidUser(session: ReturnType<typeof useAuth>['session']): boolean {
  if (!session?.user?.user_metadata) return false;

  const subscriptionStatus = session.user.user_metadata.subscription_status;
  return subscriptionStatus === 'active' ||
         subscriptionStatus === 'trialing' ||
         subscriptionStatus === 'paid';
}

/**
 * Trigger service worker to check for updates
 */
function triggerUpdateCheck(): void {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    const buildInfo = getBuildInfo();
    navigator.serviceWorker.controller.postMessage({
      type: 'CHECK_FOR_UPDATES',
      currentVersion: buildInfo.commit
    });
  }
}

/**
 * Trigger service worker skip waiting and reload
 */
async function applyUpdate(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();

    // If there's a waiting worker, tell it to skip waiting
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    // Reload to get new version
    window.location.reload();
  }
}

const UpdateNotification: React.FC<UpdateNotificationProps> = memo(({
  forceShow = false,
  positionClass = 'bottom-4'
}) => {
  const { session } = useAuth();
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Check if this update was already dismissed
  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISSED_UPDATE_KEY);
    if (dismissed && updateInfo) {
      const dismissedVersion = JSON.parse(dismissed);
      if (dismissedVersion === updateInfo.newVersion) {
        setIsDismissed(true);
      }
    }
  }, [updateInfo]);

  // Listen for UPDATE_AVAILABLE messages from service worker
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'UPDATE_AVAILABLE') {
        console.log('[UpdateNotification] Update available:', event.data);
        setUpdateInfo({
          currentVersion: event.data.currentVersion,
          newVersion: event.data.newVersion,
          timestamp: event.data.timestamp
        });
        setIsDismissed(false);

        // Clear any previous dismissal since this is a new version
        localStorage.removeItem(DISMISSED_UPDATE_KEY);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    // Check for updates on mount
    triggerUpdateCheck();

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);

  // Auto-update for paid users during off-hours
  useEffect(() => {
    if (!updateInfo || isDismissed) return;

    const checkAutoUpdate = () => {
      // Only auto-update for paid users
      if (!isPaidUser(session)) return;

      // Only during off-hours
      if (!isOffHours()) return;

      // Don't auto-update if there's unsaved work
      if (hasUnsavedWork()) {
        console.log('[UpdateNotification] Skipping auto-update: unsaved work detected');
        return;
      }

      console.log('[UpdateNotification] Auto-updating during off-hours');
      applyUpdate();
    };

    // Check immediately
    checkAutoUpdate();

    // Set up interval to check periodically
    const interval = setInterval(checkAutoUpdate, AUTO_UPDATE_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [updateInfo, isDismissed, session]);

  // Handle "Update Now" click
  const handleUpdateNow = useCallback(async () => {
    setIsUpdating(true);
    await applyUpdate();
  }, []);

  // Handle "Later" click
  const handleDismiss = useCallback(() => {
    if (updateInfo) {
      localStorage.setItem(DISMISSED_UPDATE_KEY, JSON.stringify(updateInfo.newVersion));
    }
    setIsDismissed(true);
  }, [updateInfo]);

  // Don't show if no update or dismissed (unless forceShow)
  if (!forceShow && (!updateInfo || isDismissed)) {
    return null;
  }

  const buildInfo = getBuildInfo();
  const displayCurrentVersion = updateInfo?.currentVersion || buildInfo.commit;
  const displayNewVersion = updateInfo?.newVersion || 'unknown';

  return (
    <AnimatePresence>
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        exit="hidden"
        className={`
          fixed ${positionClass} left-4 right-4
          sm:left-auto sm:right-4 sm:w-96
          z-[9998]
        `}
      >
        <div
          className="
            bg-slate-800/95 dark:bg-slate-800/95
            bg-white/95 dark:bg-slate-800/95
            backdrop-blur-md
            border border-slate-700/50 dark:border-slate-700/50
            border-slate-200 dark:border-slate-700/50
            rounded-xl shadow-2xl
            overflow-hidden
          "
        >
          {/* Update progress indicator */}
          {isUpdating && (
            <div className="h-1 bg-blue-500/30">
              <div className="h-full bg-blue-500 animate-pulse w-full" />
            </div>
          )}

          <div className="p-4">
            {/* Header */}
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="flex-shrink-0 size-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <svg
                  className="size-5 text-blue-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Update Available
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  A new version of JobProof is ready to install.
                </p>
                <div className="mt-2 flex items-center gap-2 text-[10px] font-mono text-slate-500">
                  <span>{displayCurrentVersion.slice(0, 7)}</span>
                  <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  <span className="text-blue-500">{displayNewVersion.slice(0, 7)}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleUpdateNow}
                disabled={isUpdating}
                className="
                  flex-1 min-h-[44px] px-4 py-2.5
                  bg-blue-600 hover:bg-blue-700 active:bg-blue-800
                  disabled:bg-blue-600/50
                  text-white text-sm font-medium
                  rounded-lg transition-colors
                  flex items-center justify-center gap-2
                "
              >
                {isUpdating ? (
                  <>
                    <svg className="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Updating...
                  </>
                ) : (
                  'Update Now'
                )}
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                disabled={isUpdating}
                className="
                  min-h-[44px] px-4 py-2.5
                  bg-slate-700/50 hover:bg-slate-600/50 active:bg-slate-500/50
                  dark:bg-slate-700/50 dark:hover:bg-slate-600/50
                  bg-slate-100 hover:bg-slate-200
                  dark:bg-slate-700/50
                  text-slate-700 dark:text-slate-300
                  text-sm font-medium
                  rounded-lg transition-colors
                "
              >
                Later
              </button>
            </div>

            {/* Paid user auto-update hint */}
            {isPaidUser(session) && (
              <p className="mt-3 text-[10px] text-slate-500 dark:text-slate-500 text-center">
                Pro tip: Updates install automatically during off-hours (2-5 AM)
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

UpdateNotification.displayName = 'UpdateNotification';

export default UpdateNotification;
