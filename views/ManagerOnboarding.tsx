import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

/**
 * Manager Onboarding Wizard
 * UX Spec Compliant: Step-by-step progressive disclosure
 *
 * Steps:
 * 1. Company Setup (name, country, hours, safety defaults)
 * 2. Role Confirmation
 * 3. CTA - Create First Job
 */

interface CompanyData {
  companyName: string;
  country: string;
  workHoursStart: string;
  workHoursEnd: string;
  defaultSafetyRequirements: string[];
}

const SAFETY_PRESETS = [
  { id: 'ppe_hardhat', label: 'Hard Hat Required', icon: 'hard_hat' },
  { id: 'ppe_hivis', label: 'Hi-Vis Vest Required', icon: 'visibility' },
  { id: 'ppe_gloves', label: 'Safety Gloves Required', icon: 'back_hand' },
  { id: 'ppe_boots', label: 'Steel-Toe Boots Required', icon: 'steps' },
  { id: 'ppe_goggles', label: 'Safety Goggles Required', icon: 'eyeglasses' },
  { id: 'hazard_id', label: 'Hazard Identification Required', icon: 'warning' },
  { id: 'permits', label: 'Work Permits Required', icon: 'description' },
  { id: 'toolbox_talk', label: 'Toolbox Talk Before Start', icon: 'construction' },
];

const COUNTRIES = [
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canada' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'IE', name: 'Ireland' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'NL', name: 'Netherlands' },
];

const ManagerOnboarding: React.FC = () => {
  const navigate = useNavigate();
  const { userId, isAuthenticated, isLoading: authLoading } = useAuth();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [companyData, setCompanyData] = useState<CompanyData>({
    companyName: '',
    country: 'GB',
    workHoursStart: '08:00',
    workHoursEnd: '17:00',
    defaultSafetyRequirements: ['ppe_hardhat', 'ppe_hivis', 'hazard_id'],
  });

  // Auto-focus refs
  const companyNameRef = useRef<HTMLInputElement>(null);

  // Auth check
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/auth');
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Auto-focus on step change
  useEffect(() => {
    if (step === 1 && companyNameRef.current) {
      companyNameRef.current.focus();
    }
  }, [step]);

  const handleSafetyToggle = (id: string) => {
    setCompanyData(prev => ({
      ...prev,
      defaultSafetyRequirements: prev.defaultSafetyRequirements.includes(id)
        ? prev.defaultSafetyRequirements.filter(s => s !== id)
        : [...prev.defaultSafetyRequirements, id]
    }));
  };

  const handleNext = async () => {
    if (step === 1) {
      if (!companyData.companyName.trim()) {
        return; // Validation handled by required attribute
      }
      setStep(2);
    } else if (step === 2) {
      // Save and proceed
      setSaving(true);
      try {
        const supabase = getSupabase();
        if (supabase && userId) {
          // Update workspace with company settings
          const { data: profile } = await supabase
            .from('users')
            .select('workspace_id')
            .eq('id', userId)
            .single();

          if (profile?.workspace_id) {
            await supabase
              .from('workspaces')
              .update({
                name: companyData.companyName,
                settings: {
                  country: companyData.country,
                  work_hours: {
                    start: companyData.workHoursStart,
                    end: companyData.workHoursEnd,
                  },
                  default_safety_requirements: companyData.defaultSafetyRequirements,
                },
              })
              .eq('id', profile.workspace_id);
          }

          // Mark onboarding as complete
          await supabase
            .from('user_personas')
            .upsert({
              user_id: userId,
              workspace_id: profile?.workspace_id,
              persona_type: 'agency_owner',
              is_active: true,
              is_complete: true,
              current_step: 'complete',
            }, { onConflict: 'user_id,persona_type' });
        }

        localStorage.setItem('jobproof_onboarding_v4', 'true');
        setStep(3);
      } catch (err) {
        console.error('Failed to save onboarding:', err);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleCreateFirstJob = () => {
    navigate('/admin/create');
  };

  const handleSkipToDashboard = () => {
    navigate('/admin');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin size-12 border-4 border-primary/30 border-t-primary rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-xl">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`flex items-center ${s < 3 ? 'flex-1' : ''}`}
              >
                <div
                  className={`size-10 rounded-full flex items-center justify-center font-black text-sm transition-all ${
                    s < step
                      ? 'bg-success text-white'
                      : s === step
                      ? 'bg-primary text-white scale-110'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {s < step ? (
                    <span className="material-symbols-outlined text-lg">check</span>
                  ) : (
                    s
                  )}
                </div>
                {s < 3 && (
                  <div
                    className={`flex-1 h-1 mx-2 rounded-full transition-all ${
                      s < step ? 'bg-success' : 'bg-slate-800'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <p className="text-center text-slate-500 text-xs font-bold uppercase tracking-widest">
            Step {step} of 3
          </p>
        </div>

        {/* Step 1: Company Setup */}
        {step === 1 && (
          <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-8 space-y-8 animate-in fade-in slide-in-from-right-5 duration-300">
            <div className="text-center space-y-3">
              <div className="bg-primary/10 size-16 rounded-2xl flex items-center justify-center mx-auto border border-primary/20">
                <span className="material-symbols-outlined text-primary text-4xl">business</span>
              </div>
              <h1 className="text-2xl font-black text-white uppercase tracking-tight">
                Company Setup
              </h1>
              <p className="text-slate-400 text-sm">
                Let's configure your workspace for field operations.
              </p>
            </div>

            <div className="space-y-5">
              {/* Company Name - Primary Focus */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  Company Name *
                </label>
                <input
                  ref={companyNameRef}
                  type="text"
                  required
                  value={companyData.companyName}
                  onChange={(e) => setCompanyData({ ...companyData, companyName: e.target.value })}
                  className="w-full bg-slate-800 border-2 border-slate-700 focus:border-primary rounded-xl py-4 px-5 text-white text-lg font-medium outline-none transition-all"
                  placeholder="Your Company Ltd"
                />
              </div>

              {/* Country */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  Country
                </label>
                <select
                  value={companyData.country}
                  onChange={(e) => setCompanyData({ ...companyData, country: e.target.value })}
                  className="w-full bg-slate-800 border-2 border-slate-700 focus:border-primary rounded-xl py-4 px-5 text-white outline-none transition-all"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Work Hours */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  Default Work Hours
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <input
                      type="time"
                      value={companyData.workHoursStart}
                      onChange={(e) => setCompanyData({ ...companyData, workHoursStart: e.target.value })}
                      className="w-full bg-slate-800 border-2 border-slate-700 focus:border-primary rounded-xl py-4 px-5 text-white outline-none transition-all"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">START</span>
                  </div>
                  <div className="relative">
                    <input
                      type="time"
                      value={companyData.workHoursEnd}
                      onChange={(e) => setCompanyData({ ...companyData, workHoursEnd: e.target.value })}
                      className="w-full bg-slate-800 border-2 border-slate-700 focus:border-primary rounded-xl py-4 px-5 text-white outline-none transition-all"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">END</span>
                  </div>
                </div>
              </div>

              {/* Safety Requirements */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  Default Safety Requirements
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SAFETY_PRESETS.map((safety) => (
                    <button
                      key={safety.id}
                      type="button"
                      onClick={() => handleSafetyToggle(safety.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                        companyData.defaultSafetyRequirements.includes(safety.id)
                          ? 'bg-primary/10 border-primary text-white'
                          : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <span className={`material-symbols-outlined text-xl ${
                        companyData.defaultSafetyRequirements.includes(safety.id)
                          ? 'text-primary'
                          : 'text-slate-500'
                      }`}>
                        {safety.icon}
                      </span>
                      <span className="text-xs font-bold">{safety.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleNext}
              disabled={!companyData.companyName.trim()}
              className="w-full py-5 bg-primary text-white font-black rounded-2xl uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:bg-primary-hover active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 2: Role Confirmation */}
        {step === 2 && (
          <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-8 space-y-8 animate-in fade-in slide-in-from-right-5 duration-300">
            <div className="text-center space-y-3">
              <div className="bg-success/10 size-16 rounded-2xl flex items-center justify-center mx-auto border border-success/20">
                <span className="material-symbols-outlined text-success text-4xl">verified_user</span>
              </div>
              <h1 className="text-2xl font-black text-white uppercase tracking-tight">
                Confirm Your Role
              </h1>
              <p className="text-slate-400 text-sm">
                This determines how JobProof works for you.
              </p>
            </div>

            <div className="bg-slate-800/50 border-2 border-primary rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="bg-primary/20 size-14 rounded-xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-3xl">manage_accounts</span>
                </div>
                <div>
                  <h3 className="text-white font-black text-lg uppercase tracking-tight">Manager</h3>
                  <p className="text-slate-400 text-sm">Create, dispatch, and review jobs</p>
                </div>
              </div>

              <div className="border-t border-slate-700 pt-4 space-y-2">
                <div className="flex items-center gap-2 text-slate-300 text-sm">
                  <span className="material-symbols-outlined text-success text-lg">check_circle</span>
                  Create and assign jobs to technicians
                </div>
                <div className="flex items-center gap-2 text-slate-300 text-sm">
                  <span className="material-symbols-outlined text-success text-lg">check_circle</span>
                  Generate magic links for field access
                </div>
                <div className="flex items-center gap-2 text-slate-300 text-sm">
                  <span className="material-symbols-outlined text-success text-lg">check_circle</span>
                  Review submitted job proofs
                </div>
                <div className="flex items-center gap-2 text-slate-300 text-sm">
                  <span className="material-symbols-outlined text-success text-lg">check_circle</span>
                  Manage clients and technicians
                </div>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
              <p className="text-amber-400 text-xs font-medium flex items-start gap-2">
                <span className="material-symbols-outlined text-lg shrink-0">info</span>
                Technicians access jobs via magic links only. They don't need accounts or this app installed.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleNext}
                disabled={saving}
                className="w-full py-5 bg-primary text-white font-black rounded-2xl uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:bg-primary-hover active:scale-[0.98] disabled:opacity-50"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </span>
                ) : (
                  'Confirm & Continue'
                )}
              </button>
              <button
                onClick={() => setStep(1)}
                className="w-full py-3 text-slate-400 font-bold text-sm uppercase tracking-widest hover:text-white transition-all"
              >
                Go Back
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Create First Job CTA */}
        {step === 3 && (
          <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-8 space-y-8 animate-in fade-in slide-in-from-right-5 duration-300">
            <div className="text-center space-y-3">
              <div className="bg-success/10 size-20 rounded-2xl flex items-center justify-center mx-auto border border-success/20">
                <span className="material-symbols-outlined text-success text-5xl">rocket_launch</span>
              </div>
              <h1 className="text-2xl font-black text-white uppercase tracking-tight">
                You're All Set!
              </h1>
              <p className="text-slate-400 text-sm max-w-sm mx-auto">
                <span className="text-white font-bold">{companyData.companyName}</span> is ready to go.
                Create your first job to see JobProof in action.
              </p>
            </div>

            <div className="bg-slate-800/50 rounded-2xl p-6 space-y-4 border border-white/5">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">What happens next</h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="bg-primary/20 size-8 rounded-lg flex items-center justify-center shrink-0">
                    <span className="text-primary font-black text-sm">1</span>
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">Create a job</p>
                    <p className="text-slate-400 text-xs">Define the work scope and safety requirements</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-primary/20 size-8 rounded-lg flex items-center justify-center shrink-0">
                    <span className="text-primary font-black text-sm">2</span>
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">Send magic link</p>
                    <p className="text-slate-400 text-xs">Technician gets instant browser access</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-primary/20 size-8 rounded-lg flex items-center justify-center shrink-0">
                    <span className="text-primary font-black text-sm">3</span>
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">Get proof</p>
                    <p className="text-slate-400 text-xs">Review timestamped photos and confirmations</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleCreateFirstJob}
                className="w-full py-5 bg-safety-orange text-white font-black rounded-2xl uppercase tracking-widest shadow-xl shadow-orange-500/20 transition-all hover:bg-orange-600 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined">add_circle</span>
                Create Your First Job
              </button>
              <button
                onClick={handleSkipToDashboard}
                className="w-full py-3 text-slate-400 font-bold text-sm uppercase tracking-widest hover:text-white transition-all"
              >
                Skip to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManagerOnboarding;
