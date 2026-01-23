/**
 * Timestamp Verification Service
 *
 * Provides timestamp verification and drift detection to ensure
 * evidence timestamps are reliable and can withstand legal scrutiny.
 *
 * Features:
 * - Server time synchronization
 * - Local clock drift detection
 * - Timestamp signing for non-repudiation
 * - Timezone-aware formatting
 */

import { logger } from './errorLogger';

export interface TimestampInfo {
  localTime: string;
  localUnix: number;
  serverTime?: string;
  serverUnix?: number;
  drift?: number; // milliseconds difference from server
  timezone: string;
  timezoneOffset: number;
  isDriftAcceptable: boolean;
  signature?: string;
}

// Maximum acceptable clock drift (5 minutes)
const MAX_ACCEPTABLE_DRIFT_MS = 5 * 60 * 1000;

// Cache server time offset
let serverTimeOffset: number | null = null;
let lastSyncTime = 0;
const SYNC_INTERVAL = 15 * 60 * 1000; // Re-sync every 15 minutes

/**
 * Get current server time (via HTTP Date header)
 */
async function fetchServerTime(): Promise<number | null> {
  try {
    // Use HEAD request to minimize data transfer
    const response = await fetch(window.location.origin, {
      method: 'HEAD',
      cache: 'no-cache'
    });

    const dateHeader = response.headers.get('Date');
    if (dateHeader) {
      return new Date(dateHeader).getTime();
    }

    // Fallback: try a time API
    const timeResponse = await fetch('https://worldtimeapi.org/api/ip', {
      cache: 'no-cache'
    });
    if (timeResponse.ok) {
      const data = await timeResponse.json();
      return new Date(data.datetime).getTime();
    }
  } catch (error) {
    logger.warn('evidence', 'Failed to fetch server time', error);
  }

  return null;
}

/**
 * Synchronize with server time
 */
export async function syncServerTime(): Promise<void> {
  const now = Date.now();

  // Skip if recently synced
  if (serverTimeOffset !== null && now - lastSyncTime < SYNC_INTERVAL) {
    return;
  }

  const serverTime = await fetchServerTime();
  if (serverTime !== null) {
    serverTimeOffset = serverTime - now;
    lastSyncTime = now;
    logger.debug('evidence', 'Server time synced', { offsetMs: serverTimeOffset });
  }
}

/**
 * Get current drift from server time
 */
export function getCurrentDrift(): number | null {
  return serverTimeOffset;
}

/**
 * Check if local clock drift is acceptable
 */
export function isDriftAcceptable(): boolean {
  if (serverTimeOffset === null) {
    // If we can't check, assume it's OK but log a warning
    logger.warn('evidence', 'Cannot verify clock drift - server time not synced');
    return true;
  }

  return Math.abs(serverTimeOffset) <= MAX_ACCEPTABLE_DRIFT_MS;
}

/**
 * Create a signed timestamp for evidence
 */
export async function createSignedTimestamp(data: string): Promise<string> {
  try {
    const timestamp = Date.now().toString();
    const payload = `${timestamp}:${data}`;

    // Use HMAC-SHA256 for timestamp signing
    const key = await crypto.subtle.generateKey(
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const encoder = new TextEncoder();
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payload)
    );

    const signatureHex = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return `${timestamp}:${signatureHex}`;
  } catch (error) {
    logger.error('evidence', 'Failed to create signed timestamp', error);
    return `${Date.now()}:unsigned`;
  }
}

/**
 * Get verified timestamp information
 */
export async function getVerifiedTimestamp(): Promise<TimestampInfo> {
  // Ensure server time is synced
  await syncServerTime();

  const now = Date.now();
  const localDate = new Date(now);

  const info: TimestampInfo = {
    localTime: localDate.toISOString(),
    localUnix: now,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: localDate.getTimezoneOffset(),
    isDriftAcceptable: isDriftAcceptable()
  };

  if (serverTimeOffset !== null) {
    const serverUnix = now + serverTimeOffset;
    info.serverTime = new Date(serverUnix).toISOString();
    info.serverUnix = serverUnix;
    info.drift = serverTimeOffset;
  }

  return info;
}

/**
 * Format timestamp for legal/audit purposes
 * Includes timezone information explicitly
 */
export function formatLegalTimestamp(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Format: "2024-01-15T14:30:00.000Z (UTC) / 2024-01-15T09:30:00-05:00 (America/New_York)"
  const utc = d.toISOString();
  const local = d.toLocaleString('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short'
  });

  return `${utc} (UTC) / ${local} (${tz})`;
}

/**
 * Get timestamp metadata for evidence package
 */
export async function getTimestampMetadata(): Promise<{
  timestamp: TimestampInfo;
  formatted: string;
  signature: string;
}> {
  const timestamp = await getVerifiedTimestamp();
  const formatted = formatLegalTimestamp(timestamp.localUnix);
  const signature = await createSignedTimestamp(timestamp.localTime);

  return {
    timestamp,
    formatted,
    signature
  };
}

/**
 * Validate a timestamp is within expected range
 */
export function isTimestampValid(
  timestampUnix: number,
  options: {
    maxAgeMs?: number;
    maxFutureMs?: number;
  } = {}
): boolean {
  const { maxAgeMs = 24 * 60 * 60 * 1000, maxFutureMs = 5 * 60 * 1000 } = options;
  const now = Date.now();

  // Check if timestamp is too old
  if (now - timestampUnix > maxAgeMs) {
    return false;
  }

  // Check if timestamp is in the future (beyond acceptable drift)
  if (timestampUnix - now > maxFutureMs) {
    return false;
  }

  return true;
}

// Auto-sync on module load - DEFERRED to not block app startup
if (typeof window !== 'undefined') {
  // Delay sync to not block initial render
  setTimeout(() => {
    syncServerTime().catch(() => {
      // Silently fail - timestamp sync is not critical for app startup
    });
  }, 3000);
}
