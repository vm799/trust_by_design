'use client';

/**
 * Complete Onboarding - Persona Selection Page
 * Production-ready with all 5 personas using PersonaCard component
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import PersonaCard from '@/components/PersonaCard';
import { PersonaType, PERSONA_DASHBOARDS } from '@/lib/onboarding';

export default function CompleteOnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    checkExistingPersona();
  }, []);

  const checkExistingPersona = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/');
        return;
      }

      // Check if user already has a completed persona
      const { data: personas } = await supabase
        .from('user_personas')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_complete', true)
        .eq('is_active', true)
        .single();

      if (personas) {
        // Redirect to appropriate dashboard
        const dashboardRoute = PERSONA_DASHBOARDS[personas.persona_type as PersonaType];
        router.push(dashboardRoute);
        return;
      }

      // Check if user has incomplete persona (resume onboarding)
      const { data: incompletePersona } = await supabase
        .from('user_personas')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_complete', false)
        .eq('is_active', true)
        .single();

      if (incompletePersona && incompletePersona.current_step) {
        // Resume onboarding
        router.push(`/onboarding/${incompletePersona.persona_type}/${incompletePersona.current_step}`);
        return;
      }

      setLoading(false);
    } catch (err) {
      // Error handled silently
      setLoading(false);
    }
  };

  const handlePersonaSelect = async (persona: PersonaType) => {
    if (selecting) return;

    setSelecting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Get user's workspace
      const { data: profile } = await supabase
        .from('users')
        .select('workspace_id')
        .eq('id', user.id)
        .single();

      if (!profile) {
        throw new Error('Profile not found');
      }

      // Get first step for this persona
      const { data: firstStep } = await supabase
        .from('onboarding_steps')
        .select('step_key')
        .eq('persona_type', persona)
        .order('step_order')
        .limit(1)
        .single();

      if (!firstStep) {
        throw new Error('No onboarding steps found for persona');
      }

      // Create persona record
      const { error: personaError } = await supabase
        .from('user_personas')
        .insert({
          user_id: user.id,
          workspace_id: profile.workspace_id,
          persona_type: persona,
          is_active: true,
          is_complete: false,
          current_step: firstStep.step_key,
        });

      if (personaError) throw personaError;

      // Note: Redirect is handled by PersonaCard component
    } catch (err) {
      // Error shown via alert
      alert('Failed to start onboarding. Please try again.');
      setSelecting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-3xl shadow-xl mb-6">
            <span className="material-symbols-outlined text-white text-5xl">
              person_check
            </span>
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Choose Your Role
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Select the option that best describes your primary responsibility.
            We'll customize your experience with guided workflows optimized for your role.
          </p>
        </div>

        {/* Persona Cards Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <PersonaCard
            persona="solo_contractor"
            onSelect={handlePersonaSelect}
            disabled={selecting}
          />
          <PersonaCard
            persona="agency_owner"
            onSelect={handlePersonaSelect}
            disabled={selecting}
          />
          <PersonaCard
            persona="compliance_officer"
            onSelect={handlePersonaSelect}
            disabled={selecting}
          />
          <PersonaCard
            persona="safety_manager"
            onSelect={handlePersonaSelect}
            disabled={selecting}
          />
          <PersonaCard
            persona="site_supervisor"
            onSelect={handlePersonaSelect}
            disabled={selecting}
          />
        </div>

        {/* Help Section */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-3xl shadow-lg p-8 border-2 border-blue-100">
            <div className="flex items-start gap-4">
              <span className="material-symbols-outlined text-blue-600 text-4xl">
                help_outline
              </span>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Not sure which role fits?
                </h3>
                <p className="text-gray-600 mb-4">
                  Contact our team for personalized guidance. We'll help you choose the right persona for your workflow.
                </p>
                <a
                  href="mailto:support@jobproof.io"
                  className="inline-flex items-center gap-2 text-blue-600 font-semibold hover:text-blue-700 transition-colors"
                >
                  <span className="material-symbols-outlined">email</span>
                  <span>support@jobproof.io</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Selecting State */}
        {selecting && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-md">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Setting Up Your Workspace
                </h3>
                <p className="text-gray-600">
                  Preparing your personalized onboarding experience...
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
