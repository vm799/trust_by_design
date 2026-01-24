/**
 * useTechnicianJob - State management hook for TechnicianPortal
 *
 * REMEDIATION ITEM 4: Extract state from monolithic component
 *
 * This hook manages:
 * - Job loading and validation
 * - Photo capture and storage
 * - Checklist state
 * - Signature capture
 * - Location verification
 * - Draft persistence
 * - Sync status
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Job, Photo, SyncStatus, PhotoType, SafetyCheck } from '../types';
import { validateMagicLink, getJobByToken, getJob, recordMagicLinkAccess } from '../lib/db';
import { getJobLocal, saveJobLocal, getMediaLocal, queueAction } from '../lib/offline/db';
import { getVerifiedLocation } from '../lib/services/what3words';
import { logLocationCapture, logMockLocationFallback } from '../lib/auditLog';

// Default safety checklist
const DEFAULT_CHECKLIST: SafetyCheck[] = [
  { id: 'sc1', label: 'PPE (Hard Hat, Gloves, Hi-Vis) Worn', checked: false, required: true },
  { id: 'sc2', label: 'Site Hazards Identified & Controlled', checked: false, required: true },
  { id: 'sc3', label: 'Required Permits/Authorisations Checked', checked: false, required: true },
  { id: 'sc4', label: 'Area Clear of Bystanders', checked: false, required: true }
];

interface UseTechnicianJobOptions {
  jobs: Job[];
  onUpdateJob: (job: Job) => void;
  onAddJob?: (job: Job) => void;
}

interface JobDateWarning {
  type: 'future' | 'overdue' | null;
  days: number;
}

export function useTechnicianJob({ jobs, onUpdateJob, onAddJob }: UseTechnicianJobOptions) {
  const { token, jobId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const jobIdFromUrl = searchParams.get('jobId');

  // Job state
  const [job, setJob] = useState<Job | undefined>(undefined);
  const [isLoadingJob, setIsLoadingJob] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenErrorType, setTokenErrorType] = useState<'expired' | 'sealed' | 'invalid' | 'not_found' | null>(null);
  const [jobDateWarning, setJobDateWarning] = useState<JobDateWarning>({ type: null, days: 0 });

  // Step state
  const [step, setStep] = useState(0);
  const [maxCompletedStep, setMaxCompletedStep] = useState(0);

  // Photo state
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoDataUrls, setPhotoDataUrls] = useState<Map<string, string>>(new Map());
  const [activePhotoType, setActivePhotoType] = useState<PhotoType>('Before');

  // Checklist state
  const [checklist, setChecklist] = useState<SafetyCheck[]>(DEFAULT_CHECKLIST);

  // Form state
  const [notes, setNotes] = useState('');
  const [signerName, setSignerName] = useState('');
  const [signerRole, setSignerRole] = useState('Client');

  // Location state
  const [locationStatus, setLocationStatus] = useState<'idle' | 'capturing' | 'captured' | 'denied'>('idle');
  const [locationVerified, setLocationVerified] = useState(true);
  const [locationWarning, setLocationWarning] = useState<string | null>(null);
  const [w3w, setW3w] = useState('');
  const [coords, setCoords] = useState<{ lat?: number; lng?: number }>({});

  // Sync state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [localSyncStatus, setLocalSyncStatus] = useState<SyncStatus>('synced');

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Draft state helpers
  const getDraftState = useCallback(() => {
    if (!job?.id) return null;
    try {
      const saved = localStorage.getItem(`jobproof_draft_${job.id}`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }, [job?.id]);

  const saveDraftState = useCallback((state: Record<string, unknown>) => {
    if (!job?.id) return;
    try {
      localStorage.setItem(`jobproof_draft_${job.id}`, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save draft state:', error);
    }
  }, [job?.id]);

  const clearDraftState = useCallback(() => {
    if (!job?.id) return;
    localStorage.removeItem(`jobproof_draft_${job.id}`);
    localStorage.removeItem(`jobproof_progress_${job.id}`);
  }, [job?.id]);

  // Load job
  useEffect(() => {
    const loadJob = async () => {
      setIsLoadingJob(true);
      setTokenError(null);

      try {
        let loadedJob: Job | undefined;

        if (jobIdFromUrl && token) {
          // Deep-link flow
          const local = await getJobLocal(jobIdFromUrl);
          if (local) {
            loadedJob = local as Job;
          }

          if (!loadedJob) {
            const validation = await validateMagicLink(token);
            if (validation.success && validation.data) {
              const { job_id, workspace_id } = validation.data;

              if (job_id !== jobIdFromUrl) {
                setTokenError('Token does not match the requested job');
                setTokenErrorType('invalid');
                setIsLoadingJob(false);
                return;
              }

              if (workspace_id) {
                const result = await getJob(jobIdFromUrl, workspace_id);
                if (result.success && result.data) {
                  loadedJob = result.data;
                  await saveJobLocal({
                    ...loadedJob,
                    syncStatus: loadedJob.syncStatus || 'synced',
                    lastUpdated: Date.now()
                  });
                }
              }
            } else {
              const errorMsg = validation.error || 'Invalid or expired link';
              setTokenErrorType(errorMsg.toLowerCase().includes('expired') ? 'expired' : 'invalid');
              setTokenError(errorMsg);
            }
          }
        } else if (token) {
          // Token-only flow
          if (jobId) {
            const local = await getJobLocal(jobId);
            if (local) loadedJob = local as Job;
          }

          if (!loadedJob) {
            const result = await getJobByToken(token);
            if (result.success && result.data) {
              loadedJob = result.data;
              await saveJobLocal({
                ...loadedJob,
                syncStatus: loadedJob.syncStatus || 'synced',
                lastUpdated: Date.now()
              });
            } else if (token.startsWith('JP-')) {
              const local = await getJobLocal(token);
              loadedJob = local as Job || jobs.find(j => j.id === token);
            } else {
              setTokenError(result.error as string || 'Invalid or expired link');
            }
          }
        } else if (jobId) {
          loadedJob = jobs.find(j => j.id === jobId);
        }

        if (loadedJob) {
          // Check job date
          if (loadedJob.date) {
            const jobDate = new Date(loadedJob.date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            jobDate.setHours(0, 0, 0, 0);
            const daysDiff = Math.floor((today.getTime() - jobDate.getTime()) / (1000 * 60 * 60 * 24));

            if (daysDiff < 0) {
              setJobDateWarning({ type: 'future', days: Math.abs(daysDiff) });
            } else if (daysDiff > 0 && loadedJob.status !== 'Submitted') {
              setJobDateWarning({ type: 'overdue', days: daysDiff });
            }
          }

          setJob(loadedJob);

          if (token && !token.startsWith('JP-')) {
            recordMagicLinkAccess(token);
          }
        } else if (!tokenError) {
          setTokenError('Job not found locally or remotely');
          setTokenErrorType('not_found');
        }
      } catch (error) {
        console.error('Failed to load job:', error);
        setTokenError('Failed to load job. Please try again.');
      } finally {
        setIsLoadingJob(false);
      }
    };

    loadJob();
  }, [token, jobId, jobIdFromUrl, jobs, tokenError]);

  // Initialize from draft
  useEffect(() => {
    if (!job?.id) return;

    const draft = getDraftState();
    const savedProgress = localStorage.getItem(`jobproof_progress_${job.id}`);

    setStep(savedProgress ? parseInt(savedProgress) : (draft?.step || 0));
    setPhotos(draft?.photos || job.photos || []);
    setChecklist(draft?.checklist || job.safetyChecklist || DEFAULT_CHECKLIST);
    setNotes(draft?.notes || job.notes || '');
    setLocalSyncStatus(job.syncStatus || 'synced');
    setSignerName(draft?.signerName || job.signerName || '');
    setSignerRole(draft?.signerRole || job.signerRole || 'Client');
    setLocationStatus(draft?.locationStatus || 'idle');
    setW3w(draft?.w3w || job.w3w || '');
    setCoords(draft?.coords || { lat: job.lat, lng: job.lng });
  }, [job?.id, getDraftState]);

  // Track max completed step
  useEffect(() => {
    if (step > maxCompletedStep) {
      setMaxCompletedStep(step);
    }
  }, [step, maxCompletedStep]);

  // Auto-save progress
  useEffect(() => {
    if (job?.id && step < 5) {
      localStorage.setItem(`jobproof_progress_${job.id}`, step.toString());
    } else if (job?.id && step === 5) {
      clearDraftState();
    }
  }, [step, job?.id, clearDraftState]);

  // Load photos from IndexedDB
  useEffect(() => {
    const loadPhotosFromIndexedDB = async () => {
      const loadedUrls = new Map<string, string>();
      for (const photo of photos) {
        if (photo.isIndexedDBRef) {
          try {
            const data = await getMediaLocal(photo.url);
            if (data) loadedUrls.set(photo.id, data);
          } catch {
            console.warn('Failed to load local media:', photo.id);
          }
        }
      }
      setPhotoDataUrls(loadedUrls);
    };
    if (photos.length > 0) loadPhotosFromIndexedDB();
  }, [photos]);

  // Monitor connectivity
  useEffect(() => {
    const handleConnectivity = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleConnectivity);
    window.addEventListener('offline', handleConnectivity);
    return () => {
      window.removeEventListener('online', handleConnectivity);
      window.removeEventListener('offline', handleConnectivity);
    };
  }, []);

  // Write local draft
  const writeLocalDraft = useCallback(async (fields: Partial<Job>) => {
    if (!job) return;
    const updatedJob: Job = {
      ...job,
      ...fields,
      syncStatus: 'pending',
      lastUpdated: Date.now()
    };

    onUpdateJob(updatedJob);
    setLocalSyncStatus('pending');
    setJob(prev => prev ? ({ ...prev, ...fields }) : undefined);

    await saveJobLocal({
      ...updatedJob,
      syncStatus: updatedJob.syncStatus || 'pending',
      lastUpdated: Date.now()
    });

    await queueAction('UPDATE_JOB', { id: job.id, ...fields });
  }, [job, onUpdateJob]);

  // Capture location
  const captureLocation = useCallback(() => {
    setLocationStatus('capturing');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;

        const locationResult = await getVerifiedLocation(lat, lng, accuracy);

        setCoords({ lat, lng });
        setW3w(locationResult.w3w);
        setLocationVerified(locationResult.isVerified);
        setLocationWarning(locationResult.warning || null);
        setLocationStatus('captured');

        writeLocalDraft({
          w3w: locationResult.w3w,
          lat,
          lng,
          locationVerified: locationResult.isVerified,
          locationSource: locationResult.verificationSource,
        });

        if (job) {
          if (locationResult.isVerified) {
            logLocationCapture(job.id, { lat, lng, accuracy }, 'gps', locationResult.w3w, true, {
              technicianId: job.techId,
              technicianName: job.technician
            });
          } else {
            logMockLocationFallback(job.id, locationResult.w3w, { lat, lng }, {
              technicianId: job.techId,
              technicianName: job.technician
            });
          }
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        setLocationStatus('denied');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [job, writeLocalDraft]);

  // Checklist toggle
  const handleChecklistToggle = useCallback((idx: number) => {
    const next = [...checklist];
    next[idx].checked = !next[idx].checked;
    setChecklist(next);
    writeLocalDraft({ safetyChecklist: next });
  }, [checklist, writeLocalDraft]);

  // Add photo
  const addPhoto = useCallback((photo: Photo) => {
    setPhotos(prev => [...prev, photo]);
  }, []);

  // Delete photo
  const deletePhoto = useCallback((photoId: string) => {
    setPhotos(prev => prev.filter(p => p.id !== photoId));
  }, []);

  // Save current state
  const saveProgress = useCallback(() => {
    saveDraftState({
      step,
      photos,
      checklist,
      notes,
      signerName,
      signerRole,
      w3w,
      coords,
      locationStatus,
      locationVerified
    });
  }, [saveDraftState, step, photos, checklist, notes, signerName, signerRole, w3w, coords, locationStatus, locationVerified]);

  return {
    // Job
    job,
    setJob,
    isLoadingJob,
    tokenError,
    tokenErrorType,
    jobDateWarning,

    // Steps
    step,
    setStep,
    maxCompletedStep,

    // Photos
    photos,
    setPhotos,
    photoDataUrls,
    activePhotoType,
    setActivePhotoType,
    addPhoto,
    deletePhoto,

    // Checklist
    checklist,
    setChecklist,
    handleChecklistToggle,

    // Form
    notes,
    setNotes,
    signerName,
    setSignerName,
    signerRole,
    setSignerRole,

    // Location
    locationStatus,
    setLocationStatus,
    locationVerified,
    locationWarning,
    w3w,
    coords,
    captureLocation,

    // Sync
    isSubmitting,
    setIsSubmitting,
    isSyncing,
    setIsSyncing,
    isOnline,
    localSyncStatus,
    setLocalSyncStatus,

    // Refs
    canvasRef,
    fileInputRef,

    // Actions
    writeLocalDraft,
    saveProgress,
    clearDraftState,
    navigate,

    // Callbacks
    onUpdateJob,
    onAddJob,
  };
}

export type TechnicianJobState = ReturnType<typeof useTechnicianJob>;
