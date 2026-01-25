import React, { useState } from 'react';
import Layout from '../components/Layout';
import { UserProfile } from '../types';
import { useNavigate } from 'react-router-dom';
import { useNavigation } from '../hooks/useNavigation';

interface HelpCenterProps {
  user: UserProfile | null;
}

interface HelpSection {
  id: string;
  icon: string;
  title: string;
  desc: string;
  path?: string;
  content?: React.ReactNode;
}

const HelpCenter: React.FC<HelpCenterProps> = ({ user }) => {
  const navigate = useNavigate();
  const { goBack } = useNavigation('/admin');
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  const helpSections: HelpSection[] = [
    {
      id: 'getting-started',
      icon: 'rocket_launch',
      title: 'Getting Started',
      desc: 'How to create your first job and invite your workforce.',
      content: (
        <div className="space-y-6">
          <div>
            <h4 className="text-lg font-black text-white uppercase tracking-tight mb-3">Quick Start Guide</h4>
            <ol className="space-y-3 text-sm text-slate-300">
              <li className="flex gap-3">
                <span className="font-black text-primary">1.</span>
                <span><span className="font-bold">Verify Your Email</span> - Check your inbox for the verification link we sent when you signed up.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-black text-primary">2.</span>
                <span><span className="font-bold">Add Clients</span> - Navigate to Clients and register your customers.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-black text-primary">3.</span>
                <span><span className="font-bold">Add Technicians</span> - Add your field agents who will capture evidence.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-black text-primary">4.</span>
                <span><span className="font-bold">Dispatch a Job</span> - Create your first job and send the magic link to your technician.</span>
              </li>
            </ol>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/admin/clients')}
              className="flex-1 px-4 py-3 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary rounded-xl text-xs font-black uppercase tracking-widest transition-all"
            >
              Add Clients
            </button>
            <button
              onClick={() => navigate('/admin/technicians')}
              className="flex-1 px-4 py-3 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary rounded-xl text-xs font-black uppercase tracking-widest transition-all"
            >
              Add Technicians
            </button>
          </div>
        </div>
      )
    },
    {
      id: 'mobile-offline',
      icon: 'wifi_off',
      title: 'Mobile & Offline',
      desc: 'Using JobProof in basements and remote sites without signal.',
      content: (
        <div className="space-y-4 text-sm text-slate-300">
          <p className="leading-relaxed">
            JobProof is built <span className="font-bold text-white">offline-first</span>. All your work is saved locally on your device in IndexedDB, then synced to the cloud when you're back online.
          </p>
          <div className="bg-slate-800 border border-white/5 rounded-xl p-4 space-y-2">
            <h5 className="font-black text-white uppercase text-xs">What works offline:</h5>
            <ul className="space-y-1 text-xs">
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-success text-sm">check_circle</span>
                Photo capture and storage
              </li>
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-success text-sm">check_circle</span>
                Safety checklist completion
              </li>
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-success text-sm">check_circle</span>
                Signature collection
              </li>
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-success text-sm">check_circle</span>
                Job summary and notes
              </li>
            </ul>
          </div>
          <div className="bg-warning/10 border border-warning/20 rounded-xl p-4">
            <p className="text-xs font-bold text-warning uppercase mb-1">Pro Tip</p>
            <p className="text-xs text-slate-300">
              Your device will show an offline indicator when there's no connection. All changes will sync automatically when you're back online.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'evidence-guide',
      icon: 'photo_camera',
      title: 'Evidence Guide',
      desc: 'Capturing categorized photos and signatures effectively.',
      content: (
        <div className="space-y-4 text-sm text-slate-300">
          <p className="leading-relaxed">
            JobProof uses a <span className="font-bold text-white">3-phase photo categorization</span> system to ensure comprehensive evidence capture:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-800 border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="size-8 bg-primary/20 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-sm">photo_camera</span>
                </div>
                <h5 className="font-black text-white uppercase text-xs">Before</h5>
              </div>
              <p className="text-xs text-slate-400">Initial site conditions, existing damage, baseline state</p>
            </div>
            <div className="bg-slate-800 border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="size-8 bg-warning/20 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-warning text-sm">construction</span>
                </div>
                <h5 className="font-black text-white uppercase text-xs">During</h5>
              </div>
              <p className="text-xs text-slate-400">Work in progress, process photos, intermediate steps</p>
            </div>
            <div className="bg-slate-800 border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="size-8 bg-success/20 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-success text-sm">check_circle</span>
                </div>
                <h5 className="font-black text-white uppercase text-xs">After</h5>
              </div>
              <p className="text-xs text-slate-400">Completed work, final results, clean site</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Use the phase tabs in the TechnicianPortal to switch between categories while capturing evidence.
          </p>
        </div>
      )
    },
    {
      id: 'privacy-security',
      icon: 'security',
      title: 'Privacy & Security',
      desc: 'How we protect your operational data and signatures.',
      content: (
        <div className="space-y-4 text-sm text-slate-300">
          <p className="leading-relaxed">
            JobProof implements <span className="font-bold text-white">enterprise-grade security</span> to protect your evidence and ensure data integrity:
          </p>
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="size-8 bg-success/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-success text-sm">encrypted</span>
              </div>
              <div>
                <h5 className="font-bold text-white text-xs uppercase mb-1">End-to-End Encryption</h5>
                <p className="text-xs text-slate-400">All data is encrypted in transit (TLS) and at rest (AES-256).</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="size-8 bg-success/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-success text-sm">verified_user</span>
              </div>
              <div>
                <h5 className="font-bold text-white text-xs uppercase mb-1">Cryptographic Sealing</h5>
                <p className="text-xs text-slate-400">Jobs are sealed with HMAC signatures to prevent tampering.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="size-8 bg-success/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-success text-sm">shield</span>
              </div>
              <div>
                <h5 className="font-bold text-white text-xs uppercase mb-1">Row-Level Security</h5>
                <p className="text-xs text-slate-400">Database access controlled by workspace isolation and RLS policies.</p>
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  const faqs = [
    {
      id: 'offline-usage',
      q: 'Can I use the app without internet?',
      a: 'Yes. JobProof is offline-first. All photos, safety checks, and signatures are stored in a local persistent queue on your device. They sync automatically to the hub as soon as a data connection is restored.'
    },
    {
      id: 'photo-categories',
      q: 'How do I capture categorized photos?',
      a: 'In the field app, use the phase tabs (Before, During, After) to tag your evidence. This categorization is baked into the final report for clear proof-of-work. Switch between tabs while capturing to organize your photos.'
    },
    {
      id: 'sealed-signature',
      q: 'Can I edit a signature after it\'s sealed?',
      a: 'No. To ensure integrity and non-repudiation, sealed signatures are immutable. If a signature is incorrect, the job must be invalidated and a new protocol initiated. This is a security feature.'
    },
    {
      id: 'what3words',
      q: 'What is what3words integration?',
      a: 'what3words divides the world into 3m squares, each with a unique 3-word address. We capture this as a human-readable location signal alongside precise GPS coordinates for every evidence capture, making locations easy to communicate and verify.'
    },
    {
      id: 'magic-links',
      q: 'How do magic links work?',
      a: 'When you dispatch a job, we generate a secure, time-limited link that gives technicians access to that specific job only. Send it via SMS, QR code, or any messaging app. The link expires after 7 days for security.'
    },
    {
      id: 'sync-failed',
      q: 'What if a sync fails?',
      a: 'Failed syncs are shown in the dashboard with a "Retry" button. Common causes are network timeouts or file size limits. Click retry to attempt sync again. All data remains safely stored locally until successfully synced.'
    }
  ];

  const toggleFAQ = (id: string) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  return (
    <Layout user={user}>
      <div className="max-w-5xl mx-auto space-y-12 pb-24">
        {/* Back Button */}
        <div className="pt-6">
          <button
            onClick={() => goBack()}
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Back
          </button>
        </div>

        <div className="text-center space-y-4">
          <div className="size-16 bg-primary/20 rounded-[2rem] flex items-center justify-center mx-auto border border-primary/20">
            <span className="material-symbols-outlined text-primary text-4xl">help_center</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tighter uppercase leading-none">Support</h2>
          <p className="text-slate-400 text-base sm:text-lg max-w-xl mx-auto font-medium">Documentation, FAQs, and operational best practices.</p>
        </div>

        {/* Help Topic Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {helpSections.map(section => (
            <HelpCard
              key={section.id}
              icon={section.icon}
              title={section.title}
              desc={section.desc}
              onClick={() => setSelectedSection(selectedSection === section.id ? null : section.id)}
              isExpanded={selectedSection === section.id}
            />
          ))}
        </div>

        {/* Expanded Section Content */}
        {selectedSection && (
          <div className="bg-slate-900 border border-white/10 p-8 sm:p-12 rounded-[2rem] sm:rounded-[3rem] shadow-2xl animate-in">
            <button
              onClick={() => setSelectedSection(null)}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6 group"
            >
              <span className="material-symbols-outlined text-sm group-hover:-translate-x-1 transition-transform">arrow_back</span>
              <span className="text-xs font-black uppercase tracking-widest">Back to Topics</span>
            </button>
            {helpSections.find(s => s.id === selectedSection)?.content}
          </div>
        )}

        {/* Operational FAQs */}
        <section className="bg-slate-900 border border-white/5 p-8 sm:p-12 rounded-[2rem] sm:rounded-[3rem] space-y-8 shadow-2xl">
          <div className="space-y-2">
            <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tighter border-l-4 border-primary pl-4">Operational FAQs</h3>
            <p className="text-slate-400 text-sm pl-4">Click any question to expand the answer</p>
          </div>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <ExpandableFAQItem
                key={faq.id}
                q={faq.q}
                a={faq.a}
                isExpanded={expandedFAQ === faq.id}
                onToggle={() => toggleFAQ(faq.id)}
              />
            ))}
          </div>
        </section>

        {/* Help Tips */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-8 sm:p-10 rounded-[2rem] sm:rounded-[3rem] text-center space-y-4">
          <div className="size-14 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-primary text-3xl">tips_and_updates</span>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight">Quick Tips</h3>
            <p className="text-slate-300 text-sm max-w-md mx-auto">
              Get the most out of JobProof with these helpful tips.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left max-w-lg mx-auto">
            <div className="bg-slate-900/50 border border-white/5 p-4 rounded-xl">
              <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Bookmark the App</p>
              <p className="text-xs text-slate-300">Add JobProof to your home screen for quick access. On mobile, tap the share button and select "Add to Home Screen".</p>
            </div>
            <div className="bg-slate-900/50 border border-white/5 p-4 rounded-xl">
              <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Offline Ready</p>
              <p className="text-xs text-slate-300">Photos are saved locally first. Even without internet, your evidence is safe and will sync when you reconnect.</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

const HelpCard = ({ icon, title, desc, onClick, isExpanded }: any) => (
  <button
    onClick={onClick}
    className={`
      bg-slate-900 border p-6 sm:p-8 rounded-2xl sm:rounded-[2.5rem] space-y-4 transition-all text-left group shadow-xl w-full
      ${isExpanded
        ? 'border-primary/40 bg-primary/5'
        : 'border-white/5 hover:border-primary/20'
      }
    `}
  >
    <div className="flex items-start justify-between gap-4">
      <div className={`
        size-12 sm:size-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all
        ${isExpanded
          ? 'bg-primary/20 scale-110'
          : 'bg-primary/10 group-hover:scale-110'
        }
      `}>
        <span className="material-symbols-outlined text-primary text-2xl sm:text-3xl font-black">{icon}</span>
      </div>
      <span className={`material-symbols-outlined transition-transform ${isExpanded ? 'rotate-180 text-primary' : 'text-slate-400'}`}>
        expand_more
      </span>
    </div>
    <div className="space-y-1">
      <h4 className="text-lg sm:text-xl font-black text-white uppercase tracking-tighter">{title}</h4>
      <p className="text-slate-400 text-xs sm:text-sm leading-relaxed font-medium">{desc}</p>
    </div>
    <p className="text-[10px] font-black uppercase text-primary tracking-widest">
      {isExpanded ? 'Collapse ↑' : 'Learn More →'}
    </p>
  </button>
);

const ExpandableFAQItem = ({ q, a, isExpanded, onToggle }: any) => (
  <button
    onClick={onToggle}
    className="w-full text-left bg-slate-800/50 hover:bg-slate-800 border border-white/5 hover:border-primary/20 rounded-xl p-4 sm:p-5 transition-all group"
  >
    <div className="flex items-start gap-3 sm:gap-4">
      <span className="material-symbols-outlined text-primary font-black flex-shrink-0">
        {isExpanded ? 'remove_circle' : 'help_center'}
      </span>
      <div className="flex-1 min-w-0 space-y-2">
        <p className="font-bold text-white text-sm sm:text-base uppercase tracking-tight flex items-center justify-between gap-2">
          <span>{q}</span>
          <span className={`material-symbols-outlined text-sm text-slate-300 group-hover:text-primary transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </p>
        {isExpanded && (
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium animate-in">
            {a}
          </p>
        )}
      </div>
    </div>
  </button>
);

export default HelpCenter;
