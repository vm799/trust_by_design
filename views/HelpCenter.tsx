import React from 'react';
import Layout from '../components/Layout';
import { UserProfile } from '../types';

interface HelpCenterProps {
  user: UserProfile | null;
}

const HelpCenter: React.FC<HelpCenterProps> = ({ user }) => {
  return (
    <Layout user={user}>
      <div className="max-w-4xl mx-auto space-y-12 pb-24">
        <div className="text-center space-y-4 pt-12">
          <h2 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">Support</h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto font-medium">Documentation, FAQs, and operational best practices.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <HelpCard icon="rocket_launch" title="Getting Started" desc="How to create your first job and invite your workforce." />
          <HelpCard icon="wifi_off" title="Mobile & Offline" desc="Using JobProof in basements and remote sites without signal." />
          <HelpCard icon="photo_camera" title="Evidence Guide" desc="Capturing categorized photos and signatures effectively." />
          <HelpCard icon="security" title="Privacy & Security" desc="How we protect your operational data and signatures." />
        </div>

        <section className="bg-slate-900 border border-white/5 p-12 rounded-[3rem] space-y-10 shadow-2xl">
          <div className="space-y-8">
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter border-l-4 border-primary pl-4">Operational FAQs</h3>
            <div className="space-y-8">
              <FAQItem
                q="Can I use the app without internet?"
                a="Yes. JobProof is offline-first. All photos, safety checks, and signatures are stored in a local persistent queue on your device. They sync automatically to the hub as soon as a data connection is restored."
              />
              <FAQItem
                q="How do I capture categorized photos?"
                a="In the field app, use the phase tabs (Before, During, After) to tag your evidence. This categorization is baked into the final report for clear proof-of-work."
              />
              <FAQItem
                q="Can I edit a signature after it's sealed?"
                a="No. To ensure integrity and non-repudiation, sealed signatures are immutable. If a signature is incorrect, the job must be invalidated and a new protocol initiated."
              />
              <FAQItem
                q="What is what3words integration?"
                a="what3words divides the world into 3m squares. We capture this as a human-readable location signal alongside precise GPS coordinates for every evidence capture."
              />
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
};

const HelpCard = ({ icon, title, desc }: any) => (
  <div className="bg-slate-900 border border-white/5 p-8 rounded-[2.5rem] space-y-4 hover:border-primary/20 transition-all cursor-pointer group shadow-xl">
    <div className="size-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
      <span className="material-symbols-outlined text-3xl font-black">{icon}</span>
    </div>
    <div className="space-y-1">
      <h4 className="text-xl font-black text-white uppercase tracking-tighter">{title}</h4>
      <p className="text-slate-400 text-sm leading-relaxed font-medium">{desc}</p>
    </div>
  </div>
);

const FAQItem = ({ q, a }: any) => (
  <div className="space-y-3">
    <p className="font-bold text-white flex items-center gap-3 uppercase text-sm tracking-tight">
      <span className="material-symbols-outlined text-primary font-black">help_center</span>
      {q}
    </p>
    <p className="text-sm text-slate-400 pl-9 leading-relaxed font-medium">{a}</p>
  </div>
);

export default HelpCenter;
