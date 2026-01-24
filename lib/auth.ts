/**
 * Authentication Helper Functions
 * Phase C.1 - Real Authentication
 * PATH A - Secure OAuth redirects with allowlist
 */

import { getSupabase } from './supabase';
import { getAuthRedirectUrl } from './redirects';
import { generateSecureSlugSuffix } from './secureId';
import { clearEncryptionKey } from './encryption';
import type { User, Session, AuthError } from '@supabase/supabase-js';

export interface AuthResult {
  success: boolean;
  user?: User;
  session?: Session;
  error?: AuthError | Error;
  rateLimited?: boolean;
  retryAfter?: number; // seconds until retry
}

/**
 * Rate limiting detection and handling
 * Supabase returns 429 status for rate limiting
 */
const RATE_LIMIT_PATTERNS = [
  'rate limit',
  'too many requests',
  'exceeded',
  '429',
  'email rate limit',
  'request rate limit'
];

function isRateLimitError(error: AuthError | Error | unknown): boolean {
  if (!error) return false;

  const errorMessage = String((error as Error)?.message || '').toLowerCase();
  const errorStatus = (error as { status?: number })?.status;

  // Check HTTP status
  if (errorStatus === 429) return true;

  // Check error message patterns
  return RATE_LIMIT_PATTERNS.some(pattern =>
    errorMessage.includes(pattern.toLowerCase())
  );
}

function getRetryAfter(error: AuthError | Error | unknown): number {
  // Default retry time: 60 seconds
  const DEFAULT_RETRY = 60;

  if (!error) return DEFAULT_RETRY;

  // Check for Retry-After header value in error
  const retryAfter = (error as { retryAfter?: number })?.retryAfter;
  if (typeof retryAfter === 'number' && retryAfter > 0) {
    return Math.min(retryAfter, 300); // Cap at 5 minutes
  }

  return DEFAULT_RETRY;
}

function enhanceWithRateLimitInfo(result: AuthResult): AuthResult {
  if (result.error && isRateLimitError(result.error)) {
    return {
      ...result,
      rateLimited: true,
      retryAfter: getRetryAfter(result.error),
      error: new Error('Too many requests. Please wait before trying again.')
    };
  }
  return result;
}

// CRITICAL FIX: Profile cache to prevent repeated fetches
// This reduces 3 queries per profile load when navigating between routes
interface ProfileCache {
  data: any;
  timestamp: number;
  userId: string;
}
let profileCache: ProfileCache | null = null;
let profileFetchPromise: Promise<any> | null = null;
const PROFILE_CACHE_TTL = 60000; // 60 seconds

export interface SignUpData {
  email: string;
  password: string;
  workspaceName: string;
  fullName?: string;
}

/**
 * Sign up new user with workspace creation
 */
export const signUp = async (data: SignUpData): Promise<AuthResult> => {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      success: false,
      error: new Error('Supabase not configured')
    };
  }

  try {
    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: getAuthRedirectUrl('/#/'), // HashRouter: route through PersonaRedirect
        data: {
          full_name: data.fullName,
          workspace_name: data.workspaceName
        }
      }
    });

    if (authError) {
      return enhanceWithRateLimitInfo({ success: false, error: authError });
    }

    if (!authData.user) {
      return {
        success: false,
        error: new Error('User creation failed')
      };
    }

    // 2. Create workspace and user profile
    const workspaceSlug = data.workspaceName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const finalSlug = `${workspaceSlug}-${generateSecureSlugSuffix()}`;

    // Use a small delay to ensure auth.users record is fully available if needed
    // though RPC should handle it if called with a valid user id
    const { error: workspaceError } = await supabase.rpc('create_workspace_with_owner', {
      p_user_id: authData.user.id,
      p_email: data.email,
      p_workspace_name: data.workspaceName,
      p_workspace_slug: finalSlug,
      p_full_name: data.fullName || null
    });

    if (workspaceError) {
      console.error('Workspace creation failed:', workspaceError);

      // Even if workspace creation fails, we return success if user was created
      // The app will handle the missing profile on next login
      return {
        success: true,
        user: authData.user,
        session: authData.session || undefined
      };
    }

    return {
      success: true,
      user: authData.user,
      session: authData.session || undefined
    };
  } catch (error) {
    return enhanceWithRateLimitInfo({
      success: false,
      error: error as Error
    });
  }
};

/**
 * Sign in existing user
 */
export const signIn = async (email: string, password: string): Promise<AuthResult> => {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      success: false,
      error: new Error('Supabase not configured')
    };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return enhanceWithRateLimitInfo({ success: false, error });
    }

    // Update last_sign_in_at
    if (data.user) {
      await supabase
        .from('users')
        .update({ last_sign_in_at: new Date().toISOString() })
        .eq('id', data.user.id);
    }

    return {
      success: true,
      user: data.user,
      session: data.session
    };
  } catch (error) {
    return enhanceWithRateLimitInfo({
      success: false,
      error: error as Error
    });
  }
};

/**
 * V1 MVP: Sign in with Magic Link
 *
 * This is the PRIMARY authentication method for V1.
 * NO passwords, NO Google OAuth - Magic Link only.
 *
 * Phase 6.5: Updated to use dedicated /auth/callback route
 * This ensures proper session establishment before dashboard redirect.
 *
 * @param email - User's email address
 * @param signupData - Optional workspace data for signup flow
 */
export const signInWithMagicLink = async (
  email: string,
  signupData?: { workspaceName?: string; fullName?: string }
): Promise<AuthResult> => {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: new Error('Supabase not configured') };

  // Phase 6.5: Use dedicated callback route for proper session handling
  // The callback route waits for session establishment before redirecting
  let redirectUrl = getAuthRedirectUrl('/#/auth/callback');

  // For signup, include workspace data as query params
  if (signupData?.workspaceName) {
    const params = new URLSearchParams();
    params.set('workspace', signupData.workspaceName);
    if (signupData.fullName) params.set('name', signupData.fullName);
    params.set('signup', 'true');
    redirectUrl = getAuthRedirectUrl(`/#/auth/callback?${params.toString()}`);
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectUrl,
    },
  });

  if (error) return { success: false, error };
  return { success: true };
};

/**
 * Sign in with Google OAuth
 *
 * @deprecated V2 FEATURE ONLY - Not used in V1 MVP
 * V1 uses Magic Link authentication exclusively.
 * This function is preserved for V2 implementation.
 *
 * DO NOT USE IN V1 - Magic Link only
 */
export const signInWithGoogle = async (): Promise<AuthResult> => {
  // V1 MVP: Block Google OAuth
  console.warn('[Auth] signInWithGoogle is disabled in V1 MVP. Use signInWithMagicLink instead.');
  return {
    success: false,
    error: new Error('Google OAuth is not available in V1. Please use Magic Link authentication.')
  };

  // V2 Implementation (preserved for reference)
  /*
  const supabase = getSupabase();
  if (!supabase) {
    return {
      success: false,
      error: new Error('Supabase not configured')
    };
  }

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getAuthRedirectUrl()
      }
    });

    if (error) {
      return { success: false, error };
    }

    // OAuth redirects, so we don't get user/session here
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error as Error
    };
  }
  */
};

/**
 * Secure session cleanup - removes all sensitive data
 * Call this on logout to ensure no sensitive data persists
 */
export const secureCleanup = (): void => {
  // Clear encryption keys from memory
  clearEncryptionKey();

  // Clear profile cache
  profileCache = null;
  profileFetchPromise = null;

  // Clear sensitive localStorage items
  const sensitiveKeys = [
    'jobproof_user_v2',
    'jobproof_onboarding_v4',
    'jobproof_magic_links',
    'sb-auth-token', // Supabase auth token
  ];
  sensitiveKeys.forEach(key => localStorage.removeItem(key));

  // Clear all session storage (includes session entropy for encryption)
  sessionStorage.clear();

  // Clear any in-memory caches in other modules
  try {
    // Clear auth flow manager cache if available
    const { clearCache } = require('./authFlowManager');
    if (typeof clearCache === 'function') {
      clearCache();
    }
  } catch {
    // Module may not be loaded
  }
};

/**
 * Sign out current user
 */
export const signOut = async (): Promise<AuthResult> => {
  // Always perform secure cleanup, even if supabase fails
  secureCleanup();

  const supabase = getSupabase();
  if (!supabase) {
    return { success: true }; // Already offline-only mode
  }

  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.warn('[Auth] Supabase signOut error:', error);
      // Still return success since we've cleared local data
      return { success: true };
    }

    return { success: true };
  } catch (error) {
    console.warn('[Auth] signOut exception:', error);
    // Still return success since we've cleared local data
    return { success: true };
  }
};

/**
 * Get current session
 */
export const getSession = async (): Promise<Session | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const { data } = await supabase.auth.getSession();
    return data.session;
  } catch (error) {
    console.error('Failed to get session:', error);
    return null;
  }
};

/**
 * Get current user
 */
export const getCurrentUser = async (): Promise<User | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const { data } = await supabase.auth.getUser();
    return data.user;
  } catch (error) {
    console.error('Failed to get user:', error);
    return null;
  }
};

/**
 * Get user profile with workspace info
 *
 * CRITICAL FIX (Jan 2026): Added caching and request deduplication
 * - Caches profile for 60 seconds to prevent repeated fetches
 * - Deduplicates concurrent requests using in-flight promise
 * - Reduces 3 API calls per navigation to 0 when cache is warm
 */
export const getUserProfile = async (userId: string) => {
  const supabase = getSupabase();
  if (!supabase) return null;

  // CRITICAL FIX: Return cached data if still valid
  if (profileCache && profileCache.userId === userId) {
    const age = Date.now() - profileCache.timestamp;
    if (age < PROFILE_CACHE_TTL) {
      console.log('[Auth] getUserProfile: returning cached profile (age:', Math.round(age / 1000), 's)');
      return profileCache.data;
    }
  }

  // CRITICAL FIX: Reuse in-flight promise to deduplicate concurrent requests
  if (profileFetchPromise) {
    console.log('[Auth] getUserProfile: reusing in-flight request');
    return profileFetchPromise;
  }

  // Create the fetch promise
  profileFetchPromise = (async () => {
    try {
      // Fetch user profile first
      // Use maybeSingle() instead of single() to avoid 406 error when user doesn't exist
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (userError) throw userError;
      if (!userData) return null;

      // Fetch workspace separately
      const { data: workspaceData } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', userData.workspace_id)
        .maybeSingle();

      // Fetch personas separately
      const { data: personasData } = await supabase
        .from('user_personas')
        .select('*')
        .eq('user_id', userId);

      // Combine results
      const profile = {
        ...userData,
        workspace: workspaceData || null,
        personas: personasData || []
      };

      // CRITICAL FIX: Cache the result
      profileCache = {
        data: profile,
        timestamp: Date.now(),
        userId
      };

      return profile;
    } catch (error) {
      console.error('Failed to get user profile:', error);
      return null;
    } finally {
      // Clear the in-flight promise
      profileFetchPromise = null;
    }
  })();

  return profileFetchPromise;
};

/**
 * Clear the profile cache (call when user logs out or profile changes)
 */
export const clearProfileCache = () => {
  profileCache = null;
  profileFetchPromise = null;
};

/**
 * Listen to auth state changes
 */
export const onAuthStateChange = (callback: (session: Session | null) => void) => {
  const supabase = getSupabase();
  if (!supabase) {
    // Call callback immediately with null if Supabase is missing to avoid loading hang
    callback(null);
    return () => { };
  }

  const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });

  return () => {
    subscription.subscription.unsubscribe();
  };
};

/**
 * Request password reset email
 */
export const requestPasswordReset = async (email: string): Promise<AuthResult> => {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      success: false,
      error: new Error('Supabase not configured')
    };
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthRedirectUrl('/#/auth/reset-password')
    });

    if (error) {
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error as Error
    };
  }
};

/**
 * Update password
 */
export const updatePassword = async (newPassword: string): Promise<AuthResult> => {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      success: false,
      error: new Error('Supabase not configured')
    };
  }

  try {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      return { success: false, error };
    }

    return {
      success: true,
      user: data.user
    };
  } catch (error) {
    return {
      success: false,
      error: error as Error
    };
  }
};

// REMEDIATION ITEM 13: Re-export getSupabase for modules that lazy-load auth
// This allows getting supabase client through auth module without separate import
export { getSupabase as getSupabaseClient } from './supabase';
