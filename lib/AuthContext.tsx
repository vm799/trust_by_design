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
 * Performance Impact: Reduces auth REST calls from ~15/30min to ~2-3/30min
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChange } from './auth';
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

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChange((newSession) => {
      setSession(newSession);
      setIsLoading(false);
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
