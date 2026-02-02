/**
 * ClientDashboard - Client View
 *
 * Primary Question: "What's the status of my jobs and do I have any pending invoices?"
 *
 * MIGRATED: Uses UnifiedDashboard for job display.
 * Client-specific invoice logic retained separately.
 *
 * Client-specific features retained:
 * - Layout wrapper with isAdmin={false}
 * - Pending invoices "Action Required" section
 * - Invoice-to-job navigation
 *
 * ## ARCHITECTURE NOTE: Invoice Logic Separation
 *
 * Invoice state is intentionally kept SEPARATE from deriveDashboardState for these reasons:
 *
 * 1. **Different Lifecycle**: Invoices persist after jobs are completed/archived.
 *    A job can be "Submitted" while its invoice remains "Pending" for weeks.
 *
 * 2. **Different Permissions**: Invoice access is tied to billing relationships,
 *    not job assignments. A client sees all their invoices regardless of which
 *    technician worked the job.
 *
 * 3. **Different Sync Priority**: Invoice data requires higher consistency guarantees
 *    (financial data) vs job status (operational data). Mixing them in derivation
 *    would complicate offline-first sync reconciliation.
 *
 * 4. **Single Responsibility**: deriveDashboardState handles job/technician attention
 *    routing. Adding invoice logic would violate its focused purpose and the
 *    6 invariants it maintains (see lib/deriveDashboardState.ts).
 *
 * DO NOT refactor invoice logic into deriveDashboardState without PM approval.
 *
 * @see /docs/DASHBOARD_IMPLEMENTATION_SPEC.md
 * @see /docs/ux-flow-contract.md
 */

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { UnifiedDashboard } from '../components/dashboard';
import { Job, UserProfile, Invoice } from '../types';

interface ClientDashboardProps {
  jobs: Job[];
  invoices: Invoice[];
  user: UserProfile | null;
}

const ClientDashboard: React.FC<ClientDashboardProps> = ({ jobs, invoices, user }) => {
  const navigate = useNavigate();

  // Dev-only assertion
  if (process.env.NODE_ENV === 'development') {
    if (!jobs || !Array.isArray(jobs)) {
      console.error('ClientDashboard: jobs input missing or invalid');
    }
  }

  // Filter invoices for this client
  const myInvoices = useMemo(() => {
    if (!user) return [];
    return invoices.filter(inv =>
      inv.clientName === user.name || inv.clientName === user.email
    );
  }, [invoices, user]);

  const pendingInvoices = useMemo(() =>
    myInvoices.filter(inv => inv.status !== 'Paid'),
    [myInvoices]
  );

  // Count jobs for header
  const myJobsCount = useMemo(() => {
    if (!user) return 0;
    return jobs.filter(job =>
      job.client === user.name || job.client === user.email
    ).length;
  }, [jobs, user]);

  // Custom header for client role
  const dashboardHeader = useMemo(() => (
    <header className="space-y-2 mb-6">
      <div className="flex items-center gap-3">
        <div className="bg-primary/20 p-3 rounded-2xl">
          <span className="material-symbols-outlined text-primary text-2xl font-black">domain</span>
        </div>
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">My Account</h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
            {myJobsCount} Jobs • {pendingInvoices.length} Pending Invoices
          </p>
        </div>
      </div>
    </header>
  ), [myJobsCount, pendingInvoices.length]);

  // Custom empty state for clients
  const emptyState = useMemo(() => (
    <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-8 text-center">
      <span className="material-symbols-outlined text-4xl text-slate-600 mb-3">folder_open</span>
      <p className="text-slate-300 text-sm font-medium">No job history found.</p>
    </div>
  ), []);

  return (
    <Layout user={user} isAdmin={false}>
      <div className="space-y-8 pb-32 max-w-2xl mx-auto">
        {/* Header */}
        {dashboardHeader}

        {/* Action Required Section - Client-specific invoice handling */}
        {pendingInvoices.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-black text-warning uppercase tracking-widest flex items-center gap-2">
              <span className="material-symbols-outlined text-base">warning</span>
              Action Required
            </h3>
            {pendingInvoices.map(inv => {
              const job = jobs.find(j => j.id === inv.jobId);
              return (
                <div
                  key={inv.id}
                  className="bg-warning/10 border border-warning/20 rounded-[2rem] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div>
                    <h4 className="text-lg font-black text-white uppercase">
                      {job?.title || 'Unknown Job'}
                    </h4>
                    <p className="text-warning text-xs font-bold uppercase tracking-wider">
                      Due: {new Date(inv.dueDate).toLocaleDateString()}
                    </p>
                    <p className="text-slate-400 text-sm mt-1">
                      Amount: <span className="text-white font-bold">${inv.amount.toFixed(2)}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(`/report/${inv.jobId}`)}
                    className="px-6 py-3 bg-warning hover:bg-warning-hover text-slate-900 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-warning/20 min-h-[44px]"
                  >
                    Review & Pay
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Recent Activity - Uses UnifiedDashboard for job display */}
        <div className="space-y-4">
          <h3 className="text-sm font-black text-slate-300 uppercase tracking-widest">
            Recent Activity
          </h3>
          <UnifiedDashboard
            role="client"
            emptyState={emptyState}
          />
        </div>
      </div>
    </Layout>
  );
};

export default ClientDashboard;
