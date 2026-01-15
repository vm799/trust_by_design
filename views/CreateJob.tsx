
import React, { useState } from 'react';
import Layout from '../components/Layout';
import { useNavigate } from 'react-router-dom';
import { Job, Client, Technician, JobTemplate } from '../types';

interface CreateJobProps {
  onAddJob: (job: Job) => void;
  clients: Client[];
  technicians: Technician[];
  templates: JobTemplate[];
}

const CreateJob: React.FC<CreateJobProps> = ({ onAddJob, clients, technicians, templates }) => {
  const navigate = useNavigate();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    clientId: '',
    techId: '',
    templateId: '',
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

  const executeDispatch = () => {
    const client = clients.find(c => c.id === formData.clientId);
    const tech = technicians.find(t => t.id === formData.techId);
    if (!client || !tech) return;

    const newId = `JP-${Math.floor(Math.random() * 90000) + 10000}`;
    // Fix: Add missing safetyChecklist property to comply with Job interface
    const newJob: Job = {
      id: newId,
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
        { id: 'sc3', label: 'Required Permits/Authorizations Checked', checked: false, required: true },
        { id: 'sc4', label: 'Tools & Equipment Visual Inspection', checked: false, required: true }
      ],
      templateId: formData.templateId,
      syncStatus: 'synced',
      lastUpdated: Date.now()
    };
    
    onAddJob(newJob);
    navigate('/admin');
  };

  const selectedClient = clients.find(c => c.id === formData.clientId);
  const selectedTech = technicians.find(t => t.id === formData.techId);

  return (
    <Layout>
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
                onChange={e => setFormData({...formData, title: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Target Client</label>
                <select required className="bg-slate-800 border-slate-700 rounded-xl py-3.5 px-5 text-white outline-none" value={formData.clientId} onChange={e => setFormData({...formData, clientId: e.target.value})}>
                  <option value="">Select Registry...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Field Operator</label>
                <select required className="bg-slate-800 border-slate-700 rounded-xl py-3.5 px-5 text-white outline-none" value={formData.techId} onChange={e => setFormData({...formData, techId: e.target.value})}>
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
                onChange={e => setFormData({...formData, address: e.target.value})}
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
                <h3 className="text-3xl font-black text-white tracking-tighter uppercase">Authorize Dispatch</h3>
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
                <button onClick={executeDispatch} className="w-full py-5 bg-primary text-white rounded-2xl font-black uppercase tracking-widest shadow-2xl shadow-primary/30 active:scale-95 transition-all">Confirm & Deploy</button>
                <button onClick={() => setShowConfirmModal(false)} className="w-full py-4 bg-transparent text-slate-400 font-black uppercase tracking-widest hover:text-white transition-all">Cancel Manifest</button>
              </div>
              <p className="text-center text-[8px] text-slate-600 font-black uppercase tracking-[0.4em]">Protocol Authorization Alpha-2</p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default CreateJob;
