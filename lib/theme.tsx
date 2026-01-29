import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from 'react';

/**
 * PhD-Level Destructive Refactor: Dynamic Day Mode Theme System
 *
 * Architecture:
 * - State Machine approach for theme transitions
 * - Storage Wrapper for localStorage with type safety
 * - Tokenized styling through CSS variables
 * - High-visibility "Construction Mode" for outdoor use
 *
 * Construction Mode Palette:
 * - Primary: #FF8C00 (Safety Orange) - High-visibility CTAs
 * - Background: #F8FAFC (Anti-glare Gray) - Reduces eye strain in sunlight
 * - Text: #1E293B (High-contrast Slate) - Legible in bright conditions
 * - Borders: 2px solid for 100% sunlight visibility
 */

// ============================================
// TYPE DEFINITIONS (Strict - No 'any')
// ============================================

/** Theme mode options */
type ThemeMode = 'light' | 'dark' | 'system' | 'auto' | 'daylight';

/** Resolved theme after system preference evaluation */
type ResolvedTheme = 'light' | 'dark' | 'daylight';

/** Theme state machine states */
type ThemeState = 'idle' | 'hydrating' | 'ready' | 'transitioning';

/** Storage keys for theme persistence */
const STORAGE_KEYS = {
  THEME: 'jobproof-theme-mode',
  DAYLIGHT_ENABLED: 'jobproof-daylight-mode',
  DAYLIGHT_AUTO: 'jobproof-daylight-auto',
} as const;

/** Theme context interface */
interface ThemeContextType {
  /** Current theme mode setting */
  theme: ThemeMode;
  /** Set theme mode (respects state machine) */
  setTheme: (theme: ThemeMode) => void;
  /** Resolved theme after system/auto evaluation */
  resolvedTheme: ResolvedTheme;
  /** Whether it's evening (6PM-6AM local time) */
  isEvening: boolean;
  /** Toggle between day/night modes */
  toggleDayNight: () => void;
  /** Enable/disable daylight (construction) mode */
  setDaylightMode: (enabled: boolean) => void;
  /** Whether daylight mode is currently active */
  isDaylightMode: boolean;
  /** Auto-enable daylight mode based on ambient conditions */
  daylightAuto: boolean;
  /** Toggle daylight auto mode */
  setDaylightAuto: (auto: boolean) => void;
  /** Current state machine state */
  themeState: ThemeState;
}

// ============================================
// STORAGE WRAPPER (Type-Safe localStorage)
// ============================================

interface StorageWrapper {
  get<T>(key: string, defaultValue: T): T;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
}

const createStorageWrapper = (): StorageWrapper => {
  const isAvailable = (): boolean => {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  };

  const available = isAvailable();

  return {
    get<T>(key: string, defaultValue: T): T {
      if (!available) return defaultValue;
      try {
        const item = localStorage.getItem(key);
        if (item === null) return defaultValue;
        return JSON.parse(item) as T;
      } catch {
        return defaultValue;
      }
    },
    set<T>(key: string, value: T): void {
      if (!available) return;
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Storage quota exceeded or other error - fail silently
      }
    },
    remove(key: string): void {
      if (!available) return;
      try {
        localStorage.removeItem(key);
      } catch {
        // Fail silently
      }
    },
  };
};

const storage = createStorageWrapper();

// ============================================
// TIME UTILITIES
// ============================================

/** Check if current time is evening (6PM-6AM) */
function getIsEvening(): boolean {
  const hour = new Date().getHours();
  return hour >= 18 || hour < 6;
}

/** Check if likely in bright outdoor conditions (7AM-5PM) */
function getIsDaytimeOutdoor(): boolean {
  const hour = new Date().getHours();
  return hour >= 7 && hour < 17;
}

// ============================================
// SYSTEM PREFERENCE DETECTION
// ============================================

function getSystemPreference(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// ============================================
// THEME CONTEXT
// ============================================

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ============================================
// THEME PROVIDER
// ============================================

interface ThemeProviderProps {
  children: ReactNode;
  /** Force a specific theme (useful for testing) */
  forceTheme?: ThemeMode;
}

export function ThemeProvider({ children, forceTheme }: ThemeProviderProps) {
  // State machine state
  const [themeState, setThemeState] = useState<ThemeState>('idle');

  // Core theme state
  const [theme, setThemeInternal] = useState<ThemeMode>(() => {
    if (forceTheme) return forceTheme;
    return storage.get<ThemeMode>(STORAGE_KEYS.THEME, 'dark');
  });

  // Daylight mode state
  const [isDaylightMode, setIsDaylightMode] = useState<boolean>(() =>
    storage.get<boolean>(STORAGE_KEYS.DAYLIGHT_ENABLED, false)
  );

  const [daylightAuto, setDaylightAutoInternal] = useState<boolean>(() =>
    storage.get<boolean>(STORAGE_KEYS.DAYLIGHT_AUTO, false)
  );

  // Time-based state
  const [isEvening, setIsEvening] = useState(getIsEvening);

  // ==========================================
  // RESOLVED THEME COMPUTATION
  // ==========================================

  const resolvedTheme = useMemo((): ResolvedTheme => {
    // Daylight mode takes precedence when enabled
    if (isDaylightMode) return 'daylight';

    switch (theme) {
      case 'light':
        return 'light';
      case 'dark':
        return 'dark';
      case 'daylight':
        return 'daylight';
      case 'system':
        return getSystemPreference();
      case 'auto':
        return isEvening ? 'dark' : 'light';
      default:
        return 'dark';
    }
  }, [theme, isEvening, isDaylightMode]);

  // ==========================================
  // THEME SETTERS
  // ==========================================

  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState('transitioning');
    setThemeInternal(newTheme);
    storage.set(STORAGE_KEYS.THEME, newTheme);

    // If setting daylight theme directly
    if (newTheme === 'daylight') {
      setIsDaylightMode(true);
      storage.set(STORAGE_KEYS.DAYLIGHT_ENABLED, true);
    } else if (isDaylightMode) {
      // Disable daylight mode when switching to other themes
      setIsDaylightMode(false);
      storage.set(STORAGE_KEYS.DAYLIGHT_ENABLED, false);
    }

    // Transition complete
    requestAnimationFrame(() => setThemeState('ready'));
  }, [isDaylightMode]);

  const toggleDayNight = useCallback(() => {
    if (isDaylightMode) {
      // From daylight -> dark
      setIsDaylightMode(false);
      storage.set(STORAGE_KEYS.DAYLIGHT_ENABLED, false);
      setThemeInternal('dark');
      storage.set(STORAGE_KEYS.THEME, 'dark');
    } else if (resolvedTheme === 'dark') {
      // From dark -> light
      setThemeInternal('light');
      storage.set(STORAGE_KEYS.THEME, 'light');
    } else {
      // From light -> dark
      setThemeInternal('dark');
      storage.set(STORAGE_KEYS.THEME, 'dark');
    }
  }, [resolvedTheme, isDaylightMode]);

  const setDaylightMode = useCallback((enabled: boolean) => {
    setIsDaylightMode(enabled);
    storage.set(STORAGE_KEYS.DAYLIGHT_ENABLED, enabled);

    if (enabled) {
      setThemeInternal('daylight');
      storage.set(STORAGE_KEYS.THEME, 'daylight');
    } else {
      // Reset to dark when disabling daylight mode
      setThemeInternal('dark');
      storage.set(STORAGE_KEYS.THEME, 'dark');
    }
  }, []);

  const setDaylightAuto = useCallback((auto: boolean) => {
    setDaylightAutoInternal(auto);
    storage.set(STORAGE_KEYS.DAYLIGHT_AUTO, auto);
  }, []);

  // ==========================================
  // EFFECTS
  // ==========================================

  // Hydrate from storage on mount (skip if forceTheme is provided)
  useEffect(() => {
    setThemeState('hydrating');

    // Skip storage hydration when forceTheme is provided (testing mode)
    if (forceTheme) {
      setThemeState('ready');
      return;
    }

    const storedTheme = storage.get<ThemeMode>(STORAGE_KEYS.THEME, 'dark');
    const storedDaylight = storage.get<boolean>(STORAGE_KEYS.DAYLIGHT_ENABLED, false);
    const storedDaylightAuto = storage.get<boolean>(STORAGE_KEYS.DAYLIGHT_AUTO, false);

    setThemeInternal(storedTheme);
    setIsDaylightMode(storedDaylight);
    setDaylightAutoInternal(storedDaylightAuto);
    setThemeState('ready');
  }, [forceTheme]);

  // Auto daylight mode based on time
  useEffect(() => {
    if (!daylightAuto) return;

    const shouldEnableDaylight = getIsDaytimeOutdoor();
    if (shouldEnableDaylight !== isDaylightMode) {
      setIsDaylightMode(shouldEnableDaylight);
      storage.set(STORAGE_KEYS.DAYLIGHT_ENABLED, shouldEnableDaylight);
    }
  }, [daylightAuto, isDaylightMode]);

  // Update evening status every minute
  useEffect(() => {
    const updateEvening = () => setIsEvening(getIsEvening());
    const interval = setInterval(updateEvening, 60000);
    return () => clearInterval(interval);
  }, []);

  // Apply theme class to document
  useEffect(() => {
    const root = document.documentElement;

    // Remove all theme classes
    root.classList.remove('light', 'dark', 'daylight');

    // Apply resolved theme class
    root.classList.add(resolvedTheme);

    // Set data attribute for CSS selectors
    root.setAttribute('data-theme', resolvedTheme);
  }, [resolvedTheme]);

  // Listen for system preference changes
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      // Force re-evaluation of resolved theme
      setThemeInternal(prev => prev);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  // ==========================================
  // CONTEXT VALUE
  // ==========================================

  const contextValue = useMemo((): ThemeContextType => ({
    theme,
    setTheme,
    resolvedTheme,
    isEvening,
    toggleDayNight,
    setDaylightMode,
    isDaylightMode,
    daylightAuto,
    setDaylightAuto,
    themeState,
  }), [
    theme,
    setTheme,
    resolvedTheme,
    isEvening,
    toggleDayNight,
    setDaylightMode,
    isDaylightMode,
    daylightAuto,
    setDaylightAuto,
    themeState,
  ]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

// ============================================
// HOOK
// ============================================

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

// ============================================
// THEME TOKENS (Design System)
// ============================================

/**
 * Construction Mode Design Tokens
 * Use these in components for consistent styling
 */
export const DAYLIGHT_TOKENS = {
  /** Primary Safety Orange - CTAs and critical actions */
  primary: '#FF8C00',
  /** Anti-glare background - reduces eye strain outdoors */
  background: '#F8FAFC',
  /** High-contrast text - legible in bright sunlight */
  text: '#1E293B',
  /** Border width for sunlight visibility */
  borderWidth: '2px',
  /** Minimum touch target for gloved hands */
  touchTarget: '56px',
  /** Font weight for outdoor readability */
  fontWeight: 600,
  /** Letter spacing for outdoor readability */
  letterSpacing: '-0.01em',
  /** Line height for outdoor readability */
  lineHeight: 1.5,
} as const;

/**
 * Neobrutalist shadow for outdoor button visibility
 * The hard shadow keeps buttons visible even when screen is washed out by sun
 */
export const NEOBRUTALIST_SHADOW = '4px 4px 0px #000000';

/**
 * Type-safe theme token getter
 */
export function getThemeToken<K extends keyof typeof DAYLIGHT_TOKENS>(
  key: K
): typeof DAYLIGHT_TOKENS[K] {
  return DAYLIGHT_TOKENS[key];
}
