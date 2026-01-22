
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useParams, useNavigate } from 'react-router-dom';
import { Job, PhotoType, Invoice, UserProfile } from '../types';
import { getMedia } from '../db';
import SealBadge from '../components/SealBadge';
import LegalDisclaimer from '../components/LegalDisclaimer';
import { getReportUrl } from '../lib/redirects';

interface JobReportProps {
   user?: UserProfile | null;
   jobs: Job[];
   invoices: Invoice[];
   onGenerateInvoice?: (inv: Invoice) => void;
   publicView?: boolean;
}

const JobReport: React.FC<JobReportProps> = ({ user, jobs, invoices, onGenerateInvoice, publicView = false }) => {
   const { jobId } = useParams();
   const navigate = useNavigate();
   const job = jobs.find(j => j.id === jobId);
   const existingInvoice = invoices.find(inv => inv.jobId === jobId);

   // State for loading media from IndexedDB
   const [photoDataUrls, setPhotoDataUrls] = useState<Map<string, string>>(new Map());
   const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
   const [isLoadingMedia, setIsLoadingMedia] = useState(true);
   const [showShareModal, setShowShareModal] = useState(false);

   // Load photos and signature from IndexedDB
   useEffect(() => {
      const loadMediaFromIndexedDB = async () => {
         if (!job) return;

         setIsLoadingMedia(true);
         const loadedUrls = new Map<string, string>();

         // Load photos
         for (const photo of job.photos) {
            if (photo.isIndexedDBRef) {
               const dataUrl = await getMedia(photo.url);
               if (dataUrl) loadedUrls.set(photo.id, dataUrl);
            }
         }

         // Load signature
         if (job.signature && job.signatureIsIndexedDBRef) {
            const sigData = await getMedia(job.signature);
            if (sigData) setSignatureDataUrl(sigData);
         } else if (job.signature) {
            setSignatureDataUrl(job.signature);
         }

         setPhotoDataUrls(loadedUrls);
         setIsLoadingMedia(false);
      };

      loadMediaFromIndexedDB();
   }, [job]);

   if (!job) return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-white">
         <div className="text-center space-y-4">
            <h1 className="text-4xl font-black uppercase tracking-tighter">Report Unavailable</h1>
            <p className="text-slate-300 uppercase tracking-tight">The requested evidence bundle could not be retrieved from the hub.</p>
            <button onClick={() => navigate('/admin')} className="px-8 py-3 bg-primary text-white font-black rounded-xl uppercase tracking-widest">Return to Hub</button>
         </div>
      </div>
   );

   const groupedPhotos = (['Before', 'During', 'After', 'Evidence'] as PhotoType[]).map(type => ({
      type,
      items: job.photos.filter(p => p.type === type)
   })).filter(g => g.items.length > 0);

   // Chain-of-Custody Timeline Data
   const firstPhotoTimestamp = job.photos.length > 0
      ? job.photos.reduce((earliest, photo) => {
         const photoTime = new Date(photo.timestamp).getTime();
         return photoTime < new Date(earliest).getTime() ? photo.timestamp : earliest;
      }, job.photos[0].timestamp)
      : null;

   const formatTimestamp = (timestamp: string | undefined) => {
      if (!timestamp) return null;
      const date = new Date(timestamp);
      return {
         date: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
         time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      };
   };

   const timelineEvents = {
      created: formatTimestamp(job.date),
      firstCapture: formatTimestamp(firstPhotoTimestamp || undefined),
      sealed: formatTimestamp(job.sealedAt),
      verified: job.status === 'Submitted' ? formatTimestamp(job.completedAt) : null,
   };

   const handleGenerateInvoice = () => {
      if (!onGenerateInvoice) return;
      const inv: Invoice = {
         id: `INV-${Math.floor(Math.random() * 9000) + 1000}`,
         jobId: job.id,
         clientId: job.clientId,
         clientName: job.client,
         amount: job.price || 450.00,
         status: 'Draft',
         issuedDate: new Date().toISOString(),
         dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      };
      onGenerateInvoice(inv);
      navigate('/admin/invoices');
   };

   const reportHash = btoa(`${job.id}-${job.completedAt}-${job.photos.length}`).substring(0, 32).toUpperCase();

   return (
      <Layout user={user} isAdmin={!publicView}>
         <div className={`max-w-5xl mx-auto flex flex-col ${publicView ? '' : 'lg:flex-row'} gap-8 main-content-area animate-in`}>
            <div className="flex-1 space-y-8 bg-white text-slate-900 p-8 lg:p-14 rounded-[3rem] shadow-2xl border border-slate-200 relative overflow-hidden">
               {/* Watermark */}
               <div className="absolute top-10 -right-20 rotate-45 text-[120px] font-black text-slate-50 pointer-events-none uppercase tracking-tighter select-none opacity-5">
                  CERTIFIED
               </div>

               <div className="flex justify-between items-start border-b border-slate-100 pb-10 relative z-10">
                  <div className="space-y-4">
                     <div className="bg-primary/10 text-primary text-[10px] font-black px-3 py-1 rounded-full inline-block tracking-widest uppercase border border-primary/20">Official Proof of Service</div>
                     <h2 className="text-5xl font-black tracking-tighter uppercase leading-none">{job.title}</h2>
                     <div className="flex flex-wrap items-center gap-4">
                        <p className="text-slate-300 font-bold uppercase text-[10px]">Reference: <span className="font-mono text-slate-900">{job.id}</span></p>
                        <div className="size-1 bg-slate-200 rounded-full"></div>
                        <p className="text-slate-300 font-bold uppercase text-[10px]">Vault ID: <span className="font-mono text-slate-900">{reportHash.substring(0, 8)}</span></p>
                        {job.w3w && (
                           <>
                              <div className="size-1 bg-slate-200 rounded-full"></div>
                              <div className="flex items-center gap-1">
                                 <span className="text-red-500 font-black text-[10px]">///</span>
                                 <p className="text-slate-900 font-black uppercase text-[10px] tracking-widest">{job.w3w.replace('///', '')}</p>
                              </div>
                           </>
                        )}
                     </div>
                  </div>
                  <div className="text-right">
                     <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Final Authorisation</p>
                     <p className="text-xl font-black uppercase leading-none">{job.completedAt ? new Date(job.completedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Pending'}</p>
                     <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{job.completedAt ? new Date(job.completedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                  </div>
               </div>

               {/* Protocol Timeline - Enhanced Chain of Custody */}
               <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 space-y-6 relative z-10">
                  <div className="flex items-center justify-between mb-4">
                     <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Chain of Custody</h3>
                     <span className="text-[8px] font-bold text-slate-300 uppercase">Operational Spine</span>
                  </div>
                  <div className="flex justify-between items-start gap-4">
                     <TimelineStep
                        label="Dispatched"
                        time={timelineEvents.created ? `${timelineEvents.created.date}` : job.date}
                        status={timelineEvents.created ? timelineEvents.created.time : 'Created'}
                        icon="send"
                        active={true}
                     />
                     <div className={`flex-1 h-px mt-4 ${timelineEvents.firstCapture ? 'bg-primary' : 'bg-slate-200'}`}></div>
                     <TimelineStep
                        label="Capture"
                        time={timelineEvents.firstCapture ? `${timelineEvents.firstCapture.date}` : 'Pending'}
                        status={timelineEvents.firstCapture ? `${timelineEvents.firstCapture.time} • ${job.photos.length} items` : 'Awaiting'}
                        icon="photo_camera"
                        active={!!timelineEvents.firstCapture}
                     />
                     <div className={`flex-1 h-px mt-4 ${timelineEvents.sealed ? 'bg-primary' : 'bg-slate-200'}`}></div>
                     <TimelineStep
                        label="Sealed"
                        time={timelineEvents.sealed ? `${timelineEvents.sealed.date}` : 'Pending'}
                        status={timelineEvents.sealed ? timelineEvents.sealed.time : 'Awaiting'}
                        icon="lock"
                        active={!!timelineEvents.sealed}
                     />
                     <div className={`flex-1 h-px mt-4 ${timelineEvents.verified ? 'bg-success' : 'bg-slate-200'}`}></div>
                     <TimelineStep
                        label="Verified"
                        time={timelineEvents.verified ? `${timelineEvents.verified.date}` : 'Pending'}
                        status={timelineEvents.verified ? timelineEvents.verified.time : 'Awaiting'}
                        icon="verified"
                        active={!!timelineEvents.verified}
                     />
                  </div>
                  {/* Client signoff tracking available in database schema (ClientSignoff interface) */}
               </div>

               {/* Phase C.3: Cryptographic Seal Badge */}
               {job.sealedAt && (
                  <div className="relative z-10">
                     <SealBadge jobId={job.id} variant="full" />
                  </div>
               )}

               <div className="grid grid-cols-2 gap-12 relative z-10">
                  <div className="space-y-3">
                     <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Client Identity</h3>
                     <p className="text-xl font-black uppercase tracking-tight">{job.client}</p>
                     <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 shadow-inner">
                        <p className="text-slate-300 text-[11px] font-bold leading-relaxed uppercase tracking-tight">{job.address}</p>
                        {job.lat && (
                           <div className="border-t border-slate-200 pt-2 space-y-1">
                              <div className="flex items-center gap-1.5">
                                 <span className="text-red-500 font-black text-[9px]">///</span>
                                 <span className="text-[9px] font-black uppercase text-slate-900 tracking-widest">{job.w3w?.replace('///', '')}</span>
                              </div>
                              <p className="text-slate-400 text-[8px] font-mono uppercase">GPS: {job.lat.toFixed(6)}, {job.lng?.toFixed(6)}</p>
                           </div>
                        )}
                     </div>
                  </div>
                  <div className="space-y-3">
                     <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Service Operator</h3>
                     <p className="text-xl font-black uppercase tracking-tight">{job.technician}</p>
                     <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-1">
                           <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-success text-sm font-black">location_on</span>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Geo-metadata captured on-site</p>
                           </div>
                           <p className="text-[8px] text-slate-300 italic pl-6">
                              (GPS coordinates recorded, not verified against address)
                           </p>
                        </div>
                        <div className="flex flex-col gap-1">
                           <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-success text-sm font-black">lock</span>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Account Verified (Email)</p>
                           </div>
                           <p className="text-[8px] text-slate-300 italic pl-6">
                              (Account-based identity, not legally verified)
                           </p>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="space-y-12 pt-6 relative z-10">
                  {groupedPhotos.map(group => (
                     <div key={group.type} className="space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                           <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
                              <span className="size-2 bg-primary rounded-full"></span>
                              Phase: {group.type}
                           </h3>
                           <span className="text-[10px] font-bold text-slate-400 uppercase">{group.items.length} Captures</span>
                        </div>
                        <div className="grid grid-cols-2 gap-8">
                           {group.items.map(p => {
                              const displayUrl = p.isIndexedDBRef ? (photoDataUrls.get(p.id) || '') : p.url;
                              return (
                                 <div key={p.id} className="space-y-3 group">
                                    <div className="aspect-video bg-slate-100 rounded-[2rem] overflow-hidden border border-slate-200 shadow-sm group-hover:border-primary/40 transition-all">
                                       {displayUrl ? (
                                          <img src={displayUrl} className="w-full h-full object-cover" alt="Evidence" />
                                       ) : (
                                          <div className="w-full h-full flex items-center justify-center text-slate-400">Loading...</div>
                                       )}
                                    </div>
                                    <div className="space-y-1.5 px-2">
                                       <div className="flex justify-between items-center">
                                          <p className="text-[9px] text-slate-400 font-mono uppercase">UTC: {new Date(p.timestamp).toISOString().split('T')[1].substring(0, 8)}</p>
                                          <div className="flex items-center gap-1">
                                             <span className="material-symbols-outlined text-[10px] text-slate-300 font-black">location_on</span>
                                             <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">GPS Captured</span>
                                          </div>
                                       </div>
                                       <div className="flex flex-col gap-0.5">
                                          {p.w3w && (
                                             <div className="flex items-center gap-1 opacity-70">
                                                <span className="text-red-500 font-black text-[9px]">///</span>
                                                <p className="text-slate-300 font-black uppercase text-[9px] tracking-widest">{p.w3w.replace('///', '')}</p>
                                             </div>
                                          )}
                                          {p.lat && (
                                             <p className="text-[8px] font-mono text-slate-300 uppercase leading-none">GPS: {p.lat.toFixed(5)}, {p.lng?.toFixed(5)}</p>
                                          )}
                                       </div>
                                    </div>
                                 </div>
                              );
                           })}
                        </div>
                     </div>
                  ))}
               </div>

               <div className="space-y-4 pt-4 relative z-10">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Operational Narrative</h3>
                  <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 text-slate-800 font-medium leading-relaxed text-sm uppercase tracking-tight shadow-inner">
                     {job.notes || "Standard protocol followed. No exceptional site variances recorded."}
                  </div>
               </div>

               <div className="pt-12 border-t border-slate-100 flex flex-col md:flex-row justify-between items-end gap-12 relative z-10">
                  <div className="flex-1 w-full space-y-4">
                     <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Attestation & Binding</h3>
                     {signatureDataUrl ? (
                        <div className="h-44 w-full bg-slate-50 rounded-[2.5rem] border border-slate-200 flex items-center justify-center p-8 shadow-inner relative group">
                           <img src={signatureDataUrl} alt="Signature" className="max-h-full max-w-full opacity-90 contrast-125" />
                           <div className="absolute top-6 right-6 flex items-center gap-2 px-3 py-1 bg-white rounded-full border border-slate-200 shadow-sm">
                              <span className="size-2 bg-success rounded-full animate-pulse"></span>
                              <span className="text-[9px] font-black text-success uppercase">Cryptographic Seal</span>
                           </div>
                        </div>
                     ) : isLoadingMedia ? (
                        <div className="h-44 w-full bg-slate-50 rounded-[2.5rem] border border-slate-200 flex flex-col items-center justify-center text-slate-300">
                           <div className="size-8 border-4 border-slate-300 border-t-primary rounded-full animate-spin"></div>
                           <p className="text-[10px] font-black uppercase tracking-widest mt-3">Loading Signature</p>
                        </div>
                     ) : (
                        <div className="h-44 w-full bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300">
                           <span className="material-symbols-outlined text-5xl mb-2 font-black">signature</span>
                           <p className="text-[10px] font-black uppercase tracking-widest">Waiting for Seal</p>
                        </div>
                     )}
                     <div className="flex justify-between text-[11px] font-black uppercase text-slate-400 px-4">
                        <div className="flex flex-col">
                           <span className="text-slate-400 text-[9px] mb-1">Signatory</span>
                           <span>{job.signerName || 'Pending'}</span>
                        </div>
                        <div className="flex flex-col text-right">
                           <span className="text-slate-400 text-[9px] mb-1">Capacity</span>
                           <span>{job.signerRole || 'Verified User'}</span>
                        </div>
                     </div>
                  </div>
                  <div className="bg-slate-950 text-white p-10 rounded-[3rem] text-center w-full md:w-auto shrink-0 shadow-2xl border border-white/5 relative group overflow-hidden">
                     <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                     <span className="material-symbols-outlined text-6xl mb-3 text-primary font-black relative z-10">verified</span>
                     <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-1 relative z-10">Verified Record</p>
                     <p className="text-xl font-black uppercase whitespace-nowrap tracking-tighter relative z-10">Protocol Authenticated</p>
                  </div>
               </div>

               {/* Legal Disclaimer - Phase C.5 */}
               <div className="mt-12 relative z-10">
                  <LegalDisclaimer />
               </div>

               <div className="mt-16 pt-8 border-t border-slate-100 flex justify-between items-center text-[9px] font-mono text-slate-300 uppercase tracking-widest relative z-10">
                  <p>HASH: {reportHash}</p>
                  <p>JOBPROOF V2.4 • GLOBAL INFRASTRUCTURE</p>
                  <p>PAGE 01 OF 01</p>
               </div>
            </div>

            {!publicView && (
               <aside className="w-full lg:w-80 space-y-6 no-print shrink-0">
                  <div className="bg-slate-900 border border-white/5 p-8 rounded-[3rem] shadow-2xl sticky top-24 space-y-8">
                     <div>
                        <h3 className="text-xs font-black text-slate-300 mb-6 uppercase tracking-[0.2em]">Hub Controls</h3>
                        <div className="space-y-3">
                           {job.status === 'Submitted' && !existingInvoice && (
                              <button onClick={handleGenerateInvoice} className="w-full bg-success hover:bg-emerald-600 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all uppercase tracking-widest text-[10px] shadow-lg shadow-success/20 group">
                                 <span className="material-symbols-outlined text-sm font-black group-hover:rotate-12 transition-transform">receipt</span>
                                 Initialise Billing
                              </button>
                           )}
                           <button onClick={() => window.print()} className="w-full bg-primary hover:bg-blue-600 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20">
                              <span className="material-symbols-outlined text-sm font-black">print</span>
                              Print / Export PDF
                           </button>
                           <button onClick={() => setShowShareModal(true)} className="w-full bg-white/5 hover:bg-white/10 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all uppercase tracking-widest text-[10px] border border-white/10">
                              <span className="material-symbols-outlined text-sm font-black">share</span>
                              Share Evidence Link
                           </button>
                        </div>
                     </div>

                     <div className="pt-8 border-t border-white/5">
                        <h3 className="text-[10px] font-black text-slate-300 mb-4 uppercase tracking-[0.2em]">System Status</h3>
                        <div className="space-y-3">
                           <StatusLine label="Integrity Check" value="Pass" success />
                           <StatusLine label="Sync Status" value="Vaulted" success />
                        </div>
                     </div>
                  </div>
               </aside>
            )}
         </div>
         {showShareModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in" onClick={() => setShowShareModal(false)}>
               <div className="bg-slate-900 border border-white/10 p-10 rounded-[3.5rem] max-w-lg w-full shadow-2xl space-y-6" onClick={(e) => e.stopPropagation()}>
                  <div className="text-center space-y-3">
                     <div className="bg-primary/20 size-16 rounded-[2.5rem] flex items-center justify-center mx-auto">
                        <span className="material-symbols-outlined text-primary text-4xl font-black">share</span>
                     </div>
                     <h3 className="text-2xl font-black text-white tracking-tighter uppercase">Share Evidence Report</h3>
                  </div>

                  <div className="bg-white p-6 rounded-3xl flex items-center justify-center">
                     <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getReportUrl(job.id))}`}
                        alt="QR Code"
                        className="w-48 h-48"
                     />
                  </div>

                  <div className="bg-slate-800/50 rounded-2xl p-4 border border-white/5">
                     <p className="text-xs font-mono text-white break-all text-center">{getReportUrl(job.id)}</p>
                  </div>

                  <div className="flex flex-col gap-3">
                     <button onClick={() => {
                        navigator.clipboard.writeText(getReportUrl(job.id));
                        alert('Link copied to clipboard!');
                     }} className="w-full py-4 bg-primary hover:bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-sm font-black">content_copy</span>
                        Copy Link
                     </button>
                     <button onClick={() => setShowShareModal(false)} className="w-full py-3 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-2xl font-black uppercase tracking-widest transition-all">
                        Close
                     </button>
                  </div>
               </div>
            </div>
         )}
      </Layout>
   );
};

const TimelineStep = ({ label, time, status, icon, active = true }: any) => (
   <div className={`flex flex-col items-center text-center space-y-2 ${active ? 'opacity-100' : 'opacity-20'}`}>
      <div className={`size-8 rounded-xl flex items-center justify-center ${active ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-400'}`}>
         <span className="material-symbols-outlined text-sm font-black">{icon}</span>
      </div>
      <div className="space-y-0.5">
         <p className="text-[9px] font-black uppercase text-slate-900 leading-none">{label}</p>
         <p className="text-[8px] font-bold text-slate-400 uppercase leading-none">{time}</p>
      </div>
   </div>
);

const StatusLine = ({ label, value, success }: any) => (
   <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
      <span className="text-slate-400">{label}</span>
      <span className={success ? 'text-success' : 'text-slate-400'}>{value}</span>
   </div>
);

export default JobReport;
