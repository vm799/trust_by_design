'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

/**
 * Site Supervisor Dashboard
 *
 * Central hub for daily crew management, material tracking, and safety oversight
 */
export default function SiteSupervisorDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [todayStats, setTodayStats] = useState({
    jobsCompleted: 0,
    jobsInProgress: 0,
    techsActive: 0,
    safetyScore: 98
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth');
        return;
      }

      // Get user's workspace
      const { data: profile } = await supabase
        .from('users')
        .select('workspace_id')
        .eq('id', user.id)
        .single();

      if (!profile?.workspace_id) {
        setLoading(false);
        return;
      }

      // Load ALL workspace jobs (supervisor has full access)
      const [jobsResult, techsResult] = await Promise.all([
        supabase
          .from('jobs')
          .select('*')
          .eq('workspace_id', profile.workspace_id)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('technicians')
          .select('*')
          .eq('workspace_id', profile.workspace_id)
          .eq('status', 'active')
      ]);

      if (jobsResult.data) setJobs(jobsResult.data);
      if (techsResult.data) setTechnicians(techsResult.data);

      // Calculate today's stats
      const completed = jobsResult.data?.filter(j => j.status === 'completed').length || 0;
      const inProgress = jobsResult.data?.filter(j => j.status === 'in_progress').length || 0;
      const techsActive = techsResult.data?.length || 0;

      setTodayStats({
        jobsCompleted: completed,
        jobsInProgress: inProgress,
        techsActive,
        safetyScore: 98
      });

      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="size-16 border-4 border-safety-orange/30 border-t-safety-orange rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-xl bg-safety-orange/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-safety-orange text-2xl">
                  engineering
                </span>
              </div>
              <div>
                <p className="text-slate-500 text-xs font-bold uppercase">Site Supervisor Dashboard</p>
                <h1 className="text-3xl font-black text-white uppercase tracking-tight">
                  Good Morning, Site Manager
                </h1>
              </div>
            </div>

            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-700 transition-all"
            >
              ← Back to Main Dashboard
            </button>
          </div>

          <p className="text-slate-400 text-sm">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-success text-2xl">
                check_circle
              </span>
              <p className="text-slate-400 text-xs font-bold uppercase">Completed</p>
            </div>
            <p className="text-4xl font-black text-white">{todayStats.jobsCompleted}</p>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-warning text-2xl">
                schedule
              </span>
              <p className="text-slate-400 text-xs font-bold uppercase">In Progress</p>
            </div>
            <p className="text-4xl font-black text-white">{todayStats.jobsInProgress}</p>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-primary text-2xl">
                groups
              </span>
              <p className="text-slate-400 text-xs font-bold uppercase">Active Crew</p>
            </div>
            <p className="text-4xl font-black text-white">{todayStats.techsActive}</p>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-safety-orange text-2xl">
                health_and_safety
              </span>
              <p className="text-slate-400 text-xs font-bold uppercase">Safety Score</p>
            </div>
            <p className="text-4xl font-black text-white">{todayStats.safetyScore}%</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <button
            onClick={() => router.push('/admin/create')}
            className="bg-safety-orange hover:bg-safety-orange-dark rounded-2xl p-6 text-left transition-all group"
          >
            <span className="material-symbols-outlined text-white text-3xl mb-3 block group-hover:scale-110 transition-transform">
              add_circle
            </span>
            <p className="text-white font-black text-sm uppercase">Assign Crew</p>
          </button>

          <button
            onClick={() => alert('Material tracking feature')}
            className="bg-slate-800 hover:bg-slate-700 rounded-2xl p-6 text-left transition-all group"
          >
            <span className="material-symbols-outlined text-safety-orange text-3xl mb-3 block group-hover:scale-110 transition-transform">
              inventory_2
            </span>
            <p className="text-white font-black text-sm uppercase">Log Materials</p>
          </button>

          <button
            onClick={() => alert('Safety rounds feature')}
            className="bg-slate-800 hover:bg-slate-700 rounded-2xl p-6 text-left transition-all group"
          >
            <span className="material-symbols-outlined text-safety-orange text-3xl mb-3 block group-hover:scale-110 transition-transform">
              health_and_safety
            </span>
            <p className="text-white font-black text-sm uppercase">Safety Round</p>
          </button>

          <button
            onClick={() => alert('Daily report feature')}
            className="bg-slate-800 hover:bg-slate-700 rounded-2xl p-6 text-left transition-all group"
          >
            <span className="material-symbols-outlined text-safety-orange text-3xl mb-3 block group-hover:scale-110 transition-transform">
              summarize
            </span>
            <p className="text-white font-black text-sm uppercase">Day Report</p>
          </button>
        </div>

        {/* Jobs Overview */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-white font-black text-xl uppercase">Active Jobs</h2>
            <button
              onClick={() => router.push('/admin')}
              className="text-safety-orange text-xs font-bold uppercase hover:underline"
            >
              View All →
            </button>
          </div>

          {jobs.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-slate-600 text-6xl mb-4">
                work_outline
              </span>
              <p className="text-slate-500 text-sm">No active jobs. Start by assigning crews.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.slice(0, 5).map((job) => (
                <div
                  key={job.id}
                  className="bg-slate-800 rounded-xl p-4 hover:bg-slate-700 transition-all cursor-pointer"
                  onClick={() => router.push(`/admin/report/${job.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-white font-bold mb-1">{job.title || 'Untitled Job'}</p>
                      <p className="text-slate-400 text-xs">{job.job_number}</p>
                    </div>
                    <span
                      className={`
                        px-3 py-1 rounded-full text-xs font-bold uppercase
                        ${job.status === 'completed' ? 'bg-success/20 text-success' : ''}
                        ${job.status === 'in_progress' ? 'bg-warning/20 text-warning' : ''}
                        ${job.status === 'pending' ? 'bg-slate-700 text-slate-400' : ''}
                        ${job.status === 'sealed' ? 'bg-primary/20 text-primary' : ''}
                      `}
                    >
                      {job.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Crew Status */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
          <h2 className="text-white font-black text-xl uppercase mb-6">Crew Status</h2>

          {technicians.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-slate-600 text-6xl mb-4">
                group_off
              </span>
              <p className="text-slate-500 text-sm">No technicians in your workspace yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {technicians.slice(0, 6).map((tech) => (
                <div
                  key={tech.id}
                  className="bg-slate-800 rounded-xl p-4 flex items-center gap-3"
                >
                  <div className="size-10 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-slate-400">
                      person
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-bold text-sm">{tech.name}</p>
                    <p className="text-slate-400 text-xs">
                      {tech.jobs_completed || 0} jobs completed
                    </p>
                  </div>
                  <div className="size-2 rounded-full bg-success shrink-0" title="Active" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
