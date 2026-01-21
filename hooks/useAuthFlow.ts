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
 */

import { useState, useEffect, useCallback } from 'react';
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

  /**
   * Handle auth flow result and update state
   */
  const handleAuthFlowResult = useCallback((result: AuthFlowResult) => {
    console.log('[useAuthFlow] Auth flow result:', {
      success: result.success,
      hasSession: !!result.session,
      hasUser: !!result.user,
      needsSetup: result.needsSetup,
      error: result.error,
    });

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
    const result = await authFlowManager.refreshAuthFlow();
    handleAuthFlowResult(result);
  }, [handleAuthFlowResult]);

  /**
   * Initialize auth flow on mount and listen for changes
   */
  useEffect(() => {
    let isMounted = true;

    // Initialize auth flow
    const init = async () => {
      const result = await authFlowManager.initializeAuthFlow();
      if (isMounted) {
        handleAuthFlowResult(result);
      }
    };

    init();

    // Listen for auth state changes
    const unsubscribe = authFlowManager.onAuthFlowChange((result) => {
      if (isMounted) {
        handleAuthFlowResult(result);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [handleAuthFlowResult]);

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
