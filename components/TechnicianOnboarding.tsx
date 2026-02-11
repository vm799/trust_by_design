/**
 * TechnicianOnboarding Component
 *
 * First-time user onboarding tour for the technician portal.
 * Shows key features and helps users understand the workflow.
 */

import React, { useState, useEffect } from 'react';
import { hapticTap, hapticSuccess } from '../lib/haptics';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  tip?: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to JobProof',
    description: 'Capture professional evidence for every job. Photos, location, and signatures - all securely stored.',
    icon: 'verified_user',
    tip: 'Your evidence is professionally documented and audit-ready.'
  },
  {
    id: 'offline',
    title: 'Works Offline',
    description: 'No signal? No problem. Everything saves locally and syncs automatically when you\'re back online.',
    icon: 'cloud_off',
    tip: 'Look for the green/orange indicator to see your connection status.'
  },
  {
    id: 'location',
    title: 'GPS & Location',
    description: 'We verify your location using GPS and what3words. This proves where the work was done.',
    icon: 'my_location',
    tip: 'Allow location access for verified evidence. Manual entry is flagged as unverified.'
  },
  {
    id: 'photos',
    title: 'Photo Evidence',
    description: 'Capture Before, During, and After photos. Each photo is timestamped and GPS-tagged automatically.',
    icon: 'photo_camera',
    tip: 'Take clear, well-lit photos. They become permanent evidence.'
  },
  {
    id: 'signature',
    title: 'Client Sign-Off',
    description: 'Get the client to sign on screen. This confirms the work was completed to their satisfaction.',
    icon: 'draw',
    tip: 'The signature is stored securely with the job record.'
  },
  {
    id: 'seal',
    title: 'Seal & Complete',
    description: 'When you seal the job, all evidence is cryptographically locked. It can\'t be changed after.',
    icon: 'lock',
    tip: 'Review everything before sealing - there\'s no undo!'
  }
];

interface TechnicianOnboardingProps {
  onComplete: () => void;
  onSkip?: () => void;
}

const TechnicianOnboarding: React.FC<TechnicianOnboardingProps> = ({
  onComplete,
  onSkip
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  const step = ONBOARDING_STEPS[currentStep];
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

  const handleNext = () => {
    hapticTap();
    if (isLastStep) {
      completeOnboarding();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    hapticTap();
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    hapticTap();
    completeOnboarding();
    onSkip?.();
  };

  const completeOnboarding = () => {
    setIsExiting(true);
    hapticSuccess();

    // Mark as completed in localStorage
    localStorage.setItem('jobproof_onboarding_complete', 'true');

    setTimeout(() => {
      onComplete();
    }, 300);
  };

  return (
    <div className={`fixed inset-0 z-[200] bg-slate-950 flex flex-col transition-opacity duration-300 ${isExiting ? 'opacity-0' : 'opacity-100'}`}>
      {/* Progress Dots */}
      <div className="flex justify-center gap-2 pt-8 pb-4">
        {ONBOARDING_STEPS.map((step, idx) => (
          <button
            key={step.id}
            onClick={() => { setCurrentStep(idx); hapticTap(); }}
            className={`w-2 h-2 rounded-full transition-all ${
              idx === currentStep
                ? 'w-8 bg-primary'
                : idx < currentStep
                ? 'bg-primary/50'
                : 'bg-slate-700'
            }`}
          />
        ))}
      </div>

      {/* Skip Button */}
      <div className="absolute top-6 right-6">
        <button
          onClick={handleSkip}
          className="text-xs text-slate-500 hover:text-white uppercase tracking-wide font-bold"
        >
          Skip
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        {/* Icon */}
        <div className="w-24 h-24 bg-primary/20 rounded-3xl flex items-center justify-center mb-8 animate-in">
          <span className="material-symbols-outlined text-5xl text-primary">
            {step.icon}
          </span>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4 animate-in">
          {step.title}
        </h2>

        {/* Description */}
        <p className="text-slate-400 text-sm max-w-xs mb-6 animate-in">
          {step.description}
        </p>

        {/* Tip */}
        {step.tip && (
          <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-4 max-w-xs animate-in">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-lg">lightbulb</span>
              <p className="text-xs text-slate-300 text-left">{step.tip}</p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="p-6 space-y-4">
        <div className="flex gap-3">
          {currentStep > 0 && (
            <button
              onClick={handlePrev}
              className="flex-1 py-4 bg-slate-900 border border-white/10 rounded-2xl font-bold text-sm text-white uppercase tracking-wide"
            >
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            className={`${currentStep > 0 ? 'flex-[2]' : 'w-full'} py-4 bg-primary rounded-2xl font-bold text-sm text-white uppercase tracking-wide shadow-lg shadow-primary/30`}
          >
            {isLastStep ? "Let's Go!" : 'Next'}
          </button>
        </div>

        {/* Step Counter */}
        <p className="text-center text-xs text-slate-500">
          {currentStep + 1} of {ONBOARDING_STEPS.length}
        </p>
      </div>
    </div>
  );
};

export default TechnicianOnboarding;

/**
 * Hook to check if onboarding should be shown
 */
export function useShouldShowOnboarding(): boolean {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem('jobproof_onboarding_complete');
    setShouldShow(!completed);
  }, []);

  return shouldShow;
}

/**
 * Reset onboarding (for testing or re-showing)
 */
export function resetOnboarding(): void {
  localStorage.removeItem('jobproof_onboarding_complete');
}
