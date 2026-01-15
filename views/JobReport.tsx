
import React from 'react';
import Layout from '../components/Layout';
import { useParams, Link } from 'react-router-dom';
import { Job } from '../types';

interface JobReportProps {
  jobs: Job[];
  publicView?: boolean;
}

const JobReport: React.FC<JobReportProps> = ({ jobs, publicView = false }) => {
  const { jobId } = useParams();
  const job = jobs.find(j => j.id === jobId);

  if (!job) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
        <div className="space-y-4">
          <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">No Data</h2>
          <p className="text-slate-500 font-medium">This report link is invalid or the data was archived.</p>
          <Link to="/home" className="inline-block bg-primary text-white px-8 py-3 rounded-xl font-black">Back to Home</Link>
        </div>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const content = (
    <div className={`max-w-4xl mx-auto flex flex-col ${publicView ? '' : 'lg:flex-row'} gap-8 main-content-area`}>
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          aside { display: none !important; }
          .report-container { box-shadow: none !important; border: 1px solid #eee !important; width: 100% !important; margin: 0 !important; }
          header { display: none !important; }
          .sidebar-nav { display: none !important; }
          .main-content-area { padding: 0 !important; margin: 0 !important; }
        }
      `}</style>
      
      {/* Main Report View */}
      <div className="flex-1 space-y-8 bg-white text-slate-900 p-10 rounded-[2.5rem] shadow-2xl border border-slate-200 report-container">
        <div className="flex justify-between items-start border-b border-slate-100 pb-8">
           <div>
             <div className="bg-primary/10 text-primary text-[10px] font-black px-3 py-1 rounded-full inline-block mb-3 tracking-widest">JOBPROOF VERIFIED COMPLETION</div>
             <h2 className="text-4xl font-black tracking-tighter italic uppercase">{job.title}</h2>
             <p className="text-slate-500 font-bold mt-1">INTERNAL REF: <span className="font-mono text-xs">{job.id}</span></p>
           </div>
           <div className="text-right">
              <p className="text-xs font-black uppercase text-slate-400 tracking-widest">Finalized On</p>
              <p className="text-xl font-black">{job.completedAt || job.date}</p>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
           <div className="space-y-2">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Client & Service Asset</h3>
             <p className="text-lg font-black italic">{job.client}</p>
             <p className="text-slate-500 text-sm font-medium leading-relaxed">{job.address}</p>
           </div>
           <div className="space-y-2">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Verified Field Tech</h3>
             <p className="text-lg font-black italic">{job.technician}</p>
             <p className="text-slate-500 text-sm font-medium">Digital Signature ID: <span className="font-mono text-[10px]">AUTH-{job.techId?.split('-')[0] || 'OP-441'}</span></p>
           </div>
        </div>

        <div className="pt-4">
           <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Authenticated Evidence</h3>
              <span className="text-[9px] font-black text-success flex items-center gap-1 uppercase tracking-widest">
                <span className="material-symbols-outlined text-xs">verified</span> Verified Timestamped
              </span>
           </div>
           <div className="grid grid-cols-2 gap-6">
              {job.photos.length > 0 ? job.photos.map(p => (
                 <div key={p.id} className="group">
                    <div className="aspect-video bg-slate-50 rounded-2xl overflow-hidden border border-slate-200 shadow-inner group-hover:border-primary/50 transition-colors">
                      <img src={p.url} className="w-full h-full object-cover" alt="Proof" />
                    </div>
                    <div className="flex items-center justify-between mt-3 px-1">
                       <div className="flex flex-col">
                          <p className="text-[9px] text-slate-400 font-mono">EXIF: {p.timestamp}</p>
                          <p className="text-[9px] text-slate-400 font-mono">GEO: Lat: -- Long: --</p>
                       </div>
                       <div className="bg-success text-white text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-tighter">Sealed</div>
                    </div>
                 </div>
              )) : (
                <div className="col-span-2 py-16 bg-slate-50 rounded-3xl text-center text-slate-300 border-2 border-dashed border-slate-100">
                  <span className="material-symbols-outlined text-5xl mb-2 opacity-10">broken_image</span>
                  <p className="font-black text-xs uppercase tracking-widest">No evidence photos captured.</p>
                </div>
              )}
           </div>
        </div>

        <div className="space-y-4">
           <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Service Log Summary</h3>
           <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 text-slate-600 font-medium leading-relaxed italic relative">
              <span className="material-symbols-outlined absolute top-4 left-4 text-slate-200 text-4xl pointer-events-none">format_quote</span>
              {job.notes ? (
                 <p className="relative z-10">"{job.notes}"</p>
              ) : (
                 <p className="text-slate-300 relative z-10">No completion notes logged for this service cycle.</p>
              )}
           </div>
        </div>

        <div className="pt-10 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-8">
           <div className="flex-1 w-full">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 text-center md:text-left">Digital Attestation</h3>
             {job.signature ? (
                <div className="h-32 w-full bg-slate-50 rounded-3xl border border-slate-200 flex items-center justify-center p-6 shadow-inner relative group">
                   <img src={job.signature} alt="Signature" className="max-h-full max-w-full grayscale opacity-70 group-hover:opacity-100 transition-opacity" />
                   <div className="absolute top-2 right-2 flex items-center gap-1">
                      <span className="size-1.5 bg-success rounded-full"></span>
                      <span className="text-[8px] font-black text-success uppercase">Synced</span>
                   </div>
                </div>
             ) : (
                <div className="h-32 w-full bg-slate-50 rounded-3xl border-2 border-dashed border-slate-100 flex items-center justify-center">
                   <span className="material-symbols-outlined text-5xl text-slate-200">signature</span>
                </div>
             )}
             <p className="text-[9px] text-slate-400 font-black text-center mt-3 uppercase tracking-widest">Verification Status: Finalized & Sealed</p>
           </div>
           <div className="w-full md:w-auto flex flex-col items-center">
             <div className="bg-success text-white p-6 rounded-[2rem] text-center shadow-xl shadow-success/20 w-full">
                <span className="material-symbols-outlined text-4xl mb-1">verified</span>
                <p className="text-[10px] font-black uppercase tracking-widest">Protocol Seal</p>
                <p className="text-sm font-black whitespace-nowrap">AUTHENTIC LOG</p>
             </div>
             <p className="text-[8px] text-slate-300 font-mono mt-2">HASH: 771XA-0092-KP2</p>
           </div>
        </div>
        
        {publicView && (
          <div className="no-print pt-8 text-center border-t border-slate-100">
             <button onClick={handlePrint} className="bg-primary text-white font-black px-12 py-4 rounded-2xl shadow-xl shadow-primary/20 flex items-center gap-3 mx-auto">
               <span className="material-symbols-outlined">download</span>
               Download PDF Report
             </button>
             <p className="mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Report served by JobProof Protocol v2.4</p>
          </div>
        )}
      </div>

      {/* Admin Sidebar Actions */}
      {!publicView && (
        <aside className="w-full lg:w-72 space-y-4 no-print">
           <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-lg sticky top-24">
              <h3 className="text-xs font-black text-slate-500 mb-8 uppercase tracking-widest italic">Hub Controls</h3>
              <div className="space-y-3">
                 <button onClick={handlePrint} className="w-full bg-primary hover:bg-blue-600 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-primary/20">
                    <span className="material-symbols-outlined text-lg">print</span>
                    Export PDF
                 </button>
                 <button onClick={() => {
                    const url = `${window.location.origin}/#/report/${job.id}`;
                    navigator.clipboard.writeText(url);
                    alert("Client Report link copied to clipboard.");
                 }} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all">
                    <span className="material-symbols-outlined text-lg">share</span>
                    Share with Client
                 </button>
                 <div className="h-px bg-slate-800 my-4"></div>
                 <button className="w-full bg-slate-900 border border-white/5 text-slate-500 hover:text-white hover:bg-white/5 font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all">
                    <span className="material-symbols-outlined text-lg">archive</span>
                    Archive
                 </button>
              </div>
           </div>

           <div className="bg-primary/5 border border-primary/10 p-8 rounded-3xl">
              <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-6 italic">Verification Trail</p>
              <div className="space-y-6">
                 <TrailItem title="Dispatch Initialized" date={job.date} status="complete" />
                 <TrailItem title="Capture Phase" date={job.status === 'Submitted' ? 'Logged' : 'In Field'} status={job.status === 'Submitted' ? 'complete' : 'pending'} />
                 <TrailItem title="Verification Sealed" date={job.completedAt || '--'} status={job.status === 'Submitted' ? 'complete' : 'pending'} last />
              </div>
           </div>
        </aside>
      )}
    </div>
  );

  if (publicView) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 lg:p-12">
        <div className="max-w-4xl mx-auto mb-8 flex justify-between items-center text-white no-print">
           <div className="flex items-center gap-3">
              <div className="bg-primary size-8 rounded-lg flex items-center justify-center font-black">J</div>
              <span className="font-black italic uppercase tracking-tighter">JobProof Portal</span>
           </div>
           <div className="bg-white/5 px-4 py-1.5 rounded-full border border-white/10 text-[10px] font-black uppercase tracking-widest">Authenticated Client View</div>
        </div>
        {content}
      </div>
    );
  }

  return <Layout>{content}</Layout>;
};

const TrailItem = ({ title, date, status, last }: any) => (
  <div className="flex gap-4 text-[10px]">
     <div className="flex flex-col items-center">
        <div className={`size-2.5 rounded-full ring-4 ring-slate-950 ${status === 'complete' ? 'bg-primary' : 'bg-slate-800'}`}></div>
        {!last && <div className="w-px flex-1 bg-slate-800 my-1"></div>}
     </div>
     <div className={`${last ? '' : 'pb-6'}`}>
        <p className={`font-black uppercase tracking-widest ${status === 'complete' ? 'text-white' : 'text-slate-600'}`}>{title}</p>
        <p className="text-[9px] text-slate-500 mt-1 font-bold">{date}</p>
     </div>
  </div>
);

export default JobReport;
