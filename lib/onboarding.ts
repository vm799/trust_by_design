/**
 * Persona Onboarding Factory - API Contracts
 * Phase D.3 - Production Handholding Flows
 */

import { ReactNode } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export type PersonaType =
  | 'solo_contractor'
  | 'agency_owner'
  | 'compliance_officer'
  | 'safety_manager'
  | 'site_supervisor';

export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface OnboardingStep {
  step_key: string;
  step_order: number;
  title: string;
  description: string;
  icon?: string;
  required_data?: Record<string, any>;
}

export interface StepProgress {
  step_key: string;
  status: StepStatus;
  step_data?: Record<string, any>;
  started_at?: string;
  completed_at?: string;
}

export interface PersonaConfig {
  persona_type: PersonaType;
  is_active: boolean;
  is_complete: boolean;
  current_step?: string;
  completed_steps: string[];
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface OnboardingStepComponent {
  persona: PersonaType;
  step: string;
  title: string;
  description: string;
  icon: string;
  component: React.FC<StepComponentProps>;
  validate?: (data: any) => Promise<{ valid: boolean; errors?: string[] }>;
}

export interface StepComponentProps {
  onComplete: (stepData?: Record<string, any>) => Promise<void>;
  stepData?: Record<string, any>;
}

export interface ProgressInfo {
  current: number;
  total: number;
  percentage: number;
  currentStep: string;
  nextStep?: string;
}

// ============================================================================
// PERSONA FLOW DEFINITIONS
// ============================================================================

export const PERSONA_METADATA: Record<
  PersonaType,
  {
    label: string;
    description: string;
    icon: string;
    colorTheme: string;
    targetUser: string;
  }
> = {
  solo_contractor: {
    label: 'Solo Contractor',
    description: 'Individual contractors managing their own jobs and compliance',
    icon: 'person',
    colorTheme: 'blue',
    targetUser: 'Self-employed electricians, plumbers, HVAC technicians',
  },
  agency_owner: {
    label: 'Agency Owner',
    description: 'Manage teams, billing, and multi-job workflows',
    icon: 'business',
    colorTheme: 'purple',
    targetUser: 'Owners of contracting agencies with 5-50 technicians',
  },
  compliance_officer: {
    label: 'Compliance Officer',
    description: 'Audit trails, job sealing, and regulatory compliance',
    icon: 'verified',
    colorTheme: 'green',
    targetUser: 'QA managers, compliance officers, auditors',
  },
  safety_manager: {
    label: 'Safety Manager',
    description: 'Safety inspections, risk assessments, incident tracking',
    icon: 'health_and_safety',
    colorTheme: 'yellow',
    targetUser: 'Site safety officers, HSE managers',
  },
  site_supervisor: {
    label: 'Site Supervisor',
    description: 'Coordinate crews, track materials, conduct safety rounds',
    icon: 'engineering',
    colorTheme: 'orange',
    targetUser: 'Site managers coordinating 5-20 technicians daily',
  },
};

// ============================================================================
// STEP DEFINITIONS (Metadata - matches database)
// ============================================================================

export const PERSONA_STEPS: Record<PersonaType, OnboardingStep[]> = {
  solo_contractor: [
    {
      step_key: 'upload_logo',
      step_order: 1,
      title: 'Upload Your Logo',
      description: 'Add your company logo for professional certificates',
      icon: 'photo_camera',
    },
    {
      step_key: 'create_first_job',
      step_order: 2,
      title: 'Create Your First Job',
      description: 'Set up your first job to understand the workflow',
      icon: 'work',
    },
    {
      step_key: 'safety_checklist',
      step_order: 3,
      title: 'Add Safety Checklist',
      description: 'Create a safety checklist template',
      icon: 'verified_user',
    },
    {
      step_key: 'generate_certificate',
      step_order: 4,
      title: 'Generate Certificate',
      description: 'Create your first compliance certificate',
      icon: 'workspace_premium',
    },
  ],

  agency_owner: [
    {
      step_key: 'add_first_technician',
      step_order: 1,
      title: 'Add Your First Technician',
      description: 'Invite team members to your workspace',
      icon: 'person_add',
    },
    {
      step_key: 'bulk_job_import',
      step_order: 2,
      title: 'Import Jobs',
      description: 'Upload multiple jobs via CSV or create manually',
      icon: 'upload_file',
    },
    {
      step_key: 'setup_billing',
      step_order: 3,
      title: 'Setup Billing',
      description: 'Configure payment methods and billing settings',
      icon: 'credit_card',
    },
    {
      step_key: 'compliance_dashboard',
      step_order: 4,
      title: 'Compliance Dashboard',
      description: 'Review team performance and compliance metrics',
      icon: 'dashboard',
    },
  ],

  compliance_officer: [
    {
      step_key: 'enable_audit_logs',
      step_order: 1,
      title: 'Enable Audit Logs',
      description: 'Activate comprehensive audit trail tracking',
      icon: 'history',
    },
    {
      step_key: 'review_pending_jobs',
      step_order: 2,
      title: 'Review Pending Jobs',
      description: 'Inspect jobs awaiting compliance approval',
      icon: 'task_alt',
    },
    {
      step_key: 'seal_first_job',
      step_order: 3,
      title: 'Seal Your First Job',
      description: 'Learn the blockchain sealing process',
      icon: 'lock',
    },
    {
      step_key: 'export_report',
      step_order: 4,
      title: 'Export Audit Report',
      description: 'Generate compliance reports for regulators',
      icon: 'description',
    },
  ],

  safety_manager: [
    {
      step_key: 'create_safety_checklist',
      step_order: 1,
      title: 'Create Safety Checklist',
      description: 'Build reusable safety inspection templates',
      icon: 'fact_check',
    },
    {
      step_key: 'risk_assessment',
      step_order: 2,
      title: 'Risk Assessment Template',
      description: 'Define risk assessment criteria and scoring',
      icon: 'warning',
    },
    {
      step_key: 'training_matrix',
      step_order: 3,
      title: 'Training Matrix',
      description: 'Track technician certifications and training',
      icon: 'school',
    },
    {
      step_key: 'incident_log',
      step_order: 4,
      title: 'Incident Logging',
      description: 'Set up incident reporting and investigation workflow',
      icon: 'report_problem',
    },
  ],

  site_supervisor: [
    {
      step_key: 'daily_briefing',
      step_order: 1,
      title: 'Daily Crew Briefing',
      description: 'Assign crews to jobs for the day',
      icon: 'engineering',
    },
    {
      step_key: 'material_tracking',
      step_order: 2,
      title: 'Material Tracking',
      description: 'Log material deliveries and inventory',
      icon: 'inventory',
    },
    {
      step_key: 'safety_rounds',
      step_order: 3,
      title: 'Safety Rounds',
      description: 'Conduct daily safety inspections',
      icon: 'health_and_safety',
    },
    {
      step_key: 'end_of_day_report',
      step_order: 4,
      title: 'End of Day Report',
      description: 'Seal completed jobs and generate daily summary',
      icon: 'event_note',
    },
  ],
};

// ============================================================================
// DASHBOARD ROUTES
// ============================================================================

export const PERSONA_DASHBOARDS: Record<PersonaType, string> = {
  solo_contractor: '/dashboard',
  agency_owner: '/dashboard/agency',
  compliance_officer: '/dashboard/compliance',
  safety_manager: '/dashboard/safety',
  site_supervisor: '/dashboard/site-supervisor',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get onboarding progress for current step
 */
export function getProgressInfo(
  persona: PersonaType,
  currentStep: string
): ProgressInfo {
  const steps = PERSONA_STEPS[persona];
  const stepIndex = steps.findIndex((s) => s.step_key === currentStep);
  const currentOrder = stepIndex >= 0 ? stepIndex + 1 : 1;
  const total = steps.length;

  return {
    current: currentOrder,
    total,
    percentage: Math.round((currentOrder / total) * 100),
    currentStep,
    nextStep: steps[stepIndex + 1]?.step_key,
  };
}

/**
 * Get next step in flow
 */
export function getNextStep(
  persona: PersonaType,
  currentStep: string
): string | null {
  const steps = PERSONA_STEPS[persona];
  const stepIndex = steps.findIndex((s) => s.step_key === currentStep);
  return steps[stepIndex + 1]?.step_key || null;
}

/**
 * Get step metadata
 */
export function getStepMetadata(
  persona: PersonaType,
  stepKey: string
): OnboardingStep | null {
  const steps = PERSONA_STEPS[persona];
  return steps.find((s) => s.step_key === stepKey) || null;
}

/**
 * Check if step is final
 */
export function isFinalStep(persona: PersonaType, stepKey: string): boolean {
  const steps = PERSONA_STEPS[persona];
  const lastStep = steps[steps.length - 1];
  return lastStep?.step_key === stepKey;
}

/**
 * Get color class for persona theme
 */
export function getPersonaColorClass(persona: PersonaType): string {
  const theme = PERSONA_METADATA[persona].colorTheme;
  const colorMap: Record<string, string> = {
    blue: 'blue',
    purple: 'purple',
    green: 'green',
    yellow: 'amber',
    orange: 'orange',
  };
  return colorMap[theme] || 'blue';
}

/**
 * Get Tailwind color classes for persona
 */
export function getPersonaTailwindColors(persona: PersonaType) {
  const color = getPersonaColorClass(persona);
  return {
    bg: `bg-${color}-500`,
    bgLight: `bg-${color}-50`,
    text: `text-${color}-600`,
    textDark: `text-${color}-900`,
    border: `border-${color}-200`,
    hover: `hover:bg-${color}-600`,
    gradient: `from-${color}-500 to-${color}-600`,
  };
}

/**
 * Validate required step data
 */
export function validateStepData(
  persona: PersonaType,
  stepKey: string,
  data: any
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Persona-specific validation rules
  switch (persona) {
    case 'solo_contractor':
      if (stepKey === 'upload_logo' && !data.logo_url) {
        errors.push('Logo file is required');
      }
      if (stepKey === 'create_first_job' && !data.job_id) {
        errors.push('Job creation is required');
      }
      break;

    case 'agency_owner':
      if (stepKey === 'add_first_technician' && !data.technician_id) {
        errors.push('At least one technician must be added');
      }
      break;

    case 'compliance_officer':
      if (stepKey === 'seal_first_job' && !data.sealed_job_id) {
        errors.push('Job sealing is required');
      }
      break;

    case 'safety_manager':
      if (stepKey === 'create_safety_checklist' && !data.checklist_id) {
        errors.push('Safety checklist creation is required');
      }
      break;

    case 'site_supervisor':
      if (stepKey === 'daily_briefing' && !data.crew_assigned) {
        errors.push('Crew assignment is required');
      }
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
