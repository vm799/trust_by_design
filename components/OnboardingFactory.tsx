/**
 * Onboarding Factory - Universal Step Renderer
 * Phase D.3 - Handholding Onboarding Flows
 *
 * Renders ANY persona + step combination with:
 * - Progress header (step X of Y)
 * - Step content (dynamic component)
 * - CTA button (complete & continue)
 */

import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { getSupabase } from '../lib/supabase';
import {
  PersonaType,
  getProgressInfo,
  getStepMetadata,
  isFinalStep,
  PERSONA_DASHBOARDS,
  PERSONA_METADATA,
  getPersonaTailwindColors,
} from '../lib/onboarding';

export interface OnboardingFactoryProps {
  persona: PersonaType;
  step: string;
  children: React.ReactNode;
  onComplete?: (stepData?: Record<string, any>) => void;
}

export default function OnboardingFactory({
  persona,
  step,
  children,
  onComplete,
}: OnboardingFactoryProps) {
  const navigate = useNavigate();
  const supabase = getSupabase();
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get progress info
  const progress = getProgressInfo(persona, step);
  const stepMeta = getStepMetadata(persona, step);
  const colors = getPersonaTailwindColors(persona);
  const personaMeta = PERSONA_METADATA[persona];

  if (!stepMeta) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl text-red-500 mb-4">
            error
          </span>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Step Not Found
          </h1>
          <p className="text-gray-600">
            The step "{step}" doesn't exist for {personaMeta.label}
          </p>
        </div>
      </div>
    );
  }

  const handleComplete = async (stepData?: Record<string, any>) => {
    if (completing) return;

    setCompleting(true);
    setError(null);

    try {
      // Call RPC to complete step
      const { data, error: rpcError } = await supabase.rpc(
        'complete_onboarding_step',
        {
          p_step_key: step,
          p_step_data: stepData || {},
        }
      );

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      // Call onComplete callback if provided
      if (onComplete) {
        onComplete(stepData);
      }

      // Redirect to next step or dashboard
      if (data.is_complete) {
        // Onboarding complete - go to dashboard
        navigate(PERSONA_DASHBOARDS[persona]);
      } else if (data.next_step) {
        // Go to next step
        navigate(`/onboarding/${persona}/${data.next_step}`);
      } else {
        // Fallback to dashboard
        navigate(PERSONA_DASHBOARDS[persona]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to complete step. Please try again.');
      setCompleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Progress Header */}
        <div className="mb-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
            <button
              onClick={() => navigate('/complete-onboarding')}
              className="hover:text-gray-900 transition-colors"
            >
              Choose Persona
            </button>
            <span>/</span>
            <span className="font-medium text-gray-900">{personaMeta.label}</span>
          </div>

          {/* Step Counter & Title */}
          <div className="flex items-start gap-4 mb-6">
            <div className={`w-16 h-16 ${colors.bg} rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0`}>
              <span className="text-white font-bold text-2xl">
                {progress.current}
              </span>
            </div>
            <div className="flex-1">
              <div className={`text-sm font-semibold ${colors.text} mb-1`}>
                Step {progress.current} of {progress.total}
              </div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                {stepMeta.title}
              </h1>
              <p className="text-lg text-gray-600">{stepMeta.description}</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
            <div
              className={`h-full bg-gradient-to-r ${colors.gradient} transition-all duration-500 ease-out shadow-md`}
              style={{ width: `${progress.percentage}%` }}
            />
          </div>

          {/* Progress Text */}
          <div className="mt-2 text-sm text-gray-600 text-right">
            {progress.percentage}% complete
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-3xl shadow-xl p-8 mb-8">
          {children}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border-2 border-red-200 rounded-2xl">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-red-600">
                error
              </span>
              <div>
                <h3 className="font-semibold text-red-900">Error</h3>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Bottom CTA */}
        <div className="bg-white rounded-3xl shadow-xl p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {isFinalStep(persona, step) ? (
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-green-600">
                    check_circle
                  </span>
                  <span>Final step - complete to access your dashboard</span>
                </span>
              ) : (
                <span>Click continue when you're ready for the next step</span>
              )}
            </div>
            <button
              onClick={() => handleComplete()}
              disabled={completing}
              className={`
                flex items-center gap-3 px-8 py-4 rounded-2xl font-semibold text-lg
                bg-gradient-to-r ${colors.gradient} text-white
                ${colors.hover} shadow-xl transition-all
                disabled:opacity-50 disabled:cursor-not-allowed
                transform hover:scale-105 active:scale-95
              `}
            >
              {completing ? (
                <>
                  <span className="material-symbols-outlined animate-spin">
                    progress_activity
                  </span>
                  <span>Saving...</span>
                </>
              ) : isFinalStep(persona, step) ? (
                <>
                  <span>Complete Onboarding</span>
                  <span className="material-symbols-outlined">
                    check_circle
                  </span>
                </>
              ) : (
                <>
                  <span>Continue to Step {progress.current + 1}</span>
                  <span className="material-symbols-outlined">
                    arrow_forward
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Pro Tips (Optional) */}
        <div className="mt-8 p-6 bg-blue-50 border-2 border-blue-200 rounded-2xl">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-blue-600 text-2xl">
              lightbulb
            </span>
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">💡 Pro Tip</h3>
              <p className="text-sm text-blue-700">
                {getProTip(persona, step)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function getProTip(persona: PersonaType, step: string): string {
  const tips: Record<PersonaType, Record<string, string>> = {
    solo_contractor: {
      upload_logo: 'Use a square logo (500x500px) for best results on certificates. PNG or JPG formats work great!',
      create_first_job: "Your first job is practice! Don't worry about perfection - you can edit or delete it later.",
      safety_checklist: 'Create a template checklist you can reuse across all jobs. Add items specific to your trade.',
      generate_certificate: 'Certificates are blockchain-sealed and tamper-proof. Share them with clients for instant trust.',
    },
    agency_owner: {
      add_first_technician: "Invite technicians with their email. They'll get setup instructions automatically.",
      bulk_job_import: 'Use CSV import to migrate existing jobs from spreadsheets. Download our template to get started.',
      setup_billing: 'Configure Stripe for automatic billing. Technicians see their invoices in the dashboard.',
      compliance_dashboard: 'Filter by date range, technician, or client to drill into specific metrics.',
    },
    compliance_officer: {
      enable_audit_logs: 'Every action is logged automatically - no configuration needed. Just enable and review.',
      review_pending_jobs: 'Look for missing photos, incomplete safety checks, or unsigned certificates.',
      seal_first_job: 'Blockchain sealing creates an immutable record. Use it when jobs are 100% complete.',
      export_report: 'Reports include all audit logs, photos, and signatures - ready for regulators.',
    },
    safety_manager: {
      create_safety_checklist: 'Include PPE requirements, site hazards, and emergency procedures. Make it comprehensive!',
      risk_assessment: 'Use the HSE 5-point scale: trivial, tolerable, moderate, substantial, intolerable.',
      training_matrix: 'Track expiry dates for certifications. Get alerts 30 days before renewal.',
      incident_log: 'Report near-misses too - they help identify patterns before accidents happen.',
    },
    site_supervisor: {
      daily_briefing: 'Assign crews before 7am so technicians see their jobs when they arrive on site.',
      material_tracking: 'Log deliveries as they arrive to maintain accurate inventory counts.',
      safety_rounds: 'Conduct rounds at the same time daily. Consistency builds a safety culture.',
      end_of_day_report: "Seal completed jobs daily - don't let paperwork pile up!",
    },
  };

  return tips[persona]?.[step] || 'Take your time with each step - onboarding sets you up for success!';
}
