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

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  actionLink,
  onAction
}) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-in">
    {/* Decorative background circles */}
    <div className="relative mb-8">
      <div className="absolute inset-0 bg-primary/5 rounded-full blur-3xl scale-150" />
      <div className="relative size-24 bg-gradient-to-br from-primary/20 to-primary/5 rounded-[2rem] flex items-center justify-center border border-primary/10">
        <span className="material-symbols-outlined text-primary text-5xl">{icon}</span>
      </div>
    </div>

    <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">
      {title}
    </h3>
    <p className="text-slate-400 text-sm max-w-md mb-8">
      {description}
    </p>

    {actionLabel && (actionLink || onAction) && (
      actionLink ? (
        <Link
          to={actionLink}
          className="px-8 py-4 bg-primary hover:bg-primary-hover text-white font-black rounded-2xl uppercase tracking-widest text-sm shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center gap-2"
        >
          <span className="material-symbols-outlined">add</span>
          {actionLabel}
        </Link>
      ) : (
        <button
          onClick={onAction}
          className="px-8 py-4 bg-primary hover:bg-primary-hover text-white font-black rounded-2xl uppercase tracking-widest text-sm shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center gap-2"
        >
          <span className="material-symbols-outlined">add</span>
          {actionLabel}
        </button>
      )
    )}
  </div>
);

export default EmptyState;
