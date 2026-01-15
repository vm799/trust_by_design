
import React from 'react';
import Layout from '../components/Layout';

const BillingView: React.FC = () => {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-12 pb-24">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Subscription & Billing</h2>
          <p className="text-slate-400">Manage organizational licensing and payment infrastructure.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            <section className="bg-slate-900 border border-white/5 p-8 rounded-[2.5rem] space-y-6 shadow-xl">
              <div className="flex justify-between items-start">
                 <div>
                   <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Active License</p>
                   <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Enterprise Protocol</h3>
                   <p className="text-slate-400 text-sm font-medium">Billed annually • Renewal Jan 2025</p>
                 </div>
                 <span className="bg-success/10 text-success text-[10px] font-black px-3 py-1 rounded-full border border-success/20">OPERATIONAL</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <p className="text-[10px] font-black text-slate-500 uppercase">Field Seats</p>
                    <p className="text-lg font-black text-white">Unlimited</p>
                 </div>
                 <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <p className="text-[10px] font-black text-slate-500 uppercase">Reports / Mo</p>
                    <p className="text-lg font-black text-white">Unmetered</p>
                 </div>
              </div>
              <button className="w-full py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black text-sm uppercase tracking-widest border border-white/10 transition-all">Manage Hub Subscription</button>
            </section>
          </div>

          <aside className="space-y-6">
             <div className="bg-slate-900 border border-white/5 p-8 rounded-[2.5rem] space-y-6">
                <h3 className="font-black text-white uppercase text-xs tracking-widest">Protocol Usage</h3>
                <div className="space-y-4">
                   <UsageItem label="Reports Sealed" current={142} total={500} />
                   <UsageItem label="Evidence Storage" current={4.2} total={10} unit="GB" />
                </div>
             </div>
          </aside>
        </div>
      </div>
    </Layout>
  );
};

const UsageItem = ({ label, current, total, unit = "" }: any) => {
  const percent = (current / total) * 100;
  return (
    <div className="space-y-2">
       <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
          <span className="text-slate-500">{label}</span>
          <span className="text-white">{current}{unit} / {total}{unit}</span>
       </div>
       <div className="h-1 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${percent}%` }}></div>
       </div>
    </div>
  );
}

export default BillingView;
