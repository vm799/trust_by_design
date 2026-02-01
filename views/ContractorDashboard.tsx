/**
 * ContractorDashboard - Solo Contractor View
 *
 * Primary Question: "What job am I on, and what's next?"
 *
 * Design Principles:
 * - One job can be "active" (visually dominant)
 * - Others are "queued" in Up Next
 * - Context switch is explicit, not implicit
 * - No job creation in normal flow
 * - Jobs can be started and abandoned without penalty
 */

import React, { useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import OnboardingTour from '../components/OnboardingTour';
import { Job, UserProfile } from '../types';
import { OfflineIndicator } from '../components/OfflineIndicator';
import { useData } from '../lib/DataContext';
import { JOB_STATUS, SYNC_STATUS, isCompletedJobStatus } from '../lib/constants';

interface ContractorDashboardProps {
    jobs: Job[];
    user: UserProfile | null;
    showOnboarding?: boolean;
    onCloseOnboarding?: () => void;
}

const ContractorDashboard: React.FC<ContractorDashboardProps> = ({ jobs, user, showOnboarding, onCloseOnboarding }) => {
    const navigate = useNavigate();
    const { refresh } = useData();

    // Filter jobs for this contractor
    const myJobs = useMemo(() => {
        return jobs.filter(job => {
            if (!user) return false;
            return job.technician === user.name || job.technician === user.email;
        });
    }, [jobs, user]);

    // Categorize jobs: Now (active) / Up Next / Later / Done
    const { currentJob, upNextJobs, laterJobs, doneCount } = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

        // Active job: In Progress status (only one can be active)
        const inProgress = myJobs.find(j => j.status === JOB_STATUS.IN_PROGRESS);

        // Remaining incomplete jobs (excluding active)
        const remaining = myJobs
            .filter(j => !isCompletedJobStatus(j.status) && j.id !== inProgress?.id)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Up Next: Today's jobs + tomorrow's jobs (first 5)
        const upNext = remaining
            .filter(j => {
                const jobDate = new Date(j.date);
                return jobDate < tomorrow;
            })
            .slice(0, 5);

        // Later: Everything else
        const later = remaining.filter(j => !upNext.find(u => u.id === j.id));

        // Done count
        const done = myJobs.filter(j => isCompletedJobStatus(j.status)).length;

        return {
            currentJob: inProgress,
            upNextJobs: upNext,
            laterJobs: later,
            doneCount: done,
        };
    }, [myJobs]);

    // Navigation handlers
    const handleJobClick = useCallback((jobId: string) => {
        navigate(`/contractor/job/${jobId}`);
    }, [navigate]);

    const handleStartJob = useCallback((jobId: string) => {
        navigate(`/contractor/job/${jobId}`);
    }, [navigate]);

    return (
        <Layout user={user} isAdmin={false}>
            {showOnboarding && onCloseOnboarding && (
                <OnboardingTour onComplete={onCloseOnboarding} persona={user?.persona} />
            )}

            <div className="min-h-screen pb-32 max-w-2xl mx-auto px-4">
                {/* Minimal header - just sync status */}
                <header className="flex items-center justify-between py-4 mb-2">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-2xl bg-primary/20 flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary text-lg font-black">work</span>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                                {myJobs.length === 0 ? 'No jobs' : `${myJobs.length - doneCount} active`}
                            </p>
                        </div>
                    </div>
                    <OfflineIndicator />
                </header>

                {myJobs.length === 0 ? (
                    /* Empty state */
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="size-24 rounded-[2rem] bg-slate-900 flex items-center justify-center mb-6">
                            <span className="material-symbols-outlined text-5xl text-slate-600">event_available</span>
                        </div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tight mb-2">All Clear</h2>
                        <p className="text-slate-400 text-sm max-w-xs">
                            No jobs assigned. Pull to refresh or check back later.
                        </p>
                        <button
                            onClick={() => refresh()}
                            className="mt-6 px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-sm font-bold text-white transition-all"
                        >
                            Check for updates
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* NOW - Current Active Job (Visually Dominant) */}
                        {currentJob ? (
                            <section>
                                <button
                                    onClick={() => handleJobClick(currentJob.id)}
                                    className="w-full text-left group"
                                >
                                    <div className="bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary rounded-[2rem] p-6 shadow-2xl shadow-primary/10 transition-all active:scale-[0.98]">
                                        {/* Pulsing NOW indicator */}
                                        <div className="flex items-center gap-2 mb-4">
                                            <span className="relative flex size-3">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                                <span className="relative inline-flex rounded-full size-3 bg-primary"></span>
                                            </span>
                                            <span className="text-xs font-black text-primary uppercase tracking-widest">Now</span>
                                        </div>

                                        {/* Job title - large and prominent */}
                                        <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2 group-hover:text-primary transition-colors">
                                            {currentJob.title}
                                        </h2>

                                        {/* Client & Location */}
                                        <div className="space-y-1 mb-4">
                                            <p className="text-sm text-slate-300">{currentJob.client}</p>
                                            <p className="text-xs text-slate-400 truncate">{currentJob.address}</p>
                                        </div>

                                        {/* Quick status */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                {currentJob.photos.length > 0 && (
                                                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                                                        <span className="material-symbols-outlined text-sm">photo_camera</span>
                                                        {currentJob.photos.length}
                                                    </span>
                                                )}
                                                {currentJob.signature && (
                                                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                                                        <span className="material-symbols-outlined text-sm">signature</span>
                                                        Signed
                                                    </span>
                                                )}
                                            </div>
                                            <span className="flex items-center gap-1 text-primary font-bold text-sm">
                                                Continue
                                                <span className="material-symbols-outlined text-lg">arrow_forward</span>
                                            </span>
                                        </div>
                                    </div>
                                </button>
                            </section>
                        ) : upNextJobs.length > 0 ? (
                            /* No active job - prompt to start next */
                            <section>
                                <div className="bg-slate-900 border border-white/10 rounded-[2rem] p-6 text-center">
                                    <span className="material-symbols-outlined text-4xl text-slate-500 mb-3">play_circle</span>
                                    <p className="text-white font-bold mb-1">Ready to start?</p>
                                    <p className="text-slate-400 text-sm mb-4">Tap a job below to begin</p>
                                </div>
                            </section>
                        ) : null}

                        {/* UP NEXT - Queued jobs for today */}
                        {upNextJobs.length > 0 && (
                            <section>
                                <h3 className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest mb-3 px-1">
                                    <span className="material-symbols-outlined text-sm">schedule</span>
                                    Up Next
                                </h3>
                                <div className="space-y-2">
                                    {upNextJobs.map(job => (
                                        <JobQueueCard
                                            key={job.id}
                                            job={job}
                                            onClick={() => handleStartJob(job.id)}
                                        />
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* LATER - Collapsed by default */}
                        {laterJobs.length > 0 && (
                            <section>
                                <details className="group">
                                    <summary className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest mb-3 px-1 cursor-pointer hover:text-slate-400 transition-colors list-none">
                                        <span className="material-symbols-outlined text-sm transition-transform group-open:rotate-90">chevron_right</span>
                                        Later ({laterJobs.length})
                                    </summary>
                                    <div className="space-y-2 pt-2">
                                        {laterJobs.map(job => (
                                            <JobQueueCard
                                                key={job.id}
                                                job={job}
                                                onClick={() => handleJobClick(job.id)}
                                                muted
                                            />
                                        ))}
                                    </div>
                                </details>
                            </section>
                        )}

                        {/* DONE - Just a count, link to history */}
                        {doneCount > 0 && (
                            <section className="pt-4 border-t border-white/5">
                                <button
                                    onClick={() => navigate('/contractor/history')}
                                    className="flex items-center justify-between w-full py-3 text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span>
                                        <span className="text-sm">Completed</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold">{doneCount}</span>
                                        <span className="material-symbols-outlined text-sm">chevron_right</span>
                                    </div>
                                </button>
                            </section>
                        )}
                    </div>
                )}
            </div>
        </Layout>
    );
};

/**
 * JobQueueCard - Compact job card for Up Next / Later sections
 * Minimal info, max tap target
 */
const JobQueueCard = React.memo(({
    job,
    onClick,
    muted = false
}: {
    job: Job;
    onClick: () => void;
    muted?: boolean;
}) => {
    const statusBadge = useMemo(() => {
        if (isCompletedJobStatus(job.status)) {
            return { label: 'Done', color: 'text-emerald-400 bg-emerald-400/10' };
        }
        if (job.photos.length > 0) {
            return { label: 'Started', color: 'text-primary bg-primary/10' };
        }
        return { label: 'Not Started', color: 'text-slate-400 bg-slate-800' };
    }, [job.status, job.photos.length]);

    const formattedTime = useMemo(() => {
        const date = new Date(job.date);
        const today = new Date();
        const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

        if (date.toDateString() === today.toDateString()) {
            return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
        }
        if (date.toDateString() === tomorrow.toDateString()) {
            return 'Tomorrow';
        }
        return date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric' });
    }, [job.date]);

    return (
        <button
            onClick={onClick}
            className={`w-full text-left group transition-all active:scale-[0.98] ${
                muted
                    ? 'bg-slate-950/50 border border-white/5 opacity-70 hover:opacity-100'
                    : 'bg-slate-900 border border-white/10 hover:border-primary/30'
            } rounded-2xl p-4 min-h-[56px]`}
        >
            <div className="flex items-center gap-4">
                {/* Time */}
                <div className="min-w-[60px] text-right">
                    <p className={`text-sm font-bold ${muted ? 'text-slate-500' : 'text-white'}`}>
                        {formattedTime}
                    </p>
                </div>

                {/* Divider */}
                <div className={`w-0.5 h-10 rounded-full ${
                    job.photos.length > 0 ? 'bg-primary' : 'bg-slate-700'
                }`} />

                {/* Job info */}
                <div className="flex-1 min-w-0">
                    <p className={`font-bold truncate ${muted ? 'text-slate-400' : 'text-white'} group-hover:text-primary transition-colors`}>
                        {job.title}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{job.client}</p>
                </div>

                {/* Status badge */}
                <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg ${statusBadge.color}`}>
                    {statusBadge.label}
                </span>
            </div>
        </button>
    );
});

JobQueueCard.displayName = 'JobQueueCard';

export default React.memo(ContractorDashboard);
