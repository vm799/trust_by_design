import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';

/**
 * Phase 5.5: Dark-only theme
 * All theme options now resolve to dark mode for consistent premium experience
 */

type Theme = 'light' | 'dark' | 'system' | 'auto';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
  isEvening: boolean;
  toggleDayNight: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Determines if it's evening based on local time
 * Kept for API compatibility but not used for theme selection
 */
function getIsEvening(): boolean {
  const hour = new Date().getHours();
  return hour >= 18 || hour < 6;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isEvening, setIsEvening] = useState(getIsEvening);

  // Phase 5.5: Always store 'dark' regardless of what's passed
  const [theme, setThemeInternal] = useState<Theme>('dark');

  // Phase 5.5: Always resolve to dark
  const resolvedTheme: 'light' | 'dark' = 'dark';

  // setTheme now ignores the value and keeps dark
  const setTheme = useCallback((_theme: Theme) => {
    // Phase 5.5: Force dark-only, ignore any theme changes
    setThemeInternal('dark');
  }, []);

  // Toggle is now a no-op (kept for API compatibility)
  const toggleDayNight = useCallback(() => {
    // Phase 5.5: No-op - always dark
  }, []);

  // Update evening status every minute (kept for API compatibility)
  useEffect(() => {
    const updateEvening = () => setIsEvening(getIsEvening());
    const interval = setInterval(updateEvening, 60000);
    return () => clearInterval(interval);
  }, []);

  // Ensure dark class is always set on mount
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light');
    root.classList.add('dark');
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme, isEvening, toggleDayNight }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
