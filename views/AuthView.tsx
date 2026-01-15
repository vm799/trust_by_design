
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

interface AuthViewProps {
  type: 'login' | 'signup';
  onAuth: () => void;
}

const AuthView: React.FC<AuthViewProps> = ({ type, onAuth }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      onAuth();
      navigate('/admin');
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 -left-20 size-96 bg-primary/20 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-0 -right-20 size-96 bg-blue-500/10 blur-[120px] rounded-full"></div>

      <div className="w-full max-w-md space-y-8 relative z-10 animate-in">
        <div className="text-center space-y-4">
          <Link to="/home" className="inline-flex items-center gap-3 group">
            <div className="bg-primary size-12 rounded-2xl flex items-center justify-center shadow-xl shadow-primary/30 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-white text-2xl">verified</span>
            </div>
            <span className="text-3xl font-black tracking-tighter text-white">JobProof</span>
          </Link>
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">
              {type === 'login' ? 'Access Control' : 'Join the Protocol'}
            </h2>
            <p className="text-slate-500 text-sm">
              {type === 'login' ? 'Welcome back to the operations hub.' : 'The simplest proof-of-work platform for field teams.'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-900 border border-white/5 p-8 rounded-[2.5rem] shadow-2xl space-y-6">
          {type === 'signup' && (
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Workspace Name</label>
              <input required type="text" placeholder="e.g. Sterling Field Ops" className="w-full bg-slate-800 border-slate-700 rounded-xl py-3 px-4 text-white focus:ring-primary outline-none" />
            </div>
          )}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Admin Email</label>
            <input required type="email" placeholder="alex@company.com" className="w-full bg-slate-800 border-slate-700 rounded-xl py-3 px-4 text-white focus:ring-primary outline-none" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Password</label>
              {type === 'login' && <button type="button" className="text-[10px] font-black text-primary hover:underline">Forgot?</button>}
            </div>
            <input required type="password" placeholder="••••••••" className="w-full bg-slate-800 border-slate-700 rounded-xl py-3 px-4 text-white focus:ring-primary outline-none" />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center"
          >
            {loading ? <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : (type === 'login' ? 'Enter Hub' : 'Create Workspace')}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 font-medium">
          {type === 'login' ? "Don't have a workspace?" : "Already have a workspace?"}
          <Link to={type === 'login' ? '/auth/signup' : '/auth/login'} className="text-primary font-black ml-2 hover:underline">
            {type === 'login' ? 'Initialize One' : 'Sign In'}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default AuthView;
