import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, useTheme, DAYLIGHT_TOKENS, NEOBRUTALIST_SHADOW } from '../../../lib/theme';

// Create a proper matchMedia mock
const createMatchMediaMock = (prefersDark = false) => {
  return vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' ? prefersDark
           : query === '(prefers-color-scheme: light)' ? !prefersDark
           : false,
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
    isLightMode,
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
      <span data-testid="light-mode">{isLightMode ? 'yes' : 'no'}</span>
      <span data-testid="evening">{isEvening ? 'yes' : 'no'}</span>
      <span data-testid="daylight">{isDaylightMode ? 'yes' : 'no'}</span>
      <span data-testid="daylight-auto">{daylightAuto ? 'yes' : 'no'}</span>
      <span data-testid="theme-state">{themeState}</span>
      <button data-testid="toggle" onClick={toggleDayNight}>Toggle</button>
      <button data-testid="set-light" onClick={() => setTheme('light')}>Light</button>
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
    document.documentElement.classList.remove('light', 'dark', 'daylight');
    document.documentElement.removeAttribute('data-theme');
    window.matchMedia = createMatchMediaMock(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ThemeProvider - Default Behavior', () => {
    it('defaults to system mode and resolves based on prefers-color-scheme', () => {
      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('theme').textContent).toBe('system');
      // With prefersDark=false mock, system resolves to light
      expect(screen.getByTestId('resolved').textContent).toBe('light');
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

      // System default with prefersDark=false resolves to light
      expect(document.documentElement.classList.contains('light')).toBe(true);
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
    it('toggles from current theme to daylight', () => {
      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      fireEvent.click(screen.getByTestId('toggle'));
      expect(screen.getByTestId('resolved').textContent).toBe('daylight');
    });

    it('toggles from daylight back to system preference', () => {
      localStorage.setItem('jobproof-theme-mode', JSON.stringify('daylight'));
      localStorage.setItem('jobproof-daylight-mode', JSON.stringify(true));

      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('resolved').textContent).toBe('daylight');
      fireEvent.click(screen.getByTestId('toggle'));
      // With prefersDark=false, system resolves to light
      expect(screen.getByTestId('resolved').textContent).toBe('light');
    });

    it('cycles through themes: daylight -> system', () => {
      localStorage.setItem('jobproof-daylight-mode', JSON.stringify(true));
      localStorage.setItem('jobproof-theme-mode', JSON.stringify('daylight'));

      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('resolved').textContent).toBe('daylight');
      fireEvent.click(screen.getByTestId('toggle'));
      // System resolves based on prefers-color-scheme mock
      expect(['light', 'dark']).toContain(screen.getByTestId('resolved').textContent);
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
    it('returns dark when system prefers dark', () => {
      window.matchMedia = createMatchMediaMock(true);

      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      fireEvent.click(screen.getByTestId('set-system'));
      expect(screen.getByTestId('resolved').textContent).toBe('dark');
    });

    it('returns light when system prefers light', () => {
      window.matchMedia = createMatchMediaMock(false);

      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      fireEvent.click(screen.getByTestId('set-system'));
      expect(screen.getByTestId('resolved').textContent).toBe('light');
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

  // ============================================
  // NEW TESTS: Dark Mode and Theme Persistence
  // ============================================

  describe('Document Class Application', () => {
    it('applies resolved theme class to documentElement on initial render', () => {
      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      const resolved = screen.getByTestId('resolved').textContent;
      expect(document.documentElement.classList.contains(resolved!)).toBe(true);
      expect(document.documentElement.getAttribute('data-theme')).toBe(resolved);
    });

    it('removes all theme classes before applying new theme', () => {
      // Start with multiple classes applied (simulating corrupted state)
      document.documentElement.classList.add('light', 'dark', 'daylight');

      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      const resolved = screen.getByTestId('resolved').textContent!;
      // Should only have the resolved theme class
      expect(document.documentElement.classList.contains(resolved)).toBe(true);
      const otherThemes = ['light', 'dark', 'daylight'].filter(t => t !== resolved);
      otherThemes.forEach(t => {
        expect(document.documentElement.classList.contains(t)).toBe(false);
      });
    });

    it('sets data-theme attribute matching resolved theme', () => {
      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      fireEvent.click(screen.getByTestId('set-daylight'));
      expect(document.documentElement.getAttribute('data-theme')).toBe('daylight');

      fireEvent.click(screen.getByTestId('set-dark'));
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });

  describe('Dark Mode - localStorage Persistence', () => {
    it('persists dark theme to localStorage when set', () => {
      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      // Start with daylight, then switch to dark
      fireEvent.click(screen.getByTestId('set-daylight'));
      fireEvent.click(screen.getByTestId('set-dark'));

      const storedTheme = JSON.parse(localStorage.getItem('jobproof-theme-mode') || 'null');
      expect(storedTheme).toBe('dark');
    });

    it('persists daylight mode enabled state to localStorage', () => {
      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      fireEvent.click(screen.getByTestId('enable-daylight'));

      const storedDaylight = JSON.parse(localStorage.getItem('jobproof-daylight-mode') || 'null');
      expect(storedDaylight).toBe(true);
    });

    it('restores theme from localStorage on mount (simulated reload)', () => {
      // Set up localStorage as if user had selected daylight mode
      localStorage.setItem('jobproof-theme-mode', JSON.stringify('daylight'));
      localStorage.setItem('jobproof-daylight-mode', JSON.stringify(true));

      // Mount component (simulating page reload)
      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('theme').textContent).toBe('daylight');
      expect(screen.getByTestId('daylight').textContent).toBe('yes');
      expect(document.documentElement.classList.contains('daylight')).toBe(true);
    });
  });

  describe('Daylight Mode - Safety Orange and Touch Targets', () => {
    it('exports safety orange (#FF8C00) as primary color in DAYLIGHT_TOKENS', () => {
      expect(DAYLIGHT_TOKENS.primary).toBe('#FF8C00');
    });

    it('exports 56px touch target size for gloved hands', () => {
      expect(DAYLIGHT_TOKENS.touchTarget).toBe('56px');
    });

    it('exports anti-glare background color (#F8FAFC)', () => {
      expect(DAYLIGHT_TOKENS.background).toBe('#F8FAFC');
    });

    it('exports high-contrast text color (#1E293B) for outdoor readability', () => {
      expect(DAYLIGHT_TOKENS.text).toBe('#1E293B');
    });
  });

  describe('System Theme Mode - Prefers Color Scheme', () => {
    it('system mode resolves to light when system prefers light', () => {
      window.matchMedia = createMatchMediaMock(false); // prefers-light

      render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      fireEvent.click(screen.getByTestId('set-system'));
      expect(screen.getByTestId('resolved').textContent).toBe('light');
    });

    it('registers listener for prefers-color-scheme changes in system mode', () => {
      const mockAddListener = vi.fn();
      const mockRemoveListener = vi.fn();

      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: mockAddListener,
        removeEventListener: mockRemoveListener,
        dispatchEvent: vi.fn(),
      }));

      const { unmount } = render(
        <ThemeProvider>
          <ThemeTestComponent />
        </ThemeProvider>
      );

      fireEvent.click(screen.getByTestId('set-system'));

      // Verify listener was registered
      expect(mockAddListener).toHaveBeenCalledWith('change', expect.any(Function));

      // Unmount and verify cleanup
      unmount();
      expect(mockRemoveListener).toHaveBeenCalledWith('change', expect.any(Function));
    });
  });

  describe('DAYLIGHT_TOKENS - Complete Token Validation', () => {
    it('exports all required design tokens', () => {
      expect(DAYLIGHT_TOKENS).toHaveProperty('primary');
      expect(DAYLIGHT_TOKENS).toHaveProperty('background');
      expect(DAYLIGHT_TOKENS).toHaveProperty('text');
      expect(DAYLIGHT_TOKENS).toHaveProperty('borderWidth');
      expect(DAYLIGHT_TOKENS).toHaveProperty('touchTarget');
      expect(DAYLIGHT_TOKENS).toHaveProperty('fontWeight');
      expect(DAYLIGHT_TOKENS).toHaveProperty('letterSpacing');
      expect(DAYLIGHT_TOKENS).toHaveProperty('lineHeight');
    });

    it('exports border width of 2px for sunlight visibility', () => {
      expect(DAYLIGHT_TOKENS.borderWidth).toBe('2px');
    });

    it('exports font weight 600 for outdoor readability', () => {
      expect(DAYLIGHT_TOKENS.fontWeight).toBe(600);
    });
  });
});
