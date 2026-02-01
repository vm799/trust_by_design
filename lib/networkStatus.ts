/**
 * Network Status Detection
 * P1-4: Centralized network connectivity checking
 *
 * PROBLEM: navigator.onLine only tells you if there's a network interface.
 * It can't detect:
 * - Captive portals (hotel/airport WiFi)
 * - DNS failures
 * - Supabase being down
 * - Firewalls blocking traffic
 *
 * SOLUTION: Actual ping test to verify Supabase reachability.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Ping timeout (5 seconds is generous for field conditions)
const PING_TIMEOUT_MS = 5000;

// Cache the last known status to avoid excessive pings
let lastPingResult: boolean | null = null;
let lastPingTime = 0;
const PING_CACHE_TTL_MS = 10000; // Cache result for 10 seconds

// Subscribers for network status changes
type NetworkStatusCallback = (isOnline: boolean) => void;
const subscribers: Set<NetworkStatusCallback> = new Set();

/**
 * Check if we have REAL network connectivity to Supabase
 * Don't trust navigator.onLine alone - it lies!
 *
 * @param forceCheck - Bypass cache and always ping
 * @returns true if Supabase is reachable
 */
export async function checkNetworkConnectivity(forceCheck = false): Promise<boolean> {
  // Fast path: navigator says offline = definitely offline
  if (!navigator.onLine) {
    lastPingResult = false;
    return false;
  }

  // No Supabase configured = offline-only mode
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return false;
  }

  // Return cached result if fresh
  const now = Date.now();
  if (!forceCheck && lastPingResult !== null && (now - lastPingTime) < PING_CACHE_TTL_MS) {
    return lastPingResult;
  }

  try {
    // Ping Supabase health endpoint with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);

    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // 400 = auth required but Supabase is reachable
    const isReachable = response.ok || response.status === 400;

    // Only notify if status actually changed (prevents unnecessary re-renders)
    const statusChanged = lastPingResult !== isReachable;

    // Cache result
    lastPingResult = isReachable;
    lastPingTime = now;

    // Notify subscribers only on change
    if (statusChanged) {
      notifySubscribers(isReachable);
    }

    return isReachable;
  } catch (error) {
    console.log('[NetworkStatus] Ping failed:', error);

    // Only notify if status actually changed
    const statusChanged = lastPingResult !== false;

    lastPingResult = false;
    lastPingTime = now;

    if (statusChanged) {
      notifySubscribers(false);
    }
    return false;
  }
}

/**
 * Get the last known network status (from cache)
 * Doesn't make a network request
 */
export function getLastKnownNetworkStatus(): boolean {
  if (lastPingResult !== null) {
    return lastPingResult;
  }
  return navigator.onLine;
}

/**
 * Subscribe to network status changes
 * @returns Unsubscribe function
 */
export function subscribeToNetworkStatus(callback: NetworkStatusCallback): () => void {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

/**
 * Notify all subscribers of status change
 */
function notifySubscribers(isOnline: boolean): void {
  for (const callback of subscribers) {
    try {
      callback(isOnline);
    } catch (e) {
      console.error('[NetworkStatus] Subscriber error:', e);
    }
  }
}

/**
 * Start monitoring network status
 * Listens to browser events and periodically verifies with ping
 */
export function startNetworkMonitoring(): () => void {
  // Listen to browser online/offline events
  const handleOnline = () => {
    console.log('[NetworkStatus] Browser reports online - verifying with ping...');
    checkNetworkConnectivity(true);
  };

  const handleOffline = () => {
    console.log('[NetworkStatus] Browser reports offline');
    lastPingResult = false;
    notifySubscribers(false);
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Periodic connectivity check (every 30s when online, to detect captive portals)
  const intervalId = setInterval(() => {
    if (navigator.onLine) {
      checkNetworkConnectivity(true);
    }
  }, 30000);

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    clearInterval(intervalId);
  };
}

/**
 * React hook for network status
 * Usage: const isOnline = useNetworkStatus();
 */
export function createNetworkStatusHook() {
  return {
    checkNetworkConnectivity,
    getLastKnownNetworkStatus,
    subscribeToNetworkStatus,
    startNetworkMonitoring,
  };
}
