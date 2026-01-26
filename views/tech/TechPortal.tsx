/**
 * TechPortal - Technician Job List
 *
 * Mobile-first view for technicians showing their assigned jobs.
 *
 * Phase G: Technician Portal
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, EmptyState, LoadingSkeleton } from '../../components/ui';
import { getJobs, getClients } from '../../hooks/useWorkspaceData';
import { useAuth } from '../../lib/AuthContext';
import { Job, Client } from '../../types';
import { JobProofLogo } from '../../components/branding/jobproof-logo';
import { OfflineIndicator } from '../../components/OfflineIndicator';

const TechPortal: React.FC = () => {
  const { userId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [jobsData, clientsData] = await Promise.all([
          getJobs(),
          getClients(),
        ]);

        // Filter jobs assigned to current technician (or all for demo)
        const myJobs = jobsData.filter(j =>
          j.technicianId && j.status !== 'Complete'
        );

        setJobs(myJobs);
        setClients(clientsData);
      } catch (error) {
        console.error('Failed to load jobs:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userId]);

  // Group jobs by date
  const getTodayJobs = () => {
    const today = new Date().toDateString();
    return jobs.filter(j => new Date(j.date).toDateString() === today);
  };

  const getUpcomingJobs = () => {
    const today = new Date().toDateString();
    return jobs.filter(j => new Date(j.date).toDateString() !== today);
  };

  const todayJobs = getTodayJobs();
  const upcomingJobs = getUpcomingJobs();

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-xl border-b border-white/5 px-4 py-4">
        <div className="flex items-center justify-between">
          <JobProofLogo variant="full" size="sm" />
          <div className="flex items-center gap-3">
            <OfflineIndicator />
            <span className="text-xs text-slate-500 font-medium">Tech Portal</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-6 pb-24">
        {loading ? (
          <LoadingSkeleton variant="card" count={3} />
        ) : jobs.length === 0 ? (
          <EmptyState
            icon="work_off"
            title="No jobs assigned"
            description="You don't have any jobs assigned yet. Check back later."
          />
        ) : (
          <div className="space-y-8">
            {/* Today's Jobs */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
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
                  <span className="material-symbols-outlined text-4xl text-slate-600 mb-2">event_busy</span>
                  <p className="text-slate-400">No jobs scheduled for today</p>
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
                              <p className="text-lg font-bold text-white">
                                {new Date(job.date).toLocaleTimeString('en-AU', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>

                            {/* Divider */}
                            <div className={`w-0.5 h-12 rounded-full ${isActive ? 'bg-primary' : 'bg-white/10'}`} />

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium text-white truncate">
                                  {job.title || `Job #${job.id.slice(0, 6)}`}
                                </p>
                                {isActive && (
                                  <span className="px-2 py-0.5 text-[10px] font-bold bg-primary/20 text-primary rounded uppercase">
                                    Active
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-slate-400 truncate">
                                {client?.name || 'Unknown client'}
                              </p>
                              {job.address && (
                                <p className="text-xs text-slate-500 truncate mt-1">
                                  {job.address}
                                </p>
                              )}
                            </div>

                            {/* Action */}
                            <span className="material-symbols-outlined text-slate-500">
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
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
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
                              <p className="text-sm font-bold text-white">
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
                              <p className="font-medium text-white truncate">
                                {job.title || `Job #${job.id.slice(0, 6)}`}
                              </p>
                              <p className="text-sm text-slate-400 truncate">
                                {client?.name || 'Unknown client'}
                              </p>
                            </div>

                            <span className="material-symbols-outlined text-slate-500">
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
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-xl border-t border-white/10 px-4 pb-safe">
        <div className="flex items-center justify-around h-16">
          <button className="flex flex-col items-center gap-1 text-primary">
            <span className="material-symbols-outlined text-2xl">work</span>
            <span className="text-[10px] font-bold">Jobs</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-slate-500">
            <span className="material-symbols-outlined text-2xl">history</span>
            <span className="text-[10px] font-medium">History</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-slate-500">
            <span className="material-symbols-outlined text-2xl">person</span>
            <span className="text-[10px] font-medium">Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default TechPortal;
