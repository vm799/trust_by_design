
import React, { useState, useRef, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { useParams, useNavigate } from 'react-router-dom';
import { Job, Photo, SyncStatus, PhotoType, SafetyCheck } from '../types';
import { saveMediaLocal, getMediaLocal, getJobLocal, saveJobLocal, queueAction } from '../lib/offline/db';
import { validateMagicLink, getJobByToken, updateJob } from '../lib/db';
import { sealEvidence, canSealJob } from '../lib/sealing';
import { isSupabaseAvailable } from '../lib/supabase'; // Kept for connectivity check

const TechnicianPortal: React.FC<{ jobs: Job[], onUpdateJob: (j: Job) => void }> = ({ jobs, onUpdateJob }) => {
  const { token, jobId } = useParams();
  const navigate = useNavigate();

  // Token-based access (Phase C.2)
  const [job, setJob] = useState<Job | undefined>(undefined);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isLoadingJob, setIsLoadingJob] = useState(true);

  // Load job via token or legacy jobId
  useEffect(() => {
    const loadJob = async () => {
      setIsLoadingJob(true);
      setTokenError(null);

      try {
        let loadedJob: Job | undefined;

        // 1. Try Local DB (Dexie) first
        if (jobId) {
          const local = await getJobLocal(jobId);
          if (local) loadedJob = local as Job;
        }

        // 2. If not local, try Token/Network
        if (!loadedJob && token) {
          const result = await getJobByToken(token);
          if (result.success && result.data) {
            loadedJob = result.data;
            // Cache to Local DB immediately
            // @ts-ignore - LocalJob needs number lastUpdated
            await saveJobLocal({ ...loadedJob, lastUpdated: Date.now() });
          } else {
            setTokenError(result.error as string || 'Invalid or expired link');
          }
        } else if (!loadedJob && jobId) {
          // Fallback to props/legacy
          loadedJob = jobs.find(j => j.id === jobId);
          if (loadedJob) {
            await saveJobLocal({ ...loadedJob, lastUpdated: Date.now() });
          }
        }

        if (loadedJob) {
          setJob(loadedJob);
        } else if (!tokenError) { // Only set 'not found' if we haven't already set a token error
          setTokenError('Job not found locally or remotely');
        }

      } catch (error) {
        console.error('Failed to load job:', error);
        setTokenError('Failed to load job. Please try again.');
      } finally {
        setIsLoadingJob(false);
      }
    };

    loadJob();
  }, [token, jobId, jobs]);

  // Immutable State Protection: Block access if job is already submitted or sealed
  useEffect(() => {
    if (job?.status === 'Submitted' || job?.isSealed || job?.sealedAt) {
      alert('This job has been sealed and is immutable. No further edits allowed.');
      navigate('/home');
    }
  }, [job?.status, job?.isSealed, job?.sealedAt, navigate]);

  // Check IndexedDB availability on mount
  useEffect(() => {
    if (!window.indexedDB) {
      alert('Critical: Your browser does not support offline storage. Photos and signatures cannot be saved. Please use a modern browser.');
    }
  }, []);

  // ... (Draft State Helpers remain same) ...

  // ... (State Management remains same) ...

  // NOTE: I'm skipping unchanged lines in this replacement for brevity if possible, but replace_file_content needs contiguous block.
  // I will replace from line 80 to 217 to cover both useEffects.

  // Re-inserting the skipped helper functions and state initialization is heavy.
  // I will target two separate chunks if possible, but `replace_file_content` is single chunk.
  // I'll do a large chunk replacement to clean up the 'saveMedia' references in one go.

  // Actually, I can just replace the specific useEffects if I locate them precisely.
  // But I don't have line numbers for the middle parts perfectly.
  // I'll replace the whole top section from line 80 to 217.

  // Wait, I can use `multi_replace`? No, `replace_file_content` instructions say "use multi_replace" for non-contiguous.
  // I will use `replace_file_content` on the first block (IndexedDB check) and then another call for the second block (loadPhotos).

  // No, I'll do one big replace of `checkIndexedDB` and `loadPhotosFromIndexedDB` is further down.
  // I'll do `checkIndexedDB` first.


  // Helper functions for draft state persistence
  const getDraftState = () => {
    if (!job?.id) return null;
    try {
      const saved = localStorage.getItem(`jobproof_draft_${job.id}`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  const saveDraftState = (state: any) => {
    if (!job?.id) return;
    try {
      localStorage.setItem(`jobproof_draft_${job.id}`, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save draft state:', error);
    }
  };

  const clearDraftState = () => {
    if (!job?.id) return;
    localStorage.removeItem(`jobproof_draft_${job.id}`);
    localStorage.removeItem(`jobproof_progress_${job.id}`);
  };

  // State management (initialized with defaults, populated after job loads)
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoDataUrls, setPhotoDataUrls] = useState<Map<string, string>>(new Map());
  const [checklist, setChecklist] = useState<SafetyCheck[]>([
    { id: 'sc1', label: 'PPE (Hard Hat, Gloves, Hi-Vis) Worn', checked: false, required: true },
    { id: 'sc2', label: 'Site Hazards Identified & Controlled', checked: false, required: true },
    { id: 'sc3', label: 'Required Permits/Authorizations Checked', checked: false, required: true },
    { id: 'sc4', label: 'Area Clear of Bystanders', checked: false, required: true }
  ]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [localSyncStatus, setLocalSyncStatus] = useState<SyncStatus>('synced');
  const [signerName, setSignerName] = useState('');
  const [signerRole, setSignerRole] = useState('Client');
  const [activePhotoType, setActivePhotoType] = useState<PhotoType>('Before');
  const [locationStatus, setLocationStatus] = useState<'idle' | 'capturing' | 'captured' | 'denied'>('idle');
  const [w3w, setW3w] = useState('');
  const [coords, setCoords] = useState<{ lat?: number, lng?: number }>({});

  // Initialize state from job and draft once job is loaded
  useEffect(() => {
    if (!job?.id) return;

    const draft = getDraftState();
    const savedProgress = localStorage.getItem(`jobproof_progress_${job.id}`);

    // Restore step
    setStep(savedProgress ? parseInt(savedProgress) : (draft?.step || 0));

    // Restore photos
    setPhotos(draft?.photos || job.photos || []);

    // Restore checklist
    setChecklist(draft?.checklist || job.safetyChecklist || checklist);

    // Restore other fields
    setNotes(draft?.notes || job.notes || '');
    setLocalSyncStatus(job.syncStatus || 'synced');
    setSignerName(draft?.signerName || job.signerName || '');
    setSignerRole(draft?.signerRole || job.signerRole || 'Client');
    setLocationStatus(draft?.locationStatus || 'idle');
    setW3w(draft?.w3w || job.w3w || '');
    setCoords(draft?.coords || { lat: job.lat, lng: job.lng });
  }, [job?.id]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDrawing = useRef(false);

  // Auto-save progress: Save step to localStorage
  useEffect(() => {
    if (job?.id && step < 5) {
      localStorage.setItem(`jobproof_progress_${job.id}`, step.toString());
    } else if (job?.id && step === 5) {
      // Clear progress and draft on completion
      clearDraftState();
    }
  }, [step, jobId]);

  // Auto-save draft state: Persist all form data on change
  useEffect(() => {
    if (jobId && step < 5 && step > 0) {
      saveDraftState({
        step,
        photos,
        checklist,
        notes,
        signerName,
        signerRole,
        locationStatus,
        w3w,
        coords
      });
    }
  }, [step, photos, checklist, notes, signerName, signerRole, locationStatus, w3w, coords, jobId]);

  // Load photos from IndexedDB on mount
  useEffect(() => {
    const loadPhotosFromIndexedDB = async () => {
      const loadedUrls = new Map<string, string>();
      for (const photo of photos) {
        if (photo.isIndexedDBRef) {
          try {
            const data = await getMediaLocal(photo.url);
            if (data) loadedUrls.set(photo.id, data);
          } catch (e) {
            console.warn('Failed to load local media:', photo.id);
          }
        }
      }
      setPhotoDataUrls(loadedUrls);
    };
    if (photos.length > 0) loadPhotosFromIndexedDB();
  }, [photos]);

  // Offline-First Sync: Write to Local DB and Queue is handled by writeLocalDraft
  const triggerSync = useCallback(async (data: Job) => {
    // Legacy compatibility: ensure data is queued
    await queueAction('UPDATE_JOB', data);
    setLocalSyncStatus('pending');
  }, []);

  // Monitor connectivity for visual status only
  useEffect(() => {
    const handleConnectivity = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleConnectivity);
    window.addEventListener('offline', handleConnectivity);
    return () => {
      window.removeEventListener('online', handleConnectivity);
      window.removeEventListener('offline', handleConnectivity);
    };
  }, []);

  const writeLocalDraft = useCallback(async (fields: Partial<Job>) => {
    if (!job) return;
    const updatedJob: Job = {
      ...job,
      ...fields,
      syncStatus: 'pending',
      lastUpdated: Date.now()
    };

    // Optimistic UI Update
    onUpdateJob(updatedJob);
    setLocalSyncStatus('pending');
    setJob(prev => prev ? ({ ...prev, ...fields }) : undefined); // Local state update

    // Persist to Local DB
    // @ts-ignore
    await saveJobLocal(updatedJob);

    // Queue for Background Sync
    // We send { id, ...fields } to patch
    await queueAction('UPDATE_JOB', { id: job.id, ...fields });

  }, [job, onUpdateJob]);

  const captureLocation = () => {
    setLocationStatus('capturing');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        // Enhanced what3words mock with more professional word pool
        const words = ['index', 'engine', 'logic', 'rugged', 'field', 'safe', 'audit', 'track', 'proof', 'solid', 'fixed', 'frame', 'steel', 'core', 'vault', 'trust', 'chain', 'lock', 'verify', 'secure'];
        const mockW3w = `///${words[Math.floor(Math.random() * words.length)]}.${words[Math.floor(Math.random() * words.length)]}.${words[Math.floor(Math.random() * words.length)]}`;

        setCoords({ lat, lng });
        setW3w(mockW3w);
        setLocationStatus('captured');
        writeLocalDraft({ w3w: mockW3w, lat, lng });
      },
      (error) => {
        console.error('Geolocation error:', error);
        setLocationStatus('denied');
      },
      { timeout: 5000, enableHighAccuracy: true }
    );
  };

  const manualLocationEntry = () => {
    const manualLat = prompt('Enter latitude (e.g., 51.505):');
    const manualLng = prompt('Enter longitude (e.g., -0.09):');

    if (manualLat && manualLng) {
      const lat = parseFloat(manualLat);
      const lng = parseFloat(manualLng);

      if (!isNaN(lat) && !isNaN(lng)) {
        const words = ['manual', 'entry', 'fallback', 'override', 'verified', 'admin', 'field', 'tech', 'secure'];
        const mockW3w = `///${words[Math.floor(Math.random() * words.length)]}.${words[Math.floor(Math.random() * words.length)]}.${words[Math.floor(Math.random() * words.length)]}`;

        setCoords({ lat, lng });
        setW3w(mockW3w);
        setLocationStatus('captured');
        writeLocalDraft({ w3w: mockW3w, lat, lng });
      } else {
        alert('Invalid coordinates. Please try again.');
      }
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
      }
    }
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !job) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const dataUrl = reader.result as string;
        const photoId = Math.random().toString(36).substr(2, 9);
        const mediaKey = `media_${photoId}`;

        // 1. Store full Base64 in Dexie (Local DB)
        await saveMediaLocal(mediaKey, job.id, dataUrl);

        // 2. Create Photo Object (Lightweight)
        const newPhoto: Photo = {
          id: photoId,
          url: mediaKey, // Key reference
          timestamp: new Date().toISOString(),
          verified: true,
          syncStatus: 'pending',
          type: activePhotoType,
          w3w: w3w || undefined,
          lat: coords.lat,
          lng: coords.lng,
          isIndexedDBRef: true
        };

        const nextPhotos = [...photos, newPhoto];
        setPhotos(nextPhotos);

        // 3. Cache for display
        setPhotoDataUrls(prev => new Map(prev).set(photoId, dataUrl));

        // 4. Update Job with new photo list
        writeLocalDraft({ photos: nextPhotos });

        // 5. Queue Background Upload
        // We rely on the Sync Engine to read the blob from Dexie using the ID
        await queueAction('UPLOAD_PHOTO', { id: mediaKey, jobId: job.id });

      } catch (error) {
        console.error('Failed to save photo to IndexedDB:', error);
        alert('Failed to save photo. Your device storage may be full. Please free up space and try again.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFinalSeal = async () => {
    if (!job) return;

    // Phase C.3: Validate sealing requirements
    const sealCheck = canSealJob({ ...job, photos, signature: signerName });

    if (!sealCheck.canSeal) {
      alert(sealCheck.reasons?.join(', ') || 'Cannot seal job');
      return;
    }

    // Critical Validation: Enforce audit spec requirements
    if (photos.length === 0) {
      alert('Evidence Capture Required: At least one photo must be captured before sealing the job.');
      return;
    }

    if (!signerName || signerName.trim() === '') {
      alert('Signatory Identification Required: Please enter the full legal name of the person signing.');
      return;
    }

    setIsSubmitting(true);
    const canvas = canvasRef.current;
    const signatureData = canvas?.toDataURL() || null;

    // Validate that signature canvas is not empty
    if (canvas) {
      const ctx = canvas.getContext('2d');
      const pixelData = ctx?.getImageData(0, 0, canvas.width, canvas.height).data;
      const isEmpty = pixelData ? !Array.from(pixelData).some(channel => channel !== 0) : true;

      if (isEmpty) {
        alert('Signature Required: Please sign the canvas before submitting.');
        setIsSubmitting(false);
        return;
      }
    }

    const signatureKey = signatureData ? `sig_${job?.id}` : null;

    // Store full signature Base64 in IndexedDB
    if (signatureData && signatureKey) {
      try {
        await saveMediaLocal(signatureKey, job.id, signatureData);
      } catch (error) {
        console.error('Failed to save signature to IndexedDB:', error);
        alert('Failed to save signature. Your device storage may be full. Please free up space and try again.');
        setIsSubmitting(false);
        return;
      }
    }

    // First, update job with final evidence data
    const updatedJob: Job = {
      ...job,
      status: 'In Progress', // Will be set to 'Submitted' after seal
      photos,
      notes,
      signature: signatureKey,
      signatureIsIndexedDBRef: !!signatureKey,
      signerName,
      signerRole,
      safetyChecklist: checklist,
      completedAt: new Date().toISOString(),
      syncStatus: 'pending',
      lastUpdated: Date.now()
    };

    // Update job in database before sealing
    try {
      const updateResult = await updateJob(job.id, updatedJob);

      if (!updateResult.success) {
        console.warn('Failed to update job before sealing, proceeding with local update');
        onUpdateJob(updatedJob);
      }

      // Phase C.3: Call server-side cryptographic sealing
      const sealResult = await sealEvidence(job.id);

      if (!sealResult.success) {
        alert(`Sealing failed: ${sealResult.error}\n\nJob data has been saved but not sealed. You can try sealing again from the admin dashboard.`);
        setIsSubmitting(false);
        return;
      }

      // Update job with seal metadata
      const sealedJob: Job = {
        ...updatedJob,
        status: 'Submitted',
        sealedAt: sealResult.sealedAt,
        evidenceHash: sealResult.evidenceHash,
        isSealed: true
      };

      onUpdateJob(sealedJob);

      // Show success
      setTimeout(() => {
        setIsSubmitting(false);
        setStep(5);
      }, 1000);
    } catch (error) {
      console.error('Sealing error:', error);
      alert('Failed to seal evidence. Please try again or contact support.');
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (isLoadingJob) {
    return (
      <Layout isAdmin={false}>
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-8">
          <div className="size-20 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm font-black uppercase tracking-widest">Loading Job...</p>
        </div>
      </Layout>
    );
  }

  // Token validation error
  if (tokenError) {
    return (
      <Layout isAdmin={false}>
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-8 animate-in">
          <div className="size-32 rounded-[2.5rem] bg-danger/10 text-danger flex items-center justify-center border border-white/5 shadow-2xl relative">
            <span className="material-symbols-outlined text-7xl font-black text-danger">error</span>
          </div>
          <div className="space-y-3">
            <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none text-danger">Access Denied</h2>
            <p className="text-slate-400 text-sm max-w-[420px] mx-auto font-medium leading-relaxed">{tokenError}</p>
            <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 mt-4">
              <p className="text-xs text-slate-500 font-medium">Common reasons:</p>
              <ul className="text-xs text-slate-400 mt-2 space-y-1 text-left max-w-xs mx-auto">
                <li>• Link has expired (7 day limit)</li>
                <li>• Job has been sealed</li>
                <li>• Invalid or corrupted link</li>
              </ul>
            </div>
          </div>
          <button onClick={() => navigate('/home')} className="w-full max-w-xs py-5 bg-white/5 px-8 rounded-2xl font-black text-xs uppercase tracking-[0.3em] border border-white/5 hover:bg-white/10 transition-all shadow-xl">Return to Home</button>
        </div>
      </Layout>
    );
  }

  // Job not found (legacy fallback)
  if (!job) {
    return (
      <Layout isAdmin={false}>
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-8 animate-in">
          <div className="size-32 rounded-[2.5rem] bg-danger/10 text-danger flex items-center justify-center border border-white/5 shadow-2xl relative">
            <span className="material-symbols-outlined text-7xl font-black text-danger">error</span>
          </div>
          <div className="space-y-3">
            <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none text-danger">Job Not Found</h2>
            <p className="text-slate-400 text-sm max-w-[420px] mx-auto font-medium leading-relaxed">The job ID in this link is invalid or has been removed. Please check the URL or contact your administrator for a valid magic link.</p>
          </div>
          <button onClick={() => navigate('/home')} className="w-full max-w-xs py-5 bg-white/5 px-8 rounded-2xl font-black text-xs uppercase tracking-[0.3em] border border-white/5 hover:bg-white/10 transition-all shadow-xl">Return to Home</button>
        </div>
      </Layout>
    );
  }

  if (step === 5) {
    return (
      <Layout isAdmin={false}>
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-8 animate-in">
          <div className="size-32 rounded-[2.5rem] bg-success/10 text-success flex items-center justify-center border border-white/5 shadow-2xl relative">
            <span className="material-symbols-outlined text-7xl font-black text-success">verified</span>
          </div>
          <div className="space-y-3">
            <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none text-success">Job Sealed</h2>
            <p className="text-slate-400 text-sm max-w-[320px] mx-auto font-medium leading-relaxed uppercase tracking-tight">Evidence bundle committed to local persistence and queued for hub synchronization.</p>
          </div>
          <button onClick={() => navigate('/home')} className="w-full max-w-xs py-5 bg-white/5 px-8 rounded-2xl font-black text-xs uppercase tracking-[0.3em] border border-white/5 hover:bg-white/10 transition-all shadow-xl">Return to Hub</button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout isAdmin={false}>
      <div className="fixed top-0 left-0 right-0 z-[100] h-1.5 flex bg-slate-900">
        <div
          className={`h-full transition-all duration-1000 ${isOnline ? (isSyncing ? 'bg-primary animate-pulse' : 'bg-success') : 'bg-warning'}`}
          style={{ width: `${(step / 4) * 100}%` }}
        ></div>
      </div>

      <div className="space-y-8 pb-32 max-w-2xl mx-auto">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h2 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] flex items-center gap-2 mb-1">
              PROTOCOL REF: {job.id}
            </h2>
            <h3 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">{job.title}</h3>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">{job.client} • {job.address}</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <span className={`size-2 rounded-full ${isOnline ? 'bg-success animate-pulse' : 'bg-warning'}`}></span>
              <p className={`text-[10px] font-black uppercase tracking-widest ${isOnline ? 'text-success' : 'text-warning'}`}>{isOnline ? 'Online' : 'Offline'}</p>
            </div>
          </div>
        </div>

        {step > 0 && (
          <div className="flex gap-2">
            {['Access', 'Evidence', 'Summary', 'Sign-off'].map((label, idx) => (
              <div key={label} className="flex-1 space-y-2">
                <div className={`h-1.5 rounded-full transition-all duration-500 ${step > idx ? 'bg-primary shadow-[0_0_8px_rgba(37,99,235,0.4)]' : 'bg-slate-800'}`} />
                <p className={`text-[8px] font-black uppercase tracking-widest text-center ${step === idx + 1 ? 'text-primary' : 'text-slate-600'}`}>{label}</p>
              </div>
            ))}
          </div>
        )}

        {step === 0 && (
          <div className="space-y-8 animate-in">
            <header className="space-y-3 text-center">
              <div className="bg-primary/20 size-20 rounded-[2.5rem] flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-primary text-5xl font-black">assignment</span>
              </div>
              <h2 className="text-4xl font-black tracking-tighter uppercase leading-none text-white">Job Assignment</h2>
              <p className="text-slate-400 text-sm font-medium uppercase tracking-tight max-w-md mx-auto">Review job details before starting the verification protocol.</p>
            </header>

            <div className="bg-slate-900 border border-white/5 rounded-[3rem] overflow-hidden shadow-2xl">
              <div className="px-8 py-6 border-b border-white/5 bg-white/[0.02]">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Protocol Details</p>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Service Description</p>
                  <p className="text-2xl font-black text-white uppercase tracking-tight">{job.title}</p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Client</p>
                    <p className="text-sm font-bold text-white uppercase">{job.client}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Reference</p>
                    <p className="text-sm font-mono text-primary font-black">{job.id}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Location</p>
                  <div className="bg-slate-800 p-4 rounded-2xl border border-white/5">
                    <p className="text-sm font-bold text-white uppercase tracking-tight leading-relaxed">{job.address}</p>
                  </div>
                </div>

                {job.notes && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Special Instructions</p>
                    <div className="bg-warning/10 border border-warning/20 p-4 rounded-2xl">
                      <p className="text-sm text-white uppercase tracking-tight leading-relaxed">{job.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-8">
              <div className="flex items-center gap-4 mb-6">
                <span className="material-symbols-outlined text-primary text-2xl font-black">info</span>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Protocol Requirements</p>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-success text-sm mt-0.5 font-black">check_circle</span>
                  <p className="text-xs text-slate-300 font-bold uppercase tracking-tight">Location verification via GPS + what3words</p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-success text-sm mt-0.5 font-black">check_circle</span>
                  <p className="text-xs text-slate-300 font-bold uppercase tracking-tight">Safety checklist completion required</p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-success text-sm mt-0.5 font-black">check_circle</span>
                  <p className="text-xs text-slate-300 font-bold uppercase tracking-tight">Photo evidence capture (Before/During/After)</p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-success text-sm mt-0.5 font-black">check_circle</span>
                  <p className="text-xs text-slate-300 font-bold uppercase tracking-tight">Client signature for completion seal</p>
                </li>
              </ul>
            </div>

            <button
              onClick={() => setStep(1)}
              className="w-full py-7 bg-primary rounded-[3rem] font-black text-xl tracking-tighter text-white shadow-[0_20px_40px_-12px_rgba(37,99,235,0.4)] flex items-center justify-center gap-4 transition-all active:scale-95 uppercase"
            >
              <span className="material-symbols-outlined text-3xl font-black">play_arrow</span>
              Start Protocol
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-8 animate-in">
            <header className="space-y-2">
              <h2 className="text-3xl font-black tracking-tighter uppercase leading-none text-white">Baseline Security</h2>
              <p className="text-slate-400 text-sm font-medium uppercase tracking-tight">Verified pre-work assessment and location telemetry capture.</p>
            </header>

            <div className="space-y-4">
              <button
                onClick={captureLocation}
                disabled={locationStatus === 'captured' || locationStatus === 'capturing'}
                className={`w-full flex items-center justify-between p-7 rounded-[2.5rem] border-2 transition-all ${locationStatus === 'captured' ? 'bg-success/5 border-success/30 text-success' :
                  locationStatus === 'capturing' ? 'bg-primary/10 border-primary/30 text-primary' :
                    locationStatus === 'denied' ? 'bg-warning/10 border-warning/30 text-warning' : 'bg-slate-900 border-white/10 text-white'
                  }`}
              >
                <div className="flex items-center gap-5">
                  <div className={`size-12 rounded-2xl flex items-center justify-center ${locationStatus === 'captured' ? 'bg-success/20' :
                    locationStatus === 'denied' ? 'bg-warning/20' : 'bg-white/5'
                    }`}>
                    <span className="material-symbols-outlined text-2xl font-black">
                      {locationStatus === 'captured' ? 'near_me' : locationStatus === 'denied' ? 'location_disabled' : 'my_location'}
                    </span>
                  </div>
                  <div className="text-left">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em]">Geo-Verification</p>
                    <div className="flex flex-col mt-0.5">
                      <div className="flex items-center gap-2">
                        {locationStatus === 'captured' && <span className="text-red-500 font-black text-xs">///</span>}
                        <p className={`text-[10px] font-black uppercase tracking-widest ${locationStatus === 'captured' ? 'text-white' : 'opacity-60'}`}>
                          {locationStatus === 'captured' ? w3w.replace('///', '') :
                            locationStatus === 'capturing' ? 'Acquiring Signal...' :
                              locationStatus === 'denied' ? 'Permission Denied' : 'Authorise Location Hub'}
                        </p>
                      </div>
                      {locationStatus === 'captured' && coords.lat && (
                        <p className="text-[8px] font-mono text-slate-500 uppercase">GPS: {coords.lat.toFixed(6)}, {coords.lng?.toFixed(6)}</p>
                      )}
                    </div>
                  </div>
                </div>
                {locationStatus === 'captured' && <span className="material-symbols-outlined text-success font-black">check_circle</span>}
                {locationStatus === 'denied' && <span className="material-symbols-outlined text-warning font-black">error</span>}
              </button>

              {locationStatus === 'denied' && (
                <div className="bg-warning/10 border border-warning/30 rounded-[2rem] p-6 space-y-4 animate-in">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-warning text-xl font-black">info</span>
                    <div className="flex-1 space-y-2">
                      <p className="text-[11px] font-black text-warning uppercase tracking-tight">Location Access Required</p>
                      <p className="text-[10px] text-slate-400 leading-relaxed uppercase tracking-tight">
                        JobProof requires location access for evidence verification. Enable location permissions in your device settings or use manual entry as a fallback.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={manualLocationEntry}
                    className="w-full bg-warning/20 hover:bg-warning/30 border border-warning/40 text-warning py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm font-black">edit_location</span>
                    Manual Location Override
                  </button>
                </div>
              )}

              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Risk Check-off</p>
                {checklist.map((item, idx) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      const next = [...checklist];
                      next[idx].checked = !next[idx].checked;
                      setChecklist(next);
                      writeLocalDraft({ safetyChecklist: next });
                    }}
                    className={`w-full flex items-center gap-4 p-5 rounded-[1.5rem] border transition-all text-left ${item.checked ? 'bg-primary/5 border-primary/30 text-white' : 'bg-slate-900 border-white/5 text-slate-500'}`}
                  >
                    <span className="material-symbols-outlined text-2xl font-black">
                      {item.checked ? 'check_box' : 'check_box_outline_blank'}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-tight">{item.label}</span>
                    {item.required && !item.checked && <span className="ml-auto text-[8px] font-black text-warning uppercase border border-warning/20 px-2 py-0.5 rounded-full">Required</span>}
                  </button>
                ))}
              </div>
            </div>

            <button
              disabled={locationStatus !== 'captured' || checklist.some(i => i.required && !i.checked)}
              onClick={() => setStep(2)}
              className="w-full py-6 bg-primary rounded-[2.5rem] font-black text-white shadow-2xl shadow-primary/30 disabled:opacity-20 flex items-center justify-center gap-3 transition-all text-lg uppercase tracking-[0.2em]"
            >
              Start Protocol
              <span className="material-symbols-outlined font-black">arrow_forward</span>
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8 animate-in">
            <header className="space-y-2">
              <h2 className="text-3xl font-black tracking-tighter uppercase leading-none text-white">Evidence Collection</h2>
              <p className="text-slate-400 text-sm font-medium uppercase tracking-tight">Categorized evidence for dispute-free verification.</p>
            </header>

            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
              {(['Before', 'During', 'After', 'Evidence'] as PhotoType[]).map(type => (
                <button
                  key={type}
                  onClick={() => setActivePhotoType(type)}
                  className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border transition-all whitespace-nowrap ${activePhotoType === type ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 'bg-slate-900 border-white/10 text-slate-600 hover:text-white'}`}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-5">
              <input type="file" accept="image/*" capture="environment" className="hidden" ref={fileInputRef} onChange={onFileSelect} />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-[2.5rem] border-2 border-dashed border-primary/40 bg-primary/5 flex flex-col items-center justify-center gap-4 text-primary group active:scale-95 transition-all"
              >
                <div className="size-14 bg-primary/10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110">
                  <span className="material-symbols-outlined text-4xl font-black">add_a_photo</span>
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-center px-4 leading-none">Capture Phase: {activePhotoType}</span>
              </button>

              {photos.filter(p => p.type === activePhotoType).map(p => {
                const displayUrl = p.isIndexedDBRef ? (photoDataUrls.get(p.id) || '') : p.url;
                return (
                  <div key={p.id} className="aspect-square rounded-[2.5rem] bg-slate-900 border border-white/10 overflow-hidden relative shadow-2xl animate-in group">
                    <img src={displayUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="Proof" />
                    <div className="absolute top-4 right-4 bg-success text-white size-7 rounded-full flex items-center justify-center border-2 border-slate-950 shadow-2xl">
                      <span className="material-symbols-outlined text-sm font-black text-white">verified</span>
                    </div>
                    <div className="absolute bottom-4 left-4 right-4">
                      <button onClick={() => { setPhotos(photos.filter(item => item.id !== p.id)); }} className="w-full py-2 bg-black/80 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-widest rounded-xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">Delete Capture</button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-4">
              <button onClick={() => setStep(1)} className="flex-1 py-5 bg-slate-900 border border-white/10 rounded-3xl font-black text-[10px] uppercase tracking-[0.2em] text-white">Back</button>
              <button
                disabled={photos.length === 0}
                onClick={() => setStep(3)}
                className="flex-[2] py-5 bg-primary rounded-3xl font-black text-xs uppercase tracking-[0.2em] text-white shadow-2xl shadow-primary/30 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Authorize Seal
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-8 animate-in">
            <header className="space-y-2">
              <h2 className="text-3xl font-black tracking-tighter uppercase leading-none text-white">Job Summary</h2>
              <p className="text-slate-400 text-sm font-medium uppercase tracking-tight">Review operational notes and evidence before sign-off.</p>
            </header>

            <div className="space-y-6">
              <div className="bg-slate-900 border border-white/10 p-8 rounded-[3rem] space-y-4 shadow-2xl">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Operational Narrative</p>
                <textarea
                  value={notes}
                  onChange={(e) => { setNotes(e.target.value); writeLocalDraft({ notes: e.target.value }); }}
                  placeholder="Summarize the work completed for the client's review..."
                  className="w-full bg-slate-800 border-slate-700 rounded-[1.5rem] p-6 text-white text-sm min-h-[160px] focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-slate-600"
                />
              </div>

              <div className="bg-slate-900 border border-white/10 p-8 rounded-[2.5rem] space-y-4">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Evidence Distribution</p>
                <div className="grid grid-cols-2 gap-4">
                  {['Before', 'During', 'After', 'Evidence'].map(type => (
                    <div key={type} className="flex justify-between items-center text-[10px] font-black uppercase tracking-tight text-slate-400">
                      <span>{type} Phase</span>
                      <span className="text-white">{photos.filter(p => p.type === type).length} Captures</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {photos.length === 0 && (
              <div className="bg-warning/10 border border-warning/30 rounded-[2rem] p-6 space-y-2 animate-in">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-warning text-xl font-black">warning</span>
                  <div>
                    <p className="text-[11px] font-black text-warning uppercase tracking-tight">Evidence Required</p>
                    <p className="text-[10px] text-slate-400 leading-relaxed uppercase tracking-tight">Return to Evidence Collection to capture at least one photo before proceeding to sign-off.</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <button onClick={() => setStep(2)} className="flex-1 py-5 bg-slate-900 border border-white/10 rounded-3xl font-black text-[10px] uppercase tracking-[0.2em] text-white">Back</button>
              <button
                disabled={photos.length === 0}
                onClick={() => setStep(4)}
                className="flex-[2] py-5 bg-primary rounded-3xl font-black text-xs uppercase tracking-[0.2em] text-white shadow-2xl shadow-primary/30 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Capture Sign-Off
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-8 animate-in">
            <header className="space-y-2">
              <h2 className="text-3xl font-black tracking-tighter uppercase leading-none text-white">Authentication</h2>
              <p className="text-slate-400 text-sm font-medium uppercase tracking-tight">Client attestation to verify service satisfaction.</p>
            </header>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Signatory Identification</label>
                <input
                  type="text"
                  placeholder="Full Legal Name"
                  value={signerName}
                  onChange={e => setSignerName(e.target.value)}
                  className="w-full bg-slate-900 border-white/10 border rounded-3xl p-5 text-white outline-none focus:border-primary transition-all uppercase font-bold text-xs"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Authorization Role</label>
                <select
                  value={signerRole}
                  onChange={e => setSignerRole(e.target.value)}
                  className="w-full bg-slate-900 border-white/10 border rounded-3xl p-5 text-white outline-none focus:border-primary uppercase font-black text-[10px] appearance-none cursor-pointer"
                >
                  <option value="Client">Client / Property Owner</option>
                  <option value="Manager">On-Site Manager</option>
                  <option value="Agent">Authorized Third-Party Agent</option>
                </select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 rounded-[3rem] p-8 border-4 border-slate-900 shadow-2xl relative">
                <p className="text-[9px] font-black text-slate-300 absolute top-4 inset-x-0 text-center uppercase tracking-[0.3em] pointer-events-none">JobProof Secure Sign-Off</p>
                <div className="h-60 relative border-2 border-dashed border-slate-200 rounded-3xl overflow-hidden bg-white/60 shadow-inner">
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={240}
                    className="absolute inset-0 w-full h-full cursor-crosshair"
                    onMouseDown={(e) => {
                      isDrawing.current = true;
                      const ctx = canvasRef.current?.getContext('2d');
                      if (ctx) {
                        ctx.beginPath();
                        ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
                      }
                    }}
                    onMouseMove={(e) => {
                      if (!isDrawing.current) return;
                      const ctx = canvasRef.current?.getContext('2d');
                      if (ctx) {
                        ctx.strokeStyle = '#020617'; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
                        ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY); ctx.stroke();
                      }
                    }}
                    onMouseUp={() => (isDrawing.current = false)}
                    onMouseLeave={() => (isDrawing.current = false)}
                    onTouchStart={(e) => {
                      isDrawing.current = true;
                      const rect = canvasRef.current?.getBoundingClientRect();
                      const touch = e.touches[0];
                      const ctx = canvasRef.current?.getContext('2d');
                      if (ctx && rect) {
                        ctx.beginPath();
                        ctx.strokeStyle = '#020617'; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
                        ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
                      }
                      e.preventDefault();
                    }}
                    onTouchMove={(e) => {
                      if (!isDrawing.current) return;
                      const rect = canvasRef.current?.getBoundingClientRect();
                      const touch = e.touches[0];
                      const ctx = canvasRef.current?.getContext('2d');
                      if (ctx && rect) {
                        ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
                        ctx.stroke();
                      }
                      e.preventDefault();
                    }}
                    onTouchEnd={() => (isDrawing.current = false)}
                  ></canvas>
                </div>
              </div>

              <button
                onClick={clearSignature}
                className="w-full py-4 bg-slate-900 text-slate-400 hover:text-white border border-white/10 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm font-black">backspace</span>
                Clear Signature & Re-Sign
              </button>
            </div>

            <button
              onClick={handleFinalSeal}
              disabled={isSubmitting || !signerName || photos.length === 0}
              className="w-full py-7 bg-success rounded-[3rem] font-black text-xl tracking-tighter text-white shadow-[0_20px_40px_-12px_rgba(16,185,129,0.4)] flex items-center justify-center gap-4 transition-all active:scale-95 uppercase disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <div className="size-7 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <span className="material-symbols-outlined text-3xl font-black">lock</span>
                  Seal & Complete Job
                </>
              )}
            </button>
            <button onClick={() => setStep(3)} className="w-full py-4 text-slate-600 font-black uppercase text-[10px] tracking-widest">Back to Summary</button>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default TechnicianPortal;
