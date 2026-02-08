import { useEffect, useState, useCallback } from 'react';

/**
 * Canvas Theme Colours
 * Optimized for legibility in both light and dark modes
 */
export interface CanvasThemeColours {
  bg: string;
  stroke: string;
  line: string;
}

/**
 * useCanvasTheme Hook
 *
 * Detects current theme preference and provides canvas-optimized colours.
 * Supports three detection methods:
 * 1. data-theme attribute on root element (primary, set by ThemeProvider)
 * 2. prefers-color-scheme media query (system preference)
 * 3. localStorage: jobproof-theme-mode (user preference)
 *
 * Returns theme colours suitable for HTML5 Canvas 2D context.
 * Subscribes to theme changes via MutationObserver and media query listener.
 *
 * @returns {CanvasThemeColours & { isDark: boolean }} Colour values and theme flag
 */
export function useCanvasTheme() {
  const [isDark, setIsDark] = useState(true); // Default to dark
  const [colours, setColours] = useState<CanvasThemeColours>({
    bg: '#1e293b',      // slate-800 (dark mode background)
    stroke: '#f1f5f9',  // slate-100 (light signature ink)
    line: '#64748b',    // slate-500 (visible divider)
  });

  /**
   * Determine if theme is dark based on multiple sources
   */
  const detectThemeIsDark = useCallback((): boolean => {
    // Priority 1: Check data-theme attribute (set by ThemeProvider)
    const root = document.documentElement;
    const dataTheme = root.getAttribute('data-theme');
    if (dataTheme === 'dark') return true;
    if (dataTheme === 'daylight') return false;

    // Priority 2: Check localStorage
    try {
      const stored = localStorage.getItem('jobproof-theme-mode');
      // Only 'dark' and 'daylight' are supported
      // 'daylight' = light mode for outdoor use
      // Anything else defaults to dark
      if (stored === 'daylight') return false;
      if (stored === 'dark' || stored === 'system') return true;
    } catch {
      // localStorage not available
    }

    // Priority 3: Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return true;
    }

    // Default to dark mode
    return true;
  }, []);

  /**
   * Get canvas colours based on theme
   */
  const getCanvasColours = useCallback((): CanvasThemeColours => {
    const dark = detectThemeIsDark();

    if (dark) {
      // Dark mode: light signature on dark canvas
      return {
        bg: '#1e293b',      // slate-800
        stroke: '#f1f5f9',  // slate-100
        line: '#64748b',    // slate-500
      };
    } else {
      // Light mode: dark signature on light canvas
      return {
        bg: '#f8fafc',      // slate-50 (matches original light mode)
        stroke: '#0f172a',  // slate-950
        line: '#cbd5e1',    // slate-300 (matches original)
      };
    }
  }, [detectThemeIsDark]);

  /**
   * Update colours when theme changes
   */
  const updateColours = useCallback(() => {
    const dark = detectThemeIsDark();
    const newColours = getCanvasColours();
    setIsDark(dark);
    setColours(newColours);
  }, [detectThemeIsDark, getCanvasColours]);

  /**
   * Listen for data-theme attribute changes (ThemeProvider updates)
   */
  useEffect(() => {
    const root = document.documentElement;

    // Initial setup
    updateColours();

    // Watch for data-theme attribute changes
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'data-theme'
        ) {
          updateColours();
        }
      }
    });

    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, [updateColours]);

  /**
   * Listen for prefers-color-scheme media query changes
   * (system preference changes)
   */
  useEffect(() => {
    if (!window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handler = () => {
      updateColours();
    };

    // Modern browsers: addEventListener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }

    // Legacy browsers: addListener
    mediaQuery.addListener(handler);
    return () => mediaQuery.removeListener(handler);
  }, [updateColours]);

  /**
   * Listen for localStorage changes (if changed in another tab)
   */
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'jobproof-theme-mode') {
        updateColours();
      }
    };

    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [updateColours]);

  return { ...colours, isDark };
}

/**
 * Export type for component usage
 */
export type CanvasTheme = ReturnType<typeof useCanvasTheme>;
