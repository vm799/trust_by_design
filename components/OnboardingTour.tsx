import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface TourStep {
  title: string;
  description: string;
  targetId: string;
  icon: string;
  isCompleted?: boolean;
  actionLabel?: string;
  actionRoute?: string;
}

interface OnboardingTourProps {
  onComplete: () => void;
  persona?: string;
  counts?: { clients: number; techs: number; jobs: number };
}

/**
 * Onboarding Tour with clickable action buttons
 * Each step has an actual button to complete the action
 */
const OnboardingTour: React.FC<OnboardingTourProps> = ({ onComplete, persona, counts }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  const getSteps = (): TourStep[] => {
    const baseSteps: TourStep[] = [
      {
        title: "Welcome to JobProof",
        description: `Your operations hub is ready. Let's set up your first evidence capture workflow.`,
        targetId: "nav-dashboard",
        icon: "verified",
        isCompleted: true
      }
    ];

    if (persona === 'agency_owner' || !persona) {
      return [
        ...baseSteps,
        {
          title: "Build Your Workforce",
          description: "Add technicians who will capture evidence in the field. They'll receive magic links to access assigned jobs.",
          targetId: "qs-tech",
          icon: "engineering",
          isCompleted: (counts?.techs ?? 0) > 0,
          actionLabel: "Authorise Technician",
          actionRoute: "/admin/technicians"
        },
        {
          title: "Register Clients",
          description: "Add your customers. Every job and evidence report is linked to a client.",
          targetId: "qs-client",
          icon: "person_check",
          isCompleted: (counts?.clients ?? 0) > 0,
          actionLabel: "Add Client",
          actionRoute: "/admin/clients"
        },
        {
          title: "Create Your First Job",
          description: "Dispatch a job to a technician. They'll capture timestamped, geotagged evidence.",
          targetId: "qs-dispatch",
          icon: "send",
          isCompleted: (counts?.jobs ?? 0) > 0,
          actionLabel: "Dispatch Job",
          actionRoute: "/admin/create"
        }
      ];
    }

    if (persona === 'solo_contractor') {
      return [
        ...baseSteps,
        {
          title: "Register Clients",
          description: "Add your customers first. Every evidence report is linked to a client.",
          targetId: "qs-client",
          icon: "group",
          isCompleted: (counts?.clients ?? 0) > 0,
          actionLabel: "Add Client",
          actionRoute: "/admin/clients"
        },
        {
          title: "Start Capturing",
          description: "Create a job and capture evidence with timestamps and location data.",
          targetId: "qs-dispatch",
          icon: "photo_camera",
          isCompleted: (counts?.jobs ?? 0) > 0,
          actionLabel: "Create Job",
          actionRoute: "/admin/create"
        }
      ];
    }

    if (persona === 'technician' || persona === 'contractor') {
      return [
        ...baseSteps,
        {
          title: "Your Assignments",
          description: "Your active jobs appear here. Tap any card to begin capturing evidence.",
          targetId: "job-list-container",
          icon: "assignment",
          isCompleted: true
        },
        {
          title: "Offline Ready",
          description: "Works without internet. Evidence syncs automatically when back online.",
          targetId: "nav-dashboard",
          icon: "cloud_off",
          isCompleted: true
        }
      ];
    }

    return baseSteps;
  };

  const steps = getSteps();
  const actualStepIndex = Math.min(currentStep, steps.length - 1);
  const step = steps[actualStepIndex];

  // Highlight target element
  const targetId = step?.targetId;
  React.useEffect(() => {
    if (!targetId) return;
    const target = document.getElementById(targetId);
    if (target) {
      target.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-slate-950', 'z-[101]', 'relative');
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return () => {
      if (target) {
        target.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-slate-950', 'z-[101]', 'relative');
      }
    };
  }, [actualStepIndex, targetId]);

  // Keyboard shortcuts
  const isCompleted = step?.isCompleted;
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        localStorage.setItem('jobproof_onboarding_v4', 'true');
        onComplete();
      }
      if (e.key === 'ArrowRight' && isCompleted) {
        e.preventDefault();
        if (currentStep < steps.length - 1) {
          setCurrentStep(currentStep + 1);
        } else {
          localStorage.setItem('jobproof_onboarding_v4', 'true');
          onComplete();
        }
      }
      if (e.key === 'ArrowLeft' && currentStep > 0) {
        e.preventDefault();
        setCurrentStep(currentStep - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep, isCompleted, steps.length, onComplete]);

  const next = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      localStorage.setItem('jobproof_onboarding_v4', 'true');
      onComplete();
    }
  };

  const handleSkip = () => {
    localStorage.setItem('jobproof_onboarding_v4', 'true');
    onComplete();
  };

  const handleAction = () => {
    if (step?.actionRoute) {
      localStorage.setItem('jobproof_onboarding_v4', 'true');
      onComplete();
      navigate(step.actionRoute);
    }
  };

  if (!step) return null;

  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
      <div className="bg-slate-900 border border-white/10 p-6 sm:p-8 rounded-2xl max-w-md w-full shadow-2xl space-y-6 relative">
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-slate-800 rounded-t-2xl overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Skip button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors"
        >
          Skip
        </button>

        {/* Step counter */}
        <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">
          Step {currentStep + 1} of {steps.length}
        </div>

        {/* Content */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/20 size-12 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-2xl">{step.icon}</span>
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">{step.title}</h2>
          </div>
          <p className="text-slate-400 text-sm leading-relaxed">{step.description}</p>
        </div>

        {/* Status indicator */}
        {step.isCompleted && (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
            <span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span>
            <span className="text-emerald-400 text-xs font-bold uppercase">Completed</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-3 pt-2">
          {/* Primary action button - only show if step has action and not completed */}
          {!step.isCompleted && step.actionLabel && (
            <button
              onClick={handleAction}
              className="w-full py-3.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-black text-sm uppercase tracking-wider transition-all active:scale-[0.98] shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">{step.icon}</span>
              {step.actionLabel}
            </button>
          )}

          {/* Navigation buttons */}
          <div className="flex gap-3">
            {currentStep > 0 && (
              <button
                onClick={() => setCurrentStep(currentStep - 1)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm uppercase transition-all active:scale-[0.98]"
              >
                Back
              </button>
            )}
            <button
              onClick={next}
              disabled={!step.isCompleted && !!step.actionLabel}
              className={`flex-1 py-3 rounded-xl font-bold text-sm uppercase transition-all active:scale-[0.98] ${
                step.isCompleted || !step.actionLabel
                  ? 'bg-white text-slate-900 hover:bg-slate-100'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {currentStep === steps.length - 1 ? "Finish" : "Next"}
            </button>
          </div>
        </div>

        {/* Keyboard hints */}
        <div className="flex items-center justify-center gap-4 text-[10px] text-slate-500 pt-2 border-t border-white/5">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[9px]">ESC</kbd> Skip
          </span>
          {step.isCompleted && (
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[9px]">→</kbd> Next
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingTour;
