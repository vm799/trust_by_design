/**
 * useGlobalKeyboardShortcuts Hook
 *
 * Centralized keyboard shortcut management for dashboard quick actions.
 * Handles Ctrl+K/Cmd+K for search and Ctrl+A/Cmd+A for assign.
 *
 * Features:
 * - Prevents shortcuts from firing in input/textarea fields
 * - Supports both Ctrl (Windows/Linux) and Cmd (macOS)
 * - Respects disabled flag for cleanup
 * - No side effects, pure event handling
 * - Memory-safe cleanup on unmount
 *
 * Usage:
 * ```tsx
 * const { isListening } = useGlobalKeyboardShortcuts({
 *   onSearch: () => setIsSearchModalOpen(true),
 *   onAssign: () => setIsAssignModalOpen(true),
 *   disabled: false,
 * });
 * ```
 */

import { useEffect, useCallback, useRef } from 'react';

export interface UseGlobalKeyboardShortcutsOptions {
  /** Callback when Ctrl+K (Cmd+K on macOS) is pressed */
  onSearch: () => void;
  /** Callback when Ctrl+A (Cmd+A on macOS) is pressed (optional for views without assignment) */
  onAssign?: () => void;
  /** Disable all keyboard listeners (default: false) */
  disabled?: boolean;
}

export interface UseGlobalKeyboardShortcutsReturn {
  /** Whether keyboard listener is currently active */
  isListening: boolean;
}

/**
 * Check if the currently focused element is a text input field.
 * Used to prevent shortcuts from firing while user is typing.
 */
const isTextInputField = (): boolean => {
  const activeElement = document.activeElement;

  // Handle standard HTML inputs and textareas
  if (activeElement instanceof HTMLInputElement) {
    return true;
  }
  if (activeElement instanceof HTMLTextAreaElement) {
    return true;
  }

  // Handle contenteditable divs (e.g., rich text editors)
  if (activeElement?.getAttribute('contenteditable') === 'true') {
    return true;
  }

  return false;
};

/**
 * Global keyboard shortcut hook for dashboard quick actions.
 *
 * @param options - Configuration for keyboard shortcuts
 * @returns Object with listening status
 *
 * @example
 * const { isListening } = useGlobalKeyboardShortcuts({
 *   onSearch: () => console.log('Search!'),
 *   onAssign: () => console.log('Assign!'),
 * });
 */
export const useGlobalKeyboardShortcuts = ({
  onSearch,
  onAssign,
  disabled = false,
}: UseGlobalKeyboardShortcutsOptions): UseGlobalKeyboardShortcutsReturn => {
  // Use refs to ensure callbacks are always current (avoid stale closures)
  const onSearchRef = useRef(onSearch);
  const onAssignRef = useRef(onAssign);

  // Update refs whenever callbacks change
  useEffect(() => {
    onSearchRef.current = onSearch;
    onAssignRef.current = onAssign;
  }, [onSearch, onAssign]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't intercept if user is typing in input/textarea
    if (isTextInputField()) {
      return;
    }

    // Ctrl+K (Windows/Linux) or Cmd+K (macOS) for search
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      onSearchRef.current();
    }

    // Ctrl+A (Windows/Linux) or Cmd+A (macOS) for assign
    // Note: This overrides browser's select-all behavior
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && onAssignRef.current) {
      e.preventDefault();
      onAssignRef.current();
    }
  }, []);

  useEffect(() => {
    // Don't register listeners if disabled
    if (disabled) {
      return;
    }

    // Register keyboard listener on window
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup: Remove listener on unmount or when disabled
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [disabled, handleKeyDown]);

  return {
    isListening: !disabled,
  };
};
