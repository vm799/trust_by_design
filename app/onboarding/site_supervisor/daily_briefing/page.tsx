'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

/**
 * Site Supervisor Onboarding - Step 1: Daily Briefing
 *
 * Teaches supervisors how to assign crews to jobs at start of day
 */
export default function DailyBriefingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [assignedTechs, setAssignedTechs] = useState<Record<string, string>>({});

  // Mock data for onboarding tutorial
  const mockJobs = [
    { id: '1', title: 'Electrical Inspection - Unit 4B', status: 'pending', priority: 'high' },
    { id: '2', title: 'Plumbing Repair - Warehouse A', status: 'pending', priority: 'medium' },
    { id: '3', title: 'HVAC Maintenance - Office Block', status: 'pending', priority: 'low' }
  ];

  const mockTechnicians = [
    { id: 't1', name: 'Mike Johnson', specialty: 'Electrical', available: true },
    { id: 't2', name: 'Sarah Chen', specialty: 'Plumbing', available: true },
    { id: 't3', name: 'David Martinez', specialty: 'HVAC', available: false }
  ];

  const handleAssignTech = (jobId: string, techId: string) => {
    setAssignedTechs(prev => ({ ...prev, [jobId]: techId }));
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

      // Mark step as completed
      const { error } = await supabase.rpc('complete_onboarding_step', {
        p_step_key: 'daily_briefing'
      });

      if (error) throw error;

      // Navigate to next step
      router.push('/onboarding/site_supervisor/material_tracking');
    } catch (err) {
      alert('Failed to save progress. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-orange-500 text-2xl">
                engineering
              </span>
            </div>
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase">Site Supervisor - Step 1 of 4</p>
              <h1 className="text-3xl font-black text-white uppercase tracking-tight">
                Daily Briefing
              </h1>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-orange-500 transition-all" style={{ width: '25%' }} />
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-6 mb-8">
          <h2 className="text-white font-black text-lg mb-2">
            Start Your Day: Assign Crews to Jobs
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed">
            Every morning at 6 AM, review pending jobs and assign your available technicians.
            Match technician specialties to job requirements for optimal efficiency.
          </p>
        </div>

        {/* Tutorial: Job Assignment */}
        <div className="space-y-4 mb-8">
          <h3 className="text-white font-black text-xl uppercase">Today's Jobs</h3>

          {mockJobs.map((job) => (
            <div
              key={job.id}
              className="bg-slate-900 border border-slate-700 rounded-2xl p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`
                        text-xs font-bold uppercase px-2 py-1 rounded
                        ${job.priority === 'high' ? 'bg-danger/20 text-danger' : ''}
                        ${job.priority === 'medium' ? 'bg-warning/20 text-warning' : ''}
                        ${job.priority === 'low' ? 'bg-slate-700 text-slate-400' : ''}
                      `}
                    >
                      {job.priority}
                    </span>
                  </div>
                  <h4 className="text-white font-bold">{job.title}</h4>
                </div>
              </div>

              {/* Technician Assignment */}
              <div>
                <label className="text-slate-400 text-xs font-bold uppercase mb-2 block">
                  Assign Technician
                </label>
                <select
                  value={assignedTechs[job.id] || ''}
                  onChange={(e) => handleAssignTech(job.id, e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-white text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  <option value="">Select technician...</option>
                  {mockTechnicians.map((tech) => (
                    <option
                      key={tech.id}
                      value={tech.id}
                      disabled={!tech.available}
                    >
                      {tech.name} - {tech.specialty} {!tech.available && '(Unavailable)'}
                    </option>
                  ))}
                </select>
              </div>

              {assignedTechs[job.id] && (
                <div className="mt-3 bg-success/10 border border-success/20 rounded-xl p-3">
                  <p className="text-success text-xs font-bold">
                    ✓ {mockTechnicians.find(t => t.id === assignedTechs[job.id])?.name} assigned
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Key Insights */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 mb-8">
          <h3 className="text-white font-black text-lg mb-4">💡 Pro Tips</h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-orange-500 text-sm mt-0.5">
                lightbulb
              </span>
              <p className="text-slate-300 text-sm flex-1">
                Assign high-priority jobs first to ensure critical work gets done
              </p>
            </li>
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-orange-500 text-sm mt-0.5">
                lightbulb
              </span>
              <p className="text-slate-300 text-sm flex-1">
                Match technician specialties to job types for faster completion
              </p>
            </li>
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-orange-500 text-sm mt-0.5">
                lightbulb
              </span>
              <p className="text-slate-300 text-sm flex-1">
                Keep one tech unassigned for emergency call-outs
              </p>
            </li>
          </ul>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/complete-onboarding')}
            className="px-6 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold text-sm uppercase hover:bg-slate-700 transition-all"
          >
            ← Back to Personas
          </button>

          <button
            onClick={handleComplete}
            disabled={loading || Object.keys(assignedTechs).length < 2}
            className="px-8 py-3 bg-orange-500 text-white rounded-xl font-bold text-sm uppercase hover:bg-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? 'Saving...' : 'Continue'}
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </button>
        </div>

        {Object.keys(assignedTechs).length < 2 && (
          <p className="text-center text-slate-500 text-xs mt-4">
            Assign at least 2 technicians to continue
          </p>
        )}
      </div>
    </div>
  );
}
