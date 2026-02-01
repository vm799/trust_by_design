/**
 * AdminDashboard - Manager View
 *
 * Primary Question: "Is anyone blocked or falling behind?"
 *
 * Design Principles:
 * - Technician Rows: One row per tech, current job visible, time since last activity
 * - Attention Flags: Idle too long, job started but no activity, done unusually fast
 * - Drill-down only when needed - manager does not live inside jobs
 * - Must NOT have: detailed evidence views, task breakdowns
 * - "Managers manage people, not artefacts"
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Layout from '../components/Layout';
import EmailVerificationBanner from '../components/EmailVerificationBanner';
import OfflineIndicator from '../components/OfflineIndicator';
import { DashboardSkeleton } from '../components/SkeletonLoader';
import UnopenedLinksActionCenter from '../components/UnopenedLinksActionCenter';
import { Job, UserProfile } from '../types';
import { useNavigate } from 'react-router-dom';
import { retryFailedSyncs } from '../lib/syncQueue';
import { useAuth } from '../lib/AuthContext';
import { useData } from '../lib/DataContext';
import { getLinksNeedingAttention, acknowledgeLinkFlag, type MagicLinkInfo } from '../lib/db';
import {
  JOB_STATUS,
  SYNC_STATUS,
  TECHNICIAN_STATUS,
  canTechnicianAcceptJobs,
} from '../lib/constants';

interface AdminDashboardProps {
  jobs: Job[];
  clients?: { id: string; name: string }[];
  technicians?: { id: string; name: string; phone?: string; email?: string; status?: string }[];
  user: UserProfile | null;
  showOnboarding: boolean;
  onCloseOnboarding: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  jobs,
  clients = [],
  technicians = [],
  user,
  showOnboarding,
  onCloseOnboarding
}) => {
  const navigate = useNavigate();
  const { updateJob, deleteJob, refresh } = useData();

  // Loading state with 300ms delay
  const [isLoading, setIsLoading] = useState(true);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadingTimerRef.current = setTimeout(() => setIsLoading(false), 300);
    return () => {
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    };
  }, []);

  // Job categorization
  const activeJobs = useMemo(() => jobs.filter(j => j.status !== JOB_STATUS.SUBMITTED), [jobs]);
  const sealedJobs = useMemo(() => jobs.filter(j => j.status === JOB_STATUS.SUBMITTED), [jobs]);
  const failedJobs = useMemo(() => jobs.filter(j => j.syncStatus === SYNC_STATUS.FAILED), [jobs]);
  const syncIssues = failedJobs.length;

  // Manual sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Email verification
  const { session } = useAuth();
  const emailConfirmedAt = session?.user?.email_confirmed_at || session?.user?.confirmed_at;
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  useEffect(() => {
    setIsEmailVerified(!!emailConfirmedAt);
  }, [emailConfirmedAt]);

  // Links needing attention
  const [linksNeedingAttention, setLinksNeedingAttention] = useState<MagicLinkInfo[]>([]);
  const [showActionCenter, setShowActionCenter] = useState(false);

  const refreshLinksNeedingAttention = useCallback(() => {
    const flaggedLinks = getLinksNeedingAttention();
    const validLinks = flaggedLinks.filter(link => jobs.some(j => j.id === link.job_id));
    setLinksNeedingAttention(validLinks);
  }, [jobs]);

  useEffect(() => {
    refreshLinksNeedingAttention();
    const interval = setInterval(refreshLinksNeedingAttention, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [jobs, refreshLinksNeedingAttention]);

  // TECHNICIAN-CENTRIC DATA: Build technician rows with attention flags
  const technicianRows = useMemo(() => {
    return technicians.map(tech => {
      // Jobs assigned to this tech
      const techJobs = activeJobs.filter(j => j.techId === tech.id);
      const currentJob = techJobs.find(j => j.status === JOB_STATUS.IN_PROGRESS);
      const pendingJobs = techJobs.filter(j => j.status !== JOB_STATUS.IN_PROGRESS);

      // Calculate time since last activity
      const lastActivity = techJobs.reduce((latest, job) => {
        const jobTime = job.lastUpdated || new Date(job.date).getTime();
        return jobTime > latest ? jobTime : latest;
      }, 0);
      const timeSinceActivity = lastActivity ? Date.now() - lastActivity : null;
      const hoursSinceActivity = timeSinceActivity ? Math.floor(timeSinceActivity / (1000 * 60 * 60)) : null;

      // ATTENTION FLAGS
      const attentionFlags: Array<{
        type: 'idle' | 'no_progress' | 'fast_complete' | 'link_unopened' | 'sync_failed';
        label: string;
        severity: 'warning' | 'danger';
      }> = [];

      // Idle too long (no jobs, available status)
      if (techJobs.length === 0 && canTechnicianAcceptJobs(tech.status as typeof TECHNICIAN_STATUS[keyof typeof TECHNICIAN_STATUS])) {
        attentionFlags.push({ type: 'idle', label: 'Idle - No jobs', severity: 'warning' });
      }

      // Job started but no activity for 2+ hours
      if (currentJob && hoursSinceActivity && hoursSinceActivity >= 2 && currentJob.photos.length === 0) {
        attentionFlags.push({ type: 'no_progress', label: `No progress (${hoursSinceActivity}h)`, severity: 'danger' });
      }

      // Link not opened
      const hasUnopenedLink = techJobs.some(j => j.magicLinkToken && !j.technicianLinkOpened);
      if (hasUnopenedLink) {
        attentionFlags.push({ type: 'link_unopened', label: 'Link not opened', severity: 'warning' });
      }

      // Sync failed
      const hasSyncFailed = techJobs.some(j => j.syncStatus === SYNC_STATUS.FAILED);
      if (hasSyncFailed) {
        attentionFlags.push({ type: 'sync_failed', label: 'Sync failed', severity: 'danger' });
      }

      // Operational status
      let operationalStatus: 'in_field' | 'available' | 'off_duty';
      let statusLabel: string;
      let statusColor: string;

      if (currentJob) {
        operationalStatus = 'in_field';
        statusLabel = 'In Field';
        statusColor = 'text-primary';
      } else if (canTechnicianAcceptJobs(tech.status as typeof TECHNICIAN_STATUS[keyof typeof TECHNICIAN_STATUS])) {
        operationalStatus = 'available';
        statusLabel = TECHNICIAN_STATUS.AVAILABLE;
        statusColor = 'text-success';
      } else {
        operationalStatus = 'off_duty';
        statusLabel = TECHNICIAN_STATUS.OFF_DUTY;
        statusColor = 'text-slate-400';
      }

      return {
        tech,
        currentJob,
        pendingJobs,
        attentionFlags,
        operationalStatus,
        statusLabel,
        statusColor,
        hoursSinceActivity,
        hasAttention: attentionFlags.length > 0,
      };
    }).sort((a, b) => {
      // Sort by attention needed first, then by status
      if (a.hasAttention && !b.hasAttention) return -1;
      if (!a.hasAttention && b.hasAttention) return 1;
      if (a.operationalStatus === 'in_field' && b.operationalStatus !== 'in_field') return -1;
      if (a.operationalStatus !== 'in_field' && b.operationalStatus === 'in_field') return 1;
      return 0;
    });
  }, [technicians, activeJobs]);

  // Count technicians needing attention
  const techsNeedingAttention = technicianRows.filter(t => t.hasAttention).length;

  // Handle manual sync
  const handleManualSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      await retryFailedSyncs();
      setSyncMessage('Sync completed. Check job status for results.');
      setTimeout(() => setSyncMessage(null), 5000);
      await refresh(); // Use DataContext refresh instead of page reload
    } catch (error) {
      setSyncMessage('Sync failed. Please check your connection.');
      setTimeout(() => setSyncMessage(null), 5000);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refresh]);

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
      <div className="space-y-6 pb-20 max-w-5xl mx-auto">
        {/* Email Verification Banner */}
        {!isEmailVerified && user && <EmailVerificationBanner user={user} />}

        {/* Offline Indicator */}
        <OfflineIndicator
          syncStatus={{
            pending: jobs.filter(j => j.syncStatus === SYNC_STATUS.PENDING).length,
            failed: syncIssues
          }}
        />

        {/* Header - Minimal, action-focused */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-lg font-bold text-white">Team Status</h1>
            <p className="text-xs text-slate-400">
              {technicians.length} technician{technicians.length !== 1 ? 's' : ''} •{' '}
              {activeJobs.length} active job{activeJobs.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Attention alert */}
            {(techsNeedingAttention > 0 || linksNeedingAttention.length > 0) && (
              <button
                onClick={() => setShowActionCenter(true)}
                className="flex items-center gap-2 px-3 py-2 bg-danger/20 hover:bg-danger/30 border border-danger/40 rounded-xl transition-all"
              >
                <span className="material-symbols-outlined text-danger text-lg animate-pulse">warning</span>
                <span className="text-danger font-bold text-sm">
                  {techsNeedingAttention + linksNeedingAttention.length}
                </span>
              </button>
            )}
            {/* New Job button */}
            <button
              onClick={() => navigate('/admin/create')}
              className="px-6 py-3 bg-primary text-white font-bold rounded-xl text-sm shadow-lg shadow-primary/20 hover:scale-105 transition-all active:scale-95 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              New Job
            </button>
          </div>
        </header>

        {/* Sync message */}
        {syncMessage && (
          <div className="bg-primary/10 border border-primary/20 p-4 rounded-xl">
            <p className="text-primary text-sm font-bold">{syncMessage}</p>
          </div>
        )}

        {/* Sync issues warning */}
        {syncIssues > 0 && (
          <div className="bg-warning/10 border border-warning/20 p-4 rounded-xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-warning text-2xl">sync_problem</span>
              <div>
                <p className="text-white font-bold text-sm">{syncIssues} job{syncIssues > 1 ? 's' : ''} failed to sync</p>
                <p className="text-slate-400 text-xs">Retry to sync pending changes</p>
              </div>
            </div>
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="px-4 py-2 bg-warning/20 hover:bg-warning/30 border border-warning/30 text-warning rounded-lg text-xs font-bold uppercase transition-all disabled:opacity-50"
            >
              {isSyncing ? 'Syncing...' : 'Retry'}
            </button>
          </div>
        )}

        {/* Quick metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard
            label="In Field"
            value={technicianRows.filter(t => t.operationalStatus === 'in_field').length.toString()}
            icon="person_pin"
            color="text-primary"
            onClick={() => navigate('/admin/technicians?status=in_field')}
          />
          <MetricCard
            label="Available"
            value={technicianRows.filter(t => t.operationalStatus === 'available').length.toString()}
            icon="person"
            color="text-success"
            onClick={() => navigate('/admin/technicians?status=available')}
          />
          <MetricCard
            label="Active Jobs"
            value={activeJobs.length.toString()}
            icon="work"
            color="text-slate-300"
            onClick={() => navigate('/admin/jobs?filter=active')}
          />
          <MetricCard
            label="Sealed"
            value={sealedJobs.length.toString()}
            icon="verified"
            color="text-emerald-400"
            onClick={() => navigate('/admin/jobs?filter=sealed')}
          />
        </div>

        {/* TECHNICIAN ROWS - Primary View */}
        {technicians.length === 0 ? (
          <div className="bg-slate-900 border border-white/5 rounded-2xl p-8 text-center">
            <span className="material-symbols-outlined text-5xl text-slate-600 mb-4">group_add</span>
            <h3 className="text-lg font-bold text-white mb-2">No Technicians Yet</h3>
            <p className="text-slate-400 text-sm mb-4">Add technicians to start managing your team</p>
            <button
              onClick={() => navigate('/admin/technicians/new')}
              className="px-6 py-3 bg-primary text-white font-bold rounded-xl text-sm"
            >
              Add Technician
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
              Workforce ({technicians.length})
            </h2>

            {technicianRows.map(row => (
              <TechnicianRow
                key={row.tech.id}
                tech={row.tech}
                currentJob={row.currentJob}
                pendingJobs={row.pendingJobs}
                attentionFlags={row.attentionFlags}
                statusLabel={row.statusLabel}
                statusColor={row.statusColor}
                hoursSinceActivity={row.hoursSinceActivity}
                clients={clients}
                onNavigateToJob={(jobId) => navigate(`/admin/report/${jobId}`)}
                onCallTech={(phone) => window.location.href = `tel:${phone}`}
              />
            ))}
          </div>
        )}

        {/* Jobs link - Secondary navigation */}
        {jobs.length > 0 && (
          <button
            onClick={() => navigate('/admin/jobs')}
            className="w-full flex items-center justify-between p-4 bg-slate-900 border border-white/5 rounded-xl hover:border-white/10 transition-all"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-slate-400">list_alt</span>
              <span className="text-sm text-slate-300">View All Jobs</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-400">{jobs.length}</span>
              <span className="material-symbols-outlined text-slate-500 text-sm">chevron_right</span>
            </div>
          </button>
        )}

        {/* Action Center Modal */}
        <UnopenedLinksActionCenter
          isOpen={showActionCenter}
          onClose={() => setShowActionCenter(false)}
          links={linksNeedingAttention}
          jobs={jobs}
          technicians={technicians}
          clients={clients}
          onUpdateJob={updateJob}
          onDeleteJob={deleteJob}
          onDismissLink={(token) => {
            acknowledgeLinkFlag(token);
            setLinksNeedingAttention(prev => prev.filter(l => l.token !== token));
          }}
          onRefreshLinks={refreshLinksNeedingAttention}
        />
      </div>
    </Layout>
  );
};

/**
 * TechnicianRow - One row per technician showing current status and attention flags
 */
const TechnicianRow = React.memo(({
  tech,
  currentJob,
  pendingJobs,
  attentionFlags,
  statusLabel,
  statusColor,
  hoursSinceActivity,
  clients,
  onNavigateToJob,
  onCallTech,
}: {
  tech: { id: string; name: string; phone?: string; email?: string };
  currentJob: Job | undefined;
  pendingJobs: Job[];
  attentionFlags: Array<{ type: string; label: string; severity: 'warning' | 'danger' }>;
  statusLabel: string;
  statusColor: string;
  hoursSinceActivity: number | null;
  clients: { id: string; name: string }[];
  onNavigateToJob: (jobId: string) => void;
  onCallTech: (phone: string) => void;
}) => {
  const hasAttention = attentionFlags.length > 0;

  return (
    <div className={`bg-slate-900 border rounded-xl p-4 transition-all ${
      hasAttention ? 'border-warning/40' : 'border-white/5 hover:border-white/10'
    }`}>
      <div className="flex items-start gap-4">
        {/* Tech avatar */}
        <div className={`size-12 rounded-xl flex items-center justify-center text-lg font-bold uppercase flex-shrink-0 ${
          hasAttention ? 'bg-warning/20 text-warning' : 'bg-slate-800 text-slate-400'
        }`}>
          {tech.name[0]}
        </div>

        {/* Tech info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-white truncate">{tech.name}</h3>
            <span className={`text-xs font-bold ${statusColor}`}>{statusLabel}</span>
          </div>

          {/* Attention flags */}
          {hasAttention && (
            <div className="flex flex-wrap gap-1 mb-2">
              {attentionFlags.map((flag, i) => (
                <span
                  key={i}
                  className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                    flag.severity === 'danger'
                      ? 'bg-danger/20 text-danger'
                      : 'bg-warning/20 text-warning'
                  }`}
                >
                  {flag.label}
                </span>
              ))}
            </div>
          )}

          {/* Current job */}
          {currentJob ? (
            <button
              onClick={() => onNavigateToJob(currentJob.id)}
              className="flex items-center gap-2 text-left group"
            >
              <span className="material-symbols-outlined text-sm text-primary">play_circle</span>
              <span className="text-sm text-slate-300 group-hover:text-primary truncate">
                {currentJob.title}
              </span>
              {currentJob.photos.length > 0 && (
                <span className="text-[10px] text-emerald-400">
                  {currentJob.photos.length} 📷
                </span>
              )}
            </button>
          ) : pendingJobs.length > 0 ? (
            <p className="text-xs text-slate-500">
              {pendingJobs.length} job{pendingJobs.length !== 1 ? 's' : ''} pending
            </p>
          ) : (
            <p className="text-xs text-slate-500">No jobs assigned</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {hoursSinceActivity !== null && hoursSinceActivity > 0 && (
            <span className="text-[10px] text-slate-500">{hoursSinceActivity}h ago</span>
          )}
          {tech.phone && (
            <button
              onClick={() => onCallTech(tech.phone!)}
              className="size-10 rounded-lg bg-success/10 hover:bg-success/20 flex items-center justify-center transition-all"
              title={`Call ${tech.name}`}
            >
              <span className="material-symbols-outlined text-success text-lg">call</span>
            </button>
          )}
        </div>
      </div>

      {/* Pending jobs list (collapsed) */}
      {pendingJobs.length > 0 && (
        <details className="mt-3 pt-3 border-t border-white/5">
          <summary className="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase tracking-wider cursor-pointer">
            <span className="material-symbols-outlined text-xs">expand_more</span>
            Queued jobs ({pendingJobs.length})
          </summary>
          <div className="space-y-1 mt-2">
            {pendingJobs.slice(0, 3).map(job => {
              const client = clients.find(c => c.id === job.clientId);
              return (
                <button
                  key={job.id}
                  onClick={() => onNavigateToJob(job.id)}
                  className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-300 w-full text-left py-1"
                >
                  <span className="material-symbols-outlined text-xs">schedule</span>
                  <span className="truncate">{job.title}</span>
                  <span className="text-slate-600 truncate">{client?.name}</span>
                </button>
              );
            })}
            {pendingJobs.length > 3 && (
              <p className="text-[10px] text-slate-600 pl-5">+{pendingJobs.length - 3} more</p>
            )}
          </div>
        </details>
      )}
    </div>
  );
});

TechnicianRow.displayName = 'TechnicianRow';

/**
 * MetricCard - Compact metric display
 */
const MetricCard = React.memo(({
  label,
  value,
  icon,
  color,
  onClick
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="bg-slate-900 border border-white/5 p-4 rounded-xl text-left hover:border-white/10 transition-all active:scale-95"
  >
    <div className="flex items-center gap-2 mb-1">
      <span className={`material-symbols-outlined text-sm ${color}`}>{icon}</span>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
    </div>
    <p className={`text-2xl font-bold ${color}`}>{value}</p>
  </button>
));

MetricCard.displayName = 'MetricCard';

export default React.memo(AdminDashboard);
