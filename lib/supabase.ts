/**
 * Supabase Client Configuration
 *
 * Provides singleton client instance for database and storage operations.
 * Uses environment variables for secure credential management.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables (you'll add these to .env)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Singleton client instance
let supabase: SupabaseClient | null = null;

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
    // Convert base64 to blob
    const base64Data = dataUrl.split(',')[1];
    const mimeType = dataUrl.match(/data:([^;]+);/)?.[1] || 'image/jpeg';
    const blob = await fetch(`data:${mimeType};base64,${base64Data}`).then(r => r.blob());

    // Upload to storage bucket
    const filePath = `${jobId}/${photoId}.jpg`;
    const { data, error } = await client.storage
      .from('job-photos')
      .upload(filePath, blob, {
        contentType: mimeType,
        upsert: true
      });

    if (error) throw error;

    // Get public URL
    const { data: urlData } = client.storage
      .from('job-photos')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Photo upload failed:', error);
    return null;
  }
};

/**
 * Upload signature to Supabase Storage
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
    const base64Data = dataUrl.split(',')[1];
    const blob = await fetch(`data:image/png;base64,${base64Data}`).then(r => r.blob());

    const filePath = `${jobId}/signature.png`;
    const { data, error } = await client.storage
      .from('job-signatures')
      .upload(filePath, blob, {
        contentType: 'image/png',
        upsert: true
      });

    if (error) throw error;

    const { data: urlData } = client.storage
      .from('job-signatures')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Signature upload failed:', error);
    return null;
  }
};

export default getSupabase;
