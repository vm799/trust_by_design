/**
 * Secure Redirect URL Management
 * Phase: PATH A - OAuth Security Hardening
 *
 * This module provides a centralized allowlist for redirect URLs
 * to prevent open redirect vulnerabilities in OAuth flows.
 */

/**
 * Allowlist of permitted redirect origins
 * Only these domains are allowed for OAuth redirects
 * UAT Fix #14: Extended allowlist for development and various ports
 * Phase 6.5: Added Vercel preview/production URLs
 */
export const REDIRECT_ALLOWLIST = [
  'https://jobproof.pro',
  'https://jobproof.vercel.app',           // Vercel production
  'https://trust-by-design.vercel.app',    // Vercel alternate
  'http://localhost:3000',
  'http://localhost:5173',  // Vite default
  'http://localhost:5174',  // Vite alternate
  'http://localhost:4173',  // Vite preview
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
] as const;

/**
 * Get the current origin if it's in the allowlist
 * Falls back to production URL if current origin is not allowed
 */
export const getSecureOrigin = (): string => {
  if (typeof window === 'undefined') {
    // Server-side: default to production
    return REDIRECT_ALLOWLIST[0];
  }

  const currentOrigin = window.location.origin;

  // Check if current origin is in allowlist
  if ((REDIRECT_ALLOWLIST as readonly string[]).includes(currentOrigin)) {
    return currentOrigin;
  }

  // Fallback to production URL for security
  console.warn(`Origin ${currentOrigin} not in allowlist. Using production URL.`);
  return REDIRECT_ALLOWLIST[0];
};

/**
 * Get secure redirect URL for OAuth authentication
 * @param path - Optional path to append (e.g., '/#/admin')
 */
export const getAuthRedirectUrl = (path: string = ''): string => {
  return `${getSecureOrigin()}${path}`;
};

/**
 * Get secure redirect URL for magic links (simple invite system)
 * @param token - Magic link token
 * @param jobId - Optional job ID (kept for backwards compatibility, but not used in URL)
 *
 * Simple invite system: URL contains only the token.
 * The token is validated server-side via RPC which returns full job data.
 * Route: /#/technician/{token}
 */
export const getMagicLinkUrl = (token: string, _jobId?: string): string => {
  // URL encode token to prevent injection attacks
  const encodedToken = encodeURIComponent(token);
  // Simple path: /technician/{token} - no query params needed
  return `${getSecureOrigin()}/#/technician/${encodedToken}`;
};

/**
 * Get secure redirect URL for job reports
 * @param jobId - Job ID
 */
export const getReportUrl = (jobId: string): string => {
  return `${getSecureOrigin()}/#/report/${encodeURIComponent(jobId)}`;
};

/**
 * Get bunker-proof run link for technicians
 * NO AUTH REQUIRED - Job ID is the only permission needed
 * Works offline, syncs when back online
 *
 * @param jobId - Job ID (e.g., 'JOB-ABC123')
 * @param options - Optional params to embed in URL (manager/client email)
 * @returns URL like https://app.com/#/run/JOB-ABC123?me=manager@example.com
 *
 * NOTE: Query params are INSIDE the hash for HashRouter compatibility.
 * Use parseHashParams() to extract them on the receiving end.
 */
export const getBunkerRunUrl = (
  jobId: string,
  options?: { managerEmail?: string; clientEmail?: string }
): string => {
  // URL encode jobId to prevent injection attacks
  const encodedId = encodeURIComponent(jobId);
  let url = `${getSecureOrigin()}/#/run/${encodedId}`;

  // Add query params INSIDE the hash (HashRouter compatible)
  const params = new URLSearchParams();
  if (options?.managerEmail) {
    params.set('me', options.managerEmail); // me = manager email
  }
  if (options?.clientEmail) {
    params.set('ce', options.clientEmail); // ce = client email
  }

  const paramString = params.toString();
  if (paramString) {
    url += `?${paramString}`;
  }

  return url;
};

/**
 * Parse query params from hash URL (HashRouter compatible)
 * Standard window.location.search is EMPTY with HashRouter when params are in hash
 *
 * @example
 * URL: https://app.com/#/run/JOB-123?me=manager@example.com
 * parseHashParams() returns { me: 'manager@example.com' }
 */
export const parseHashParams = (): URLSearchParams => {
  if (typeof window === 'undefined') {
    return new URLSearchParams();
  }

  const hash = window.location.hash; // e.g., "#/run/JOB-123?me=test@example.com"
  const queryIndex = hash.indexOf('?');

  if (queryIndex === -1) {
    return new URLSearchParams();
  }

  // Extract everything after the ? in the hash
  const queryString = hash.substring(queryIndex + 1);
  return new URLSearchParams(queryString);
};

/**
 * Get quick create job URL for managers
 * Creates a job and returns a bunker link for technicians
 */
export const getQuickCreateUrl = (): string => {
  return `${getSecureOrigin()}/#/create-job`;
};

/**
 * Validate if a URL is in the allowlist
 */
export const isAllowedRedirect = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    return (REDIRECT_ALLOWLIST as readonly string[]).includes(urlObj.origin);
  } catch {
    return false;
  }
};
