/**
 * JobRunner.tsx - Bunker-Proof MVP "God Component"
 *
 * A completely self-contained, offline-first job evidence capture component.
 * Designed to work in cement bunkers with zero cell service.
 *
 * Features:
 * - Load job via URL param (?jobId=123) or manual entry
 * - IndexedDB caching via Dexie (survives refresh/restart)
 * - 4-step wizard: Before Photo → After Photo → Signature → Review
 * - Photo compression (<1MB before storage)
 * - Auto-sync when online (navigator.onLine detection)
 * - Status indicator: Red = Offline/Unsynced, Green = Synced
 *
 * @author Claude Code - Bunker-Proof MVP
 * @date 2026-01-27
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Dexie, { type Table } from 'dexie';
import { compressImage } from '../../lib/imageCompression';

// ============================================================================
// TYPES - Self-contained, no external dependencies
// ============================================================================

type BunkerSyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';
type WizardStep = 'load' | 'before' | 'after' | 'signature' | 'review';

interface BunkerPhoto {
  id: string;
  type: 'before' | 'after';
  dataUrl: string; // Compressed base64
  timestamp: string;
  lat?: number;
  lng?: number;
  sizeBytes: number;
}

interface BunkerSignature {
  dataUrl: string;
  timestamp: string;
  signerName: string;
}

interface BunkerJob {
  id: string;
  title: string;
  client: string;
  address: string;
  notes: string;

  // Manager info for report delivery
  managerEmail?: string;
  managerName?: string;
  technicianName?: string;

  // Evidence
  beforePhoto?: BunkerPhoto;
  afterPhoto?: BunkerPhoto;
  signature?: BunkerSignature;

  // State
  currentStep: WizardStep;
  syncStatus: BunkerSyncStatus;
  lastUpdated: number;
  completedAt?: string;

  // Report
  reportUrl?: string;
  reportGeneratedAt?: string;
}

interface BunkerState {
  job: BunkerJob | null;
  isOnline: boolean;
  isSyncing: boolean;
  loadError: string | null;
  gpsLocation: { lat: number; lng: number } | null;
}

// ============================================================================
// DEXIE DATABASE - Isolated IndexedDB for bunker mode
// ============================================================================

class BunkerDatabase extends Dexie {
  jobs!: Table<BunkerJob, string>;

  constructor() {
    super('BunkerProofDB');
    this.version(1).stores({
      jobs: 'id, syncStatus, lastUpdated'
    });
  }
}

const bunkerDb = new BunkerDatabase();

// ============================================================================
// SYNC ENGINE - Auto-sync when online
// ============================================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ============================================================================
// NETWORK PING TEST - Don't trust navigator.onLine alone
// ============================================================================

const RETRY_DELAYS = [1000, 2000, 4000, 8000, 15000, 30000]; // Exponential backoff
const MAX_RETRIES = 6;

/**
 * Ping Supabase to verify REAL network connectivity
 * navigator.onLine can lie (cached WiFi, captive portals, etc.)
 */
async function checkConnection(): Promise<boolean> {
  if (!SUPABASE_URL) return false;

  try {
    // Ping Supabase health endpoint with short timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        'apikey': SUPABASE_ANON_KEY || '',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return response.ok || response.status === 400; // 400 = auth required but reachable
  } catch (error) {
    return false;
  }
}

/**
 * Relentless Sync - Retry with exponential backoff
 * Won't give up until data is safe in the cloud
 */
async function relentlessSync(
  job: BunkerJob,
  onStatusChange: (status: BunkerSyncStatus, message?: string) => void,
  retryCount = 0
): Promise<boolean> {
  // First, verify we have REAL network
  const isConnected = await checkConnection();

  if (!isConnected) {
    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)];
      onStatusChange('pending', `Waiting for connection... (${retryCount + 1}/${MAX_RETRIES})`);

      await new Promise(resolve => setTimeout(resolve, delay));
      return relentlessSync(job, onStatusChange, retryCount + 1);
    } else {
      onStatusChange('failed', 'No connection - will sync when online');
      return false;
    }
  }

  // We have connection - attempt sync
  onStatusChange('syncing', 'Uploading...');

  const success = await syncJobToCloud(job);

  if (success) {
    onStatusChange('synced', 'Data safe in cloud!');
    return true;
  } else {
    // Sync failed even with connection - retry
    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)];
      onStatusChange('pending', `Retrying sync... (${retryCount + 1}/${MAX_RETRIES})`);

      await new Promise(resolve => setTimeout(resolve, delay));
      return relentlessSync(job, onStatusChange, retryCount + 1);
    } else {
      onStatusChange('failed', 'Sync failed - tap to retry');
      return false;
    }
  }
}

async function syncJobToCloud(job: BunkerJob): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[BunkerSync] No Supabase credentials configured');
    return false;
  }

  try {
    // Update local status to syncing
    await bunkerDb.jobs.update(job.id, { syncStatus: 'syncing' });

    // Build payload for Supabase
    const payload = {
      id: job.id,
      title: job.title,
      client: job.client,
      address: job.address,
      notes: job.notes,
      manager_email: job.managerEmail,
      manager_name: job.managerName,
      technician_name: job.technicianName,
      status: job.completedAt ? 'Complete' : 'In Progress',
      before_photo_data: job.beforePhoto?.dataUrl,
      after_photo_data: job.afterPhoto?.dataUrl,
      signature_data: job.signature?.dataUrl,
      signer_name: job.signature?.signerName,
      completed_at: job.completedAt,
      last_updated: new Date(job.lastUpdated).toISOString()
    };

    // Sync to Supabase
    const response = await fetch(`${SUPABASE_URL}/rest/v1/bunker_jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      await bunkerDb.jobs.update(job.id, { syncStatus: 'synced' });

      // Trigger report generation if job is complete and manager email is set
      if (job.completedAt && job.managerEmail) {
        triggerReportGeneration(job);
      }

      return true;
    } else {
      throw new Error(`Sync failed: ${response.status}`);
    }
  } catch (error) {
    console.error('[BunkerSync] Sync error:', error);
    await bunkerDb.jobs.update(job.id, { syncStatus: 'failed' });
    return false;
  }
}

/**
 * Trigger cloud-based PDF report generation
 * This calls the generate-report Edge Function
 */
async function triggerReportGeneration(job: BunkerJob): Promise<void> {
  if (!SUPABASE_URL || !job.managerEmail) return;

  try {

    const reportPayload = {
      jobId: job.id,
      title: job.title,
      client: job.client,
      address: job.address,
      managerEmail: job.managerEmail,
      managerName: job.managerName,
      technicianName: job.technicianName,
      beforePhoto: job.beforePhoto ? {
        dataUrl: job.beforePhoto.dataUrl,
        timestamp: job.beforePhoto.timestamp,
        lat: job.beforePhoto.lat,
        lng: job.beforePhoto.lng,
      } : undefined,
      afterPhoto: job.afterPhoto ? {
        dataUrl: job.afterPhoto.dataUrl,
        timestamp: job.afterPhoto.timestamp,
        lat: job.afterPhoto.lat,
        lng: job.afterPhoto.lng,
      } : undefined,
      signature: job.signature ? {
        dataUrl: job.signature.dataUrl,
        timestamp: job.signature.timestamp,
        signerName: job.signature.signerName,
      } : undefined,
      completedAt: job.completedAt,
    };

    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(reportPayload),
    });

    if (response.ok) {
      const result = await response.json();

      // Update local job with report URL
      if (result.pdfUrl) {
        await bunkerDb.jobs.update(job.id, {
          reportUrl: result.pdfUrl,
          reportGeneratedAt: new Date().toISOString(),
        });
      }
    } else {
      console.error('[BunkerSync] Report generation failed:', await response.text());
    }
  } catch (error) {
    console.error('[BunkerSync] Report generation error:', error);
    // Don't fail the sync if report generation fails
  }
}

async function retryPendingSyncs(): Promise<void> {
  const pendingJobs = await bunkerDb.jobs
    .where('syncStatus')
    .anyOf(['pending', 'failed'])
    .toArray();

  for (const job of pendingJobs) {
    await syncJobToCloud(job);
  }
}

// ============================================================================
// SIGNATURE CANVAS COMPONENT
// ============================================================================

interface SignatureCanvasProps {
  onSave: (dataUrl: string) => void;
  onClear: () => void;
}

function SignatureCanvas({ onSave, onClear }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPosition = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current = getPosition(e);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing.current) return;
    e.preventDefault();

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pos = getPosition(e);

    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    lastPos.current = pos;
  };

  const stopDrawing = () => {
    isDrawing.current = false;
  };

  const handleClear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onClear();
  };

  const handleSave = () => {
    const canvas = canvasRef.current!;
    onSave(canvas.toDataURL('image/png'));
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={350}
          height={200}
          className="border-2 border-slate-600 rounded-lg bg-white touch-none w-full"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {/* Sign here affordance overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="material-symbols-outlined text-4xl">draw</span>
            <span className="text-xl font-medium tracking-wide">Sign here</span>
          </div>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          onClick={handleClear}
          className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
        >
          Clear
        </button>
        <button
          onClick={handleSave}
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
        >
          Save Signature
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// CAMERA COMPONENT
// ============================================================================

interface CameraProps {
  onCapture: (dataUrl: string) => void;
  onCancel: () => void;
}

function Camera({ onCapture, onCancel }: CameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError('Camera access denied. Please enable camera permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current!;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);
    onCapture(canvas.toDataURL('image/jpeg', 0.9));
    stopCamera();
  };

  if (error) {
    return (
      <div className="p-6 bg-red-900/50 rounded-xl text-center">
        <p className="text-red-300 mb-4">{error}</p>
        <button
          onClick={onCancel}
          className="px-6 py-3 bg-slate-700 text-white rounded-lg"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full rounded-xl bg-black"
      />
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={capturePhoto}
          className="flex-1 py-4 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold text-lg transition-colors btn-field"
        >
          📸 CAPTURE
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// SYNC STATUS INDICATOR
// ============================================================================

interface SyncStatusProps {
  isOnline: boolean;
  syncStatus: BunkerSyncStatus;
  isSyncing: boolean;
  message?: string | null;
}

function SyncStatus({ isOnline, syncStatus, isSyncing, message }: SyncStatusProps) {
  const getStatusColor = () => {
    if (!isOnline) return 'bg-red-500';
    if (isSyncing) return 'bg-yellow-500 animate-pulse';
    if (syncStatus === 'synced') return 'bg-green-500';
    if (syncStatus === 'failed') return 'bg-red-500';
    return 'bg-yellow-500';
  };

  const getStatusText = () => {
    if (message) return message;
    if (!isOnline) return 'OFFLINE';
    if (isSyncing) return 'SYNCING...';
    if (syncStatus === 'synced') return 'SYNCED ✓';
    if (syncStatus === 'failed') return 'SYNC FAILED';
    return 'PENDING SYNC';
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 bg-slate-900/90 backdrop-blur rounded-full border border-slate-700">
      <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
      <span className="text-xs font-medium text-slate-300">{getStatusText()}</span>
    </div>
  );
}

function Toast({ message, type }: { message: string; type: 'success' | 'error' | 'info' }) {
  const bgColor = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
  }[type];

  const icon = {
    success: '✓',
    error: '✗',
    info: 'ℹ',
  }[type];

  return (
    <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 ${bgColor} text-white rounded-xl shadow-lg animate-in`}>
      <span>{icon}</span>
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}

// ============================================================================
// MAIN JOB RUNNER COMPONENT
// ============================================================================

export default function JobRunner() {
  // State
  const [state, setState] = useState<BunkerState>({
    job: null,
    isOnline: navigator.onLine,
    isSyncing: false,
    loadError: null,
    gpsLocation: null
  });
  const [isJobFinished, setIsJobFinished] = useState(false); // LOOP-BREAKER: Hard exit for completed jobs

  const [showCamera, setShowCamera] = useState(false);
  const [cameraType, setCameraType] = useState<'before' | 'after'>('before');
  const [manualJobId, setManualJobId] = useState('');
  const [signerName, setSignerName] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [technicianName, setTechnicianName] = useState('');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Get job ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const urlJobId = urlParams.get('jobId');

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Auto-hide toast after 3 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Online/offline detection with REAL ping test
  useEffect(() => {
    const handleOnline = async () => {
      // Don't trust navigator.onLine alone - verify with ping
      const reallyOnline = await checkConnection();
      setState(s => ({ ...s, isOnline: reallyOnline }));

      if (reallyOnline) {
        setToastMessage({ text: 'Connection restored!', type: 'success' });
        retryPendingSyncs();
      }
    };

    const handleOffline = () => {
      setState(s => ({ ...s, isOnline: false }));
      setToastMessage({ text: 'You are offline', type: 'info' });
    };

    // Initial connection check
    checkConnection().then(connected => {
      setState(s => ({ ...s, isOnline: connected }));
    });

    // Periodic connection check every 30 seconds
    const intervalId = setInterval(async () => {
      const connected = await checkConnection();
      setState(s => {
        if (connected !== s.isOnline) {
          return { ...s, isOnline: connected };
        }
        return s;
      });
    }, 30000);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load job from IndexedDB on mount
  useEffect(() => {
    const loadFromIndexedDB = async () => {
      const jobId = urlJobId || localStorage.getItem('bunker_current_job');
      if (!jobId) return;

      const savedJob = await bunkerDb.jobs.get(jobId);
      if (savedJob) {
        // LOOP-BREAKER: If job is already complete and synced, show success screen
        if (savedJob.completedAt && savedJob.syncStatus === 'synced') {
          setState(s => ({ ...s, job: savedJob }));
          setIsJobFinished(true);
          return;
        }
        setState(s => ({ ...s, job: savedJob }));
      }
    };

    loadFromIndexedDB();
  }, [urlJobId]);

  // Get GPS location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setState(s => ({
            ...s,
            gpsLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude }
          }));
        },
        (err) => console.warn('[Bunker] GPS error:', err),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  // Auto-save to IndexedDB whenever job changes
  useEffect(() => {
    if (state.job) {
      bunkerDb.jobs.put(state.job);
      localStorage.setItem('bunker_current_job', state.job.id);
    }
  }, [state.job]);

  // Auto-sync when online and job is pending
  useEffect(() => {
    if (state.isOnline && state.job?.syncStatus === 'pending') {
      handleSync();
    }
  }, [state.isOnline, state.job?.syncStatus]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const updateJob = useCallback((updates: Partial<BunkerJob>) => {
    setState(s => {
      if (!s.job) return s;
      return {
        ...s,
        job: {
          ...s.job,
          ...updates,
          lastUpdated: Date.now(),
          syncStatus: 'pending' as BunkerSyncStatus
        }
      };
    });
  }, []);

  const loadJob = async (jobId: string) => {
    setState(s => ({ ...s, loadError: null }));

    // First, check IndexedDB for cached job
    const cachedJob = await bunkerDb.jobs.get(jobId);
    if (cachedJob) {
      setState(s => ({ ...s, job: cachedJob }));
      return;
    }

    // If online, try to fetch from API
    if (state.isOnline && SUPABASE_URL && SUPABASE_ANON_KEY) {
      try {
        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/jobs?id=eq.${jobId}&select=*`,
          {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
          }
        );

        if (response.ok) {
          const [jobData] = await response.json();
          if (jobData) {
            const newJob: BunkerJob = {
              id: jobData.id,
              title: jobData.title || 'Untitled Job',
              client: jobData.client || 'Unknown Client',
              address: jobData.address || '',
              notes: jobData.notes || '',
              currentStep: 'before',
              syncStatus: 'synced',
              lastUpdated: Date.now()
            };
            await bunkerDb.jobs.put(newJob);
            setState(s => ({ ...s, job: newJob }));
            return;
          }
        }
      } catch (error) {
        console.error('[Bunker] API fetch error:', error);
      }
    }

    // Create new job if not found
    const newJob: BunkerJob = {
      id: jobId,
      title: `Job ${jobId}`,
      client: 'Manual Entry',
      address: '',
      notes: '',
      managerEmail: managerEmail.trim() || undefined,
      technicianName: technicianName.trim() || undefined,
      currentStep: 'before',
      syncStatus: 'pending',
      lastUpdated: Date.now()
    };
    await bunkerDb.jobs.put(newJob);
    setState(s => ({ ...s, job: newJob }));
  };

  const handlePhotoCapture = async (dataUrl: string) => {
    const { dataUrl: compressed, sizeBytes } = await compressImage(dataUrl);

    const photo: BunkerPhoto = {
      id: `${cameraType}_${Date.now()}`,
      type: cameraType,
      dataUrl: compressed,
      timestamp: new Date().toISOString(),
      lat: state.gpsLocation?.lat,
      lng: state.gpsLocation?.lng,
      sizeBytes
    };

    if (cameraType === 'before') {
      updateJob({ beforePhoto: photo, currentStep: 'after' });
    } else {
      updateJob({ afterPhoto: photo, currentStep: 'signature' });
    }

    setShowCamera(false);
  };

  const handleSignatureSave = (dataUrl: string) => {
    if (!signerName.trim()) {
      alert('Please enter the signer name');
      return;
    }

    const signature: BunkerSignature = {
      dataUrl,
      timestamp: new Date().toISOString(),
      signerName: signerName.trim()
    };

    updateJob({
      signature,
      currentStep: 'review',
      completedAt: new Date().toISOString()
    });
  };

  const handleSync = async () => {
    if (!state.job || state.isSyncing) return;

    setState(s => ({ ...s, isSyncing: true }));
    setSyncMessage('Checking connection...');

    const onStatusChange = (status: BunkerSyncStatus, message?: string) => {
      setSyncMessage(message || null);
      setState(s => ({
        ...s,
        job: s.job ? { ...s.job, syncStatus: status } : null
      }));

      if (status === 'synced') {
        setToastMessage({ text: 'Data synced to cloud!', type: 'success' });
        // LOOP-BREAKER: Mark job as finished to trigger success screen
        if (state.job?.completedAt) {
          setIsJobFinished(true);
        }
      } else if (status === 'failed') {
        setToastMessage({ text: message || 'Sync failed', type: 'error' });
      }
    };

    // Use relentless sync with retries
    await relentlessSync(state.job, onStatusChange);

    setState(s => ({ ...s, isSyncing: false }));
    setSyncMessage(null);
  };

  const goToStep = (step: WizardStep) => {
    updateJob({ currentStep: step });
  };

  // Handler to finalize job and show success screen
  const handleFinishJob = async () => {
    if (!state.job) return;
    // Clear the job from active memory so it can't restart
    await bunkerDb.jobs.delete(state.job.id);
    localStorage.removeItem('bunker_current_job');
    setIsJobFinished(true);
  };

  // Handler to start a new job (clears everything)
  const startNewJob = async () => {
    if (state.job) {
      await bunkerDb.jobs.delete(state.job.id);
    }
    localStorage.removeItem('bunker_current_job');
    setState(s => ({ ...s, job: null }));
    setManualJobId('');
    setSignerName('');
    setIsJobFinished(false);
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderLoadStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white mb-2">🔒 Bunker Mode</h1>
        <p className="text-slate-400">Works offline. Your data is safe.</p>
      </div>

      <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Job ID *
          </label>
          <input
            type="text"
            value={manualJobId}
            onChange={(e) => setManualJobId(e.target.value)}
            placeholder="e.g., JOB-001"
            className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Your Name (Technician)
          </label>
          <input
            type="text"
            value={technicianName}
            onChange={(e) => setTechnicianName(e.target.value)}
            placeholder="e.g., John Smith"
            className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Manager Email (for report delivery)
          </label>
          <input
            type="email"
            value={managerEmail}
            onChange={(e) => setManagerEmail(e.target.value)}
            placeholder="e.g., manager@company.com"
            className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-slate-500 mt-1">
            PDF report will be emailed here after sync completes
          </p>
        </div>

        <button
          onClick={() => manualJobId.trim() && loadJob(manualJobId.trim())}
          disabled={!manualJobId.trim()}
          className="w-full mt-2 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-bold text-lg transition-colors btn-field"
        >
          START JOB
        </button>
      </div>

      {state.loadError && (
        <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300">
          {state.loadError}
        </div>
      )}
    </div>
  );

  const renderBeforeStep = () => (
    <div className="space-y-6">
      <StepHeader step={1} title="Before Photo" subtitle="Document the starting condition" />

      {showCamera && cameraType === 'before' ? (
        <Camera
          onCapture={handlePhotoCapture}
          onCancel={() => setShowCamera(false)}
        />
      ) : state.job?.beforePhoto ? (
        <div className="space-y-4">
          <img
            src={state.job.beforePhoto.dataUrl}
            alt="Before"
            className="w-full rounded-xl border border-slate-700"
          />
          <PhotoMeta photo={state.job.beforePhoto} />
          <div className="flex gap-3">
            <button
              onClick={() => { setCameraType('before'); setShowCamera(true); }}
              className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
            >
              Retake
            </button>
            <button
              onClick={() => goToStep('after')}
              className="flex-1 py-4 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold btn-field"
            >
              NEXT →
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => { setCameraType('before'); setShowCamera(true); }}
          className="w-full py-8 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xl transition-colors btn-field"
        >
          📸 TAKE BEFORE PHOTO
        </button>
      )}
    </div>
  );

  const renderAfterStep = () => (
    <div className="space-y-6">
      <StepHeader step={2} title="After Photo" subtitle="Document the completed work" />

      {showCamera && cameraType === 'after' ? (
        <Camera
          onCapture={handlePhotoCapture}
          onCancel={() => setShowCamera(false)}
        />
      ) : state.job?.afterPhoto ? (
        <div className="space-y-4">
          <img
            src={state.job.afterPhoto.dataUrl}
            alt="After"
            className="w-full rounded-xl border border-slate-700"
          />
          <PhotoMeta photo={state.job.afterPhoto} />
          <div className="flex gap-3">
            <button
              onClick={() => goToStep('before')}
              className="py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
            >
              ← Back
            </button>
            <button
              onClick={() => { setCameraType('after'); setShowCamera(true); }}
              className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
            >
              Retake
            </button>
            <button
              onClick={() => goToStep('signature')}
              className="flex-1 py-4 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold btn-field"
            >
              NEXT →
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <button
            onClick={() => { setCameraType('after'); setShowCamera(true); }}
            className="w-full py-8 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xl transition-colors btn-field"
          >
            📸 TAKE AFTER PHOTO
          </button>
          <button
            onClick={() => goToStep('before')}
            className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
          >
            ← Back to Before Photo
          </button>
        </div>
      )}
    </div>
  );

  const renderSignatureStep = () => (
    <div className="space-y-6">
      <StepHeader step={3} title="Client Signature" subtitle="Get client approval" />

      {state.job?.signature ? (
        <div className="space-y-4">
          <img
            src={state.job.signature.dataUrl}
            alt="Signature"
            className="w-full rounded-xl border border-slate-700 bg-white"
          />
          <p className="text-center text-slate-400">
            Signed by: <span className="text-white font-medium">{state.job.signature.signerName}</span>
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => goToStep('after')}
              className="py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
            >
              ← Back
            </button>
            <button
              onClick={() => updateJob({ signature: undefined })}
              className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
            >
              Re-sign
            </button>
            <button
              onClick={() => goToStep('review')}
              className="flex-1 py-4 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold btn-field"
            >
              NEXT →
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Signer Name *
            </label>
            <input
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Enter client name"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <SignatureCanvas
            onSave={handleSignatureSave}
            onClear={() => {}}
          />

          <button
            onClick={() => goToStep('after')}
            className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
          >
            ← Back to After Photo
          </button>
        </div>
      )}
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-6">
      <StepHeader step={4} title="Review & Submit" subtitle="Verify all evidence" />

      <div className="grid grid-cols-2 gap-4">
        {state.job?.beforePhoto && (
          <div>
            <p className="text-xs text-slate-400 mb-1">BEFORE</p>
            <img
              src={state.job.beforePhoto.dataUrl}
              alt="Before"
              className="w-full rounded-lg border border-slate-700"
            />
          </div>
        )}
        {state.job?.afterPhoto && (
          <div>
            <p className="text-xs text-slate-400 mb-1">AFTER</p>
            <img
              src={state.job.afterPhoto.dataUrl}
              alt="After"
              className="w-full rounded-lg border border-slate-700"
            />
          </div>
        )}
      </div>

      {state.job?.signature && (
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
          <p className="text-xs text-slate-400 mb-2">CLIENT SIGNATURE</p>
          <img
            src={state.job.signature.dataUrl}
            alt="Signature"
            className="w-full max-w-xs rounded-lg bg-white"
          />
          <p className="mt-2 text-sm text-slate-300">
            Signed by: {state.job.signature.signerName}
          </p>
        </div>
      )}

      <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
        <h3 className="text-sm font-medium text-slate-300 mb-2">Job Details</h3>
        <p className="text-white font-medium">{state.job?.title}</p>
        <p className="text-slate-400 text-sm">{state.job?.client}</p>
        {state.job?.address && (
          <p className="text-slate-400 text-sm">{state.job.address}</p>
        )}
      </div>

      {/* Sync Status */}
      <div className={`p-4 rounded-xl border ${
        state.job?.syncStatus === 'synced'
          ? 'bg-green-900/30 border-green-700'
          : state.job?.syncStatus === 'failed'
          ? 'bg-red-900/30 border-red-700'
          : 'bg-yellow-900/30 border-yellow-700'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-4 h-4 rounded-full ${
            state.job?.syncStatus === 'synced' ? 'bg-green-500' :
            state.job?.syncStatus === 'failed' ? 'bg-red-500' :
            'bg-yellow-500 animate-pulse'
          }`} />
          <span className="font-medium text-white">
            {state.job?.syncStatus === 'synced' ? 'Data Safely Synced to Cloud' :
             state.job?.syncStatus === 'failed' ? 'Sync Failed - Will Retry' :
             'Pending Cloud Sync'}
          </span>
        </div>
        {state.job?.syncStatus !== 'synced' && (
          <p className="mt-2 text-sm text-slate-400">
            Your data is safely stored locally and will sync when online.
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => goToStep('signature')}
          className="py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
        >
          ← Back
        </button>
        {state.job?.syncStatus !== 'synced' && state.isOnline && (
          <button
            onClick={handleSync}
            disabled={state.isSyncing}
            className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-lg font-bold btn-field"
          >
            {state.isSyncing ? 'SYNCING...' : 'SYNC NOW'}
          </button>
        )}
        {state.job?.syncStatus === 'synced' && (
          <button
            onClick={handleFinishJob}
            className="flex-1 py-4 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold btn-field"
          >
            ✓ COMPLETE
          </button>
        )}
      </div>
    </div>
  );

  // ============================================================================
  // RENDER: SUCCESS SCREEN (LOOP-BREAKER)
  // ============================================================================

  if (isJobFinished && state.job) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        {/* Navigation Header */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur border-b border-slate-700">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-slate-400">Job Complete</span>
            <a
              href="/#/job-log"
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium"
            >
              View Job Log
            </a>
          </div>
        </div>

        <div className="max-w-lg mx-auto p-4 pt-20 pb-24">
          {/* Success Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-600/20 rounded-full mb-4">
              <span className="text-5xl">✅</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Mission Accomplished!</h1>
            <p className="text-slate-400">Your job evidence has been synced to the cloud.</p>
          </div>

          {/* Job Summary */}
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 mb-6">
            <p className="text-xs text-slate-400">JOB</p>
            <p className="text-lg font-bold text-white">{state.job.title}</p>
            <p className="text-sm text-slate-400">{state.job.client}</p>
            {state.job.address && <p className="text-sm text-slate-500">{state.job.address}</p>}
            {state.job.completedAt && (
              <p className="text-xs text-green-400 mt-2">
                Completed: {new Date(state.job.completedAt).toLocaleString()}
              </p>
            )}
          </div>

          {/* Photos Preview */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {state.job.beforePhoto && (
              <div>
                <p className="text-xs text-slate-400 mb-1">BEFORE</p>
                <img src={state.job.beforePhoto.dataUrl} alt="Before" className="w-full rounded-lg border border-slate-700" />
              </div>
            )}
            {state.job.afterPhoto && (
              <div>
                <p className="text-xs text-slate-400 mb-1">AFTER</p>
                <img src={state.job.afterPhoto.dataUrl} alt="After" className="w-full rounded-lg border border-slate-700" />
              </div>
            )}
          </div>

          {/* Report Link */}
          {state.job.reportUrl && (
            <a
              href={state.job.reportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-center mb-4"
            >
              📄 View Final Report
            </a>
          )}

          {state.job.managerEmail && (
            <div className="bg-green-900/30 border border-green-700 p-4 rounded-xl mb-6">
              <p className="text-sm text-green-400">
                ✓ Report sent to <span className="font-medium text-white">{state.job.managerEmail}</span>
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <a
              href="/#/job-log"
              className="flex-1 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold text-center"
            >
              View Job Log
            </a>
            <button
              onClick={startNewJob}
              className="flex-1 py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold"
            >
              + New Job
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Navigation Header with Job Log Link */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-slate-900/90 backdrop-blur border-b border-slate-700">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-slate-400">Bunker Mode</span>
          <a
            href="/#/job-log"
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium"
          >
            My Jobs
          </a>
        </div>
      </div>

      <SyncStatus
        isOnline={state.isOnline}
        syncStatus={state.job?.syncStatus || 'pending'}
        isSyncing={state.isSyncing}
        message={syncMessage}
      />

      {/* Toast Notification */}
      {toastMessage && <Toast message={toastMessage.text} type={toastMessage.type} />}

      <div className="max-w-lg mx-auto p-4 pt-16 pb-24">
        {/* Progress Bar */}
        {state.job && (
          <ProgressBar currentStep={state.job.currentStep} />
        )}

        {/* Content */}
        <div className="mt-6">
          {!state.job && renderLoadStep()}
          {state.job?.currentStep === 'before' && renderBeforeStep()}
          {state.job?.currentStep === 'after' && renderAfterStep()}
          {state.job?.currentStep === 'signature' && renderSignatureStep()}
          {state.job?.currentStep === 'review' && renderReviewStep()}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function StepHeader({ step, title, subtitle }: { step: number; title: string; subtitle: string }) {
  return (
    <div className="text-center">
      <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600/20 rounded-full text-blue-400 text-sm font-medium mb-2">
        Step {step} of 4
      </div>
      <h2 className="text-xl font-bold text-white">{title}</h2>
      <p className="text-slate-400 text-sm">{subtitle}</p>
    </div>
  );
}

function ProgressBar({ currentStep }: { currentStep: WizardStep }) {
  const steps: WizardStep[] = ['before', 'after', 'signature', 'review'];
  const currentIndex = steps.indexOf(currentStep);

  return (
    <div className="flex items-center gap-2">
      {steps.map((step, index) => (
        <React.Fragment key={step}>
          <div
            className={`flex-1 h-2 rounded-full transition-colors ${
              index <= currentIndex ? 'bg-blue-500' : 'bg-slate-700'
            }`}
          />
        </React.Fragment>
      ))}
    </div>
  );
}

function PhotoMeta({ photo }: { photo: BunkerPhoto }) {
  return (
    <div className="flex flex-wrap gap-2 text-xs text-slate-400">
      <span className="px-2 py-1 bg-slate-800 rounded">
        {new Date(photo.timestamp).toLocaleString()}
      </span>
      {photo.lat && photo.lng && (
        <span className="px-2 py-1 bg-slate-800 rounded">
          📍 {photo.lat.toFixed(4)}, {photo.lng.toFixed(4)}
        </span>
      )}
      <span className="px-2 py-1 bg-slate-800 rounded">
        {(photo.sizeBytes / 1024).toFixed(0)} KB
      </span>
    </div>
  );
}
