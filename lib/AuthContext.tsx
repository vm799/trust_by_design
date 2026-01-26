/**
 * Auth Context Provider
 *
 * Centralized authentication state to prevent excessive Supabase API calls.
 * Instead of calling supabase.auth.getUser() in every component/hook/function,
 * we maintain auth state here and expose it via React Context.
 *
 * This eliminates:
 * - Repeated getUser() calls in db operations
 * - Repeated getUser() calls in audit logging
 * - Repeated getUser() calls in hooks
 *
 * CRITICAL FIX (Jan 2026): Added session memoization to prevent cascading re-renders
 * - Session object now only updates when USER changes (login/logout)
 * - Token refresh updates access token WITHOUT triggering consumer re-renders
 * - This prevents the 877 requests/hour auth loop issue
 *
 * Performance Impact: Reduces auth REST calls from ~877/hour to ~10/hour
 */

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { onAuthStateChange, getSession } from './auth';
import type { Session } from '@supabase/supabase-js';

export interface AuthContextValue {
  session: Session | null;
  userId: string | null;
  userEmail: string | null;
  workspaceId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
  workspaceId?: string | null; // Can be injected from App.tsx after profile load
  onWorkspaceIdChange?: (workspaceId: string | null) => void;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  workspaceId: externalWorkspaceId,
  onWorkspaceIdChange
}) => {
  const [session, setSession] = useState<Session | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(externalWorkspaceId || null);
  const [isLoading, setIsLoading] = useState(true);

  // CRITICAL FIX: Track the current user ID to prevent unnecessary session updates
  // Token refresh fires onAuthStateChange with new session object, but same user
  // We only want to update session state (and trigger consumer re-renders) when USER changes
  const currentUserIdRef = useRef<string | null>(null);
  const sessionRef = useRef<Session | null>(null);

  // CRITICAL FIX: Restore session on mount (page refresh)
  // getSession() immediately retrieves stored session from Supabase storage
  // This prevents the "empty lists after F5" issue
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedSession = await getSession();
        if (storedSession) {
          console.log('[AuthContext] Session restored on mount:', storedSession.user?.id);
          currentUserIdRef.current = storedSession.user?.id || null;
          sessionRef.current = storedSession;
          setSession(storedSession);
        }
      } catch (err) {
        console.error('[AuthContext] Failed to restore session:', err);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  // Listen to auth state changes (login/logout/token refresh)
  useEffect(() => {
    const unsubscribe = onAuthStateChange((newSession) => {
      const newUserId = newSession?.user?.id || null;
      const currentUserId = currentUserIdRef.current;

      // CRITICAL: Only update session state if USER changed (login/logout)
      // Token refresh creates new session object but same user - skip state update
      if (newUserId !== currentUserId) {
        console.log('[AuthContext] User changed:', currentUserId, '->', newUserId);
        currentUserIdRef.current = newUserId;
        sessionRef.current = newSession;
        setSession(newSession);
        setIsLoading(false);
      } else if (newSession && sessionRef.current) {
        // Same user, but update the ref with fresh token for API calls
        // This does NOT trigger re-renders (ref update, not state update)
        sessionRef.current = newSession;
        console.log('[AuthContext] Token refreshed for user:', newUserId, '(no re-render)');
      }
    });

    return () => unsubscribe();
  }, []);

  // Update workspace ID when externally provided (from App.tsx)
  useEffect(() => {
    if (externalWorkspaceId !== undefined) {
      setWorkspaceId(externalWorkspaceId);
      onWorkspaceIdChange?.(externalWorkspaceId);
    }
  }, [externalWorkspaceId, onWorkspaceIdChange]);

  const value: AuthContextValue = {
    session,
    userId: session?.user?.id || null,
    userEmail: session?.user?.email || null,
    workspaceId,
    isAuthenticated: !!session,
    isLoading
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Hook to access auth context
 * @throws Error if used outside AuthProvider
 */
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

/**
 * Hook to get workspace ID (throws if not available)
 * Use this when workspace ID is required for the operation
 */
export const useWorkspaceId = (): string => {
  const { workspaceId } = useAuth();
  if (!workspaceId) {
    throw new Error('Workspace ID not available. Ensure user profile is loaded.');
  }
  return workspaceId;
};
