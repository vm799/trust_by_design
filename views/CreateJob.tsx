
import React, { useState, useRef, useEffect } from 'react';
import Layout from '../components/Layout';
import { useNavigate, useLocation } from 'react-router-dom';
import { Job, Client, Technician, JobTemplate, UserProfile } from '../types';
import { createJob, generateMagicLink } from '../lib/db';
import { getMagicLinkUrl } from '../lib/redirects';
import { navigateToNextStep } from '../lib/onboarding';

interface CreateJobProps {
  onAddJob: (job: Job) => void;
  user: UserProfile | null;
  clients: Client[];
  technicians: Technician[];
  templates: JobTemplate[];
  onAddClient?: (client: Client) => void;
  onAddTechnician?: (technician: Technician) => void;
}

const LOCAL_CLIENTS_KEY = 'trust_by_design_local_clients';
const LOCAL_TECHNICIANS_KEY = 'trust_by_design_local_technicians';

const CreateJob: React.FC<CreateJobProps> = ({ onAddJob, user, clients, technicians, templates, onAddClient, onAddTechnician }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Ref for auto-focusing the title input
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Parse query params for pre-filled templates
  const queryParams = new URLSearchParams(location.search);
  const initialTemplateId = queryParams.get('template') || '';
  const initialTitle = queryParams.get('title') || '';

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdJobId, setCreatedJobId] = useState<string>('');
  const [magicLinkUrl, setMagicLinkUrl] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState(false);

  // Modal states for adding new client/technician
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [showAddTechnicianModal, setShowAddTechnicianModal] = useState(false);
  const [clientFormError, setClientFormError] = useState<string>('');
  const [technicianFormError, setTechnicianFormError] = useState<string>('');

  // Local storage for clients/technicians when no callbacks provided
  const [localClients, setLocalClients] = useState<Client[]>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_CLIENTS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [localTechnicians, setLocalTechnicians] = useState<Technician[]>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_TECHNICIANS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // New client form state
  const [newClientForm, setNewClientForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });

  // New technician form state
  const [newTechnicianForm, setNewTechnicianForm] = useState({
    name: '',
    email: '',
    phone: ''
  });

  const [formData, setFormData] = useState({
    title: initialTitle,
    clientId: '',
    techId: '',
    templateId: initialTemplateId,
    address: '',
    notes: '',
  });

  // Combine props with local storage
  const allClients = [...clients, ...localClients];
  const allTechnicians = [...technicians, ...localTechnicians];

  // Auto-focus title input on mount for better UX
  useEffect(() => {
    if (titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, []);

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleClientSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '__add_new__') {
      setShowAddClientModal(true);
      // Reset the select to previous value
      e.target.value = formData.clientId;
    } else {
      setFormData({ ...formData, clientId: value });
    }
  };

  const handleTechnicianSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '__add_new__') {
      setShowAddTechnicianModal(true);
      // Reset the select to previous value
      e.target.value = formData.techId;
    } else {
      setFormData({ ...formData, techId: value });
    }
  };

  const handleAddClient = () => {
    setClientFormError('');

    if (!newClientForm.name.trim()) {
      setClientFormError('Client name is required.');
      return;
    }
    if (!newClientForm.email.trim()) {
      setClientFormError('Client email is required.');
      return;
    }
    if (!newClientForm.address.trim()) {
      setClientFormError('Client address is required.');
      return;
    }

    const newClient: Client = {
      id: `client-${crypto.randomUUID()}`,
      name: newClientForm.name.trim(),
      email: newClientForm.email.trim(),
      phone: newClientForm.phone.trim() || undefined,
      address: newClientForm.address.trim(),
      totalJobs: 0
    };

    if (onAddClient) {
      onAddClient(newClient);
    } else {
      // Store in localStorage
      const updatedClients = [...localClients, newClient];
      setLocalClients(updatedClients);
      localStorage.setItem(LOCAL_CLIENTS_KEY, JSON.stringify(updatedClients));
    }

    // Auto-select the new client
    setFormData({ ...formData, clientId: newClient.id });

    // Reset form and close modal
    setNewClientForm({ name: '', email: '', phone: '', address: '' });
    setShowAddClientModal(false);
  };

  const handleAddTechnician = () => {
    setTechnicianFormError('');

    if (!newTechnicianForm.name.trim()) {
      setTechnicianFormError('Technician name is required.');
      return;
    }
    if (!newTechnicianForm.email.trim()) {
      setTechnicianFormError('Technician email is required.');
      return;
    }

    const newTechnician: Technician = {
      id: `tech-${crypto.randomUUID()}`,
      name: newTechnicianForm.name.trim(),
      email: newTechnicianForm.email.trim(),
      phone: newTechnicianForm.phone.trim() || undefined,
      status: 'Available',
      rating: 5,
      jobsCompleted: 0
    };

    if (onAddTechnician) {
      onAddTechnician(newTechnician);
    } else {
      // Store in localStorage
      const updatedTechnicians = [...localTechnicians, newTechnician];
      setLocalTechnicians(updatedTechnicians);
      localStorage.setItem(LOCAL_TECHNICIANS_KEY, JSON.stringify(updatedTechnicians));
    }

    // Auto-select the new technician
    setFormData({ ...formData, techId: newTechnician.id });

    // Reset form and close modal
    setNewTechnicianForm({ name: '', email: '', phone: '' });
    setShowAddTechnicianModal(false);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.clientId || !formData.techId) {
      setError('Please select a Client and Technician.');
      return;
    }
    setShowConfirmModal(true);
  };

  const executeDispatch = async () => {
    const client = allClients.find(c => c.id === formData.clientId);
    const tech = allTechnicians.find(t => t.id === formData.techId);
    if (!client || !tech) return;

    setIsCreating(true);
    setError('');

    // Yield to main thread to show loading state
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      // Create job data
      const jobData: Partial<Job> = {
        title: formData.title,
        client: client.name,
        clientId: client.id,
        technician: tech.name,
        techId: tech.id,
        status: 'Pending',
        date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        address: formData.address || client.address,
        notes: formData.notes,
        photos: [],
        signature: null,
        safetyChecklist: [
          { id: 'sc1', label: 'PPE (Hard Hat, Gloves, Hi-Vis) Worn', checked: false, required: true },
          { id: 'sc2', label: 'Site Hazards Identified & Controlled', checked: false, required: true },
          ...(templates.find(t => t.id === formData.templateId)?.defaultTasks.map((task, idx) => ({
            id: `template-task-${idx}`,
            label: task,
            checked: false,
            required: true
          })) || [])
        ],
        templateId: formData.templateId,
        syncStatus: 'synced',
        lastUpdated: Date.now()
      };

      // Create job in database
      // PERFORMANCE FIX: Pass workspaceId to avoid getUser() API call
      const workspaceId = user?.workspace?.id;
      if (!workspaceId) {
        setError('Workspace not found. Please try logging in again.');
        setIsCreating(false);
        return;
      }

      const result = await createJob(jobData, workspaceId);

      if (!result.success) {
        // Fallback to localStorage if Supabase not configured
        // Use UUID to prevent enumeration attacks (BACKEND_AUDIT.md Risk #5)
        const newId = `JP-${crypto.randomUUID()}`;
        const localJob: Job = { ...jobData, id: newId } as Job;
        onAddJob(localJob);
        setCreatedJobId(newId);
        setMagicLinkUrl(getMagicLinkUrl(newId));
        setShowConfirmModal(false);
        setShowSuccessModal(true);
        setIsCreating(false);
        return;
      }

      const createdJob = result.data!;
      setCreatedJobId(createdJob.id);

      // Generate magic link
      const magicLinkResult = await generateMagicLink(createdJob.id);

      if (magicLinkResult.success && magicLinkResult.data?.url) {
        setMagicLinkUrl(magicLinkResult.data.url);
      } else {
        // Fallback to job ID link if token generation fails
        setMagicLinkUrl(getMagicLinkUrl(createdJob.id));
      }

      // Also add to local state via onAddJob for immediate UI update
      onAddJob(createdJob);

      setShowConfirmModal(false);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Failed to create job:', error);
      setError('Failed to create job. Please try again.');
      setShowConfirmModal(false);
    } finally {
      setIsCreating(false);
    }
  };

  const getMagicLink = () => magicLinkUrl || getMagicLinkUrl(createdJobId);

  const copyMagicLink = () => {
    navigator.clipboard.writeText(getMagicLink());
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 3000);
  };

  const getQRCodeDataURL = () => {
    // Generate QR code using Google Chart API (no library needed)
    const url = encodeURIComponent(getMagicLink());
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${url}`;
  };

  const selectedClient = allClients.find(c => c.id === formData.clientId);
  const selectedTech = allTechnicians.find(t => t.id === formData.techId);

  return (
    <Layout user={user}>
      <div className="max-w-2xl mx-auto space-y-6 pb-20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin')}
            className="min-w-[48px] min-h-[48px] flex items-center justify-center text-slate-400 hover:text-white transition-colors rounded-xl hover:bg-white/5 press-spring lg:hidden"
            aria-label="Back to dashboard"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Create Job</h2>
        </div>

        {error && (
          <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 animate-in">
            <p className="text-danger text-sm font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              {error}
            </p>
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-8 space-y-6 shadow-2xl">
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Job Title</label>
              <input
                ref={titleInputRef}
                required
                type="text"
                className="w-full bg-slate-800 border-slate-700 rounded-xl py-3.5 px-5 text-white focus:ring-primary outline-none"
                placeholder="e.g. Asset Inspection - Unit 4B"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Client</label>
                <select required className="bg-slate-800 border-slate-700 rounded-xl py-3.5 px-5 text-white outline-none" value={formData.clientId} onChange={handleClientSelectChange}>
                  <option value="">Select Registry...</option>
                  {allClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  <option value="__add_new__" className="text-primary font-bold">+ Add New Client</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Technician</label>
                <select required className="bg-slate-800 border-slate-700 rounded-xl py-3.5 px-5 text-white outline-none" value={formData.techId} onChange={handleTechnicianSelectChange}>
                  <option value="">Select Tech...</option>
                  {allTechnicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  <option value="__add_new__" className="text-primary font-bold">+ Add New Technician</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Job Address</label>
              <input
                type="text"
                className="w-full bg-slate-800 border-slate-700 rounded-xl py-3.5 px-5 text-white focus:ring-primary outline-none"
                placeholder="Defaults to Client Registry address"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
          </div>
          <button type="submit" className="w-full py-5 bg-primary text-white font-black rounded-2xl uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:bg-primary-hover active:scale-95 press-spring">Review & Create</button>
        </form>

        {/* Add Client Modal */}
        {showAddClientModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-client-modal-title"
              className="bg-slate-900 border border-white/10 p-6 md:p-8 lg:p-12 rounded-[3.5rem] max-w-lg w-full shadow-2xl space-y-6"
            >
              <div className="text-center space-y-4">
                <div className="bg-primary/20 size-16 rounded-[2rem] flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-primary text-4xl font-black">person_add</span>
                </div>
                <h3 id="add-client-modal-title" className="text-2xl font-black text-white tracking-tighter uppercase">Add New Client</h3>
              </div>

              {clientFormError && (
                <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 animate-in">
                  <p className="text-danger text-sm font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">error</span>
                    {clientFormError}
                  </p>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Name *</label>
                  <input
                    type="text"
                    className="w-full bg-slate-800 border-slate-700 rounded-xl py-3.5 px-5 text-white focus:ring-primary outline-none"
                    placeholder="Client name"
                    value={newClientForm.name}
                    onChange={e => setNewClientForm({ ...newClientForm, name: e.target.value })}
                    autoFocus
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Email *</label>
                  <input
                    type="email"
                    className="w-full bg-slate-800 border-slate-700 rounded-xl py-3.5 px-5 text-white focus:ring-primary outline-none"
                    placeholder="client@example.com"
                    value={newClientForm.email}
                    onChange={e => setNewClientForm({ ...newClientForm, email: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Phone</label>
                  <input
                    type="tel"
                    className="w-full bg-slate-800 border-slate-700 rounded-xl py-3.5 px-5 text-white focus:ring-primary outline-none"
                    placeholder="(optional)"
                    value={newClientForm.phone}
                    onChange={e => setNewClientForm({ ...newClientForm, phone: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Address *</label>
                  <input
                    type="text"
                    className="w-full bg-slate-800 border-slate-700 rounded-xl py-3.5 px-5 text-white focus:ring-primary outline-none"
                    placeholder="123 Main St, City"
                    value={newClientForm.address}
                    onChange={e => setNewClientForm({ ...newClientForm, address: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleAddClient}
                  className="w-full py-5 bg-primary text-white rounded-2xl font-black uppercase tracking-widest shadow-2xl shadow-primary/30 active:scale-95 press-spring transition-all"
                >
                  Add Client
                </button>
                <button
                  onClick={() => {
                    setShowAddClientModal(false);
                    setNewClientForm({ name: '', email: '', phone: '', address: '' });
                    setClientFormError('');
                  }}
                  className="w-full py-4 bg-transparent text-slate-400 font-black uppercase tracking-widest hover:text-white transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Technician Modal */}
        {showAddTechnicianModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-technician-modal-title"
              className="bg-slate-900 border border-white/10 p-6 md:p-8 lg:p-12 rounded-[3.5rem] max-w-lg w-full shadow-2xl space-y-6"
            >
              <div className="text-center space-y-4">
                <div className="bg-primary/20 size-16 rounded-[2rem] flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-primary text-4xl font-black">engineering</span>
                </div>
                <h3 id="add-technician-modal-title" className="text-2xl font-black text-white tracking-tighter uppercase">Add New Technician</h3>
              </div>

              {technicianFormError && (
                <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 animate-in">
                  <p className="text-danger text-sm font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">error</span>
                    {technicianFormError}
                  </p>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Name *</label>
                  <input
                    type="text"
                    className="w-full bg-slate-800 border-slate-700 rounded-xl py-3.5 px-5 text-white focus:ring-primary outline-none"
                    placeholder="Technician name"
                    value={newTechnicianForm.name}
                    onChange={e => setNewTechnicianForm({ ...newTechnicianForm, name: e.target.value })}
                    autoFocus
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Email *</label>
                  <input
                    type="email"
                    className="w-full bg-slate-800 border-slate-700 rounded-xl py-3.5 px-5 text-white focus:ring-primary outline-none"
                    placeholder="tech@example.com"
                    value={newTechnicianForm.email}
                    onChange={e => setNewTechnicianForm({ ...newTechnicianForm, email: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Phone</label>
                  <input
                    type="tel"
                    className="w-full bg-slate-800 border-slate-700 rounded-xl py-3.5 px-5 text-white focus:ring-primary outline-none"
                    placeholder="(optional)"
                    value={newTechnicianForm.phone}
                    onChange={e => setNewTechnicianForm({ ...newTechnicianForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleAddTechnician}
                  className="w-full py-5 bg-primary text-white rounded-2xl font-black uppercase tracking-widest shadow-2xl shadow-primary/30 active:scale-95 transition-all"
                >
                  Add Technician
                </button>
                <button
                  onClick={() => {
                    setShowAddTechnicianModal(false);
                    setNewTechnicianForm({ name: '', email: '', phone: '' });
                    setTechnicianFormError('');
                  }}
                  className="w-full py-4 bg-transparent text-slate-400 font-black uppercase tracking-widest hover:text-white transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {showConfirmModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-modal-title"
              className="bg-slate-900 border border-white/10 p-6 md:p-8 lg:p-12 rounded-[3.5rem] max-w-lg w-full shadow-2xl space-y-8"
            >
              <div className="text-center space-y-4">
                <div className="bg-primary/20 size-20 rounded-[2.5rem] flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-primary text-5xl font-black">verified_user</span>
                </div>
                <h3 id="confirm-modal-title" className="text-3xl font-black text-white tracking-tighter uppercase">Confirm Job</h3>
                <div className="bg-slate-800/50 rounded-3xl p-6 text-left space-y-4 border border-white/5">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-[10px] uppercase font-black text-slate-300">Service</span>
                    <span className="text-xs font-bold text-white uppercase">{formData.title}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-[10px] uppercase font-black text-slate-300">Target</span>
                    <span className="text-xs font-bold text-white uppercase">{selectedClient?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[10px] uppercase font-black text-slate-300">Technician</span>
                    <span className="text-xs font-bold text-white uppercase">{selectedTech?.name}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={executeDispatch}
                  disabled={isCreating}
                  className="w-full py-5 bg-primary text-white rounded-2xl font-black uppercase tracking-widest shadow-2xl shadow-primary/30 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? 'Creating Job...' : 'Create Job'}
                </button>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isCreating}
                  className="w-full py-4 bg-transparent text-slate-400 font-black uppercase tracking-widest hover:text-white transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {showSuccessModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="success-modal-title"
              className="bg-slate-900 border border-white/10 p-6 md:p-8 lg:p-12 rounded-[3.5rem] max-w-2xl w-full shadow-2xl space-y-8"
            >
              <div className="text-center space-y-4">
                <div className="bg-success/20 size-20 rounded-[2.5rem] flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-success text-5xl font-black">check_circle</span>
                </div>
                <h3 id="success-modal-title" className="text-3xl font-black text-white tracking-tighter uppercase">Job Dispatched Successfully</h3>
                <p className="text-slate-400 text-sm font-medium">Job <span className="font-mono text-primary">{createdJobId}</span> created. Send the magic link below to your technician.</p>
              </div>

              {copySuccess && (
                <div className="bg-success/10 border border-success/20 rounded-xl p-4 animate-in">
                  <p className="text-success text-sm font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">check_circle</span>
                    Magic link copied to clipboard! Send this to your technician.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-slate-800/50 rounded-3xl p-6 space-y-4 border border-white/5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Technician Magic Link</p>
                    <span className="material-symbols-outlined text-primary text-sm font-black">link</span>
                  </div>
                  <div className="bg-slate-950 rounded-2xl p-4 border border-white/5">
                    <p className="text-xs font-mono text-white break-all">{getMagicLink()}</p>
                  </div>
                  <p className="text-[9px] text-slate-300 uppercase tracking-tight">This link provides browser-based access. No app installation required.</p>
                </div>

                <div className="bg-slate-800/50 rounded-3xl p-6 border border-white/5 flex flex-col items-center justify-center space-y-3">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">QR Code</p>
                  <div className="bg-white p-3 rounded-2xl">
                    <img src={getQRCodeDataURL()} alt="QR Code" className="w-32 h-32" />
                  </div>
                  <p className="text-[8px] text-slate-300 uppercase tracking-tight text-center">Scan to access</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button onClick={copyMagicLink} className="w-full py-5 bg-primary hover:bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-2xl shadow-primary/30 active:scale-95 transition-all flex items-center justify-center gap-3" aria-label="Copy magic link to clipboard">
                  <span className="material-symbols-outlined font-black" aria-hidden="true">content_copy</span>
                  Copy Magic Link
                </button>
                <button onClick={() => {
                  // Trigger guided flow for job creation
                  navigateToNextStep('CREATE_JOB', user?.persona, navigate);
                }} className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest transition-all rounded-2xl border border-white/10">
                  Return to Operations Hub
                </button>
              </div>

              <div className="flex items-center justify-center gap-4 pt-4 border-t border-white/5">
                <div className="text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Assigned To</p>
                  <p className="text-xs font-bold text-white uppercase">{selectedTech?.name}</p>
                </div>
                <div className="size-1 bg-slate-700 rounded-full"></div>
                <div className="text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Client</p>
                  <p className="text-xs font-bold text-white uppercase">{selectedClient?.name}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default CreateJob;
