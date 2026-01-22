
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import OnboardingTour from '../components/OnboardingTour';
import OnboardingChecklist, { OnboardingStep } from '../components/OnboardingChecklist';
import EmailVerificationBanner from '../components/EmailVerificationBanner';
import JobCard from '../components/JobCard';
import OfflineIndicator from '../components/OfflineIndicator';
import { Job, UserProfile } from '../types';
import { useNavigate } from 'react-router-dom';
import { getMedia } from '../db';
import { retryFailedSyncs, syncJobToSupabase } from '../lib/syncQueue';
import { getSupabase } from '../lib/supabase';

interface AdminDashboardProps {
  jobs: Job[];
  clients?: any[]; // Phase C.2: Added specific types if possible, but any[] is fine for count
  technicians?: any[];
  user: UserProfile | null;
  showOnboarding: boolean;
  onCloseOnboarding: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ jobs, clients = [], technicians = [], user, showOnboarding, onCloseOnboarding }) => {
  const navigate = useNavigate();
  const activeJobs = jobs.filter(j => j.status !== 'Submitted');
  const sealedJobs = jobs.filter(j => j.status === 'Submitted');
  const syncIssues = jobs.filter(j => j.syncStatus === 'failed').length;
  const failedJobs = jobs.filter(j => j.syncStatus === 'failed');
  const pendingSignatures = activeJobs.filter(j => !j.signature).length;

  // State for IndexedDB photo previews
  const [photoDataUrls, setPhotoDataUrls] = useState<Map<string, string>>(new Map());

  // State for manual sync
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // State for onboarding checklist
  const [checklistDismissed, setChecklistDismissed] = useState(() => {
    return localStorage.getItem('jobproof_checklist_dismissed') === 'true';
  });

  // Check email verification status
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  useEffect(() => {
    const checkEmailVerification = async () => {
      const supabase = getSupabase();
      if (!supabase) return;

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        setIsEmailVerified(!!(authUser.email_confirmed_at || authUser.confirmed_at));
      }
    };
    checkEmailVerification();
  }, [user]);

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

  // Manual sync handler
  const handleManualSync = async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    setSyncMessage(null);

    try {
      await retryFailedSyncs();
      setSyncMessage('Sync completed. Check job status for results.');
      setTimeout(() => setSyncMessage(null), 5000);
      // Reload page to show updated sync status
      window.location.reload();
    } catch (error) {
      console.error('Manual sync failed:', error);
      setSyncMessage('Sync failed. Please check your connection.');
      setTimeout(() => setSyncMessage(null), 5000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Retry single job sync
  const handleJobRetry = async (job: Job, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent navigation to job report

    try {
      const success = await syncJobToSupabase(job);
      if (success) {
        setSyncMessage(`Job "${job.title}" synced successfully!`);
        setTimeout(() => setSyncMessage(null), 3000);
        window.location.reload();
      } else {
        setSyncMessage(`Failed to sync job "${job.title}". Please try again.`);
        setTimeout(() => setSyncMessage(null), 5000);
      }
    } catch (error) {
      console.error('Job retry failed:', error);
      setSyncMessage(`Error syncing job "${job.title}".`);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  // Onboarding checklist steps
  const onboardingSteps: OnboardingStep[] = [
    {
      id: 'verify-email',
      label: 'Verify Email',
      description: 'Confirm your email address',
      status: isEmailVerified ? 'completed' : 'in_progress',
      icon: 'mail',
    },
    {
      id: 'add-client',
      label: 'Add First Client',
      description: 'Register a customer',
      status: clients.length > 0 ? 'completed' : isEmailVerified ? 'in_progress' : 'locked',
      icon: 'person_add',
      path: '/admin/clients'
    },
    {
      id: 'add-tech',
      label: 'Add Technician',
      description: 'Authorize a field agent',
      status: technicians.length > 0 ? 'completed' : (clients.length > 0 ? 'in_progress' : 'locked'),
      icon: 'engineering',
      path: '/admin/technicians'
    },
    {
      id: 'dispatch-job',
      label: 'Dispatch First Job',
      description: 'Create your first protocol',
      status: jobs.length > 0 ? 'completed' : (technicians.length > 0 && clients.length > 0 ? 'in_progress' : 'locked'),
      icon: 'send',
      path: '/admin/create'
    }
  ];

  const handleDismissChecklist = () => {
    localStorage.setItem('jobproof_checklist_dismissed', 'true');
    setChecklistDismissed(true);
  };

  return (
    <Layout user={user}>
      {showOnboarding && (
        <OnboardingTour
          onComplete={onCloseOnboarding}
          persona={user?.persona}
          counts={{ clients: clients.length, techs: technicians.length, jobs: jobs.length }}
        />
      )}
      <div className="space-y-6 pb-20">
        {/* Email Verification Banner */}
        {!isEmailVerified && user && (
          <EmailVerificationBanner user={user} />
        )}

        {/* Offline Indicator */}
        <OfflineIndicator
          syncStatus={{
            pending: jobs.filter(j => j.syncStatus === 'pending').length,
            failed: syncIssues
          }}
        />

        {/* Mobile Onboarding Checklist - BEFORE grid to prevent overlap */}
        {!checklistDismissed && (
          <div className="lg:hidden">
            <OnboardingChecklist
              steps={onboardingSteps}
              onDismiss={handleDismissChecklist}
              user={user}
            />
          </div>
        )}

        {/* Main Content Grid - Sidebar + Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Onboarding Checklist (Desktop) */}
          <aside className="hidden lg:block">
            {!checklistDismissed && (
              <OnboardingChecklist
                steps={onboardingSteps}
                onDismiss={handleDismissChecklist}
                user={user}
              />
            )}
          </aside>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Header with Sticky CTA (sticky only on desktop to prevent mobile overlap) */}
            <div className="lg:sticky lg:top-0 lg:z-10 lg:bg-slate-950/80 lg:backdrop-blur-sm lg:pb-4 lg:-mt-2 lg:pt-2">
              <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div className="space-y-1">
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tighter uppercase">Operations Hub</h2>
                  <p className="text-slate-400 text-sm">Verifiable field evidence management.</p>
                </div>
                <button
                  id="btn-dispatch"
                  onClick={() => navigate('/admin/create')}
                  className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-primary text-white font-black rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-primary/20 hover:scale-105 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined font-black">send</span>
                  Initialize Dispatch
                </button>
              </header>
            </div>

        {/* Sync message notification */}
        {syncMessage && (
          <div className="bg-primary/10 border border-primary/20 p-4 rounded-2xl animate-in">
            <p className="text-primary text-sm font-bold">{syncMessage}</p>
          </div>
        )}

        {/* Sync issues warning */}
        {syncIssues > 0 && (
          <div className="bg-warning/10 border border-warning/20 p-6 rounded-2xl flex items-center justify-between animate-in">
            <div className="flex items-center gap-4">
              <span className="material-symbols-outlined text-warning text-3xl">sync_problem</span>
              <div>
                <p className="text-white font-bold">{syncIssues} job{syncIssues > 1 ? 's' : ''} failed to sync</p>
                <p className="text-slate-400 text-sm">Click "Retry Sync" to attempt synchronization again.</p>
              </div>
            </div>
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="px-6 py-3 bg-warning/20 hover:bg-warning/30 border border-warning/30 text-warning rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <span className={`material-symbols-outlined text-sm ${isSyncing ? 'animate-spin' : ''}`}>
                {isSyncing ? 'sync' : 'refresh'}
              </span>
              {isSyncing ? 'Syncing...' : 'Retry Sync'}
            </button>
          </div>
        )}

            {/* Compact Metrics - Mobile First */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <CompactMetricCard
                label="Active"
                value={activeJobs.length.toString()}
                icon="send"
                color="text-primary"
              />
              <CompactMetricCard
                label="Awaiting Seal"
                value={pendingSignatures.toString()}
                icon="signature"
                color="text-warning"
              />
              <CompactMetricCard
                label="Sealed"
                value={sealedJobs.length.toString()}
                icon="verified"
                color="text-success"
              />
              <CompactMetricCard
                label="Sync Issues"
                value={syncIssues.toString()}
                icon="sync_problem"
                color={syncIssues > 0 ? "text-danger" : "text-slate-500"}
              />
            </div>

            {/* Mobile Job Cards (shown on mobile, hidden on desktop) */}
            {jobs.length > 0 && (
              <div className="lg:hidden space-y-3">
                {jobs.map(job => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onClick={() => navigate(`/admin/report/${job.id}`)}
                    onRetry={handleJobRetry}
                    photoDataUrls={photoDataUrls}
                  />
                ))}
              </div>
            )}

            {/* Desktop Table (hidden on mobile) */}
            <div className="hidden lg:block bg-slate-900 border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
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
                    <td colSpan={5} className="py-24 text-center">
                      <div className="max-w-md mx-auto space-y-8 animate-in">
                        <div className="bg-primary/10 size-20 rounded-[2rem] flex items-center justify-center mx-auto border border-primary/20">
                          <span className="material-symbols-outlined text-primary text-4xl">rocket_launch</span>
                        </div>
                        <div className="space-y-4">
                          <h4 className="text-2xl font-black text-white uppercase tracking-tighter">Your Hub is Ready</h4>
                          <p className="text-slate-400 text-sm font-medium">Start by completing the onboarding checklist to initialise your operations.</p>
                        </div>
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
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-tight ${job.status === 'Submitted' ? 'bg-success/10 text-success border-success/20' :
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
                        <div className="flex items-center justify-end gap-2">
                          <div className={`inline-flex items-center gap-1.5 ${job.syncStatus === 'synced' ? 'text-success' : job.syncStatus === 'failed' ? 'text-danger' : 'text-primary'}`}>
                            <span className={`material-symbols-outlined text-sm font-black ${job.syncStatus === 'pending' ? 'animate-spin' : ''}`}>
                              {job.syncStatus === 'synced' ? 'cloud_done' : job.syncStatus === 'failed' ? 'sync_problem' : 'sync'}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-widest">{job.syncStatus}</span>
                          </div>
                          {job.syncStatus === 'failed' && (
                            <button
                              onClick={(e) => handleJobRetry(job, e)}
                              className="px-2 py-1 bg-danger/10 hover:bg-danger/20 border border-danger/20 text-danger rounded-lg text-[8px] font-black uppercase tracking-widest transition-all"
                              title="Retry sync for this job"
                            >
                              <span className="material-symbols-outlined text-xs">refresh</span>
                            </button>
                          )}
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
    </div>
  </div>
    </Layout>
  );
};

/**
 * Compact Metric Card - Mobile-First Design
 * Reduced padding and text size for better space efficiency
 */
const CompactMetricCard = ({ label, value, icon, color = "text-white" }: any) => (
  <div className="bg-slate-900 border border-white/5 p-4 rounded-2xl relative overflow-hidden group shadow-lg hover:border-white/10 transition-all">
    <span className={`material-symbols-outlined absolute -top-1 -right-1 text-5xl opacity-5 transition-transform group-hover:scale-110 font-black ${color.replace('text-', 'text-')}`}>{icon}</span>
    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 relative z-10">{label}</p>
    <p className={`text-2xl sm:text-3xl font-black tracking-tighter ${color} relative z-10`}>{value}</p>
  </div>
);

export default AdminDashboard;
