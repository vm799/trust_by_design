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
 * Get validated handshake URL for technician job access
 * @param jobId - The job ID
 * @param deliveryEmail - Manager/creator email for report delivery (REQUIRED)
 * @param clientEmail - Optional client email for CC on report
 *
 * The URL contains an access code that embeds all required handshake data:
 * - Job ID
 * - Checksum (tamper detection)
 * - Delivery email
 * - Optional client email
 *
 * Route: /#/go/{accessCode}
 *
 * This replaces the legacy getMagicLinkUrl which used /technician/:token
 * and had the "ghost link" problem where emails were missing.
 */
export const getValidatedHandshakeUrl = (
  jobId: string,
  deliveryEmail: string,
  clientEmail?: string
): string => {
  // VALIDATION: Require valid deliveryEmail to prevent ghost links
  if (!deliveryEmail || deliveryEmail.trim() === '' || !deliveryEmail.includes('@')) {
    console.error(
      '[getValidatedHandshakeUrl] ERROR: Called without valid deliveryEmail. ' +
      'This will create a ghost link that cannot deliver reports. ' +
      `JobId: ${jobId}, deliveryEmail: ${deliveryEmail}, Stack:`,
      new Error().stack
    );
    throw new Error('Valid deliveryEmail with @ is required for technician links');
  }

  // Generate checksum for tamper detection
  const checksum = generateChecksum(jobId);

  // Create access code payload
  const payload = {
    jobId,
    checksum,
    deliveryEmail,
    clientEmail,
    createdAt: Date.now(),
  };

  // Unicode-safe base64 encoding
  let accessCode: string;
  try {
    // Try standard btoa first (faster for ASCII)
    accessCode = btoa(JSON.stringify(payload));
  } catch {
    // Fallback for Unicode characters (e.g., international emails like manager@例え.jp)
    const encoder = new TextEncoder();
    const bytes = encoder.encode(JSON.stringify(payload));
    accessCode = btoa(String.fromCharCode(...bytes));
  }
  const encodedAccessCode = encodeURIComponent(accessCode);

  return `${getSecureOrigin()}/#/go/${encodedAccessCode}`;
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
 * @param options - Optional params to embed in URL (manager/client email)
 * @returns URL like https://app.com/#/run/JOB-ABC123?c=abc123&me=manager@example.com
 *
 * NOTE: Query params are INSIDE the hash for HashRouter compatibility.
 * Use parseHashParams() to extract them on the receiving end.
 */
export const getBunkerRunUrl = (
  jobId: string,
  options?: { managerEmail?: string; clientEmail?: string }
): string => {
  // VALIDATION: Log if called without any email - helps catch "ghost link" issues in UAT
  if (!options?.managerEmail && !options?.clientEmail) {
    console.error(
      '[getBunkerRunUrl] WARNING: Called without email params. ' +
      'This link may not support the Public-Private handshake. ' +
      `JobId: ${jobId}, Stack:`,
      new Error().stack
    );
  }

  // URL encode jobId to prevent injection attacks
  const encodedId = encodeURIComponent(jobId);
  let url = `${getSecureOrigin()}/#/run/${encodedId}`;

  // Add query params INSIDE the hash (HashRouter compatible)
  const params = new URLSearchParams();

  // Add checksum to prevent ID guessing attacks
  params.set('c', generateChecksum(jobId));

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
 * URL: https://app.com/#/run/JOB-123?c=abc123&me=manager@example.com
 * parseHashParams() returns { c: 'abc123', me: 'manager@example.com' }
 */
export const parseHashParams = (): URLSearchParams => {
  if (typeof window === 'undefined') {
    return new URLSearchParams();
  }

  const hash = window.location.hash; // e.g., "#/run/JOB-123?c=abc123&me=test@example.com"
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
