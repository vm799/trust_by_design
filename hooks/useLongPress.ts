/**
 * useLongPress - Touch gesture hook for long-press context menus
 *
 * Detects 500ms press-and-hold to reveal context menu.
 * Cancels on move (prevents false triggers during scroll).
 * Provides haptic feedback on trigger.
 */

import { useRef, useCallback, useState, useEffect } from 'react';
import { hapticFeedback } from '../lib/microInteractions';

interface UseLongPressOptions {
  /** Callback when long press is detected */
  onLongPress: () => void;
  /** Duration in ms to trigger (default: 500) */
  duration?: number;
  /** Whether the hook is enabled (default: true) */
  enabled?: boolean;
  /** Movement tolerance in px before cancelling (default: 10) */
  moveTolerance?: number;
}

export function useLongPress({
  onLongPress,
  duration = 500,
  enabled = true,
  moveTolerance = 10,
}: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const [isPressed, setIsPressed] = useState(false);
  const [isLongPressed, setIsLongPressed] = useState(false);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsPressed(false);
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;

    startPosRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };

    setIsPressed(true);

    timerRef.current = setTimeout(() => {
      setIsLongPressed(true);
      hapticFeedback('medium');
      onLongPress();
      // Auto-reset after trigger
      setTimeout(() => setIsLongPressed(false), 300);
    }, duration);
  }, [enabled, duration, onLongPress]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!timerRef.current) return;

    const deltaX = Math.abs(e.touches[0].clientX - startPosRef.current.x);
    const deltaY = Math.abs(e.touches[0].clientY - startPosRef.current.y);

    if (deltaX > moveTolerance || deltaY > moveTolerance) {
      clear();
    }
  }, [moveTolerance, clear]);

  const onTouchEnd = useCallback(() => {
    clear();
  }, [clear]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
    isPressed,
    isLongPressed,
  };
}
