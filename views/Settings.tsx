
import React, { useState } from 'react';
import Layout from '../components/Layout';
import { UserProfile } from '../types';

interface SettingsProps {
  user: UserProfile;
  setUser: (u: UserProfile) => void;
}

const Settings: React.FC<SettingsProps> = ({ user, setUser }) => {
  const [wsName, setWsName] = useState(user.workspaceName);

  const saveWorkspace = () => {
    setUser({ ...user, workspaceName: wsName });
    alert('Workspace settings updated.');
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Workspace Infrastructure</h2>
          <p className="text-slate-400">Manage organization-level configurations and compliance.</p>
        </div>

        <section id="nav-settings" className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-xl">
           <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-white/[0.02]">
              <h3 className="font-black text-white uppercase text-xs tracking-widest">Organization Profile</h3>
              <button onClick={saveWorkspace} className="text-primary text-xs font-black uppercase tracking-widest hover:underline">Commit Changes</button>
           </div>
           <div className="p-10 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Trading Name</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-800 border-slate-700 rounded-xl py-3 px-4 text-white focus:ring-primary outline-none" 
                      value={wsName} 
                      onChange={e => setWsName(e.target.value)}
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Default Sector</label>
                    <select className="w-full bg-slate-800 border-slate-700 rounded-xl py-3 px-4 text-white focus:ring-primary outline-none appearance-none">
                       <option>HVAC & Refrigeration</option>
                       <option>Electrical Services</option>
                       <option>Plumbing & Gas</option>
                       <option>Civil Engineering</option>
                    </select>
                 </div>
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Headquarters Address</label>
                 <input type="text" className="w-full bg-slate-800 border-slate-700 rounded-xl py-3 px-4 text-white focus:ring-primary outline-none" defaultValue="102 Industrial Blvd, Ste 400, Chicago IL" />
              </div>
           </div>
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-xl">
           <div className="p-8 border-b border-slate-800 bg-white/[0.02]">
              <h3 className="font-black text-white uppercase text-xs tracking-widest">Report Branding</h3>
           </div>
           <div className="p-10 space-y-8">
              <div className="flex flex-col md:flex-row items-center gap-10">
                 <div className="size-32 rounded-[2.5rem] bg-slate-800 border-2 border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500 gap-2 group cursor-pointer hover:border-primary/50 transition-colors">
                    <span className="material-symbols-outlined text-4xl group-hover:scale-110 transition-transform">add_photo_alternate</span>
                    <span className="text-[8px] font-black uppercase">Upload SVG/PNG</span>
                 </div>
                 <div className="space-y-2 flex-1 text-center md:text-left">
                    <p className="text-lg font-black text-white italic uppercase tracking-tighter">Corporate Identity</p>
                    <p className="text-xs text-slate-500 leading-relaxed">This logo will be embedded into every verified PDF report and client email. Use high-resolution assets for professional output.</p>
                    <button className="bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest px-6 py-2 rounded-xl border border-primary/20 mt-4 hover:bg-primary/20 transition-all">Replace File</button>
                 </div>
              </div>
              <div className="pt-8 border-t border-slate-800">
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Accent Configuration</p>
                 <div className="flex flex-wrap gap-4">
                    <div className="size-12 rounded-2xl bg-primary ring-4 ring-offset-4 ring-offset-slate-900 ring-primary cursor-pointer shadow-2xl shadow-primary/40"></div>
                    <div className="size-12 rounded-2xl bg-danger cursor-pointer hover:scale-105 transition-transform"></div>
                    <div className="size-12 rounded-2xl bg-success cursor-pointer hover:scale-105 transition-transform"></div>
                    <div className="size-12 rounded-2xl bg-warning cursor-pointer hover:scale-105 transition-transform"></div>
                    <div className="size-12 rounded-2xl bg-purple-600 cursor-pointer hover:scale-105 transition-transform"></div>
                 </div>
              </div>
           </div>
        </section>

        <section className="p-10 border border-danger/10 rounded-[2.5rem] bg-danger/5 flex flex-col md:flex-row justify-between items-center gap-6">
           <div className="text-center md:text-left">
              <h3 className="font-black text-danger italic uppercase tracking-tighter text-xl">Operational Termination</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">This will permanently purge your hub, registry, and evidence trails. This action is not reversible.</p>
           </div>
           <button className="w-full md:w-auto bg-danger hover:bg-red-600 text-white text-[10px] font-black uppercase tracking-widest px-8 py-4 rounded-2xl transition-all">Destroy Workspace</button>
        </section>
      </div>
    </Layout>
  );
};

export default Settings;
