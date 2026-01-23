import React, { useState, useRef, useEffect } from 'react';
import Layout from '../components/Layout';
import { useNavigate } from 'react-router-dom';
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
  const [step, setStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdJobId, setCreatedJobId] = useState('');
  const [magicLinkUrl, setMagicLinkUrl] = useState('');
  const [magicLinkToken, setMagicLinkToken] = useState(''); // Track token for lifecycle

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

  // Refs for auto-focus
  const titleRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const clientRef = useRef<HTMLSelectElement>(null);

  // Auto-focus on step change
  useEffect(() => {
    const refs = [titleRef, addressRef, descriptionRef, clientRef];
    const currentRef = refs[step - 1];
    if (currentRef?.current) {
      setTimeout(() => currentRef.current?.focus(), 100);
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
        const localJob: Job = { ...jobData, id: newId } as Job;

        // CRITICAL: Immediately persist to localStorage so magic link works instantly
        try {
          const existingJobs = JSON.parse(localStorage.getItem('jobproof_jobs_v2') || '[]');
          existingJobs.unshift(localJob);
          localStorage.setItem('jobproof_jobs_v2', JSON.stringify(existingJobs));
          console.log(`[JobCreationWizard] Immediately persisted job ${newId} to localStorage`);
        } catch (e) {
          console.error('[JobCreationWizard] Failed to persist job to localStorage:', e);
        }

        onAddJob(localJob);
        setCreatedJobId(newId);

        // Generate proper magic link with token
        const localMagicLink = storeMagicLinkLocal(newId, workspaceId);
        setMagicLinkUrl(localMagicLink.url);
        setMagicLinkToken(localMagicLink.token);
        console.log(`[JobCreationWizard] Generated local magic link: ${localMagicLink.url}`);

        setShowSuccessModal(true);
        setIsCreating(false);
        return;
      }

      const createdJob = result.data!;
      setCreatedJobId(createdJob.id);

      const magicLinkResult = await generateMagicLink(createdJob.id);
      if (magicLinkResult.success && magicLinkResult.data?.url) {
        setMagicLinkUrl(magicLinkResult.data.url);
        setMagicLinkToken(magicLinkResult.data.token);
        console.log(`[JobCreationWizard] Generated magic link from DB: ${magicLinkResult.data.url}`);
      } else {
        // Fallback to local token generation
        const localMagicLink = storeMagicLinkLocal(createdJob.id, workspaceId);
        setMagicLinkUrl(localMagicLink.url);
        setMagicLinkToken(localMagicLink.token);
        console.log(`[JobCreationWizard] Generated fallback local magic link: ${localMagicLink.url}`);
      }

      onAddJob(createdJob);
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

  return (
    <Layout user={user}>
      <div className="max-w-2xl mx-auto pb-20">
        {/* Progress Bar */}
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

        {/* Step Content */}
        <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-6 md:p-8 shadow-2xl">
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

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  Priority
                </label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, priority: 'normal' })}
                    className={`flex-1 py-4 rounded-xl border-2 font-bold uppercase tracking-wide transition-all ${
                      formData.priority === 'normal'
                        ? 'bg-slate-700 border-slate-600 text-white'
                        : 'bg-slate-800/50 border-slate-700 text-slate-400'
                    }`}
                  >
                    Normal
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, priority: 'urgent' })}
                    className={`flex-1 py-4 rounded-xl border-2 font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-2 ${
                      formData.priority === 'urgent'
                        ? 'bg-safety-orange/20 border-safety-orange text-safety-orange'
                        : 'bg-slate-800/50 border-slate-700 text-slate-400'
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

              {formData.address && (
                <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    Location Preview
                  </p>
                  <div className="bg-slate-700 rounded-lg h-40 flex items-center justify-center">
                    <span className="material-symbols-outlined text-slate-500 text-5xl">map</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">{formData.address}</p>
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

          {/* Step 4: Assign Contractor */}
          {step === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-5 duration-300">
              <div className="text-center space-y-2 mb-8">
                <span className="material-symbols-outlined text-primary text-4xl">person_add</span>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">
                  Who's doing the work?
                </h3>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  Client *
                </label>
                <select
                  ref={clientRef}
                  required
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                  className="w-full bg-slate-800 border-2 border-slate-700 focus:border-primary rounded-xl py-4 px-5 text-white outline-none transition-all"
                >
                  <option value="">Select Client...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  Technician *
                </label>
                <select
                  required
                  value={formData.techId}
                  onChange={(e) => setFormData({ ...formData, techId: e.target.value })}
                  className="w-full bg-slate-800 border-2 border-slate-700 focus:border-primary rounded-xl py-4 px-5 text-white outline-none transition-all"
                >
                  <option value="">Select Technician...</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {selectedTech && (
                <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
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

        {/* Success Modal */}
        {showSuccessModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
            <div className="bg-slate-900 border border-white/10 p-8 rounded-[2.5rem] max-w-lg w-full shadow-2xl space-y-6">
              <div className="text-center space-y-3">
                <div className="bg-success/20 size-16 rounded-2xl flex items-center justify-center mx-auto">
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

              <div className="space-y-3">
                <button
                  onClick={copyMagicLink}
                  className="w-full py-4 bg-primary text-white font-black rounded-xl uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:bg-primary-hover active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined">content_copy</span>
                  Copy Link
                </button>
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
