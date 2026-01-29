/**
 * BunkerRun.tsx - Public "Run" Page for Technicians
 *
 * Bulletproof job execution page - NO AUTH REQUIRED.
 * The Job ID in the URL is the permission to work.
 *
 * Flow:
 * 1. Load job from URL param (/run/JOB-123)
 * 2. Fetch job data from Supabase (if online)
 * 3. Immediately cache to IndexedDB for offline resilience
 * 4. Run 4-step wizard: Before Photo → After Photo → Signature → Sync
 * 5. Auto-sync when online, trigger report generation
 *
 * Self-Healing Features:
 * - If job not in DB, create from URL params
 * - If offline, load from IndexedDB
 * - If invalid ID, show "Create New Job" option
 *
 * @author Claude Code - End-to-End Recovery
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { parseHashParams } from '../lib/redirects';

// ============================================================================
// LOCALSTORAGE KEYS FOR EMAIL HANDSHAKE
// ============================================================================
const STORAGE_KEYS = {
  MANAGER_EMAIL: 'bunker_manager_email',
  CLIENT_EMAIL: 'bunker_client_email',
  JOB_ID: 'bunker_current_job_id',
  JOB_TITLE: 'bunker_job_title',
} as const;
import Dexie, { type Table } from 'dexie';

// ============================================================================
// TYPES
// ============================================================================

type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';
type WizardStep = 'loading' | 'before' | 'after' | 'signature' | 'review';

interface Photo {
  id: string;
  type: 'before' | 'after';
  dataUrl: string;
  timestamp: string;
  lat?: number;
  lng?: number;
  w3w?: string;
  sizeBytes: number;
}

interface Signature {
  dataUrl: string;
  timestamp: string;
  signerName: string;
}

interface RunJob {
  id: string;
  title: string;
  client: string;
  clientEmail?: string;
  managerEmail?: string;
  technicianName?: string;
  address: string;
  w3w?: string;
  notes: string;
  beforePhoto?: Photo;
  afterPhoto?: Photo;
  signature?: Signature;
  currentStep: WizardStep;
  syncStatus: SyncStatus;
  lastUpdated: number;
  completedAt?: string;
  reportUrl?: string;
}

// ============================================================================
// DEXIE DATABASE
// ============================================================================

class RunDatabase extends Dexie {
  jobs!: Table<RunJob, string>;

  constructor() {
    super('BunkerRunDB');
    this.version(1).stores({
      jobs: 'id, syncStatus, lastUpdated'
    });
  }
}

const runDb = new RunDatabase();

// ============================================================================
// SUPABASE CONFIG
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
    console.log('[BunkerRun] Ping failed:', error);
    return false;
  }
}

/**
 * Relentless Sync - Retry with exponential backoff
 * Won't give up until data is safe in the cloud
 */
async function relentlessSync(
  job: RunJob,
  onStatusChange: (status: SyncStatus, message?: string) => void,
  retryCount = 0
): Promise<boolean> {
  // First, verify we have REAL network
  const isConnected = await checkConnection();

  if (!isConnected) {
    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)];
      console.log(`[BunkerRun] No connection, retry ${retryCount + 1}/${MAX_RETRIES} in ${delay}ms`);
      onStatusChange('pending', `Waiting for connection... (${retryCount + 1}/${MAX_RETRIES})`);

      await new Promise(resolve => setTimeout(resolve, delay));
      return relentlessSync(job, onStatusChange, retryCount + 1);
    } else {
      console.log('[BunkerRun] Max retries reached, will sync later');
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
      console.log(`[BunkerRun] Sync failed, retry ${retryCount + 1}/${MAX_RETRIES} in ${delay}ms`);
      onStatusChange('pending', `Retrying sync... (${retryCount + 1}/${MAX_RETRIES})`);

      await new Promise(resolve => setTimeout(resolve, delay));
      return relentlessSync(job, onStatusChange, retryCount + 1);
    } else {
      onStatusChange('failed', 'Sync failed - tap to retry');
      return false;
    }
  }
}

// ============================================================================
// IMAGE COMPRESSION
// ============================================================================

async function compressImage(dataUrl: string, maxSizeKB: number = 800): Promise<{ dataUrl: string; sizeBytes: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      let { width, height } = img;
      const maxDim = 1200;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = (height / width) * maxDim;
          width = maxDim;
        } else {
          width = (width / height) * maxDim;
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.8;
      let compressed = canvas.toDataURL('image/jpeg', quality);

      while (compressed.length > maxSizeKB * 1024 * 1.37 && quality > 0.1) {
        quality -= 0.1;
        compressed = canvas.toDataURL('image/jpeg', quality);
      }

      resolve({
        dataUrl: compressed,
        sizeBytes: Math.round(compressed.length * 0.75)
      });
    };
    img.src = dataUrl;
  });
}

// ============================================================================
// SYNC ENGINE
// ============================================================================

async function syncJobToCloud(job: RunJob): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[BunkerRun] No Supabase credentials');
    return false;
  }

  try {
    await runDb.jobs.update(job.id, { syncStatus: 'syncing' });

    const payload = {
      id: job.id,
      title: job.title,
      client: job.client,
      client_email: job.clientEmail,
      manager_email: job.managerEmail,
      technician_name: job.technicianName,
      address: job.address,
      w3w: job.w3w,
      notes: job.notes,
      status: job.completedAt ? 'Complete' : 'In Progress',
      before_photo_data: job.beforePhoto?.dataUrl,
      after_photo_data: job.afterPhoto?.dataUrl,
      signature_data: job.signature?.dataUrl,
      signer_name: job.signature?.signerName,
      completed_at: job.completedAt,
      last_updated: new Date(job.lastUpdated).toISOString()
    };

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
      await runDb.jobs.update(job.id, { syncStatus: 'synced' });
      console.log('[BunkerRun] Synced:', job.id);

      // Trigger report generation if complete
      if (job.completedAt && job.managerEmail) {
        triggerReportGeneration(job);
      }

      return true;
    } else {
      throw new Error(`Sync failed: ${response.status}`);
    }
  } catch (error) {
    console.error('[BunkerRun] Sync error:', error);
    await runDb.jobs.update(job.id, { syncStatus: 'failed' });
    return false;
  }
}

/**
 * Store job details in localStorage for the success page
 * This enables the Public-Private handshake - sync knows where to send report
 */
function storeJobDetailsForSync(job: RunJob): void {
  try {
    localStorage.setItem(STORAGE_KEYS.JOB_ID, job.id);
    localStorage.setItem(STORAGE_KEYS.JOB_TITLE, job.title);
    if (job.managerEmail) {
      localStorage.setItem(STORAGE_KEYS.MANAGER_EMAIL, job.managerEmail);
    }
    if (job.clientEmail) {
      localStorage.setItem(STORAGE_KEYS.CLIENT_EMAIL, job.clientEmail);
    }
    console.log('[BunkerRun] Stored job details for sync:', {
      id: job.id,
      managerEmail: job.managerEmail,
      clientEmail: job.clientEmail,
    });
  } catch (error) {
    console.warn('[BunkerRun] Failed to store job details:', error);
  }
}

async function triggerReportGeneration(job: RunJob): Promise<void> {
  if (!SUPABASE_URL || !job.managerEmail) return;

  try {
    const reportPayload = {
      jobId: job.id,
      title: job.title,
      client: job.client,
      address: job.address,
      managerEmail: job.managerEmail,
      clientEmail: job.clientEmail,
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
      if (result.pdfUrl) {
        await runDb.jobs.update(job.id, { reportUrl: result.pdfUrl });
      }
    }
  } catch (error) {
    console.error('[BunkerRun] Report error:', error);
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function BunkerRun() {
  const { id: jobId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { resolvedTheme, isDaylightMode, setDaylightMode } = useTheme();

  // Determine if we're in daylight/construction mode
  const isDaylight = resolvedTheme === 'daylight' || isDaylightMode;

  // Theme-aware CSS classes
  const themeClasses = isDaylight
    ? 'bg-slate-100 text-slate-900' // Daylight: Anti-glare gray background
    : 'bg-slate-950 text-white';    // Dark: Standard dark mode

  const cardClasses = isDaylight
    ? 'bg-white border-slate-300 shadow-md'
    : 'bg-slate-800/50 border-slate-700';

  const buttonPrimaryClasses = isDaylight
    ? 'bg-orange-500 hover:bg-orange-400 text-slate-900 border-2 border-slate-900 shadow-[4px_4px_0px_#1e293b] font-bold'
    : 'bg-blue-600 hover:bg-blue-500 text-white';

  const buttonSecondaryClasses = isDaylight
    ? 'bg-white hover:bg-slate-100 text-slate-900 border-2 border-slate-900'
    : 'bg-slate-700 hover:bg-slate-600 text-white';

  // Extract email from URL params (PhD Fix: store immediately for sync handshake)
  useEffect(() => {
    const email = searchParams.get('email');
    if (email) {
      localStorage.setItem(STORAGE_KEYS.MANAGER_EMAIL, email);
      console.log('[BunkerRun] Stored manager email from URL:', email);
    }
  }, [searchParams]);

  // DEBUG: Log when BunkerRun component loads
  useEffect(() => {
    console.log('[BunkerRun] Component loaded for ID:', jobId);
    console.log('[BunkerRun] Current URL:', window.location.href);
    console.log('[BunkerRun] Theme:', resolvedTheme, 'isDaylight:', isDaylight);
    console.log('[BunkerRun] This page has NO auth requirements - Job ID is the permission');
  }, [jobId, resolvedTheme, isDaylight]);

  // ============================================================================
  // HASH PARAM HANDSHAKE - Extract emails from URL hash query params
  // ============================================================================
  // CRITICAL: With HashRouter, query params are INSIDE the hash (e.g., #/run/ID?me=email)
  // Standard window.location.search is EMPTY - must parse hash directly
  useEffect(() => {
    const hashParams = parseHashParams();
    const managerEmail = hashParams.get('me'); // me = manager email
    const clientEmail = hashParams.get('ce');  // ce = client email

    console.log('[BunkerRun] Hash param handshake:', {
      managerEmail,
      clientEmail,
      fullHash: window.location.hash,
    });

    // Store emails in localStorage for the success page and sync
    if (managerEmail) {
      localStorage.setItem(STORAGE_KEYS.MANAGER_EMAIL, managerEmail);
      console.log('[BunkerRun] Stored manager email from URL:', managerEmail);
    }
    if (clientEmail) {
      localStorage.setItem(STORAGE_KEYS.CLIENT_EMAIL, clientEmail);
      console.log('[BunkerRun] Stored client email from URL:', clientEmail);
    }
    if (jobId) {
      localStorage.setItem(STORAGE_KEYS.JOB_ID, jobId);
    }
  }, [jobId]); // Run once on mount when jobId is available

  const [job, setJob] = useState<RunJob | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isJobFinished, setIsJobFinished] = useState(false); // LOOP-BREAKER: Hard exit for completed jobs
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [showCamera, setShowCamera] = useState(false);
  const [cameraType, setCameraType] = useState<'before' | 'after'>('before');
  const [signerName, setSignerName] = useState('');
  const [techName, setTechName] = useState('');

  // Auto-hide toast after 3 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Online/offline detection with REAL ping test
  useEffect(() => {
    const handleOnline = async () => {
      // Don't trust navigator.onLine alone - verify with ping
      const reallyOnline = await checkConnection();
      setIsOnline(reallyOnline);

      if (reallyOnline) {
        setToastMessage({ text: 'Connection restored!', type: 'success' });
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setToastMessage({ text: 'You are offline', type: 'info' });
    };

    // Initial connection check
    checkConnection().then(setIsOnline);

    // Periodic connection check every 30 seconds
    const intervalId = setInterval(async () => {
      const connected = await checkConnection();
      if (connected !== isOnline) {
        setIsOnline(connected);
      }
    }, 30000);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Get GPS
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGpsLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.warn('[BunkerRun] GPS error:', err),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  // Load job on mount
  useEffect(() => {
    if (!jobId) {
      setLoadError('No Job ID provided');
      return;
    }

    loadJob(jobId);
  }, [jobId]);

  // Auto-save to IndexedDB
  useEffect(() => {
    if (job) {
      runDb.jobs.put(job);
    }
  }, [job]);

  // Auto-sync when online
  useEffect(() => {
    if (isOnline && job?.syncStatus === 'pending' && job.completedAt) {
      handleSync();
    }
  }, [isOnline, job?.syncStatus, job?.completedAt]);

  // ============================================================================
  // LOAD JOB
  // ============================================================================

  const loadJob = async (id: string) => {
    // 1. Check IndexedDB first (instant, works offline)
    const cached = await runDb.jobs.get(id);
    if (cached) {
      // LOOP-BREAKER: If job is already complete and synced, show success screen
      if (cached.completedAt && cached.syncStatus === 'synced') {
        console.log('[BunkerRun] Job already complete, showing success:', id);
        setJob(cached);
        setIsJobFinished(true);
        return;
      }
      setJob(cached);
      // Store emails in localStorage for sync handshake
      storeJobDetailsForSync(cached);
      console.log('[BunkerRun] Loaded from cache:', id);
      return;
    }

    // 2. Try Supabase (if online)
    if (isOnline && SUPABASE_URL && SUPABASE_ANON_KEY) {
      try {
        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/bunker_jobs?id=eq.${id}&select=*`,
          {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
          }
        );

        if (response.ok) {
          const [data] = await response.json();
          if (data) {
            // LOOP-BREAKER: Check if job is already complete in database
            const isComplete = data.status === 'Complete' || data.status === 'Submitted';
            const loadedJob: RunJob = {
              id: data.id,
              title: data.title || `Job ${id}`,
              client: data.client || 'Client',
              clientEmail: data.client_email,
              managerEmail: data.manager_email,
              address: data.address || '',
              w3w: data.w3w,
              notes: data.notes || '',
              currentStep: isComplete ? 'review' : 'before',
              syncStatus: 'synced',
              lastUpdated: Date.now(),
              completedAt: data.completed_at,
              reportUrl: data.report_url
            };
            await runDb.jobs.put(loadedJob);
            setJob(loadedJob);
            // Store emails in localStorage for sync handshake
            storeJobDetailsForSync(loadedJob);

            // If already complete, show success screen (LOOP-BREAKER)
            if (isComplete) {
              console.log('[BunkerRun] Job already complete in DB, showing success:', id);
              setIsJobFinished(true);
            } else {
              console.log('[BunkerRun] Loaded from Supabase:', id);
            }
            return;
          }
        }
      } catch (error) {
        console.error('[BunkerRun] Fetch error:', error);
      }
    }

    // 3. Create new job from URL (fallback)
    const newJob: RunJob = {
      id,
      title: `Job ${id}`,
      client: 'Client',
      address: '',
      notes: '',
      currentStep: 'before',
      syncStatus: 'pending',
      lastUpdated: Date.now()
    };
    await runDb.jobs.put(newJob);
    setJob(newJob);
    // Store in localStorage (even without emails, so success page knows job ID)
    storeJobDetailsForSync(newJob);
    console.log('[BunkerRun] Created new job:', id);
  };

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const updateJob = useCallback((updates: Partial<RunJob>) => {
    setJob(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        ...updates,
        lastUpdated: Date.now(),
        syncStatus: 'pending' as SyncStatus
      };
    });
  }, []);

  const handlePhotoCapture = async (dataUrl: string) => {
    const { dataUrl: compressed, sizeBytes } = await compressImage(dataUrl);

    const photo: Photo = {
      id: `${cameraType}_${Date.now()}`,
      type: cameraType,
      dataUrl: compressed,
      timestamp: new Date().toISOString(),
      lat: gpsLocation?.lat,
      lng: gpsLocation?.lng,
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

    const signature: Signature = {
      dataUrl,
      timestamp: new Date().toISOString(),
      signerName: signerName.trim()
    };

    updateJob({
      signature,
      technicianName: techName.trim() || undefined,
      currentStep: 'review',
      completedAt: new Date().toISOString()
    });
  };

  const handleSync = async () => {
    if (!job || isSyncing) return;

    setIsSyncing(true);
    setSyncMessage('Checking connection...');

    const onStatusChange = (status: SyncStatus, message?: string) => {
      setSyncMessage(message || null);
      setJob(prev => prev ? { ...prev, syncStatus: status } : prev);

      if (status === 'synced') {
        setToastMessage({ text: 'Data synced to cloud!', type: 'success' });
      } else if (status === 'failed') {
        setToastMessage({ text: message || 'Sync failed', type: 'error' });
      }
    };

    // Use relentless sync with retries
    const success = await relentlessSync(job, onStatusChange);

    setIsSyncing(false);
    setSyncMessage(null);

    // Navigate to success page after successful sync
    if (success) {
      // Store final job state before navigation
      storeJobDetailsForSync(job);
      // Give toast time to show, then navigate
      setTimeout(() => {
        navigate('/success');
      }, 1000);
    }
  };

  // Handler to finalize job and show success screen (LOOP-BREAKER)
  const handleFinishJob = async () => {
    if (!job) return;
    // Clear the job from active memory so it can't restart
    await runDb.jobs.delete(job.id);
    setIsJobFinished(true);
  };

  // Auto-sync when job is complete and we have connection
  useEffect(() => {
    if (job?.completedAt && job.syncStatus === 'pending' && !isSyncing) {
      // Check connection and sync automatically
      checkConnection().then(connected => {
        if (connected) {
          handleSync();
        }
      });
    }
  }, [job?.completedAt, job?.syncStatus]);

  const goToStep = (step: WizardStep) => {
    updateJob({ currentStep: step });
  };

  // ============================================================================
  // RENDER: LOADING STATE
  // ============================================================================

  if (!job) {
    if (loadError) {
      return (
        <div className={`min-h-screen ${themeClasses} flex items-center justify-center p-4`}>
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-600/20 rounded-full">
              <span className="text-3xl">⚠️</span>
            </div>
            <h1 className="text-2xl font-bold">{loadError}</h1>
            <p className={isDaylight ? 'text-slate-600' : 'text-slate-400'}>The job could not be found or loaded.</p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => window.location.reload()}
                className={`px-6 py-3 rounded-lg min-h-[56px] ${buttonSecondaryClasses}`}
              >
                Retry
              </button>
              <a
                href="/#/create-job"
                className={`px-6 py-3 rounded-lg min-h-[56px] ${buttonPrimaryClasses}`}
              >
                Create New Job
              </a>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`min-h-screen ${themeClasses} flex items-center justify-center`}>
        <div className="text-center space-y-4">
          <div className={`size-12 border-4 ${isDaylight ? 'border-orange-500/30 border-t-orange-500' : 'border-blue-500/30 border-t-blue-500'} rounded-full animate-spin mx-auto`}></div>
          <p className={isDaylight ? 'text-slate-600' : 'text-slate-400'}>Loading job...</p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER: SUCCESS SCREEN (LOOP-BREAKER)
  // ============================================================================

  if (isJobFinished && job) {
    return (
      <div className={`min-h-screen ${themeClasses}`}>
        {/* Navigation Header */}
        <div className={`fixed top-0 left-0 right-0 z-50 backdrop-blur border-b ${isDaylight ? 'bg-white/90 border-slate-300' : 'bg-slate-900/90 border-slate-700'}`}>
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
            <span className={`text-sm ${isDaylight ? 'text-slate-600' : 'text-slate-400'}`}>Job Complete</span>
            <a
              href="/#/job-log"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${buttonSecondaryClasses}`}
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
            <p className="text-lg font-bold text-white">{job.title}</p>
            <p className="text-sm text-slate-400">{job.client}</p>
            {job.address && <p className="text-sm text-slate-500">{job.address}</p>}
            {job.completedAt && (
              <p className="text-xs text-green-400 mt-2">
                Completed: {new Date(job.completedAt).toLocaleString()}
              </p>
            )}
          </div>

          {/* Photos Preview */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {job.beforePhoto && (
              <div>
                <p className="text-xs text-slate-400 mb-1">BEFORE</p>
                <img src={job.beforePhoto.dataUrl} alt="Before" className="w-full rounded-lg border border-slate-700" />
              </div>
            )}
            {job.afterPhoto && (
              <div>
                <p className="text-xs text-slate-400 mb-1">AFTER</p>
                <img src={job.afterPhoto.dataUrl} alt="After" className="w-full rounded-lg border border-slate-700" />
              </div>
            )}
          </div>

          {/* Report Link */}
          {job.reportUrl && (
            <a
              href={job.reportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-center mb-4"
            >
              📄 View Final Report
            </a>
          )}

          {job.managerEmail && (
            <div className="bg-green-900/30 border border-green-700 p-4 rounded-xl mb-6">
              <p className="text-sm text-green-400">
                ✓ Report sent to <span className="font-medium text-white">{job.managerEmail}</span>
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
            <a
              href="/#/create-job"
              className="flex-1 py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold text-center"
            >
              + New Job
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER: MAIN WIZARD
  // ============================================================================

  return (
    <div className={`min-h-screen ${themeClasses}`}>
      {/* Navigation Header with Job Log Link + Theme Toggle */}
      <div className={`fixed top-0 left-0 right-0 z-40 backdrop-blur border-b ${isDaylight ? 'bg-white/90 border-slate-300' : 'bg-slate-900/90 border-slate-700'}`}>
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-sm ${isDaylight ? 'text-slate-600' : 'text-slate-400'}`}>Job Runner</span>
            {/* Daylight Mode Toggle */}
            <button
              onClick={() => setDaylightMode(!isDaylightMode)}
              className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
                isDaylight
                  ? 'bg-orange-500 text-slate-900'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
              title={isDaylight ? 'Switch to Dark Mode' : 'Switch to Daylight Mode (outdoor visibility)'}
            >
              {isDaylight ? '☀️' : '🌙'}
            </button>
          </div>
          <a
            href="/#/job-log"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${buttonSecondaryClasses}`}
          >
            My Jobs
          </a>
        </div>
      </div>

      {/* Sync Status Indicator */}
      <StatusIndicator isOnline={isOnline} syncStatus={job.syncStatus} isSyncing={isSyncing} message={syncMessage} />

      {/* Toast Notification */}
      {toastMessage && <Toast message={toastMessage.text} type={toastMessage.type} />}

      <div className="max-w-lg mx-auto p-4 pt-16 pb-24">
        {/* Progress Bar */}
        <ProgressBar currentStep={job.currentStep} />

        {/* Job Info Header */}
        <div className={`mt-4 mb-6 p-4 rounded-xl border ${cardClasses}`}>
          <p className={`text-xs ${isDaylight ? 'text-slate-500' : 'text-slate-400'}`}>JOB</p>
          <p className="text-lg font-bold">{job.title}</p>
          <p className={`text-sm ${isDaylight ? 'text-slate-600' : 'text-slate-400'}`}>{job.client}</p>
          {job.address && <p className={`text-sm ${isDaylight ? 'text-slate-500' : 'text-slate-500'}`}>{job.address}</p>}
        </div>

        {/* Wizard Steps */}
        <div className="mt-6">
          {job.currentStep === 'before' && (
            <PhotoStep
              step={1}
              title="Before Photo"
              subtitle="Document the starting condition"
              photo={job.beforePhoto}
              showCamera={showCamera && cameraType === 'before'}
              onOpenCamera={() => { setCameraType('before'); setShowCamera(true); }}
              onCapture={handlePhotoCapture}
              onCancelCamera={() => setShowCamera(false)}
              onNext={() => goToStep('after')}
              canGoBack={false}
            />
          )}

          {job.currentStep === 'after' && (
            <PhotoStep
              step={2}
              title="After Photo"
              subtitle="Document the completed work"
              photo={job.afterPhoto}
              showCamera={showCamera && cameraType === 'after'}
              onOpenCamera={() => { setCameraType('after'); setShowCamera(true); }}
              onCapture={handlePhotoCapture}
              onCancelCamera={() => setShowCamera(false)}
              onNext={() => goToStep('signature')}
              onBack={() => goToStep('before')}
              canGoBack={true}
            />
          )}

          {job.currentStep === 'signature' && (
            <SignatureStep
              signature={job.signature}
              signerName={signerName}
              techName={techName}
              onSignerNameChange={setSignerName}
              onTechNameChange={setTechName}
              onSave={handleSignatureSave}
              onBack={() => goToStep('after')}
              onNext={() => goToStep('review')}
            />
          )}

          {job.currentStep === 'review' && (
            <ReviewStep
              job={job}
              isOnline={isOnline}
              isSyncing={isSyncing}
              onSync={handleSync}
              onBack={() => goToStep('signature')}
              onFinish={handleFinishJob}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function StatusIndicator({ isOnline, syncStatus, isSyncing, message }: { isOnline: boolean; syncStatus: SyncStatus; isSyncing: boolean; message?: string | null }) {
  const getColor = () => {
    if (!isOnline) return 'bg-red-500';
    if (isSyncing) return 'bg-yellow-500 animate-pulse';
    if (syncStatus === 'synced') return 'bg-green-500';
    if (syncStatus === 'failed') return 'bg-red-500';
    return 'bg-yellow-500';
  };

  const getText = () => {
    if (message) return message;
    if (!isOnline) return 'OFFLINE';
    if (isSyncing) return 'SYNCING...';
    if (syncStatus === 'synced') return 'SYNCED ✓';
    if (syncStatus === 'failed') return 'TAP TO RETRY';
    return 'PENDING';
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 bg-slate-900/90 backdrop-blur rounded-full border border-slate-700">
      <div className={`w-3 h-3 rounded-full ${getColor()}`} />
      <span className="text-xs font-medium text-slate-300">{getText()}</span>
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

function ProgressBar({ currentStep }: { currentStep: WizardStep }) {
  const steps: WizardStep[] = ['before', 'after', 'signature', 'review'];
  const currentIndex = steps.indexOf(currentStep);

  return (
    <div className="flex items-center gap-2">
      {steps.map((step, index) => (
        <div
          key={step}
          className={`flex-1 h-2 rounded-full transition-colors ${
            index <= currentIndex ? 'bg-blue-500' : 'bg-slate-700'
          }`}
        />
      ))}
    </div>
  );
}

function PhotoStep({
  step, title, subtitle, photo, showCamera, onOpenCamera, onCapture, onCancelCamera, onNext, onBack, canGoBack
}: {
  step: number;
  title: string;
  subtitle: string;
  photo?: Photo;
  showCamera: boolean;
  onOpenCamera: () => void;
  onCapture: (dataUrl: string) => void;
  onCancelCamera: () => void;
  onNext: () => void;
  onBack?: () => void;
  canGoBack: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600/20 rounded-full text-blue-400 text-sm font-medium mb-2">
          Step {step} of 4
        </div>
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <p className="text-slate-400 text-sm">{subtitle}</p>
      </div>

      {showCamera ? (
        <Camera onCapture={onCapture} onCancel={onCancelCamera} />
      ) : photo ? (
        <div className="space-y-4">
          <img src={photo.dataUrl} alt={title} className="w-full rounded-xl border border-slate-700" />
          <PhotoMeta photo={photo} />
          <div className="flex gap-3">
            {canGoBack && (
              <button onClick={onBack} className="py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg">
                ← Back
              </button>
            )}
            <button onClick={onOpenCamera} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg">
              Retake
            </button>
            <button onClick={onNext} className="flex-1 py-4 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold">
              NEXT →
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <button onClick={onOpenCamera} className="w-full py-8 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xl transition-colors">
            📸 TAKE {title.toUpperCase()}
          </button>
          {canGoBack && (
            <button onClick={onBack} className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg">
              ← Back
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SignatureStep({
  signature, signerName, techName, onSignerNameChange, onTechNameChange, onSave, onBack, onNext
}: {
  signature?: Signature;
  signerName: string;
  techName: string;
  onSignerNameChange: (v: string) => void;
  onTechNameChange: (v: string) => void;
  onSave: (dataUrl: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  if (signature) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600/20 rounded-full text-blue-400 text-sm font-medium mb-2">
            Step 3 of 4
          </div>
          <h2 className="text-xl font-bold text-white">Signature Captured</h2>
        </div>
        <img src={signature.dataUrl} alt="Signature" className="w-full rounded-xl border border-slate-700 bg-white" />
        <p className="text-center text-slate-400">Signed by: <span className="text-white font-medium">{signature.signerName}</span></p>
        <div className="flex gap-3">
          <button onClick={onBack} className="py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg">← Back</button>
          <button onClick={onNext} className="flex-1 py-4 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold">NEXT →</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600/20 rounded-full text-blue-400 text-sm font-medium mb-2">
          Step 3 of 4
        </div>
        <h2 className="text-xl font-bold text-white">Client Signature</h2>
        <p className="text-slate-400 text-sm">Get client approval</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Your Name (Technician)</label>
        <input
          type="text"
          value={techName}
          onChange={(e) => onTechNameChange(e.target.value)}
          placeholder="e.g., John Smith"
          className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Client Name *</label>
        <input
          type="text"
          value={signerName}
          onChange={(e) => onSignerNameChange(e.target.value)}
          placeholder="Enter client name"
          className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500"
        />
      </div>

      <SignatureCanvas onSave={onSave} />

      <button onClick={onBack} className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg">
        ← Back
      </button>
    </div>
  );
}

function ReviewStep({ job, isOnline, isSyncing, onSync, onBack, onFinish }: { job: RunJob; isOnline: boolean; isSyncing: boolean; onSync: () => void; onBack: () => void; onFinish: () => void }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-600/20 rounded-full text-green-400 text-sm font-medium mb-2">
          Step 4 of 4
        </div>
        <h2 className="text-xl font-bold text-white">Review & Sync</h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {job.beforePhoto && (
          <div>
            <p className="text-xs text-slate-400 mb-1">BEFORE</p>
            <img src={job.beforePhoto.dataUrl} alt="Before" className="w-full rounded-lg border border-slate-700" />
          </div>
        )}
        {job.afterPhoto && (
          <div>
            <p className="text-xs text-slate-400 mb-1">AFTER</p>
            <img src={job.afterPhoto.dataUrl} alt="After" className="w-full rounded-lg border border-slate-700" />
          </div>
        )}
      </div>

      {job.signature && (
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
          <p className="text-xs text-slate-400 mb-2">SIGNATURE</p>
          <img src={job.signature.dataUrl} alt="Signature" className="w-full max-w-xs rounded-lg bg-white" />
          <p className="mt-2 text-sm text-slate-300">Signed by: {job.signature.signerName}</p>
        </div>
      )}

      {/* Sync Status */}
      <div className={`p-4 rounded-xl border ${
        job.syncStatus === 'synced' ? 'bg-green-900/30 border-green-700' :
        job.syncStatus === 'failed' ? 'bg-red-900/30 border-red-700' :
        'bg-yellow-900/30 border-yellow-700'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-4 h-4 rounded-full ${
            job.syncStatus === 'synced' ? 'bg-green-500' :
            job.syncStatus === 'failed' ? 'bg-red-500' :
            'bg-yellow-500 animate-pulse'
          }`} />
          <span className="font-medium text-white">
            {job.syncStatus === 'synced' ? 'Data Synced to Cloud ✓' :
             job.syncStatus === 'failed' ? 'Sync Failed - Retry' :
             'Ready to Sync'}
          </span>
        </div>
        {job.syncStatus === 'synced' && job.managerEmail && (
          <p className="mt-2 text-sm text-green-400">Report sent to {job.managerEmail}</p>
        )}
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg">← Back</button>
        {job.syncStatus !== 'synced' && isOnline && (
          <button onClick={onSync} disabled={isSyncing} className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-lg font-bold">
            {isSyncing ? 'SYNCING...' : 'SYNC NOW'}
          </button>
        )}
        {job.syncStatus === 'synced' && (
          <button onClick={onFinish} className="flex-1 py-4 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold">
            ✓ COMPLETE
          </button>
        )}
      </div>
    </div>
  );
}

function Camera({ onCapture, onCancel }: { onCapture: (dataUrl: string) => void; onCancel: () => void }) {
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
    } catch {
      setError('Camera access denied');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
  };

  const capture = () => {
    const video = videoRef.current!;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    onCapture(canvas.toDataURL('image/jpeg', 0.9));
    stopCamera();
  };

  if (error) {
    return (
      <div className="p-6 bg-red-900/50 rounded-xl text-center">
        <p className="text-red-300 mb-4">{error}</p>
        <button onClick={onCancel} className="px-6 py-3 bg-slate-700 text-white rounded-lg">Cancel</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-xl bg-black" />
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg">Cancel</button>
        <button onClick={capture} className="flex-1 py-4 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold text-lg">📸 CAPTURE</button>
      </div>
    </div>
  );
}

function SignatureCanvas({ onSave }: { onSave: (dataUrl: string) => void }) {
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
  }, []);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current = getPos(e);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext('2d')!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };

  const stop = () => { isDrawing.current = false; };

  const clear = () => {
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 350, 200);
  };

  return (
    <div className="space-y-4">
      <canvas
        ref={canvasRef}
        width={350}
        height={200}
        className="border-2 border-slate-600 rounded-lg bg-white touch-none w-full"
        onMouseDown={start}
        onMouseMove={draw}
        onMouseUp={stop}
        onMouseLeave={stop}
        onTouchStart={start}
        onTouchMove={draw}
        onTouchEnd={stop}
      />
      <div className="flex gap-3">
        <button onClick={clear} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg">Clear</button>
        <button onClick={() => onSave(canvasRef.current!.toDataURL('image/png'))} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium">Save Signature</button>
      </div>
    </div>
  );
}

function PhotoMeta({ photo }: { photo: Photo }) {
  return (
    <div className="flex flex-wrap gap-2 text-xs text-slate-400">
      <span className="px-2 py-1 bg-slate-800 rounded">{new Date(photo.timestamp).toLocaleString()}</span>
      {photo.lat && photo.lng && (
        <span className="px-2 py-1 bg-slate-800 rounded">📍 {photo.lat.toFixed(4)}, {photo.lng.toFixed(4)}</span>
      )}
      <span className="px-2 py-1 bg-slate-800 rounded">{(photo.sizeBytes / 1024).toFixed(0)} KB</span>
    </div>
  );
}
