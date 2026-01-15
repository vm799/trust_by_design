
import React, { useState } from 'react';

interface TourStep {
  title: string;
  description: string;
  targetId: string;
  icon: string;
}

interface OnboardingTourProps {
  onComplete: () => void;
}

const OnboardingTour: React.FC<OnboardingTourProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps: TourStep[] = [
    {
      title: "Welcome to JobProof",
      description: "Let's take a quick 1-minute tour to see how to capture bulletproof evidence for your business.",
      targetId: "nav-dashboard",
      icon: "verified"
    },
    {
      title: "Step 1: Dispatch a Job",
      description: "Click here to create a new job. A unique magic link will be generated for your technician—no login required for them.",
      targetId: "btn-dispatch",
      icon: "send"
    },
    {
      title: "Step 2: Manage Your Registry",
      description: "Add your Clients and Technicians here. This ensures every job is linked to the right asset and operator.",
      targetId: "nav-clients",
      icon: "group"
    },
    {
      title: "Step 3: Track Real-time Proof",
      description: "The Operations Feed shows live updates from the field. Once a job is 'Sealed', you'll have a verifiable PDF ready for billing.",
      targetId: "ops-feed",
      icon: "security"
    }
  ];

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
        {/* Progress bar */}
        <div className="absolute top-0 left-0 h-1 bg-primary transition-all duration-300" style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}></div>
        
        <div className="text-center space-y-4">
          <div className="bg-primary/20 size-16 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-primary/10">
            <span className="material-symbols-outlined text-primary text-4xl">{step.icon}</span>
          </div>
          <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">{step.title}</h2>
          <p className="text-slate-400 text-sm leading-relaxed">{step.description}</p>
        </div>

        <div className="flex gap-4">
          {currentStep > 0 && (
            <button 
              onClick={() => setCurrentStep(currentStep - 1)}
              className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black text-sm uppercase transition-all"
            >
              Back
            </button>
          )}
          <button 
            onClick={next}
            className="flex-[2] py-4 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black text-sm uppercase transition-all shadow-xl shadow-primary/20"
          >
            {currentStep === steps.length - 1 ? "Start Operating" : "Next Step"}
          </button>
        </div>

        <div className="flex justify-center gap-2">
          {steps.map((_, i) => (
            <div key={i} className={`size-1.5 rounded-full ${i === currentStep ? 'bg-primary' : 'bg-slate-800'}`}></div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OnboardingTour;
