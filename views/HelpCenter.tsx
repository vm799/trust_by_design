
import React from 'react';
import Layout from '../components/Layout';

const HelpCenter: React.FC = () => {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-12 pb-24">
        <div className="text-center space-y-4 pt-12">
          <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase">Support Hub</h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">Get the most out of JobProof. Guides, FAQs, and direct human assistance.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <HelpCard 
            icon="school" 
            title="Getting Started" 
            desc="New here? Learn the basics of dispatching and report sealing." 
           />
           <HelpCard 
            icon="camera_alt" 
            title="Field Operations" 
            desc="Tips for technicians on capturing the best evidence in the field." 
           />
           <HelpCard 
            icon="payments" 
            title="Billing & Subs" 
            desc="Information about plans, pricing, and enterprise licenses." 
           />
           <HelpCard 
            icon="terminal" 
            title="API & Integrations" 
            desc="Connect JobProof to your existing ERP or CRM via our webhooks." 
           />
        </div>

        <section className="bg-slate-900 border border-white/5 p-12 rounded-[3rem] space-y-8">
           <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Frequently Asked Questions</h3>
           <div className="space-y-6">
              <FAQItem q="How is the evidence verified?" a="We capture GPS coordinates and server-synchronized timestamps at the exact moment of capture. This metadata is then cryptographically hashed and sealed into the PDF report." />
              <FAQItem q="Do technicians need to download an app?" a="No. JobProof is a progressive web platform. Techs simply click a magic link in their SMS/Email, and the capture interface opens instantly in their browser." />
              <FAQItem q="Can I customize the reports?" a="Yes. Enterprise plans allow for full custom branding, custom CSS for PDF reports, and localized terminology." />
           </div>
        </section>

        <div className="bg-primary p-12 rounded-[3rem] text-center space-y-6 shadow-2xl shadow-primary/20">
           <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter">Still need help?</h3>
           <p className="text-blue-100 font-medium max-w-sm mx-auto">Our specialized support engineers are available for priority assistance.</p>
           <button className="px-12 py-4 bg-white text-primary font-black rounded-2xl text-lg hover:bg-slate-50 transition-all shadow-xl">Contact Support</button>
        </div>
      </div>
    </Layout>
  );
};

const HelpCard = ({ icon, title, desc }: any) => (
  <div className="bg-slate-900 border border-white/5 p-8 rounded-[2.5rem] space-y-4 hover:border-primary/20 transition-all cursor-pointer group">
    <div className="size-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
      <span className="material-symbols-outlined text-3xl">{icon}</span>
    </div>
    <div className="space-y-1">
      <h4 className="text-xl font-black text-white italic uppercase tracking-tighter">{title}</h4>
      <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
    </div>
  </div>
);

const FAQItem = ({ q, a }: any) => (
  <div className="space-y-2">
    <p className="font-bold text-white flex items-center gap-2">
       <span className="material-symbols-outlined text-primary">help_outline</span>
       {q}
    </p>
    <p className="text-sm text-slate-400 pl-8 leading-relaxed">{a}</p>
  </div>
);

export default HelpCenter;
