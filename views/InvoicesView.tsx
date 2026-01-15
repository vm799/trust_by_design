
import React from 'react';
import Layout from '../components/Layout';
import { Invoice } from '../types';

interface InvoicesViewProps {
  invoices: Invoice[];
  updateStatus: (id: string, status: Invoice['status']) => void;
}

const InvoicesView: React.FC<InvoicesViewProps> = ({ invoices, updateStatus }) => {
  return (
    <Layout>
      <div className="space-y-8 pb-20">
        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Invoicing Hub</h2>
            <p className="text-slate-400">Manage financial settlement for verified operational dispatches.</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
          <table className="w-full text-left">
            <thead className="bg-slate-950/50 border-b border-white/5">
              <tr>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Invoice Ref</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Client / Job</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Amount</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Status</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Action</th>
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
                      <div className="text-[9px] text-slate-500 uppercase tracking-widest">Job: {inv.jobId}</div>
                    </td>
                    <td className="px-8 py-6 font-black text-white">£{inv.amount.toFixed(2)}</td>
                    <td className="px-8 py-6">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border ${
                        inv.status === 'Paid' ? 'bg-success/10 text-success border-success/20' :
                        inv.status === 'Sent' ? 'bg-primary/10 text-primary border-primary/20' :
                        inv.status === 'Overdue' ? 'bg-danger/10 text-danger border-danger/20' : 'bg-slate-800 text-slate-500 border-slate-700'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                       <button 
                        onClick={() => updateStatus(inv.id, 'Paid')}
                        className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
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
