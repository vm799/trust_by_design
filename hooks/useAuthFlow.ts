/**
 * React Hook: useAuthFlow
 * ========================
 *
 * A React hook that provides reactive auth state management using the AuthFlowManager.
 *
 * Usage:
 *   const { isLoading, isAuthenticated, user, session, error, needsSetup, refresh } = useAuthFlow();
 *
 * This hook automatically:
 * - Initializes auth flow on mount
 * - Listens for auth state changes
 * - Ensures user row exists in database
 * - Fetches complete profile safely (no 406 errors)
 * - Handles all errors gracefully
 * - Prevents circular redirects with proper state management
 *
 * CRITICAL FIX (Jan 2026): Fixed double initialization bug
 * - Previous: init() + onAuthFlowChange() both called initializeAuthFlow() = 8-10 API calls
 * - Now: Single initialization via onAuthFlowChange listener = 4-5 API calls
 * - Empty dependency array ensures effect runs only once
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { authFlowManager, type AuthFlowResult, type AuthFlowUser } from '../lib/authFlowManager';
import type { Session } from '@supabase/supabase-js';

export interface UseAuthFlowResult {
  // Loading state
  isLoading: boolean;

  // Auth state
  isAuthenticated: boolean;
  session: Session | null;
  user: AuthFlowUser | null;

  // Error state
  error: AuthFlowResult['error'] | null;

  // Setup state
  needsSetup: boolean;

  // Actions
  refresh: () => Promise<void>;
}

export function useAuthFlow(): UseAuthFlowResult {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthFlowUser | null>(null);
  const [error, setError] = useState<AuthFlowResult['error'] | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);

  // CRITICAL FIX: Track if we've received initial state to prevent double initialization
  const hasInitializedRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);

  /**
   * Handle auth flow result and update state
   * CRITICAL: Only update if user actually changed to prevent cascading re-renders
   */
  const handleAuthFlowResult = useCallback((result: AuthFlowResult) => {
    const newUserId = result.session?.user?.id || null;

    // Skip update if same user (prevents token refresh from triggering full re-render)
    if (hasInitializedRef.current && newUserId === currentUserIdRef.current) {
      console.log('[useAuthFlow] Token refresh detected, skipping state update for user:', newUserId);
      return;
    }

    console.log('[useAuthFlow] Auth flow result:', {
      success: result.success,
      hasSession: !!result.session,
      hasUser: !!result.user,
      needsSetup: result.needsSetup,
      error: result.error,
      userChanged: newUserId !== currentUserIdRef.current,
    });

    currentUserIdRef.current = newUserId;
    hasInitializedRef.current = true;
    setSession(result.session);
    setUser(result.user);
    setError(result.error || null);
    setNeedsSetup(result.needsSetup || false);
    setIsLoading(false);
  }, []);

  /**
   * Refresh auth flow manually
   */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    // Force refresh by resetting the user ID ref
    currentUserIdRef.current = null;
    const result = await authFlowManager.refreshAuthFlow();
    handleAuthFlowResult(result);
  }, [handleAuthFlowResult]);

  /**
   * Initialize auth flow on mount and listen for changes
   * CRITICAL FIX: Single initialization path to prevent double API calls
   */
  useEffect(() => {
    let isMounted = true;

    // CRITICAL FIX: onAuthFlowChange triggers initializeAuthFlow internally,
    // so we DON'T need a separate init() call. This was causing double initialization.
    // The listener fires immediately with the current auth state.

    // Listen for auth state changes (fires immediately with current state)
    const unsubscribe = authFlowManager.onAuthFlowChange((result) => {
      if (isMounted) {
        handleAuthFlowResult(result);
      }
    });

    // Safety timeout: If listener doesn't fire within 2s, trigger manual init
    // This handles edge cases where Supabase client isn't configured
    const timeoutId = setTimeout(() => {
      if (isMounted && !hasInitializedRef.current) {
        console.log('[useAuthFlow] Listener timeout, triggering manual init');
        authFlowManager.initializeAuthFlow().then((result) => {
          if (isMounted && !hasInitializedRef.current) {
            handleAuthFlowResult(result);
          }
        });
      }
    }, 2000);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, []); // CRITICAL: Empty dependency array - run only once on mount

  return {
    isLoading,
    isAuthenticated: !!session && !!user,
    session,
    user,
    error,
    needsSetup,
    refresh,
  };
}
