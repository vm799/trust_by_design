
import React from 'react';
import { Link } from 'react-router-dom';

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 selection:bg-primary/30 selection:text-white">
      {/* Navbar */}
      <nav className="fixed w-full z-50 border-b border-white/5 glass">
        <div className="max-w-7xl mx-auto px-6 h-16 lg:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary size-9 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <span className="material-symbols-outlined text-white text-xl font-black">verified</span>
            </div>
            <span className="text-2xl font-black tracking-tighter text-white">JobProof</span>
          </div>
          <div className="hidden md:flex items-center gap-10 text-sm font-bold text-slate-400">
            <a href="#product" className="hover:text-white transition-colors">Technology</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <Link to="/admin" className="text-white bg-white/5 border border-white/10 px-6 py-2.5 rounded-xl hover:bg-white/10 transition-all">Control Dashboard</Link>
          </div>
          <button className="md:hidden material-symbols-outlined">menu</button>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-48 pb-32 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-10 animate-in">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-primary">
            <span className="size-1.5 rounded-full bg-primary animate-ping"></span>
            Operational Verification Engine v2.0
          </div>
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] text-white">
            Trust, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-blue-400 to-indigo-400">By Design.</span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed font-medium">
            Eliminate payment disputes and invoice friction. JobProof captures authenticated evidence and digital signatures on-site with zero-tamper protocols.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link to="/admin" className="w-full sm:w-auto px-10 py-5 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black text-lg shadow-2xl shadow-primary/30 transition-all flex items-center justify-center gap-3 active:scale-95">
              Access Admin Hub
              <span className="material-symbols-outlined font-black">arrow_forward</span>
            </Link>
          </div>
        </div>

        {/* Product Visual */}
        <div className="max-w-6xl mx-auto mt-24 relative animate-in" style={{ animationDelay: '0.2s' }}>
           <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-blue-500/20 blur-3xl opacity-20"></div>
           <div className="relative rounded-[3rem] border border-white/10 bg-slate-900 overflow-hidden shadow-2xl aspect-video">
              <img 
                src="https://images.unsplash.com/photo-1551288049-bbb15014f75e?auto=format&fit=crop&q=80&w=2000" 
                className="w-full h-full object-cover opacity-60 mix-blend-overlay" 
                alt="Architecture"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                 <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl text-center space-y-4 max-w-sm">
                    <span className="material-symbols-outlined text-6xl text-primary">verified_user</span>
                    <h3 className="text-2xl font-black text-white italic tracking-tighter">THE DISPUTE ELIMINATOR</h3>
                    <p className="text-slate-300 text-sm">Every completion generates a verifiable PDF report delivered instantly to the client asset owner.</p>
                 </div>
              </div>
           </div>
        </div>
      </section>

      {/* Social Proof Placeholder - Neutral Industry Icons */}
      <section className="py-24 border-y border-white/5 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-12">
           <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Built for Critical Field Industries</p>
           <div className="flex flex-wrap justify-center gap-16 items-center opacity-30 grayscale invert text-xl font-black">
              <div>ELECTRICAL</div>
              <div>HVAC</div>
              <div>PLUMBING</div>
              <div>LOGISTICS</div>
              <div>SECURITY</div>
           </div>
        </div>
      </section>

      {/* Product Pillars */}
      <section id="product" className="py-32 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
          <Pillar 
            icon="bolt" 
            title="Instant Dispatch" 
            desc="Initialize verifiable jobs from the hub. Magic links are generated for field techs instantly. No app store friction."
          />
          <Pillar 
            icon="security" 
            title="Sealed Data" 
            desc="Server-synchronized timestamps are baked into every photographic capture. Evidence you can rely on."
          />
          <Pillar 
            icon="auto_awesome" 
            title="Auto-Reports" 
            desc="Professional PDF reports are prepared and archived the moment a job is sealed. Accelerate your billing cycle."
          />
        </div>
      </section>

      {/* Pricing - Strategic MRR Structure */}
      <section id="pricing" className="py-32 px-6 bg-slate-900/20">
        <div className="max-w-7xl mx-auto space-y-16">
           <div className="text-center space-y-4">
              <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter italic">Professional Scaling</h2>
              <p className="text-slate-400 font-medium">Clear pricing designed for growth. No hidden per-job fees.</p>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <PriceCard tier="Solo" price="29" features={['1 Admin Hub', '1 Technician Portal', 'Unlimited Reports', 'Email Support']} />
              <PriceCard tier="Team" price="59" features={['3 Admin Hubs', '5 Technician Portals', 'Job Templates', 'Priority Dispatch']} active />
              <PriceCard tier="Agency" price="99" features={['Unlimited Workforce', 'Custom Branding', 'API Integration', 'Dedicated Manager']} />
           </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 px-6">
        <div className="max-w-5xl mx-auto bg-primary rounded-[4rem] p-16 md:p-24 text-center relative overflow-hidden shadow-[0_0_100px_-20px_rgba(37,99,235,0.4)]">
           <div className="absolute -top-1/2 -right-1/4 size-96 bg-white/10 blur-[100px] rounded-full"></div>
           <h2 className="text-4xl md:text-6xl font-black text-white leading-tight mb-8 italic tracking-tighter">SECURE YOUR <br /> OPERATIONS</h2>
           <p className="text-blue-100 text-xl font-medium mb-12 max-w-xl mx-auto opacity-90">Start capturing verifiable proof of work and eliminate operational ambiguity today.</p>
           <Link to="/admin" className="inline-block bg-white text-primary px-12 py-6 rounded-[2rem] font-black text-2xl hover:bg-slate-50 transition-all shadow-2xl active:scale-95">
              Launch Hub
           </Link>
        </div>
      </section>

      <footer className="py-20 border-t border-white/5 text-center space-y-8">
         <div className="flex items-center justify-center gap-3">
            <div className="bg-slate-800 size-8 rounded-lg flex items-center justify-center"><span className="material-symbols-outlined text-sm">verified</span></div>
            <span className="font-black text-white tracking-tighter">JobProof</span>
         </div>
         <div className="flex justify-center gap-8 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <Link to="/legal/privacy" className="hover:text-primary transition-colors">Privacy</Link>
            <Link to="/legal/terms" className="hover:text-primary transition-colors">Terms</Link>
            <Link to="/admin/help" className="hover:text-primary transition-colors">Help</Link>
            <Link to="/admin/billing" className="hover:text-primary transition-colors">Billing</Link>
         </div>
         <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest">&copy; 2024 JobProof Technologies. All systems operational.</p>
      </footer>
    </div>
  );
};

const PriceCard = ({ tier, price, features, active }: any) => (
  <div className={`p-10 rounded-[3rem] border transition-all ${active ? 'bg-primary border-primary shadow-2xl shadow-primary/20 scale-105 z-10' : 'bg-slate-900 border-white/5 hover:border-white/10'}`}>
     <h3 className={`text-xl font-black italic uppercase tracking-tighter mb-2 ${active ? 'text-white' : 'text-slate-400'}`}>{tier}</h3>
     <div className="flex items-baseline gap-1 mb-8">
        <span className={`text-4xl font-black ${active ? 'text-white' : 'text-white'}`}>£{price}</span>
        <span className={`text-sm font-bold ${active ? 'text-blue-200' : 'text-slate-500'}`}>/month</span>
     </div>
     <ul className="space-y-4 mb-10">
        {features.map((f: string) => (
           <li key={f} className={`flex items-center gap-3 text-sm font-bold ${active ? 'text-white' : 'text-slate-300'}`}>
              <span className="material-symbols-outlined text-lg">check_circle</span>
              {f}
           </li>
        ))}
     </ul>
     <button className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${active ? 'bg-white text-primary hover:bg-blue-50' : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'}`}>
        Choose {tier}
     </button>
  </div>
);

const Pillar = ({ icon, title, desc }: any) => (
  <div className="space-y-6 group">
    <div className="size-16 rounded-[2rem] bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform shadow-inner">
      <span className="material-symbols-outlined text-3xl">{icon}</span>
    </div>
    <div className="space-y-2">
      <h3 className="text-2xl font-black text-white italic tracking-tighter">{title}</h3>
      <p className="text-slate-400 leading-relaxed font-medium">{desc}</p>
    </div>
  </div>
);

export default LandingPage;
