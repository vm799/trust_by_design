
import React, { useState } from 'react';
import Layout from '../components/Layout';
import { Technician } from '../types';

interface TechniciansViewProps {
  techs: Technician[];
  onAdd: (t: Technician) => void;
  onDelete: (id: string) => void;
}

const TechniciansView: React.FC<TechniciansViewProps> = ({ techs, onAdd, onDelete }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [newTech, setNewTech] = useState({ name: '', email: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      id: Math.random().toString(36).substr(2, 9),
      name: newTech.name,
      email: newTech.email,
      status: 'Available',
      rating: 5.0,
      jobsCompleted: 0
    });
    setNewTech({ name: '', email: '' });
    setShowAdd(false);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-end">
          <div className="space-y-1">
             <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Workforce</h2>
             <p className="text-slate-400">Operational field agents authorized for JobProof dispatch.</p>
          </div>
          <button 
            onClick={() => setShowAdd(!showAdd)}
            className="bg-primary text-white px-6 py-2 rounded-xl text-sm font-black hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">{showAdd ? 'close' : 'add'}</span>
            {showAdd ? 'Cancel' : 'Authorize Technician'}
          </button>
        </div>

        {showAdd && (
          <form onSubmit={handleSubmit} className="bg-slate-900 border border-primary/20 p-6 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4 animate-in shadow-2xl">
             <input required placeholder="Full Name" className="bg-slate-800 border-slate-700 rounded-lg p-3 text-sm text-white" value={newTech.name} onChange={e => setNewTech({...newTech, name: e.target.value})} />
             <input required type="email" placeholder="Contact Email" className="bg-slate-800 border-slate-700 rounded-lg p-3 text-sm text-white" value={newTech.email} onChange={e => setNewTech({...newTech, email: e.target.value})} />
             <button type="submit" className="md:col-span-2 bg-primary text-white font-black py-3 rounded-xl">Onboard Field Operator</button>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {techs.length === 0 ? (
            <div className="col-span-full py-20 bg-slate-900 border border-dashed border-white/5 rounded-3xl text-center opacity-40">
               <span className="material-symbols-outlined text-5xl mb-2">engineering</span>
               <p className="font-bold uppercase tracking-widest text-[10px]">No authorized technicians found.</p>
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
                    <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-xl">{tech.name[0]}</div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full border bg-success/10 text-success border-success/20">{tech.status}</span>
                 </div>
                 <div>
                    <h3 className="font-bold text-white group-hover:text-primary transition-colors">{tech.name}</h3>
                    <p className="text-[10px] text-slate-500 font-mono mb-2">{tech.email}</p>
                    <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                       <span className="material-symbols-outlined text-xs text-amber-500 fill-amber-500">star</span>
                       {tech.rating} Score • {tech.jobsCompleted} Logs
                    </div>
                 </div>
                 <button className="w-full py-3 bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/10 transition-all">Performance Data</button>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
};

export default TechniciansView;
