
import React, { useState, useEffect } from 'react';
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
  const [formData, setFormData] = useState({
    title: '',
    clientId: '',
    techId: '',
    templateId: '',
    address: '',
    notes: '',
  });

  const handleTemplateChange = (tid: string) => {
    const template = templates.find(t => t.id === tid);
    setFormData(prev => ({
      ...prev,
      templateId: tid,
      notes: template ? template.description : prev.notes
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const client = clients.find(c => c.id === formData.clientId);
    const tech = technicians.find(t => t.id === formData.techId);

    if (!client || !tech) {
      alert("Please select a client and technician. Create them in the registry first if empty.");
      return;
    }

    const newId = `JP-${Math.floor(Math.random() * 90000) + 10000}`;
    const newJob: Job = {
      id: newId,
      title: formData.title,
      client: client.name,
      clientId: client.id,
      technician: tech.name,
      techId: tech.id,
      status: 'Pending',
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      address: formData.address || client.address,
      notes: formData.notes,
      photos: [],
      signature: null,
      templateId: formData.templateId
    };
    
    onAddJob(newJob);
    const dispatchLink = `${window.location.origin}/#/track/${newId}`;
    
    // Copy to clipboard automatically on modern browsers if allowed
    navigator.clipboard.writeText(dispatchLink).catch(() => {});
    
    alert(`Success: Job ${newId} Dispatched.\nDispatch Link copied to clipboard.`);
    navigate('/admin');
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-black text-white">Dispatch New Job</h2>
          <p className="text-slate-400">Initialize a verifiable proof-of-work sequence for a field technician.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6 shadow-2xl">
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Service Description</label>
              <input 
                required
                type="text" 
                placeholder="e.g. Electrical Inspection - Unit 4B" 
                className="w-full bg-slate-800 border-slate-700 rounded-lg py-3 px-4 text-white focus:ring-primary outline-none transition-all placeholder:text-slate-600"
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Client</label>
                <select 
                  required
                  className="w-full bg-slate-800 border-slate-700 rounded-lg py-3 px-4 text-white focus:ring-primary outline-none appearance-none transition-all"
                  value={formData.clientId}
                  onChange={e => setFormData({...formData, clientId: e.target.value})}
                >
                  <option value="">Select Client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {clients.length === 0 && <p className="text-[10px] text-amber-500 font-bold">No clients found. Add one in the Client Registry.</p>}
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Technician</label>
                <select 
                  required
                  className="w-full bg-slate-800 border-slate-700 rounded-lg py-3 px-4 text-white focus:ring-primary outline-none appearance-none transition-all"
                  value={formData.techId}
                  onChange={e => setFormData({...formData, techId: e.target.value})}
                >
                  <option value="">Select Technician...</option>
                  {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {technicians.length === 0 && <p className="text-[10px] text-amber-500 font-bold">No techs found. Add one in Technicians.</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="flex flex-col gap-2">
                 <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Workflow Template</label>
                 <select 
                   className="w-full bg-slate-800 border-slate-700 rounded-lg py-3 px-4 text-white focus:ring-primary outline-none appearance-none transition-all"
                   value={formData.templateId}
                   onChange={e => handleTemplateChange(e.target.value)}
                 >
                   <option value="">Standard Capture</option>
                   {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                 </select>
               </div>
               <div className="flex flex-col gap-2">
                 <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Location Override</label>
                 <input 
                   type="text" 
                   placeholder="Default to Client Address" 
                   className="w-full bg-slate-800 border-slate-700 rounded-lg py-3 px-4 text-white focus:ring-primary outline-none transition-all placeholder:text-slate-600"
                   value={formData.address}
                   onChange={e => setFormData({...formData, address: e.target.value})}
                 />
               </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Operational Instructions</label>
              <textarea 
                rows={3}
                placeholder="Specific evidence requirements..." 
                className="w-full bg-slate-800 border-slate-700 rounded-lg py-3 px-4 text-white focus:ring-primary outline-none resize-none transition-all placeholder:text-slate-600"
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
              />
            </div>
          </div>

          <div className="pt-4 flex gap-4">
             <button 
               type="button" 
               onClick={() => navigate('/admin')}
               className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-xl transition-all"
             >
               Cancel
             </button>
             <button 
               type="submit" 
               className="flex-[2] bg-primary hover:bg-blue-600 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
             >
               <span className="material-symbols-outlined">send</span>
               Dispatch & Notify
             </button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default CreateJob;
