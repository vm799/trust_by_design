import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';

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
 * Evening: 6 PM - 6 AM (dark mode hours)
 */
function getIsEvening(): boolean {
  const hour = new Date().getHours();
  return hour >= 18 || hour < 6;
}

/**
 * Get theme based on time of day for 'auto' mode
 */
function getTimeBasedTheme(): 'light' | 'dark' {
  return getIsEvening() ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isEvening, setIsEvening] = useState(getIsEvening);

  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'auto';
    const stored = localStorage.getItem('jobproof_theme') as Theme;
    // Default to 'auto' (time-based) if no preference stored
    return stored || 'auto';
  });

  const getResolvedTheme = useCallback((): 'light' | 'dark' => {
    if (theme === 'auto') {
      return getTimeBasedTheme();
    }
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  }, [theme]);

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'dark';
    return getResolvedTheme();
  });

  // Toggle between light and dark directly
  const toggleDayNight = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme]);

  // Update evening status every minute
  useEffect(() => {
    const updateEvening = () => setIsEvening(getIsEvening());
    const interval = setInterval(updateEvening, 60000);
    return () => clearInterval(interval);
  }, []);

  // Apply theme changes
  useEffect(() => {
    const newResolvedTheme = getResolvedTheme();
    setResolvedTheme(newResolvedTheme);

    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(newResolvedTheme);
    localStorage.setItem('jobproof_theme', theme);
  }, [theme, getResolvedTheme]);

  // Listen for system preference changes when in 'system' mode
  useEffect(() => {
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => {
        const newTheme = e.matches ? 'dark' : 'light';
        setResolvedTheme(newTheme);
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(newTheme);
      };
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [theme]);

  // Update theme when time changes for 'auto' mode
  useEffect(() => {
    if (theme === 'auto') {
      const newResolvedTheme = getTimeBasedTheme();
      if (newResolvedTheme !== resolvedTheme) {
        setResolvedTheme(newResolvedTheme);
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(newResolvedTheme);
      }
    }
  }, [theme, isEvening, resolvedTheme]);

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
