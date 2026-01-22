import React from 'react';
import { useTheme } from '../lib/theme';

export const ThemeToggle: React.FC = () => {
  const { theme, setTheme, resolvedTheme } = useTheme();

  return (
    <div className="flex items-center gap-2 p-1 bg-slate-800 dark:bg-slate-900 rounded-xl border border-white/10">
      <button
        onClick={() => setTheme('light')}
        className={`px-3 py-1.5 rounded-lg transition-all ${
          resolvedTheme === 'light'
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-400 hover:text-slate-300'
        }`}
        aria-label="Light mode"
        title="Light mode"
      >
        <span className="material-symbols-outlined text-sm">light_mode</span>
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={`px-3 py-1.5 rounded-lg transition-all ${
          resolvedTheme === 'dark'
            ? 'bg-slate-700 text-white shadow-sm'
            : 'text-slate-400 hover:text-slate-300'
        }`}
        aria-label="Dark mode"
        title="Dark mode"
      >
        <span className="material-symbols-outlined text-sm">dark_mode</span>
      </button>
      <button
        onClick={() => setTheme('system')}
        className={`px-3 py-1.5 rounded-lg transition-all ${
          theme === 'system'
            ? 'bg-primary text-white shadow-sm'
            : 'text-slate-400 hover:text-slate-300'
        }`}
        aria-label="System theme"
        title="System theme"
      >
        <span className="material-symbols-outlined text-sm">computer</span>
      </button>
    </div>
  );
};

export default ThemeToggle;
