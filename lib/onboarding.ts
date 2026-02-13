/**
 * Persona Onboarding Factory - API Contracts
 * Phase D.3 - Production Handholding Flows
 */

// Note: ReactNode was previously imported but unused - removed for lint compliance

/**
 * Escape HTML special characters to prevent XSS attacks.
 * All user-facing text in innerHTML MUST be escaped.
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

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
      description: 'Learn the job sealing process',
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

// ============================================================================
// GUIDED FLOW SYSTEM
// ============================================================================

export interface GuidedFlowStep {
  action: string;
  nextRoute: string;
  autoFocusField?: string;
  tooltipMessage?: string;
}

/**
 * Guided flow definitions for automatic navigation after actions
 */
export const GUIDED_FLOWS: Record<string, GuidedFlowStep[]> = {
  solo_contractor: [
    {
      action: 'CREATE_CLIENT',
      nextRoute: '/admin/create',
      autoFocusField: 'clientId',
      tooltipMessage: 'Great! Now let\'s create your first job for this client.'
    },
    {
      action: 'CREATE_JOB',
      nextRoute: '/admin',
      tooltipMessage: 'Perfect! Your technician will receive a magic link to start work.'
    }
  ],
  agency_owner: [
    {
      action: 'ADD_TECHNICIAN',
      nextRoute: '/admin/clients',
      autoFocusField: 'name',
      tooltipMessage: 'Excellent! Now add a client to assign jobs to.'
    },
    {
      action: 'CREATE_CLIENT',
      nextRoute: '/admin/create',
      autoFocusField: 'techId',
      tooltipMessage: 'Now create a job and assign it to your technician.'
    },
    {
      action: 'CREATE_JOB',
      nextRoute: '/admin',
      tooltipMessage: 'All set! You can now manage jobs, clients, and technicians.'
    }
  ],
  compliance_officer: [
    {
      action: 'CREATE_CLIENT',
      nextRoute: '/admin/create',
      autoFocusField: 'clientId',
      tooltipMessage: 'Great! Now create a job to begin the compliance workflow.'
    },
    {
      action: 'CREATE_JOB',
      nextRoute: '/admin',
      tooltipMessage: 'Job created! You can now review and seal jobs for compliance.'
    }
  ],
  safety_manager: [
    {
      action: 'CREATE_CHECKLIST',
      nextRoute: '/admin/templates',
      tooltipMessage: 'Safety checklist template created! Now create your first job.'
    },
    {
      action: 'CREATE_CLIENT',
      nextRoute: '/admin/create',
      autoFocusField: 'clientId',
      tooltipMessage: 'Client added! Now create a safety-tracked job.'
    },
    {
      action: 'CREATE_JOB',
      nextRoute: '/admin',
      tooltipMessage: 'Job dispatched! Safety checklist will be enforced on completion.'
    }
  ],
  site_supervisor: [
    {
      action: 'ADD_TECHNICIAN',
      nextRoute: '/admin/clients',
      autoFocusField: 'name',
      tooltipMessage: 'Team member added! Now add a client site location.'
    },
    {
      action: 'CREATE_CLIENT',
      nextRoute: '/admin/create',
      autoFocusField: 'techId',
      tooltipMessage: 'Site added! Now dispatch your first job.'
    },
    {
      action: 'CREATE_JOB',
      nextRoute: '/admin',
      tooltipMessage: 'Job dispatched! You can now track daily progress.'
    }
  ]
};

/**
 * Toast notification function
 * Shows success messages with guided flow tooltips
 */
export const showToast = (options: {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}) => {
  const { type, message, duration = 5000 } = options;

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `fixed top-6 right-6 z-[200] animate-in slide-in-from-top-5 fade-in duration-300 max-w-md`;

  const bgColor = {
    success: 'bg-success/10 border-success/30 text-success',
    error: 'bg-red-500/10 border-red-500/30 text-red-400',
    info: 'bg-primary/10 border-primary/30 text-primary',
    warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
  }[type];

  const icon = {
    success: 'check_circle',
    error: 'error',
    info: 'info',
    warning: 'warning'
  }[type];

  toast.innerHTML = `
    <div class="bg-slate-900 border-2 ${bgColor} rounded-2xl p-4 shadow-2xl backdrop-blur-sm">
      <div class="flex items-start gap-3">
        <span class="material-symbols-outlined text-xl">${icon}</span>
        <div class="flex-1">
          <p class="font-semibold text-white mb-1">Guided Flow</p>
          <p class="text-sm ${bgColor.split(' ')[2]}">${escapeHtml(message)}</p>
        </div>
        <button onclick="this.parentElement.parentElement.parentElement.remove()" class="text-slate-500 hover:text-white transition-colors">
          <span class="material-symbols-outlined text-sm">close</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(toast);

  // Auto-remove after duration
  setTimeout(() => {
    toast.classList.add('animate-out', 'slide-out-to-right-5', 'fade-out');
    setTimeout(() => {
      if (toast.parentElement) {
        toast.remove();
      }
    }, 300);
  }, duration);
};

/**
 * Navigate to next step in the guided flow
 * @param currentAction - The action that was just completed
 * @param persona - User's persona type
 * @param navigate - React Router navigate function
 */
export const navigateToNextStep = (
  currentAction: string,
  persona: string | undefined,
  navigate: any
) => {
  if (!persona) {
    console.warn('[Guided Flow] No persona provided, skipping auto-navigation');
    return;
  }

  const normalizedPersona = persona.toLowerCase();
  const flow = GUIDED_FLOWS[normalizedPersona];

  if (!flow) {
    console.warn(`[Guided Flow] No flow defined for persona: ${normalizedPersona}`);
    return;
  }

  const currentStep = flow.find(s => s.action === currentAction);

  if (!currentStep) {
    console.warn(`[Guided Flow] Action ${currentAction} not found in flow for ${normalizedPersona}`);
    return;
  }


  // Navigate to next route
  navigate(currentStep.nextRoute);

  // Auto-focus field after navigation
  if (currentStep.autoFocusField) {
    setTimeout(() => {
      const field = document.getElementById(currentStep.autoFocusField!) ||
                    document.querySelector(`[name="${currentStep.autoFocusField}"]`) as HTMLElement;

      if (field) {
        field.focus();
        field.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Add visual highlight animation
        field.classList.add('ring-4', 'ring-primary', 'ring-opacity-50', 'transition-all', 'duration-500');
        setTimeout(() => {
          field.classList.remove('ring-4', 'ring-primary', 'ring-opacity-50');
        }, 2000);
      }
    }, 300);
  }

  // Show tooltip notification
  if (currentStep.tooltipMessage) {
    setTimeout(() => {
      showToast({
        type: 'success',
        message: currentStep.tooltipMessage!,
        duration: 5000
      });
    }, 500);
  }
};

/**
 * Check if user should see guided flow based on their activity
 * @param persona - User's persona
 * @param activityCounts - Object with counts of user activities
 */
export const shouldShowGuidedFlow = (
  persona: string | undefined,
  activityCounts: {
    clients: number;
    technicians: number;
    jobs: number;
    templates?: number;
  }
): boolean => {
  if (!persona) return false;

  const normalizedPersona = persona.toLowerCase();

  // Show guided flow if user has minimal activity
  switch (normalizedPersona) {
    case 'solo_contractor':
      return activityCounts.clients === 0 || activityCounts.jobs === 0;

    case 'agency_owner':
      return activityCounts.technicians === 0 || activityCounts.clients === 0 || activityCounts.jobs === 0;

    case 'compliance_officer':
      return activityCounts.clients === 0 || activityCounts.jobs === 0;

    case 'safety_manager':
      return activityCounts.clients === 0 || activityCounts.jobs === 0;

    case 'site_supervisor':
      return activityCounts.technicians === 0 || activityCounts.clients === 0 || activityCounts.jobs === 0;

    default:
      return false;
  }
};

/**
 * Get the next recommended action for a persona based on their current state
 */
export const getNextRecommendedAction = (
  persona: string | undefined,
  activityCounts: {
    clients: number;
    technicians: number;
    jobs: number;
    templates?: number;
  }
): { action: string; route: string; label: string } | null => {
  if (!persona) return null;

  const normalizedPersona = persona.toLowerCase();
  const flow = GUIDED_FLOWS[normalizedPersona];

  if (!flow) return null;

  // Determine what action should come next
  if (normalizedPersona === 'solo_contractor') {
    if (activityCounts.clients === 0) {
      return {
        action: 'CREATE_CLIENT',
        route: '/admin/clients',
        label: 'Add your first client'
      };
    }
    if (activityCounts.jobs === 0) {
      return {
        action: 'CREATE_JOB',
        route: '/admin/create',
        label: 'Create your first job'
      };
    }
  }

  if (normalizedPersona === 'agency_owner' || normalizedPersona === 'site_supervisor') {
    if (activityCounts.technicians === 0) {
      return {
        action: 'ADD_TECHNICIAN',
        route: '/admin/technicians',
        label: 'Add your first technician'
      };
    }
    if (activityCounts.clients === 0) {
      return {
        action: 'CREATE_CLIENT',
        route: '/admin/clients',
        label: 'Add your first client'
      };
    }
    if (activityCounts.jobs === 0) {
      return {
        action: 'CREATE_JOB',
        route: '/admin/create',
        label: 'Dispatch your first job'
      };
    }
  }

  return null;
};
