/**
 * Adaptive Polling Hook for Offline-First Reliability
 *
 * Smart polling that adapts to network conditions, visibility, and activity:
 * - Fast polling when online + visible + active
 * - Slow polling when online but hidden/inactive
 * - No polling when offline (preserves battery, uses cached data)
 * - Immediate refresh on reconnect or visibility change
 *
 * Critical for bunker/field scenarios where network is unreliable.
 */

import { useEffect, useRef, useCallback } from 'react';

interface AdaptivePollingOptions {
  /** Callback to execute on each poll */
  callback: () => void | Promise<void>;
  /** Interval when active and visible (default: 10000ms = 10s) */
  activeInterval?: number;
  /** Interval when hidden/inactive (default: 60000ms = 60s) */
  inactiveInterval?: number;
  /** Whether to poll when offline (default: false - saves battery) */
  pollWhenOffline?: boolean;
  /** Whether polling is enabled (default: true) */
  enabled?: boolean;
  /** Dependencies that trigger immediate refresh */
  deps?: React.DependencyList;
}

/**
 * Hook for adaptive polling that respects offline-first principles.
 *
 * @example
 * ```tsx
 * useAdaptivePolling({
 *   callback: loadMessages,
 *   activeInterval: 5000,    // 5s when active
 *   inactiveInterval: 30000, // 30s when hidden
 *   enabled: panelOpen,
 * });
 * ```
 */
export function useAdaptivePolling({
  callback,
  activeInterval = 10000,
  inactiveInterval = 60000,
  pollWhenOffline = false,
  enabled = true,
  deps = [],
}: AdaptivePollingOptions): void {
  const intervalRef = useRef<number | null>(null);
  const callbackRef = useRef(callback);
  const isOnlineRef = useRef(navigator.onLine);
  const isVisibleRef = useRef(!document.hidden);

  // Keep callback ref updated
  callbackRef.current = callback;

  // Safe callback execution with error handling
  const executeCallback = useCallback(() => {
    try {
      callbackRef.current();
    } catch (error) {
      console.warn('[AdaptivePolling] Callback error:', error);
    }
  }, []);

  // Calculate current interval based on conditions
  const getCurrentInterval = useCallback(() => {
    if (!isOnlineRef.current && !pollWhenOffline) {
      return null; // Don't poll when offline
    }
    return isVisibleRef.current ? activeInterval : inactiveInterval;
  }, [activeInterval, inactiveInterval, pollWhenOffline]);

  // Start/restart interval with current settings
  const restartInterval = useCallback(() => {
    // Clear existing
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!enabled) return;

    const interval = getCurrentInterval();
    if (interval === null) return;

    intervalRef.current = window.setInterval(executeCallback, interval);
  }, [enabled, getCurrentInterval, executeCallback]);

  // Main effect - setup and cleanup
  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial call
    executeCallback();

    // Start interval
    restartInterval();

    // Online/offline handlers
    const handleOnline = () => {
      isOnlineRef.current = true;
      // Immediate refresh on reconnect - critical for bunker scenarios
      executeCallback();
      restartInterval();
    };

    const handleOffline = () => {
      isOnlineRef.current = false;
      restartInterval(); // Will clear if pollWhenOffline is false
    };

    // Visibility handler
    const handleVisibility = () => {
      const wasVisible = isVisibleRef.current;
      isVisibleRef.current = !document.hidden;

      // Refresh when becoming visible
      if (!wasVisible && isVisibleRef.current && isOnlineRef.current) {
        executeCallback();
      }
      restartInterval();
    };

    // Register listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, restartInterval, executeCallback]);

  // Handle dependency changes - immediate refresh
  useEffect(() => {
    if (enabled && deps.length > 0) {
      executeCallback();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Hook for smart connection checking with exponential backoff.
 *
 * Used in bunker scenarios where network reliability is critical.
 * Falls back to polling if navigator.onLine events are unreliable.
 *
 * @example
 * ```tsx
 * const isOnline = useSmartConnection({
 *   checkConnection: async () => {
 *     const resp = await fetch('/health', { method: 'HEAD' });
 *     return resp.ok;
 *   },
 *   onStatusChange: (online) => setToast(online ? 'Connected!' : 'Offline'),
 * });
 * ```
 */
interface SmartConnectionOptions {
  /** Function to verify actual connectivity (HEAD request to API) */
  checkConnection: () => Promise<boolean>;
  /** Callback when status changes */
  onStatusChange?: (isOnline: boolean) => void;
  /** Base check interval when online (default: 60000ms = 60s) */
  onlineCheckInterval?: number;
  /** Check interval when offline (shorter for faster reconnect detection) (default: 15000ms = 15s) */
  offlineCheckInterval?: number;
  /** Whether to enable polling checks (default: true) */
  enablePolling?: boolean;
}

export function useSmartConnection({
  checkConnection,
  onStatusChange,
  onlineCheckInterval = 60000,
  offlineCheckInterval = 15000,
  enablePolling = true,
}: SmartConnectionOptions): boolean {
  const isOnlineRef = useRef(navigator.onLine);
  const intervalRef = useRef<number | null>(null);
  const checkConnectionRef = useRef(checkConnection);
  const onStatusChangeRef = useRef(onStatusChange);

  // Keep refs updated
  checkConnectionRef.current = checkConnection;
  onStatusChangeRef.current = onStatusChange;

  const updateStatus = useCallback((newStatus: boolean) => {
    if (newStatus !== isOnlineRef.current) {
      isOnlineRef.current = newStatus;
      onStatusChangeRef.current?.(newStatus);
    }
  }, []);

  const performCheck = useCallback(async () => {
    try {
      const connected = await checkConnectionRef.current();
      updateStatus(connected);
    } catch {
      updateStatus(false);
    }
  }, [updateStatus]);

  const restartInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!enablePolling) return;

    // Shorter interval when offline for faster reconnect detection
    const interval = isOnlineRef.current ? onlineCheckInterval : offlineCheckInterval;
    intervalRef.current = window.setInterval(performCheck, interval);
  }, [enablePolling, onlineCheckInterval, offlineCheckInterval, performCheck]);

  useEffect(() => {
    // Initial check
    performCheck();
    restartInterval();

    const handleOnline = () => {
      // Navigator says online - verify with actual check
      performCheck();
      restartInterval();
    };

    const handleOffline = () => {
      updateStatus(false);
      restartInterval();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
      }
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [performCheck, restartInterval, updateStatus]);

  return isOnlineRef.current;
}

export default useAdaptivePolling;
