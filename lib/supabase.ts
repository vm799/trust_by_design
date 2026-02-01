/**
 * Supabase Client Configuration
 *
 * Provides singleton client instance for database and storage operations.
 * Uses environment variables for secure credential management.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logConflict, isConflictError } from './conflictTelemetry';

// Environment variables (you'll add these to .env)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Singleton client instance
let supabase: SupabaseClient | null = null;

// P1-2: Retry configuration for uploads (shorter window - user is waiting)
const UPLOAD_RETRY_DELAYS = [1000, 2000, 4000]; // 1s, 2s, 4s
const MAX_UPLOAD_RETRIES = 3;

/**
 * P1-2: Retry wrapper with exponential backoff
 * Used for photo/signature uploads where user is actively waiting
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = MAX_UPLOAD_RETRIES,
  delays: number[] = UPLOAD_RETRY_DELAYS
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = delays[Math.min(attempt, delays.length - 1)];
        console.warn(`[${operationName}] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`, lastError.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`[${operationName}] All ${maxRetries + 1} attempts failed`);
  throw lastError;
}

/**
 * Get or create Supabase client instance
 */
export const getSupabase = (): SupabaseClient | null => {
  // Return null if credentials not configured (graceful degradation to offline-only mode)
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials not configured. Running in offline-only mode.');
    return null;
  }

  // Create singleton instance
  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true, // Phase C.1: Real authentication with sessions
        autoRefreshToken: true,
        detectSessionInUrl: true, // CRITICAL FIX: Enable magic link session detection
        storage: window.localStorage
      },
      db: {
        schema: 'public'
      },
      global: {
        headers: {
          'x-application': 'jobproof-v2'
        }
      }
    });
  }

  return supabase;
};

/**
 * Check if Supabase is configured and available
 */
export const isSupabaseAvailable = (): boolean => {
  return !!supabaseUrl && !!supabaseAnonKey;
};

/**
 * Upload photo to Supabase Storage
 * P1-2: Now with retry + exponential backoff for transient failures
 * @param jobId - Job identifier
 * @param photoId - Photo identifier
 * @param dataUrl - Base64 data URL
 * @returns Public URL of uploaded photo
 */
export const uploadPhoto = async (
  jobId: string,
  photoId: string,
  dataUrl: string
): Promise<string | null> => {
  const client = getSupabase();
  if (!client) return null;

  try {
    // Convert base64 to blob (outside retry - no network involved)
    const base64Data = dataUrl.split(',')[1];
    const mimeType = dataUrl.match(/data:([^;]+);/)?.[1] || 'image/jpeg';
    const blob = await fetch(`data:${mimeType};base64,${base64Data}`).then(r => r.blob());

    const filePath = `${jobId}/${photoId}.jpg`;

    // P1-2: Retry the actual upload with exponential backoff
    await withRetry(async () => {
      const { error } = await client.storage
        .from('job-photos')
        .upload(filePath, blob, {
          contentType: mimeType,
          upsert: true
        });

      if (error) throw error;
    }, `uploadPhoto(${photoId})`);

    // Get public URL (no retry needed - local operation)
    const { data: urlData } = client.storage
      .from('job-photos')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Photo upload failed after all retries:', error);

    // P1-1a: Log conflict telemetry
    if (isConflictError(error)) {
      logConflict(
        'PHOTO_ALREADY_EXISTS',
        'photo',
        photoId,
        'RETRY_FAILED',
        {
          jobId,
          errorMessage: error instanceof Error ? error.message : String(error),
          retryCount: MAX_UPLOAD_RETRIES,
        }
      );
    }

    return null;
  }
};

/**
 * Upload signature to Supabase Storage
 * P1-2: Now with retry + exponential backoff for transient failures
 * @param jobId - Job identifier
 * @param dataUrl - Base64 data URL of signature
 * @returns Public URL of uploaded signature
 */
export const uploadSignature = async (
  jobId: string,
  dataUrl: string
): Promise<string | null> => {
  const client = getSupabase();
  if (!client) return null;

  try {
    // Convert base64 to blob (outside retry - no network involved)
    const base64Data = dataUrl.split(',')[1];
    const blob = await fetch(`data:image/png;base64,${base64Data}`).then(r => r.blob());

    const filePath = `${jobId}/signature.png`;

    // P1-2: Retry the actual upload with exponential backoff
    await withRetry(async () => {
      const { error } = await client.storage
        .from('job-signatures')
        .upload(filePath, blob, {
          contentType: 'image/png',
          upsert: true
        });

      if (error) throw error;
    }, `uploadSignature(${jobId})`);

    // Get public URL (no retry needed - local operation)
    const { data: urlData } = client.storage
      .from('job-signatures')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Signature upload failed after all retries:', error);

    // P1-1a: Log conflict telemetry
    if (isConflictError(error)) {
      logConflict(
        'SIGNATURE_ALREADY_EXISTS',
        'signature',
        jobId,
        'RETRY_FAILED',
        {
          jobId,
          errorMessage: error instanceof Error ? error.message : String(error),
          retryCount: MAX_UPLOAD_RETRIES,
        }
      );
    }

    return null;
  }
};

export default getSupabase;
