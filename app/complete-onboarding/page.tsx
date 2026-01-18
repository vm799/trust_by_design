'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import SiteSupervisorCard from '@/components/personas/SiteSupervisorCard';

/**
 * Complete Onboarding - Persona Selection
 *
 * Allows users to select their primary role and complete guided onboarding
 * Supports 5 personas: solo_contractor, agency_owner, compliance_officer, safety_manager, site_supervisor
 */
export default function CompleteOnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [hasExistingPersona, setHasExistingPersona] = useState(false);

  useEffect(() => {
    checkExistingPersona();
  }, []);

  const checkExistingPersona = async () => {
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

      // Check if user already has a completed persona
      const { data: personas } = await supabase
        .from('user_personas')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_complete', true)
        .single();

      if (personas) {
        setHasExistingPersona(true);
        // Redirect to appropriate dashboard
        switch (personas.persona_type) {
          case 'site_supervisor':
            router.push('/dashboard/site-supervisor');
            break;
          case 'solo_contractor':
            router.push('/dashboard/solo-contractor');
            break;
          case 'agency_owner':
            router.push('/dashboard/agency-owner');
            break;
          case 'compliance_officer':
            router.push('/dashboard/compliance');
            break;
          case 'safety_manager':
            router.push('/dashboard/safety');
            break;
          default:
            router.push('/dashboard');
        }
      }

      setLoading(false);
    } catch (err) {
      console.error('Failed to check persona:', err);
      setLoading(false);
    }
  };

  const handlePersonaSelect = async (persona: string) => {
    setSelectedPersona(persona);

    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Create persona record
      const { error } = await supabase.from('user_personas').insert({
        user_id: user.id,
        persona_type: persona,
        is_complete: false,
        is_active: true
      });

      if (error) throw error;

      // Redirect handled by persona card component
    } catch (err) {
      console.error('Failed to create persona:', err);
      alert('Failed to start onboarding');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="size-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-black text-white uppercase tracking-tighter mb-4">
            Choose Your Role
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Select the option that best describes your primary responsibility.
            We'll customize your experience with guided workflows.
          </p>
        </div>

        {/* Persona Cards Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {/* Solo Contractor */}
          <button
            onClick={() => {
              handlePersonaSelect('solo_contractor');
              router.push('/onboarding/solo_contractor/first_job');
            }}
            className="group relative p-8 rounded-3xl border-2 transition-all text-left bg-slate-900 border-slate-700 hover:border-primary hover:bg-slate-800 cursor-pointer active:scale-95"
          >
            <div className="mb-6 size-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-all">
              <span className="material-symbols-outlined text-primary text-4xl">
                person
              </span>
            </div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">
              Solo Contractor
            </h3>
            <p className="text-slate-400 text-sm mb-4">
              Independent professional handling your own jobs
            </p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-slate-300 text-xs">
                <span className="material-symbols-outlined text-primary text-sm">check_circle</span>
                Quick job creation
              </li>
              <li className="flex items-center gap-2 text-slate-300 text-xs">
                <span className="material-symbols-outlined text-primary text-sm">check_circle</span>
                Mobile evidence capture
              </li>
              <li className="flex items-center gap-2 text-slate-300 text-xs">
                <span className="material-symbols-outlined text-primary text-sm">check_circle</span>
                Client verification
              </li>
            </ul>
          </button>

          {/* Site Supervisor - NEW */}
          <SiteSupervisorCard
            onSelect={handlePersonaSelect}
            disabled={false}
          />

          {/* Agency Owner */}
          <button
            onClick={() => {
              handlePersonaSelect('agency_owner');
              router.push('/onboarding/agency_owner/team_setup');
            }}
            className="group relative p-8 rounded-3xl border-2 transition-all text-left bg-slate-900 border-slate-700 hover:border-blue-500 hover:bg-slate-800 cursor-pointer active:scale-95"
          >
            <div className="mb-6 size-16 rounded-2xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-all">
              <span className="material-symbols-outlined text-blue-500 text-4xl">
                business
              </span>
            </div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">
              Agency Owner
            </h3>
            <p className="text-slate-400 text-sm mb-4">
              Manage teams, billing, and client relationships
            </p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-slate-300 text-xs">
                <span className="material-symbols-outlined text-blue-500 text-sm">check_circle</span>
                Team management
              </li>
              <li className="flex items-center gap-2 text-slate-300 text-xs">
                <span className="material-symbols-outlined text-blue-500 text-sm">check_circle</span>
                Bulk job assignment
              </li>
              <li className="flex items-center gap-2 text-slate-300 text-xs">
                <span className="material-symbols-outlined text-blue-500 text-sm">check_circle</span>
                Revenue tracking
              </li>
            </ul>
          </button>

          {/* Compliance Officer */}
          <button
            onClick={() => {
              handlePersonaSelect('compliance_officer');
              router.push('/onboarding/compliance_officer/audit_intro');
            }}
            className="group relative p-8 rounded-3xl border-2 transition-all text-left bg-slate-900 border-slate-700 hover:border-purple-500 hover:bg-slate-800 cursor-pointer active:scale-95"
          >
            <div className="mb-6 size-16 rounded-2xl bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-all">
              <span className="material-symbols-outlined text-purple-500 text-4xl">
                gavel
              </span>
            </div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">
              Compliance Officer
            </h3>
            <p className="text-slate-400 text-sm mb-4">
              Audit trails, legal verification, regulatory compliance
            </p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-slate-300 text-xs">
                <span className="material-symbols-outlined text-purple-500 text-sm">check_circle</span>
                Seal verification
              </li>
              <li className="flex items-center gap-2 text-slate-300 text-xs">
                <span className="material-symbols-outlined text-purple-500 text-sm">check_circle</span>
                Audit logs
              </li>
              <li className="flex items-center gap-2 text-slate-300 text-xs">
                <span className="material-symbols-outlined text-purple-500 text-sm">check_circle</span>
                Compliance reports
              </li>
            </ul>
          </button>

          {/* Safety Manager */}
          <button
            onClick={() => {
              handlePersonaSelect('safety_manager');
              router.push('/onboarding/safety_manager/protocols');
            }}
            className="group relative p-8 rounded-3xl border-2 transition-all text-left bg-slate-900 border-slate-700 hover:border-green-500 hover:bg-slate-800 cursor-pointer active:scale-95"
          >
            <div className="mb-6 size-16 rounded-2xl bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-all">
              <span className="material-symbols-outlined text-green-500 text-4xl">
                verified_user
              </span>
            </div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">
              Safety Manager
            </h3>
            <p className="text-slate-400 text-sm mb-4">
              Safety protocols, incident reporting, hazard tracking
            </p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-slate-300 text-xs">
                <span className="material-symbols-outlined text-green-500 text-sm">check_circle</span>
                Safety checklists
              </li>
              <li className="flex items-center gap-2 text-slate-300 text-xs">
                <span className="material-symbols-outlined text-green-500 text-sm">check_circle</span>
                Incident reports
              </li>
              <li className="flex items-center gap-2 text-slate-300 text-xs">
                <span className="material-symbols-outlined text-green-500 text-sm">check_circle</span>
                Hazard monitoring
              </li>
            </ul>
          </button>
        </div>

        {/* Help Text */}
        <div className="text-center">
          <p className="text-slate-500 text-sm">
            Not sure which role fits? Contact{' '}
            <a href="mailto:support@jobproof.io" className="text-primary font-bold hover:underline">
              support@jobproof.io
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
