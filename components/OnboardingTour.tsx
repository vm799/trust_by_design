
import React, { useState } from 'react';

interface TourStep {
  title: string;
  description: string;
  targetId: string;
  icon: string;
}

interface OnboardingTourProps {
  onComplete: () => void;
  persona?: string;
  counts?: { clients: number; techs: number; jobs: number };
}

const OnboardingTour: React.FC<OnboardingTourProps> = ({ onComplete, persona, counts }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const getSteps = (): (TourStep & { isCompleted?: boolean, actionHtml?: React.ReactNode })[] => {
    const baseSteps: (TourStep & { isCompleted?: boolean, actionHtml?: React.ReactNode })[] = [
      {
        title: "Welcome to JobProof",
        description: `As a ${persona?.replace('_', ' ') || 'User'}, your dashboard is now initialised. This tour will guide you through your first capture.`,
        targetId: "nav-dashboard",
        icon: "verified",
        isCompleted: true
      }
    ];

    if (persona === 'agency_owner' || !persona) { // Default to Manager flow if undefined
      const steps = [...baseSteps];

      // Step: Add Technician (Build Workforce)
      steps.push({
        title: "Build Your Workforce",
        description: "Initialise your workforce first. Add technicians who will be capturing evidence in the field.",
        targetId: "qs-tech",
        icon: "engineering",
        isCompleted: (counts?.techs ?? 0) > 0,
        actionHtml: <span className="text-warning text-xs font-black uppercase">Click 'Authorise Tech' below</span>
      });

      // Step: Add Client (Protocol Registry)
      steps.push({
        title: "Protocol Registry",
        description: "Populate your hub with clients. Verified dispatches require a registered target.",
        targetId: "qs-client",
        icon: "person_check",
        isCompleted: (counts?.clients ?? 0) > 0,
        actionHtml: <span className="text-warning text-xs font-black uppercase">Click 'Register Client' below</span>
      });

      // Step: Dispatch (Initialise Dispatch)
      // Only show this if previous steps are done? Or always?
      // Requirement: Force Create Job.
      steps.push({
        title: "Initialise Dispatch",
        description: "Once ready, use the Dispatch button to create a new protocol for a technician.",
        targetId: "qs-dispatch",
        icon: "send",
        isCompleted: (counts?.jobs ?? 0) > 0,
        actionHtml: <span className="text-warning text-xs font-black uppercase">Click 'Dispatch Protocol' below</span>
      });

      return steps;
    }

    if (persona === 'solo_contractor') {
      return [
        ...baseSteps,
        {
          title: "Client Registry",
          description: "First, add your customers. Every verifiable report is linked to a client identity.",
          targetId: "qs-client",
          icon: "group",
          isCompleted: (counts?.clients ?? 0) > 0
        },
        {
          title: "Deploy Dispatch",
          description: "Starting a job is instant. Use 'Dispatch' to create your on-site evidence protocol.",
          targetId: "qs-dispatch",
          icon: "photo_camera",
          isCompleted: (counts?.jobs ?? 0) > 0
        }
      ];
    }

    if (persona === 'technician' || persona === 'contractor') {
      return [
        ...baseSteps,
        {
          title: "Your Assignments",
          description: "Here are your active protocols. Tap any card to begin capturing evidence.",
          targetId: "job-list-container",
          icon: "assignment",
          isCompleted: false
        },
        {
          title: "Offline Ready",
          description: "You can complete these jobs without internet. Evidence will sync automatically when you're back online.",
          targetId: "nav-dashboard",
          icon: "cloud_off",
          isCompleted: true
        }
      ];
    }

    // Fallback
    return baseSteps;
  };

  const steps = getSteps();
  // Safe bounds check
  const actualStepIndex = Math.min(currentStep, steps.length - 1);
  const step = steps[actualStepIndex];

  // Highlight target element
  React.useEffect(() => {
    if (!step) return;
    const target = document.getElementById(step.targetId);
    if (target) {
      target.classList.add('ring-4', 'ring-primary', 'ring-offset-4', 'ring-offset-slate-950', 'animate-pulse', 'z-[101]', 'relative');
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return () => {
      if (target) {
        target.classList.remove('ring-4', 'ring-primary', 'ring-offset-4', 'ring-offset-slate-950', 'animate-pulse', 'z-[101]', 'relative');
      }
    };
  }, [actualStepIndex, step?.targetId]);

  const next = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  if (!step) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-white/10 p-10 rounded-[3rem] max-w-lg w-full shadow-2xl space-y-8 animate-in relative overflow-hidden">
        <div className="absolute top-0 left-0 h-1 bg-primary transition-all duration-300" style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}></div>

        <button
          onClick={onComplete}
          className="absolute top-6 right-8 text-slate-500 hover:text-white text-xs font-black uppercase tracking-widest transition-colors"
        >
          Skip Tour
        </button>

        <div className="text-center space-y-4">
          <div className="bg-primary/20 size-16 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-primary/10">
            <span className="material-symbols-outlined text-primary text-4xl font-black">{step.icon}</span>
          </div>
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase">{step.title}</h2>
          <p className="text-slate-400 text-sm leading-relaxed font-medium">{step.description}</p>
          {!step.isCompleted && step.actionHtml && (
            <div className="bg-warning/10 border border-warning/20 p-2 rounded-lg inline-block">
              {step.actionHtml}
            </div>
          )}
        </div>

        <div className="flex gap-4">
          {currentStep > 0 && (
            <button
              onClick={() => setCurrentStep(currentStep - 1)}
              className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black text-sm uppercase transition-all tracking-widest"
            >
              Back
            </button>
          )}
          <button
            onClick={next}
            disabled={!step.isCompleted}
            className="flex-[2] py-4 bg-primary hover:bg-primary-hover disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-2xl font-black text-sm uppercase transition-all shadow-xl shadow-primary/20 tracking-widest"
          >
            {!step.isCompleted ? "Complete Action" : (currentStep === steps.length - 1 ? "Initialise Hub" : "Continue")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingTour;
