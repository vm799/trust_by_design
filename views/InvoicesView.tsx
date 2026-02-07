
import React from 'react';
import Layout from '../components/AppLayout';
import { Invoice, UserProfile } from '../types';

interface InvoicesViewProps {
  user: UserProfile | null;
  invoices: Invoice[];
  updateStatus: (id: string, status: Invoice['status']) => void;
}

const InvoicesView: React.FC<InvoicesViewProps> = ({ user, invoices, updateStatus }) => {
  // V2 Feature - Show coming soon state
  const showV2Preview = true;

  if (showV2Preview) {
    return (
      <Layout user={user}>
        <div className="space-y-8 pb-20">
          {/* Coming Soon Banner */}
          <div className="bg-gradient-to-br from-primary/10 to-blue-600/10 border-2 border-primary/30 rounded-3xl p-8 sm:p-12 text-center">
            <div className="size-20 rounded-3xl bg-primary/20 flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-primary text-4xl">rocket_launch</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tighter uppercase mb-3">
              Invoicing Coming in V2
            </h2>
            <p className="text-slate-400 max-w-md mx-auto mb-6">
              We're building a powerful invoicing system with automatic generation from sealed jobs,
              payment tracking, and client portal integration.
            </p>

            {/* Feature Preview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto mt-8">
              <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <span className="material-symbols-outlined text-primary text-2xl mb-2">receipt_long</span>
                <h3 className="text-sm font-black text-white uppercase tracking-tight">Auto-Generate</h3>
                <p className="text-[10px] text-slate-400 mt-1">Create invoices directly from sealed jobs</p>
              </div>
              <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <span className="material-symbols-outlined text-primary text-2xl mb-2">payments</span>
                <h3 className="text-sm font-black text-white uppercase tracking-tight">Payment Links</h3>
                <p className="text-[10px] text-slate-400 mt-1">Send secure payment links to clients</p>
              </div>
              <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <span className="material-symbols-outlined text-primary text-2xl mb-2">analytics</span>
                <h3 className="text-sm font-black text-white uppercase tracking-tight">Track Status</h3>
                <p className="text-[10px] text-slate-400 mt-1">Monitor payment status in real-time</p>
              </div>
            </div>

            {/* CTA */}
            <div className="mt-8 pt-6 border-t border-white/10">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                Want early access?
              </p>
              <a
                href="mailto:support@jobproof.app?subject=V2 Early Access - Invoicing"
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-xl text-xs font-semibold tracking-widest transition-all"
              >
                <span className="material-symbols-outlined text-sm">mail</span>
                Request Early Access
              </a>
            </div>
          </div>

          {/* Show existing invoices if any (read-only) */}
          {invoices.length > 0 && (
            <div className="bg-slate-900 border border-white/5 rounded-3xl overflow-hidden shadow-2xl opacity-60">
              <div className="px-8 py-4 border-b border-white/5 bg-white/[0.02]">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Existing Invoices (Read Only)
                </p>
              </div>
              <table className="w-full text-left">
                <thead className="bg-slate-950/50 border-b border-white/5">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-300">Invoice Ref</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-300">Client / Job</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-300">Amount</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-300">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-8 py-6 font-mono text-xs text-white uppercase">{inv.id}</td>
                      <td className="px-8 py-6">
                        <div className="font-bold text-white uppercase tracking-tight">{inv.clientName}</div>
                        <div className="text-[9px] text-slate-300 uppercase tracking-widest">Job: {inv.jobId}</div>
                      </td>
                      <td className="px-8 py-6 font-black text-white">${inv.amount.toFixed(2)}</td>
                      <td className="px-8 py-6">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border ${
                          inv.status === 'Paid' ? 'bg-success/10 text-success border-success/20' :
                          inv.status === 'Sent' ? 'bg-primary/10 text-primary border-primary/20' :
                          inv.status === 'Overdue' ? 'bg-danger/10 text-danger border-danger/20' :
                          'bg-slate-800 text-slate-300 border-slate-700'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  // Original implementation (hidden behind feature flag)
  return (
    <Layout user={user}>
      <div className="space-y-8 pb-20">
        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Invoicing</h2>
            <p className="text-slate-400">Manage financial settlement for verified jobs.</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
          <table className="w-full text-left">
            <thead className="bg-slate-950/50 border-b border-white/5">
              <tr>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-300">Invoice Ref</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-300">Client / Job</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-300">Amount</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-300">Status</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-300 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-24 text-center opacity-30">
                    <p className="text-[10px] font-black uppercase tracking-widest">No invoices generated yet</p>
                  </td>
                </tr>
              ) : (
                invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-8 py-6 font-mono text-xs text-white uppercase">{inv.id}</td>
                    <td className="px-8 py-6">
                      <div className="font-bold text-white uppercase tracking-tight">{inv.clientName}</div>
                      <div className="text-[9px] text-slate-300 uppercase tracking-widest">Job: {inv.jobId}</div>
                    </td>
                    <td className="px-8 py-6 font-black text-white">${inv.amount.toFixed(2)}</td>
                    <td className="px-8 py-6">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border ${inv.status === 'Paid' ? 'bg-success/10 text-success border-success/20' :
                          inv.status === 'Sent' ? 'bg-primary/10 text-primary border-primary/20' :
                            inv.status === 'Overdue' ? 'bg-danger/10 text-danger border-danger/20' : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button
                        onClick={() => updateStatus(inv.id, 'Paid')}
                        className="min-h-[44px] px-3 py-2 text-[10px] font-black text-primary uppercase tracking-widest hover:bg-primary/10 rounded-lg transition-colors"
                      >
                        Mark Paid
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
};

export default InvoicesView;
