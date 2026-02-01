/**
 * useNetworkStatus - React hook for reliable network detection
 * P1-4: Don't trust navigator.onLine alone
 *
 * Usage:
 *   const { isOnline, isChecking, checkNow } = useNetworkStatus();
 */

import { useState, useEffect, useCallback } from 'react';
import {
  checkNetworkConnectivity,
  getLastKnownNetworkStatus,
  subscribeToNetworkStatus,
} from '../lib/networkStatus';

interface NetworkStatusResult {
  /** True if Supabase is reachable (verified with ping) */
  isOnline: boolean;
  /** True while a ping check is in progress */
  isChecking: boolean;
  /** Force a network check now */
  checkNow: () => Promise<boolean>;
}

/**
 * Hook for reliable network status detection
 * Uses actual ping tests, not just navigator.onLine
 */
export function useNetworkStatus(): NetworkStatusResult {
  const [isOnline, setIsOnline] = useState(getLastKnownNetworkStatus);
  const [isChecking, setIsChecking] = useState(false);

  // Subscribe to network status changes
  useEffect(() => {
    const unsubscribe = subscribeToNetworkStatus((online) => {
      setIsOnline(online);
    });

    // Initial check on mount
    checkNetworkConnectivity().then(setIsOnline);

    return unsubscribe;
  }, []);

  // Listen to browser online/offline events for immediate feedback
  useEffect(() => {
    const handleOnline = () => {
      // Browser says online - verify with ping
      setIsChecking(true);
      checkNetworkConnectivity(true).then((result) => {
        setIsOnline(result);
        setIsChecking(false);
      });
    };

    const handleOffline = () => {
      // Browser says offline - trust it immediately
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Manual check function
  const checkNow = useCallback(async () => {
    setIsChecking(true);
    try {
      const result = await checkNetworkConnectivity(true);
      setIsOnline(result);
      return result;
    } finally {
      setIsChecking(false);
    }
  }, []);

  return { isOnline, isChecking, checkNow };
}

export default useNetworkStatus;
