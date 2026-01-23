
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Layout from '../components/Layout';
import EmailVerificationBanner from '../components/EmailVerificationBanner';
import JobCard from '../components/JobCard';
import OfflineIndicator from '../components/OfflineIndicator';
import EmptyState from '../components/EmptyState';
import { DashboardSkeleton } from '../components/SkeletonLoader';
import { Job, UserProfile } from '../types';
import { useNavigate } from 'react-router-dom';
import { getMedia } from '../db';
import { retryFailedSyncs, syncJobToSupabase } from '../lib/syncQueue';
import { getSupabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { getLinksNeedingAttention, acknowledgeLinkFlag, getTechJobNotifications, markTechNotificationRead, actionTechNotification, type MagicLinkInfo, type TechJobNotification } from '../lib/db';

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

  // Loading state with 300ms delay to prevent flash of skeleton on fast loads
  const [isLoading, setIsLoading] = useState(true);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Set minimum loading time of 300ms to prevent flash
    loadingTimerRef.current = setTimeout(() => {
      setIsLoading(false);
    }, 300);

    return () => {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
      }
    };
  }, []);

  // PERFORMANCE OPTIMIZATION: Memoize job filtering to prevent recalculation on every render
  const activeJobs = useMemo(() => jobs.filter(j => j.status !== 'Submitted'), [jobs]);
  const sealedJobs = useMemo(() => jobs.filter(j => j.status === 'Submitted'), [jobs]);
  const failedJobs = useMemo(() => jobs.filter(j => j.syncStatus === 'failed'), [jobs]);
  const urgentJobs = useMemo(() => jobs.filter(j => j.priority === 'urgent'), [jobs]);

  // Sort jobs with urgent jobs first, then by lastUpdated (most recent first)
  const sortedJobs = useMemo(() => {
    return [...jobs].sort((a, b) => {
      // Urgent jobs come first
      const aUrgent = a.priority === 'urgent' ? 1 : 0;
      const bUrgent = b.priority === 'urgent' ? 1 : 0;
      if (bUrgent !== aUrgent) return bUrgent - aUrgent;
      // Then by lastUpdated (most recent first)
      return (b.lastUpdated || 0) - (a.lastUpdated || 0);
    });
  }, [jobs]);
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

    // Add urgent jobs that need immediate attention
    const urgentActiveJobs = activeJobs.filter(j => j.priority === 'urgent');

    const attentionItems = [
      ...urgentActiveJobs.map(j => ({ job: j, reason: 'urgent', label: 'Urgent', icon: 'priority_high', color: 'danger' as const })),
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

  // PERFORMANCE FIX: Use AuthContext for email verification check
  const { session } = useAuth();

  // CRITICAL FIX: Extract primitive value to prevent re-renders on token refresh
  // The session object changes reference every 10-50 minutes on token refresh
  // Using a primitive (string | undefined) only triggers effect on actual change
  const emailConfirmedAt = session?.user?.email_confirmed_at || session?.user?.confirmed_at;

  const [isEmailVerified, setIsEmailVerified] = useState(false);
  useEffect(() => {
    setIsEmailVerified(!!emailConfirmedAt);
  }, [emailConfirmedAt]); // Primitive dependency, not object

  // State for links needing attention (unopened for 2+ hours)
  const [linksNeedingAttention, setLinksNeedingAttention] = useState<MagicLinkInfo[]>([]);

  // State for technician-created job notifications
  const [techNotifications, setTechNotifications] = useState<TechJobNotification[]>([]);

  // Check for unopened links periodically
  useEffect(() => {
    const checkUnopenedLinks = () => {
      const flaggedLinks = getLinksNeedingAttention();
      setLinksNeedingAttention(flaggedLinks);
    };

    // Check immediately
    checkUnopenedLinks();

    // Check every 5 minutes
    const interval = setInterval(checkUnopenedLinks, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [jobs]); // Re-check when jobs change

  // Load technician-created job notifications
  useEffect(() => {
    const workspaceId = user?.workspace?.id || 'local';
    const notifications = getTechJobNotifications(workspaceId, false);
    setTechNotifications(notifications);
  }, [user?.workspace?.id, jobs]); // Re-check when jobs change

  // Handle tech notification actions
  const handleTechNotificationAction = useCallback((notificationId: string, action: 'approved' | 'rejected' | 'reassigned') => {
    const managerEmail = user?.email || 'Manager';
    actionTechNotification(notificationId, action, managerEmail);
    setTechNotifications(prev => prev.filter(n => n.id !== notificationId));
  }, [user?.email]);

  const handleTechNotificationDismiss = useCallback((notificationId: string) => {
    markTechNotificationRead(notificationId);
    setTechNotifications(prev => prev.filter(n => n.id !== notificationId));
  }, []);

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

  // Show skeleton while loading
  if (isLoading) {
    return (
      <Layout user={user}>
        <div className="pb-20">
          <DashboardSkeleton />
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user}>
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

        {/* Header with Sticky CTA */}
            <div className="lg:sticky lg:top-0 lg:z-10 lg:bg-slate-950/80 lg:backdrop-blur-sm lg:pb-4 lg:-mt-2 lg:pt-2">
              <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div className="space-y-1">
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tighter uppercase">Operations Hub</h2>
                  <p className="text-slate-400 text-sm">Verifiable field evidence management.</p>
                </div>
                <button
                  id="btn-dispatch"
                  onClick={() => navigate('/admin/create')}
                  className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-primary text-white font-black rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-primary/20 hover:scale-105 transition-all active:scale-95 press-spring flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined font-black">send</span>
                  New Job
                </button>
              </header>
            </div>

        {/* Sync message notification */}
        {syncMessage && (
          <div className="bg-primary/10 border border-primary/20 p-4 rounded-2xl animate-in">
            <p className="text-primary text-sm font-bold">{syncMessage}</p>
          </div>
        )}

        {/* Sync issues warning - Mobile optimized */}
        {syncIssues > 0 && (
          <div className="bg-warning/10 border border-warning/20 p-4 sm:p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in">
            <div className="flex items-center gap-3 sm:gap-4">
              <span className="material-symbols-outlined text-warning text-2xl sm:text-3xl flex-shrink-0">sync_problem</span>
              <div>
                <p className="text-white font-bold text-sm sm:text-base">{syncIssues} job{syncIssues > 1 ? 's' : ''} failed to sync</p>
                <p className="text-slate-400 text-xs sm:text-sm">Click "Retry Sync" to attempt synchronization again.</p>
              </div>
            </div>
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="w-full sm:w-auto px-6 py-3 bg-warning/20 hover:bg-warning/30 border border-warning/30 text-warning rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span className={`material-symbols-outlined text-sm ${isSyncing ? 'animate-spin' : ''}`}>
                {isSyncing ? 'sync' : 'refresh'}
              </span>
              {isSyncing ? 'Syncing...' : 'Retry Sync'}
            </button>
          </div>
        )}

            {/* UNOPENED LINK ALERTS - Mobile optimized */}
            {linksNeedingAttention.length > 0 && (
              <div className="bg-gradient-to-br from-warning/10 to-orange-500/10 border-2 border-warning/40 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl animate-in">
                <div className="flex items-center gap-3 mb-4">
                  <div className="size-8 sm:size-10 rounded-xl sm:rounded-2xl bg-warning/20 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-warning text-lg sm:text-xl font-black animate-pulse">notifications_active</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight truncate">Technician Links Unopened</h3>
                    <p className="text-[10px] sm:text-xs text-slate-300">{linksNeedingAttention.length} link{linksNeedingAttention.length > 1 ? 's' : ''} not accessed after 2+ hours</p>
                  </div>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {linksNeedingAttention.map(link => {
                    const linkedJob = jobs.find(j => j.id === link.job_id);
                    if (!linkedJob) return null;

                    const sentAge = link.sent_at
                      ? Math.floor((Date.now() - new Date(link.sent_at).getTime()) / (1000 * 60 * 60))
                      : 0;
                    const isUrgent = sentAge >= 4;

                    return (
                      <div
                        key={link.token}
                        className={`bg-slate-900/80 border rounded-xl p-3 sm:p-4 transition-all ${
                          isUrgent ? 'border-danger/40' : 'border-warning/30'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`material-symbols-outlined text-xs ${isUrgent ? 'text-danger' : 'text-warning'}`}>
                                schedule
                              </span>
                              <span className={`text-[10px] font-black uppercase tracking-widest ${isUrgent ? 'text-danger' : 'text-warning'}`}>
                                {sentAge}h since sent {isUrgent ? '- URGENT' : ''}
                              </span>
                            </div>
                            <h4 className="font-black text-white text-sm uppercase tracking-tight truncate">
                              {linkedJob.title}
                            </h4>
                            <p className="text-[10px] text-slate-400 mt-1">
                              Tech: <span className="text-slate-300 font-bold">{linkedJob.technician}</span>
                              {link.sent_via && (
                                <span className="ml-2 text-slate-500">via {link.sent_via}</span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-start">
                            <button
                              onClick={() => navigate(`/admin/report/${link.job_id}`)}
                              className="flex-1 sm:flex-none px-3 py-2 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
                            >
                              View
                            </button>
                            <button
                              onClick={() => {
                                acknowledgeLinkFlag(link.token);
                                setLinksNeedingAttention(prev => prev.filter(l => l.token !== link.token));
                              }}
                              className="px-2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-all"
                              title="Dismiss alert"
                            >
                              <span className="material-symbols-outlined text-xs">close</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 pt-3 border-t border-white/5">
                  <p className="text-[10px] text-slate-400 italic">
                    Consider calling technicians directly if links remain unopened
                  </p>
                </div>
              </div>
            )}

            {/* TECHNICIAN-CREATED JOBS NOTIFICATIONS - Mobile optimized */}
            {techNotifications.length > 0 && (
              <div className="bg-gradient-to-br from-primary/10 to-blue-500/10 border-2 border-primary/40 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl animate-in">
                <div className="flex items-center gap-3 mb-4">
                  <div className="size-8 sm:size-10 rounded-xl sm:rounded-2xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-primary text-lg sm:text-xl font-black">person_add</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight truncate">Technician-Created Jobs</h3>
                    <p className="text-[10px] sm:text-xs text-slate-300">{techNotifications.length} job{techNotifications.length > 1 ? 's' : ''} created by field technicians</p>
                  </div>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {techNotifications.map(notification => {
                    const linkedJob = jobs.find(j => j.id === notification.job_id);
                    const createdAgo = Math.floor((Date.now() - new Date(notification.created_at).getTime()) / (1000 * 60));
                    const createdAgoText = createdAgo < 60
                      ? `${createdAgo}m ago`
                      : createdAgo < 1440
                        ? `${Math.floor(createdAgo / 60)}h ago`
                        : `${Math.floor(createdAgo / 1440)}d ago`;

                    return (
                      <div
                        key={notification.id}
                        className="bg-slate-900/80 border border-primary/30 rounded-xl p-3 sm:p-4 transition-all"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`material-symbols-outlined text-xs ${
                                notification.type === 'tech_job_completed' ? 'text-success' : 'text-primary'
                              }`}>
                                {notification.type === 'tech_job_completed' ? 'check_circle' : 'add_circle'}
                              </span>
                              <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                                {notification.type === 'tech_job_completed' ? 'Completed' : 'New Job'} - {createdAgoText}
                              </span>
                            </div>
                            <h4 className="font-black text-white text-sm uppercase tracking-tight truncate">
                              {notification.title}
                            </h4>
                            <p className="text-[10px] text-slate-400 mt-1">
                              By: <span className="text-slate-300 font-bold">{notification.created_by_tech_name}</span>
                            </p>
                            <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                              {notification.message}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0 self-end sm:self-start">
                            {linkedJob && (
                              <button
                                onClick={() => navigate(`/admin/report/${notification.job_id}`)}
                                className="flex-1 sm:flex-none px-3 py-2 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
                              >
                                View
                              </button>
                            )}
                            <button
                              onClick={() => handleTechNotificationAction(notification.id, 'approved')}
                              className="px-2 py-2 bg-success/20 hover:bg-success/30 text-success border border-success/30 rounded-lg transition-all"
                              title="Approve"
                            >
                              <span className="material-symbols-outlined text-xs">check</span>
                            </button>
                            <button
                              onClick={() => handleTechNotificationDismiss(notification.id)}
                              className="px-2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-all"
                              title="Dismiss"
                            >
                              <span className="material-symbols-outlined text-xs">close</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 pt-3 border-t border-white/5">
                  <p className="text-[10px] text-slate-400 italic">
                    Review and approve technician-created jobs for proper tracking
                  </p>
                </div>
              </div>
            )}

            {/* ATTENTION REQUIRED PANEL - Mobile optimized */}
            {uniqueAttentionJobs.length > 0 && (
              <div className="bg-gradient-to-br from-warning/5 to-danger/5 border-2 border-warning/30 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl animate-in">
                <div className="flex items-center gap-3 mb-4">
                  <div className="size-8 sm:size-10 rounded-xl sm:rounded-2xl bg-warning/20 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-warning text-lg sm:text-xl font-black">priority_high</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight">Attention Required</h3>
                    <p className="text-[10px] sm:text-xs text-slate-300">{uniqueAttentionJobs.length} job{uniqueAttentionJobs.length > 1 ? 's' : ''} need{uniqueAttentionJobs.length === 1 ? 's' : ''} immediate action</p>
                  </div>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {uniqueAttentionJobs.map(item => (
                    <button
                      key={item.job.id}
                      onClick={() => navigate(`/admin/report/${item.job.id}`)}
                      className="w-full bg-slate-900/80 hover:bg-slate-900 border border-white/10 hover:border-warning/30 rounded-xl p-4 transition-all text-left group flex items-start gap-3 hover-lift press-spring"
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

            {/* Compact Metrics - Mobile First - All Clickable */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <CompactMetricCard
                label="Active"
                value={activeJobs.length.toString()}
                icon="send"
                color="text-primary"
                onClick={() => navigate('/admin/jobs?filter=active')}
              />
              <CompactMetricCard
                label="Awaiting Seal"
                value={pendingSignatures.toString()}
                icon="signature"
                color="text-warning"
                onClick={() => navigate('/admin/jobs?filter=awaiting_seal')}
              />
              <CompactMetricCard
                label="Sealed"
                value={sealedJobs.length.toString()}
                icon="verified"
                color="text-success"
                onClick={() => navigate('/admin/jobs?filter=sealed')}
              />
              <CompactMetricCard
                label="Sync Issues"
                value={syncIssues.toString()}
                icon="sync_problem"
                color={syncIssues > 0 ? "text-danger" : "text-slate-300"}
                onClick={() => navigate('/admin/jobs?filter=sync_issues')}
              />
            </div>

            {/* WORKFORCE STATUS PANEL - Mobile optimized */}
            {technicians.length > 0 && (
              <div className="bg-slate-900 border border-white/5 rounded-2xl p-4 sm:p-6 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-primary text-lg font-black">groups</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-tight">Workforce Status</h3>
                      <p className="text-[10px] text-slate-400">{technicians.length} technician{technicians.length > 1 ? 's' : ''} registered</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] ml-11 sm:ml-0">
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
            {sortedJobs.length > 0 && (
              <div className="lg:hidden space-y-3">
                {sortedJobs.map(job => (
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
                {sortedJobs.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState
                        icon="rocket_launch"
                        title="No Jobs Yet"
                        description="Create your first job to start capturing verifiable evidence."
                        actionLabel="Create First Job"
                        actionLink="/admin/create"
                      />
                    </td>
                  </tr>
                ) : (
                  sortedJobs.map(job => {
                    const lifecycle = getJobLifecycle(job);
                    const isOverdue = isJobOverdue(job);
                    const syncIntegrity = getSyncIntegrityStatus(job);
                    const isUrgent = job.priority === 'urgent';
                    return (
                    <tr key={job.id} className={`hover:bg-white/5 transition-colors cursor-pointer group ${isUrgent ? 'bg-danger/5 border-l-4 border-l-danger' : isOverdue ? 'bg-danger/5' : ''}`} onClick={() => navigate(`/admin/report/${job.id}`)}>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                          {isUrgent && (
                            <span className="material-symbols-outlined text-danger text-sm animate-pulse">priority_high</span>
                          )}
                          <div className={`font-black text-base tracking-tighter uppercase group-hover:text-primary transition-colors ${isUrgent ? 'text-danger' : isOverdue ? 'text-danger' : 'text-white'}`}>{job.title}</div>
                          {isUrgent && (
                            <span className="px-2 py-0.5 bg-danger/20 border border-danger/30 text-danger text-[8px] font-black uppercase tracking-widest rounded">URGENT</span>
                          )}
                          {isOverdue && !isUrgent && (
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
 * Now clickable with navigation support
 */
const CompactMetricCard = ({ label, value, icon, color = "text-white", onClick }: { label: string; value: string; icon: string; color?: string; onClick?: () => void }) => (
  <button
    onClick={onClick}
    className="bg-slate-900 border border-white/5 p-4 rounded-2xl relative overflow-hidden group shadow-lg hover:border-white/10 hover:bg-slate-800/50 transition-all text-left w-full active:scale-95 press-spring hover-lift cursor-pointer"
  >
    <span className={`material-symbols-outlined absolute -top-1 -right-1 text-5xl opacity-5 transition-transform group-hover:scale-110 font-black ${color.replace('text-', 'text-')}`}>{icon}</span>
    <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1.5 relative z-10">{label}</p>
    <p className={`text-2xl sm:text-3xl font-black tracking-tighter ${color} relative z-10`}>{value}</p>
    <span className="material-symbols-outlined absolute bottom-2 right-2 text-sm text-slate-600 group-hover:text-slate-400 transition-colors">arrow_forward</span>
  </button>
);

// PERFORMANCE OPTIMIZATION: Wrap in React.memo to prevent unnecessary re-renders
export default React.memo(AdminDashboard);
