
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
}

const OnboardingTour: React.FC<OnboardingTourProps> = ({ onComplete, persona }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const getSteps = (): TourStep[] => {
    const baseSteps: TourStep[] = [
      {
        title: "Welcome to JobProof",
        description: `As a ${persona?.replace('_', ' ') || 'User'}, your dashboard is now initialized. This tour will guide you through your first capture.`,
        targetId: "nav-dashboard",
        icon: "verified"
      }
    ];

    if (persona === 'agency_owner') {
      return [
        ...baseSteps,
        {
          title: "Build Your Workforce",
          description: "Initialize your workforce first. Add technicians who will be capturing evidence in the field.",
          targetId: "nav-techs",
          icon: "engineering"
        },
        {
          title: "Initialize Dispatch",
          description: "Once ready, use the Dispatch button to create a new protocol for a technician.",
          targetId: "btn-dispatch",
          icon: "send"
        },
        {
          title: "Monitor Operations",
          description: "The operations hub will populate with live field syncs and audit trails.",
          targetId: "nav-dashboard",
          icon: "security"
        }
      ];
    }

    if (persona === 'solo_contractor') {
      return [
        ...baseSteps,
        {
          title: "Capture Evidence",
          description: "Starting a job is instant. Use 'Dispatch' to create your on-site evidence protocol.",
          targetId: "btn-dispatch",
          icon: "photo_camera"
        },
        {
          title: "Protocol Registry",
          description: "Manage your client database and historical service records here.",
          targetId: "nav-clients",
          icon: "group"
        }
      ];
    }

    // Default Fallback
    return [
      ...baseSteps,
      {
        title: "Initialize Dispatch",
        description: "Dispatch your first job to see the operational flow or explore your toolkit below.",
        targetId: "btn-dispatch",
        icon: "send"
      }
    ];
  };

  const steps = getSteps();

  const next = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const step = steps[currentStep];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-white/10 p-10 rounded-[3rem] max-w-lg w-full shadow-2xl space-y-8 animate-in relative overflow-hidden">
        <div className="absolute top-0 left-0 h-1 bg-primary transition-all duration-300" style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}></div>

        <div className="text-center space-y-4">
          <div className="bg-primary/20 size-16 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-primary/10">
            <span className="material-symbols-outlined text-primary text-4xl font-black">{step.icon}</span>
          </div>
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase">{step.title}</h2>
          <p className="text-slate-400 text-sm leading-relaxed font-medium">{step.description}</p>
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
            className="flex-[2] py-4 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black text-sm uppercase transition-all shadow-xl shadow-primary/20 tracking-widest"
          >
            {currentStep === steps.length - 1 ? "Initialize Hub" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingTour;
