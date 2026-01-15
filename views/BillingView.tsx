
import React from 'react';
import Layout from '../components/Layout';

const BillingView: React.FC = () => {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-12 pb-24">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Subscription & Billing</h2>
          <p className="text-slate-400">Manage your plan, payment methods, and historical invoices.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            <section className="bg-slate-900 border border-white/5 p-8 rounded-[2.5rem] space-y-6 shadow-xl">
              <div className="flex justify-between items-start">
                 <div>
                   <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Current Plan</p>
                   <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Enterprise Protocol</h3>
                   <p className="text-slate-400 text-sm">Billed annually • Next renewal Jan 2025</p>
                 </div>
                 <span className="bg-success/10 text-success text-[10px] font-black px-3 py-1 rounded-full border border-success/20">ACTIVE</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <p className="text-[10px] font-black text-slate-500 uppercase">Field Seats</p>
                    <p className="text-lg font-black text-white">Unlimited</p>
                 </div>
                 <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <p className="text-[10px] font-black text-slate-500 uppercase">Monthly Reports</p>
                    <p className="text-lg font-black text-white">Unmetered</p>
                 </div>
              </div>
              <button className="w-full py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black text-sm uppercase tracking-widest border border-white/10 transition-all">Manage Subscription</button>
            </section>

            <section className="bg-slate-900 border border-white/5 overflow-hidden rounded-[2.5rem] shadow-xl">
               <div className="p-8 border-b border-white/5">
                  <h3 className="font-black text-white uppercase text-xs tracking-widest">Payment Methods</h3>
               </div>
               <div className="p-8 space-y-4">
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                     <div className="flex items-center gap-4">
                        <div className="size-10 bg-slate-800 rounded-lg flex items-center justify-center font-bold text-white italic">VISA</div>
                        <div>
                           <p className="text-sm font-bold text-white">•••• 4242</p>
                           <p className="text-[10px] text-slate-500 uppercase">Expires 12/26</p>
                        </div>
                     </div>
                     <span className="text-[10px] font-black text-primary uppercase">Primary</span>
                  </div>
                  <button className="text-xs font-black text-primary hover:underline">+ Add Backup Method</button>
               </div>
            </section>
          </div>

          <aside className="space-y-6">
             <div className="bg-slate-900 border border-white/5 p-8 rounded-[2.5rem] space-y-6">
                <h3 className="font-black text-white uppercase text-xs tracking-widest italic">Usage Stats</h3>
                <div className="space-y-4">
                   <UsageItem label="Reports Generated" current={142} total={500} />
                   <UsageItem label="Evidence Storage" current={4.2} total={10} unit="GB" />
                </div>
             </div>
             
             <div className="bg-primary/5 border border-primary/10 p-8 rounded-[2.5rem] space-y-4">
                <span className="material-symbols-outlined text-primary text-3xl">info</span>
                <p className="text-sm font-medium text-slate-300 leading-relaxed">You are on an <span className="text-primary font-black italic">Enterprise</span> license. Priority support is included.</p>
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
