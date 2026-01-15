
import React from 'react';
import Layout from '../../components/Layout';

const AuditReport: React.FC = () => {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-12 pb-24">
        <div className="bg-primary/10 border border-primary/20 p-8 rounded-3xl">
           <h1 className="text-4xl font-black text-white mb-4">JobProof v2 Audit Report</h1>
           <p className="text-slate-400 leading-relaxed text-lg">
             A high-fidelity architectural blueprint for a modern field-service proof-of-work application. 
             This specification covers the full E2E flow from dispatch to verifiable report generation.
           </p>
        </div>

        <section className="space-y-6">
           <h2 className="text-2xl font-bold text-white border-l-4 border-primary pl-4">A. Architecture Map</h2>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                 <h3 className="font-bold text-primary mb-4">Frontend Layer</h3>
                 <ul className="space-y-2 text-sm text-slate-400">
                    <li>• <span className="text-white">Next.js 14 App Router:</span> SSR for dashboards, CSR for field app.</li>
                    <li>• <span className="text-white">Tailwind CSS:</span> Utility-first styling for speed.</li>
                    <li>• <span className="text-white">Shadcn UI:</span> Reusable, accessible component library.</li>
                    <li>• <span className="text-white">React Hook Form + Zod:</span> Type-safe form validation.</li>
                 </ul>
              </div>
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                 <h3 className="font-bold text-success mb-4">Backend Layer (Supabase)</h3>
                 <ul className="space-y-2 text-sm text-slate-400">
                    <li>• <span className="text-white">Auth:</span> Magic links for admins, anonymous links for techs.</li>
                    <li>• <span className="text-white">Database:</span> Postgres with multi-tenant schema.</li>
                    <li>• <span className="text-white">Storage:</span> S3 buckets for photo evidence.</li>
                    <li>• <span className="text-white">Edge Functions:</span> PDF generation & Resend email trigger.</li>
                 </ul>
              </div>
           </div>
        </section>

        <section className="space-y-6">
           <h2 className="text-2xl font-bold text-white border-l-4 border-primary pl-4">B. Database Schema (SQL)</h2>
           <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 font-mono text-[11px] leading-tight overflow-x-auto text-slate-300">
<pre>{`-- Multi-tenant Schema
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  branding_logo TEXT,
  accent_color TEXT DEFAULT '#137FEC'
);

CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id),
  title TEXT NOT NULL,
  client_name TEXT NOT NULL,
  address TEXT NOT NULL,
  status TEXT CHECK (status IN ('Pending', 'In Progress', 'Submitted')) DEFAULT 'Pending',
  tech_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ
);

CREATE TABLE job_evidence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  geo_lat FLOAT,
  geo_long FLOAT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS)
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can access org jobs" ON jobs
  USING (org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()));`}</pre>
           </div>
        </section>

        <section className="space-y-6">
           <h2 className="text-2xl font-bold text-white border-l-4 border-primary pl-4">C. E2E Flow Diagram</h2>
           <div className="space-y-4">
              <FlowItem step="1" title="Dispatch" desc="Admin creates job. Supabase generates a signed, non-guessable 'Magic Link' for the tech." />
              <FlowItem step="2" title="Field Capture" desc="Tech opens link. Camera captures evidence + EXIF geo-metadata. Signatures captured via Canvas API." />
              <FlowItem step="3" title="Sync & Seal" desc="Submission triggers Edge Function. Photos uploaded to S3. Data sealed in Postgres." />
              <FlowItem step="4" title="Reporting" desc="System generates PDF using @react-pdf/renderer. Resend emails the link to Client and Admin." />
           </div>
        </section>

        <section className="space-y-6">
           <h2 className="text-2xl font-bold text-white border-l-4 border-primary pl-4">D. Deployment Checklist</h2>
           <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 space-y-4">
              <CheckItem label="Set NEXT_PUBLIC_SUPABASE_URL & KEY in Vercel." />
              <CheckItem label="Configure Resend API Key for automated reporting." />
              <CheckItem label="Configure Supabase Storage Bucket 'evidence' to public read, restricted write." />
              <CheckItem label="Ensure 'camera' permissions are requested in manifest/meta tags for mobile chrome." />
              <CheckItem label="Enable Database Webhooks to trigger Post-Submission Edge Functions." />
           </div>
        </section>
      </div>
    </Layout>
  );
};

const FlowItem: React.FC<{ step: string, title: string, desc: string }> = ({ step, title, desc }) => (
  <div className="flex gap-6 items-start">
     <div className="size-10 rounded-full bg-primary flex items-center justify-center text-white font-black shrink-0">{step}</div>
     <div>
        <h4 className="font-bold text-white">{title}</h4>
        <p className="text-slate-400 text-sm">{desc}</p>
     </div>
  </div>
);

const CheckItem: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-3 text-slate-300">
     <span className="material-symbols-outlined text-success">check_circle</span>
     <span className="text-sm">{label}</span>
  </div>
);

export default AuditReport;
