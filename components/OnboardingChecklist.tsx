import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export interface OnboardingStep {
  id: string;
  label: string;
  description: string;
  status: 'completed' | 'in_progress' | 'locked';
  icon: string;
  action?: () => void;
  path?: string;
}

interface OnboardingChecklistProps {
  steps: OnboardingStep[];
  onDismiss?: () => void;
  collapsible?: boolean;
  user?: any;
}

/**
 * Persistent Onboarding Checklist
 * Inspired by Stripe, Linear, Vercel onboarding patterns
 *
 * Features:
 * - Always visible (not blocking)
 * - Collapsible to save space
 * - Visual progress indicator
 * - Clear next action
 * - Mobile-optimized
 */
const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({
  steps,
  onDismiss,
  collapsible = true,
  user
}) => {
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const totalSteps = steps.length;
  const progress = (completedSteps / totalSteps) * 100;
  const isComplete = completedSteps === totalSteps;

  const handleStepClick = (step: OnboardingStep) => {
    if (step.status === 'locked') return;
    if (step.action) {
      step.action();
    } else if (step.path) {
      navigate(step.path);
    }
  };

  if (isComplete && isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="bg-success/10 border border-success/20 p-3 rounded-2xl flex items-center gap-3 hover:bg-success/15 transition-all w-full group"
      >
        <div className="size-8 bg-success/20 rounded-xl flex items-center justify-center">
          <span className="material-symbols-outlined text-success text-lg">check_circle</span>
        </div>
        <div className="flex-1 text-left">
          <p className="text-xs font-black uppercase text-success tracking-tight">Setup Complete</p>
          <p className="text-[10px] text-success/70">Click to review</p>
        </div>
        <span className="material-symbols-outlined text-success/50 group-hover:text-success transition-colors">expand_more</span>
      </button>
    );
  }

  return (
    <div className="bg-slate-900 border border-white/10 rounded-[2rem] overflow-hidden shadow-xl animate-in">
      {/* Header */}
      <div className="p-4 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="size-6 bg-primary/20 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-sm">checklist</span>
            </div>
            <h3 className="text-xs font-black uppercase text-white tracking-tight">
              {isComplete ? 'Setup Complete!' : 'Get Started'}
            </h3>
          </div>
          {collapsible && (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-sm">
                {isCollapsed ? 'expand_more' : 'expand_less'}
              </span>
            </button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {completedSteps} of {totalSteps} complete
            </span>
            <span className="text-[10px] font-black text-primary">{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary-hover transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Steps List */}
      {!isCollapsed && (
        <div className="p-3 space-y-2">
          {steps.map((step, index) => (
            <button
              key={step.id}
              onClick={() => handleStepClick(step)}
              disabled={step.status === 'locked'}
              className={`
                w-full text-left p-3 rounded-xl transition-all group
                ${step.status === 'completed'
                  ? 'bg-success/5 border border-success/10 hover:bg-success/10'
                  : step.status === 'in_progress'
                    ? 'bg-primary/10 border border-primary/20 hover:bg-primary/15'
                    : 'bg-slate-800/50 border border-white/5 hover:bg-slate-800 cursor-not-allowed opacity-50'
                }
              `}
            >
              <div className="flex items-center gap-3">
                {/* Icon/Status Indicator */}
                <div className={`
                  size-7 rounded-lg flex items-center justify-center flex-shrink-0
                  ${step.status === 'completed'
                    ? 'bg-success/20 text-success'
                    : step.status === 'in_progress'
                      ? 'bg-primary/20 text-primary'
                      : 'bg-slate-700 text-slate-500'
                  }
                `}>
                  {step.status === 'completed' ? (
                    <span className="material-symbols-outlined text-sm font-black">check</span>
                  ) : step.status === 'locked' ? (
                    <span className="material-symbols-outlined text-sm">lock</span>
                  ) : (
                    <span className="material-symbols-outlined text-sm">{step.icon}</span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`
                      text-xs font-black uppercase tracking-tight truncate
                      ${step.status === 'completed'
                        ? 'text-success'
                        : step.status === 'in_progress'
                          ? 'text-white'
                          : 'text-slate-500'
                      }
                    `}>
                      {step.label}
                    </p>
                    {step.status === 'completed' && (
                      <span className="text-[8px] font-black uppercase text-success/70 tracking-widest">Done</span>
                    )}
                  </div>
                  <p className={`
                    text-[10px] font-medium mt-0.5 truncate
                    ${step.status === 'completed'
                      ? 'text-success/60'
                      : step.status === 'in_progress'
                        ? 'text-slate-400'
                        : 'text-slate-600'
                    }
                  `}>
                    {step.description}
                  </p>
                </div>

                {/* Arrow */}
                {step.status !== 'locked' && step.status !== 'completed' && (
                  <span className="material-symbols-outlined text-slate-500 group-hover:text-primary transition-colors text-sm">
                    chevron_right
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Footer - Show when complete */}
      {isComplete && !isCollapsed && onDismiss && (
        <div className="p-3 border-t border-white/5">
          <button
            onClick={onDismiss}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-white/5 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
          >
            Dismiss Checklist
          </button>
        </div>
      )}
    </div>
  );
};

export default OnboardingChecklist;
