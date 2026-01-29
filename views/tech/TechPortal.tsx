/**
 * TechPortal - Technician Job List
 *
 * Mobile-first view for technicians showing their assigned jobs.
 * Includes History tab for completed jobs and Profile settings.
 *
 * Phase G: Technician Portal (Enhanced with nav tabs)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, EmptyState, LoadingSkeleton } from '../../components/ui';
import { getJobs, getClients } from '../../hooks/useWorkspaceData';
import { useAuth } from '../../lib/AuthContext';
import { Job, Client } from '../../types';
import { JobProofLogo } from '../../components/branding/jobproof-logo';
import { OfflineIndicator } from '../../components/OfflineIndicator';

type TabType = 'jobs' | 'history' | 'profile';

const TechPortal: React.FC = () => {
  const { userId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('jobs');
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [syncPending, setSyncPending] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [jobsData, clientsData] = await Promise.all([
          getJobs(),
          getClients(),
        ]);

        // Filter jobs assigned to technicians (or all for demo)
        const myJobs = jobsData.filter(j => j.technicianId);
        setAllJobs(myJobs);
        setClients(clientsData);

        // Check for pending sync items
        const pendingCount = myJobs.filter(j => j.syncStatus === 'pending').length;
        setSyncPending(pendingCount);
      } catch (error) {
        console.error('Failed to load jobs:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userId]);

  // Filter jobs by status - useMemo for performance
  const { activeJobs, completedJobs, todayJobs, upcomingJobs } = useMemo(() => {
    const today = new Date().toDateString();
    const active = allJobs.filter(j => j.status !== 'Complete' && j.status !== 'Submitted');
    const completed = allJobs.filter(j => j.status === 'Complete' || j.status === 'Submitted');
    const todayActive = active.filter(j => new Date(j.date).toDateString() === today);
    const upcoming = active.filter(j => new Date(j.date).toDateString() !== today);

    return {
      activeJobs: active,
      completedJobs: completed.sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
      todayJobs: todayActive,
      upcomingJobs: upcoming,
    };
  }, [allJobs]);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col">
      {/* Header - Theme-aware */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 px-4 py-4">
        <div className="flex items-center justify-between">
          <JobProofLogo variant="full" size="sm" />
          <div className="flex items-center gap-3">
            {/* Sync Status Indicator */}
            {syncPending > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 dark:bg-amber-500/20 rounded-lg">
                <span className="material-symbols-outlined text-sm text-amber-600 dark:text-amber-400 animate-pulse">sync</span>
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{syncPending} pending</span>
              </div>
            )}
            <OfflineIndicator />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-6 pb-24">
        {loading ? (
          <LoadingSkeleton variant="card" count={3} />
        ) : activeTab === 'jobs' ? (
          /* Jobs Tab */
          activeJobs.length === 0 ? (
            <EmptyState
              icon="work_off"
              title="No jobs assigned"
              description="You don't have any jobs assigned yet. Check back later."
            />
          ) : (
            <div className="space-y-8">
              {/* Today's Jobs */}
              <section>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">today</span>
                  Today's Jobs
                  {todayJobs.length > 0 && (
                    <span className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full">
                      {todayJobs.length}
                    </span>
                  )}
                </h2>

                {todayJobs.length === 0 ? (
                  <Card className="text-center py-8">
                    <span className="material-symbols-outlined text-4xl text-slate-400 dark:text-slate-600 mb-2">event_busy</span>
                    <p className="text-slate-600 dark:text-slate-400">No jobs scheduled for today</p>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {todayJobs.map(job => {
                      const client = clients.find(c => c.id === job.clientId);
                      const isActive = job.status === 'In Progress';

                      return (
                        <Link key={job.id} to={`/tech/job/${job.id}`}>
                          <Card variant="interactive" className={isActive ? 'border-primary/30' : ''}>
                            <div className="flex items-start gap-4">
                              {/* Time */}
                              <div className="text-center min-w-[50px]">
                                <p className="text-lg font-bold">
                                  {new Date(job.date).toLocaleTimeString('en-AU', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </p>
                              </div>

                              {/* Divider */}
                              <div className={`w-0.5 h-12 rounded-full ${isActive ? 'bg-primary' : 'bg-slate-200 dark:bg-white/10'}`} />

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-medium truncate">
                                    {job.title || `Job #${job.id.slice(0, 6)}`}
                                  </p>
                                  {isActive && (
                                    <span className="px-2 py-0.5 text-[10px] font-bold bg-primary/20 text-primary rounded uppercase">
                                      Active
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                                  {client?.name || 'Unknown client'}
                                </p>
                                {job.address && (
                                  <p className="text-xs text-slate-500 truncate mt-1">
                                    {job.address}
                                  </p>
                                )}
                              </div>

                              {/* Action */}
                              <span className="material-symbols-outlined text-slate-400 dark:text-slate-500">
                                chevron_right
                              </span>
                            </div>
                          </Card>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Upcoming Jobs */}
              {upcomingJobs.length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-slate-400">event</span>
                    Upcoming
                  </h2>

                  <div className="space-y-3">
                    {upcomingJobs.map(job => {
                      const client = clients.find(c => c.id === job.clientId);

                      return (
                        <Link key={job.id} to={`/tech/job/${job.id}`}>
                          <Card variant="interactive">
                            <div className="flex items-center gap-4">
                              {/* Date */}
                              <div className="text-center min-w-[50px]">
                                <p className="text-sm font-bold">
                                  {new Date(job.date).toLocaleDateString('en-AU', {
                                    day: 'numeric',
                                  })}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {new Date(job.date).toLocaleDateString('en-AU', {
                                    month: 'short',
                                  })}
                                </p>
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">
                                  {job.title || `Job #${job.id.slice(0, 6)}`}
                                </p>
                                <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                                  {client?.name || 'Unknown client'}
                                </p>
                              </div>

                              <span className="material-symbols-outlined text-slate-400 dark:text-slate-500">
                                chevron_right
                              </span>
                            </div>
                          </Card>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          )
        ) : activeTab === 'history' ? (
          /* History Tab - Completed Jobs */
          completedJobs.length === 0 ? (
            <EmptyState
              icon="history"
              title="No completed jobs"
              description="Jobs you complete will appear here as your work history."
            />
          ) : (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-500">check_circle</span>
                Completed Jobs
                <span className="px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full">
                  {completedJobs.length}
                </span>
              </h2>

              <div className="space-y-3">
                {completedJobs.map(job => {
                  const client = clients.find(c => c.id === job.clientId);
                  const isSynced = job.syncStatus === 'synced';

                  return (
                    <Link key={job.id} to={`/tech/job/${job.id}`}>
                      <Card variant="interactive">
                        <div className="flex items-center gap-4">
                          {/* Status Icon */}
                          <div className={`size-10 rounded-xl flex items-center justify-center ${
                            isSynced
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'bg-amber-500/10 text-amber-500'
                          }`}>
                            <span className="material-symbols-outlined">
                              {isSynced ? 'cloud_done' : 'cloud_upload'}
                            </span>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {job.title || `Job #${job.id.slice(0, 6)}`}
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                              {client?.name || 'Unknown client'}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              {new Date(job.date).toLocaleDateString('en-AU', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </p>
                          </div>

                          {/* Sync Status */}
                          <div className="text-right">
                            <span className={`text-xs font-medium ${
                              isSynced ? 'text-emerald-500' : 'text-amber-500'
                            }`}>
                              {isSynced ? 'Synced' : 'Pending'}
                            </span>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          )
        ) : (
          /* Profile Tab */
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Profile</h2>

            <Card>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-3xl text-primary">person</span>
                  </div>
                  <div>
                    <p className="font-semibold text-lg">Technician</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Field Worker</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-white/10 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Active Jobs</span>
                    <span className="font-medium">{activeJobs.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Completed</span>
                    <span className="font-medium text-emerald-500">{completedJobs.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Pending Sync</span>
                    <span className={`font-medium ${syncPending > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {syncPending}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">App Version</p>
                <p className="font-medium">JobProof v1.0.0</p>
              </div>
            </Card>
          </div>
        )}
      </main>

      {/* Bottom Navigation - Functional */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200 dark:border-white/10 px-4 pb-safe">
        <div className="flex items-center justify-around h-16">
          <button
            onClick={() => setActiveTab('jobs')}
            className={`flex flex-col items-center gap-1 min-w-[64px] py-2 transition-colors ${
              activeTab === 'jobs' ? 'text-primary' : 'text-slate-500'
            }`}
          >
            <span className="material-symbols-outlined text-2xl">work</span>
            <span className={`text-[10px] ${activeTab === 'jobs' ? 'font-bold' : 'font-medium'}`}>Jobs</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center gap-1 min-w-[64px] py-2 transition-colors relative ${
              activeTab === 'history' ? 'text-primary' : 'text-slate-500'
            }`}
          >
            <span className="material-symbols-outlined text-2xl">history</span>
            <span className={`text-[10px] ${activeTab === 'history' ? 'font-bold' : 'font-medium'}`}>History</span>
            {completedJobs.length > 0 && (
              <span className="absolute -top-0.5 right-2 size-2 bg-emerald-500 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center gap-1 min-w-[64px] py-2 transition-colors ${
              activeTab === 'profile' ? 'text-primary' : 'text-slate-500'
            }`}
          >
            <span className="material-symbols-outlined text-2xl">person</span>
            <span className={`text-[10px] ${activeTab === 'profile' ? 'font-bold' : 'font-medium'}`}>Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default TechPortal;
