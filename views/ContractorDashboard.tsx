import React from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import OnboardingTour from '../components/OnboardingTour';
import { Job, UserProfile } from '../types';

interface ContractorDashboardProps {
    jobs: Job[];
    user: UserProfile | null;
    showOnboarding?: boolean;
    onCloseOnboarding?: () => void;
}

const ContractorDashboard: React.FC<ContractorDashboardProps> = ({ jobs, user, showOnboarding, onCloseOnboarding }) => {
    const navigate = useNavigate();

    // Filter jobs for this contractor
    // Logic: Match techId if available, otherwise match name (fallback)
    const myJobs = jobs.filter(job => {
        if (!user) return false;
        // Fallback: Match by name or email
        return job.technician === user.name || job.technician === user.email;
    });

    const activeJobs = myJobs.filter(j => j.status !== 'Submitted');
    const completedJobs = myJobs.filter(j => j.status === 'Submitted');

    return (
        <Layout user={user} isAdmin={false}>
            {showOnboarding && onCloseOnboarding && (
                <OnboardingTour onComplete={onCloseOnboarding} persona={user?.persona} />
            )}
            <div className="space-y-8 pb-32 max-w-2xl mx-auto">
                <header className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/20 p-3 rounded-2xl">
                            <span className="material-symbols-outlined text-primary text-2xl font-black">engineering</span>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">My Assignments</h2>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                                {activeJobs.length} Active • {completedJobs.length} Completed
                            </p>
                        </div>
                    </div>
                </header>

                {myJobs.length === 0 ? (
                    <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-10 text-center space-y-6 animate-in">
                        <div className="bg-slate-800 size-24 rounded-full flex items-center justify-center mx-auto">
                            <span className="material-symbols-outlined text-slate-400 text-5xl">assignment_turned_in</span>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-black text-white uppercase">All Caught Up!</h3>
                            <p className="text-slate-400 text-sm max-w-xs mx-auto">You have no active protocols assigned. Enjoy your downtime!</p>
                        </div>
                        <button onClick={() => window.location.reload()} className="text-primary text-xs font-black uppercase tracking-widest hover:underline">
                            Check for updates
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4" id="job-list-container">
                        {activeJobs.map(job => (
                            <JobCard key={job.id} job={job} onClick={() => navigate(`/contractor/job/${job.id}`)} />
                        ))}

                        {completedJobs.length > 0 && (
                            <>
                                <div className="py-4 flex items-center gap-4">
                                    <div className="h-px bg-white/10 flex-1"></div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Completed History</span>
                                    <div className="h-px bg-white/10 flex-1"></div>
                                </div>
                                {completedJobs.map(job => (
                                    <JobCard key={job.id} job={job} onClick={() => navigate(`/contractor/job/${job.id}`)} completed />
                                ))}
                            </>
                        )}
                    </div>
                )}
            </div>
        </Layout>
    );
};

const JobCard = React.memo(({ job, onClick, completed = false }: { job: Job; onClick: () => void; completed?: boolean }) => (
    <button
        onClick={onClick}
        className={`w-full text-left group relative overflow-hidden transition-all duration-300 ${completed ? 'bg-slate-900/50 border border-white/5 opacity-70 hover:opacity-100' : 'bg-slate-900 border border-white/10 shadow-2xl hover:border-primary/50 hover:shadow-primary/10'
            } rounded-[2rem] p-6`}
    >
        <div className="flex justify-between items-start mb-4">
            <div className="space-y-1">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${completed ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'
                    }`}>
                    {completed ? 'Sealed Proof' : 'Active Protocol'}
                </span>
                <h3 className="text-xl font-black text-white uppercase tracking-tight group-hover:text-primary transition-colors">
                    {job.title}
                </h3>
            </div>
            {!completed && (
                <div className="bg-white/5 p-2 rounded-full group-hover:bg-primary group-hover:text-white transition-all">
                    <span className="material-symbols-outlined text-xl">arrow_forward</span>
                </div>
            )}
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Client</p>
                <p className="text-xs font-bold text-slate-300 uppercase">{job.client}</p>
            </div>
            <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Location</p>
                <p className="text-xs font-bold text-slate-300 uppercase truncate">{job.address}</p>
            </div>
        </div>
    </button>
));

JobCard.displayName = 'ContractorJobCard';

export default ContractorDashboard;
