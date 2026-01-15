
import React from 'react';
import { Link } from 'react-router-dom';

const PricingView: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 selection:bg-primary/30 py-24 px-6">
      <div className="max-w-7xl mx-auto space-y-16">
        <header className="text-center space-y-4">
           <Link to="/home" className="inline-flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest mb-4 hover:scale-105 transition-all">
             <span className="material-symbols-outlined text-lg">arrow_back</span>
             Back to Product
           </Link>
           <h1 className="text-6xl font-black text-white italic tracking-tighter uppercase leading-none">Choose Your <br/><span className="text-primary">Operational Level</span></h1>
           <p className="text-slate-400 text-lg max-w-2xl mx-auto">Scalable infrastructure for field-service teams. No hidden per-report costs.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           <PriceCard 
             tier="Basic" 
             price="0" 
             desc="Perfect for solo freelancers testing the protocol." 
             features={['Up to 5 Jobs / Month', 'Standard Email Support', 'Mobile Capture Hub', 'Basic PDF Reports']} 
           />
           <PriceCard 
             tier="Pro" 
             price="49" 
             desc="The engine for small growing field teams." 
             features={['Unlimited Jobs', 'Custom Brand Colors', 'Priority Email Support', 'Advanced Audit Logs', 'Team Hub (3 Admins)']} 
             active
           />
           <PriceCard 
             tier="Enterprise" 
             price="199" 
             desc="Maximum verification for large organizations." 
             features={['Unlimited Admins', 'White-label Reports', 'Dedicated Success Manager', 'API Access', 'Custom Legal DPA']} 
           />
        </div>

        <section className="bg-slate-900/50 border border-white/5 rounded-[4rem] p-16 text-center space-y-8">
           <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Need a custom blueprint?</h2>
           <p className="text-slate-400 max-w-xl mx-auto leading-relaxed">For high-volume enterprises or specialized industries requiring custom data-point capture, contact our solution architects.</p>
           <button className="bg-white text-slate-950 px-12 py-4 rounded-2xl font-black text-lg hover:bg-slate-50 transition-all">Book Enterprise Demo</button>
        </section>
      </div>
    </div>
  );
};

const PriceCard = ({ tier, price, desc, features, active }: any) => (
  <div className={`p-12 rounded-[3.5rem] border transition-all flex flex-col ${active ? 'bg-primary border-primary shadow-[0_0_80px_-20px_rgba(37,99,235,0.4)] scale-105 z-10' : 'bg-slate-900 border-white/5'}`}>
     <div className="flex-1 space-y-8">
        <div>
           <h3 className={`text-xl font-black italic uppercase tracking-tighter mb-2 ${active ? 'text-white' : 'text-slate-500'}`}>{tier}</h3>
           <div className="flex items-baseline gap-1">
              <span className="text-5xl font-black text-white">£{price}</span>
              <span className={`text-sm font-bold ${active ? 'text-blue-100' : 'text-slate-500'}`}>/mo</span>
           </div>
        </div>
        <p className={`text-sm leading-relaxed ${active ? 'text-blue-50' : 'text-slate-400'}`}>{desc}</p>
        <ul className="space-y-4">
           {features.map((f: string) => (
              <li key={f} className={`flex items-start gap-3 text-sm font-bold ${active ? 'text-white' : 'text-slate-300'}`}>
                 <span className="material-symbols-outlined text-lg">check_circle</span>
                 {f}
              </li>
           ))}
        </ul>
     </div>
     <button className={`w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest mt-12 transition-all ${active ? 'bg-white text-primary hover:bg-blue-50' : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'}`}>
        {active ? 'Upgrade Now' : `Select ${tier}`}
     </button>
  </div>
);

export default PricingView;
