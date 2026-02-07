/**
 * ContractorDashboard - Solo Contractor View
 *
 * Primary Question: "What job am I on, and what's next?"
 *
 * MIGRATED: Now uses UnifiedDashboard as the main content component.
 * All job categorization is handled by deriveDashboardState (single source of truth).
 *
 * Contractor-specific features retained:
 * - Layout wrapper with isAdmin={false}
 * - Onboarding tour integration
 * - Offline indicator
 *
 * @see /docs/DASHBOARD_IMPLEMENTATION_SPEC.md
 * @see /docs/ux-flow-contract.md
 */

import React, { useMemo } from 'react';
import Layout from '../components/AppLayout';
import OnboardingTour from '../components/OnboardingTour';
import { UnifiedDashboard } from '../components/dashboard';
import { OfflineIndicator } from '../components/OfflineIndicator';
import { Job, UserProfile } from '../types';

interface ContractorDashboardProps {
  jobs: Job[];
  user: UserProfile | null;
  showOnboarding?: boolean;
  onCloseOnboarding?: () => void;
}

const ContractorDashboard: React.FC<ContractorDashboardProps> = ({
  jobs,
  user,
  showOnboarding,
  onCloseOnboarding,
}) => {
  // Dev-only assertion to ensure data flows through context
  if (process.env.NODE_ENV === 'development') {
    if (!jobs || !Array.isArray(jobs)) {
      console.error('ContractorDashboard: jobs input missing or invalid');
    }
  }

  // Count active jobs for header (P0 fix: use stable IDs, not name strings)
  const activeJobCount = useMemo(() => {
    if (!user?.id) return 0;
    return jobs.filter(job => {
      // Check both techId and technicianId for consistency across codebase
      const isMyJob = job.techId === user.id || job.technicianId === user.id;
      const isActive = job.status !== 'Submitted' && job.status !== 'Complete';
      return isMyJob && isActive;
    }).length;
  }, [jobs, user]);

  // Custom header for contractor role
  const dashboardHeader = useMemo(() => (
    <header className="flex items-center justify-between py-4 mb-2">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-2xl bg-solo-accent/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-solo-accent text-lg font-black">work</span>
        </div>
        <div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
            {activeJobCount === 0 ? 'No jobs' : `${activeJobCount} active`}
          </p>
        </div>
      </div>
      <OfflineIndicator />
    </header>
  ), [activeJobCount]);

  // Custom empty state for contractors
  const emptyState = useMemo(() => (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="size-24 rounded-[2rem] bg-slate-900 flex items-center justify-center mb-6">
        <span className="material-symbols-outlined text-5xl text-slate-600">event_available</span>
      </div>
      <h2 className="text-xl font-black text-white uppercase tracking-tight mb-2">All Clear</h2>
      <p className="text-slate-400 text-sm max-w-xs">
        No jobs assigned. Pull to refresh or check back later.
      </p>
    </div>
  ), []);

  return (
    <Layout user={user} isAdmin={false}>
      {showOnboarding && onCloseOnboarding && (
        <OnboardingTour onComplete={onCloseOnboarding} persona={user?.persona} />
      )}

      <div className="min-h-screen pb-32 max-w-2xl mx-auto px-4">
        {/* UnifiedDashboard - Single source of truth for all dashboard state */}
        <UnifiedDashboard
          role="solo_contractor"
          header={dashboardHeader}
          emptyState={emptyState}
        />
      </div>
    </Layout>
  );
};

export default React.memo(ContractorDashboard);
