import React, { useState, useRef, useEffect } from 'react';
import Layout from '../components/Layout';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Job, Client, Technician, UserProfile } from '../types';
import { createJob, generateMagicLink, storeMagicLinkLocal, markLinkAsSent } from '../lib/db';
import { getMagicLinkUrl, getSecureOrigin } from '../lib/redirects';
import { navigateToNextStep } from '../lib/onboarding';
import { celebrateSuccess, hapticFeedback, showToast } from '../lib/microInteractions';

/**
 * Job Creation Wizard - UX Spec Compliant
 *
 * 5-Step Guided Flow (Progressive Disclosure):
 * 1. Job Basics (title, type, priority)
 * 2. Job Location (address, site notes, map preview)
 * 3. Scope & Requirements (description, safety, PPE)
 * 4. Assign Contractor (name, email/phone)
 * 5. Review & Dispatch
 */

interface JobCreationWizardProps {
  onAddJob: (job: Job) => void;
  user: UserProfile | null;
  clients: Client[];
  technicians: Technician[];
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
  'Review & Dispatch',
];

const JobCreationWizard: React.FC<JobCreationWizardProps> = ({
  onAddJob,
  user,
  clients,
  technicians,
}) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdJobId, setCreatedJobId] = useState('');
  const [magicLinkUrl, setMagicLinkUrl] = useState('');
  const [magicLinkToken, setMagicLinkToken] = useState(''); // Track token for lifecycle

  // Draft storage key for job creation wizard
  const JOB_DRAFT_KEY = 'jobproof_job_creation_draft';
  const DRAFT_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

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

  // Load draft from localStorage on mount (BEFORE handling returnTo params)
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(JOB_DRAFT_KEY);
      if (savedDraft) {
        const draft = JSON.parse(savedDraft);
        if (Date.now() - draft.savedAt < DRAFT_EXPIRY_MS) {
          setFormData(draft.formData);
          setStep(draft.step || 1);
          console.log('[JobCreationWizard] Draft restored from localStorage');
        } else {
          localStorage.removeItem(JOB_DRAFT_KEY);
        }
      }
    } catch (e) {
      console.warn('[JobCreationWizard] Failed to load draft:', e);
    }
  }, []);

  // Auto-save draft on formData/step changes (debounced)
  useEffect(() => {
    // Don't save if form is empty
    if (!formData.title && !formData.address && !formData.workDescription) return;

    const timer = setTimeout(() => {
      try {
        localStorage.setItem(JOB_DRAFT_KEY, JSON.stringify({
          formData,
          step,
          savedAt: Date.now()
        }));
      } catch (e) {
        console.warn('[JobCreationWizard] Failed to save draft:', e);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData, step]);

  // Clear draft after successful job creation
  const clearDraft = () => {
    localStorage.removeItem(JOB_DRAFT_KEY);
  };

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
        return !!formData.clientId && !!formData.techId;
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
    const tech = technicians.find(t => t.id === formData.techId);
    if (!client || !tech) return;

    setIsCreating(true);

    try {
      const workspaceId = user?.workspace?.id;
      if (!workspaceId) {
        alert('Workspace not found. Please try logging in again.');
        setIsCreating(false);
        return;
      }

      const jobData: Partial<Job> = {
        title: formData.title,
        client: client.name,
        clientId: client.id,
        technician: tech.name,
        techId: tech.id,
        status: 'Pending',
        date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        address: formData.address,
        notes: formData.workDescription,
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
        syncStatus: 'synced',
        lastUpdated: Date.now(),
      };

      const result = await createJob(jobData, workspaceId);

      if (!result.success) {
        // Fallback to localStorage
        const newId = `JP-${crypto.randomUUID()}`;

        // Generate magic link FIRST so we can store it on the job
        const localMagicLink = storeMagicLinkLocal(newId, workspaceId);

        // Create job with magic link token embedded (CRITICAL for cross-browser access)
        const localJob: Job = {
          ...jobData,
          id: newId,
          magicLinkToken: localMagicLink.token,
          magicLinkUrl: localMagicLink.url
        } as Job;

        // CRITICAL: Persist job WITH token to localStorage so magic link works across browsers
        try {
          const existingJobs = JSON.parse(localStorage.getItem('jobproof_jobs_v2') || '[]');
          existingJobs.unshift(localJob);
          localStorage.setItem('jobproof_jobs_v2', JSON.stringify(existingJobs));
          console.log(`[JobCreationWizard] Persisted job ${newId} with magicLinkToken to localStorage`);
        } catch (e) {
          console.error('[JobCreationWizard] Failed to persist job to localStorage:', e);
        }

        onAddJob(localJob);
        setCreatedJobId(newId);
        setMagicLinkUrl(localMagicLink.url);
        setMagicLinkToken(localMagicLink.token);
        console.log(`[JobCreationWizard] Generated local magic link: ${localMagicLink.url}`);

        clearDraft(); // Clear draft on successful creation
        setShowSuccessModal(true);
        setIsCreating(false);
        return;
      }

      const createdJob = result.data!;
      setCreatedJobId(createdJob.id);

      const magicLinkResult = await generateMagicLink(createdJob.id);
      let jobWithToken = createdJob;

      if (magicLinkResult.success && magicLinkResult.data?.url) {
        setMagicLinkUrl(magicLinkResult.data.url);
        setMagicLinkToken(magicLinkResult.data.token);
        // Store token on job for cross-browser access
        jobWithToken = {
          ...createdJob,
          magicLinkToken: magicLinkResult.data.token,
          magicLinkUrl: magicLinkResult.data.url
        };
        console.log(`[JobCreationWizard] Generated magic link from DB: ${magicLinkResult.data.url}`);
      } else {
        // Fallback to local token generation
        const localMagicLink = storeMagicLinkLocal(createdJob.id, workspaceId);
        setMagicLinkUrl(localMagicLink.url);
        setMagicLinkToken(localMagicLink.token);
        // Store token on job for cross-browser access
        jobWithToken = {
          ...createdJob,
          magicLinkToken: localMagicLink.token,
          magicLinkUrl: localMagicLink.url
        };
        console.log(`[JobCreationWizard] Generated fallback local magic link: ${localMagicLink.url}`);
      }

      // Update localStorage with token-embedded job
      try {
        const existingJobs = JSON.parse(localStorage.getItem('jobproof_jobs_v2') || '[]');
        const jobIndex = existingJobs.findIndex((j: Job) => j.id === jobWithToken.id);
        if (jobIndex >= 0) {
          existingJobs[jobIndex] = jobWithToken;
        } else {
          existingJobs.unshift(jobWithToken);
        }
        localStorage.setItem('jobproof_jobs_v2', JSON.stringify(existingJobs));
      } catch (e) {
        console.warn('[JobCreationWizard] Failed to update job with magic link token:', e);
      }

      onAddJob(jobWithToken);
      clearDraft(); // Clear draft on successful creation
      setShowSuccessModal(true);

      // PhD-Level Delight: Celebrate successful dispatch!
      celebrateSuccess();
    } catch (error) {
      console.error('Failed to create job:', error);
      showToast('Failed to create job. Please try again.', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const copyMagicLink = () => {
    // magicLinkUrl should always be set by now, but generate one if somehow not
    let urlToCopy = magicLinkUrl;
    let tokenToTrack = magicLinkToken;
    if (!urlToCopy && createdJobId) {
      console.warn('[JobCreationWizard] magicLinkUrl was not set, generating emergency local link');
      const emergencyLink = storeMagicLinkLocal(createdJobId, user?.workspace?.id || 'local');
      urlToCopy = emergencyLink.url;
      tokenToTrack = emergencyLink.token;
    }
    navigator.clipboard.writeText(urlToCopy);

    // Track that the link was sent via copy
    if (tokenToTrack) {
      markLinkAsSent(tokenToTrack, 'copy');
    }

    hapticFeedback('success');
    showToast('Magic link copied to clipboard!', 'success');
  };

  const selectedClient = clients.find(c => c.id === formData.clientId);
  const selectedTech = technicians.find(t => t.id === formData.techId);

  // Phase 2.5: Calculate progress percentage for smooth progress bar
  const progressPercent = ((step - 1) / (STEP_TITLES.length - 1)) * 100;

  return (
    <Layout user={user}>
      <div className="max-w-2xl mx-auto pb-20">
        {/* Phase 2.5: Top Progress Bar - Fixed position for visibility */}
        <div className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-sm pt-4 pb-2 -mx-4 px-4 mb-6">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-bold uppercase tracking-widest">
              Step {step} of {STEP_TITLES.length}
            </span>
            <span className="font-mono">{Math.round(progressPercent)}%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
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
              <div key={idx} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`size-10 rounded-full flex items-center justify-center font-black text-sm transition-all ${
                      idx + 1 < step
                        ? 'bg-success text-white'
                        : idx + 1 === step
                        ? 'bg-primary text-white ring-4 ring-primary/20'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {idx + 1 < step ? (
                      <span className="material-symbols-outlined">check</span>
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider mt-2 hidden md:block ${
                    idx + 1 === step ? 'text-white' : 'text-slate-500'
                  }`}>
                    {title}
                  </span>
                </div>
                {idx < STEP_TITLES.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${
                    idx + 1 < step ? 'bg-success' : 'bg-slate-800'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight text-center md:hidden">
            {STEP_TITLES[step - 1]}
          </h2>
        </div>

        {/* Step Content - Phase 2.5: Added keyboard navigation */}
        <div
          className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-6 md:p-8 shadow-2xl focus-within:ring-2 focus-within:ring-primary/20 transition-all"
          onKeyDown={handleKeyDown}
        >
          {/* Step 1: Job Basics */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-5 duration-300">
              <div className="text-center space-y-2 mb-8">
                <span className="material-symbols-outlined text-primary text-4xl">work</span>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">
                  What's the job?
                </h3>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  Job Title *
                </label>
                <input
                  ref={titleRef}
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-slate-800 border-2 border-slate-700 focus:border-primary rounded-xl py-4 px-5 text-white text-lg outline-none transition-all"
                  placeholder="e.g., Boiler Service - Unit 4B"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  Job Type *
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {JOB_TYPES.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, jobType: type.id })}
                      className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                        formData.jobType === type.id
                          ? 'bg-primary/10 border-primary text-white'
                          : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
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
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  Priority
                </label>
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
                        : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
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
                        : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-red-500/50 hover:text-red-400'
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
                <h3 className="text-xl font-black text-white uppercase tracking-tight">
                  Where is the job?
                </h3>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  Job Address *
                </label>
                <input
                  ref={addressRef}
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-slate-800 border-2 border-slate-700 focus:border-primary rounded-xl py-4 px-5 text-white outline-none transition-all"
                  placeholder="123 Industrial Estate, London, UK"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  Site Notes (Optional)
                </label>
                <textarea
                  value={formData.siteNotes}
                  onChange={(e) => setFormData({ ...formData, siteNotes: e.target.value })}
                  className="w-full bg-slate-800 border-2 border-slate-700 focus:border-primary rounded-xl py-4 px-5 text-white outline-none transition-all resize-none"
                  rows={3}
                  placeholder="Gate code, access instructions, parking info..."
                />
              </div>

              {/* UAT Fix #8: Location preview with clickable map link */}
              {formData.address && (
                <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
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
                    className="block bg-slate-700 rounded-lg h-40 flex items-center justify-center relative overflow-hidden group cursor-pointer hover:bg-slate-600 transition-colors"
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent z-10" />
                    <span className="material-symbols-outlined text-slate-400 text-5xl group-hover:text-primary transition-colors z-20">map</span>
                    <div className="absolute bottom-3 left-3 right-3 z-20">
                      <p className="text-[10px] text-white font-bold uppercase tracking-tight truncate">{formData.address}</p>
                      <p className="text-[8px] text-slate-300 uppercase tracking-wide mt-1 flex items-center gap-1">
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
                <h3 className="text-xl font-black text-white uppercase tracking-tight">
                  Scope & Safety
                </h3>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  Work Description *
                </label>
                <textarea
                  ref={descriptionRef}
                  required
                  value={formData.workDescription}
                  onChange={(e) => setFormData({ ...formData, workDescription: e.target.value })}
                  className="w-full bg-slate-800 border-2 border-slate-700 focus:border-primary rounded-xl py-4 px-5 text-white outline-none transition-all resize-none"
                  rows={4}
                  placeholder="• Check boiler pressure&#10;• Inspect flue&#10;• Test safety valve"
                />
                <p className="text-[10px] text-slate-500">Use bullet points for clarity</p>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  Safety Requirements
                </label>
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
                          ? 'bg-amber-500/10 border-amber-500/50 text-white'
                          : 'bg-slate-800/50 border-slate-700 text-slate-400'
                      }`}
                    >
                      <span className={`material-symbols-outlined text-xl ${
                        formData.safetyRequirements.includes(req.id) ? 'text-amber-500' : 'text-slate-500'
                      }`}>
                        {formData.safetyRequirements.includes(req.id) ? 'check_box' : 'check_box_outline_blank'}
                      </span>
                      <span className="text-sm font-medium">{req.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  Required PPE
                </label>
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
                          ? 'bg-primary/10 border-primary text-white'
                          : 'bg-slate-800/50 border-slate-700 text-slate-400'
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
                <h3 className="text-xl font-black text-white uppercase tracking-tight">
                  Who's doing the work?
                </h3>
              </div>

              {/* UAT Fix #4: Warning if no clients/technicians exist - with returnTo for flow preservation */}
              {clients.length === 0 && (
                <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 animate-in">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-warning text-xl">warning</span>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-warning">No Clients Found</p>
                      <p className="text-xs text-slate-400 mt-1">You need to create a client first before creating a job.</p>
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
                      <p className="text-xs text-slate-400 mt-1">You need to add a technician first before assigning a job.</p>
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
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  Client *
                </label>
                <select
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
                  className={`w-full bg-slate-800 border-2 rounded-xl py-4 px-5 text-white outline-none transition-all ${
                    clients.length === 0 ? 'border-warning/50' : 'border-slate-700 focus:border-primary'
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
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  Technician *
                </label>
                <select
                  required
                  value={formData.techId}
                  onChange={(e) => {
                    if (e.target.value === '__add_new__') {
                      // Phase 2.5: Navigate to technician creation with returnTo
                      navigate('/admin/technicians/new?returnTo=' + encodeURIComponent('/admin/create'));
                    } else {
                      setFormData({ ...formData, techId: e.target.value });
                    }
                  }}
                  className={`w-full bg-slate-800 border-2 rounded-xl py-4 px-5 text-white outline-none transition-all ${
                    technicians.length === 0 ? 'border-warning/50' : 'border-slate-700 focus:border-primary'
                  }`}
                >
                  <option value="">Select Technician...</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                  <option value="__add_new__" className="text-primary font-bold">+ Add New Technician</option>
                </select>
              </div>

              {selectedTech && (
                <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5 animate-in">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Selected Technician
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/20 size-12 rounded-xl flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary text-2xl">person</span>
                    </div>
                    <div>
                      <p className="text-white font-bold">{selectedTech.name}</p>
                      <p className="text-slate-400 text-sm">{selectedTech.specialty || 'Field Technician'}</p>
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
                <h3 className="text-xl font-black text-white uppercase tracking-tight">
                  Review & Dispatch
                </h3>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Job Details</p>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-sm">Title</span>
                      <span className="text-white font-bold text-sm">{formData.title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-sm">Type</span>
                      <span className="text-white font-bold text-sm capitalize">{formData.jobType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-sm">Priority</span>
                      <span className={`font-bold text-sm uppercase ${
                        formData.priority === 'urgent' ? 'text-safety-orange' : 'text-white'
                      }`}>{formData.priority}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Location</p>
                  <p className="text-white text-sm">{formData.address}</p>
                  {formData.siteNotes && (
                    <p className="text-slate-400 text-xs mt-1">{formData.siteNotes}</p>
                  )}
                </div>

                <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Assignment</p>
                  <div className="flex justify-between">
                    <div>
                      <p className="text-slate-400 text-xs">Client</p>
                      <p className="text-white font-bold">{selectedClient?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-400 text-xs">Technician</p>
                      <p className="text-white font-bold">{selectedTech?.name}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Safety & PPE</p>
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
                className="flex-1 py-4 bg-safety-orange text-white font-black rounded-xl uppercase tracking-widest shadow-xl shadow-orange-500/20 transition-all hover:bg-orange-600 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isCreating ? (
                  <>
                    <span className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">send</span>
                    Dispatch Job
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Success Modal - UAT Fix #11, #13 */}
        {showSuccessModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
            <div className="bg-slate-900 border border-white/10 p-8 rounded-[2.5rem] max-w-lg w-full shadow-2xl space-y-6">
              <div className="text-center space-y-3">
                <div className="bg-success/20 size-16 rounded-2xl flex items-center justify-center mx-auto animate-success-pop">
                  <span className="material-symbols-outlined text-success text-4xl">check_circle</span>
                </div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tight">Job Dispatched!</h3>
                <p className="text-slate-400 text-sm">
                  Magic link ready for <span className="text-white font-bold">{selectedTech?.name}</span>
                </p>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Magic Link</p>
                <p className="text-xs font-mono text-white break-all bg-slate-950 p-3 rounded-lg">
                  {magicLinkUrl || 'Generating link...'}
                </p>
              </div>

              {/* UAT Fix #11, #13: Multiple share options with tooltips */}
              <div className="space-y-3">
                {/* Primary action: Native share or copy */}
                {typeof navigator !== 'undefined' && 'share' in navigator ? (
                  <div className="relative group">
                    <button
                      onClick={async () => {
                        const shareData = {
                          title: `Job Assignment: ${formData.title}`,
                          text: `You have been assigned a new job. Click to start:`,
                          url: magicLinkUrl
                        };
                        try {
                          await navigator.share(shareData);
                          if (magicLinkToken) markLinkAsSent(magicLinkToken, 'share');
                          showToast('Link shared successfully!', 'success');
                        } catch (err) {
                          if ((err as Error).name !== 'AbortError') {
                            copyMagicLink();
                          }
                        }
                      }}
                      className="w-full py-4 bg-primary text-white font-black rounded-xl uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:bg-primary-hover active:scale-[0.98] press-spring flex items-center justify-center gap-2"
                      title="Share via your phone's native share menu (WhatsApp, SMS, Email, etc.)"
                    >
                      <span className="material-symbols-outlined">share</span>
                      Share Link
                    </button>
                    {/* UAT Fix #13: Tooltip for share icon */}
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-900 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
                      Use native share (WhatsApp, SMS, Email)
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-amber-500" />
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={copyMagicLink}
                    className="w-full py-4 bg-primary text-white font-black rounded-xl uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:bg-primary-hover active:scale-[0.98] press-spring flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined">content_copy</span>
                    Copy Link
                  </button>
                )}

                {/* UAT Fix #11: Send via Email option */}
                <div className="grid grid-cols-2 gap-3">
                  <a
                    href={`mailto:${selectedTech?.email || ''}?subject=${encodeURIComponent(`Job Assignment: ${formData.title}`)}&body=${encodeURIComponent(`You have been assigned a new job.\n\nJob: ${formData.title}\nClient: ${clients.find(c => c.id === formData.clientId)?.name || ''}\nAddress: ${formData.address}\n\nClick the link below to start:\n${magicLinkUrl}`)}`}
                    onClick={() => {
                      if (magicLinkToken) markLinkAsSent(magicLinkToken, 'email');
                    }}
                    className="py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl uppercase tracking-wide transition-all border border-white/10 flex items-center justify-center gap-2 text-xs press-spring"
                  >
                    <span className="material-symbols-outlined text-sm">email</span>
                    Email
                  </a>
                  <button
                    onClick={copyMagicLink}
                    className="py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl uppercase tracking-wide transition-all border border-white/10 flex items-center justify-center gap-2 text-xs press-spring"
                  >
                    <span className="material-symbols-outlined text-sm">content_copy</span>
                    Copy
                  </button>
                </div>

                <button
                  onClick={() => {
                    navigateToNextStep('CREATE_JOB', user?.persona, navigate);
                  }}
                  className="w-full py-3 text-slate-400 font-bold text-sm uppercase tracking-widest hover:text-white transition-all"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default JobCreationWizard;
