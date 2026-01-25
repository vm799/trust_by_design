/**
 * useNavigation Hook
 *
 * Provides consistent navigation utilities including proper back button
 * behavior that uses browser history instead of hardcoded routes.
 *
 * Phase 9: Navigation fixes
 */

import { useNavigate, useLocation } from 'react-router-dom';
import { useCallback } from 'react';

interface NavigationResult {
  /** Navigate back using browser history, with fallback to specified route */
  goBack: (fallback?: string) => void;
  /** Check if we can go back in history */
  canGoBack: boolean;
  /** Current pathname */
  currentPath: string;
  /** Navigate to a route */
  navigateTo: (path: string) => void;
  /** Navigate with replace (no history entry) */
  replaceTo: (path: string) => void;
}

/**
 * Hook for consistent navigation behavior
 *
 * @param defaultFallback - Default route when can't go back (defaults to /admin)
 */
export function useNavigation(defaultFallback: string = '/admin'): NavigationResult {
  const navigate = useNavigate();
  const location = useLocation();

  // Check if there's history to go back to
  // Note: window.history.length > 1 doesn't reliably indicate same-origin history
  // We track if user navigated internally by checking if they're not on the first page
  const canGoBack = typeof window !== 'undefined' && window.history.length > 2;

  const goBack = useCallback((fallback?: string) => {
    const fallbackRoute = fallback || defaultFallback;

    // Try to go back in browser history
    // If we're at the entry point (no internal navigation yet), use fallback
    if (canGoBack) {
      navigate(-1);
    } else {
      navigate(fallbackRoute, { replace: true });
    }
  }, [navigate, canGoBack, defaultFallback]);

  const navigateTo = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  const replaceTo = useCallback((path: string) => {
    navigate(path, { replace: true });
  }, [navigate]);

  return {
    goBack,
    canGoBack,
    currentPath: location.pathname,
    navigateTo,
    replaceTo,
  };
}

export default useNavigation;
