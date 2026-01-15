
import React from 'react';
import Layout from '../components/Layout';
import OnboardingTour from '../components/OnboardingTour';
import { Job } from '../types';
import { useNavigate } from 'react-router-dom';

interface AdminDashboardProps {
  jobs: Job[];
  showOnboarding: boolean;
  onCloseOnboarding: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ jobs, showOnboarding, onCloseOnboarding }) => {
  const navigate = useNavigate();

  const activeJobsCount = jobs.filter(j => j.status !== 'Submitted' && j.status !== 'Archived').length;
  const submittedJobsCount = jobs.filter(j => j.status === 'Submitted').length;

  return (
    <Layout>
      {showOnboarding && <OnboardingTour onComplete={onCloseOnboarding} />}

      <div className="space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Live Dispatches" value={activeJobsCount.toString()} trend="Active proof cycles" icon="send" />
          <MetricCard label="Verified Logs" value={submittedJobsCount.toString()} trend="Sealed completions" icon="verified" />
          <MetricCard label="Proof Integrity" value="100%" trend="GPS & Time synced" icon="security" />
          <MetricCard label="Team Capacity" value="--" trend="Tracking metrics..." icon="engineering" />
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-md group">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">search</span>
            <input 
              type="text" 
              placeholder="Filter by Job ID, Client or Tech..." 
              className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-white/5 rounded-xl text-sm focus:ring-1 focus:ring-primary outline-none transition-all shadow-inner"
            />
          </div>
          <button onClick={() => navigate('/admin/create')} className="w-full md:w-auto px-8 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-black shadow-lg shadow-primary/20 flex items-center justify-center gap-2 transition-all">
            <span className="material-symbols-outlined text-lg">add</span>
            New Service Dispatch
          </button>
        </div>

        <div id="ops-feed" className="bg-slate-900 border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
          <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 italic">Operations Feed</h3>
            <span className="text-[10px] text-slate-500 font-bold uppercase">{jobs.length} Entries</span>
          </div>
          <div className="overflow-x-auto">
            {jobs.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center justify-center space-y-4 opacity-50">
                <div className="size-20 rounded-full bg-slate-800 flex items-center justify-center text-slate-600 mb-2">
                  <span className="material-symbols-outlined text-4xl">inbox</span>
                </div>
                <div className="space-y-1">
                  <p className="font-black text-white text-lg">Empty Workspace</p>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">Start by adding a Client in the Registry, then dispatch your first verifiable job.</p>
                </div>
                <button 
                  onClick={() => navigate('/admin/clients')}
                  className="px-6 py-2 bg-white/5 border border-white/10 text-white rounded-lg text-xs font-black hover:bg-white/10 transition-all uppercase tracking-widest"
                >
                  Go to Client Registry
                </button>
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-950/50">
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Job Details</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Asset / Client</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Field Operator</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Live Status</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {jobs.map((job) => (
                    <tr 
                      key={job.id} 
                      className="hover:bg-white/5 cursor-pointer transition-colors group"
                      onClick={() => navigate(`/admin/report/${job.id}`)}
                    >
                      <td className="px-6 py-5">
                        <div className="font-bold text-white group-hover:text-primary transition-colors italic uppercase tracking-tighter">{job.title}</div>
                        <div className="text-[10px] font-mono text-slate-500 mt-1">{job.id} • {job.date}</div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-sm text-slate-300 font-bold">{job.client}</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[180px]">{job.address}</div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <div className="size-6 rounded-md bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">{job.technician[0]}</div>
                          <span className="text-sm text-slate-300 font-medium">{job.technician}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-tighter ${
                          job.status === 'Submitted' ? 'bg-success/10 text-success border-success/20' : 
                          job.status === 'In Progress' ? 'bg-primary/10 text-primary border-primary/20' :
                          'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          <span className={`size-1.5 rounded-full ${
                            job.status === 'Submitted' ? 'bg-success' : 
                            job.status === 'In Progress' ? 'bg-primary animate-pulse' : 'bg-slate-500'
                          }`}></span>
                          {job.status}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        {job.status === 'Submitted' ? (
                          <div className="flex items-center justify-end gap-1 text-success">
                             <span className="material-symbols-outlined text-lg">verified</span>
                             <span className="text-[10px] font-black">SEALED</span>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-[10px] font-bold uppercase">Pending Proof</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

const MetricCard: React.FC<{ label: string, value: string, trend: string, icon: string }> = ({ label, value, trend, icon }) => (
  <div className="bg-slate-900 border border-white/5 p-6 rounded-3xl relative overflow-hidden group shadow-lg">
    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
       <span className="material-symbols-outlined text-5xl">{icon}</span>
    </div>
    <div className="space-y-1">
      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
      <p className="text-3xl font-black text-white">{value}</p>
      <p className="text-[10px] font-bold text-primary flex items-center gap-1">
         {trend}
      </p>
    </div>
  </div>
);

export default AdminDashboard;
