import React from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Job, UserProfile, Invoice } from '../types';

interface ClientDashboardProps {
    jobs: Job[];
    invoices: Invoice[];
    user: UserProfile | null;
}

const ClientDashboard: React.FC<ClientDashboardProps> = ({ jobs, invoices, user }) => {
    const navigate = useNavigate();

    // Filter jobs for this client
    // Logic: Match client name to user name or email (fallback)
    const myJobs = jobs.filter(job => {
        if (!user) return false;
        return job.client === user.name || job.client === user.email;
    });

    // Filter invoices
    const myInvoices = invoices.filter(inv => {
        if (!user) return false;
        return inv.clientName === user.name || inv.clientName === user.email;
    });

    const pendingInvoices = myInvoices.filter(inv => inv.status !== 'Paid');

    return (
        <Layout user={user} isAdmin={false}>
            <div className="space-y-8 pb-32 max-w-2xl mx-auto">
                <header className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/20 p-3 rounded-2xl">
                            <span className="material-symbols-outlined text-primary text-2xl font-black">domain</span>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">My Account</h2>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                                {myJobs.length} Jobs • {pendingInvoices.length} Pending Invoices
                            </p>
                        </div>
                    </div>
                </header>

                {/* Action Required Section */}
                {pendingInvoices.length > 0 && (
                    <div className="space-y-4">
                        <h3 className="text-sm font-black text-warning uppercase tracking-widest flex items-center gap-2">
                            <span className="material-symbols-outlined text-base">warning</span>
                            Action Required
                        </h3>
                        {pendingInvoices.map(inv => {
                            const job = jobs.find(j => j.id === inv.jobId);
                            return (
                                <div key={inv.id} className="bg-warning/10 border border-warning/20 rounded-[2rem] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div>
                                        <h4 className="text-lg font-black text-white uppercase">{job?.title || 'Unknown Job'}</h4>
                                        <p className="text-warning text-xs font-bold uppercase tracking-wider">Due: {new Date(inv.dueDate).toLocaleDateString()}</p>
                                        <p className="text-slate-400 text-sm mt-1">Amount: <span className="text-white font-bold">${inv.amount.toFixed(2)}</span></p>
                                    </div>
                                    <button
                                        onClick={() => navigate(`/report/${inv.jobId}`)}
                                        className="px-6 py-3 bg-warning hover:bg-warning-hover text-slate-900 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-warning/20"
                                    >
                                        Review & Pay
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Recent Jobs */}
                <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest">Recent Activity</h3>
                    {myJobs.length === 0 ? (
                        <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-8 text-center">
                            <p className="text-slate-500 text-sm font-medium">No job history found.</p>
                        </div>
                    ) : (
                        myJobs.map(job => (
                            <button
                                key={job.id}
                                onClick={() => navigate(`/report/${job.id}`)}
                                className="w-full text-left group bg-slate-900 border border-white/10 hover:border-primary/50 rounded-[2rem] p-6 transition-all"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${job.status === 'Submitted' ? 'bg-success/10 text-success' : 'bg-slate-700 text-slate-300'
                                            }`}>
                                            {job.status === 'Submitted' ? 'Completed' : job.status}
                                        </span>
                                        <h4 className="text-lg font-black text-white uppercase group-hover:text-primary transition-colors">
                                            {job.title}
                                        </h4>
                                        <p className="text-xs text-slate-400 font-medium">{new Date(job.date).toLocaleDateString()}</p>
                                    </div>
                                    <span className="material-symbols-outlined text-slate-600 group-hover:text-white transition-colors">arrow_forward</span>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </Layout>
    );
};

export default ClientDashboard;
