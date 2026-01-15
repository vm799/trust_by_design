
import React from 'react';
import Layout from '../components/Layout';
import { useParams, Link } from 'react-router-dom';

const LegalPage: React.FC = () => {
  const { type } = useParams();
  const title = type === 'terms' ? 'Terms of Service' : 
                type === 'privacy' ? 'Privacy Policy' : 'Legal Document';

  return (
    <div className="min-h-screen bg-slate-950 p-6 lg:p-12 selection:bg-primary/30">
      <div className="max-w-4xl mx-auto space-y-12 bg-white text-slate-900 p-12 lg:p-20 rounded-[3rem] shadow-2xl">
        <header className="border-b border-slate-100 pb-12 flex justify-between items-start">
           <div>
             <Link to="/home" className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest mb-8">
               <span className="material-symbols-outlined text-lg">arrow_back</span>
               Back to Home
             </Link>
             <h1 className="text-5xl font-black tracking-tighter italic uppercase">{title}</h1>
             <p className="text-slate-400 font-bold mt-2">Effective Date: Jan 2024</p>
           </div>
           <div className="bg-primary size-12 rounded-xl flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-primary/20">J</div>
        </header>

        <article className="space-y-8 prose prose-slate">
           <section className="space-y-4">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter border-l-4 border-primary pl-4">1. General Terms</h2>
              <p className="text-slate-600 font-medium leading-relaxed">
                 By accessing JobProof, you agree to be bound by these terms. JobProof provides a verifiable proof-of-work protocol for businesses. We are not responsible for the accuracy of data captured by independent technicians.
              </p>
           </section>

           <section className="space-y-4">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter border-l-4 border-primary pl-4">2. Data & Verification</h2>
              <p className="text-slate-600 font-medium leading-relaxed">
                 All evidence captured (photos, GPS, timestamps) is processed to provide a verifiable record. We implement security best practices to protect the integrity of the "Seal", but users acknowledge that digital data is subject to system availability.
              </p>
           </section>

           <section className="space-y-4">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter border-l-4 border-primary pl-4">3. Subscriptions</h2>
              <p className="text-slate-600 font-medium leading-relaxed">
                 Subscription fees are non-refundable except where required by law. Users may cancel their plans at any time via the Billing dashboard.
              </p>
           </section>

           <section className="space-y-4">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter border-l-4 border-primary pl-4">4. Compliance</h2>
              <p className="text-slate-600 font-medium leading-relaxed">
                 Users are responsible for ensuring that their capture of field evidence (including photos of private property) complies with local privacy and data protection laws.
              </p>
           </section>
        </article>

        <footer className="pt-12 border-t border-slate-100 text-center">
           <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">© 2024 JobProof Technologies Ltd. All Rights Reserved.</p>
        </footer>
      </div>
    </div>
  );
};

export default LegalPage;
