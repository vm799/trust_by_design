/**
 * Authentication Helper Functions
 * Phase C.1 - Real Authentication
 */

import { getSupabase } from './supabase';
import type { User, Session, AuthError } from '@supabase/supabase-js';

export interface AuthResult {
  success: boolean;
  user?: User;
  session?: Session;
  error?: AuthError | Error;
}

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
        emailRedirectTo: `${window.location.origin}/#/admin`,
        data: {
          full_name: data.fullName,
          workspace_name: data.workspaceName
        }
      }
    });

    if (authError) {
      return { success: false, error: authError };
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

    const finalSlug = `${workspaceSlug}-${Math.random().toString(36).substring(2, 7)}`;

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
    return {
      success: false,
      error: error as Error
    };
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
      return { success: false, error };
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
    return {
      success: false,
      error: error as Error
    };
  }
};

/**
 * Sign in with Magic Link
 */
export const signInWithMagicLink = async (email: string): Promise<AuthResult> => {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: new Error('Supabase not configured') };

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/#/admin`,
    },
  });

  if (error) return { success: false, error };
  return { success: true };
};

/**
 * Sign in with Google OAuth
 */
export const signInWithGoogle = async (): Promise<AuthResult> => {
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
        redirectTo: window.location.origin
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
};

/**
 * Sign out current user
 */
export const signOut = async (): Promise<AuthResult> => {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: true }; // Already offline-only mode
  }

  try {
    const { error } = await supabase.auth.signOut();

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
 */
export const getUserProfile = async (userId: string) => {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        workspace:workspaces(*),
        personas:user_personas(*)
      `)
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to get user profile:', error);
    return null;
  }
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
      redirectTo: `${window.location.origin}/#/auth/reset-password`
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
