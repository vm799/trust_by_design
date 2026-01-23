import React from 'react';
import { useTheme } from '../lib/theme';

/**
 * Compact theme toggle - single button that cycles through modes
 * Light → Dark → System → Light
 */
export const ThemeToggle: React.FC = () => {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const getIcon = () => {
    if (theme === 'system') return 'routine';
    return resolvedTheme === 'light' ? 'light_mode' : 'dark_mode';
  };

  const getLabel = () => {
    if (theme === 'system') return 'Auto';
    return resolvedTheme === 'light' ? 'Light' : 'Dark';
  };

  return (
    <button
      onClick={cycleTheme}
      className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-white/10 transition-all active:scale-95"
      aria-label={`Theme: ${getLabel()}. Click to change.`}
      title={`Theme: ${getLabel()}`}
    >
      <span className="material-symbols-outlined text-sm text-slate-300">
        {getIcon()}
      </span>
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
        {getLabel()}
      </span>
    </button>
  );
};

export default ThemeToggle;
