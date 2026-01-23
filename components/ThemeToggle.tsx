import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../lib/theme';

/**
 * Crisp Day/Night Toggle Button
 * Visual toggle switch with sun/moon animation
 */
export const ThemeToggle: React.FC = () => {
  const { theme, setTheme, resolvedTheme, toggleDayNight, isEvening } = useTheme();

  const isDark = resolvedTheme === 'dark';

  const cycleTheme = () => {
    // Cycle: light → dark → auto → system → light
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('auto');
    else if (theme === 'auto') setTheme('system');
    else setTheme('light');
  };

  const getLabel = () => {
    if (theme === 'auto') return 'Auto';
    if (theme === 'system') return 'System';
    return isDark ? 'Night' : 'Day';
  };

  const getIcon = () => {
    if (theme === 'auto') return 'schedule';
    if (theme === 'system') return 'computer';
    return isDark ? 'dark_mode' : 'light_mode';
  };

  return (
    <div className="flex items-center gap-2">
      {/* Quick Day/Night Toggle */}
      <button
        onClick={toggleDayNight}
        className={`
          relative w-14 h-8 rounded-full p-1 transition-all duration-500 ease-out
          ${isDark
            ? 'bg-gradient-to-r from-indigo-600 to-indigo-800 shadow-lg shadow-indigo-500/30'
            : 'bg-gradient-to-r from-amber-300 to-orange-400 shadow-lg shadow-amber-500/30'
          }
        `}
        aria-label={`Switch to ${isDark ? 'day' : 'night'} mode`}
        title={`Switch to ${isDark ? 'day' : 'night'} mode`}
      >
        {/* Track decoration - stars/clouds */}
        <div className="absolute inset-0 overflow-hidden rounded-full">
          {/* Stars (visible in dark mode) */}
          <motion.div
            className="absolute inset-0"
            animate={{ opacity: isDark ? 1 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="absolute top-1 left-2 w-1 h-1 bg-white/60 rounded-full" />
            <div className="absolute top-2.5 left-4 w-0.5 h-0.5 bg-white/40 rounded-full" />
            <div className="absolute bottom-2 left-3 w-0.5 h-0.5 bg-white/50 rounded-full" />
          </motion.div>

          {/* Clouds (visible in light mode) */}
          <motion.div
            className="absolute inset-0"
            animate={{ opacity: isDark ? 0 : 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="absolute top-1.5 right-2 w-2 h-1 bg-white/50 rounded-full" />
            <div className="absolute bottom-1.5 right-3 w-1.5 h-0.5 bg-white/40 rounded-full" />
          </motion.div>
        </div>

        {/* Toggle Knob with Sun/Moon */}
        <motion.div
          className={`
            relative w-6 h-6 rounded-full flex items-center justify-center
            ${isDark
              ? 'bg-slate-200'
              : 'bg-amber-50'
            }
            shadow-md
          `}
          animate={{
            x: isDark ? 24 : 0,
          }}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 30,
          }}
        >
          {/* Sun */}
          <motion.span
            className="material-symbols-outlined text-amber-500 text-sm absolute"
            style={{ fontVariationSettings: "'FILL' 1" }}
            animate={{
              scale: isDark ? 0 : 1,
              rotate: isDark ? -90 : 0,
              opacity: isDark ? 0 : 1,
            }}
            transition={{ duration: 0.3 }}
          >
            light_mode
          </motion.span>

          {/* Moon */}
          <motion.span
            className="material-symbols-outlined text-indigo-600 text-sm absolute"
            style={{ fontVariationSettings: "'FILL' 1" }}
            animate={{
              scale: isDark ? 1 : 0,
              rotate: isDark ? 0 : 90,
              opacity: isDark ? 1 : 0,
            }}
            transition={{ duration: 0.3 }}
          >
            dark_mode
          </motion.span>
        </motion.div>
      </button>

      {/* Mode Selector (compact) */}
      <button
        onClick={cycleTheme}
        className={`
          flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all active:scale-95
          ${isDark
            ? 'bg-slate-800 hover:bg-slate-700 border border-white/10'
            : 'bg-white hover:bg-slate-50 border border-slate-200 shadow-sm'
          }
        `}
        aria-label={`Theme mode: ${getLabel()}. Click to change.`}
        title={`Theme mode: ${getLabel()}`}
      >
        <span
          className={`
            material-symbols-outlined text-sm
            ${isDark ? 'text-slate-300' : 'text-slate-600'}
          `}
        >
          {getIcon()}
        </span>
        <span
          className={`
            text-[10px] font-bold uppercase tracking-wider hidden sm:inline
            ${isDark ? 'text-slate-300' : 'text-slate-600'}
          `}
        >
          {getLabel()}
        </span>
      </button>
    </div>
  );
};

/**
 * Compact variant for navbar use
 */
export const ThemeToggleCompact: React.FC = () => {
  const { resolvedTheme, toggleDayNight } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      onClick={toggleDayNight}
      className={`
        relative w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95
        ${isDark
          ? 'bg-slate-800 hover:bg-slate-700 border border-white/10'
          : 'bg-white hover:bg-slate-50 border border-slate-200 shadow-sm'
        }
      `}
      aria-label={`Switch to ${isDark ? 'day' : 'night'} mode`}
    >
      <motion.span
        className={`
          material-symbols-outlined text-xl
          ${isDark ? 'text-amber-400' : 'text-indigo-600'}
        `}
        style={{ fontVariationSettings: "'FILL' 1" }}
        animate={{
          rotate: isDark ? 0 : 360,
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 0.5 }}
        key={isDark ? 'moon' : 'sun'}
      >
        {isDark ? 'light_mode' : 'dark_mode'}
      </motion.span>
    </button>
  );
};

export default ThemeToggle;
