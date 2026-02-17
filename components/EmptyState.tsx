import React from 'react';
import { Link } from 'react-router-dom';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionLink?: string;
  onAction?: () => void;
}

/** SVG illustration mapped by icon name for contextual empty states */
const illustrations: Record<string, React.ReactNode> = {
  work: (
    <svg viewBox="0 0 120 120" fill="none" className="size-28 mx-auto" aria-hidden="true">
      <rect x="20" y="40" width="80" height="55" rx="8" className="fill-primary/10 stroke-primary/30" strokeWidth="2" />
      <rect x="35" y="28" width="50" height="12" rx="4" className="fill-primary/15 stroke-primary/20" strokeWidth="1.5" />
      <circle cx="60" cy="67" r="12" className="fill-primary/20 stroke-primary/40" strokeWidth="2" />
      <path d="M56 67l3 3 5-6" className="stroke-primary" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  group: (
    <svg viewBox="0 0 120 120" fill="none" className="size-28 mx-auto" aria-hidden="true">
      <circle cx="60" cy="45" r="16" className="fill-primary/15 stroke-primary/30" strokeWidth="2" />
      <path d="M32 95c0-15.5 12.5-28 28-28s28 12.5 28 28" className="fill-primary/10 stroke-primary/30" strokeWidth="2" />
      <circle cx="90" cy="50" r="10" className="fill-primary/10 stroke-primary/20" strokeWidth="1.5" />
      <path d="M78 88c0-8.8 5.4-16.3 12-19.5" className="stroke-primary/20" strokeWidth="1.5" />
    </svg>
  ),
  engineering: (
    <svg viewBox="0 0 120 120" fill="none" className="size-28 mx-auto" aria-hidden="true">
      <circle cx="60" cy="50" r="18" className="fill-primary/15 stroke-primary/30" strokeWidth="2" />
      <rect x="42" y="28" width="36" height="8" rx="4" className="fill-primary/10 stroke-primary/20" strokeWidth="1.5" />
      <path d="M35 95c0-13.8 11.2-25 25-25s25 11.2 25 25" className="fill-primary/10 stroke-primary/30" strokeWidth="2" />
      <path d="M52 50l4 4 8-8" className="stroke-primary" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  actionLink,
  onAction
}) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-in">
    {/* SVG illustration or icon fallback */}
    <div className="relative mb-6">
      {illustrations[icon] ? (
        illustrations[icon]
      ) : (
        <>
          <div className="absolute inset-0 bg-primary/5 rounded-full blur-3xl scale-150" />
          <div className="relative size-24 bg-gradient-to-br from-primary/20 to-primary/5 rounded-[2rem] flex items-center justify-center border border-primary/10">
            <span className="material-symbols-outlined text-primary text-5xl">{icon}</span>
          </div>
        </>
      )}
    </div>

    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
      {title}
    </h3>
    <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mb-8 leading-relaxed">
      {description}
    </p>

    {actionLabel && (actionLink || onAction) && (
      actionLink ? (
        <Link
          to={actionLink}
          className="px-8 py-4 bg-primary hover:bg-primary-hover text-white font-semibold rounded-2xl text-sm shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center gap-2 min-h-[44px]"
        >
          <span className="material-symbols-outlined">add</span>
          {actionLabel}
        </Link>
      ) : (
        <button
          onClick={onAction}
          className="px-8 py-4 bg-primary hover:bg-primary-hover text-white font-semibold rounded-2xl text-sm shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center gap-2 min-h-[44px]"
        >
          <span className="material-symbols-outlined">add</span>
          {actionLabel}
        </button>
      )
    )}
  </div>
);

export default EmptyState;
