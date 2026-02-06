import React from 'react';
import Layout from '../components/AppLayout';

const RoadmapView: React.FC = () => {
  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-12 pb-24">
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-white tracking-tighter uppercase">Product Roadmap</h2>
          <p className="text-slate-400 text-sm">Our development timeline and commitment to building a real trust system.</p>
        </div>

        {/* Timeline Overview */}
        <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-8 space-y-6">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Current Phase</h3>
          <div className="flex items-center gap-6">
            <div className="bg-primary/10 px-6 py-3 rounded-2xl border border-primary/20">
              <p className="text-primary font-black uppercase tracking-wider">Phase C: Trust Foundation</p>
              <p className="text-slate-400 text-xs mt-1">Weeks 1-4 • In Progress</p>
            </div>
            <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-primary w-[10%] rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Completed Features */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-success text-3xl font-black">check_circle</span>
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Completed</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FeatureCard
              status="completed"
              title="Offline Photo Storage"
              description="IndexedDB-based offline evidence capture"
            />
            <FeatureCard
              status="completed"
              title="GPS Location Capture"
              description="Browser-based geolocation tracking"
            />
            <FeatureCard
              status="completed"
              title="Canvas Signature Capture"
              description="HTML5 canvas digital signatures"
            />
            <FeatureCard
              status="completed"
              title="Sync Queue with Retry"
              description="Exponential backoff for failed uploads"
            />
            <FeatureCard
              status="completed"
              title="Job Status Workflow"
              description="Pending → In Progress → Submitted flow"
            />
            <FeatureCard
              status="completed"
              title="Report PDF Generation"
              description="Browser print dialog for PDF export"
            />
          </div>
        </section>

        {/* In Development */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-3xl font-black animate-spin">sync</span>
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter">In Development</h3>
            <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-black uppercase">Phase C</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FeatureCard
              status="in-progress"
              title="Real Authentication"
              description="Supabase Auth with email/password + Google OAuth"
              phase="C.1"
            />
            <FeatureCard
              status="in-progress"
              title="Workspace Isolation"
              description="Multi-tenant RLS policies and tokenized magic links"
              phase="C.2"
            />
            <FeatureCard
              status="in-progress"
              title="Cryptographic Sealing"
              description="Hash-based evidence sealing with server signatures"
              phase="C.3"
            />
            <FeatureCard
              status="in-progress"
              title="Audit Trail"
              description="Append-only access logs and tamper detection"
              phase="C.4"
            />
            <FeatureCard
              status="in-progress"
              title="MFA (Optional)"
              description="Multi-factor authentication for admins"
              phase="C.1"
            />
            <FeatureCard
              status="in-progress"
              title="Legal Disclaimers"
              description="Clear positioning as technical tool, not legal authority"
              phase="C.5"
            />
          </div>
        </section>

        {/* Planned - Phase D */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-blue-400 text-3xl font-black">schedule</span>
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Planned</h3>
            <span className="bg-blue-400/10 text-blue-400 px-3 py-1 rounded-full text-xs font-black uppercase">Phase D</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FeatureCard
              status="planned"
              title="GPS Validation"
              description="Mapbox integration for location verification"
              phase="D.1"
              timeline="Weeks 5-7"
            />
            <FeatureCard
              status="planned"
              title="Photo Hashing"
              description="SHA-256 hashing for evidence integrity"
              phase="D.3"
              timeline="Weeks 5-7"
            />
            <FeatureCard
              status="planned"
              title="Signature Binding"
              description="Link signatures to account identity"
              phase="D.4"
              timeline="Weeks 5-7"
            />
            <FeatureCard
              status="planned"
              title="Protocol System"
              description="Configurable evidence capture templates"
              phase="D.6"
              timeline="Weeks 5-7"
            />
            <FeatureCard
              status="planned"
              title="Safety Enforcement"
              description="Block submission if required items unchecked"
              phase="D.5"
              timeline="Weeks 5-7"
            />
            <FeatureCard
              status="planned"
              title="Evidence Encryption"
              description="Encrypt photos at rest in cloud storage"
              phase="D.3"
              timeline="Weeks 5-7"
            />
          </div>
        </section>

        {/* Planned - Phase E */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-purple-400 text-3xl font-black">calendar_month</span>
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Business Systems</h3>
            <span className="bg-purple-400/10 text-purple-400 px-3 py-1 rounded-full text-xs font-black uppercase">Phase E</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FeatureCard
              status="planned"
              title="Stripe Integration"
              description="Subscription management and billing"
              phase="E.1"
              timeline="Weeks 8-10"
            />
            <FeatureCard
              status="planned"
              title="Usage Tracking"
              description="Real metrics: sealed records, storage used"
              phase="E.1"
              timeline="Weeks 8-10"
            />
            <FeatureCard
              status="planned"
              title="Tiered Limits"
              description="Free/Pro/Team/Enterprise tiers with enforcement"
              phase="E.1"
              timeline="Weeks 8-10"
            />
            <FeatureCard
              status="planned"
              title="GDPR Compliance"
              description="Data export, right to erasure, retention policies"
              phase="E.3"
              timeline="Weeks 8-10"
            />
            <FeatureCard
              status="planned"
              title="Invoice Export"
              description="CSV export for QuickBooks/Xero (manual)"
              phase="E.2"
              timeline="Weeks 8-10"
            />
            <FeatureCard
              status="planned"
              title="Data Retention"
              description="Automated deletion: 30d/1y/3y/7y by tier"
              phase="E.3"
              timeline="Weeks 8-10"
            />
          </div>
        </section>

        {/* Future Features */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-slate-500 text-3xl font-black">rocket_launch</span>
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Future Features</h3>
            <span className="bg-slate-800 text-slate-400 px-3 py-1 rounded-full text-xs font-black uppercase">Post-Beta</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FutureFeatureCard
              title="what3words Integration"
              description="Dual-location verification with what3words API"
              icon="pin_drop"
            />
            <FutureFeatureCard
              title="QuickBooks API"
              description="Automated invoice sync with QuickBooks"
              icon="receipt_long"
            />
            <FutureFeatureCard
              title="External Timestamp Authority"
              description="RFC 3161 compliant trusted timestamps"
              icon="schedule"
            />
            <FutureFeatureCard
              title="Advanced Verification"
              description="Enhanced evidence verification options"
              icon="verified"
            />
            <FutureFeatureCard
              title="Video Evidence"
              description="Capture and seal video evidence"
              icon="videocam"
            />
            <FutureFeatureCard
              title="Mobile Native Apps"
              description="iOS and Android native applications"
              icon="phone_iphone"
            />
            <FutureFeatureCard
              title="Salesforce Integration"
              description="CRM sync with Salesforce"
              icon="cloud"
            />
            <FutureFeatureCard
              title="SOC 2 Type II"
              description="Enterprise security certification"
              icon="shield"
            />
            <FutureFeatureCard
              title="Real-time Collaboration"
              description="Multiple users on same evidence capture"
              icon="group"
            />
          </div>
        </section>

        {/* Milestones */}
        <section className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-8 space-y-6">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Key Milestones</h3>
          <div className="space-y-4">
            <Milestone
              week="Week 4"
              title="Trust Foundation Complete"
              items={[
                "Real authentication",
                "Cryptographic sealing",
                "Audit trail",
                "False UI claims removed"
              ]}
              status="in-progress"
            />
            <Milestone
              week="Week 7"
              title="Verification Complete"
              items={[
                "GPS validation",
                "Photo hashing",
                "Protocol system",
                "Safety enforcement"
              ]}
              status="planned"
            />
            <Milestone
              week="Week 10"
              title="Beta Ready"
              items={[
                "Subscription tiers live",
                "Usage limits enforced",
                "GDPR compliant",
                "All critical audit findings closed"
              ]}
              status="planned"
            />
          </div>
        </section>

        {/* Legal Notice */}
        <div className="bg-slate-900 border border-warning/20 rounded-[2.5rem] p-8">
          <div className="flex items-start gap-4">
            <span className="material-symbols-outlined text-warning text-2xl font-black">info</span>
            <div className="space-y-2">
              <h3 className="text-sm font-black text-white uppercase">Development Transparency</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                This roadmap reflects our commitment to building a real trust system, not a demo.
                All "In Development" features are actively being built and will be completed before beta launch.
                Features marked "Future" are not yet scheduled but represent our long-term vision.
              </p>
              <p className="text-slate-400 text-sm leading-relaxed">
                We maintain this roadmap with complete honesty. If a feature is not implemented,
                we do not claim it exists. Trust by Design is a technical evidence tool, not a legal authority.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

const FeatureCard = ({ status, title, description, phase, timeline }: any) => {
  const colors = {
    completed: { bg: 'bg-success/10', border: 'border-success/20', text: 'text-success', icon: 'check_circle' },
    'in-progress': { bg: 'bg-primary/10', border: 'border-primary/20', text: 'text-primary', icon: 'sync' },
    planned: { bg: 'bg-blue-400/10', border: 'border-blue-400/20', text: 'text-blue-400', icon: 'schedule' }
  };

  const c = colors[status as keyof typeof colors];

  return (
    <div className={`${c.bg} border ${c.border} p-6 rounded-2xl space-y-3`}>
      <div className="flex items-start justify-between">
        <h4 className="text-white font-black uppercase tracking-tight">{title}</h4>
        <span className={`material-symbols-outlined ${c.text} text-xl font-black ${status === 'in-progress' ? 'animate-spin' : ''}`}>
          {c.icon}
        </span>
      </div>
      <p className="text-slate-400 text-xs leading-relaxed">{description}</p>
      {phase && (
        <div className="flex items-center gap-2 text-[10px] font-black uppercase">
          <span className={`${c.text}`}>{phase}</span>
          {timeline && <span className="text-slate-500">• {timeline}</span>}
        </div>
      )}
    </div>
  );
};

const FutureFeatureCard = ({ title, description, icon }: any) => (
  <div className="bg-slate-800/50 border border-white/5 p-6 rounded-2xl space-y-3 hover:border-primary/20 transition-all group">
    <span className={`material-symbols-outlined text-slate-500 text-3xl font-black group-hover:text-primary transition-colors`}>
      {icon}
    </span>
    <h4 className="text-white font-black uppercase tracking-tight text-sm">{title}</h4>
    <p className="text-slate-500 text-xs leading-relaxed">{description}</p>
  </div>
);

const Milestone = ({ week, title, items, status }: any) => {
  const isActive = status === 'in-progress';

  return (
    <div className={`p-6 rounded-2xl border ${isActive ? 'bg-primary/5 border-primary/20' : 'bg-white/5 border-white/5'}`}>
      <div className="flex items-start gap-4">
        <div className={`px-3 py-1 rounded-lg text-xs font-black uppercase ${isActive ? 'bg-primary text-white' : 'bg-slate-800 text-slate-400'}`}>
          {week}
        </div>
        <div className="flex-1 space-y-2">
          <h4 className="text-white font-black uppercase tracking-tight">{title}</h4>
          <ul className="space-y-1">
            {items.map((item: string, i: number) => (
              <li key={i} className="text-slate-400 text-xs flex items-center gap-2">
                <span className={`size-1.5 rounded-full ${isActive ? 'bg-primary' : 'bg-slate-600'}`}></span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default RoadmapView;
