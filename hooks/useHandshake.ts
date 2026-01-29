/**
 * useHandshake - Defensive URL Parameter Parsing for Technician Links
 *
 * PhD-level fix for the "ghost link" problem where technicians arrive
 * without required query parameters (email, checksum).
 *
 * This hook:
 * 1. Parses HashRouter-compatible query params (inside the hash)
 * 2. Validates the checksum to prevent Job ID guessing attacks
 * 3. Provides fallback data when params are missing
 * 4. Persists params to localStorage for idempotent page refreshes
 *
 * @author Claude Code - Search & Destroy Refactor
 */

import { useState, useEffect, useCallback } from 'react';
import { parseHashParams, validateChecksum } from '../lib/redirects';

// LocalStorage keys for idempotent refresh handling
const STORAGE_KEYS = {
  MANAGER_EMAIL: 'bunker_manager_email',
  CLIENT_EMAIL: 'bunker_client_email',
  JOB_ID: 'bunker_current_job_id',
  JOB_TITLE: 'bunker_job_title',
  CHECKSUM_VALIDATED: 'bunker_checksum_validated',
} as const;

export interface HandshakeData {
  /** Manager email from URL or localStorage */
  managerEmail: string | null;
  /** Client email from URL or localStorage */
  clientEmail: string | null;
  /** Checksum from URL */
  checksum: string | null;
  /** Whether the checksum is valid */
  isChecksumValid: boolean;
  /** Whether any email was found (URL or localStorage) */
  hasEmail: boolean;
  /** Whether params came from URL (fresh link) vs localStorage (refresh) */
  isFromUrl: boolean;
  /** The raw hash params for debugging */
  rawParams: URLSearchParams;
}

export interface UseHandshakeResult {
  /** Parsed handshake data */
  data: HandshakeData;
  /** Whether we're still loading/parsing */
  isLoading: boolean;
  /** Set manager email manually (for fallback UI) */
  setManagerEmail: (email: string) => void;
  /** Clear all stored handshake data */
  clearHandshake: () => void;
  /** Store current handshake data to localStorage */
  persistHandshake: () => void;
}

/**
 * Hook to parse and manage technician link handshake data
 *
 * @param jobId - The job ID from the URL params
 * @returns Handshake data and management functions
 *
 * @example
 * ```tsx
 * const { data, setManagerEmail } = useHandshake(jobId);
 *
 * if (!data.hasEmail) {
 *   return <FallbackEmailInput onSubmit={setManagerEmail} />;
 * }
 * ```
 */
export function useHandshake(jobId: string | undefined): UseHandshakeResult {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<HandshakeData>({
    managerEmail: null,
    clientEmail: null,
    checksum: null,
    isChecksumValid: false,
    hasEmail: false,
    isFromUrl: false,
    rawParams: new URLSearchParams(),
  });

  // Parse URL and localStorage on mount
  useEffect(() => {
    if (!jobId) {
      setIsLoading(false);
      return;
    }

    // PhD-level hash URL parsing for HashRouter
    const hashParams = parseHashParams();

    // Extract params from URL
    const urlManagerEmail = hashParams.get('me'); // me = manager email
    const urlClientEmail = hashParams.get('ce');  // ce = client email
    const urlChecksum = hashParams.get('c');      // c = checksum

    // Check localStorage for previously stored values (handles page refresh)
    const storedManagerEmail = localStorage.getItem(STORAGE_KEYS.MANAGER_EMAIL);
    const storedClientEmail = localStorage.getItem(STORAGE_KEYS.CLIENT_EMAIL);
    const storedJobId = localStorage.getItem(STORAGE_KEYS.JOB_ID);

    // Determine if this is a fresh link or a page refresh
    const isFromUrl = !!(urlManagerEmail || urlClientEmail);
    const isStoredForThisJob = storedJobId === jobId;

    // Priority: URL params > localStorage (only if same job)
    const managerEmail = urlManagerEmail || (isStoredForThisJob ? storedManagerEmail : null);
    const clientEmail = urlClientEmail || (isStoredForThisJob ? storedClientEmail : null);

    // Validate checksum
    const isChecksumValid = urlChecksum ? validateChecksum(jobId, urlChecksum) : false;

    // Log for debugging ghost link issues
    if (isFromUrl) {
      console.log('[useHandshake] Parsed from URL:', {
        managerEmail,
        clientEmail,
        checksum: urlChecksum,
        isChecksumValid,
        fullHash: window.location.hash,
      });
    } else if (isStoredForThisJob && (storedManagerEmail || storedClientEmail)) {
      console.log('[useHandshake] Restored from localStorage (page refresh):', {
        managerEmail,
        clientEmail,
        jobId,
      });
    } else {
      console.warn('[useHandshake] No handshake data found in URL or localStorage!', {
        jobId,
        fullHash: window.location.hash,
      });
    }

    // Store fresh URL params to localStorage for idempotent refresh
    if (isFromUrl) {
      if (urlManagerEmail) {
        localStorage.setItem(STORAGE_KEYS.MANAGER_EMAIL, urlManagerEmail);
      }
      if (urlClientEmail) {
        localStorage.setItem(STORAGE_KEYS.CLIENT_EMAIL, urlClientEmail);
      }
      localStorage.setItem(STORAGE_KEYS.JOB_ID, jobId);
      if (isChecksumValid) {
        localStorage.setItem(STORAGE_KEYS.CHECKSUM_VALIDATED, 'true');
      }
    }

    setData({
      managerEmail,
      clientEmail,
      checksum: urlChecksum,
      isChecksumValid,
      hasEmail: !!(managerEmail || clientEmail),
      isFromUrl,
      rawParams: hashParams,
    });

    setIsLoading(false);
  }, [jobId]);

  // Manual email setter for fallback UI
  const setManagerEmail = useCallback((email: string) => {
    if (!email.trim()) return;

    localStorage.setItem(STORAGE_KEYS.MANAGER_EMAIL, email.trim());
    if (jobId) {
      localStorage.setItem(STORAGE_KEYS.JOB_ID, jobId);
    }

    setData(prev => ({
      ...prev,
      managerEmail: email.trim(),
      hasEmail: true,
    }));

    console.log('[useHandshake] Manager email set manually:', email.trim());
  }, [jobId]);

  // Clear all handshake data
  const clearHandshake = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.MANAGER_EMAIL);
    localStorage.removeItem(STORAGE_KEYS.CLIENT_EMAIL);
    localStorage.removeItem(STORAGE_KEYS.JOB_ID);
    localStorage.removeItem(STORAGE_KEYS.JOB_TITLE);
    localStorage.removeItem(STORAGE_KEYS.CHECKSUM_VALIDATED);

    setData({
      managerEmail: null,
      clientEmail: null,
      checksum: null,
      isChecksumValid: false,
      hasEmail: false,
      isFromUrl: false,
      rawParams: new URLSearchParams(),
    });

    console.log('[useHandshake] Handshake data cleared');
  }, []);

  // Persist current data to localStorage
  const persistHandshake = useCallback(() => {
    if (data.managerEmail) {
      localStorage.setItem(STORAGE_KEYS.MANAGER_EMAIL, data.managerEmail);
    }
    if (data.clientEmail) {
      localStorage.setItem(STORAGE_KEYS.CLIENT_EMAIL, data.clientEmail);
    }
    if (jobId) {
      localStorage.setItem(STORAGE_KEYS.JOB_ID, jobId);
    }

    console.log('[useHandshake] Handshake data persisted');
  }, [data, jobId]);

  return {
    data,
    isLoading,
    setManagerEmail,
    clearHandshake,
    persistHandshake,
  };
}

export default useHandshake;
