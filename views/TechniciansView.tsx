
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/AppLayout';
import { Technician, UserProfile } from '../types';
import { navigateToNextStep } from '../lib/onboarding';
import { secureRandomString } from '../lib/secureId';

interface TechniciansViewProps {
  user: UserProfile | null;
  techs: Technician[];
  onAdd: (t: Technician) => void;
  onDelete: (id: string) => void;
}

const TechniciansView: React.FC<TechniciansViewProps> = ({ user, techs, onAdd, onDelete }) => {
  const navigate = useNavigate();
  const [showAdd, setShowAdd] = useState(false);
  const [newTech, setNewTech] = useState({ name: '', email: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      id: secureRandomString(9),
      name: newTech.name,
      email: newTech.email,
      status: 'Authorised',
      rating: 0,
      jobsCompleted: 0
    });
    setNewTech({ name: '', email: '' });
    setShowAdd(false);

    // Trigger guided flow auto-navigation
    navigateToNextStep('ADD_TECHNICIAN', user?.persona, navigate);
  };

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Workforce</h2>
            <p className="text-slate-400">Your team of technicians.</p>
          </div>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="bg-primary text-white px-6 py-2 rounded-xl text-xs font-black hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 flex items-center gap-2 uppercase tracking-widest"
          >
            <span className="material-symbols-outlined text-lg font-black">{showAdd ? 'close' : 'add'}</span>
            {showAdd ? 'Cancel' : 'Add Technician'}
          </button>
        </div>

        {showAdd && (
          <form onSubmit={handleSubmit} className="bg-slate-900 border border-primary/20 p-6 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4 animate-in shadow-2xl">
            <input required placeholder="Technician Name" aria-label="Technician Name" className="bg-slate-800 border-slate-700 rounded-lg p-3 text-sm text-white outline-none" value={newTech.name} onChange={e => setNewTech({ ...newTech, name: e.target.value })} />
            <input required type="email" placeholder="Technician Email" aria-label="Technician Email" className="bg-slate-800 border-slate-700 rounded-lg p-3 text-sm text-white outline-none" value={newTech.email} onChange={e => setNewTech({ ...newTech, email: e.target.value })} />
            <button type="submit" className="md:col-span-2 bg-primary text-white font-black py-3 rounded-xl uppercase tracking-widest text-xs">Add Technician</button>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {techs.length === 0 ? (
            <div className="col-span-full py-20 bg-slate-900 border border-dashed border-white/5 rounded-3xl text-center opacity-40">
              <span className="material-symbols-outlined text-5xl mb-2 font-black">engineering</span>
              <p className="font-black uppercase tracking-widest text-[10px]">No field workforce registered.</p>
            </div>
          ) : (
            techs.map(tech => (
              <div key={tech.id} className="bg-gradient-to-br from-slate-900 to-slate-950 border border-blue-500/20 p-6 rounded-3xl space-y-4 hover:border-blue-500/50 transition-all group relative shadow-lg shadow-blue-500/10">
                {/* ID Badge and Status */}
                <div className="flex justify-between items-start">
                  <div className="space-y-1 flex-1">
                    <p className="text-[8px] font-black text-blue-400 uppercase tracking-[0.15em] font-mono">Tech ID</p>
                    <p className="text-xs font-black text-white font-mono">{tech.id.toUpperCase().substring(0, 8)}</p>
                  </div>
                  <span className={`text-[8px] font-black px-2.5 py-1 rounded-full border uppercase tracking-widest whitespace-nowrap ml-2 ${tech.status === 'Authorised' ? 'bg-success/10 text-success border-success/30' : 'bg-slate-700/50 text-slate-300 border-slate-600/30'}`}>
                    {tech.status}
                  </span>
                </div>

                {/* Avatar and Name */}
                <div className="flex gap-3">
                  <div className="size-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center font-black text-2xl uppercase flex-shrink-0 shadow-lg shadow-blue-500/30">
                    {tech.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-white uppercase text-sm tracking-tight group-hover:text-blue-400 transition-colors">{tech.name}</h3>
                    <p className="text-[10px] text-blue-300 font-mono truncate">{tech.email}</p>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/50">
                  <div className="space-y-0.5">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Jobs Completed</p>
                    <p className="text-lg font-black text-white">{tech.jobsCompleted || 0}</p>
                  </div>
                  {tech.rating > 0 && (
                    <div className="space-y-0.5">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs text-amber-500">star</span>
                        Rating
                      </p>
                      <p className="text-lg font-black text-amber-400">{tech.rating.toFixed(1)}</p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => onDelete(tech.id)}
                    className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 min-h-[36px]"
                    title="Remove technician"
                  >
                    <span className="material-symbols-outlined text-xs">delete</span>
                    <span className="hidden sm:inline">Remove</span>
                  </button>
                  <button
                    className="flex-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:border-blue-500/50 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 min-h-[36px]"
                    title="View technician's jobs"
                  >
                    <span className="material-symbols-outlined text-xs">work</span>
                    <span className="hidden sm:inline">Jobs</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
};

export default TechniciansView;
