/**
 * useSwipeAction - Touch gesture hook for swipe-to-reveal actions
 *
 * Enables swipe left/right on list items to reveal contextual actions.
 * Mobile-only: uses matchMedia to disable on desktop.
 * Always provides button alternatives for accessibility.
 */

import { useRef, useCallback, useState, useEffect } from 'react';

interface SwipeAction {
  label: string;
  icon: string;
  color: string;
  onAction: () => void;
}

interface UseSwipeActionOptions {
  /** Actions revealed on swipe right (max 2) */
  rightActions?: SwipeAction[];
  /** Actions revealed on swipe left (max 2) */
  leftActions?: SwipeAction[];
  /** Pixel distance to trigger action reveal (default: 80) */
  threshold?: number;
  /** Whether the hook is enabled (default: true) */
  enabled?: boolean;
}

interface SwipeState {
  /** Current horizontal offset */
  offsetX: number;
  /** Whether left actions are revealed */
  leftRevealed: boolean;
  /** Whether right actions are revealed */
  rightRevealed: boolean;
  /** Whether user is actively swiping */
  isSwiping: boolean;
}

export function useSwipeAction({
  rightActions = [],
  leftActions = [],
  threshold = 80,
  enabled = true,
}: UseSwipeActionOptions = {}) {
  const elementRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isHorizontalRef = useRef<boolean | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [state, setState] = useState<SwipeState>({
    offsetX: 0,
    leftRevealed: false,
    rightRevealed: false,
    isSwiping: false,
  });

  // Only enable on mobile/touch devices
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const reset = useCallback(() => {
    setState({
      offsetX: 0,
      leftRevealed: false,
      rightRevealed: false,
      isSwiping: false,
    });
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled || !isMobile) return;
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    isHorizontalRef.current = null;
    setState(prev => ({ ...prev, isSwiping: true }));
  }, [enabled, isMobile]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!enabled || !isMobile || startXRef.current === 0) return;

    const deltaX = e.touches[0].clientX - startXRef.current;
    const deltaY = e.touches[0].clientY - startYRef.current;

    // Determine swipe direction on first significant move
    if (isHorizontalRef.current === null) {
      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        isHorizontalRef.current = Math.abs(deltaX) > Math.abs(deltaY);
      }
      return;
    }

    // Ignore vertical swipes
    if (!isHorizontalRef.current) return;

    // Clamp offset: positive = swiping right (reveals left actions)
    // Negative = swiping left (reveals right actions)
    const maxRight = rightActions.length > 0 ? threshold + 20 : 0;
    const maxLeft = leftActions.length > 0 ? -(threshold + 20) : 0;
    const clampedOffset = Math.min(maxRight, Math.max(maxLeft, deltaX));

    setState(prev => ({
      ...prev,
      offsetX: clampedOffset,
    }));
  }, [enabled, isMobile, threshold, rightActions.length, leftActions.length]);

  const handleTouchEnd = useCallback(() => {
    if (!enabled || !isMobile) return;

    const deltaX = state.offsetX;
    startXRef.current = 0;
    startYRef.current = 0;
    isHorizontalRef.current = null;

    if (deltaX >= threshold && rightActions.length > 0) {
      // Snap open to reveal right actions (swiped right)
      setState({
        offsetX: threshold,
        leftRevealed: false,
        rightRevealed: true,
        isSwiping: false,
      });
    } else if (deltaX <= -threshold && leftActions.length > 0) {
      // Snap open to reveal left actions (swiped left)
      setState({
        offsetX: -threshold,
        leftRevealed: true,
        rightRevealed: false,
        isSwiping: false,
      });
    } else {
      // Snap back
      reset();
    }
  }, [enabled, isMobile, state.offsetX, threshold, rightActions.length, leftActions.length, reset]);

  useEffect(() => {
    const el = elementRef.current;
    if (!el || !enabled || !isMobile) return;

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, enabled, isMobile]);

  return {
    elementRef,
    ...state,
    reset,
    isEnabled: enabled && isMobile,
  };
}
