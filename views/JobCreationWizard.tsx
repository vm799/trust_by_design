import React, { useState, useRef, useEffect, useCallback } from 'react';
import Layout from '../components/AppLayout';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Job } from '../types';
import { generateMagicLink, storeMagicLinkLocal } from '../lib/db';
import { celebrateSuccess, hapticFeedback, showToast } from '../lib/microInteractions';
import { useData } from '../lib/DataContext';
import { useAuth } from '../lib/AuthContext';
import { safeSaveDraft, loadDraft, clearDraft as clearDraftDB, migrateDraftFromLocalStorage } from '../lib/utils/storageUtils';
import { JOB_STATUS, SYNC_STATUS } from '../lib/constants';
import { generateJobId } from '../lib/utils/jobId';
import PostJobCreationModal from '../components/ui/PostJobCreationModal';

/**
 * Job Creation Wizard - Unified Job Creation
 *
 * 5-Step Guided Flow (Progressive Disclosure):
 * 1. Job Basics (title, type, priority)
 * 2. Job Location (address, site notes, map preview)
 * 3. Scope & Requirements (description, safety, PPE)
 * 4. Assign Contractor (client required, technician optional)
 * 5. Review & Create
 *
 * Architecture: DataContext + IndexedDB drafts + ISO dates + constants
 */

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface JobCreationWizardProps {
  // All data comes from DataContext + AuthContext internally - no props needed
}

interface JobFormData {
  // Step 1: Basics
  title: string;
  jobType: string;
  priority: 'normal' | 'urgent';

  // Step 2: Location
  address: string;
  siteNotes: string;

  // Step 3: Scope
  workDescription: string;
  safetyRequirements: string[];
  requiredPPE: string[];

  // Step 4: Contractor
  clientId: string;
  techId: string;
}

const JOB_TYPES = [
  { id: 'inspection', label: 'Inspection', icon: 'search' },
  { id: 'maintenance', label: 'Maintenance', icon: 'build' },
  { id: 'installation', label: 'Installation', icon: 'construction' },
  { id: 'repair', label: 'Repair', icon: 'handyman' },
  { id: 'survey', label: 'Survey', icon: 'map' },
  { id: 'other', label: 'Other', icon: 'more_horiz' },
];

const SAFETY_REQUIREMENTS = [
  { id: 'hazard_id', label: 'Hazard Identification Required' },
  { id: 'permits', label: 'Work Permits Required' },
  { id: 'isolation', label: 'Isolation Procedures Required' },
  { id: 'confined_space', label: 'Confined Space Entry' },
  { id: 'hot_work', label: 'Hot Work Permit Required' },
  { id: 'working_height', label: 'Working at Height' },
];

const PPE_OPTIONS = [
  { id: 'hardhat', label: 'Hard Hat', icon: 'construction' },
  { id: 'hivis', label: 'Hi-Vis Vest', icon: 'visibility' },
  { id: 'gloves', label: 'Gloves', icon: 'back_hand' },
  { id: 'boots', label: 'Safety Boots', icon: 'steps' },
  { id: 'goggles', label: 'Safety Goggles', icon: 'eyeglasses' },
  { id: 'earplugs', label: 'Ear Protection', icon: 'hearing' },
  { id: 'mask', label: 'Dust Mask', icon: 'masks' },
  { id: 'harness', label: 'Safety Harness', icon: 'air' },
];

const STEP_TITLES = [
  'Job Basics',
  'Job Location',
  'Scope & Requirements',
  'Assign Contractor',
  'Review & Create',
];

const JobCreationWizard: React.FC<JobCreationWizardProps> = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // DataContext: Single source of truth for all data operations
  const {
    clients,
    technicians,
    addJob: contextAddJob,
    updateJob: contextUpdateJob,
  } = useData();

  // AuthContext: Session and user info
  const { session, userEmail } = useAuth();
  const workspaceId = session?.user?.user_metadata?.workspace_id || 'default';
  const userPersona = session?.user?.user_metadata?.persona;

  const [step, setStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdJobId, setCreatedJobId] = useState('');
  const [magicLinkUrl, setMagicLinkUrl] = useState('');
  const [magicLinkToken, setMagicLinkToken] = useState('');
  const [draftLoaded, setDraftLoaded] = useState(false);

  const [formData, setFormData] = useState<JobFormData>({
    title: '',
    jobType: '',
    priority: 'normal',
    address: '',
    siteNotes: '',
    workDescription: '',
    safetyRequirements: ['hazard_id'],
    requiredPPE: ['hardhat', 'hivis', 'boots'],
    clientId: '',
    techId: '',
  });

  // Load draft from IndexedDB on mount with workspace isolation + migration
  useEffect(() => {
    if (draftLoaded) return;

    const loadDraftFromDB = async () => {
      try {
        // Migrate old localStorage drafts to IndexedDB
        await migrateDraftFromLocalStorage('wizard', workspaceId);
        // Also migrate from the old key name
        const oldKey = 'jobproof_job_creation_draft';
        try {
          const oldDraft = localStorage.getItem(oldKey);
          if (oldDraft) {
            const parsed = JSON.parse(oldDraft);
            if (parsed.formData) {
              await safeSaveDraft('wizard', { ...parsed.formData, step: parsed.step } as unknown as Record<string, unknown>, workspaceId);
              localStorage.removeItem(oldKey);
            }
          }
        } catch { /* migration failed, non-critical */ }

        const draftData = await loadDraft('wizard', workspaceId);
        if (draftData && draftData.title !== undefined) {
          const { step: savedStep, ...rest } = draftData as Record<string, unknown>;
          setFormData(prev => ({ ...prev, ...rest as Partial<JobFormData> }));
          if (typeof savedStep === 'number' && savedStep >= 1 && savedStep <= 5) {
            setStep(savedStep);
          }
        }
      } catch (e) {
        console.error('[JobCreationWizard] Draft load failed:', e);
      } finally {
        setDraftLoaded(true);
      }
    };

    loadDraftFromDB();
  }, [draftLoaded, workspaceId]);

  // Auto-save draft to IndexedDB (debounced, workspace-isolated)
  useEffect(() => {
    if (!draftLoaded) return;
    if (!formData.title && !formData.address && !formData.workDescription) return;

    const timer = setTimeout(() => {
      safeSaveDraft('wizard', { ...formData, step } as unknown as Record<string, unknown>, workspaceId).catch((error) => {
        console.error('[JobCreationWizard] Draft save failed:', error);
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [formData, step, draftLoaded, workspaceId]);

  // Clear draft after successful job creation
  const clearDraft = useCallback(async () => {
    try {
      await clearDraftDB('wizard', workspaceId);
    } catch { /* non-critical */ }
  }, [workspaceId]);

  // Phase 2.5: Auto-populate from returnTo params (client/technician creation flow)
  useEffect(() => {
    const newClientId = searchParams.get('newClientId');
    const newTechId = searchParams.get('newTechId');

    if (newClientId || newTechId) {
      // Apply new IDs on top of restored draft
      setFormData(prev => ({
        ...prev,
        ...(newClientId && { clientId: newClientId }),
        ...(newTechId && { techId: newTechId }),
      }));

      // Jump to step 4 (Assign Contractor) if we have new selections
      if (newClientId || newTechId) {
        setStep(4);
        showToast(
          newClientId && newTechId
            ? 'Client and technician selected!'
            : newClientId
            ? 'Client selected! Now choose a technician.'
            : 'Technician selected!',
          'success',
          3000
        );
      }

      // Clear the params from URL to prevent re-triggering
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('newClientId');
      newParams.delete('newTechId');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Refs for auto-focus
  const titleRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const clientRef = useRef<HTMLSelectElement>(null);

  // UAT Fix #10: Auto-focus AND auto-scroll on step change
  useEffect(() => {
    const refs = [titleRef, addressRef, descriptionRef, clientRef];
    const currentRef = refs[step - 1];
    if (currentRef?.current) {
      // First scroll to element, then focus
      setTimeout(() => {
        currentRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
        // Focus after scroll completes
        setTimeout(() => currentRef.current?.focus(), 300);
      }, 100);
    } else {
      // If no specific ref, scroll to top of form
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [step]);

  const canProceed = (): boolean => {
    switch (step) {
      case 1:
        return !!formData.title.trim() && !!formData.jobType;
      case 2:
        return !!formData.address.trim();
      case 3:
        return !!formData.workDescription.trim();
      case 4:
        return !!formData.clientId; // Technician is optional ("Assign later")
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (canProceed() && step < 5) {
      hapticFeedback('light');
      setStep(step + 1);
    }
  };

  // Phase 2.5: Keyboard navigation - Enter to proceed, Escape to go back
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Don't trigger on textareas (allow multi-line input)
    if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;

    if (e.key === 'Enter' && canProceed() && step < 5) {
      e.preventDefault();
      handleNext();
    } else if (e.key === 'Escape' && step > 1) {
      e.preventDefault();
      handleBack();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      hapticFeedback('light');
      setStep(step - 1);
    }
  };

  const handleDispatch = async () => {
    const client = clients.find(c => c.id === formData.clientId);
    if (!client) return;
    const tech = formData.techId ? technicians.find(t => t.id === formData.techId) : null;

    setIsCreating(true);

    try {
      // Build the full Job object - DataContext handles all persistence
      const newJobId = generateJobId();

      const newJob: Job = {
        id: newJobId,
        title: formData.title.trim(),
        description: formData.workDescription.trim() || undefined,
        notes: formData.workDescription.trim() || '',
        client: client.name,
        clientId: client.id,
        technician: tech?.name || '',
        technicianId: tech?.id || undefined,
        techId: tech?.id || '',
        address: formData.address.trim(),
        date: new Date().toISOString(),
        priority: formData.priority,
        status: JOB_STATUS.PENDING,
        photos: [],
        signature: null,
        safetyChecklist: [
          ...formData.safetyRequirements.map((req, idx) => ({
            id: `safety-${idx}`,
            label: SAFETY_REQUIREMENTS.find(s => s.id === req)?.label || req,
            checked: false,
            required: true,
          })),
          ...formData.requiredPPE.map((ppe, idx) => ({
            id: `ppe-${idx}`,
            label: `${PPE_OPTIONS.find(p => p.id === ppe)?.label || ppe} Worn`,
            checked: false,
            required: true,
          })),
        ],
        siteHazards: [],
        syncStatus: SYNC_STATUS.PENDING,
        lastUpdated: Date.now(),
      };

      // DataContext handles Supabase + Dexie offline queue automatically
      contextAddJob(newJob);
      setCreatedJobId(newJobId);

      // Generate magic link if technician is assigned
      if (tech && userEmail) {
        let linkUrl: string | null = null;
        let linkToken: string | null = null;

        try {
          const magicLinkResult = await generateMagicLink(newJobId, userEmail);
          if (magicLinkResult.success && magicLinkResult.data?.url) {
            linkUrl = magicLinkResult.data.url;
            linkToken = magicLinkResult.data.token;
          } else {
            const localMagicLink = storeMagicLinkLocal(newJobId, userEmail, workspaceId);
            linkUrl = localMagicLink.url;
            linkToken = localMagicLink.token;
          }
        } catch {
          const localMagicLink = storeMagicLinkLocal(newJobId, userEmail, workspaceId);
          linkUrl = localMagicLink.url;
          linkToken = localMagicLink.token;
        }

        if (linkUrl && linkToken) {
          setMagicLinkUrl(linkUrl);
          setMagicLinkToken(linkToken);
          // Persist magic link on the job so it survives navigation
          contextUpdateJob({
            ...newJob,
            magicLinkUrl: linkUrl,
            magicLinkToken: linkToken,
            magicLinkCreatedAt: new Date().toISOString(),
          });
        }
      }

      await clearDraft();
      setShowSuccessModal(true);
      celebrateSuccess();
    } catch (error) {
      console.error('Failed to create job:', error);
      showToast('Failed to create job. Please try again.', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const selectedClient = clients.find(c => c.id === formData.clientId);
  const selectedTech = formData.techId ? technicians.find(t => t.id === formData.techId) : null;

  // Phase 2.5: Calculate progress percentage for smooth progress bar
  const progressPercent = ((step - 1) / (STEP_TITLES.length - 1)) * 100;

  return (
    <Layout user={null}>
      <div className="max-w-2xl mx-auto pb-20">
        {/* Phase 2.5: Top Progress Bar - Fixed position for visibility */}
        <div className="sticky top-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm pt-4 pb-2 -mx-4 px-4 mb-6">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span className="font-bold uppercase tracking-widest">
              Step {step} of {STEP_TITLES.length}
            </span>
            <span className="font-mono">{Math.round(progressPercent)}%</span>
          </div>
          <div className="h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-success rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Step Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {STEP_TITLES.map((title, idx) => (
              <div key={`step-${title}`} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`size-10 rounded-full flex items-center justify-center font-black text-sm transition-all ${
                      idx + 1 < step
                        ? 'bg-success text-white'
                        : idx + 1 === step
                        ? 'bg-primary text-white ring-4 ring-primary/20'
                        : 'bg-gray-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {idx + 1 < step ? (
                      <span className="material-symbols-outlined">check</span>
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider mt-2 hidden md:block ${
                    idx + 1 === step ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'
                  }`}>
                    {title}
                  </span>
                </div>
                {idx < STEP_TITLES.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${
                    idx + 1 < step ? 'bg-success' : 'bg-gray-100 dark:bg-slate-800'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight text-center md:hidden">
            {STEP_TITLES[step - 1]}
          </h2>
        </div>

        {/* Step Content - Phase 2.5: Added keyboard navigation */}
        <div
          className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/15 rounded-[2.5rem] p-6 md:p-8 shadow-2xl focus-within:ring-2 focus-within:ring-primary/20 transition-all"
          onKeyDown={handleKeyDown}
        >
          {/* Step 1: Job Basics */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-5 duration-300">
              <div className="text-center space-y-2 mb-8">
                <span className="material-symbols-outlined text-primary text-4xl">work</span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  What&apos;s the job?
                </h3>
              </div>

              <div className="space-y-2">
                <label htmlFor="wizard-job-title" className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                  Job Title *
                </label>
                <input
                  id="wizard-job-title"
                  ref={titleRef}
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-gray-100 dark:bg-slate-800 border-2 border-slate-600 focus:border-primary rounded-xl py-4 px-5 text-slate-900 dark:text-white text-lg outline-none transition-all"
                  placeholder="e.g., Boiler Service - Unit 4B"
                />
              </div>

              <div className="space-y-3">
                <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                  Job Type *
                </span>
                <div className="grid grid-cols-3 gap-3">
                  {JOB_TYPES.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, jobType: type.id })}
                      className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                        formData.jobType === type.id
                          ? 'bg-primary/10 border-primary text-slate-900 dark:text-white'
                          : 'bg-gray-100 dark:bg-slate-800 border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <span className={`material-symbols-outlined text-2xl ${
                        formData.jobType === type.id ? 'text-primary' : ''
                      }`}>{type.icon}</span>
                      <span className="text-xs font-bold">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* UAT Fix #5: Normal/Urgent buttons with distinct colors */}
              <div className="space-y-3">
                <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                  Priority
                </span>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      hapticFeedback('light');
                      setFormData({ ...formData, priority: 'normal' });
                    }}
                    className={`flex-1 py-4 rounded-xl border-2 font-bold uppercase tracking-wide transition-all press-spring btn-interactive flex items-center justify-center gap-2 ${
                      formData.priority === 'normal'
                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                        : 'bg-gray-100 dark:bg-slate-800 border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">schedule</span>
                    Normal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      hapticFeedback('medium');
                      setFormData({ ...formData, priority: 'urgent' });
                    }}
                    className={`flex-1 py-4 rounded-xl border-2 font-bold uppercase tracking-wide transition-all press-spring btn-interactive flex items-center justify-center gap-2 ${
                      formData.priority === 'urgent'
                        ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse'
                        : 'bg-gray-100 dark:bg-slate-800 border-slate-600 text-slate-500 dark:text-slate-400 hover:border-red-500/50 hover:text-red-600 dark:hover:text-red-400'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">priority_high</span>
                    Urgent
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Job Location */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-5 duration-300">
              <div className="text-center space-y-2 mb-8">
                <span className="material-symbols-outlined text-primary text-4xl">location_on</span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Where is the job?
                </h3>
              </div>

              <div className="space-y-2">
                <label htmlFor="wizard-job-address" className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                  Job Address *
                </label>
                <input
                  id="wizard-job-address"
                  ref={addressRef}
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-gray-100 dark:bg-slate-800 border-2 border-slate-600 focus:border-primary rounded-xl py-4 px-5 text-slate-900 dark:text-white outline-none transition-all"
                  placeholder="123 Industrial Estate, London, UK"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="wizard-site-notes" className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                  Site Notes (Optional)
                </label>
                <textarea
                  id="wizard-site-notes"
                  value={formData.siteNotes}
                  onChange={(e) => setFormData({ ...formData, siteNotes: e.target.value })}
                  className="w-full bg-gray-100 dark:bg-slate-800 border-2 border-slate-600 focus:border-primary rounded-xl py-4 px-5 text-slate-900 dark:text-white outline-none transition-all resize-none"
                  rows={3}
                  placeholder="Gate code, access instructions, parking info..."
                />
              </div>

              {/* UAT Fix #8: Location preview with clickable map link */}
              {formData.address && (
                <div className="bg-gray-100 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-white/15">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                      Location Preview
                    </p>
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(formData.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[9px] font-bold text-primary uppercase tracking-wide flex items-center gap-1 hover:underline"
                    >
                      <span className="material-symbols-outlined text-sm">open_in_new</span>
                      Open in Maps
                    </a>
                  </div>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(formData.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-gray-200 dark:bg-slate-700 rounded-lg h-40 flex items-center justify-center relative overflow-hidden group cursor-pointer hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-100/80 dark:from-slate-900/80 to-transparent z-10" />
                    <span className="material-symbols-outlined text-slate-500 dark:text-slate-400 text-5xl group-hover:text-primary transition-colors z-20">map</span>
                    <div className="absolute bottom-3 left-3 right-3 z-20">
                      <p className="text-[10px] text-slate-900 dark:text-white font-medium tracking-tight truncate">{formData.address}</p>
                      <p className="text-[8px] text-slate-700 dark:text-slate-300 uppercase tracking-wide mt-1 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[10px]">touch_app</span>
                        Tap to view in Google Maps
                      </p>
                    </div>
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Scope & Requirements */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-5 duration-300">
              <div className="text-center space-y-2 mb-8">
                <span className="material-symbols-outlined text-primary text-4xl">checklist</span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Scope & Safety
                </h3>
              </div>

              <div className="space-y-2">
                <label htmlFor="wizard-work-description" className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                  Work Description *
                </label>
                <textarea
                  id="wizard-work-description"
                  ref={descriptionRef}
                  required
                  value={formData.workDescription}
                  onChange={(e) => setFormData({ ...formData, workDescription: e.target.value })}
                  className="w-full bg-gray-100 dark:bg-slate-800 border-2 border-slate-600 focus:border-primary rounded-xl py-4 px-5 text-slate-900 dark:text-white outline-none transition-all resize-none"
                  rows={4}
                  placeholder="• Check boiler pressure&#10;• Inspect flue&#10;• Test safety valve"
                />
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Use bullet points for clarity</p>
              </div>

              <div className="space-y-3">
                <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                  Safety Requirements
                </span>
                <div className="space-y-2">
                  {SAFETY_REQUIREMENTS.map((req) => (
                    <button
                      key={req.id}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          safetyRequirements: prev.safetyRequirements.includes(req.id)
                            ? prev.safetyRequirements.filter(r => r !== req.id)
                            : [...prev.safetyRequirements, req.id]
                        }));
                      }}
                      className={`w-full p-3 rounded-xl border-2 transition-all flex items-center gap-3 text-left ${
                        formData.safetyRequirements.includes(req.id)
                          ? 'bg-amber-500/10 border-amber-500/50 text-slate-900 dark:text-white'
                          : 'bg-gray-100 dark:bg-slate-800 border-slate-600 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <span className={`material-symbols-outlined text-xl ${
                        formData.safetyRequirements.includes(req.id) ? 'text-amber-500' : 'text-slate-500 dark:text-slate-400'
                      }`}>
                        {formData.safetyRequirements.includes(req.id) ? 'check_box' : 'check_box_outline_blank'}
                      </span>
                      <span className="text-sm font-medium">{req.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                  Required PPE
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {PPE_OPTIONS.map((ppe) => (
                    <button
                      key={ppe.id}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          requiredPPE: prev.requiredPPE.includes(ppe.id)
                            ? prev.requiredPPE.filter(p => p !== ppe.id)
                            : [...prev.requiredPPE, ppe.id]
                        }));
                      }}
                      className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                        formData.requiredPPE.includes(ppe.id)
                          ? 'bg-primary/10 border-primary text-slate-900 dark:text-white'
                          : 'bg-gray-100 dark:bg-slate-800 border-slate-600 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <span className={`material-symbols-outlined text-xl ${
                        formData.requiredPPE.includes(ppe.id) ? 'text-primary' : ''
                      }`}>{ppe.icon}</span>
                      <span className="text-[9px] font-bold">{ppe.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Assign Contractor - UAT Fix #4, #9 */}
          {step === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-5 duration-300">
              <div className="text-center space-y-2 mb-8">
                <span className="material-symbols-outlined text-primary text-4xl">person_add</span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Who&apos;s doing the work?
                </h3>
              </div>

              {/* UAT Fix #4: Warning if no clients/technicians exist - with returnTo for flow preservation */}
              {clients.length === 0 && (
                <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 animate-in">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-warning text-xl">warning</span>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-warning">No Clients Found</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">You need to create a client first before creating a job.</p>
                      <Link
                        to={`/admin/clients/new?returnTo=${encodeURIComponent('/admin/create')}`}
                        className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-primary uppercase tracking-wide hover:underline"
                      >
                        <span className="material-symbols-outlined text-sm">add</span>
                        Create Client First
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {technicians.length === 0 && (
                <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 animate-in">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-warning text-xl">warning</span>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-warning">No Technicians Found</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">You need to add a technician first before assigning a job.</p>
                      <Link
                        to={`/admin/technicians/new?returnTo=${encodeURIComponent('/admin/create')}`}
                        className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-primary uppercase tracking-wide hover:underline"
                      >
                        <span className="material-symbols-outlined text-sm">add</span>
                        Add Technician First
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="wizard-client" className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                  Client *
                </label>
                <select
                  id="wizard-client"
                  ref={clientRef}
                  required
                  value={formData.clientId}
                  onChange={(e) => {
                    if (e.target.value === '__add_new__') {
                      // Phase 2.5: Navigate to client creation with returnTo
                      navigate('/admin/clients/new?returnTo=' + encodeURIComponent('/admin/create'));
                    } else {
                      setFormData({ ...formData, clientId: e.target.value });
                    }
                  }}
                  className={`w-full bg-gray-100 dark:bg-slate-800 border-2 rounded-xl py-4 px-5 text-slate-900 dark:text-white outline-none transition-all ${
                    clients.length === 0 ? 'border-warning/50' : 'border-slate-600 focus:border-primary'
                  }`}
                >
                  <option value="">Select Client...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                  <option value="__add_new__" className="text-primary font-bold">+ Add New Client</option>
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="wizard-technician" className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                  Technician <span className="text-slate-500 normal-case">(optional)</span>
                </label>
                <select
                  id="wizard-technician"
                  value={formData.techId}
                  onChange={(e) => {
                    if (e.target.value === '__add_new__') {
                      // Phase 2.5: Navigate to technician creation with returnTo
                      navigate('/admin/technicians/new?returnTo=' + encodeURIComponent('/admin/create'));
                    } else {
                      setFormData({ ...formData, techId: e.target.value });
                    }
                  }}
                  className={`w-full bg-gray-100 dark:bg-slate-800 border-2 rounded-xl py-4 px-5 text-slate-900 dark:text-white outline-none transition-all ${
                    technicians.length === 0 ? 'border-warning/50' : 'border-slate-600 focus:border-primary'
                  }`}
                >
                  <option value="">Assign later...</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                  <option value="__add_new__" className="text-primary font-bold">+ Add New Technician</option>
                </select>
              </div>

              {selectedTech && (
                <div className="bg-gray-100 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-white/15 animate-in">
                  <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                    Selected Technician
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/20 size-12 rounded-xl flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary text-2xl">person</span>
                    </div>
                    <div>
                      <p className="text-slate-900 dark:text-white font-bold">{selectedTech.name}</p>
                      <p className="text-slate-500 dark:text-slate-400 text-sm">{selectedTech.specialty || 'Field Technician'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Review & Dispatch */}
          {step === 5 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-5 duration-300">
              <div className="text-center space-y-2 mb-6">
                <span className="material-symbols-outlined text-primary text-4xl">fact_check</span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Review & Create
                </h3>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-100 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-white/15">
                  <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Job Details</p>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400 text-sm">Title</span>
                      <span className="text-slate-900 dark:text-white font-bold text-sm">{formData.title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400 text-sm">Type</span>
                      <span className="text-slate-900 dark:text-white font-bold text-sm capitalize">{formData.jobType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400 text-sm">Priority</span>
                      <span className={`font-bold text-sm uppercase ${
                        formData.priority === 'urgent' ? 'text-safety-orange' : 'text-slate-900 dark:text-white'
                      }`}>{formData.priority}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-100 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-white/15">
                  <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Location</p>
                  <p className="text-slate-900 dark:text-white text-sm">{formData.address}</p>
                  {formData.siteNotes && (
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">{formData.siteNotes}</p>
                  )}
                </div>

                <div className="bg-gray-100 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-white/15">
                  <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Assignment</p>
                  <div className="flex justify-between">
                    <div>
                      <p className="text-slate-500 dark:text-slate-400 text-xs">Client</p>
                      <p className="text-slate-900 dark:text-white font-bold">{selectedClient?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-500 dark:text-slate-400 text-xs">Technician</p>
                      <p className="text-slate-900 dark:text-white font-bold">{selectedTech?.name || <span className="text-slate-500 italic">Assign later</span>}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-100 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-white/15">
                  <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Safety & PPE</p>
                  <div className="flex flex-wrap gap-2">
                    {formData.requiredPPE.map((ppe) => {
                      const option = PPE_OPTIONS.find(p => p.id === ppe);
                      return (
                        <span key={ppe} className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-lg text-xs font-bold">
                          <span className="material-symbols-outlined text-sm">{option?.icon}</span>
                          {option?.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-4 mt-8">
            {step > 1 && (
              <button
                onClick={handleBack}
                className="flex-1 py-4 bg-slate-800 text-white font-black rounded-xl uppercase tracking-widest hover:bg-slate-700 transition-all"
              >
                Back
              </button>
            )}
            {step < 5 ? (
              <button
                onClick={handleNext}
                disabled={!canProceed()}
                className="flex-1 py-4 bg-primary text-white font-black rounded-xl uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:bg-primary-hover active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleDispatch}
                disabled={isCreating}
                className="flex-1 py-4 bg-safety-orange text-white font-bold text-sm rounded-xl uppercase tracking-wide shadow-xl shadow-orange-500/20 transition-all hover:bg-orange-600 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 min-h-[56px]"
              >
                {isCreating ? (
                  <>
                    <span className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">send</span>
                    <span>Create Job</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Success Modal - Uses shared PostJobCreationModal */}
        {showSuccessModal && (
          <PostJobCreationModal
            jobId={createdJobId}
            jobTitle={formData.title}
            technicianName={selectedTech?.name}
            technicianEmail={selectedTech?.email}
            clientName={selectedClient?.name}
            address={formData.address}
            magicLinkUrl={magicLinkUrl || undefined}
            magicLinkToken={magicLinkToken || undefined}
            userPersona={userPersona}
            onClose={() => {
              setShowSuccessModal(false);
            }}
          />
        )}
      </div>
    </Layout>
  );
};

export default JobCreationWizard;
