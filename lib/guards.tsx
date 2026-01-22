/**
 * Route Guards
 *
 * Provides authentication and authorization guards for routes.
 *
 * Phase A: Foundation & App Shell
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

interface GuardProps {
  children: React.ReactNode;
}

/**
 * Requires authentication to access the route.
 * Redirects to /auth if not authenticated.
 */
export const RequireAuth: React.FC<GuardProps> = ({ children }) => {
  const { isAuthenticated, isLoading, userId } = useAuth();
  const location = useLocation();

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin size-8 border-2 border-primary/30 border-t-primary rounded-full" />
      </div>
    );
  }

  // Not authenticated - redirect to auth
  if (!isAuthenticated || !userId) {
    const redirectTo = location.pathname + location.search;
    return <Navigate to={`/auth?redirect=${encodeURIComponent(redirectTo)}`} replace />;
  }

  return <>{children}</>;
};

/**
 * Redirects authenticated users away from auth pages.
 * Used for login/signup pages.
 */
export const RequireGuest: React.FC<GuardProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin size-8 border-2 border-primary/30 border-t-primary rounded-full" />
      </div>
    );
  }

  // Authenticated - redirect to app or specified redirect
  if (isAuthenticated) {
    const params = new URLSearchParams(location.search);
    const redirectTo = params.get('redirect') || '/app';
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

/**
 * Auth Navigation State Machine
 *
 * Determines where to redirect users based on their auth state.
 */
export type AuthNavState =
  | 'LOADING'
  | 'UNAUTHENTICATED'
  | 'NEEDS_WORKSPACE'
  | 'NEEDS_ONBOARDING'
  | 'READY';

export interface AuthStateCheck {
  isLoading: boolean;
  isAuthenticated: boolean;
  hasWorkspace: boolean;
  hasOnboarding: boolean;
}

export function getAuthNavState(check: AuthStateCheck): AuthNavState {
  if (check.isLoading) return 'LOADING';
  if (!check.isAuthenticated) return 'UNAUTHENTICATED';
  if (!check.hasWorkspace) return 'NEEDS_WORKSPACE';
  if (!check.hasOnboarding) return 'NEEDS_ONBOARDING';
  return 'READY';
}

export function getRedirectForState(state: AuthNavState, targetPath: string): string | null {
  switch (state) {
    case 'LOADING':
      return null;
    case 'UNAUTHENTICATED':
      return `/auth?redirect=${encodeURIComponent(targetPath)}`;
    case 'NEEDS_WORKSPACE':
      return '/setup';
    case 'NEEDS_ONBOARDING':
      return '/onboarding';
    case 'READY':
      return null;
  }
}
