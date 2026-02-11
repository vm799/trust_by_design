/**
 * usePullToRefresh - Touch gesture hook for pull-to-refresh
 *
 * Detects downward swipe at the top of a scrollable container
 * and triggers a refresh callback. Shows visual indicator during pull.
 *
 * Mobile-first: Only activates on touch devices.
 * Offline-aware: Shows toast when offline instead of refreshing.
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { showToast } from '../lib/microInteractions';

interface UsePullToRefreshOptions {
  /** Callback to execute on refresh (e.g., DataContext.refresh) */
  onRefresh: () => void | Promise<void>;
  /** Pixel distance to pull before triggering (default: 60) */
  threshold?: number;
  /** Whether the hook is enabled (default: true) */
  enabled?: boolean;
}

interface PullToRefreshState {
  /** Whether the user is actively pulling */
  isPulling: boolean;
  /** Current pull distance in pixels */
  pullDistance: number;
  /** Whether refresh is in progress */
  isRefreshing: boolean;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 60,
  enabled = true,
}: UsePullToRefreshOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const [state, setState] = useState<PullToRefreshState>({
    isPulling: false,
    pullDistance: 0,
    isRefreshing: false,
  });

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    // Only activate when scrolled to top
    if (container.scrollTop > 0) return;

    startYRef.current = e.touches[0].clientY;
    currentYRef.current = e.touches[0].clientY;
  }, [enabled]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!enabled || startYRef.current === 0) return;

    currentYRef.current = e.touches[0].clientY;
    const distance = Math.max(0, currentYRef.current - startYRef.current);

    if (distance > 10) {
      // Apply diminishing returns after threshold
      const cappedDistance = distance > threshold
        ? threshold + (distance - threshold) * 0.3
        : distance;

      setState(prev => ({
        ...prev,
        isPulling: true,
        pullDistance: cappedDistance,
      }));
    }
  }, [enabled, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!enabled) return;

    const distance = currentYRef.current - startYRef.current;
    startYRef.current = 0;
    currentYRef.current = 0;

    if (distance >= threshold) {
      // Check offline status
      if (!navigator.onLine) {
        showToast('Offline', 'Cannot refresh while offline', 'warning');
        setState({ isPulling: false, pullDistance: 0, isRefreshing: false });
        return;
      }

      setState({ isPulling: false, pullDistance: 0, isRefreshing: true });

      try {
        await onRefresh();
      } finally {
        setState({ isPulling: false, pullDistance: 0, isRefreshing: false });
      }
    } else {
      setState({ isPulling: false, pullDistance: 0, isRefreshing: false });
    }
  }, [enabled, threshold, onRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, enabled]);

  return {
    containerRef,
    ...state,
    /** Progress ratio 0-1 for visual indicator */
    progress: Math.min(state.pullDistance / threshold, 1),
  };
}
