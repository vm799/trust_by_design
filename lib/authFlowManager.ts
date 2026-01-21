/**
 * Auth Flow Manager - Comprehensive Sign-In Flow Handler
 * ===========================================================
 *
 * This module implements a robust authentication flow that:
 * 1. Prevents circular redirects when new users land on the page
 * 2. Ensures the `users` table row exists for every authenticated user
 * 3. Fetches user profile, workspace, and personas safely without 406 errors
 * 4. Maintains RLS and workspace policies
 * 5. Returns proper single-user JSON object for the frontend
 *
 * SUBAGENT ARCHITECTURE:
 * - AuthSubagent: Manages Supabase Auth session state
 * - UserSubagent: Ensures user row exists in users table
 * - WorkspaceSubagent: Fetches workspace and personas safely
 * - ErrorSubagent: Handles all errors gracefully without throwing
 */

import { getSupabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';

// ============================================================================
// TYPES
// ============================================================================

export interface AuthFlowResult {
  success: boolean;
  session: Session | null;
  user: AuthFlowUser | null;
  error?: AuthFlowError;
  needsSetup?: boolean; // If true, redirect to /auth/setup
}

export interface AuthFlowUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  identity_level: string;
  workspace_id: string | null;
  workspace: {
    id: string;
    name: string;
    slug: string;
    subscription_tier: string;
    subscription_status: string;
  } | null;
  personas: Array<{
    id: string;
    persona_type: string;
    is_active: boolean;
    is_complete: boolean;
    current_step: string | null;
  }>;
}

export interface AuthFlowError {
  code: string;
  message: string;
  details?: any;
}

// ============================================================================
// SUBAGENT: AuthSubagent
// ============================================================================
// Responsibility: Handle Supabase Auth session management
// Does NOT handle user profile creation or fetching

class AuthSubagent {
  /**
   * Get current auth session
   * Returns null if no session (user not logged in)
   */
  async getSession(): Promise<{ session: Session | null; error: AuthFlowError | null }> {
    const supabase = getSupabase();
    if (!supabase) {
      return {
        session: null,
        error: {
          code: 'SUPABASE_NOT_CONFIGURED',
          message: 'Supabase client not initialized',
        },
      };
    }

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        return {
          session: null,
          error: {
            code: 'AUTH_SESSION_ERROR',
            message: error.message,
            details: error,
          },
        };
      }

      return { session: data.session, error: null };
    } catch (err) {
      return {
        session: null,
        error: {
          code: 'AUTH_EXCEPTION',
          message: err instanceof Error ? err.message : 'Unknown auth error',
          details: err,
        },
      };
    }
  }

  /**
   * Listen to auth state changes
   * Callback receives session or null
   */
  onAuthStateChange(callback: (session: Session | null) => void): () => void {
    const supabase = getSupabase();
    if (!supabase) {
      // Immediately call with null to prevent loading hang
      callback(null);
      return () => {};
    }

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }
}

// ============================================================================
// SUBAGENT: UserSubagent
// ============================================================================
// Responsibility: Ensure user row exists in users table
// Handles auto-healing for OAuth users or missing profiles

class UserSubagent {
  /**
   * Check if user exists in users table
   * Returns true if exists, false otherwise
   * Does NOT throw on error - returns false instead
   */
  async userExists(userId: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single();

      // If error code is PGRST116 (no rows), user doesn't exist
      if (error && error.code === 'PGRST116') {
        return false;
      }

      // If other error, log and return false
      if (error) {
        console.error('[UserSubagent] Error checking user existence:', error);
        return false;
      }

      return !!data;
    } catch (err) {
      console.error('[UserSubagent] Exception checking user existence:', err);
      return false;
    }
  }

  /**
   * Create user row in users table
   * Uses the create_workspace_with_owner RPC to ensure atomic creation
   * Returns true if successful, false otherwise
   */
  async createUser(authUser: User, workspaceName?: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;

    try {
      // Generate workspace slug
      const name = workspaceName || authUser.user_metadata?.workspace_name || `${authUser.email}'s Workspace`;
      const workspaceSlug = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const finalSlug = `${workspaceSlug}-${Math.random().toString(36).substring(2, 7)}`;

      // Call RPC to create workspace and user atomically
      const { error } = await supabase.rpc('create_workspace_with_owner', {
        p_user_id: authUser.id,
        p_email: authUser.email || '',
        p_workspace_name: name,
        p_workspace_slug: finalSlug,
        p_full_name: authUser.user_metadata?.full_name || null,
      });

      if (error) {
        console.error('[UserSubagent] Failed to create user:', error);
        return false;
      }

      console.log('[UserSubagent] User created successfully:', authUser.id);
      return true;
    } catch (err) {
      console.error('[UserSubagent] Exception creating user:', err);
      return false;
    }
  }

  /**
   * Ensure user exists - check and create if needed
   * Returns true if user exists or was created, false if creation failed
   */
  async ensureUserExists(authUser: User, workspaceName?: string): Promise<boolean> {
    // First check if user exists
    const exists = await this.userExists(authUser.id);
    if (exists) {
      console.log('[UserSubagent] User already exists:', authUser.id);
      return true;
    }

    // User doesn't exist, create it
    console.log('[UserSubagent] User not found, creating:', authUser.id);
    return await this.createUser(authUser, workspaceName);
  }
}

// ============================================================================
// SUBAGENT: WorkspaceSubagent
// ============================================================================
// Responsibility: Fetch user profile, workspace, and personas safely
// Does NOT throw 406 errors - returns null instead

class WorkspaceSubagent {
  /**
   * Fetch user profile from users table
   * Returns null if not found or on error
   */
  async fetchUserProfile(userId: string): Promise<any | null> {
    const supabase = getSupabase();
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // If PGRST116 (no rows), user doesn't exist - return null
        if (error.code === 'PGRST116') {
          console.log('[WorkspaceSubagent] User profile not found:', userId);
          return null;
        }
        console.error('[WorkspaceSubagent] Error fetching user profile:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('[WorkspaceSubagent] Exception fetching user profile:', err);
      return null;
    }
  }

  /**
   * Fetch workspace by ID
   * Returns null if not found or on error
   * Handles case where workspace_id is null
   */
  async fetchWorkspace(workspaceId: string | null): Promise<any | null> {
    if (!workspaceId) {
      console.log('[WorkspaceSubagent] No workspace_id provided');
      return null;
    }

    const supabase = getSupabase();
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', workspaceId)
        .single();

      if (error) {
        // If PGRST116 (no rows), workspace doesn't exist - return null
        if (error.code === 'PGRST116') {
          console.log('[WorkspaceSubagent] Workspace not found:', workspaceId);
          return null;
        }
        console.error('[WorkspaceSubagent] Error fetching workspace:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('[WorkspaceSubagent] Exception fetching workspace:', err);
      return null;
    }
  }

  /**
   * Fetch user personas
   * Returns empty array if not found or on error
   */
  async fetchPersonas(userId: string): Promise<any[]> {
    const supabase = getSupabase();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('user_personas')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        console.error('[WorkspaceSubagent] Error fetching personas:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('[WorkspaceSubagent] Exception fetching personas:', err);
      return [];
    }
  }

  /**
   * Fetch complete user profile with workspace and personas
   * Returns AuthFlowUser or null if user not found
   * Does NOT throw 406 errors - handles all cases gracefully
   */
  async fetchCompleteProfile(userId: string): Promise<AuthFlowUser | null> {
    // Fetch user profile first
    const userProfile = await this.fetchUserProfile(userId);
    if (!userProfile) {
      return null;
    }

    // Fetch workspace separately (handles null workspace_id)
    const workspace = await this.fetchWorkspace(userProfile.workspace_id);

    // Fetch personas separately (returns empty array on error)
    const personas = await this.fetchPersonas(userId);

    // Combine results into AuthFlowUser
    return {
      id: userProfile.id,
      email: userProfile.email,
      full_name: userProfile.full_name,
      avatar_url: userProfile.avatar_url,
      role: userProfile.role,
      identity_level: userProfile.identity_level,
      workspace_id: userProfile.workspace_id,
      workspace,
      personas,
    };
  }
}

// ============================================================================
// SUBAGENT: ErrorSubagent
// ============================================================================
// Responsibility: Handle and categorize errors gracefully

class ErrorSubagent {
  /**
   * Create standardized error response
   */
  createError(code: string, message: string, details?: any): AuthFlowError {
    return { code, message, details };
  }

  /**
   * Handle Supabase error and convert to AuthFlowError
   */
  handleSupabaseError(error: any): AuthFlowError {
    if (error.code === 'PGRST116') {
      return this.createError('NOT_FOUND', 'Resource not found', error);
    }
    if (error.code === 'PGRST301') {
      return this.createError('RLS_VIOLATION', 'Row level security violation', error);
    }
    if (error.code === '42883') {
      return this.createError('FUNCTION_NOT_FOUND', 'Database function not found', error);
    }
    return this.createError('DATABASE_ERROR', error.message || 'Database error', error);
  }

  /**
   * Log error with context
   */
  logError(context: string, error: any): void {
    console.error(`[ErrorSubagent] ${context}:`, error);
  }
}

// ============================================================================
// MAIN AUTH FLOW MANAGER
// ============================================================================
// Orchestrates all subagents to handle complete auth flow

export class AuthFlowManager {
  private authSubagent = new AuthSubagent();
  private userSubagent = new UserSubagent();
  private workspaceSubagent = new WorkspaceSubagent();
  private errorSubagent = new ErrorSubagent();

  /**
   * Initialize auth flow on page load
   * Returns complete auth state with user profile or error
   *
   * This is the main entry point for the landing page / sign-in flow
   */
  async initializeAuthFlow(): Promise<AuthFlowResult> {
    console.log('[AuthFlowManager] Initializing auth flow...');

    // STEP 1: Get current auth session (AuthSubagent)
    const { session, error: sessionError } = await this.authSubagent.getSession();

    if (sessionError) {
      this.errorSubagent.logError('Session fetch failed', sessionError);
      return {
        success: false,
        session: null,
        user: null,
        error: sessionError,
      };
    }

    // No session = user not logged in (this is OK, not an error)
    if (!session || !session.user) {
      console.log('[AuthFlowManager] No active session');
      return {
        success: true,
        session: null,
        user: null,
      };
    }

    console.log('[AuthFlowManager] Active session found for user:', session.user.id);

    // STEP 2: Ensure user row exists in users table (UserSubagent)
    const userCreated = await this.userSubagent.ensureUserExists(session.user);

    if (!userCreated) {
      // User creation failed - this means we need workspace setup
      console.log('[AuthFlowManager] User creation needed, redirect to setup');
      return {
        success: true,
        session,
        user: null,
        needsSetup: true,
      };
    }

    // STEP 3: Fetch complete user profile (WorkspaceSubagent)
    const userProfile = await this.workspaceSubagent.fetchCompleteProfile(session.user.id);

    if (!userProfile) {
      // Profile fetch failed after user was created - this shouldn't happen
      // but we handle it gracefully by requiring setup
      console.log('[AuthFlowManager] Profile fetch failed after user creation, needs setup');
      return {
        success: true,
        session,
        user: null,
        needsSetup: true,
      };
    }

    // STEP 4: Validate profile completeness
    if (!userProfile.workspace_id || !userProfile.workspace) {
      // User exists but workspace is missing - needs setup
      console.log('[AuthFlowManager] User missing workspace, needs setup');
      return {
        success: true,
        session,
        user: userProfile,
        needsSetup: true,
      };
    }

    // SUCCESS: Complete profile loaded
    console.log('[AuthFlowManager] Auth flow complete, user fully loaded');
    return {
      success: true,
      session,
      user: userProfile,
      needsSetup: false,
    };
  }

  /**
   * Listen to auth state changes and invoke callback with updated auth flow result
   * Use this in React components to reactively update auth state
   *
   * Returns unsubscribe function
   */
  onAuthFlowChange(callback: (result: AuthFlowResult) => void): () => void {
    return this.authSubagent.onAuthStateChange(async (session) => {
      if (!session) {
        // User logged out
        callback({
          success: true,
          session: null,
          user: null,
        });
        return;
      }

      // User logged in - run full flow
      const result = await this.initializeAuthFlow();
      callback(result);
    });
  }

  /**
   * Manually refresh auth flow (useful after user completes setup)
   */
  async refreshAuthFlow(): Promise<AuthFlowResult> {
    return await this.initializeAuthFlow();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================
// Export a singleton instance for easy use across the app

export const authFlowManager = new AuthFlowManager();
