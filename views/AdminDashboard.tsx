
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { useAuth } from '../lib/AuthContext';

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

  // PERFORMANCE OPTIMIZATION: Memoize job filtering to prevent recalculation on every render
  const activeJobs = useMemo(() => jobs.filter(j => j.status !== 'Submitted'), [jobs]);
  const sealedJobs = useMemo(() => jobs.filter(j => j.status === 'Submitted'), [jobs]);
  const failedJobs = useMemo(() => jobs.filter(j => j.syncStatus === 'failed'), [jobs]);
  const syncIssues = useMemo(() => failedJobs.length, [failedJobs]);
  const pendingSignatures = useMemo(() => activeJobs.filter(j => !j.signature).length, [activeJobs]);

  // PERFORMANCE OPTIMIZATION: Memoize attention items calculation
  const uniqueAttentionJobs = useMemo(() => {
    // ATTENTION REQUIRED: Critical job exceptions
    const jobsAwaitingSeal = activeJobs.filter(j => !j.signature && !j.sealedAt);
    const jobsMissingEvidence = activeJobs.filter(j => j.photos.length === 0);
    const jobsIncompleteChecklist = activeJobs.filter(j => {
      const requiredChecks = j.safetyChecklist.filter(c => c.required);
      const completedRequired = requiredChecks.filter(c => c.checked);
      return requiredChecks.length > 0 && completedRequired.length < requiredChecks.length;
    });

    const attentionItems = [
      ...jobsAwaitingSeal.map(j => ({ job: j, reason: 'awaiting_seal', label: 'Awaiting Seal', icon: 'signature', color: 'warning' as const })),
      ...failedJobs.map(j => ({ job: j, reason: 'sync_failed', label: 'Sync Failed', icon: 'sync_problem', color: 'danger' as const })),
      ...jobsMissingEvidence.map(j => ({ job: j, reason: 'missing_evidence', label: 'No Evidence', icon: 'photo_library', color: 'danger' as const })),
      ...jobsIncompleteChecklist.map(j => ({ job: j, reason: 'incomplete_checklist', label: 'Incomplete Safety', icon: 'shield', color: 'warning' as const })),
    ];

    // Remove duplicates (a job can have multiple issues)
    return Array.from(
      new Map(attentionItems.map(item => [item.job.id, item])).values()
    );
  }, [activeJobs, failedJobs]);

  // PERFORMANCE OPTIMIZATION: Memoize technician status calculation
  const technicianStatus = useMemo(() => {
    return technicians.map(tech => {
      const activeTechJobs = activeJobs.filter(j => j.techId === tech.id);
      const hasActiveJobs = activeTechJobs.length > 0;

      // Determine operational status
      let operationalStatus: 'in_field' | 'available' | 'off_duty' | 'idle';
      let statusLabel: string;
      let statusColor: string;
      let statusIcon: string;

      if (hasActiveJobs) {
        operationalStatus = 'in_field';
        statusLabel = 'In Field';
        statusColor = 'text-primary';
        statusIcon = 'location_on';
      } else if (tech.status === 'Available' || tech.status === 'Authorised') {
        operationalStatus = 'available';
        statusLabel = 'Available';
        statusColor = 'text-success';
        statusIcon = 'check_circle';
      } else if (tech.status === 'Off Duty') {
        operationalStatus = 'off_duty';
        statusLabel = 'Off Duty';
        statusColor = 'text-slate-400';
        statusIcon = 'schedule';
      } else {
        operationalStatus = 'idle';
        statusLabel = 'Idle';
        statusColor = 'text-slate-400';
        statusIcon = 'schedule';
      }

      return {
        tech,
        activeTechJobs,
        hasActiveJobs,
        operationalStatus,
        statusLabel,
        statusColor,
        statusIcon,
      };
    });
  }, [technicians, activeJobs]);

  // State for IndexedDB photo previews
  const [photoDataUrls, setPhotoDataUrls] = useState<Map<string, string>>(new Map());

  // State for manual sync
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // State for onboarding checklist
  const [checklistDismissed, setChecklistDismissed] = useState(() => {
    return localStorage.getItem('jobproof_checklist_dismissed') === 'true';
  });

  // PERFORMANCE FIX: Use AuthContext for email verification check
  const { session } = useAuth();
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  useEffect(() => {
    // PERFORMANCE FIX: Use session from AuthContext instead of getUser()
    if (session?.user) {
      setIsEmailVerified(!!(session.user.email_confirmed_at || session.user.confirmed_at));
    }
  }, [session]);

  // PERFORMANCE OPTIMIZATION: Load photo thumbnails only when jobs change
  // Uses memoized job IDs to prevent unnecessary reloads
  const jobPhotoIds = useMemo(() => {
    return jobs.flatMap(job =>
      job.photos.slice(0, 3).map(p => p.id)
    ).join(',');
  }, [jobs]);

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
  }, [jobPhotoIds, jobs]);

  // PERFORMANCE OPTIMIZATION: Memoize event handlers to prevent child re-renders
  const handleManualSync = useCallback(async () => {
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
  }, [isSyncing]);

  // Retry single job sync
  const handleJobRetry = useCallback(async (job: Job, event: React.MouseEvent) => {
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
  }, []);

  // PERFORMANCE OPTIMIZATION: Memoize onboarding steps to prevent recalculation
  const onboardingSteps: OnboardingStep[] = useMemo(() => [
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
  ], [isEmailVerified, clients.length, technicians.length, jobs.length]);

  const handleDismissChecklist = useCallback(() => {
    localStorage.setItem('jobproof_checklist_dismissed', 'true');
    setChecklistDismissed(true);
  }, []);

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

            {/* ATTENTION REQUIRED PANEL */}
            {uniqueAttentionJobs.length > 0 && (
              <div className="bg-gradient-to-br from-warning/5 to-danger/5 border-2 border-warning/30 rounded-3xl p-6 shadow-2xl animate-in">
                <div className="flex items-center gap-3 mb-4">
                  <div className="size-10 rounded-2xl bg-warning/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-warning text-xl font-black">priority_high</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">Attention Required</h3>
                    <p className="text-xs text-slate-300">{uniqueAttentionJobs.length} job{uniqueAttentionJobs.length > 1 ? 's' : ''} need{uniqueAttentionJobs.length === 1 ? 's' : ''} immediate action</p>
                  </div>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {uniqueAttentionJobs.map(item => (
                    <button
                      key={item.job.id}
                      onClick={() => navigate(`/admin/report/${item.job.id}`)}
                      className="w-full bg-slate-900/80 hover:bg-slate-900 border border-white/10 hover:border-warning/30 rounded-xl p-4 transition-all text-left group flex items-start gap-3"
                    >
                      <div className={`size-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        item.color === 'danger' ? 'bg-danger/20' : 'bg-warning/20'
                      }`}>
                        <span className={`material-symbols-outlined text-sm ${
                          item.color === 'danger' ? 'text-danger' : 'text-warning'
                        }`}>
                          {item.icon}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-black text-white text-sm uppercase tracking-tight truncate group-hover:text-warning transition-colors">
                            {item.job.title}
                          </h4>
                          <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider flex-shrink-0 ${
                            item.color === 'danger'
                              ? 'bg-danger/20 text-danger border border-danger/30'
                              : 'bg-warning/20 text-warning border border-warning/30'
                          }`}>
                            {item.label}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono">{item.job.client} • {item.job.technician}</p>
                      </div>

                      <span className="material-symbols-outlined text-slate-300 text-sm group-hover:text-warning transition-colors flex-shrink-0">
                        arrow_forward
                      </span>
                    </button>
                  ))}
                </div>
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
                color={syncIssues > 0 ? "text-danger" : "text-slate-300"}
              />
            </div>

            {/* WORKFORCE STATUS PANEL */}
            {technicians.length > 0 && (
              <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-xl bg-primary/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary text-lg font-black">groups</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-tight">Workforce Status</h3>
                      <p className="text-[10px] text-slate-400">{technicians.length} technician{technicians.length > 1 ? 's' : ''} registered</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-success">●</span>
                    <span className="text-slate-400 font-medium">{technicianStatus.filter(t => t.operationalStatus === 'available').length} Available</span>
                    <span className="text-primary ml-2">●</span>
                    <span className="text-slate-400 font-medium">{technicianStatus.filter(t => t.operationalStatus === 'in_field').length} In Field</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {technicianStatus.map(({ tech, activeTechJobs, statusLabel, statusColor, statusIcon }) => (
                    <div
                      key={tech.id}
                      className="bg-slate-950/50 border border-white/5 rounded-xl p-4 hover:border-white/10 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className="size-10 rounded-lg bg-slate-800 flex items-center justify-center text-sm font-black text-slate-300 uppercase flex-shrink-0">
                          {tech.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-black text-white truncate">{tech.name}</h4>
                          <div className={`flex items-center gap-1.5 mt-1 ${statusColor}`}>
                            <span className="material-symbols-outlined text-xs font-black">{statusIcon}</span>
                            <span className="text-[10px] font-black uppercase tracking-wider">{statusLabel}</span>
                          </div>
                          {activeTechJobs.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-white/5">
                              <p className="text-[9px] text-slate-400 font-medium mb-1">Active Jobs:</p>
                              {activeTechJobs.slice(0, 2).map(job => (
                                <button
                                  key={job.id}
                                  onClick={() => navigate(`/admin/report/${job.id}`)}
                                  className="block w-full text-left text-[10px] text-slate-300 hover:text-primary transition-colors truncate"
                                >
                                  • {job.title}
                                </button>
                              ))}
                              {activeTechJobs.length > 2 && (
                                <p className="text-[9px] text-slate-500 mt-1">+{activeTechJobs.length - 2} more</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                  <th className="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-white">Service Details</th>
                  <th className="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-white">Field Agent</th>
                  <th className="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-white">Lifecycle Stage</th>
                  <th className="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-white">Evidence</th>
                  <th className="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-white text-right">Integrity</th>
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
                  jobs.map(job => {
                    const lifecycle = getJobLifecycle(job);
                    const isOverdue = isJobOverdue(job);
                    const syncIntegrity = getSyncIntegrityStatus(job);
                    return (
                    <tr key={job.id} className={`hover:bg-white/5 transition-colors cursor-pointer group ${isOverdue ? 'bg-danger/5' : ''}`} onClick={() => navigate(`/admin/report/${job.id}`)}>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                          <div className={`font-black text-base tracking-tighter uppercase group-hover:text-primary transition-colors ${isOverdue ? 'text-danger' : 'text-white'}`}>{job.title}</div>
                          {isOverdue && (
                            <span className="px-2 py-0.5 bg-danger/20 border border-danger/30 text-danger text-[8px] font-black uppercase tracking-widest rounded">OVERDUE</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-300 font-mono mt-1">{job.id} • {job.client}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="size-7 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-400 uppercase">{job.technician[0]}</div>
                          <span className="text-xs text-slate-300 font-bold uppercase">{job.technician}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-tight ${lifecycle.bgColor} ${lifecycle.color} ${lifecycle.borderColor}`}>
                          <span className="material-symbols-outlined text-xs font-black">{lifecycle.icon}</span>
                          {lifecycle.label}
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
                                    <span className="material-symbols-outlined text-[10px] text-slate-400">image</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {job.photos.length > 3 && (
                            <div className="size-6 rounded-md border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-[8px] font-black text-slate-300">
                              +{job.photos.length - 3}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {/* Sync Integrity Indicator */}
                          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-tight ${syncIntegrity.bgColor} ${syncIntegrity.color} ${syncIntegrity.borderColor}`}>
                            <span className={`material-symbols-outlined text-sm font-black ${syncIntegrity.isAnimated ? 'animate-spin' : ''}`}>
                              {syncIntegrity.icon}
                            </span>
                            <span className="text-[11px]">{syncIntegrity.label}</span>
                          </div>
                          {job.syncStatus === 'failed' && (
                            <button
                              onClick={(e) => handleJobRetry(job, e)}
                              className="px-3 py-1.5 bg-danger/10 hover:bg-danger/20 border border-danger/20 text-danger rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
                              title="Retry sync for this job"
                            >
                              <span className="material-symbols-outlined text-sm">refresh</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })
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
 * Job Lifecycle Stage Determination
 * Maps job state to operational spine: DISPATCH → CAPTURE → SEAL → VERIFY → DELIVER
 */
type LifecycleStage = 'dispatched' | 'capture' | 'awaiting_seal' | 'sealed' | 'verified';

interface LifecycleInfo {
  stage: LifecycleStage;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

/**
 * Sync Integrity Status
 * Shows offline vs online status per job/photo with visual indicators
 */
interface SyncIntegrityInfo {
  status: 'online' | 'offline' | 'syncing' | 'failed';
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  isAnimated: boolean;
}

/**
 * Detect if a job is overdue based on scheduled date
 */
const isJobOverdue = (job: Job): boolean => {
  if (!job.date || job.status === 'Submitted') return false;

  const scheduledDate = new Date(job.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Job is overdue if scheduled date is in the past and not archived or in progress
  return scheduledDate < today && job.status !== 'Archived' && job.status !== 'In Progress';
};

/**
 * Get sync integrity status for a job
 */
const getSyncIntegrityStatus = (job: Job): SyncIntegrityInfo => {
  const isOnline = navigator.onLine;

  if (job.syncStatus === 'failed') {
    return {
      status: 'failed',
      label: 'Sync Failed',
      icon: 'sync_problem',
      color: 'text-danger',
      bgColor: 'bg-danger/10',
      borderColor: 'border-danger/20',
      isAnimated: false,
    };
  }

  if (job.syncStatus === 'pending' || job.syncStatus === 'syncing') {
    return {
      status: 'syncing',
      label: isOnline ? 'Syncing' : 'Offline Queue',
      icon: 'sync',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      borderColor: 'border-primary/20',
      isAnimated: true,
    };
  }

  if (job.syncStatus === 'synced') {
    return {
      status: isOnline ? 'online' : 'offline',
      label: isOnline ? 'Cloud Synced' : 'Local Only',
      icon: isOnline ? 'cloud_done' : 'cloud_off',
      color: isOnline ? 'text-success' : 'text-warning',
      bgColor: isOnline ? 'bg-success/10' : 'bg-warning/10',
      borderColor: isOnline ? 'border-success/20' : 'border-warning/20',
      isAnimated: false,
    };
  }

  // Default to synced
  return {
    status: 'online',
    label: 'Synced',
    icon: 'cloud_done',
    color: 'text-success',
    bgColor: 'bg-success/10',
    borderColor: 'border-success/20',
    isAnimated: false,
  };
};

const getJobLifecycle = (job: Job): LifecycleInfo => {
  // VERIFIED: Submitted status (already sealed and verified)
  if (job.status === 'Submitted') {
    return {
      stage: 'verified',
      label: 'Verified',
      icon: 'verified',
      color: 'text-success',
      bgColor: 'bg-success/10',
      borderColor: 'border-success/20',
    };
  }

  // SEALED: Has sealedAt timestamp
  if (job.sealedAt || job.isSealed) {
    return {
      stage: 'sealed',
      label: 'Sealed',
      icon: 'lock',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      borderColor: 'border-primary/20',
    };
  }

  // AWAITING SEAL: Has evidence and signature, ready to seal
  if (job.photos.length > 0 && job.signature) {
    return {
      stage: 'awaiting_seal',
      label: 'Awaiting Seal',
      icon: 'signature',
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      borderColor: 'border-warning/20',
    };
  }

  // CAPTURE: In progress with photos
  if (job.status === 'In Progress' && job.photos.length > 0) {
    return {
      stage: 'capture',
      label: 'Capturing',
      icon: 'photo_camera',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      borderColor: 'border-primary/20',
    };
  }

  // DISPATCHED: Created but not yet started or no evidence
  return {
    stage: 'dispatched',
    label: 'Dispatched',
    icon: 'send',
    color: 'text-slate-400',
    bgColor: 'bg-slate-800',
    borderColor: 'border-slate-700',
  };
};

/**
 * Compact Metric Card - Mobile-First Design
 * Reduced padding and text size for better space efficiency
 */
const CompactMetricCard = ({ label, value, icon, color = "text-white" }: any) => (
  <div className="bg-slate-900 border border-white/5 p-4 rounded-2xl relative overflow-hidden group shadow-lg hover:border-white/10 transition-all">
    <span className={`material-symbols-outlined absolute -top-1 -right-1 text-5xl opacity-5 transition-transform group-hover:scale-110 font-black ${color.replace('text-', 'text-')}`}>{icon}</span>
    <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1.5 relative z-10">{label}</p>
    <p className={`text-2xl sm:text-3xl font-black tracking-tighter ${color} relative z-10`}>{value}</p>
  </div>
);

// PERFORMANCE OPTIMIZATION: Wrap in React.memo to prevent unnecessary re-renders
export default React.memo(AdminDashboard);
