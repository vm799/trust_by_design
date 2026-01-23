/**
 * Haptic Feedback Service
 *
 * Provides tactile feedback for key actions on supported devices.
 * Falls back gracefully on unsupported devices.
 */

/**
 * Check if vibration API is supported
 */
export function isHapticsSupported(): boolean {
  return 'vibrate' in navigator;
}

/**
 * Trigger a light haptic tap
 * Use for: button presses, selections, toggles
 */
export function hapticTap(): void {
  if (isHapticsSupported()) {
    navigator.vibrate(10);
  }
}

/**
 * Trigger a medium haptic pulse
 * Use for: photo capture, signature completion
 */
export function hapticSuccess(): void {
  if (isHapticsSupported()) {
    navigator.vibrate([15, 50, 15]);
  }
}

/**
 * Trigger a strong haptic feedback
 * Use for: job sealed, major completions
 */
export function hapticConfirm(): void {
  if (isHapticsSupported()) {
    navigator.vibrate([20, 100, 20, 100, 30]);
  }
}

/**
 * Trigger an error/warning haptic
 * Use for: validation errors, warnings
 */
export function hapticWarning(): void {
  if (isHapticsSupported()) {
    navigator.vibrate([50, 30, 50]);
  }
}

/**
 * Trigger a long vibration for critical actions
 * Use for: seal job, delete all, major destructive actions
 */
export function hapticCritical(): void {
  if (isHapticsSupported()) {
    navigator.vibrate([100, 50, 100]);
  }
}

/**
 * Custom vibration pattern
 * @param pattern - Array of alternating vibrate/pause durations in ms
 */
export function hapticPattern(pattern: number[]): void {
  if (isHapticsSupported()) {
    navigator.vibrate(pattern);
  }
}

/**
 * Stop any ongoing vibration
 */
export function hapticStop(): void {
  if (isHapticsSupported()) {
    navigator.vibrate(0);
  }
}
