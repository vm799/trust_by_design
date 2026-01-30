import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThemeProvider, useTheme, DAYLIGHT_TOKENS, NEOBRUTALIST_SHADOW } from '../../../lib/theme';

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
  const {
    theme,
    setTheme,
    resolvedTheme,
    isEvening,
    toggleDayNight,
    isDaylightMode,
    setDaylightMode,
    daylightAuto,
    setDaylightAuto,
    themeState,
  } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <span data-testid="evening">{isEvening ? 'yes' : 'no'}</span>
      <span data-testid="daylight">{isDaylightMode ? 'yes' : 'no'}</span>
      <span data-testid="daylight-auto">{daylightAuto ? 'yes' : 'no'}</span>
      <span data-testid="theme-state">{themeState}</span>
      <button data-testid="toggle" onClick={toggleDayNight}>Toggle</button>
      <button data-testid="set-dark" onClick={() => setTheme('dark')}>Dark</button>
      <button data-testid="set-system" onClick={() => setTheme('system')}>System</button>
      <button data-testid="set-daylight" onClick={() => setTheme('daylight')}>Daylight</button>
      <button data-testid="enable-daylight" onClick={() => setDaylightMode(true)}>Enable Daylight</button>
      <button data-testid="disable-daylight" onClick={() => setDaylightMode(false)}>Disable Daylight</button>
      <button data-testid="toggle-daylight-auto" onClick={() => setDaylightAuto(!daylightAuto)}>Toggle Auto</button>
    </div>
  );
};

/**
 * PhD-Level Theme System Tests
 * Tests for Dynamic Day Mode with high-visibility construction support
 */
describe('Theme System', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark', 'daylight');
    document.documentElement.removeAttribute('data-theme');
    window.matchMedia = createMatchMediaMock(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ThemeProvider - Default Behavior', () => {
    it('defaults to dark mode when no preference is stored', () => {
      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('theme').textContent).toBe('dark');
      expect(screen.getByTestId('resolved').textContent).toBe('dark');
    });

    it('respects stored theme from localStorage', () => {
      localStorage.setItem('jobproof-theme-mode', JSON.stringify('daylight'));
      localStorage.setItem('jobproof-daylight-mode', JSON.stringify(true));

      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('theme').textContent).toBe('daylight');
      expect(screen.getByTestId('resolved').textContent).toBe('daylight');
    });

    it('applies theme class to document on mount', () => {
      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('supports forceTheme prop for testing', () => {
      render(
        <ThemeProvider forceTheme="dark">
          <ThemeTestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('theme').textContent).toBe('dark');
      expect(screen.getByTestId('resolved').textContent).toBe('dark');
    });
  });

  describe('toggleDayNight - Theme Switching', () => {
    it('toggles from dark to daylight', () => {
      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('resolved').textContent).toBe('dark');
      fireEvent.click(screen.getByTestId('toggle'));
      expect(screen.getByTestId('resolved').textContent).toBe('daylight');
    });

    it('toggles from daylight to dark', () => {
      localStorage.setItem('jobproof-theme-mode', JSON.stringify('daylight'));
      localStorage.setItem('jobproof-daylight-mode', JSON.stringify(true));

      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('resolved').textContent).toBe('daylight');
      fireEvent.click(screen.getByTestId('toggle'));
      expect(screen.getByTestId('resolved').textContent).toBe('dark');
    });

    it('cycles through themes: daylight -> dark', () => {
      localStorage.setItem('jobproof-daylight-mode', JSON.stringify(true));
      localStorage.setItem('jobproof-theme-mode', JSON.stringify('daylight'));

      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('resolved').textContent).toBe('daylight');
      fireEvent.click(screen.getByTestId('toggle'));
      expect(screen.getByTestId('resolved').textContent).toBe('dark');
    });
  });

  describe('setTheme - Theme Mode Changes', () => {
    it('switches to dark mode', () => {
      localStorage.setItem('jobproof-theme-mode', JSON.stringify('daylight'));
      localStorage.setItem('jobproof-daylight-mode', JSON.stringify(true));

      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      fireEvent.click(screen.getByTestId('set-dark'));
      expect(screen.getByTestId('theme').textContent).toBe('dark');
      expect(screen.getByTestId('resolved').textContent).toBe('dark');
    });

    it('switches to daylight mode', () => {
      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      fireEvent.click(screen.getByTestId('set-daylight'));
      expect(screen.getByTestId('theme').textContent).toBe('daylight');
      expect(screen.getByTestId('resolved').textContent).toBe('daylight');
      expect(screen.getByTestId('daylight').textContent).toBe('yes');
    });

    it('applies correct document class for each theme', () => {
      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      // Start in dark mode
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      fireEvent.click(screen.getByTestId('set-daylight'));
      expect(document.documentElement.classList.contains('daylight')).toBe(true);
      expect(document.documentElement.classList.contains('dark')).toBe(false);

      fireEvent.click(screen.getByTestId('set-dark'));
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.classList.contains('daylight')).toBe(false);
    });
  });

  describe('Daylight (Construction) Mode', () => {
    it('can enable daylight mode directly', () => {
      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('daylight').textContent).toBe('no');
      fireEvent.click(screen.getByTestId('enable-daylight'));
      expect(screen.getByTestId('daylight').textContent).toBe('yes');
      expect(screen.getByTestId('resolved').textContent).toBe('daylight');
    });

    it('can disable daylight mode', () => {
      localStorage.setItem('jobproof-daylight-mode', JSON.stringify(true));

      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('daylight').textContent).toBe('yes');
      fireEvent.click(screen.getByTestId('disable-daylight'));
      expect(screen.getByTestId('daylight').textContent).toBe('no');
    });

    it('daylight mode takes precedence over other themes', () => {
      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      // Start in dark mode
      expect(screen.getByTestId('resolved').textContent).toBe('dark');

      fireEvent.click(screen.getByTestId('enable-daylight'));
      expect(screen.getByTestId('resolved').textContent).toBe('daylight');
    });

    it('switching theme disables daylight mode', () => {
      localStorage.setItem('jobproof-daylight-mode', JSON.stringify(true));

      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('daylight').textContent).toBe('yes');
      fireEvent.click(screen.getByTestId('set-dark'));
      expect(screen.getByTestId('daylight').textContent).toBe('no');
    });
  });

  describe('System theme mode', () => {
    it('always returns dark (light mode removed)', () => {
      // Light mode has been removed - system always returns dark
      window.matchMedia = createMatchMediaMock(true);

      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      fireEvent.click(screen.getByTestId('set-system'));
      expect(screen.getByTestId('resolved').textContent).toBe('dark');
    });

    it('returns dark even when system prefers light (light mode removed)', () => {
      // Light mode has been removed due to poor contrast
      window.matchMedia = createMatchMediaMock(false);

      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      fireEvent.click(screen.getByTestId('set-system'));
      expect(screen.getByTestId('resolved').textContent).toBe('dark');
    });
  });

  describe('Theme State Machine', () => {
    it('transitions through states correctly', () => {
      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      // After hydration, state should be 'ready'
      expect(screen.getByTestId('theme-state').textContent).toBe('ready');
    });
  });

  describe('Design Tokens', () => {
    it('exports DAYLIGHT_TOKENS with correct values', () => {
      expect(DAYLIGHT_TOKENS.primary).toBe('#FF8C00');
      expect(DAYLIGHT_TOKENS.background).toBe('#F8FAFC');
      expect(DAYLIGHT_TOKENS.text).toBe('#1E293B');
      expect(DAYLIGHT_TOKENS.borderWidth).toBe('2px');
      expect(DAYLIGHT_TOKENS.touchTarget).toBe('56px');
    });

    it('exports NEOBRUTALIST_SHADOW constant', () => {
      expect(NEOBRUTALIST_SHADOW).toBe('4px 4px 0px #000000');
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
