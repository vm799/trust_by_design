'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

/**
 * Site Supervisor Onboarding - Step 3: Safety Rounds
 *
 * Teaches supervisors how to conduct safety inspections
 */
export default function SafetyRoundsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checks, setChecks] = useState([
    { id: '1', item: 'PPE compliance (helmets, vests, boots)', checked: false },
    { id: '2', item: 'Scaffold integrity and fall protection', checked: false },
    { id: '3', item: 'Electrical hazards (exposed wires, wet areas)', checked: false },
    { id: '4', item: 'Fire extinguishers accessible', checked: false },
    { id: '5', item: 'First aid kit stocked', checked: false }
  ]);
  const [photoTaken, setPhotoTaken] = useState(false);
  const [incidentNotes, setIncidentNotes] = useState('');

  const handleToggleCheck = (id: string) => {
    setChecks(prev =>
      prev.map(c => (c.id === id ? { ...c, checked: !c.checked } : c))
    );
  };

  const handleComplete = async () => {
    setLoading(true);

    const supabase = getSupabase();
    if (!supabase) {
      alert('Supabase not configured');
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.rpc('complete_onboarding_step', {
        p_step_key: 'safety_rounds'
      });

      if (error) throw error;

      router.push('/onboarding/site_supervisor/end_of_day_report');
    } catch (err) {
      alert('Failed to save progress');
    } finally {
      setLoading(false);
    }
  };

  const allChecked = checks.every(c => c.checked);
  const canContinue = allChecked && photoTaken;

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-12 rounded-xl bg-safety-orange/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-safety-orange text-2xl">
                health_and_safety
              </span>
            </div>
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase">Site Supervisor - Step 3 of 4</p>
              <h1 className="text-3xl font-black text-white uppercase tracking-tight">
                Safety Rounds
              </h1>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-safety-orange transition-all" style={{ width: '75%' }} />
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-danger/10 border border-danger/20 rounded-2xl p-6 mb-8">
          <h2 className="text-white font-black text-lg mb-2">
            ⚠️ Safety is Non-Negotiable
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed">
            Conduct safety rounds at 12 PM daily. Document hazards with photos.
            Stop work immediately if critical safety violations are found.
          </p>
        </div>

        {/* Safety Checklist */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-white font-black text-xl uppercase">Safety Checklist</h3>
            <span className="text-slate-500 text-xs">
              {checks.filter(c => c.checked).length} / {checks.length} complete
            </span>
          </div>

          <div className="space-y-3">
            {checks.map((check) => (
              <button
                key={check.id}
                onClick={() => handleToggleCheck(check.id)}
                className={`
                  w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left
                  ${check.checked
                    ? 'bg-success/10 border-success'
                    : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                  }
                `}
              >
                <div
                  className={`
                    size-6 rounded-lg border-2 flex items-center justify-center shrink-0
                    ${check.checked ? 'bg-success border-success' : 'border-slate-600'}
                  `}
                >
                  {check.checked && (
                    <span className="material-symbols-outlined text-white text-sm">
                      check
                    </span>
                  )}
                </div>
                <p className={`text-sm font-bold ${check.checked ? 'text-success' : 'text-slate-300'}`}>
                  {check.item}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Photo Documentation */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 mb-6">
          <h3 className="text-white font-black text-lg mb-4">Photo Documentation</h3>
          <p className="text-slate-400 text-sm mb-4">
            Take at least one photo during your safety round as evidence
          </p>

          <button
            onClick={() => setPhotoTaken(!photoTaken)}
            className={`
              w-full p-6 rounded-xl border-2 transition-all
              ${photoTaken
                ? 'bg-success/10 border-success'
                : 'bg-slate-800 border-dashed border-slate-600 hover:border-slate-500'
              }
            `}
          >
            {photoTaken ? (
              <div className="flex items-center justify-center gap-3">
                <span className="material-symbols-outlined text-success text-3xl">
                  check_circle
                </span>
                <div className="text-left">
                  <p className="text-success font-bold text-sm">Photo captured</p>
                  <p className="text-slate-400 text-xs">Safety_Round_12PM.jpg</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <span className="material-symbols-outlined text-slate-500 text-3xl">
                  photo_camera
                </span>
                <p className="text-slate-400 font-bold text-sm">Tap to take photo</p>
              </div>
            )}
          </button>
        </div>

        {/* Incident Notes */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 mb-8">
          <h3 className="text-white font-black text-lg mb-4">Incident Notes (Optional)</h3>
          <textarea
            value={incidentNotes}
            onChange={(e) => setIncidentNotes(e.target.value)}
            placeholder="Document any hazards, near-misses, or incidents observed during your safety round..."
            className="w-full bg-slate-800 border border-slate-600 rounded-xl p-4 text-white text-sm min-h-[120px] focus:ring-2 focus:ring-safety-orange outline-none resize-none"
          />
          <p className="text-slate-500 text-xs mt-2">
            All incident reports are logged and tracked for compliance
          </p>
        </div>

        {/* Safety Stats */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 mb-8">
          <h3 className="text-white font-black text-lg mb-4">🏆 Safety Performance</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-4xl font-black text-success mb-1">37</p>
              <p className="text-slate-400 text-xs">Days accident-free</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-black text-safety-orange mb-1">12</p>
              <p className="text-slate-400 text-xs">Safety rounds completed</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-black text-primary mb-1">98%</p>
              <p className="text-slate-400 text-xs">PPE compliance</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/onboarding/site_supervisor/material_tracking')}
            className="px-6 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold text-sm uppercase hover:bg-slate-700 transition-all"
          >
            ← Previous Step
          </button>

          <button
            onClick={handleComplete}
            disabled={loading || !canContinue}
            className="px-8 py-3 bg-safety-orange text-white rounded-xl font-bold text-sm uppercase hover:bg-safety-orange-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? 'Saving...' : 'Continue'}
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </button>
        </div>

        {!canContinue && (
          <p className="text-center text-slate-500 text-xs mt-4">
            Complete all safety checks and take a photo to continue
          </p>
        )}
      </div>
    </div>
  );
}
