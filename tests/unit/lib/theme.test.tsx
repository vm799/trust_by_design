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

describe('Theme System', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('light', 'dark');
    // Ensure matchMedia is always mocked
    window.matchMedia = createMatchMediaMock(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ThemeProvider', () => {
    it('defaults to auto mode when no preference stored', () => {
      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('theme').textContent).toBe('auto');
    });

    it('loads saved theme from localStorage', () => {
      localStorage.setItem('jobproof_theme', 'dark');

      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('theme').textContent).toBe('dark');
    });

    it('persists theme changes to localStorage', () => {
      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      fireEvent.click(screen.getByTestId('set-light'));
      expect(localStorage.getItem('jobproof_theme')).toBe('light');

      fireEvent.click(screen.getByTestId('set-dark'));
      expect(localStorage.getItem('jobproof_theme')).toBe('dark');
    });

    it('applies dark class to document when resolved theme is dark', () => {
      localStorage.setItem('jobproof_theme', 'dark');

      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.classList.contains('light')).toBe(false);
    });

    it('applies light class to document when resolved theme is light', () => {
      localStorage.setItem('jobproof_theme', 'light');

      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      expect(document.documentElement.classList.contains('light')).toBe(true);
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('toggleDayNight', () => {
    it('switches from dark to light', () => {
      localStorage.setItem('jobproof_theme', 'dark');

      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      fireEvent.click(screen.getByTestId('toggle'));
      expect(screen.getByTestId('theme').textContent).toBe('light');
    });

    it('switches from light to dark', () => {
      localStorage.setItem('jobproof_theme', 'light');

      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      fireEvent.click(screen.getByTestId('toggle'));
      expect(screen.getByTestId('theme').textContent).toBe('dark');
    });
  });

  describe('setTheme', () => {
    it('allows setting to any valid theme mode', () => {
      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      fireEvent.click(screen.getByTestId('set-light'));
      expect(screen.getByTestId('theme').textContent).toBe('light');

      fireEvent.click(screen.getByTestId('set-dark'));
      expect(screen.getByTestId('theme').textContent).toBe('dark');

      fireEvent.click(screen.getByTestId('set-auto'));
      expect(screen.getByTestId('theme').textContent).toBe('auto');

      fireEvent.click(screen.getByTestId('set-system'));
      expect(screen.getByTestId('theme').textContent).toBe('system');
    });
  });

  describe('System theme mode', () => {
    it('respects system preference for dark mode', () => {
      // Mock matchMedia to prefer dark
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

    it('respects system preference for light mode', () => {
      // Mock matchMedia to prefer light
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

      expect(screen.getByTestId('resolved').textContent).toBe('light');
    });
  });

  describe('Auto (time-based) theme mode', () => {
    it('returns dark during evening hours (6PM-6AM)', () => {
      // Mock Date to 9 PM
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T21:00:00'));

      localStorage.setItem('jobproof_theme', 'auto');

      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('resolved').textContent).toBe('dark');
      expect(screen.getByTestId('evening').textContent).toBe('yes');

      vi.useRealTimers();
    });

    it('returns light during day hours (6AM-6PM)', () => {
      // Mock Date to 10 AM
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T10:00:00'));

      localStorage.setItem('jobproof_theme', 'auto');

      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('resolved').textContent).toBe('light');
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
