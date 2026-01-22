'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

/**
 * Site Supervisor Onboarding - Step 4: End of Day Report
 *
 * Final step: Teaches supervisors how to seal jobs and generate daily summaries
 */
export default function EndOfDayReportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [jobsSummary, setJobsSummary] = useState({
    completed: 3,
    inProgress: 2,
    blocked: 1
  });
  const [reportNotes, setReportNotes] = useState('');
  const [sealCompleted, setSealCompleted] = useState(false);

  const handleSealJobs = () => {
    // Simulate sealing completed jobs
    setSealCompleted(true);
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

      // Mark final step as completed
      const { error } = await supabase.rpc('complete_onboarding_step', {
        p_step_key: 'end_of_day_report'
      });

      if (error) throw error;

      // Mark persona onboarding as complete
      const { error: completeError } = await supabase.rpc('complete_persona_onboarding', {
        p_persona_type: 'site_supervisor'
      });

      if (completeError) throw completeError;

      // Redirect to supervisor dashboard
      router.push('/dashboard/site-supervisor');
    } catch (err) {
      alert('Failed to save progress');
    } finally {
      setLoading(false);
    }
  };

  const canContinue = reportNotes.length > 10 && sealCompleted;

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-12 rounded-xl bg-safety-orange/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-safety-orange text-2xl">
                summarize
              </span>
            </div>
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase">Site Supervisor - Step 4 of 4</p>
              <h1 className="text-3xl font-black text-white uppercase tracking-tight">
                End of Day Report
              </h1>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-safety-orange transition-all" style={{ width: '100%' }} />
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-safety-orange/10 border border-safety-orange/20 rounded-2xl p-6 mb-8">
          <h2 className="text-white font-black text-lg mb-2">
            Wrap Up Your Day
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed">
            At 5 PM, seal all completed jobs and generate your daily summary report.
            This creates a tamper-proof audit trail and keeps stakeholders informed.
          </p>
        </div>

        {/* Daily Summary */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 mb-6">
          <h3 className="text-white font-black text-xl uppercase mb-6">Today's Summary</h3>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-success/10 border border-success/20 rounded-xl p-4 text-center">
              <p className="text-4xl font-black text-success mb-2">
                {jobsSummary.completed}
              </p>
              <p className="text-slate-300 text-xs font-bold uppercase">Completed</p>
            </div>

            <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 text-center">
              <p className="text-4xl font-black text-warning mb-2">
                {jobsSummary.inProgress}
              </p>
              <p className="text-slate-300 text-xs font-bold uppercase">In Progress</p>
            </div>

            <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 text-center">
              <p className="text-4xl font-black text-danger mb-2">
                {jobsSummary.blocked}
              </p>
              <p className="text-slate-300 text-xs font-bold uppercase">Blocked</p>
            </div>
          </div>

          {/* Seal Completed Jobs */}
          <button
            onClick={handleSealJobs}
            disabled={sealCompleted}
            className={`
              w-full p-6 rounded-xl border-2 transition-all font-bold uppercase text-sm
              ${sealCompleted
                ? 'bg-success/10 border-success text-success cursor-default'
                : 'bg-slate-800 border-safety-orange text-safety-orange hover:bg-safety-orange/10'
              }
            `}
          >
            {sealCompleted ? (
              <div className="flex items-center justify-center gap-2">
                <span className="material-symbols-outlined">verified</span>
                {jobsSummary.completed} Jobs Sealed & Verified
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <span className="material-symbols-outlined">lock</span>
                Seal {jobsSummary.completed} Completed Jobs
              </div>
            )}
          </button>

          {sealCompleted && (
            <p className="text-slate-400 text-xs text-center mt-3">
              SHA-256 hash generated • Cryptographic signature applied • Audit trail created
            </p>
          )}
        </div>

        {/* Daily Report Notes */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 mb-6">
          <h3 className="text-white font-black text-lg mb-4">Daily Report Notes</h3>
          <p className="text-slate-400 text-sm mb-4">
            Summarize today's progress, challenges, and tomorrow's priorities
          </p>

          <textarea
            value={reportNotes}
            onChange={(e) => setReportNotes(e.target.value)}
            placeholder="Example:

✅ Completed: Electrical inspection Unit 4B, HVAC maintenance Office Block

🚧 In Progress: Plumbing repair Warehouse A (waiting on parts)

⚠️ Blocked: Roofing job delayed due to weather

📋 Tomorrow: Safety training for new crew, material delivery scheduled for 8 AM"
            className="w-full bg-slate-800 border border-slate-600 rounded-xl p-4 text-white text-sm min-h-[200px] focus:ring-2 focus:ring-safety-orange outline-none resize-none font-mono"
          />

          <div className="flex items-center justify-between mt-3">
            <p className="text-slate-500 text-xs">
              {reportNotes.length} characters {reportNotes.length < 10 && '(minimum 10)'}
            </p>
            {reportNotes.length >= 10 && (
              <p className="text-success text-xs font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">check</span>
                Report ready
              </p>
            )}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 mb-8">
          <h3 className="text-white font-black text-lg mb-4">📊 Daily Metrics</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-safety-orange text-2xl">
                schedule
              </span>
              <div>
                <p className="text-white font-bold">8.5 hours</p>
                <p className="text-slate-400 text-xs">Total labor hours</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-safety-orange text-2xl">
                groups
              </span>
              <div>
                <p className="text-white font-bold">12 technicians</p>
                <p className="text-slate-400 text-xs">Active today</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-safety-orange text-2xl">
                inventory
              </span>
              <div>
                <p className="text-white font-bold">3 deliveries</p>
                <p className="text-slate-400 text-xs">Materials logged</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-safety-orange text-2xl">
                health_and_safety
              </span>
              <div>
                <p className="text-white font-bold">0 incidents</p>
                <p className="text-slate-400 text-xs">Safety violations</p>
              </div>
            </div>
          </div>
        </div>

        {/* Completion Message */}
        {canContinue && (
          <div className="bg-success/10 border border-success/20 rounded-2xl p-6 mb-8">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-success text-2xl">
                celebration
              </span>
              <div>
                <h3 className="text-success font-black text-lg mb-2">
                  You're Ready to Go!
                </h3>
                <p className="text-slate-300 text-sm">
                  You've completed the Site Supervisor onboarding. Your dashboard is now
                  configured to manage crews, track materials, and ensure safety compliance.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/onboarding/site_supervisor/safety_rounds')}
            className="px-6 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold text-sm uppercase hover:bg-slate-700 transition-all"
          >
            ← Previous Step
          </button>

          <button
            onClick={handleComplete}
            disabled={loading || !canContinue}
            className="px-8 py-3 bg-success text-white rounded-xl font-bold text-sm uppercase hover:bg-success/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? 'Completing...' : 'Complete Onboarding'}
            <span className="material-symbols-outlined text-lg">check_circle</span>
          </button>
        </div>

        {!canContinue && (
          <p className="text-center text-slate-500 text-xs mt-4">
            Seal completed jobs and write your daily report to finish
          </p>
        )}
      </div>
    </div>
  );
}
