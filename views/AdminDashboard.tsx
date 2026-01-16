
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import OnboardingTour from '../components/OnboardingTour';
import { Job } from '../types';
import { useNavigate } from 'react-router-dom';
import { getMedia } from '../db';

interface AdminDashboardProps {
  jobs: Job[];
  showOnboarding: boolean;
  onCloseOnboarding: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ jobs, showOnboarding, onCloseOnboarding }) => {
  const navigate = useNavigate();
  const activeJobs = jobs.filter(j => j.status !== 'Submitted');
  const sealedJobs = jobs.filter(j => j.status === 'Submitted');
  const syncIssues = jobs.filter(j => j.syncStatus === 'failed').length;
  const pendingSignatures = activeJobs.filter(j => !j.signature).length;

  // State for IndexedDB photo previews
  const [photoDataUrls, setPhotoDataUrls] = useState<Map<string, string>>(new Map());

  // Load photo thumbnails from IndexedDB
  useEffect(() => {
    const loadPhotoThumbnails = async () => {
      const loadedUrls = new Map<string, string>();

      for (const job of jobs) {
        for (const photo of job.photos.slice(0, 3)) { // Only load first 3 for previews
          if (photo.isIndexedDBRef && !loadedUrls.has(photo.id)) {
            try {
              const dataUrl = await getMedia(photo.url);
              if (dataUrl) {
                loadedUrls.set(photo.id, dataUrl);
              }
            } catch (error) {
              console.error('Failed to load photo thumbnail:', error);
            }
          }
        }
      }

      setPhotoDataUrls(loadedUrls);
    };

    if (jobs.length > 0) {
      loadPhotoThumbnails();
    }
  }, [jobs]);

  return (
    <Layout>
      {showOnboarding && <OnboardingTour onComplete={onCloseOnboarding} />}
      <div className="space-y-8 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard label="Active Protocols" value={activeJobs.length.toString()} icon="send" trend="Live Field Work" />
          <MetricCard label="Awaiting Seal" value={pendingSignatures.toString()} icon="signature" trend="Pending Signatures" color="text-warning" />
          <MetricCard label="Sealed Proofs" value={sealedJobs.length.toString()} icon="verified" trend="Validated Reports" color="text-success" />
          <MetricCard label="Sync Issues" value={syncIssues.toString()} icon="sync_problem" trend="Require Attention" color={syncIssues > 0 ? "text-danger" : "text-slate-500"} />
        </div>

        <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
          <div className="px-8 py-6 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Operations Hub Log</h3>
            <button className="text-[8px] font-black uppercase tracking-widest text-primary border border-primary/20 px-3 py-1 rounded-full hover:bg-primary/5 transition-all">Filter Activity</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-950/50">
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Service Details</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Field Agent</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Status</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Evidence</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Hub Sync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-24 text-center opacity-30">
                      <div className="flex flex-col items-center gap-3">
                        <span className="material-symbols-outlined text-4xl">inbox</span>
                        <p className="text-[10px] font-black uppercase tracking-widest">Registry is Empty</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  jobs.map(job => (
                    <tr key={job.id} className="hover:bg-white/5 transition-colors cursor-pointer group" onClick={() => navigate(`/admin/report/${job.id}`)}>
                      <td className="px-8 py-6">
                        <div className="font-bold text-white tracking-tighter uppercase group-hover:text-primary transition-colors">{job.title}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-1">{job.id} • {job.client}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                           <div className="size-7 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-400 uppercase">{job.technician[0]}</div>
                           <span className="text-xs text-slate-300 font-bold uppercase">{job.technician}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-tight ${
                          job.status === 'Submitted' ? 'bg-success/10 text-success border-success/20' : 
                          job.status === 'In Progress' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-slate-800 text-slate-500 border-slate-700'
                        }`}>
                          {job.status}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                         <div className="flex -space-x-2">
                           {job.photos.slice(0, 3).map((p, i) => {
                             const displayUrl = p.isIndexedDBRef ? (photoDataUrls.get(p.id) || '') : p.url;
                             return (
                               <div key={i} className="size-6 rounded-md border-2 border-slate-900 overflow-hidden bg-slate-800">
                                 {displayUrl ? (
                                   <img src={displayUrl} className="w-full h-full object-cover grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all" alt="Evidence" />
                                 ) : (
                                   <div className="w-full h-full flex items-center justify-center">
                                     <span className="material-symbols-outlined text-[10px] text-slate-600">image</span>
                                   </div>
                                 )}
                               </div>
                             );
                           })}
                           {job.photos.length > 3 && (
                             <div className="size-6 rounded-md border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-[8px] font-black text-slate-500">
                               +{job.photos.length - 3}
                             </div>
                           )}
                         </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className={`inline-flex items-center gap-1.5 ${job.syncStatus === 'synced' ? 'text-success' : job.syncStatus === 'failed' ? 'text-danger' : 'text-primary'}`}>
                          <span className={`material-symbols-outlined text-sm font-black ${job.syncStatus === 'pending' ? 'animate-spin' : ''}`}>
                            {job.syncStatus === 'synced' ? 'cloud_done' : job.syncStatus === 'failed' ? 'sync_problem' : 'sync'}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-widest">{job.syncStatus}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
};

const MetricCard = ({ label, value, icon, trend, color = "text-white" }: any) => (
  <div className="bg-slate-900 border border-white/5 p-8 rounded-[2.5rem] space-y-2 relative overflow-hidden group shadow-lg">
    <span className="material-symbols-outlined absolute -top-2 -right-2 text-primary/5 text-7xl transition-transform group-hover:scale-110 font-black">{icon}</span>
    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
    <p className={`text-4xl font-black tracking-tighter ${color}`}>{value}</p>
    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{trend}</p>
  </div>
);

export default AdminDashboard;
