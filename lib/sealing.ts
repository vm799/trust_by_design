/**
 * Evidence Sealing Library
 *
 * Provides client-side functions for cryptographic sealing and verification.
 * All cryptographic operations happen server-side via Supabase Edge Functions.
 *
 * Phase: C.3 - Cryptographic Sealing
 */

import { getSupabase } from './supabase';

// ============================================================================
// TYPES
// ============================================================================

export interface SealResult {
  success: boolean;
  evidenceHash?: string;
  signature?: string;
  sealedAt?: string;
  message?: string;
  error?: string;
}

export interface VerificationResult {
  success: boolean;
  isValid?: boolean;
  evidenceHash?: string;
  algorithm?: string;
  sealedAt?: string;
  sealedBy?: string;
  message?: string;
  error?: string;
  verification?: {
    hashMatch: boolean;
    signatureValid: boolean;
    timestamp: string;
  };
}

export interface SealStatus {
  isSealed: boolean;
  sealedAt?: string;
  sealedBy?: string;
  evidenceHash?: string;
  signature?: string;
  algorithm?: string;
}

// ============================================================================
// SEAL EVIDENCE
// ============================================================================

/**
 * Seal a job's evidence bundle
 *
 * This function calls the Supabase Edge Function which handles:
 * - Evidence bundle serialization (canonical JSON)
 * - SHA-256 hash computation
 * - Cryptographic signature (HMAC-SHA256 or RSA-2048)
 * - Database storage in evidence_seals table
 * - Updating job.sealed_at timestamp
 * - Invalidating magic link tokens
 *
 * @param jobId - UUID of the job to seal
 * @returns SealResult with hash, signature, and timestamp
 */
export const sealEvidence = async (jobId: string): Promise<SealResult> => {
  const supabase = getSupabase();

  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured - cannot seal evidence'
    };
  }

  try {
    // Check authentication
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return {
        success: false,
        error: 'Not authenticated - please log in to seal evidence'
      };
    }

    // Call Edge Function to perform server-side sealing
    const { data, error } = await supabase.functions.invoke('seal-evidence', {
      body: { jobId }
    });

    if (error) {
      console.error('Sealing Edge Function error:', error);
      return {
        success: false,
        error: error.message || 'Failed to seal evidence'
      };
    }

    if (!data || !data.success) {
      return {
        success: false,
        error: data?.error || 'Sealing failed'
      };
    }

    return {
      success: true,
      evidenceHash: data.evidenceHash,
      signature: data.signature,
      sealedAt: data.sealedAt,
      message: data.message || 'Evidence sealed successfully'
    };
  } catch (error) {
    console.error('Sealing error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during sealing'
    };
  }
};

// ============================================================================
// VERIFY EVIDENCE
// ============================================================================

/**
 * Verify a sealed job's integrity
 *
 * This function calls the Supabase Edge Function which:
 * - Fetches the seal from evidence_seals table
 * - Recalculates hash from stored evidence bundle
 * - Compares stored hash vs recalculated hash
 * - Verifies cryptographic signature
 * - Returns tamper status
 *
 * @param jobId - UUID of the job to verify
 * @returns VerificationResult with validity status and details
 */
export const verifyEvidence = async (jobId: string): Promise<VerificationResult> => {
  const supabase = getSupabase();

  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured - cannot verify evidence'
    };
  }

  try {
    // Call Edge Function to perform server-side verification
    const { data, error } = await supabase.functions.invoke('verify-evidence', {
      body: { jobId }
    });

    if (error) {
      console.error('Verification Edge Function error:', error);
      return {
        success: false,
        error: error.message || 'Failed to verify evidence'
      };
    }

    // Handle different verification results
    if (data.error === 'SEAL_NOT_FOUND') {
      return {
        success: true,
        isValid: false,
        message: 'This job has not been sealed yet',
        error: data.error
      };
    }

    if (data.error === 'HASH_MISMATCH') {
      return {
        success: true,
        isValid: false,
        evidenceHash: data.storedHash,
        message: 'Evidence has been tampered with - hash does not match',
        error: data.error,
        sealedAt: data.sealedAt,
        sealedBy: data.sealedBy
      };
    }

    if (data.error === 'INVALID_SIGNATURE') {
      return {
        success: true,
        isValid: false,
        message: 'Invalid signature - seal may be forged',
        error: data.error,
        sealedAt: data.sealedAt,
        sealedBy: data.sealedBy
      };
    }

    // Successful verification
    return {
      success: true,
      isValid: data.isValid,
      evidenceHash: data.evidenceHash,
      algorithm: data.algorithm,
      sealedAt: data.sealedAt,
      sealedBy: data.sealedBy,
      message: data.message,
      verification: data.verification
    };
  } catch (error) {
    console.error('Verification error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during verification'
    };
  }
};

// ============================================================================
// GET SEAL STATUS
// ============================================================================

/**
 * Get seal status for a job
 *
 * Calls the database function get_job_seal_status() to retrieve
 * seal metadata without performing verification.
 *
 * @param jobId - UUID of the job
 * @returns SealStatus with basic seal information
 */
export const getSealStatus = async (jobId: string): Promise<SealStatus> => {
  const supabase = getSupabase();

  if (!supabase) {
    return { isSealed: false };
  }

  try {
    const { data, error } = await supabase.rpc('get_job_seal_status', {
      p_job_id: jobId
    });

    if (error) {
      console.error('Failed to get seal status:', error);
      return { isSealed: false };
    }

    if (!data || data.length === 0) {
      return { isSealed: false };
    }

    const sealData = data[0];

    return {
      isSealed: sealData.is_sealed || false,
      sealedAt: sealData.sealed_at,
      sealedBy: sealData.sealed_by,
      evidenceHash: sealData.evidence_hash,
      signature: sealData.signature,
      algorithm: sealData.algorithm
    };
  } catch (error) {
    console.error('Error getting seal status:', error);
    return { isSealed: false };
  }
};

// ============================================================================
// CHECK IF JOB CAN BE SEALED
// ============================================================================

/**
 * Check if a job meets requirements for sealing
 *
 * Requirements:
 * - Job must have at least one photo
 * - Job must have a signature
 * - Job must not already be sealed
 *
 * @param job - Job object to check
 * @returns Object with canSeal boolean and reason if false
 */
export const canSealJob = (job: any): { canSeal: boolean; reason?: string } => {
  if (job.sealedAt) {
    return { canSeal: false, reason: 'Job is already sealed' };
  }

  if (!job.photos || job.photos.length === 0) {
    return { canSeal: false, reason: 'Job must have at least one photo' };
  }

  if (!job.signature) {
    return { canSeal: false, reason: 'Job must have a signature' };
  }

  if (!job.signerName) {
    return { canSeal: false, reason: 'Signature must have signer name' };
  }

  return { canSeal: true };
};

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Format evidence hash for display (truncated)
 *
 * @param hash - Full SHA-256 hash (64 hex characters)
 * @param length - Number of characters to show (default: 16)
 * @returns Truncated hash with ellipsis
 */
export const formatHash = (hash: string | undefined, length: number = 16): string => {
  if (!hash) return 'N/A';
  if (hash.length <= length) return hash;
  return `${hash.substring(0, length)}...`;
};

/**
 * Format seal timestamp for display
 *
 * @param timestamp - ISO timestamp string
 * @returns Formatted date and time
 */
export const formatSealDate = (timestamp: string | undefined): string => {
  if (!timestamp) return 'N/A';

  try {
    const date = new Date(timestamp);
    return date.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });
  } catch (error) {
    return timestamp;
  }
};

/**
 * Get seal status badge color
 *
 * @param isValid - Verification result
 * @returns Tailwind color class
 */
export const getSealBadgeColor = (isValid: boolean | undefined): string => {
  if (isValid === undefined) return 'bg-slate-500';
  return isValid ? 'bg-success' : 'bg-danger';
};

/**
 * Get seal status icon
 *
 * @param isValid - Verification result
 * @returns Material icon name
 */
export const getSealIcon = (isValid: boolean | undefined): string => {
  if (isValid === undefined) return 'pending';
  return isValid ? 'verified' : 'warning';
};
