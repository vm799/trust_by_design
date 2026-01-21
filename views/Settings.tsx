import React, { useState } from 'react';
import Layout from '../components/Layout';
import { UserProfile } from '../types';
import { useNavigate } from 'react-router-dom';

interface SettingsProps {
  user: UserProfile;
  setUser: (u: UserProfile) => void;
}

const Settings: React.FC<SettingsProps> = ({ user, setUser }) => {
  const navigate = useNavigate();
  const [wsName, setWsName] = useState(user.workspaceName);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Job Configuration Settings
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('jobproof_job_settings');
    return saved ? JSON.parse(saved) : {
      mandatorySafety: true,
      mandatoryPhotos: true,
      mandatorySignature: true,
      captureGPS: true
    };
  });

  // Device Policy Settings
  const [deviceSettings, setDeviceSettings] = useState(() => {
    const saved = localStorage.getItem('jobproof_device_settings');
    return saved ? JSON.parse(saved) : {
      localRetention: '30',
      photoQuality: 'high'
    };
  });

  const saveWorkspace = () => {
    setUser({ ...user, workspaceName: wsName });
    alert('Workspace synchronized.');
  };

  const toggleSetting = (key: string) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    localStorage.setItem('jobproof_job_settings', JSON.stringify(newSettings));
  };

  const updateDeviceSetting = (key: string, value: string) => {
    const newSettings = { ...deviceSettings, [key]: value };
    setDeviceSettings(newSettings);
    localStorage.setItem('jobproof_device_settings', JSON.stringify(newSettings));
  };

  return (
    <Layout user={user}>
      <div className="max-w-5xl mx-auto space-y-12 pb-24">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tighter uppercase leading-none">Settings</h2>
          <p className="text-slate-400 text-sm sm:text-base">Manage organizational parameters, user roles, and operational protocols.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 sm:gap-12">
          <div className="lg:col-span-2 space-y-8 sm:space-y-12">
            {/* Organisation Profile */}
            <section id="nav-settings" className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-[3rem] overflow-hidden shadow-2xl">
               <div className="p-6 sm:p-8 border-b border-slate-800 flex justify-between items-center bg-white/[0.02]">
                  <h3 className="font-black text-white uppercase text-xs tracking-[0.2em]">Organisation Profile</h3>
                  <button onClick={saveWorkspace} className="text-primary text-xs font-black uppercase tracking-widest hover:underline transition-all">Save</button>
               </div>
               <div className="p-6 sm:p-10 space-y-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Workspace Name</label>
                    <input
                      type="text"
                      className="w-full bg-slate-800 border-slate-700 border rounded-xl sm:rounded-2xl py-3 sm:py-4 px-4 sm:px-6 text-white focus:ring-2 focus:ring-primary outline-none transition-all text-sm sm:text-base"
                      value={wsName}
                      onChange={e => setWsName(e.target.value)}
                      placeholder="Enter workspace name"
                    />
                  </div>
               </div>
            </section>

            {/* Users & Roles */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-[3rem] overflow-hidden shadow-2xl">
               <div className="p-6 sm:p-8 border-b border-slate-800 bg-white/[0.02]">
                  <h3 className="font-black text-white uppercase text-xs tracking-[0.2em]">Users & Roles</h3>
               </div>
               <div className="p-6 sm:p-10 space-y-6">
                  <div className="flex items-center justify-between p-4 bg-slate-800 rounded-2xl border border-white/5">
                     <div className="flex items-center gap-3 sm:gap-4">
                        <div className="size-10 bg-primary rounded-xl flex items-center justify-center font-black text-sm sm:text-base">
                          {user?.fullName?.[0] || user?.email?.[0] || 'A'}
                        </div>
                        <div>
                           <p className="text-sm font-bold text-white">{user?.fullName || user?.email || 'Admin User'}</p>
                           <p className="text-[10px] text-slate-500 uppercase font-black">Admin</p>
                        </div>
                     </div>
                     <span className="text-[10px] font-black text-success uppercase">Active</span>
                  </div>
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="w-full py-4 border-2 border-dashed border-slate-700 hover:border-primary/50 rounded-2xl text-[10px] font-black uppercase text-slate-500 hover:text-primary transition-all flex items-center justify-center gap-2 group"
                  >
                    <span className="material-symbols-outlined text-base group-hover:scale-110 transition-transform">person_add</span>
                    Invite Team Member
                  </button>
               </div>
            </section>

            {/* Job Configuration */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-[3rem] overflow-hidden shadow-2xl">
               <div className="p-6 sm:p-8 border-b border-slate-800 bg-white/[0.02]">
                  <h3 className="font-black text-white uppercase text-xs tracking-[0.2em]">Job Configuration</h3>
               </div>
               <div className="p-6 sm:p-10 space-y-6">
                  <ToggleSetting
                    label="Mandatory Safety Checks"
                    active={settings.mandatorySafety}
                    onToggle={() => toggleSetting('mandatorySafety')}
                  />
                  <ToggleSetting
                    label="Mandatory Before/After Photos"
                    active={settings.mandatoryPhotos}
                    onToggle={() => toggleSetting('mandatoryPhotos')}
                  />
                  <ToggleSetting
                    label="Mandatory Client Signature"
                    active={settings.mandatorySignature}
                    onToggle={() => toggleSetting('mandatorySignature')}
                  />
                  <ToggleSetting
                    label="Capture GPS on Dispatch"
                    active={settings.captureGPS}
                    onToggle={() => toggleSetting('captureGPS')}
                  />
               </div>
            </section>
          </div>

          {/* Sidebar */}
          <aside className="space-y-8">
            {/* Device Policies */}
            <div className="bg-slate-900 border border-white/5 p-6 sm:p-8 rounded-2xl sm:rounded-[3rem] shadow-2xl space-y-8">
               <h3 className="font-black text-white uppercase text-xs tracking-[0.2em]">Device Policies</h3>
               <div className="space-y-4">
                  <div className="space-y-1">
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Local Retention</p>
                     <select
                       value={deviceSettings.localRetention}
                       onChange={(e) => updateDeviceSetting('localRetention', e.target.value)}
                       className="w-full bg-slate-800 border-slate-700 border rounded-xl py-3 px-4 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-primary transition-all cursor-pointer"
                     >
                        <option value="14">14 Days</option>
                        <option value="30">30 Days</option>
                        <option value="90">90 Days</option>
                     </select>
                  </div>
                  <div className="space-y-1">
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Photo Quality</p>
                     <select
                       value={deviceSettings.photoQuality}
                       onChange={(e) => updateDeviceSetting('photoQuality', e.target.value)}
                       className="w-full bg-slate-800 border-slate-700 border rounded-xl py-3 px-4 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-primary transition-all cursor-pointer"
                     >
                        <option value="high">High (Detailed Proof)</option>
                        <option value="standard">Standard (Balanced)</option>
                        <option value="low">Low (Data Efficient)</option>
                     </select>
                  </div>
               </div>
            </div>

            {/* User Experience */}
            <div className="bg-slate-900 border border-white/5 p-6 sm:p-8 rounded-2xl sm:rounded-[3rem] shadow-2xl space-y-4">
               <h3 className="font-black text-white uppercase text-xs tracking-[0.2em]">User Experience</h3>
               <button
                  onClick={() => {
                    localStorage.removeItem('jobproof_onboarding_v4');
                    localStorage.removeItem('jobproof_checklist_dismissed');
                    alert('Onboarding tour reset! Refresh the page to start over.');
                  }}
                  className="w-full py-4 bg-primary/10 hover:bg-primary/20 border border-primary/20 hover:border-primary/30 rounded-2xl text-primary text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
               >
                  <span className="material-symbols-outlined text-base">refresh</span>
                  Restart Onboarding Tour
               </button>
               <p className="text-[10px] text-slate-500 leading-relaxed">
                  Launch the interactive walkthrough again to review key features and workflows.
               </p>
            </div>

            {/* Help & Support */}
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-6 sm:p-8 rounded-2xl sm:rounded-[3rem] space-y-4">
               <div className="flex items-center gap-3">
                 <div className="size-10 bg-primary/20 rounded-xl flex items-center justify-center">
                   <span className="material-symbols-outlined text-primary text-xl">help_center</span>
                 </div>
                 <h3 className="font-black text-white uppercase text-xs tracking-[0.2em]">Need Help?</h3>
               </div>
               <p className="text-xs text-slate-300 leading-relaxed">
                  Visit our help center for guides, FAQs, and best practices.
               </p>
               <button
                  onClick={() => navigate('/help')}
                  className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
               >
                  View Help Center
               </button>
            </div>
          </aside>
        </div>
      </div>

      {/* Invite Team Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 p-6 sm:p-10 rounded-2xl sm:rounded-[3rem] max-w-md w-full shadow-2xl space-y-6 animate-in">
            <div className="text-center space-y-2">
              <div className="size-14 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-primary text-3xl">person_add</span>
              </div>
              <h2 className="text-2xl font-black text-white tracking-tighter uppercase">Invite Team Member</h2>
              <p className="text-slate-400 text-sm">Send an invitation to join your workspace</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Email Address</label>
                <input
                  type="email"
                  placeholder="teammate@example.com"
                  className="w-full bg-slate-800 border-slate-700 border rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Role</label>
                <select className="w-full bg-slate-800 border-slate-700 border rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary outline-none transition-all cursor-pointer">
                  <option>Admin</option>
                  <option>Manager</option>
                  <option>Technician</option>
                  <option>View Only</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowInviteModal(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black uppercase transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  alert('Team invitation feature coming soon!');
                  setShowInviteModal(false);
                }}
                className="flex-1 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-black uppercase transition-all shadow-lg shadow-primary/20"
              >
                Send Invite
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

const ToggleSetting = ({ label, active, onToggle }: { label: string, active: boolean, onToggle: () => void }) => (
  <button
    onClick={onToggle}
    className="w-full flex items-center justify-between p-4 bg-slate-800/50 hover:bg-slate-800 border border-white/5 hover:border-primary/20 rounded-xl transition-all group"
  >
    <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">{label}</span>
    <div className={`w-11 h-6 rounded-full p-1 transition-all ${active ? 'bg-primary' : 'bg-slate-700'}`}>
       <div className={`size-4 bg-white rounded-full shadow-sm transition-all ${active ? 'translate-x-5' : 'translate-x-0'}`} />
    </div>
  </button>
);

export default Settings;
