
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
    alert('Workspace synchronized.');
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-12 pb-24">
        <div className="flex flex-col gap-1">
          <h2 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">Settings</h2>
          <p className="text-slate-400">Manage organizational parameters, user roles, and operational protocols.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-12">
            <section id="nav-settings" className="bg-slate-900 border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl">
               <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-white/[0.02]">
                  <h3 className="font-black text-white uppercase text-xs tracking-[0.2em]">Organisation Profile</h3>
                  <button onClick={saveWorkspace} className="text-primary text-xs font-black uppercase tracking-widest hover:underline">Save</button>
               </div>
               <div className="p-10 space-y-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Workspace Name</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-800 border-slate-700 rounded-2xl py-4 px-6 text-white focus:ring-primary outline-none transition-all" 
                      value={wsName} 
                      onChange={e => setWsName(e.target.value)}
                    />
                  </div>
               </div>
            </section>

            <section className="bg-slate-900 border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl">
               <div className="p-8 border-b border-slate-800 bg-white/[0.02]">
                  <h3 className="font-black text-white uppercase text-xs tracking-[0.2em]">Users & Roles</h3>
               </div>
               <div className="p-10 space-y-6">
                  <div className="flex items-center justify-between p-4 bg-slate-800 rounded-2xl border border-white/5">
                     <div className="flex items-center gap-4">
                        <div className="size-10 bg-primary rounded-xl flex items-center justify-center font-black">A</div>
                        <div>
                           <p className="text-sm font-bold">Alex Sterling</p>
                           <p className="text-[10px] text-slate-500 uppercase font-black">Admin</p>
                        </div>
                     </div>
                     <span className="text-[10px] font-black text-primary uppercase">Active</span>
                  </div>
                  <button className="w-full py-4 border-2 border-dashed border-slate-700 rounded-2xl text-[10px] font-black uppercase text-slate-500 hover:text-white hover:border-slate-500 transition-all">Invite Team Member</button>
               </div>
            </section>

            <section className="bg-slate-900 border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl">
               <div className="p-8 border-b border-slate-800 bg-white/[0.02]">
                  <h3 className="font-black text-white uppercase text-xs tracking-[0.2em]">Job Configuration</h3>
               </div>
               <div className="p-10 space-y-6">
                  <ToggleSetting label="Mandatory Safety Checks" active />
                  <ToggleSetting label="Mandatory Before/After Photos" active />
                  <ToggleSetting label="Mandatory Client Signature" active />
                  <ToggleSetting label="Capture GPS on Dispatch" />
               </div>
            </section>
          </div>

          <aside className="space-y-8">
            <div className="bg-slate-900 border border-white/5 p-8 rounded-[3rem] shadow-2xl space-y-8">
               <h3 className="font-black text-white uppercase text-xs tracking-[0.2em]">Device Policies</h3>
               <div className="space-y-4">
                  <div className="space-y-1">
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Local Retention</p>
                     <select className="w-full bg-slate-800 border-slate-700 rounded-xl py-3 px-4 text-xs font-bold text-white outline-none">
                        <option>14 Days</option>
                        <option>30 Days</option>
                        <option>90 Days</option>
                     </select>
                  </div>
                  <div className="space-y-1">
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Photo Quality</p>
                     <select className="w-full bg-slate-800 border-slate-700 rounded-xl py-3 px-4 text-xs font-bold text-white outline-none">
                        <option>High (Detailed Proof)</option>
                        <option>Standard (Balanced)</option>
                        <option>Low (Data Efficient)</option>
                     </select>
                  </div>
               </div>
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  );
};

const ToggleSetting = ({ label, active }: { label: string, active?: boolean }) => (
  <div className="flex items-center justify-between">
    <span className="text-sm font-bold text-slate-300">{label}</span>
    <div className={`w-10 h-6 rounded-full p-1 transition-all ${active ? 'bg-primary' : 'bg-slate-700'}`}>
       <div className={`size-4 bg-white rounded-full shadow-sm transition-all ${active ? 'ml-4' : 'ml-0'}`} />
    </div>
  </div>
);

export default Settings;
