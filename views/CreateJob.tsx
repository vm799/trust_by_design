
import React, { useState } from 'react';
import Layout from '../components/Layout';
import { useNavigate, useLocation } from 'react-router-dom';
import { Job, Client, Technician, JobTemplate, UserProfile } from '../types';
import { createJob, generateMagicLink } from '../lib/db';

interface CreateJobProps {
  onAddJob: (job: Job) => void;
  user: UserProfile | null;
  clients: Client[];
  technicians: Technician[];
  templates: JobTemplate[];
}

const CreateJob: React.FC<CreateJobProps> = ({ onAddJob, user, clients, technicians, templates }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Parse query params for pre-filled templates
  const queryParams = new URLSearchParams(location.search);
  const initialTemplateId = queryParams.get('template') || '';
  const initialTitle = queryParams.get('title') || '';

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdJobId, setCreatedJobId] = useState<string>('');
  const [magicLinkUrl, setMagicLinkUrl] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    title: initialTitle,
    clientId: '',
    techId: '',
    templateId: initialTemplateId,
    address: '',
    notes: '',
  });

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientId || !formData.techId) {
      alert("Selection of Client and Operator is required.");
      return;
    }
    setShowConfirmModal(true);
  };

  const executeDispatch = async () => {
    const client = clients.find(c => c.id === formData.clientId);
    const tech = technicians.find(t => t.id === formData.techId);
    if (!client || !tech) return;

    setIsCreating(true);

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
      const result = await createJob(jobData);

      if (!result.success) {
        // Fallback to localStorage if Supabase not configured
        // Use UUID to prevent enumeration attacks (BACKEND_AUDIT.md Risk #5)
        const newId = `JP-${crypto.randomUUID()}`;
        const localJob: Job = { ...jobData, id: newId } as Job;
        onAddJob(localJob);
        setCreatedJobId(newId);
        setMagicLinkUrl(`${window.location.origin}/#/track/${newId}`);
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
        setMagicLinkUrl(`${window.location.origin}/#/track/${createdJob.id}`);
      }

      // Also add to local state via onAddJob for immediate UI update
      onAddJob(createdJob);

      setShowConfirmModal(false);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Failed to create job:', error);
      alert('Failed to create job. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const getMagicLink = () => magicLinkUrl || `${window.location.origin}/#/track/${createdJobId}`;

  const copyMagicLink = () => {
    navigator.clipboard.writeText(getMagicLink());
    alert('Magic link copied to clipboard! Send this to your technician.');
  };

  const getQRCodeDataURL = () => {
    // Generate QR code using Google Chart API (no library needed)
    const url = encodeURIComponent(getMagicLink());
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${url}`;
  };

  const selectedClient = clients.find(c => c.id === formData.clientId);
  const selectedTech = technicians.find(t => t.id === formData.techId);

  return (
    <Layout user={user}>
      <div className="max-w-2xl mx-auto space-y-6 pb-20">
        <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Initialize Dispatch</h2>

        <form onSubmit={handleFormSubmit} className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-8 space-y-6 shadow-2xl">
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Protocol Description</label>
              <input
                required
                type="text"
                className="w-full bg-slate-800 border-slate-700 rounded-xl py-3.5 px-5 text-white focus:ring-primary outline-none"
                placeholder="e.g. Asset Inspection - Unit 4B"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Target Client</label>
                <select required className="bg-slate-800 border-slate-700 rounded-xl py-3.5 px-5 text-white outline-none" value={formData.clientId} onChange={e => setFormData({ ...formData, clientId: e.target.value })}>
                  <option value="">Select Registry...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Field Operator</label>
                <select required className="bg-slate-800 border-slate-700 rounded-xl py-3.5 px-5 text-white outline-none" value={formData.techId} onChange={e => setFormData({ ...formData, techId: e.target.value })}>
                  <option value="">Select Tech...</option>
                  {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Deployment Location Override</label>
              <input
                type="text"
                className="w-full bg-slate-800 border-slate-700 rounded-xl py-3.5 px-5 text-white focus:ring-primary outline-none"
                placeholder="Defaults to Client Registry address"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
          </div>
          <button type="submit" className="w-full py-5 bg-primary text-white font-black rounded-2xl uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:bg-primary-hover active:scale-95">Review Dispatch Manifest</button>
        </form>

        {showConfirmModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in">
            <div className="bg-slate-900 border border-white/10 p-12 rounded-[3.5rem] max-w-lg w-full shadow-2xl space-y-8">
              <div className="text-center space-y-4">
                <div className="bg-primary/20 size-20 rounded-[2.5rem] flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-primary text-5xl font-black">verified_user</span>
                </div>
                <h3 className="text-3xl font-black text-white tracking-tighter uppercase">Authorise Dispatch</h3>
                <div className="bg-slate-800/50 rounded-3xl p-6 text-left space-y-4 border border-white/5">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-[10px] uppercase font-black text-slate-500">Service</span>
                    <span className="text-xs font-bold text-white uppercase">{formData.title}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-[10px] uppercase font-black text-slate-500">Target</span>
                    <span className="text-xs font-bold text-white uppercase">{selectedClient?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[10px] uppercase font-black text-slate-500">Operator</span>
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
                  {isCreating ? 'Creating Job...' : 'Confirm & Deploy'}
                </button>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isCreating}
                  className="w-full py-4 bg-transparent text-slate-400 font-black uppercase tracking-widest hover:text-white transition-all disabled:opacity-50"
                >
                  Cancel Manifest
                </button>
              </div>
              <p className="text-center text-[8px] text-slate-600 font-black uppercase tracking-[0.4em]">Protocol Authorization Alpha-2</p>
            </div>
          </div>
        )}

        {showSuccessModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in">
            <div className="bg-slate-900 border border-white/10 p-12 rounded-[3.5rem] max-w-2xl w-full shadow-2xl space-y-8">
              <div className="text-center space-y-4">
                <div className="bg-success/20 size-20 rounded-[2.5rem] flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-success text-5xl font-black">check_circle</span>
                </div>
                <h3 className="text-3xl font-black text-white tracking-tighter uppercase">Job Dispatched Successfully</h3>
                <p className="text-slate-400 text-sm font-medium">Protocol <span className="font-mono text-primary">{createdJobId}</span> is now active. Send the magic link below to your technician.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-slate-800/50 rounded-3xl p-6 space-y-4 border border-white/5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Technician Magic Link</p>
                    <span className="material-symbols-outlined text-primary text-sm font-black">link</span>
                  </div>
                  <div className="bg-slate-950 rounded-2xl p-4 border border-white/5">
                    <p className="text-xs font-mono text-white break-all">{getMagicLink()}</p>
                  </div>
                  <p className="text-[9px] text-slate-500 uppercase tracking-tight">This link provides browser-based access. No app installation required.</p>
                </div>

                <div className="bg-slate-800/50 rounded-3xl p-6 border border-white/5 flex flex-col items-center justify-center space-y-3">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">QR Code</p>
                  <div className="bg-white p-3 rounded-2xl">
                    <img src={getQRCodeDataURL()} alt="QR Code" className="w-32 h-32" />
                  </div>
                  <p className="text-[8px] text-slate-500 uppercase tracking-tight text-center">Scan to access</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button onClick={copyMagicLink} className="w-full py-5 bg-primary hover:bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-2xl shadow-primary/30 active:scale-95 transition-all flex items-center justify-center gap-3">
                  <span className="material-symbols-outlined font-black">content_copy</span>
                  Copy Magic Link
                </button>
                <button onClick={() => navigate('/admin')} className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest transition-all rounded-2xl border border-white/10">
                  Return to Operations Hub
                </button>
              </div>

              <div className="flex items-center justify-center gap-4 pt-4 border-t border-white/5">
                <div className="text-center">
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Assigned To</p>
                  <p className="text-xs font-bold text-white uppercase">{selectedTech?.name}</p>
                </div>
                <div className="size-1 bg-slate-700 rounded-full"></div>
                <div className="text-center">
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Client</p>
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
