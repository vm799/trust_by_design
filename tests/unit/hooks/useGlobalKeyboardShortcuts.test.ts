/**
 * useGlobalKeyboardShortcuts Hook Tests
 *
 * Comprehensive test coverage for global keyboard shortcut handling.
 * Tests: Ctrl+K/Cmd+K search, Ctrl+A/Cmd+A assign, input field detection,
 * disabled state, cleanup, and edge cases.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGlobalKeyboardShortcuts } from '../../../hooks/useGlobalKeyboardShortcuts';

describe('useGlobalKeyboardShortcuts', () => {
  const mockOnSearch = vi.fn();
  const mockOnAssign = vi.fn();

  beforeEach(() => {
    mockOnSearch.mockClear();
    mockOnAssign.mockClear();
  });

  afterEach(() => {
    // Clean up any remaining event listeners
    vi.clearAllMocks();
  });

  // ========== BASIC FUNCTIONALITY TESTS ==========

  describe('Ctrl+K/Cmd+K Search Shortcut', () => {
    it('fires onSearch when Ctrl+K is pressed', () => {
      renderHook(() =>
        useGlobalKeyboardShortcuts({
          onSearch: mockOnSearch,
          onAssign: mockOnAssign,
        })
      );

      const event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        bubbles: true,
      });

      window.dispatchEvent(event);

      expect(mockOnSearch).toHaveBeenCalledTimes(1);
      expect(mockOnAssign).not.toHaveBeenCalled();
    });

    it('fires onSearch when Cmd+K is pressed (macOS)', () => {
      renderHook(() =>
        useGlobalKeyboardShortcuts({
          onSearch: mockOnSearch,
          onAssign: mockOnAssign,
        })
      );

      const event = new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: true,
        bubbles: true,
      });

      window.dispatchEvent(event);

      expect(mockOnSearch).toHaveBeenCalledTimes(1);
      expect(mockOnAssign).not.toHaveBeenCalled();
    });

    it('works with uppercase K key', () => {
      renderHook(() =>
        useGlobalKeyboardShortcuts({
          onSearch: mockOnSearch,
          onAssign: mockOnAssign,
        })
      );

      const event = new KeyboardEvent('keydown', {
        key: 'K',
        ctrlKey: true,
        bubbles: true,
      });

      window.dispatchEvent(event);

      expect(mockOnSearch).toHaveBeenCalledTimes(1);
    });

    it('prevents default browser behavior when Ctrl+K pressed', () => {
      renderHook(() =>
        useGlobalKeyboardShortcuts({
          onSearch: mockOnSearch,
          onAssign: mockOnAssign,
        })
      );

      const event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });

      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      window.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  // ========== ASSIGN SHORTCUT TESTS ==========

  describe('Ctrl+A/Cmd+A Assign Shortcut', () => {
    it('fires onAssign when Ctrl+A is pressed', () => {
      renderHook(() =>
        useGlobalKeyboardShortcuts({
          onSearch: mockOnSearch,
          onAssign: mockOnAssign,
        })
      );

      const event = new KeyboardEvent('keydown', {
        key: 'a',
        ctrlKey: true,
        bubbles: true,
      });

      window.dispatchEvent(event);

      expect(mockOnAssign).toHaveBeenCalledTimes(1);
      expect(mockOnSearch).not.toHaveBeenCalled();
    });

    it('fires onAssign when Cmd+A is pressed (macOS)', () => {
      renderHook(() =>
        useGlobalKeyboardShortcuts({
          onSearch: mockOnSearch,
          onAssign: mockOnAssign,
        })
      );

      const event = new KeyboardEvent('keydown', {
        key: 'a',
        metaKey: true,
        bubbles: true,
      });

      window.dispatchEvent(event);

      expect(mockOnAssign).toHaveBeenCalledTimes(1);
      expect(mockOnSearch).not.toHaveBeenCalled();
    });

    it('prevents default select-all behavior when Ctrl+A pressed', () => {
      renderHook(() =>
        useGlobalKeyboardShortcuts({
          onSearch: mockOnSearch,
          onAssign: mockOnAssign,
        })
      );

      const event = new KeyboardEvent('keydown', {
        key: 'a',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });

      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      window.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  // ========== INPUT FIELD DETECTION TESTS ==========

  describe('Input Field Detection', () => {
    it('does not fire shortcuts when input field is focused', () => {
      const input = document.createElement('input');
      input.type = 'text';
      document.body.appendChild(input);
      input.focus();

      renderHook(() =>
        useGlobalKeyboardShortcuts({
          onSearch: mockOnSearch,
          onAssign: mockOnAssign,
        })
      );

      const event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        bubbles: true,
      });

      window.dispatchEvent(event);

      expect(mockOnSearch).not.toHaveBeenCalled();

      document.body.removeChild(input);
    });

    it('does not fire shortcuts when textarea is focused', () => {
      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      textarea.focus();

      renderHook(() =>
        useGlobalKeyboardShortcuts({
          onSearch: mockOnSearch,
          onAssign: mockOnAssign,
        })
      );

      const event = new KeyboardEvent('keydown', {
        key: 'a',
        ctrlKey: true,
        bubbles: true,
      });

      window.dispatchEvent(event);

      expect(mockOnAssign).not.toHaveBeenCalled();

      document.body.removeChild(textarea);
    });

    it('does not fire shortcuts when contenteditable element is focused', () => {
      const div = document.createElement('div');
      div.setAttribute('contenteditable', 'true');
      document.body.appendChild(div);
      div.focus();

      renderHook(() =>
        useGlobalKeyboardShortcuts({
          onSearch: mockOnSearch,
          onAssign: mockOnAssign,
        })
      );

      const event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        bubbles: true,
      });

      window.dispatchEvent(event);

      expect(mockOnSearch).not.toHaveBeenCalled();

      document.body.removeChild(div);
    });

    it('fires shortcuts when body is focused (no input)', () => {
      document.body.focus();

      renderHook(() =>
        useGlobalKeyboardShortcuts({
          onSearch: mockOnSearch,
          onAssign: mockOnAssign,
        })
      );

      const event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        bubbles: true,
      });

      window.dispatchEvent(event);

      expect(mockOnSearch).toHaveBeenCalledTimes(1);
    });
  });

  // ========== DISABLED STATE TESTS ==========

  describe('Disabled State', () => {
    it('does not fire callbacks when disabled is true', () => {
      renderHook(() =>
        useGlobalKeyboardShortcuts({
          onSearch: mockOnSearch,
          onAssign: mockOnAssign,
          disabled: true,
        })
      );

      const event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        bubbles: true,
      });

      window.dispatchEvent(event);

      expect(mockOnSearch).not.toHaveBeenCalled();
      expect(mockOnAssign).not.toHaveBeenCalled();
    });

    it('isListening returns false when disabled', () => {
      const { result } = renderHook(() =>
        useGlobalKeyboardShortcuts({
          onSearch: mockOnSearch,
          onAssign: mockOnAssign,
          disabled: true,
        })
      );

      expect(result.current.isListening).toBe(false);
    });

    it('isListening returns true when enabled', () => {
      const { result } = renderHook(() =>
        useGlobalKeyboardShortcuts({
          onSearch: mockOnSearch,
          onAssign: mockOnAssign,
          disabled: false,
        })
      );

      expect(result.current.isListening).toBe(true);
    });
  });

  // ========== CALLBACK UPDATE TESTS ==========

  describe('Callback Updates', () => {
    it('uses updated callback when onSearch changes', () => {
      const onSearch1 = vi.fn();
      const onSearch2 = vi.fn();

      const { rerender } = renderHook(
        ({ onSearch }: any) =>
          useGlobalKeyboardShortcuts({
            onSearch,
            onAssign: mockOnAssign,
          }),
        { initialProps: { onSearch: onSearch1 } }
      );

      // First call
      let event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);
      expect(onSearch1).toHaveBeenCalledTimes(1);

      // Update callback
      rerender({ onSearch: onSearch2 });

      // Second call should use new callback
      event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(onSearch1).toHaveBeenCalledTimes(1); // No new call
      expect(onSearch2).toHaveBeenCalledTimes(1); // New callback called
    });

    it('uses updated callback when onAssign changes', () => {
      const onAssign1 = vi.fn();
      const onAssign2 = vi.fn();

      const { rerender } = renderHook(
        ({ onAssign }: any) =>
          useGlobalKeyboardShortcuts({
            onSearch: mockOnSearch,
            onAssign,
          }),
        { initialProps: { onAssign: onAssign1 } }
      );

      let event = new KeyboardEvent('keydown', {
        key: 'a',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);
      expect(onAssign1).toHaveBeenCalledTimes(1);

      rerender({ onAssign: onAssign2 });

      event = new KeyboardEvent('keydown', {
        key: 'a',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(onAssign1).toHaveBeenCalledTimes(1);
      expect(onAssign2).toHaveBeenCalledTimes(1);
    });
  });

  // ========== CLEANUP TESTS ==========

  describe('Memory Management & Cleanup', () => {
    it('removes event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() =>
        useGlobalKeyboardShortcuts({
          onSearch: mockOnSearch,
          onAssign: mockOnAssign,
        })
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });

    it('does not register listener when disabled initially', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      renderHook(() =>
        useGlobalKeyboardShortcuts({
          onSearch: mockOnSearch,
          onAssign: mockOnAssign,
          disabled: true,
        })
      );

      // Should not have added listener
      const keydownCalls = addEventListenerSpy.mock.calls.filter(
        call => call[0] === 'keydown'
      );
      expect(keydownCalls.length).toBe(0);

      addEventListenerSpy.mockRestore();
    });

    it('removes listener when transitioning to disabled', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { rerender } = renderHook(
        ({ disabled }: any) =>
          useGlobalKeyboardShortcuts({
            onSearch: mockOnSearch,
            onAssign: mockOnAssign,
            disabled,
          }),
        { initialProps: { disabled: false } }
      );

      rerender({ disabled: true });

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });

  // ========== EDGE CASE TESTS ==========

  describe('Edge Cases', () => {
    it('ignores other key combinations', () => {
      renderHook(() =>
        useGlobalKeyboardShortcuts({
          onSearch: mockOnSearch,
          onAssign: mockOnAssign,
        })
      );

      const event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: false, // No Ctrl key
        bubbles: true,
      });

      window.dispatchEvent(event);

      expect(mockOnSearch).not.toHaveBeenCalled();
    });

    it('handles rapid successive key presses', () => {
      renderHook(() =>
        useGlobalKeyboardShortcuts({
          onSearch: mockOnSearch,
          onAssign: mockOnAssign,
        })
      );

      for (let i = 0; i < 5; i++) {
        const event = new KeyboardEvent('keydown', {
          key: 'k',
          ctrlKey: true,
          bubbles: true,
        });
        window.dispatchEvent(event);
      }

      expect(mockOnSearch).toHaveBeenCalledTimes(5);
    });

    it('handles alternating shortcut presses', () => {
      renderHook(() =>
        useGlobalKeyboardShortcuts({
          onSearch: mockOnSearch,
          onAssign: mockOnAssign,
        })
      );

      // Press Ctrl+K
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'k',
          ctrlKey: true,
          bubbles: true,
        })
      );

      // Press Ctrl+A
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'a',
          ctrlKey: true,
          bubbles: true,
        })
      );

      // Press Ctrl+K again
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'k',
          ctrlKey: true,
          bubbles: true,
        })
      );

      expect(mockOnSearch).toHaveBeenCalledTimes(2);
      expect(mockOnAssign).toHaveBeenCalledTimes(1);
    });

    it('handles both Ctrl and Meta keys simultaneously (weird edge case)', () => {
      renderHook(() =>
        useGlobalKeyboardShortcuts({
          onSearch: mockOnSearch,
          onAssign: mockOnAssign,
        })
      );

      const event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        metaKey: true, // Both pressed (unlikely but possible)
        bubbles: true,
      });

      window.dispatchEvent(event);

      // Should still fire (not both, just once due to OR condition)
      expect(mockOnSearch).toHaveBeenCalledTimes(1);
    });
  });
});
