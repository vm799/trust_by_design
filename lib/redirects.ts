/**
 * Secure Redirect URL Management
 * Phase: PATH A - OAuth Security Hardening
 *
 * This module provides a centralized allowlist for redirect URLs
 * to prevent open redirect vulnerabilities in OAuth flows.
 *
 * Security Features:
 * - URL checksum to prevent Job ID guessing
 * - Allowlist for OAuth redirects
 * - Vercel preview URL detection
 */

// Secret salt for checksum generation (in production, use env var)
const CHECKSUM_SALT = 'jobproof_bunker_2026';

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
 * Check if origin is a valid Vercel preview URL
 * Vercel preview URLs have format: https://{project}-{hash}-{user}.vercel.app
 */
function isVercelPreviewUrl(origin: string): boolean {
  try {
    const url = new URL(origin);
    // Vercel preview URLs end with .vercel.app and use HTTPS
    return url.protocol === 'https:' && url.hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

/**
 * Get the current origin - ALWAYS uses window.location.origin
 * This is the "PhD fix" - never rely on hardcoded URLs or env vars
 *
 * Security: Only allows known domains and Vercel preview URLs
 */
export const getSecureOrigin = (): string => {
  if (typeof window === 'undefined') {
    // Server-side: default to production
    return REDIRECT_ALLOWLIST[0];
  }

  const currentOrigin = window.location.origin;

  // Check if current origin is in explicit allowlist
  if ((REDIRECT_ALLOWLIST as readonly string[]).includes(currentOrigin)) {
    return currentOrigin;
  }

  // Check if it's a valid Vercel preview URL
  if (isVercelPreviewUrl(currentOrigin)) {
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
 * Generate a short checksum for Job ID verification
 * Uses a simple hash to prevent random Job ID guessing attacks
 *
 * @param jobId - Job ID to generate checksum for
 * @returns 6-character checksum
 */
export function generateChecksum(jobId: string): string {
  const input = `${CHECKSUM_SALT}:${jobId}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Convert to base36 and take last 6 chars for short checksum
  return Math.abs(hash).toString(36).padStart(6, '0').slice(-6);
}

/**
 * Validate a Job ID checksum
 *
 * @param jobId - Job ID to validate
 * @param checksum - Checksum from URL
 * @returns True if checksum is valid
 */
export function validateChecksum(jobId: string, checksum: string): boolean {
  const expected = generateChecksum(jobId);
  return expected === checksum;
}

/**
 * Get bunker-proof run link for technicians
 * NO AUTH REQUIRED - Job ID + checksum provide access control
 * Works offline, syncs when back online
 *
 * @param jobId - Job ID (e.g., 'JOB-ABC123')
 * @returns URL like https://app.com/#/run/JOB-ABC123?c=abc123
 */
export const getBunkerRunUrl = (jobId: string): string => {
  // URL encode jobId to prevent injection attacks
  const encodedId = encodeURIComponent(jobId);
  // Add checksum to prevent ID guessing attacks
  const checksum = generateChecksum(jobId);
  return `${getSecureOrigin()}/#/run/${encodedId}?c=${checksum}`;
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
