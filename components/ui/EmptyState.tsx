/**
 * EmptyState - No Data Placeholder
 *
 * Displays when a list or section has no content.
 *
 * Phase A: Foundation & App Shell
 */

import React from 'react';
import { Link } from 'react-router-dom';
import ActionButton from './ActionButton';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick?: () => void;
    to?: string;
    icon?: string;
  };
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'inbox',
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      {/* Icon - Theme-aware */}
      <div className="size-16 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/5 flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-3xl text-slate-400 dark:text-slate-500">{icon}</span>
      </div>

      {/* Title - Theme-aware */}
      <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">{title}</h3>

      {/* Description - Theme-aware */}
      {description && (
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-sm">{description}</p>
      )}

      {/* Action */}
      {action && (
        <div className="mt-6">
          <ActionButton
            variant="primary"
            icon={action.icon}
            onClick={action.onClick}
            to={action.to}
          >
            {action.label}
          </ActionButton>
        </div>
      )}
    </div>
  );
};

export default EmptyState;
