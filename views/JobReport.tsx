
import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Layout from '../components/AppLayout';
import { useParams, useNavigate } from 'react-router-dom';
import { Job, PhotoType, Invoice, UserProfile, Technician } from '../types';
import { getMediaLocal as getMedia } from '../lib/offline/db';
import SealBadge from '../components/SealBadge';
import ClientReceiptView from '../components/ClientReceiptView';
import { getReportUrl, getValidatedHandshakeUrl } from '../lib/redirects';
import { generateSecureInvoiceId } from '../lib/secureId';
import {
  getMagicLinksForJob,
  regenerateMagicLink,
  extendMagicLinkExpiration,
  revokeMagicLink,
  markLinkAsSent,
  getLinkLifecycleSummary,
  acknowledgeLinkFlag,
  LINK_EXPIRATION,
  type MagicLinkInfo,
  type LinkLifecycleStage
} from '../lib/db';

interface JobReportProps {
   user?: UserProfile | null;
   jobs: Job[];
   invoices: Invoice[];
   technicians?: Technician[];
   onGenerateInvoice?: (inv: Invoice) => void;
   onUpdateJob?: (job: Job) => void;
   publicView?: boolean;
}

const JobReport: React.FC<JobReportProps> = ({ user, jobs, invoices, technicians = [], onGenerateInvoice, onUpdateJob, publicView = false }) => {
   const { jobId } = useParams();
   const navigate = useNavigate();
   const job = jobs.find(j => j.id === jobId);
   const existingInvoice = invoices.find(inv => inv.jobId === jobId);

   // State for loading media from IndexedDB
   const [photoDataUrls, setPhotoDataUrls] = useState<Map<string, string>>(new Map());
   const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
   const [isLoadingMedia, setIsLoadingMedia] = useState(true);
   const [showShareModal, setShowShareModal] = useState(false);
   const [showClientReceipt, setShowClientReceipt] = useState(false);

   // Check if job was created in self-employed mode
   const techMetadata = job?.techMetadata;
   const isSelfEmployedJob = job?.selfEmployedMode || techMetadata?.creationOrigin === 'self_employed';

   // Magic Link Management State
   const [magicLinkInfo, setMagicLinkInfo] = useState<MagicLinkInfo | null>(null);
   const [showLinkManagement, setShowLinkManagement] = useState(false);
   const [showReassignModal, setShowReassignModal] = useState(false);
   const [linkActionLoading, setLinkActionLoading] = useState(false);
   const [linkActionMessage, setLinkActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
   const [lifecycleSummary, setLifecycleSummary] = useState<ReturnType<typeof getLinkLifecycleSummary>>(null);

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

   // Load magic link info for this job
   useEffect(() => {
      if (!job || publicView) return;

      const links = getMagicLinksForJob(job.id);
      let tokenToUse: string | null = null;

      if (links.length > 0) {
         // Get the most recent active link
         const activeLink = links.find(l => l.status === 'active') || links[0];
         setMagicLinkInfo(activeLink);
         tokenToUse = activeLink.token;
      } else if (job.magicLinkToken) {
         // Fallback to token stored on job
         setMagicLinkInfo({
            token: job.magicLinkToken,
            job_id: job.id,
            workspace_id: job.workspaceId || '',
            expires_at: new Date(Date.now() + LINK_EXPIRATION.STANDARD).toISOString(),
            status: 'active'
         });
         tokenToUse = job.magicLinkToken;
      }

      // Load lifecycle summary for the token
      if (tokenToUse) {
         const summary = getLinkLifecycleSummary(tokenToUse);
         setLifecycleSummary(summary);
      }
   }, [job, publicView]);

   // Clear action message after 3 seconds
   useEffect(() => {
      if (linkActionMessage) {
         const timer = setTimeout(() => setLinkActionMessage(null), 3000);
         return () => clearTimeout(timer);
      }
   }, [linkActionMessage]);

   // Magic Link Management Handlers
   const handleRegenerateLink = useCallback(() => {
      if (!job) return;

      setLinkActionLoading(true);
      try {
         // deliveryEmail is required for validated handshake URLs
         if (!user?.email) {
            setLinkActionMessage({ type: 'error', text: 'Cannot generate link: Your email is not available. Please log in again.' });
            setLinkActionLoading(false);
            return;
         }
         const result = regenerateMagicLink(job.id, job.workspaceId || user?.workspace?.id || 'local', user.email, {
            expirationMs: LINK_EXPIRATION.STANDARD,
            techId: job.techId
         });

         if (result.success && result.data) {
            setMagicLinkInfo({
               token: result.data.token,
               job_id: job.id,
               workspace_id: job.workspaceId || '',
               expires_at: result.data.expiresAt,
               status: 'active',
               created_at: new Date().toISOString()
            });

            // Update job with new magic link
            if (onUpdateJob) {
               onUpdateJob({
                  ...job,
                  magicLinkToken: result.data.token,
                  magicLinkUrl: result.data.url
               });
            }

            setLinkActionMessage({ type: 'success', text: 'New link generated! Old links revoked.' });
         } else {
            setLinkActionMessage({ type: 'error', text: result.error || 'Failed to generate link' });
         }
      } catch (e) {
         setLinkActionMessage({ type: 'error', text: 'Failed to generate link' });
      } finally {
         setLinkActionLoading(false);
      }
   }, [job, user, onUpdateJob]);

   const handleExtendLink = useCallback((duration: number) => {
      if (!magicLinkInfo) return;

      setLinkActionLoading(true);
      try {
         const result = extendMagicLinkExpiration(magicLinkInfo.token, duration);
         if (result.success && result.data) {
            setMagicLinkInfo(prev => prev ? { ...prev, expires_at: result.data!.newExpiresAt, status: 'active' } : null);
            setLinkActionMessage({ type: 'success', text: 'Link expiration extended!' });
         } else {
            setLinkActionMessage({ type: 'error', text: result.error || 'Failed to extend link' });
         }
      } catch (e) {
         setLinkActionMessage({ type: 'error', text: 'Failed to extend link' });
      } finally {
         setLinkActionLoading(false);
      }
   }, [magicLinkInfo]);

   const handleRevokeLink = useCallback(() => {
      if (!magicLinkInfo) return;

      if (!confirm('Are you sure you want to revoke this link? The technician will no longer be able to access this job.')) {
         return;
      }

      setLinkActionLoading(true);
      try {
         const result = revokeMagicLink(magicLinkInfo.token);
         if (result.success) {
            setMagicLinkInfo(prev => prev ? { ...prev, status: 'revoked' } : null);

            // Clear magic link from job
            if (onUpdateJob && job) {
               onUpdateJob({
                  ...job,
                  magicLinkToken: undefined,
                  magicLinkUrl: undefined
               });
            }

            setLinkActionMessage({ type: 'success', text: 'Link revoked successfully' });
         } else {
            setLinkActionMessage({ type: 'error', text: result.error || 'Failed to revoke link' });
         }
      } catch (e) {
         setLinkActionMessage({ type: 'error', text: 'Failed to revoke link' });
      } finally {
         setLinkActionLoading(false);
      }
   }, [magicLinkInfo, job, onUpdateJob]);

   const handleCopyLink = useCallback(() => {
      if (!magicLinkInfo) return;

      // Use validated handshake URL with manager's email for report delivery
      if (!user?.email) {
         setLinkActionMessage({ type: 'error', text: 'Cannot copy link: Your email is not available. Please log in again.' });
         return;
      }
      const url = getValidatedHandshakeUrl(magicLinkInfo.job_id, user.email);
      navigator.clipboard.writeText(url);

      // Track that link was sent via copy
      markLinkAsSent(magicLinkInfo.token, 'copy');

      setLinkActionMessage({ type: 'success', text: 'Link copied to clipboard!' });
   }, [magicLinkInfo, user?.email]);

   const handleReassignJob = useCallback((newTechId: string, newTechName: string) => {
      if (!job) return;

      setLinkActionLoading(true);
      try {
         // Regenerate link with new technician
         // deliveryEmail is required for validated handshake URLs
         if (!user?.email) {
            setLinkActionMessage({ type: 'error', text: 'Cannot reassign: Your email is not available. Please log in again.' });
            setLinkActionLoading(false);
            return;
         }
         const result = regenerateMagicLink(job.id, job.workspaceId || user?.workspace?.id || 'local', user.email, {
            expirationMs: LINK_EXPIRATION.STANDARD,
            techId: newTechId
         });

         if (result.success && result.data) {
            setMagicLinkInfo({
               token: result.data.token,
               job_id: job.id,
               workspace_id: job.workspaceId || '',
               expires_at: result.data.expiresAt,
               status: 'active',
               created_at: new Date().toISOString(),
               assigned_to_tech_id: newTechId
            });

            // Update job with new technician and magic link
            if (onUpdateJob) {
               onUpdateJob({
                  ...job,
                  techId: newTechId,
                  technician: newTechName,
                  magicLinkToken: result.data.token,
                  magicLinkUrl: result.data.url
               });
            }

            setShowReassignModal(false);
            setLinkActionMessage({ type: 'success', text: `Job reassigned to ${newTechName}` });
         } else {
            setLinkActionMessage({ type: 'error', text: result.error || 'Failed to reassign job' });
         }
      } catch (e) {
         setLinkActionMessage({ type: 'error', text: 'Failed to reassign job' });
      } finally {
         setLinkActionLoading(false);
      }
   }, [job, user, onUpdateJob]);

   // Helper to format expiration
   const formatExpiration = (expiresAt: string) => {
      const expires = new Date(expiresAt);
      const now = new Date();
      const diffMs = expires.getTime() - now.getTime();

      if (diffMs <= 0) return 'Expired';

      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);

      if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h remaining`;
      if (diffHours > 0) return `${diffHours}h remaining`;
      return `${Math.floor(diffMs / (1000 * 60))}m remaining`;
   };

   // Get link status color
   const getLinkStatusColor = (status: string) => {
      switch (status) {
         case 'active': return 'text-success';
         case 'expired': return 'text-warning';
         case 'revoked': return 'text-danger';
         case 'used': return 'text-primary';
         case 'sealed': return 'text-slate-400';
         default: return 'text-slate-400';
      }
   };

   if (!job) return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-white">
         <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold tracking-tighter">Report Unavailable</h1>
            <p className="text-slate-300 uppercase tracking-tight">The requested evidence bundle could not be retrieved from the hub.</p>
            <button onClick={() => navigate('/admin')} className="px-8 py-3 bg-primary text-white font-black rounded-xl uppercase tracking-widest">Return to Hub</button>
         </div>
      </div>
   );

   // =========================================================================
   // EVIDENCE STATE DETECTION - Determines what UI to show
   // =========================================================================
   const hasPhotos = job.photos.length > 0;
   const hasSignature = !!job.signature;
   const isSealed = !!job.sealedAt;
   const techLinkOpened = !!job.technicianLinkOpened || !!magicLinkInfo?.first_accessed_at;
   const techLinkSent = !!magicLinkInfo?.sent_at || !!job.magicLinkToken;

   // Calculate job completion state
   const jobState = {
      noWorkStarted: !hasPhotos && !hasSignature && !isSealed,
      evidenceIncomplete: hasPhotos && !hasSignature && !isSealed,
      readyForSeal: hasPhotos && hasSignature && !isSealed,
      sealed: isSealed,
   };

   // What's blocking progress?
   const blockers: string[] = [];
   if (!techLinkSent) blockers.push('Technician link not generated');
   else if (!techLinkOpened) blockers.push('Technician has not opened the link');
   else if (!hasPhotos) blockers.push('No evidence photos captured');
   else if (!hasSignature) blockers.push('Client signature not obtained');

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
         id: generateSecureInvoiceId(),
         jobId: job.id,
         clientId: job.clientId,
         clientName: job.client,
         amount: job.price || 450.00,
         total: job.price || 450.00,
         status: 'Draft',
         issuedDate: new Date().toISOString(),
         dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
         items: [{
           id: '1',
           description: job.title || 'Service',
           quantity: 1,
           unitPrice: job.price || 450.00,
           amount: job.price || 450.00,
         }],
      };
      onGenerateInvoice(inv);
      navigate('/admin/invoices');
   };

   return (
      <Layout user={user} isAdmin={!publicView}>
         <div className={`max-w-5xl mx-auto flex flex-col ${publicView ? '' : 'lg:flex-row'} gap-4 sm:gap-8 main-content-area animate-in`}>
            <div className="flex-1 space-y-6 sm:space-y-8 bg-white text-slate-900 p-4 sm:p-8 lg:p-14 rounded-2xl sm:rounded-[3rem] shadow-2xl border border-slate-200 relative overflow-hidden">
               {/* Watermark */}
               <div className="absolute top-10 -right-20 rotate-45 text-[120px] font-black text-slate-50 pointer-events-none uppercase tracking-tighter select-none opacity-5">
                  CERTIFIED
               </div>

               <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-slate-100 pb-6 sm:pb-10 relative z-10">
                  <div className="space-y-3 sm:space-y-4">
                     <div className="bg-primary/10 text-primary text-[9px] sm:text-[10px] font-black px-3 py-1 rounded-full inline-block tracking-widest uppercase border border-primary/20">Official Proof of Service</div>
                     <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-none">{job.title}</h2>
                     <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                        <p className="text-slate-300 font-bold uppercase text-[9px] sm:text-[10px]">Reference: <span className="font-mono text-slate-900">{job.id.substring(0, 8)}</span></p>
                        {isSealed && job.evidenceHash && (
                           <>
                              <div className="hidden sm:block size-1 bg-slate-200 rounded-full"></div>
                              <p className="text-slate-300 font-bold uppercase text-[9px] sm:text-[10px]">Seal: <span className="font-mono text-emerald-700">{job.evidenceHash.substring(0, 8)}</span></p>
                           </>
                        )}
                        {job.w3w && (
                           <>
                              <div className="hidden sm:block size-1 bg-slate-200 rounded-full"></div>
                              <div className="flex items-center gap-1 w-full sm:w-auto">
                                 <span className="text-red-500 font-black text-[9px] sm:text-[10px]">{'///'}</span>
                                 <p className="text-slate-900 font-black uppercase text-[9px] sm:text-[10px] tracking-widest">{job.w3w.replace('///', '')}</p>
                              </div>
                           </>
                        )}
                     </div>
                  </div>
                  <div className="text-left sm:text-right mt-2 sm:mt-0 flex-shrink-0">
                     <p className="text-[9px] sm:text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Final Authorisation</p>
                     <p className="text-lg sm:text-xl font-bold leading-none">{job.completedAt ? new Date(job.completedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Pending'}</p>
                     <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase mt-1">{job.completedAt ? new Date(job.completedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                  </div>
               </div>

               {/* Protocol Timeline - Enhanced Chain of Custody */}
               <div className="bg-slate-50 rounded-2xl sm:rounded-3xl p-4 sm:p-8 border border-slate-100 space-y-4 sm:space-y-6 relative z-10">
                  <div className="flex items-center justify-between mb-2 sm:mb-4">
                     <h3 className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Chain of Custody</h3>
                     <span className="text-[8px] font-bold text-slate-300 uppercase hidden sm:block">Operational Spine</span>
                  </div>
                  {/* Mobile: Vertical timeline */}
                  <div className="flex flex-col sm:hidden gap-4">
                     <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10">
                           <span className="material-symbols-outlined text-sm text-primary">send</span>
                        </div>
                        <div className="flex-1 min-w-0">
                           <p className="text-[10px] font-black text-slate-900 uppercase">Dispatched</p>
                           <p className="text-[9px] text-slate-500">{timelineEvents.created ? `${timelineEvents.created.date} • ${timelineEvents.created.time}` : job.date}</p>
                        </div>
                     </div>
                     <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${timelineEvents.firstCapture ? 'bg-primary/10' : 'bg-slate-200'}`}>
                           <span className={`material-symbols-outlined text-sm ${timelineEvents.firstCapture ? 'text-primary' : 'text-slate-400'}`}>photo_camera</span>
                        </div>
                        <div className="flex-1 min-w-0">
                           <p className="text-[10px] font-black text-slate-900 uppercase">Capture</p>
                           <p className="text-[9px] text-slate-500">{timelineEvents.firstCapture ? `${timelineEvents.firstCapture.date} • ${job.photos.length} items` : 'Pending'}</p>
                        </div>
                     </div>
                     <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${timelineEvents.sealed ? 'bg-primary/10' : 'bg-slate-200'}`}>
                           <span className={`material-symbols-outlined text-sm ${timelineEvents.sealed ? 'text-primary' : 'text-slate-400'}`}>lock</span>
                        </div>
                        <div className="flex-1 min-w-0">
                           <p className="text-[10px] font-black text-slate-900 uppercase">Sealed</p>
                           <p className="text-[9px] text-slate-500">{timelineEvents.sealed ? `${timelineEvents.sealed.date} • ${timelineEvents.sealed.time}` : 'Pending'}</p>
                        </div>
                     </div>
                     <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${timelineEvents.verified ? 'bg-success/10' : 'bg-slate-200'}`}>
                           <span className={`material-symbols-outlined text-sm ${timelineEvents.verified ? 'text-success' : 'text-slate-400'}`}>verified</span>
                        </div>
                        <div className="flex-1 min-w-0">
                           <p className="text-[10px] font-black text-slate-900 uppercase">Verified</p>
                           <p className="text-[9px] text-slate-500">{timelineEvents.verified ? `${timelineEvents.verified.date} • ${timelineEvents.verified.time}` : 'Pending'}</p>
                        </div>
                     </div>
                  </div>
                  {/* Desktop: Horizontal timeline */}
                  <div className="hidden sm:flex justify-between items-start gap-4">
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

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-12 relative z-10">
                  <div className="space-y-3">
                     <h3 className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Client Identity</h3>
                     <p className="text-lg sm:text-xl font-bold tracking-tight">{job.client}</p>
                     <div className="p-3 sm:p-4 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-100 space-y-2 shadow-inner">
                        <p className="text-slate-700 text-[10px] sm:text-[11px] font-medium leading-relaxed tracking-tight">{job.address}</p>
                        {job.lat && (
                           <div className="border-t border-slate-200 pt-2 space-y-1">
                              <div className="flex items-center gap-1.5">
                                 <span className="text-red-500 font-black text-[9px]">{'///'}</span>
                                 <span className="text-[8px] sm:text-[9px] font-black uppercase text-slate-900 tracking-widest">{job.w3w?.replace('///', '')}</span>
                              </div>
                              <p className="text-slate-700 text-[8px] font-mono uppercase">GPS: {job.lat.toFixed(6)}, {job.lng?.toFixed(6)}</p>
                           </div>
                        )}
                     </div>
                  </div>
                  <div className="space-y-3">
                     <h3 className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Technician</h3>
                     <p className="text-lg sm:text-xl font-bold tracking-tight">{job.technician}</p>
                     {/* SPRINT 4 FIX: Only show verification badges when data actually exists */}
                     <div className="flex flex-col gap-2">
                        {/* Geo-metadata - only show if job has coordinates OR photos have GPS */}
                        {(job.lat && job.lng) || job.photos.some(p => p.lat && p.lng) ? (
                           <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                 <span className="material-symbols-outlined text-success text-sm font-black">location_on</span>
                                 <p className="text-[9px] sm:text-[10px] text-slate-700 font-bold uppercase tracking-tight">Geo-metadata captured on-site</p>
                              </div>
                              <p className="text-[8px] text-slate-600 italic pl-6">
                                 (GPS coordinates recorded, not verified against address)
                              </p>
                           </div>
                        ) : (
                           <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                 <span className="material-symbols-outlined text-warning text-sm font-black">location_off</span>
                                 <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-tight">No geo-metadata captured</p>
                              </div>
                              <p className="text-[8px] text-slate-500 italic pl-6">
                                 (Location data not available for this job)
                              </p>
                           </div>
                        )}
                        {/* Account Verified - only show if magic link was used and opened */}
                        {magicLinkInfo && lifecycleSummary?.stages.some(s => s.stage === 'opened' && s.completed) ? (
                           <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                 <span className="material-symbols-outlined text-success text-sm font-black">lock</span>
                                 <p className="text-[9px] sm:text-[10px] text-slate-700 font-bold uppercase tracking-tight">Account Verified (Link)</p>
                              </div>
                              <p className="text-[8px] text-slate-600 italic pl-6">
                                 (Technician accessed via authenticated link)
                              </p>
                           </div>
                        ) : isSelfEmployedJob ? (
                           <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                 <span className="material-symbols-outlined text-success text-sm font-black">lock</span>
                                 <p className="text-[9px] sm:text-[10px] text-slate-700 font-bold uppercase tracking-tight">Account Verified (Self)</p>
                              </div>
                              <p className="text-[8px] text-slate-600 italic pl-6">
                                 (Self-employed: authenticated via account login)
                              </p>
                           </div>
                        ) : (
                           <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                 <span className="material-symbols-outlined text-warning text-sm font-black">lock_open</span>
                                 <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-tight">Not yet verified</p>
                              </div>
                              <p className="text-[8px] text-slate-500 italic pl-6">
                                 (No technician link sent or accessed)
                              </p>
                           </div>
                        )}
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
                                          <p className="text-[9px] text-slate-700 font-mono uppercase">UTC: {new Date(p.timestamp).toISOString().split('T')[1].substring(0, 8)}</p>
                                          <div className="flex items-center gap-1">
                                             <span className="material-symbols-outlined text-[10px] text-slate-700 font-black">location_on</span>
                                             <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">GPS Captured</span>
                                          </div>
                                       </div>
                                       <div className="flex flex-col gap-1">
                                          {/* W3W Location - Always show with verified/unverified status */}
                                          <div className="flex items-center gap-1.5 bg-slate-50 rounded-lg px-2 py-1">
                                             <span className="text-red-500 font-black text-[10px]">{'///'}</span>
                                             {p.w3w ? (
                                                <p className="text-slate-800 font-black uppercase text-[9px] tracking-wide">{p.w3w.replace('///', '')}</p>
                                             ) : (
                                                <p className="text-slate-400 font-medium text-[9px] italic">Location not captured</p>
                                             )}
                                             {(p as any).w3w_verified && (
                                                <span className="text-[8px] text-green-600 font-bold">✓</span>
                                             )}
                                          </div>
                                          {/* GPS Coordinates */}
                                          {p.lat && (
                                             <p className="text-[8px] font-mono text-slate-600 uppercase leading-none px-2">GPS: {p.lat.toFixed(5)}, {p.lng?.toFixed(5)}</p>
                                          )}
                                          {/* Photo SHA-256 fingerprint for evidence integrity */}
                                          {(p as any).photo_hash && (
                                             <div className="flex items-center gap-1 mt-1 pt-1 border-t border-slate-200 px-2">
                                                <span className="material-symbols-outlined text-[9px] text-slate-500">fingerprint</span>
                                                <p className="text-[7px] font-mono text-slate-500 uppercase tracking-tight" title={(p as any).photo_hash}>
                                                   SHA256: {(p as any).photo_hash.substring(0, 12)}...
                                                </p>
                                             </div>
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

               {/* Operational Narrative - Only show if notes exist OR job is sealed */}
               {(job.notes || isSealed) && (
                  <div className="space-y-4 pt-4 relative z-10">
                     <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Operational Narrative</h3>
                     <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 text-slate-800 font-medium leading-relaxed text-sm uppercase tracking-tight shadow-inner">
                        {job.notes || (isSealed ? "Work completed as per standard protocol." : "")}
                     </div>
                  </div>
               )}

               {/* Signature & Seal Section - Only show when there's evidence */}
               {(hasPhotos || isSealed) && (
                  <div className="pt-12 border-t border-slate-100 flex flex-col md:flex-row justify-between items-end gap-12 relative z-10">
                     <div className="flex-1 w-full space-y-4">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Attestation & Binding</h3>
                        {signatureDataUrl ? (
                           <div className="h-44 w-full bg-slate-50 rounded-[2.5rem] border border-slate-200 flex items-center justify-center p-8 shadow-inner relative group">
                              <img src={signatureDataUrl} alt="Signature" className="max-h-full max-w-full opacity-90 contrast-125" />
                              {isSealed ? (
                                 <div className="absolute top-6 right-6 flex items-center gap-2 px-3 py-1 bg-white rounded-full border border-slate-200 shadow-sm">
                                    <span className="size-2 bg-success rounded-full animate-pulse"></span>
                                    <span className="text-[9px] font-black text-success uppercase">Cryptographic Seal</span>
                                 </div>
                              ) : hasPhotos ? (
                                 <div className="absolute top-6 right-6 flex items-center gap-2 px-3 py-1 bg-success/10 rounded-full border border-success/30 shadow-sm">
                                    <span className="size-2 bg-success rounded-full"></span>
                                    <span className="text-[9px] font-black text-success uppercase">Ready to Seal</span>
                                 </div>
                              ) : null}
                           </div>
                        ) : isLoadingMedia ? (
                           <div className="h-44 w-full bg-slate-50 rounded-[2.5rem] border border-slate-200 flex flex-col items-center justify-center text-slate-400">
                              <div className="size-8 border-4 border-slate-300 border-t-primary rounded-full animate-spin"></div>
                              <p className="text-[10px] font-black uppercase tracking-widest mt-3">Loading Signature</p>
                           </div>
                        ) : hasPhotos ? (
                           <div className="h-44 w-full bg-amber-50 rounded-[2.5rem] border-2 border-dashed border-amber-300 flex flex-col items-center justify-center text-amber-600">
                              <span className="material-symbols-outlined text-5xl mb-2 font-black">signature</span>
                              <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Client Signature</p>
                           </div>
                        ) : null}
                        {(signatureDataUrl || hasPhotos) && (
                           <div className="flex justify-between text-[11px] font-black uppercase text-slate-600 px-4">
                              <div className="flex flex-col">
                                 <span className="text-slate-400 text-[9px] mb-1">Signatory</span>
                                 <span className="text-slate-700">{job.signerName || 'Pending'}</span>
                              </div>
                              <div className="flex flex-col text-right">
                                 <span className="text-slate-400 text-[9px] mb-1">Capacity</span>
                                 <span className="text-slate-700">{job.signerRole || 'Verified User'}</span>
                              </div>
                           </div>
                        )}
                     </div>

                     {/* Status Badge - Context-appropriate */}
                     {isSealed ? (
                        <div className="bg-slate-950 text-white p-10 rounded-[3rem] text-center w-full md:w-auto shrink-0 shadow-2xl border border-white/5 relative group overflow-hidden">
                           <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                           <span className="material-symbols-outlined text-6xl mb-3 text-success font-black relative z-10">verified</span>
                           <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-1 relative z-10">Cryptographically Sealed</p>
                           <p className="text-xl font-bold whitespace-nowrap tracking-tighter relative z-10">Evidence Verified</p>
                        </div>
                     ) : hasSignature ? (
                        <div className="bg-success/10 text-success p-10 rounded-[3rem] text-center w-full md:w-auto shrink-0 shadow-2xl border border-success/30 relative group overflow-hidden">
                           <span className="material-symbols-outlined text-6xl mb-3 text-success font-black relative z-10">task_alt</span>
                           <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-1 relative z-10">Complete</p>
                           <p className="text-xl font-bold whitespace-nowrap tracking-tighter relative z-10">Ready to Seal</p>
                        </div>
                     ) : (
                        <div className="bg-amber-900/20 text-amber-100 p-10 rounded-[3rem] text-center w-full md:w-auto shrink-0 shadow-2xl border border-amber-500/20 relative group overflow-hidden">
                           <span className="material-symbols-outlined text-6xl mb-3 text-amber-500 font-black relative z-10">edit_document</span>
                           <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-1 relative z-10">In Progress</p>
                           <p className="text-xl font-bold whitespace-nowrap tracking-tighter relative z-10">Collecting Evidence</p>
                        </div>
                     )}
                  </div>
               )}

               {/* Empty State - When no work has been done */}
               {!hasPhotos && !isSealed && (
                  <div className="pt-12 border-t border-slate-100 relative z-10">
                     <div className="bg-slate-100 rounded-[2.5rem] p-12 text-center">
                        <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">hourglass_empty</span>
                        <h3 className="text-xl font-black text-slate-500 uppercase tracking-tight mb-2">No Evidence Captured Yet</h3>
                        <p className="text-sm text-slate-400 max-w-md mx-auto">
                           {!techLinkSent
                              ? "Generate and send a technician link to begin evidence collection."
                              : !techLinkOpened
                              ? "Waiting for technician to open the job link."
                              : "Technician is working on the job. Evidence will appear here."}
                        </p>
                     </div>
                  </div>
               )}

               <div className="mt-16 pt-8 border-t border-slate-100 flex justify-between items-center text-[9px] font-mono text-slate-300 uppercase tracking-widest relative z-10">
                  {isSealed && job.evidenceHash && (
                     <p>SEAL: {job.evidenceHash.substring(0, 12).toUpperCase()}</p>
                  )}
                  <p>JOBPROOF</p>
                  <p>PAGE 01 OF 01</p>
               </div>
            </div>

            {!publicView && (
               <aside className="w-full lg:w-80 space-y-6 no-print shrink-0">
                  <div className="bg-slate-900 border border-white/5 p-8 rounded-[3rem] shadow-2xl sticky top-24 space-y-8">

                     {/* ============================================================ */}
                     {/* PRIORITY SECTION: Job Status & Blockers (ALWAYS AT TOP) */}
                     {/* ============================================================ */}
                     {!isSealed && (
                        <div className={`rounded-2xl p-5 border-2 ${
                           jobState.noWorkStarted
                              ? 'bg-danger/10 border-danger/30'
                              : jobState.readyForSeal
                              ? 'bg-success/10 border-success/30'
                              : 'bg-warning/10 border-warning/30'
                        }`}>
                           <div className="flex items-start gap-3">
                              <span className={`material-symbols-outlined text-2xl ${
                                 jobState.noWorkStarted ? 'text-danger' : jobState.readyForSeal ? 'text-success' : 'text-warning'
                              }`}>
                                 {jobState.noWorkStarted ? 'error' : jobState.readyForSeal ? 'task_alt' : 'pending'}
                              </span>
                              <div className="flex-1">
                                 <p className={`text-sm font-semibold tracking-tight ${
                                    jobState.noWorkStarted ? 'text-danger' : jobState.readyForSeal ? 'text-success' : 'text-warning'
                                 }`}>
                                    {jobState.noWorkStarted ? 'No Work Recorded'
                                     : jobState.readyForSeal ? 'Ready to Seal'
                                     : 'Evidence Incomplete'}
                                 </p>
                                 {blockers.length > 0 && (
                                    <p className="text-xs text-white/70 mt-1">{blockers[0]}</p>
                                 )}
                              </div>
                           </div>

                           {/* Quick Stats */}
                           <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/10">
                              <div className="text-center">
                                 <p className={`text-lg font-black ${hasPhotos ? 'text-success' : 'text-white/30'}`}>
                                    {job.photos.length}
                                 </p>
                                 <p className="text-[8px] font-bold text-white/50 uppercase">Photos</p>
                              </div>
                              <div className="text-center">
                                 <p className={`text-lg font-black ${hasSignature ? 'text-success' : 'text-white/30'}`}>
                                    {hasSignature ? '✓' : '—'}
                                 </p>
                                 <p className="text-[8px] font-bold text-white/50 uppercase">Signature</p>
                              </div>
                              <div className="text-center">
                                 <p className={`text-lg font-black ${isSealed ? 'text-success' : 'text-white/30'}`}>
                                    {isSealed ? '✓' : '—'}
                                 </p>
                                 <p className="text-[8px] font-bold text-white/50 uppercase">Sealed</p>
                              </div>
                           </div>
                        </div>
                     )}

                     {/* ============================================================ */}
                     {/* LINK STATUS (Shown prominently when job not complete) */}
                     {/* ============================================================ */}
                     {!isSealed && magicLinkInfo && (
                        <div className={`rounded-2xl p-4 border ${
                           !techLinkOpened ? 'bg-danger/10 border-danger/30' : 'bg-slate-800/50 border-white/5'
                        }`}>
                           <div className="flex items-center justify-between mb-3">
                              <span className="text-[10px] font-black text-white uppercase tracking-widest">Tech Link</span>
                              <span className={`text-[10px] font-black uppercase tracking-widest ${getLinkStatusColor(magicLinkInfo.status)}`}>
                                 {magicLinkInfo.status}
                              </span>
                           </div>

                           {!techLinkOpened && (
                              <div className="flex items-center gap-2 mb-3 p-2 bg-danger/20 rounded-lg">
                                 <span className="material-symbols-outlined text-danger text-sm animate-pulse">warning</span>
                                 <span className="text-[10px] font-bold text-danger">Link not opened by technician</span>
                              </div>
                           )}

                           {/* Lifecycle Mini-Display */}
                           {lifecycleSummary && (
                              <div className="flex items-center gap-1 mb-3">
                                 {['sent', 'opened', 'job_started', 'job_completed'].map((stage, idx) => {
                                    const stageData = lifecycleSummary.stages.find(s => s.stage === stage);
                                    const isComplete = stageData?.completed;
                                    return (
                                       <React.Fragment key={stage}>
                                          <div className={`size-6 rounded-lg flex items-center justify-center ${
                                             isComplete ? 'bg-success/20 text-success' : 'bg-slate-700 text-slate-500'
                                          }`}>
                                             <span className="material-symbols-outlined text-[10px]">
                                                {stage === 'sent' ? 'send' : stage === 'opened' ? 'visibility' : stage === 'job_started' ? 'photo_camera' : 'verified'}
                                             </span>
                                          </div>
                                          {idx < 3 && <div className={`flex-1 h-px ${isComplete ? 'bg-success/50' : 'bg-slate-700'}`} />}
                                       </React.Fragment>
                                    );
                                 })}
                              </div>
                           )}

                           <button
                              onClick={handleCopyLink}
                              className="w-full py-2 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg font-bold uppercase tracking-widest text-[9px] transition-all flex items-center justify-center gap-2"
                           >
                              <span className="material-symbols-outlined text-xs">content_copy</span>
                              Copy Link
                           </button>
                        </div>
                     )}

                     {/* ============================================================ */}
                     {/* ACTIONS (Conditional based on job state) */}
                     {/* ============================================================ */}
                     <div>
                        <h3 className="text-xs font-black text-white mb-6 uppercase tracking-[0.2em]">Actions</h3>
                        <div className="space-y-3">
                           {isSealed && !existingInvoice && (
                              <button onClick={handleGenerateInvoice} className="w-full bg-success hover:bg-emerald-600 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all uppercase tracking-widest text-[10px] shadow-lg shadow-success/20 group">
                                 <span className="material-symbols-outlined text-sm font-black group-hover:rotate-12 transition-transform">receipt</span>
                                 Create Invoice
                              </button>
                           )}
                           {isSealed && (
                              <button onClick={() => setShowClientReceipt(true)} className="w-full bg-white/5 hover:bg-white/10 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all uppercase tracking-widest text-[10px] border border-white/10 group">
                                 <span className="material-symbols-outlined text-sm font-black">receipt_long</span>
                                 Client Receipt
                                 {isSelfEmployedJob && (
                                    <span className="bg-success/20 text-success text-[8px] px-2 py-0.5 rounded-full ml-1">Self-Emp</span>
                                 )}
                              </button>
                           )}
                           {/* Only show print/share when there's actual evidence */}
                           {hasPhotos ? (
                              <>
                                 <button onClick={() => window.print()} className="w-full bg-primary hover:bg-blue-600 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20">
                                    <span className="material-symbols-outlined text-sm font-black">print</span>
                                    Print / Export PDF
                                 </button>
                                 <button onClick={() => setShowShareModal(true)} className="w-full bg-white/5 hover:bg-white/10 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all uppercase tracking-widest text-[10px] border border-white/10">
                                    <span className="material-symbols-outlined text-sm font-black">share</span>
                                    Share Evidence Link
                                 </button>
                              </>
                           ) : (
                              <div className="text-center py-4 text-white/30">
                                 <span className="material-symbols-outlined text-2xl mb-2">print_disabled</span>
                                 <p className="text-[10px] uppercase tracking-widest">No evidence to print</p>
                              </div>
                           )}
                        </div>
                     </div>

                     {/* Magic Link Management Section */}
                     {job.status !== 'Submitted' && (
                        <div className="pt-8 border-t border-white/5">
                           <button
                              onClick={() => setShowLinkManagement(!showLinkManagement)}
                              className="w-full flex items-center justify-between mb-4"
                           >
                              <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Technician Link</h3>
                              <span className={`material-symbols-outlined text-slate-400 text-sm transition-transform ${showLinkManagement ? 'rotate-180' : ''}`}>
                                 expand_more
                              </span>
                           </button>

                           {showLinkManagement && (
                              <div className="space-y-4 animate-in">
                                 {/* Link Status */}
                                 {magicLinkInfo ? (
                                    <div className="bg-slate-800/50 rounded-2xl p-4 border border-white/5 space-y-3">
                                       <div className="flex items-center justify-between">
                                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</span>
                                          <span className={`text-[10px] font-black uppercase tracking-widest ${getLinkStatusColor(magicLinkInfo.status)}`}>
                                             {magicLinkInfo.status}
                                          </span>
                                       </div>
                                       <div className="flex items-center justify-between">
                                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Expires</span>
                                          <span className={`text-[10px] font-bold ${
                                             new Date(magicLinkInfo.expires_at).getTime() - Date.now() < 24 * 60 * 60 * 1000
                                                ? 'text-warning'
                                                : 'text-slate-300'
                                          }`}>
                                             {formatExpiration(magicLinkInfo.expires_at)}
                                          </span>
                                       </div>
                                       {magicLinkInfo.first_accessed_at && (
                                          <div className="flex items-center justify-between">
                                             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">First Used</span>
                                             <span className="text-[10px] text-slate-300">
                                                {new Date(magicLinkInfo.first_accessed_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                             </span>
                                          </div>
                                       )}
                                    </div>
                                 ) : (
                                    <div className="bg-slate-800/50 rounded-2xl p-4 border border-white/5 text-center">
                                       <span className="material-symbols-outlined text-slate-500 text-2xl mb-2">link_off</span>
                                       <p className="text-[10px] text-slate-400 uppercase tracking-widest">No active link</p>
                                    </div>
                                 )}

                                 {/* Link Lifecycle Timeline */}
                                 {lifecycleSummary && (
                                    <div className="bg-slate-800/50 rounded-2xl p-4 border border-white/5">
                                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Link Lifecycle</p>
                                       <div className="flex items-center justify-between gap-1">
                                          {[
                                             { stage: 'sent' as LinkLifecycleStage, icon: 'send', label: 'Sent' },
                                             { stage: 'opened' as LinkLifecycleStage, icon: 'visibility', label: 'Opened' },
                                             { stage: 'job_started' as LinkLifecycleStage, icon: 'photo_camera', label: 'Started' },
                                             { stage: 'job_completed' as LinkLifecycleStage, icon: 'verified', label: 'Done' },
                                          ].map((item, idx) => {
                                             const stageData = lifecycleSummary.stages.find(s => s.stage === item.stage);
                                             const isCompleted = stageData?.completed;
                                             const isCurrent = lifecycleSummary.currentStage === item.stage;
                                             return (
                                                <React.Fragment key={item.stage}>
                                                   <div className={`flex flex-col items-center gap-1 ${isCompleted ? 'opacity-100' : 'opacity-30'}`}>
                                                      <div className={`size-7 rounded-lg flex items-center justify-center ${
                                                         isCompleted
                                                            ? isCurrent
                                                               ? 'bg-primary text-white'
                                                               : 'bg-success/20 text-success'
                                                            : 'bg-slate-700 text-slate-500'
                                                      }`}>
                                                         <span className="material-symbols-outlined text-xs">{item.icon}</span>
                                                      </div>
                                                      <span className="text-[7px] font-bold uppercase tracking-widest text-slate-400">{item.label}</span>
                                                   </div>
                                                   {idx < 3 && (
                                                      <div className={`flex-1 h-px ${
                                                         lifecycleSummary.stages.findIndex(s => s.stage === item.stage && s.completed) <
                                                         lifecycleSummary.stages.findIndex(s => s.stage === lifecycleSummary.currentStage)
                                                            ? 'bg-success/50'
                                                            : 'bg-slate-700'
                                                      }`} />
                                                   )}
                                                </React.Fragment>
                                             );
                                          })}
                                       </div>
                                    </div>
                                 )}

                                 {/* Alert Banner for Unopened Links */}
                                 {lifecycleSummary?.needsAttention && (
                                    <div className="bg-warning/10 border border-warning/30 rounded-xl p-3">
                                       <div className="flex items-start gap-2">
                                          <span className="material-symbols-outlined text-warning text-sm animate-pulse">warning</span>
                                          <div className="flex-1">
                                             <p className="text-[9px] font-black text-warning uppercase tracking-widest">Needs Attention</p>
                                             <p className="text-[10px] text-slate-300 mt-1">
                                                {lifecycleSummary.flagReason || 'Link has not been opened by technician'}
                                             </p>
                                          </div>
                                          <button
                                             onClick={() => {
                                                if (magicLinkInfo) {
                                                   acknowledgeLinkFlag(magicLinkInfo.token);
                                                   setLifecycleSummary(prev => prev ? { ...prev, needsAttention: false } : null);
                                                }
                                             }}
                                             className="text-[8px] font-bold text-warning hover:text-white uppercase tracking-widest px-2 py-1 rounded-lg bg-warning/20 hover:bg-warning/30 transition-all"
                                          >
                                             Dismiss
                                          </button>
                                       </div>
                                    </div>
                                 )}

                                 {/* Action Message */}
                                 {linkActionMessage && (
                                    <div className={`rounded-xl p-3 text-center text-[10px] font-black uppercase tracking-widest ${
                                       linkActionMessage.type === 'success'
                                          ? 'bg-success/20 text-success border border-success/30'
                                          : 'bg-danger/20 text-danger border border-danger/30'
                                    }`}>
                                       {linkActionMessage.text}
                                    </div>
                                 )}

                                 {/* Link Actions */}
                                 <div className="space-y-2">
                                    {magicLinkInfo?.status === 'active' && (
                                       <button
                                          onClick={handleCopyLink}
                                          disabled={linkActionLoading}
                                          className="w-full py-3 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-xl font-black uppercase tracking-widest text-[9px] transition-all flex items-center justify-center gap-2"
                                       >
                                          <span className="material-symbols-outlined text-xs">content_copy</span>
                                          Copy Technician Link
                                       </button>
                                    )}

                                    <button
                                       onClick={handleRegenerateLink}
                                       disabled={linkActionLoading}
                                       className="w-full py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-black uppercase tracking-widest text-[9px] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                       <span className="material-symbols-outlined text-xs">refresh</span>
                                       {magicLinkInfo ? 'Regenerate Link' : 'Generate New Link'}
                                    </button>

                                    {magicLinkInfo?.status === 'active' && (
                                       <>
                                          {/* Extend Duration Options */}
                                          <div className="grid grid-cols-3 gap-2">
                                             <button
                                                onClick={() => handleExtendLink(LINK_EXPIRATION.SHORT)}
                                                disabled={linkActionLoading}
                                                className="py-2 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-lg text-[8px] font-bold uppercase tracking-widest transition-all disabled:opacity-50"
                                             >
                                                +24h
                                             </button>
                                             <button
                                                onClick={() => handleExtendLink(LINK_EXPIRATION.STANDARD)}
                                                disabled={linkActionLoading}
                                                className="py-2 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-lg text-[8px] font-bold uppercase tracking-widest transition-all disabled:opacity-50"
                                             >
                                                +7 days
                                             </button>
                                             <button
                                                onClick={() => handleExtendLink(LINK_EXPIRATION.EXTENDED)}
                                                disabled={linkActionLoading}
                                                className="py-2 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-lg text-[8px] font-bold uppercase tracking-widest transition-all disabled:opacity-50"
                                             >
                                                +30 days
                                             </button>
                                          </div>

                                          <button
                                             onClick={handleRevokeLink}
                                             disabled={linkActionLoading}
                                             className="w-full py-3 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/30 rounded-xl font-black uppercase tracking-widest text-[9px] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                          >
                                             <span className="material-symbols-outlined text-xs">link_off</span>
                                             Revoke Link
                                          </button>
                                       </>
                                    )}

                                    {/* Reassign Button */}
                                    <button
                                       onClick={() => setShowReassignModal(true)}
                                       disabled={linkActionLoading}
                                       className="w-full py-3 bg-warning/10 hover:bg-warning/20 text-warning border border-warning/30 rounded-xl font-black uppercase tracking-widest text-[9px] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                       <span className="material-symbols-outlined text-xs">swap_horiz</span>
                                       Reassign Technician
                                    </button>
                                 </div>
                              </div>
                           )}
                        </div>
                     )}

                     <div className="pt-8 border-t border-white/5">
                        <h3 className="text-[10px] font-black text-white mb-4 uppercase tracking-[0.2em]">Evidence Status</h3>
                        <div className="space-y-3">
                           <StatusLine
                              label="Photos"
                              value={hasPhotos ? `${job.photos.length} Captured` : "None"}
                              success={hasPhotos}
                           />
                           <StatusLine
                              label="Signature"
                              value={hasSignature ? "Obtained" : "Pending"}
                              success={hasSignature}
                           />
                           <StatusLine
                              label="Seal Status"
                              value={isSealed ? "Verified" : hasPhotos && hasSignature ? "Ready" : "Incomplete"}
                              success={isSealed}
                           />
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
                     <QRCodeSVG value={getReportUrl(job.id)} size={192} level="M" />
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

         {/* Reassign Technician Modal */}
         {showReassignModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in" onClick={() => setShowReassignModal(false)}>
               <div className="bg-slate-900 border border-white/10 p-8 rounded-[3rem] max-w-md w-full shadow-2xl space-y-6" onClick={(e) => e.stopPropagation()}>
                  <div className="text-center space-y-3">
                     <div className="bg-warning/20 size-14 rounded-2xl flex items-center justify-center mx-auto">
                        <span className="material-symbols-outlined text-warning text-3xl font-black">swap_horiz</span>
                     </div>
                     <h3 className="text-xl font-black text-white tracking-tighter uppercase">Reassign Technician</h3>
                     <p className="text-xs text-slate-400 uppercase tracking-widest">
                        Current: <span className="text-white font-bold">{job.technician}</span>
                     </p>
                  </div>

                  <div className="bg-warning/10 border border-warning/20 rounded-2xl p-4">
                     <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-warning text-lg">warning</span>
                        <div className="space-y-1">
                           <p className="text-[10px] font-black text-warning uppercase tracking-widest">Important</p>
                           <p className="text-xs text-slate-300">
                              Reassigning will revoke the current technician&apos;s access and generate a new link for the selected technician.
                           </p>
                        </div>
                     </div>
                  </div>

                  <div className="space-y-3">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select New Technician</p>
                     <div className="space-y-2 max-h-60 overflow-y-auto">
                        {technicians.filter(t => t.id !== job.techId && t.status !== 'Off Duty').map(tech => (
                           <button
                              key={tech.id}
                              onClick={() => handleReassignJob(tech.id, tech.name)}
                              disabled={linkActionLoading}
                              className="w-full flex items-center gap-4 p-4 bg-slate-800/50 hover:bg-slate-800 border border-white/5 hover:border-primary/30 rounded-2xl transition-all group disabled:opacity-50"
                           >
                              <div className="size-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-black text-sm">
                                 {tech.name[0]}
                              </div>
                              <div className="flex-1 text-left">
                                 <p className="text-sm font-black text-white uppercase tracking-tight">{tech.name}</p>
                                 <p className="text-[10px] text-slate-400 uppercase tracking-widest">{tech.status}</p>
                              </div>
                              <span className="material-symbols-outlined text-slate-500 group-hover:text-primary text-lg transition-colors">
                                 arrow_forward
                              </span>
                           </button>
                        ))}
                        {technicians.filter(t => t.id !== job.techId && t.status !== 'Off Duty').length === 0 && (
                           <div className="text-center py-8 text-slate-500">
                              <span className="material-symbols-outlined text-3xl mb-2">person_off</span>
                              <p className="text-xs uppercase tracking-widest">No available technicians</p>
                           </div>
                        )}
                     </div>
                  </div>

                  <button
                     onClick={() => setShowReassignModal(false)}
                     className="w-full py-3 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-2xl font-black uppercase tracking-widest transition-all"
                  >
                     Cancel
                  </button>
               </div>
            </div>
         )}

         {/* Client Receipt Modal */}
         {showClientReceipt && job && (
            <ClientReceiptView
               job={job}
               onClose={() => setShowClientReceipt(false)}
            />
         )}
      </Layout>
   );
};

const TimelineStep = ({ label, time, icon, active = true }: any) => (
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
      <span className="text-white/60">{label}</span>
      <span className={success ? 'text-success' : 'text-white/40'}>{value}</span>
   </div>
);

export default JobReport;
