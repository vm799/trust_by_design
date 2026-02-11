/**
 * AdminDashboard - Manager View
 *
 * Primary Question: "Is anyone blocked or falling behind?"
 *
 * MIGRATED: Now uses UnifiedDashboard as the main content component.
 * All attention logic is handled by deriveDashboardState (single source of truth).
 *
 * Manager-specific features retained:
 * - Layout wrapper with navigation
 * - Email verification banner
 * - Link management (UnopenedLinksActionCenter)
 * - "New Job" action button
 *
 * @see /docs/DASHBOARD_IMPLEMENTATION_SPEC.md
 * @see /docs/ux-flow-contract.md
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/AppLayout';
import EmailVerificationBanner from '../components/EmailVerificationBanner';
import UnopenedLinksActionCenter from '../components/UnopenedLinksActionCenter';
import AuditExportModal from '../components/AuditExportModal';
import { UnifiedDashboard } from '../components/dashboard';
import { Job, UserProfile, Technician } from '../types';
import { useAuth } from '../lib/AuthContext';
import { useData } from '../lib/DataContext';
import { getLinksNeedingAttention, acknowledgeLinkFlag, type MagicLinkInfo } from '../lib/db';

interface AdminDashboardProps {
  jobs: Job[];
  clients?: { id: string; name: string }[];
  technicians?: Technician[];
  user: UserProfile | null;
  showOnboarding?: boolean;
  onCloseOnboarding?: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  jobs,
  clients = [],
  technicians = [],
  user,
}) => {
  const navigate = useNavigate();
  const { updateJob, deleteJob } = useData();

  // Email verification
  const { session } = useAuth();
  const emailConfirmedAt = session?.user?.email_confirmed_at || session?.user?.confirmed_at;
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  useEffect(() => {
    setIsEmailVerified(!!emailConfirmedAt);
  }, [emailConfirmedAt]);

  // Links needing attention (manager-specific feature)
  const [linksNeedingAttention, setLinksNeedingAttention] = useState<MagicLinkInfo[]>([]);
  const [showActionCenter, setShowActionCenter] = useState(false);

  // Audit trail export
  const [showExportModal, setShowExportModal] = useState(false);

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

  // Dev-only assertion to ensure data flows through context
  if (process.env.NODE_ENV === 'development') {
    if (!jobs || !Array.isArray(jobs)) {
      console.error('AdminDashboard: jobs input missing or invalid');
    }
  }

  // Custom header for manager role
  const dashboardHeader = useMemo(() => (
    <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 className="text-lg font-bold text-white">Team Status</h1>
        <p className="text-xs text-slate-400">
          {technicians.length} technician{technicians.length !== 1 ? 's' : ''} •{' '}
          {jobs.filter(j => j.status !== 'Submitted').length} active job{jobs.filter(j => j.status !== 'Submitted').length !== 1 ? 's' : ''}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {/* Link attention indicator */}
        {linksNeedingAttention.length > 0 && (
          <button
            onClick={() => setShowActionCenter(true)}
            className="px-4 py-2 bg-warning/20 border border-warning/30 text-warning font-bold rounded-xl text-sm flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg animate-pulse">link_off</span>
            {linksNeedingAttention.length}
          </button>
        )}
        {/* Export Audit Trail button */}
        <button
          onClick={() => setShowExportModal(true)}
          className="px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold rounded-xl text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-2 min-h-[44px]"
          title="Export audit trail as CSV or JSON"
        >
          <span className="material-symbols-outlined text-lg">download</span>
          Export
        </button>
        {/* New Job button */}
        <button
          onClick={() => navigate('/admin/create')}
          className="px-6 py-3 bg-manager-accent text-white font-bold rounded-xl text-sm shadow-lg shadow-manager-accent/20 hover:scale-105 transition-all active:scale-95 flex items-center gap-2 min-h-[44px]"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          New Job
        </button>
      </div>
    </header>
  ), [technicians.length, jobs, linksNeedingAttention.length, navigate]);

  return (
    <Layout user={user}>
      <div className="max-w-5xl mx-auto">
        {/* Email Verification Banner */}
        {!isEmailVerified && user && <EmailVerificationBanner user={user} />}

        {/* UnifiedDashboard - Single source of truth for all dashboard state */}
        <UnifiedDashboard
          role="manager"
          header={dashboardHeader}
        />

        {/* Jobs link - Secondary navigation */}
        {jobs.length > 0 && (
          <button
            onClick={() => navigate('/admin/jobs')}
            className="w-full flex items-center justify-between p-4 mt-6 bg-slate-900 border border-white/5 rounded-xl hover:border-white/10 transition-all"
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

        {/* Action Center Modal (manager-specific link management) */}
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

        {/* Audit Export Modal (Fix 3.2) */}
        <AuditExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          jobs={jobs}
        />
      </div>
    </Layout>
  );
};

export default React.memo(AdminDashboard);
