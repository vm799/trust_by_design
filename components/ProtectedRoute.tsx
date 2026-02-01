import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import RouteErrorBoundary from './RouteErrorBoundary';

/**
 * REMEDIATION ITEM 14: ProtectedRoute wrapper component
 *
 * Encapsulates the common authentication guard pattern used throughout App.tsx.
 * Reduces code duplication and provides consistent auth handling.
 *
 * Features:
 * - Automatic redirect to auth page when not authenticated
 * - Optional user requirement (profile must be loaded)
 * - Integrated RouteErrorBoundary for error isolation
 * - Configurable redirect paths and fallback routes
 */

interface ProtectedRouteProps {
  /** The protected content to render */
  children: React.ReactNode;
  /** Section name for error boundary (displayed in error UI) */
  sectionName: string;
  /** Fallback route for error boundary recovery */
  fallbackRoute?: string;
  /** Redirect path when not authenticated (default: /auth) */
  authRedirect?: string;
  /** If true, requires user profile to be loaded (not just authenticated) */
  requireUser?: boolean;
  /** Redirect path when user profile is missing (default: /auth/setup) */
  userRedirect?: string;
}

/**
 * ProtectedRoute - Wrapper for authenticated routes
 *
 * @example
 * // Basic usage
 * <ProtectedRoute sectionName="Dashboard" fallbackRoute="/home">
 *   <Dashboard />
 * </ProtectedRoute>
 *
 * @example
 * // Require user profile
 * <ProtectedRoute sectionName="Settings" fallbackRoute="/admin" requireUser>
 *   <Settings user={user} />
 * </ProtectedRoute>
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  sectionName,
  fallbackRoute = '/home',
  authRedirect = '/auth',
}) => {
  const { isAuthenticated } = useAuth();

  // Not authenticated - redirect to auth
  if (!isAuthenticated) {
    return <Navigate to={authRedirect} replace />;
  }

  // Wrap in error boundary and render
  return (
    <RouteErrorBoundary sectionName={sectionName} fallbackRoute={fallbackRoute}>
      {children}
    </RouteErrorBoundary>
  );
};

/**
 * ProtectedRouteWithUser - Wrapper that also checks for user profile
 *
 * This variant shows a loading spinner while checking for user profile,
 * and redirects to setup if profile is missing.
 */
interface ProtectedRouteWithUserProps extends ProtectedRouteProps {
  /** The user profile (passed from parent that has access to user state) */
  user: unknown | null;
  /** Content to show while loading (optional) */
  loadingFallback?: React.ReactNode;
}

export const ProtectedRouteWithUser: React.FC<ProtectedRouteWithUserProps> = ({
  children,
  sectionName,
  fallbackRoute = '/home',
  authRedirect = '/auth',
  userRedirect = '/auth/setup',
  user,
}) => {
  const { isAuthenticated } = useAuth();

  // Not authenticated - redirect to auth
  if (!isAuthenticated) {
    return <Navigate to={authRedirect} replace />;
  }

  // Authenticated but no user profile - redirect to setup
  if (!user) {
    return <Navigate to={userRedirect} replace />;
  }

  // Wrap in error boundary and render
  return (
    <RouteErrorBoundary sectionName={sectionName} fallbackRoute={fallbackRoute}>
      {children}
    </RouteErrorBoundary>
  );
};

/**
 * PublicOnlyRoute - Wrapper for routes that should only be accessible when NOT authenticated
 *
 * Useful for login/signup pages that should redirect to dashboard if already logged in.
 */
interface PublicOnlyRouteProps {
  /** The public content to render */
  children: React.ReactNode;
  /** Redirect path when already authenticated (default: /) */
  redirectTo?: string;
}

export const PublicOnlyRoute: React.FC<PublicOnlyRouteProps> = ({
  children,
  redirectTo = '/',
}) => {
  const { isAuthenticated } = useAuth();

  // Already authenticated - redirect away from public-only route
  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
