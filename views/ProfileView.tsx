
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { UserProfile } from '../types';

interface ProfileViewProps {
  user: UserProfile;
  setUser: (u: UserProfile) => void;
  onLogout: () => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ user, setUser, onLogout }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(user);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = () => {
    setUser(formData);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-12">
        <div className="flex justify-between items-end border-b border-white/5 pb-8">
          <div className="flex items-start gap-4">
            <button
              onClick={() => navigate('/admin')}
              className="min-w-[48px] min-h-[48px] flex items-center justify-center text-slate-400 hover:text-white transition-colors rounded-xl hover:bg-white/5 press-spring lg:hidden mt-1"
              aria-label="Back to dashboard"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="space-y-1">
               <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Your Profile</h2>
               <p className="text-slate-400">Manage your administrative credentials.</p>
            </div>
          </div>
          <div className="bg-gradient-to-br from-primary to-blue-600 size-20 rounded-[2rem] flex items-center justify-center text-white font-black text-3xl shadow-2xl shadow-primary/20">
            {user.name[0]}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8">
           <section className="space-y-6 bg-slate-900 p-8 rounded-[2.5rem] border border-white/5 shadow-xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Full Name</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-800 border-slate-700 rounded-xl py-3 px-4 text-white focus:ring-primary outline-none" 
                      value={formData.name} 
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">System Role</label>
                    <input 
                      type="text" 
                      readOnly
                      className="w-full bg-slate-800 border-slate-700 rounded-xl py-3 px-4 text-slate-300 outline-none cursor-not-allowed uppercase font-black text-xs" 
                      value={formData.role} 
                    />
                 </div>
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Email</label>
                 <input 
                   type="email" 
                   className="w-full bg-slate-800 border-slate-700 rounded-xl py-3 px-4 text-white focus:ring-primary outline-none" 
                   value={formData.email} 
                   onChange={e => setFormData({...formData, email: e.target.value})}
                 />
              </div>
              <div className="pt-4 space-y-4">
                 {saveSuccess && (
                   <div className="bg-success/10 border border-success/20 rounded-xl p-4 flex items-center gap-3 animate-in">
                     <span className="material-symbols-outlined text-success">check_circle</span>
                     <span className="text-success text-sm font-bold">Profile updated successfully</span>
                   </div>
                 )}
                 <button
                  onClick={handleSave}
                  className="w-full py-4 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-primary/20 transition-all active:scale-95 press-spring"
                 >
                    Save Changes
                 </button>
              </div>
           </section>

           <div className="flex flex-col gap-4">
              <button 
                onClick={onLogout}
                className="w-full py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl font-black text-sm uppercase tracking-widest border border-red-500/20 transition-all flex items-center justify-center gap-3"
              >
                <span className="material-symbols-outlined font-black">logout</span>
                Sign Out
              </button>
           </div>
        </div>
      </div>
    </Layout>
  );
};

export default ProfileView;
