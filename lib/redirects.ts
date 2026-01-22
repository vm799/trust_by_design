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
 */
export const REDIRECT_ALLOWLIST = [
  'https://jobproof.pro',
  'http://localhost:3000',
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
  if (REDIRECT_ALLOWLIST.includes(currentOrigin as any)) {
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
 * Get secure redirect URL for magic links
 * @param token - Magic link token
 * @param jobId - Optional job ID to include as query parameter for deep-linking
 */
export const getMagicLinkUrl = (token: string, jobId?: string): string => {
  const baseUrl = `${getSecureOrigin()}/#/track/${token}`;
  return jobId ? `${baseUrl}?jobId=${jobId}` : baseUrl;
};

/**
 * Get secure redirect URL for job reports
 * @param jobId - Job ID
 */
export const getReportUrl = (jobId: string): string => {
  return `${getSecureOrigin()}/#/report/${jobId}`;
};

/**
 * Validate if a URL is in the allowlist
 */
export const isAllowedRedirect = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    return REDIRECT_ALLOWLIST.includes(urlObj.origin as any);
  } catch {
    return false;
  }
};
