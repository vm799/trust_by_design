
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
               <span className="material-symbols-outlined text-lg font-black">arrow_back</span>
               Home
             </Link>
             <h1 className="text-5xl font-black tracking-tighter uppercase">{title}</h1>
             <p className="text-slate-400 font-bold mt-2 uppercase text-xs">Revised: Jan 2024</p>
           </div>
           <div className="bg-primary size-12 rounded-xl flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-primary/20">J</div>
        </header>

        <article className="space-y-8 prose prose-slate">
           <section className="space-y-4">
              <h2 className="text-2xl font-black uppercase tracking-tighter border-l-4 border-primary pl-4">1. General Protocols</h2>
              <p className="text-slate-600 font-medium leading-relaxed">
                 By accessing the JobProof hub, you agree to adhere to these operational protocols. JobProof provides a verifiable infrastructure for field service documentation.
              </p>
           </section>

           <section className="space-y-4">
              <h2 className="text-2xl font-black uppercase tracking-tighter border-l-4 border-primary pl-4">2. Data Sovereignty</h2>
              <p className="text-slate-600 font-medium leading-relaxed">
                 All field evidence (photos, metadata, signatures) is processed as a verifiable record. We implement security best practices to protect the integrity of every sealed report.
              </p>
           </section>
        </article>

        <footer className="pt-12 border-t border-slate-100 text-center">
           <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">© 2024 JobProof Technologies. System Verified.</p>
        </footer>
      </div>
    </div>
  );
};

export default LegalPage;
