'use client';

/**
 * Smart Dashboard Router
 * Routes users based on their persona completion status
 *
 * Logic:
 * - No persona → /complete-onboarding
 * - Incomplete persona → /onboarding/{persona}/{current_step}
 * - Complete persona → /dashboard/{persona}
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { PERSONA_DASHBOARDS, PersonaType } from '@/lib/onboarding';

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    routeToCorrectDashboard();
  }, []);

  const routeToCorrectDashboard = async () => {
    try {
      // Check authentication
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/');
        return;
      }

      // Get user's active persona
      const { data: persona, error } = await supabase
        .from('user_personas')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (error || !persona) {
        // No persona found → persona selection
        router.push('/complete-onboarding');
        return;
      }

      // Check if onboarding is complete
      if (!persona.is_complete) {
        // Incomplete onboarding → resume
        if (persona.current_step) {
          router.push(`/onboarding/${persona.persona_type}/${persona.current_step}`);
        } else {
          // No current step → get first step
          const { data: firstStep } = await supabase
            .from('onboarding_steps')
            .select('step_key')
            .eq('persona_type', persona.persona_type)
            .order('step_order')
            .limit(1)
            .single();

          if (firstStep) {
            router.push(`/onboarding/${persona.persona_type}/${firstStep.step_key}`);
          } else {
            // Fallback to persona selection if no steps found
            router.push('/complete-onboarding');
          }
        }
        return;
      }

      // Complete onboarding → persona dashboard
      const dashboardRoute = PERSONA_DASHBOARDS[persona.persona_type as PersonaType];
      if (dashboardRoute) {
        router.push(dashboardRoute);
      } else {
        // Fallback to generic dashboard
        router.push('/admin');
      }
    } catch (err) {
      // Fallback to persona selection on error
      router.push('/complete-onboarding');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Loading Dashboard
          </h2>
          <p className="text-gray-600">
            Preparing your workspace...
          </p>
        </div>
      </div>
    );
  }

  return null;
}
