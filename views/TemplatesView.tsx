
import React from 'react';
import Layout from '../components/Layout';

const TemplatesView: React.FC = () => {
  const templates = [
    { id: '1', name: 'Electrical Safety Audit', description: 'Standard 20-point precision audit for commercial infrastructure.', tasks: 20 },
    { id: '2', name: 'Mechanical Systems Check', description: 'Quarterly operational protocol for HVAC/R units.', tasks: 12 },
    { id: '3', name: 'Rapid Proof Capture', description: 'Priority evidence sequence for emergency callouts.', tasks: 4 },
  ];

  return (
    <Layout>
      <div className="space-y-8">
        <header className="flex justify-between items-end">
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Service Protocols</h2>
            <p className="text-slate-400">Standardize field capture sequences for organizational precision.</p>
          </div>
          <button className="px-6 py-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl font-black text-xs uppercase tracking-widest transition-all">New Protocol</button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {templates.map(tpl => (
            <div key={tpl.id} className="bg-slate-900 border border-white/5 p-8 rounded-[2.5rem] space-y-6 hover:border-primary/30 transition-all group shadow-xl">
              <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-3xl font-black">assignment</span>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-white uppercase tracking-tight">{tpl.name}</h3>
                <p className="text-sm text-slate-500 leading-relaxed font-medium">{tpl.description}</p>
              </div>
              <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tpl.tasks} Data Points</span>
                <button className="text-primary text-[10px] font-black uppercase tracking-widest hover:underline">Configure</button>
              </div>
            </div>
          ))}
          <div className="border-2 border-dashed border-white/5 rounded-[2.5rem] flex flex-col items-center justify-center p-8 gap-3 opacity-40 hover:opacity-100 transition-opacity cursor-pointer">
            <span className="material-symbols-outlined text-4xl font-black">add</span>
            <span className="font-black text-xs uppercase tracking-widest">Initialize Blueprint</span>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default TemplatesView;
