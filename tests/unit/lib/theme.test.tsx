import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../../../lib/theme';

// Create a proper matchMedia mock
const createMatchMediaMock = (prefersDark = false) => {
  return vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' ? prefersDark : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

// Test component to access theme context
const ThemeTestComponent = () => {
  const { theme, setTheme, resolvedTheme, isEvening, toggleDayNight } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <span data-testid="evening">{isEvening ? 'yes' : 'no'}</span>
      <button data-testid="toggle" onClick={toggleDayNight}>Toggle</button>
      <button data-testid="set-light" onClick={() => setTheme('light')}>Light</button>
      <button data-testid="set-dark" onClick={() => setTheme('dark')}>Dark</button>
      <button data-testid="set-auto" onClick={() => setTheme('auto')}>Auto</button>
      <button data-testid="set-system" onClick={() => setTheme('system')}>System</button>
    </div>
  );
};

/**
 * Phase 5.5: Dark-only theme tests
 * The theme system now always resolves to dark mode for a consistent premium experience.
 * All theme operations (setTheme, toggleDayNight) are no-ops that maintain dark mode.
 */
describe('Theme System', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('light', 'dark');
    window.matchMedia = createMatchMediaMock(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ThemeProvider - Dark-Only Mode (Phase 5.5)', () => {
    it('defaults to dark mode regardless of stored preference', () => {
      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('theme').textContent).toBe('dark');
      expect(screen.getByTestId('resolved').textContent).toBe('dark');
    });

    it('ignores saved theme from localStorage and uses dark', () => {
      localStorage.setItem('jobproof_theme', 'light');

      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      // Phase 5.5: Always dark regardless of localStorage
      expect(screen.getByTestId('theme').textContent).toBe('dark');
      expect(screen.getByTestId('resolved').textContent).toBe('dark');
    });

    it('applies dark class to document on mount', () => {
      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.classList.contains('light')).toBe(false);
    });

    it('ensures dark class even when light was set in localStorage', () => {
      localStorage.setItem('jobproof_theme', 'light');

      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.classList.contains('light')).toBe(false);
    });
  });

  describe('toggleDayNight - No-op (Phase 5.5)', () => {
    it('does not switch theme (always stays dark)', () => {
      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('theme').textContent).toBe('dark');
      fireEvent.click(screen.getByTestId('toggle'));
      // Phase 5.5: toggle is a no-op
      expect(screen.getByTestId('theme').textContent).toBe('dark');
    });

    it('maintains dark resolved theme after toggle attempts', () => {
      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      fireEvent.click(screen.getByTestId('toggle'));
      fireEvent.click(screen.getByTestId('toggle'));
      fireEvent.click(screen.getByTestId('toggle'));

      expect(screen.getByTestId('resolved').textContent).toBe('dark');
    });
  });

  describe('setTheme - No-op (Phase 5.5)', () => {
    it('ignores all theme mode changes and stays dark', () => {
      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      // All these should be no-ops - always dark
      fireEvent.click(screen.getByTestId('set-light'));
      expect(screen.getByTestId('theme').textContent).toBe('dark');

      fireEvent.click(screen.getByTestId('set-auto'));
      expect(screen.getByTestId('theme').textContent).toBe('dark');

      fireEvent.click(screen.getByTestId('set-system'));
      expect(screen.getByTestId('theme').textContent).toBe('dark');

      fireEvent.click(screen.getByTestId('set-dark'));
      expect(screen.getByTestId('theme').textContent).toBe('dark');
    });

    it('resolvedTheme is always dark regardless of setTheme calls', () => {
      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      fireEvent.click(screen.getByTestId('set-light'));
      expect(screen.getByTestId('resolved').textContent).toBe('dark');

      fireEvent.click(screen.getByTestId('set-system'));
      expect(screen.getByTestId('resolved').textContent).toBe('dark');
    });
  });

  describe('System theme mode - Ignored (Phase 5.5)', () => {
    it('ignores system dark preference (always dark anyway)', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      localStorage.setItem('jobproof_theme', 'system');

      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('resolved').textContent).toBe('dark');
    });

    it('ignores system light preference (forces dark)', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      localStorage.setItem('jobproof_theme', 'system');

      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      // Phase 5.5: Always dark regardless of system preference
      expect(screen.getByTestId('resolved').textContent).toBe('dark');
    });
  });

  describe('Auto (time-based) theme mode - Ignored (Phase 5.5)', () => {
    it('returns dark during evening hours (no change)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T21:00:00'));

      localStorage.setItem('jobproof_theme', 'auto');

      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('resolved').textContent).toBe('dark');
      // isEvening is still tracked for API compatibility
      expect(screen.getByTestId('evening').textContent).toBe('yes');

      vi.useRealTimers();
    });

    it('returns dark during day hours (time-based disabled)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T10:00:00'));

      localStorage.setItem('jobproof_theme', 'auto');

      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      // Phase 5.5: Always dark regardless of time
      expect(screen.getByTestId('resolved').textContent).toBe('dark');
      // isEvening still updates for API compatibility
      expect(screen.getByTestId('evening').textContent).toBe('no');

      vi.useRealTimers();
    });
  });

  describe('useTheme hook', () => {
    it('throws error when used outside ThemeProvider', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<ThemeTestComponent />);
      }).toThrow('useTheme must be used within ThemeProvider');

      consoleError.mockRestore();
    });
  });
});
