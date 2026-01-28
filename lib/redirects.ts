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
 * @returns URL like https://app.com/#/run/JOB-ABC123
 */
export const getBunkerRunUrl = (jobId: string): string => {
  // URL encode jobId to prevent injection attacks
  const encodedId = encodeURIComponent(jobId);
  return `${getSecureOrigin()}/#/run/${encodedId}`;
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
