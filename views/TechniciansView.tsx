
import React, { useState } from 'react';
import Layout from '../components/Layout';
import { Technician, UserProfile } from '../types';

interface TechniciansViewProps {
  user: UserProfile | null;
  techs: Technician[];
  onAdd: (t: Technician) => void;
  onDelete: (id: string) => void;
}

const TechniciansView: React.FC<TechniciansViewProps> = ({ user, techs, onAdd, onDelete }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [newTech, setNewTech] = useState({ name: '', email: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      id: Math.random().toString(36).substr(2, 9),
      name: newTech.name,
      email: newTech.email,
      status: 'Authorised',
      rating: 0,
      jobsCompleted: 0
    });
    setNewTech({ name: '', email: '' });
    setShowAdd(false);
  };

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Workforce</h2>
            <p className="text-slate-400">Authorized field operators linked to the verification hub.</p>
          </div>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="bg-primary text-white px-6 py-2 rounded-xl text-xs font-black hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 flex items-center gap-2 uppercase tracking-widest"
          >
            <span className="material-symbols-outlined text-lg font-black">{showAdd ? 'close' : 'add'}</span>
            {showAdd ? 'Cancel' : 'Authorise Tech'}
          </button>
        </div>

        {showAdd && (
          <form onSubmit={handleSubmit} className="bg-slate-900 border border-primary/20 p-6 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4 animate-in shadow-2xl">
            <input required placeholder="Operator Full Name" className="bg-slate-800 border-slate-700 rounded-lg p-3 text-sm text-white outline-none" value={newTech.name} onChange={e => setNewTech({ ...newTech, name: e.target.value })} />
            <input required type="email" placeholder="Operator Email" className="bg-slate-800 border-slate-700 rounded-lg p-3 text-sm text-white outline-none" value={newTech.email} onChange={e => setNewTech({ ...newTech, email: e.target.value })} />
            <button type="submit" className="md:col-span-2 bg-primary text-white font-black py-3 rounded-xl uppercase tracking-widest text-xs">Commit Authorisation</button>
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
              <div key={tech.id} className="bg-slate-900 border border-white/5 p-6 rounded-3xl space-y-4 hover:border-primary/20 transition-all group relative">
                <button
                  onClick={() => onDelete(tech.id)}
                  className="absolute top-4 right-4 text-slate-700 hover:text-red-500 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
                <div className="flex justify-between items-start">
                  <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-xl uppercase">{tech.name[0]}</div>
                  <span className="text-[8px] font-black px-2 py-0.5 rounded-full border bg-success/10 text-success border-success/20 uppercase tracking-widest">{tech.status}</span>
                </div>
                <div>
                  <h3 className="font-black text-white group-hover:text-primary transition-colors uppercase text-sm tracking-tight">{tech.name}</h3>
                  <p className="text-[10px] text-slate-500 font-mono mb-2 uppercase">{tech.email}</p>
                  {tech.rating > 0 && (
                    <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <span className="material-symbols-outlined text-xs text-amber-500 fill-amber-500 font-black">star</span>
                      {tech.rating} Field Rating
                    </div>
                  )}
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
