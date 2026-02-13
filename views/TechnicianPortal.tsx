import React, { useState, useRef, useEffect, useCallback } from 'react';
import Layout from '../components/AppLayout';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Job, Photo, SyncStatus, PhotoType, SafetyCheck, JobStatus } from '../types';
import { getJobByToken, updateJob, recordMagicLinkAccess, notifyManagerOfTechJob, getTechnicianWorkMode, generateClientReceipt } from '../lib/db';
import { getJobLocal, saveJobLocal, getMediaLocal, saveMediaLocal, queueAction } from '../lib/offline/db';
import { sealEvidence, canSealJob, calculateDataUrlHash } from '../lib/sealing';
import { getVerifiedLocation, createManualLocationResult } from '../lib/services/what3words';
import { waitForPhotoSync, getUnsyncedPhotos, createSyncStatusModal } from '../lib/utils/syncUtils';
import { notifyJobSealed } from '../lib/notificationService';
import { hapticSuccess, hapticConfirm, hapticWarning } from '../lib/haptics';
import { celebrateSuccess, showToast } from '../lib/microInteractions';
import { secureRandomString } from '../lib/secureId';
import QuickJobForm from '../components/QuickJobForm';
import TechnicianOnboarding, { useShouldShowOnboarding } from '../components/TechnicianOnboarding';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Modal from '../components/ui/Modal';
import ActionButton from '../components/ui/ActionButton';
import { InfoBox } from '../components/ui';
import SealCertificate from '../components/SealCertificate';

// Dialog state type for managing styled modals
interface DialogState {
  type: 'confirm' | 'alert' | 'prompt' | null;
  title: string;
  message: string;
  variant?: 'danger' | 'warning' | 'info';
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  promptValue?: string;
  promptPlaceholder?: string;
}
import {
  logAuditEvent,
  logPhotoCapture,
  logPhotoDeletion,
  logSignatureCapture,
  logSignatureCleared,
  logLocationCapture,
  logMockLocationFallback,
} from '../lib/auditLog';

const TechnicianPortal: React.FC<{ jobs: Job[], onUpdateJob: (j: Job) => void, onAddJob?: (j: Job) => void }> = ({ jobs, onUpdateJob, onAddJob }) => {
  const { token, jobId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const jobIdFromUrl = searchParams.get('jobId');

  // Onboarding state
  const shouldShowOnboarding = useShouldShowOnboarding();
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Show onboarding on first visit
  useEffect(() => {
    if (shouldShowOnboarding) {
      setShowOnboarding(true);
    }
  }, [shouldShowOnboarding]);

  // Token-based access (Phase C.2)
  const [job, setJob] = useState<Job | undefined>(undefined);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenErrorType, setTokenErrorType] = useState<'expired' | 'sealed' | 'invalid' | 'not_found' | null>(null);
  const [isLoadingJob, setIsLoadingJob] = useState(true);
  const [jobDateWarning, setJobDateWarning] = useState<'future' | 'overdue' | null>(null);
  const [overdueByDays, setOverdueByDays] = useState<number>(0);

  // Quick Job creation (technician-initiated)
  const [showQuickJobForm, setShowQuickJobForm] = useState(false);
  getTechnicianWorkMode(); // Check work mode for potential future use

  // Handle quick job creation
  const handleQuickJobCreated = useCallback((newJob: Job) => {
    // Add job to state
    if (onAddJob) {
      onAddJob(newJob);
    }

    // Save locally
    saveJobLocal({
      ...newJob,
      syncStatus: newJob.syncStatus || 'pending',
      lastUpdated: Date.now()
    });

    // Queue for sync
    queueAction('CREATE_JOB', newJob);

    // Close form and navigate to the new job
    setShowQuickJobForm(false);
    setJob(newJob);
    setIsLoadingJob(false);
    setStep(0); // Start at job overview

  }, [onAddJob]);

  // Load job via token or legacy jobId
  useEffect(() => {
    const loadJob = async () => {
      setIsLoadingJob(true);
      setTokenError(null);

      try {
        let loadedJob: Job | undefined;

        // Priority: jobId from URL > token validation > local cache
        if (jobIdFromUrl && token) {
          // New flow: Deep-linking with jobId parameter

          // 1. Try Local DB (Dexie) first
          const local = await getJobLocal(jobIdFromUrl);
          if (local) {
            loadedJob = local as Job;
          }

          // 2. Load job via token RPC (validates AND returns full job, bypasses RLS)
          if (!loadedJob) {
            const result = await getJobByToken(token);
            if (result.success && result.data) {
              // Verify jobId from URL matches the loaded job
              if (result.data.id !== jobIdFromUrl) {
                setTokenError('Token does not match the requested job');
                setTokenErrorType('invalid');
                setIsLoadingJob(false);
                return;
              }
              loadedJob = result.data;
              // Cache to Local DB with proper LocalJob type
              await saveJobLocal({
                ...loadedJob,
                syncStatus: loadedJob.syncStatus || 'synced',
                lastUpdated: Date.now()
              });
            } else {
              // Determine error type from error message
              const errorMsg = result.error || 'Invalid or expired link';
              if (errorMsg.toLowerCase().includes('expired')) {
                setTokenErrorType('expired');
              } else if (errorMsg.toLowerCase().includes('not found')) {
                setTokenErrorType('not_found');
              } else {
                setTokenErrorType('invalid');
              }
              setTokenError(errorMsg);
            }
          }
        } else if (token) {
          // Legacy flow: Token-only routing

          // 1. Try Local DB (Dexie) first
          if (jobId) {
            const local = await getJobLocal(jobId);
            if (local) loadedJob = local as Job;
          }

          // 2. If not local, try Token/Network
          if (!loadedJob) {
            const result = await getJobByToken(token);
            if (result.success && result.data) {
              loadedJob = result.data;
              // Cache to Local DB immediately with proper LocalJob type
              await saveJobLocal({
                ...loadedJob,
                syncStatus: loadedJob.syncStatus || 'synced',
                lastUpdated: Date.now()
              });
            } else {
              // Token validation failed - check if it's actually a job ID (fallback for offline/legacy URLs)
              if (token.startsWith('JP-')) {
                // Try local DB first
                const local = await getJobLocal(token);
                if (local) {
                  loadedJob = local as Job;
                } else {
                  // Try props/legacy
                  loadedJob = jobs.find(j => j.id === token);
                }

                if (loadedJob) {
                  await saveJobLocal({
                    ...loadedJob,
                    syncStatus: loadedJob.syncStatus || 'synced',
                    lastUpdated: Date.now()
                  });
                } else {
                  setTokenError(result.error as string || 'Invalid or expired link');
                }
              } else {
                setTokenError(result.error as string || 'Invalid or expired link');
              }
            }
          }
        } else if (jobId) {
          // Fallback to props/legacy (no token)
          loadedJob = jobs.find(j => j.id === jobId);
          if (loadedJob) {
            await saveJobLocal({
              ...loadedJob,
              syncStatus: loadedJob.syncStatus || 'synced',
              lastUpdated: Date.now()
            });
          }
        }

        if (loadedJob) {
          // DATE VALIDATION: Check if job is scheduled for today, future, or overdue
          if (loadedJob.date) {
            const jobDate = new Date(loadedJob.date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            jobDate.setHours(0, 0, 0, 0);

            const daysDiff = Math.floor((today.getTime() - jobDate.getTime()) / (1000 * 60 * 60 * 24));

            if (daysDiff < 0) {
              // Job is scheduled for future
              setJobDateWarning('future');
            } else if (daysDiff > 0 && loadedJob.status !== 'Submitted') {
              // Job is overdue (past date, not yet submitted)
              setJobDateWarning('overdue');
              setOverdueByDays(daysDiff);
            }
          }
          setJob(loadedJob);

          // Record magic link access for tracking (only if accessed via token)
          if (token && !token.startsWith('JP-')) {
            recordMagicLinkAccess(token);
          }
        } else if (!tokenError) { // Only set 'not found' if we haven't already set a token error
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, jobId, jobIdFromUrl]); // FIXED: Removed 'jobs' - prevents re-runs causing "job not found"

  // Immutable State Protection: Block access if job is already submitted or sealed
  useEffect(() => {
    if (job?.status === 'Submitted' || job?.isSealed || job?.sealedAt) {
      // Use styled dialog instead of alert - navigate after close
      setDialog({
        type: 'alert',
        title: 'Job Sealed',
        message: 'This job has been sealed and is immutable. No further edits allowed.',
        variant: 'info',
        onConfirm: () => navigate('/home')
      });
    }
  }, [job?.status, job?.isSealed, job?.sealedAt, navigate]);

  // Check IndexedDB availability on mount
  useEffect(() => {
    if (!window.indexedDB) {
      setDialog({
        type: 'alert',
        title: 'Browser Not Supported',
        message: 'Your browser does not support offline storage. Photos and signatures cannot be saved. Please use a modern browser (Chrome, Firefox, Safari, Edge).',
        variant: 'danger'
      });
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
    { id: 'sc3', label: 'Required Permits/Authorisations Checked', checked: false, required: true },
    { id: 'sc4', label: 'Area Clear of Bystanders', checked: false, required: true }
  ]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [, setLocalSyncStatus] = useState<SyncStatus>('synced');
  const [signerName, setSignerName] = useState('');
  const [signerRole, setSignerRole] = useState('Client');
  // UX Flow Contract: Attestation checkbox required before sealing
  const [attestationConfirmed, setAttestationConfirmed] = useState(false);
  const [activePhotoType, setActivePhotoType] = useState<PhotoType>('Before');
  const [locationStatus, setLocationStatus] = useState<'idle' | 'capturing' | 'captured' | 'denied'>('idle');
  const [w3w, setW3w] = useState('');
  const [coords, setCoords] = useState<{ lat?: number, lng?: number }>({});
  const [gpsCountdown, setGpsCountdown] = useState<number>(15);
  const gpsWatchIdRef = useRef<number | null>(null);
  const gpsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const gpsCountdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Dialog state for styled modals (replacing native alert/confirm/prompt)
  const [dialog, setDialog] = useState<DialogState>({ type: null, title: '', message: '' });
  const [promptInput, setPromptInput] = useState('');

  // Helper to show styled alert
  const showAlert = useCallback((title: string, message: string, variant: 'danger' | 'warning' | 'info' = 'info') => {
    setDialog({ type: 'alert', title, message, variant });
  }, []);

  // Helper to show styled confirm dialog
  const showConfirm = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    options?: { variant?: 'danger' | 'warning' | 'info'; confirmLabel?: string; cancelLabel?: string }
  ) => {
    setDialog({
      type: 'confirm',
      title,
      message,
      onConfirm,
      variant: options?.variant || 'warning',
      confirmLabel: options?.confirmLabel || 'Confirm',
      cancelLabel: options?.cancelLabel || 'Cancel'
    });
  }, []);

  // Close dialog
  const closeDialog = useCallback(() => {
    setDialog({ type: null, title: '', message: '' });
    setPromptInput('');
  }, []);

  // Photo deletion state and handler
  const [photoToDelete, setPhotoToDelete] = useState<Photo | null>(null);

  // Help modal state
  const [showHelp, setShowHelp] = useState(false);

  const confirmDeletePhoto = useCallback((photo: Photo) => {
    setPhotoToDelete(photo);
  }, []);

  const executeDeletePhoto = useCallback(() => {
    if (!photoToDelete) return;

    // Log photo deletion with hash for audit trail
    if (job) {
      logPhotoDeletion(
        job.id,
        photoToDelete.id,
        photoToDelete.photo_hash || 'unknown',
        'User requested deletion',
        { technicianId: job.techId, technicianName: job.technician }
      );
    }

    setPhotos(prev => prev.filter(item => item.id !== photoToDelete.id));
    setPhotoToDelete(null);
  }, [photoToDelete, job]);

  // Initialize state from job and draft once job is loaded
  // eslint-disable-next-line react-hooks/exhaustive-deps -- init-once-per-job: getDraftState/checklist are intentionally omitted to avoid re-init loops
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

  // Auto-focus refs for progressive field highlighting
  const checklistRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const signerNameRef = useRef<HTMLInputElement>(null);

  // Backtracking prevention: track highest completed step
  const [maxCompletedStep, setMaxCompletedStep] = useState(0);

  // Update max completed step when advancing
  useEffect(() => {
    if (step > maxCompletedStep) {
      setMaxCompletedStep(step);
    }
  }, [step, maxCompletedStep]);

  // Auto-focus on step change
  // eslint-disable-next-line react-hooks/exhaustive-deps -- focus should only trigger on step change, not on checklist updates
  useEffect(() => {
    const focusTimeout = setTimeout(() => {
      if (step === 1) {
        // Focus first unchecked checklist item
        const firstUncheckedIdx = checklist.findIndex(item => !item.checked);
        if (firstUncheckedIdx >= 0 && checklistRefs.current[firstUncheckedIdx]) {
          checklistRefs.current[firstUncheckedIdx]?.focus();
        }
      } else if (step === 3) {
        // Focus notes textarea
        notesRef.current?.focus();
      } else if (step === 4) {
        // Focus signer name input
        signerNameRef.current?.focus();
      }
    }, 300); // Delay to allow animation
    return () => clearTimeout(focusTimeout);
  }, [step]);

  // Auto-advance focus in checklist when item is checked
  const handleChecklistToggle = (idx: number) => {
    const next = [...checklist];
    next[idx].checked = !next[idx].checked;
    setChecklist(next);
    writeLocalDraft({ safetyChecklist: next });

    // Auto-focus next unchecked item
    if (next[idx].checked) {
      const nextUncheckedIdx = next.findIndex((item, i) => i > idx && !item.checked);
      if (nextUncheckedIdx >= 0 && checklistRefs.current[nextUncheckedIdx]) {
        setTimeout(() => checklistRefs.current[nextUncheckedIdx]?.focus(), 100);
      }
    }
  };

  // Auto-save progress: Save step to localStorage
  // eslint-disable-next-line react-hooks/exhaustive-deps -- clearDraftState closes over job?.id which is tracked via jobId
  useEffect(() => {
    if (job?.id && step < 5) {
      localStorage.setItem(`jobproof_progress_${job.id}`, step.toString());
    } else if (job?.id && step === 5) {
      // Clear progress and draft on completion
      clearDraftState();
    }
  }, [step, jobId]);

  // Auto-save draft state: Persist all form data on change
  // eslint-disable-next-line react-hooks/exhaustive-deps -- saveDraftState closes over job?.id which is tracked via jobId
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

    // Persist to Local DB with proper LocalJob type
    await saveJobLocal({
      ...updatedJob,
      syncStatus: updatedJob.syncStatus || 'pending',
      lastUpdated: Date.now()
    });

    // Queue for Background Sync
    // We send { id, ...fields } to patch
    await queueAction('UPDATE_JOB', { id: job.id, ...fields });

  }, [job, onUpdateJob]);

  // Track location verification status for legal defensibility
  const [locationVerified, setLocationVerified] = useState<boolean>(true);
  const [locationWarning, setLocationWarning] = useState<string | null>(null);

  // Cancel GPS capture and cleanup
  const cancelGpsCapture = useCallback(() => {
    if (gpsWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      gpsWatchIdRef.current = null;
    }
    if (gpsTimeoutRef.current) {
      clearTimeout(gpsTimeoutRef.current);
      gpsTimeoutRef.current = null;
    }
    if (gpsCountdownIntervalRef.current) {
      clearInterval(gpsCountdownIntervalRef.current);
      gpsCountdownIntervalRef.current = null;
    }
    setGpsCountdown(15);
    setLocationStatus('idle');
  }, []);

  const captureLocation = () => {
    // Reset and start countdown
    setGpsCountdown(15);
    setLocationStatus('capturing');

    // Start countdown interval
    gpsCountdownIntervalRef.current = setInterval(() => {
      setGpsCountdown(prev => {
        if (prev <= 1) {
          if (gpsCountdownIntervalRef.current) {
            clearInterval(gpsCountdownIntervalRef.current);
            gpsCountdownIntervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Use watchPosition for better accuracy and cancelability
    gpsWatchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        // Clear the watch once we get a position
        if (gpsWatchIdRef.current !== null) {
          navigator.geolocation.clearWatch(gpsWatchIdRef.current);
          gpsWatchIdRef.current = null;
        }
        if (gpsCountdownIntervalRef.current) {
          clearInterval(gpsCountdownIntervalRef.current);
          gpsCountdownIntervalRef.current = null;
        }
        if (gpsTimeoutRef.current) {
          clearTimeout(gpsTimeoutRef.current);
          gpsTimeoutRef.current = null;
        }

        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;

        // CRITICAL FIX: Use verified location system with audit trail
        const locationResult = await getVerifiedLocation(lat, lng, accuracy);

        setCoords({ lat, lng });
        setW3w(locationResult.w3w);
        setLocationVerified(locationResult.isVerified);
        setLocationWarning(locationResult.warning || null);
        setLocationStatus('captured');
        setGpsCountdown(15);
        writeLocalDraft({
          w3w: locationResult.w3w,
          lat,
          lng,
          locationVerified: locationResult.isVerified,
          locationSource: locationResult.verificationSource,
        });

        // Log location capture with verification status
        if (job) {
          if (locationResult.isVerified) {
            logLocationCapture(
              job.id,
              { lat, lng, accuracy },
              'gps',
              locationResult.w3w,
              true,
              { technicianId: job.techId, technicianName: job.technician }
            );
          } else {
            // Log mock fallback as a warning
            logMockLocationFallback(
              job.id,
              locationResult.w3w,
              { lat, lng },
              { technicianId: job.techId, technicianName: job.technician }
            );
          }
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        // Cleanup
        if (gpsWatchIdRef.current !== null) {
          navigator.geolocation.clearWatch(gpsWatchIdRef.current);
          gpsWatchIdRef.current = null;
        }
        if (gpsCountdownIntervalRef.current) {
          clearInterval(gpsCountdownIntervalRef.current);
          gpsCountdownIntervalRef.current = null;
        }
        setGpsCountdown(15);
        setLocationStatus('denied');
        if (job) {
          logAuditEvent('LOCATION_DENIED', job.id, {
            error: error.message,
            code: error.code,
          });
        }
      },
      // Extended timeout for better GPS accuracy in field conditions
      { timeout: 15000, enableHighAccuracy: true, maximumAge: 0 }
    );

    // Set timeout to handle case where GPS doesn't respond
    gpsTimeoutRef.current = setTimeout(() => {
      if (gpsWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current);
        gpsWatchIdRef.current = null;
      }
      if (gpsCountdownIntervalRef.current) {
        clearInterval(gpsCountdownIntervalRef.current);
        gpsCountdownIntervalRef.current = null;
      }
      setGpsCountdown(15);
      setLocationStatus('denied');
    }, 15000);
  };

  // State for manual location modal
  const [showManualLocationModal, setShowManualLocationModal] = useState(false);

  // State for signature preview and sealing confirmation
  const [showSignaturePreview, setShowSignaturePreview] = useState(false);
  const [signaturePreviewData, setSignaturePreviewData] = useState<string | null>(null);
  const [showSealConfirmation, setShowSealConfirmation] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);

  // Generate signature preview
  const handlePreviewSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      const pixelData = ctx?.getImageData(0, 0, canvas.width, canvas.height).data;
      const isEmpty = pixelData ? !Array.from(pixelData).some(channel => channel !== 0) : true;

      if (isEmpty) {
        showAlert('No Signature', 'Please sign in the box first before previewing.', 'warning');
        return;
      }

      const dataUrl = canvas.toDataURL();
      setSignaturePreviewData(dataUrl);
      setShowSignaturePreview(true);
    }
  }, [showAlert]);

  // Handle seal with confirmation
  const handleSealWithConfirmation = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      const pixelData = ctx?.getImageData(0, 0, canvas.width, canvas.height).data;
      const isEmpty = pixelData ? !Array.from(pixelData).some(channel => channel !== 0) : true;

      if (isEmpty) {
        showAlert('Signature Required', 'Please sign the canvas before sealing.', 'warning');
        return;
      }

      if (!signerName || signerName.trim().length < 2) {
        showAlert('Name Required', 'Please enter the full name of the person signing.', 'warning');
        return;
      }

      if (photos.length === 0) {
        showAlert('Evidence Required', 'At least one photo must be captured before sealing.', 'warning');
        return;
      }

      // Show confirmation
      setShowSealConfirmation(true);
    }
  }, [showAlert, signerName, photos.length]);
  const [manualLatInput, setManualLatInput] = useState('');
  const [manualLngInput, setManualLngInput] = useState('');

  const manualLocationEntry = () => {
    // Show warning about unverified location using styled confirm
    showConfirm(
      'Manual Location Entry',
      'Manual location entry is UNVERIFIED. This will be flagged in the audit trail and may reduce the legal defensibility of this evidence. Only proceed if GPS is unavailable.',
      () => {
        setManualLatInput('');
        setManualLngInput('');
        setShowManualLocationModal(true);
      },
      { variant: 'warning', confirmLabel: 'Enter Manually', cancelLabel: 'Cancel' }
    );
  };

  const submitManualLocation = () => {
    const lat = parseFloat(manualLatInput);
    const lng = parseFloat(manualLngInput);

    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      // Create manual location result (flagged as unverified)
      const locationResult = createManualLocationResult(lat, lng);

      setCoords({ lat, lng });
      setW3w(locationResult.w3w);
      setLocationVerified(false);
      setLocationWarning(locationResult.warning || 'Manual entry - unverified');
      setLocationStatus('captured');
      writeLocalDraft({
        w3w: locationResult.w3w,
        lat,
        lng,
        locationVerified: false,
        locationSource: 'manual',
      });

      // Log manual location entry
      if (job) {
        logLocationCapture(
          job.id,
          { lat, lng },
          'manual',
          locationResult.w3w,
          false,
          { technicianId: job.techId, technicianName: job.technician }
        );
      }

      setShowManualLocationModal(false);
    } else {
      showAlert('Invalid Coordinates', 'Latitude must be -90 to 90, longitude must be -180 to 180.', 'danger');
    }
  };

  // Track previous signature hash for audit trail
  const [, setPreviousSignatureHash] = useState<string | null>(null);

  const clearSignature = () => {
    // CRITICAL FIX: Require confirmation before clearing signature using styled dialog
    showConfirm(
      'Clear Signature?',
      'This action will be logged in the audit trail. The customer will need to sign again.',
      async () => {
        const canvas = canvasRef.current;
        if (canvas) {
          // Calculate hash of current signature before clearing (for audit trail)
          const currentSignatureData = canvas.toDataURL();
          const currentHash = await calculateDataUrlHash(currentSignatureData);

          // Log signature clearing event
          if (job) {
            logSignatureCleared(
              job.id,
              currentHash,
              'User requested signature clear',
              { technicianId: job.techId, technicianName: job.technician }
            );
          }

          setPreviousSignatureHash(currentHash);

          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.beginPath();
          }
        }
      },
      { variant: 'warning', confirmLabel: 'Clear Signature', cancelLabel: 'Keep' }
    );
  };

  const calculatePhotoHash = async (dataUrl: string): Promise<string> => {
    // Convert base64 to ArrayBuffer
    const base64Data = dataUrl.split(',')[1];
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Calculate SHA-256 hash
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !job) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const dataUrl = reader.result as string;
        const photoId = secureRandomString(9);
        const mediaKey = `media_${photoId}`;

        // 1. Calculate SHA-256 hash of photo data
        const photoHash = await calculatePhotoHash(dataUrl);

        // 2. Store full Base64 in Dexie (Local DB)
        await saveMediaLocal(mediaKey, job.id, dataUrl);

        // 3. Create Photo Object (Lightweight)
        const newPhoto: Photo = {
          id: photoId,
          url: mediaKey, // Key reference
          timestamp: new Date().toISOString(),
          verified: locationVerified, // Track if location was verified
          syncStatus: 'pending',
          type: activePhotoType,
          w3w: w3w || undefined,
          w3w_verified: locationVerified, // Track W3W verification status
          lat: coords.lat,
          lng: coords.lng,
          isIndexedDBRef: true,
          photo_hash: photoHash,
          photo_hash_algorithm: 'SHA-256'
        };

        // CRITICAL: Log photo capture with hash for audit trail
        logPhotoCapture(
          job.id,
          photoId,
          photoHash,
          activePhotoType,
          { lat: coords.lat, lng: coords.lng },
          { technicianId: job.techId, technicianName: job.technician }
        );

        const nextPhotos = [...photos, newPhoto];
        setPhotos(nextPhotos);

        // Haptic feedback + celebration for successful photo capture
        hapticSuccess();
        showToast(`Photo ${nextPhotos.length} captured!`, 'success', 2000);

        // Confetti celebration on milestone photos (1st, 5th, 10th)
        if (nextPhotos.length === 1 || nextPhotos.length === 5 || nextPhotos.length === 10) {
          celebrateSuccess();
        }

        // 4. Cache for display
        setPhotoDataUrls(prev => new Map(prev).set(photoId, dataUrl));

        // 5. Update Job with new photo list
        writeLocalDraft({ photos: nextPhotos });

        // 6. Queue Background Upload
        // We rely on the Sync Engine to read the blob from Dexie using the ID
        await queueAction('UPLOAD_PHOTO', { id: mediaKey, jobId: job.id });

      } catch (error) {
        console.error('Failed to save photo to IndexedDB:', error);
        showAlert('Storage Full', 'Failed to save photo. Your device storage may be full. Please free up space and try again.', 'danger');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFinalSeal = async () => {
    if (!job) return;

    // Phase C.3: Validate sealing requirements
    const sealCheck = canSealJob({ ...job, photos, signature: signerName });

    if (!sealCheck.canSeal) {
      showAlert('Cannot Seal Job', sealCheck.reasons?.join('\n') || 'Job requirements not met', 'warning');
      return;
    }

    // Critical Validation: Enforce audit spec requirements
    if (photos.length === 0) {
      showAlert('Evidence Required', 'At least one photo must be captured before sealing the job.', 'warning');
      return;
    }

    if (!signerName || signerName.trim() === '') {
      showAlert('Name Required', 'Please enter the full legal name of the person signing.', 'warning');
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
        showAlert('Signature Required', 'Please sign the canvas before submitting.', 'warning');
        setIsSubmitting(false);
        return;
      }
    }

    const signatureKey = signatureData ? `sig_${job?.id}` : null;

    // CRITICAL FIX: Calculate signature hash for tamper detection
    let signatureHash: string | undefined;
    if (signatureData) {
      signatureHash = await calculateDataUrlHash(signatureData);

      // Log signature capture with hash for audit trail
      logSignatureCapture(
        job.id,
        signatureHash,
        signerName,
        signerRole,
        { technicianId: job.techId, technicianName: job.technician }
      );
    }

    // Store full signature Base64 in IndexedDB
    if (signatureData && signatureKey) {
      try {
        await saveMediaLocal(signatureKey, job.id, signatureData);
      } catch (error) {
        console.error('Failed to save signature to IndexedDB:', error);
        showAlert('Storage Full', 'Failed to save signature. Your device storage may be full. Please free up space and try again.', 'danger');
        setIsSubmitting(false);
        return;
      }
    }

    // First, update job with final evidence data
    const updatedJob: Job = {
      ...job,
      status: 'Submitted', // Set to Submitted for sealing validation
      photos,
      notes,
      signature: signatureKey,
      signatureIsIndexedDBRef: !!signatureKey,
      signatureHash, // CRITICAL: Store signature hash for tamper detection
      signerName,
      signerRole,
      safetyChecklist: checklist,
      completedAt: new Date().toISOString(),
      locationVerified, // Track if location was verified by W3W API
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

      // CRITICAL FIX: Wait for photo sync before sealing
      const unsyncedPhotos = getUnsyncedPhotos(photos);

      if (unsyncedPhotos.length > 0) {

        // Show sync modal
        const syncModal = createSyncStatusModal(unsyncedPhotos.length);

        setIsSyncing(true);

        // Wait for sync with extended timeout (5 minutes for field conditions)
        // CRITICAL FIX: Extended from 2 minutes to 5 minutes for poor network conditions
        const syncTimeout = 300000; // 5 minutes
        const unsyncedPhotoIds = unsyncedPhotos.map(p => p.id);

        const syncPromise = waitForPhotoSync(unsyncedPhotoIds, job.id);
        const timeoutPromise = new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Sync timeout')), syncTimeout)
        );

        try {
          // Poll for progress updates
          const progressInterval = setInterval(async () => {
            const currentJob = await getJobLocal(job.id);
            if (currentJob) {
              const syncedCount = unsyncedPhotoIds.filter(photoId => {
                const photo = currentJob.photos.find(p => p.id === photoId);
                return photo && photo.syncStatus === 'synced' && !photo.isIndexedDBRef;
              }).length;
              syncModal.update(syncedCount);
            }
          }, 1000);

          await Promise.race([syncPromise, timeoutPromise]);

          clearInterval(progressInterval);
          syncModal.close();
          setIsSyncing(false);

        } catch (error) {
          console.error('[Seal] Sync timeout or error:', error);
          syncModal.close();
          setIsSyncing(false);
          setIsSubmitting(false);

          showAlert(
            'Sync In Progress',
            'Photos are still syncing to the cloud. This may be due to poor network connection.\n\nPlease wait for sync to complete before sealing the job. Your data is saved locally.\n\nYou can wait and try again, or move to an area with better signal.',
            'warning'
          );
          return;
        }
      }

      // Phase C.3: Call server-side cryptographic sealing
      const sealResult = await sealEvidence(job.id);

      if (!sealResult.success) {
        showAlert(
          'Sealing Failed',
          `${sealResult.error}\n\nJob data has been saved but not sealed. You can try sealing again from the admin dashboard.`,
          'danger'
        );
        setIsSubmitting(false);
        return;
      }

      // Update job with seal metadata
      // Use status from sealResult for consistency with sealing.ts (defaults to 'Submitted')
      const sealedJob: Job = {
        ...updatedJob,
        status: (sealResult.job_status as JobStatus) || 'Submitted',
        sealedAt: sealResult.sealedAt,
        evidenceHash: sealResult.evidenceHash,
        isSealed: true
      };

      onUpdateJob(sealedJob);

      // Generate client receipt for self-employed mode
      const techMetadata = job.techMetadata;
      const isSelfEmployed = job.selfEmployedMode || techMetadata?.creationOrigin === 'self_employed';
      if (isSelfEmployed) {
        generateClientReceipt(sealedJob);
      }

      // Notify manager of sealed job via unified notification service
      notifyJobSealed(
        job.workspaceId || 'local',
        job.id,
        job.title,
        job.technician || 'Technician',
        job.client || 'Client'
      );

      // Legacy notification for technician-initiated jobs
      if (techMetadata?.creationOrigin === 'technician') {
        notifyManagerOfTechJob(
          job.workspaceId || 'local',
          job.id,
          job.title,
          techMetadata.createdByTechId || 'unknown',
          techMetadata.createdByTechName || 'Technician',
          'tech_job_completed'
        );
      }

      // Show success with haptic feedback and celebration
      hapticConfirm();

      // 🎉 Major milestone - Celebrate with confetti!
      celebrateSuccess();
      showToast('Evidence sealed with RSA-2048 encryption!', 'success', 4000);

      setTimeout(() => {
        setIsSubmitting(false);
        setStep(5);
      }, 1000);
    } catch (error) {
      console.error('Sealing error:', error);
      hapticWarning();
      showAlert('Sealing Failed', 'Failed to seal evidence. Please try again or contact support.', 'danger');
      setIsSubmitting(false);
    }
  };

  // Show onboarding for first-time users
  if (showOnboarding) {
    return (
      <TechnicianOnboarding
        onComplete={() => setShowOnboarding(false)}
        onSkip={() => setShowOnboarding(false)}
      />
    );
  }

  // Quick Job Form Modal
  if (showQuickJobForm) {
    return (
      <QuickJobForm
        techId="field-tech"
        techName="Field Technician"
        workspaceId="local"
        onJobCreated={handleQuickJobCreated}
        onCancel={() => setShowQuickJobForm(false)}
      />
    );
  }

  // Loading state
  if (isLoadingJob) {
    return (
      <Layout isAdmin={false}>
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-8">
          <div className="size-20 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm font-semibold tracking-widest">Loading Job...</p>
        </div>
      </Layout>
    );
  }

  // Token validation error - Explicit error messages by type
  if (tokenError) {
    const errorConfig = {
      expired: {
        icon: 'schedule',
        title: 'Link Expired',
        message: 'This job link has expired. Magic links are valid for 7 days.',
        action: 'Contact your manager for a new link.',
        colour: 'warning'
      },
      sealed: {
        icon: 'lock',
        title: 'Job Already Sealed',
        message: 'This job has been completed and sealed. Evidence is now immutable.',
        action: 'Contact your manager if you need to view the sealed report.',
        colour: 'success'
      },
      invalid: {
        icon: 'link_off',
        title: 'Invalid Link',
        message: 'This link is invalid or has been corrupted.',
        action: 'Please request a new magic link from your manager.',
        colour: 'danger'
      },
      not_found: {
        icon: 'search_off',
        title: 'Job Not Found',
        message: 'The job associated with this link could not be found.',
        action: 'The job may have been deleted. Contact your manager.',
        colour: 'danger'
      }
    };

    const config = errorConfig[tokenErrorType || 'invalid'];

    return (
      <Layout isAdmin={false}>
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-8 animate-in">
          <div className={`size-32 rounded-[2.5rem] bg-${config.colour}/10 flex items-center justify-center border border-white/15 shadow-2xl relative`}>
            <span className={`material-symbols-outlined text-7xl font-black text-${config.colour}`}>{config.icon}</span>
          </div>
          <div className="space-y-3">
            <h2 className={`text-4xl font-black text-white uppercase tracking-tighter leading-none`}>{config.title}</h2>
            <p className="text-slate-300 text-sm max-w-[420px] mx-auto font-medium leading-relaxed">{config.message}</p>
            <div className="bg-slate-900 border border-white/15 rounded-2xl p-4 mt-4">
              <p className="text-xs text-primary font-bold uppercase tracking-wide">{config.action}</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button onClick={() => navigate('/home')} className="w-full py-5 bg-white/10 px-8 rounded-2xl font-black text-xs uppercase tracking-[0.3em] border border-white/15 hover:bg-white/10 transition-all shadow-xl min-h-[48px]">Return to Home</button>
            <button
              onClick={() => setShowQuickJobForm(true)}
              className="w-full py-5 bg-primary px-8 rounded-2xl font-black text-xs uppercase tracking-[0.3em] text-white shadow-xl shadow-primary/20 min-h-[48px] flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-base">add</span>
              Create Quick Job
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // Job not found (legacy fallback)
  if (!job) {
    return (
      <Layout isAdmin={false}>
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-8 animate-in">
          <div className="size-32 rounded-[2.5rem] bg-danger/10 text-danger flex items-center justify-center border border-white/15 shadow-2xl relative">
            <span className="material-symbols-outlined text-7xl font-black text-danger">error</span>
          </div>
          <div className="space-y-3">
            <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none text-danger">Job Not Found</h2>
            <p className="text-slate-400 text-sm max-w-[420px] mx-auto font-medium leading-relaxed">The job ID in this link is invalid or has been removed. Please check the URL or contact your administrator for a valid magic link.</p>
          </div>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button onClick={() => navigate('/home')} className="w-full py-5 bg-white/10 px-8 rounded-2xl font-black text-xs uppercase tracking-[0.3em] border border-white/15 hover:bg-white/10 transition-all shadow-xl">Return to Home</button>
            <button
              onClick={() => setShowQuickJobForm(true)}
              className="w-full py-5 bg-primary px-8 rounded-2xl font-black text-xs uppercase tracking-[0.3em] text-white shadow-xl shadow-primary/20 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-base">add</span>
              Create Quick Job
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // UAT Fix #12: Job sealed success screen with email/PDF options
  if (step === 5) {
    // Generate report URL for sharing
    const reportUrl = job ? `${window.location.origin}/#/admin/report/${job.id}` : '';

    // Email the report
    const handleEmailReport = () => {
      if (!job) return;
      const subject = encodeURIComponent(`Job Completion Report: ${job.title}`);
      const body = encodeURIComponent(
        `Job Completion Report\n\n` +
        `Job: ${job.title}\n` +
        `Client: ${job.client}\n` +
        `Address: ${job.address}\n` +
        `Status: Sealed & Complete\n` +
        `Completed: ${job.completedAt ? new Date(job.completedAt).toLocaleDateString() : 'N/A'}\n\n` +
        `Evidence Hash: ${job.evidenceHash || 'N/A'}\n\n` +
        `View full report:\n${reportUrl}\n\n` +
        `---\n` +
        `This job has been cryptographically sealed. Evidence is immutable and tamper-evident.`
      );
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
    };

    // Print/PDF the report
    const handlePrintReport = () => {
      if (!job) return;
      // Navigate to report page and trigger print
      window.open(`/#/admin/report/${job.id}?print=true`, '_blank');
    };

    // Share the report
    const handleShareReport = async () => {
      if (!job) return;
      if (typeof navigator !== 'undefined' && 'share' in navigator) {
        try {
          await navigator.share({
            title: `Job Report: ${job.title}`,
            text: `Completed job report for ${job.client}`,
            url: reportUrl,
          });
        } catch (err) {
          // Fallback to copy
          if ('clipboard' in navigator) {
            (navigator.clipboard as Clipboard).writeText(reportUrl);
            showAlert('Copied!', 'Report link copied to clipboard.', 'info');
          }
        }
      } else {
        const nav = navigator as Navigator & { clipboard?: Clipboard };
        if (nav.clipboard) {
          nav.clipboard.writeText(reportUrl);
          showAlert('Copied!', 'Report link copied to clipboard.', 'info');
        }
      }
    };

    return (
      <Layout isAdmin={false}>
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-8 animate-in px-4">
          <div className="size-32 rounded-[2.5rem] bg-success/10 text-success flex items-center justify-center border border-white/15 shadow-2xl relative animate-success-pop">
            <span className="material-symbols-outlined text-7xl font-black text-success">verified</span>
          </div>
          <div className="space-y-3">
            <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none text-success">Job Sealed</h2>
            <p className="text-slate-400 text-sm max-w-[320px] mx-auto font-medium leading-relaxed uppercase tracking-tight">Evidence bundle committed to local persistence and queued for hub synchronization.</p>
            {job?.evidenceHash && (
              <div className="bg-slate-900 border border-white/10 rounded-xl p-3 mt-4">
                <p className="text-[9px] text-slate-400 uppercase tracking-wide">Evidence Hash</p>
                <p className="text-[10px] font-mono text-success truncate">{job.evidenceHash}</p>
              </div>
            )}
          </div>

          {/* UAT Fix #12: Report sharing options */}
          <div className="w-full max-w-xs space-y-3">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Share Report</p>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={handleEmailReport}
                className="py-3 bg-white/10 hover:bg-white/10 rounded-xl flex flex-col items-center justify-center gap-1 transition-all border border-white/15"
                title="Send report via email"
              >
                <span className="material-symbols-outlined text-primary text-xl">email</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">Email</span>
              </button>
              <button
                onClick={handlePrintReport}
                className="py-3 bg-white/10 hover:bg-white/10 rounded-xl flex flex-col items-center justify-center gap-1 transition-all border border-white/15"
                title="Print or save as PDF"
              >
                <span className="material-symbols-outlined text-primary text-xl">print</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">PDF</span>
              </button>
              <button
                onClick={handleShareReport}
                className="py-3 bg-white/10 hover:bg-white/10 rounded-xl flex flex-col items-center justify-center gap-1 transition-all border border-white/15"
                title="Share report link"
              >
                <span className="material-symbols-outlined text-primary text-xl">share</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">Share</span>
              </button>
              <button
                onClick={() => setShowCertificate(true)}
                className="py-3 bg-success/10 hover:bg-success/20 rounded-xl flex flex-col items-center justify-center gap-1 transition-all border border-success/30"
                title="Download seal certificate"
              >
                <span className="material-symbols-outlined text-success text-xl">verified</span>
                <span className="text-[9px] font-bold text-success uppercase">Cert</span>
              </button>
            </div>
          </div>

          {/* Seal Certificate Modal */}
          {job && (
            <SealCertificate
              job={job}
              isOpen={showCertificate}
              onClose={() => setShowCertificate(false)}
            />
          )}

          <button onClick={() => navigate('/home')} className="w-full max-w-xs py-5 bg-white/10 px-8 rounded-2xl font-black text-xs uppercase tracking-[0.3em] border border-white/15 hover:bg-white/10 transition-all shadow-xl">Return to Hub</button>
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
        {/* Job Date Warning Banner */}
        {jobDateWarning === 'future' && (
          <InfoBox
            icon="event"
            title="Scheduled for a Future Date"
            variant="info"
            dismissible={false}
          >
            This job is scheduled for a future date. You can review details now, but consider waiting until the scheduled time.
          </InfoBox>
        )}
        {jobDateWarning === 'overdue' && (
          <InfoBox
            icon="warning"
            title={`Job Overdue (${overdueByDays} ${overdueByDays === 1 ? 'day' : 'days'} late)`}
            variant="warning"
            dismissible={false}
          >
            This job was scheduled for an earlier date. You can still complete it, but please submit as soon as possible.
          </InfoBox>
        )}

        {/* Visual Sync Queue Status */}
        {photos.some(p => p.syncStatus === 'pending') && (
          <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-4 animate-in">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="size-3 bg-primary rounded-full animate-pulse"></div>
                <p className="text-xs font-bold text-white uppercase tracking-wide">Photo Upload Queue</p>
              </div>
              <span className="text-[10px] text-slate-400">
                {photos.filter(p => p.syncStatus === 'synced' || !p.isIndexedDBRef).length}/{photos.length} synced
              </span>
            </div>
            <div className="flex gap-1">
              {photos.map(p => (
                <div
                  key={p.id}
                  className={`flex-1 h-2 rounded-full transition-all ${
                    p.syncStatus === 'synced' || !p.isIndexedDBRef
                      ? 'bg-success'
                      : p.syncStatus === 'syncing'
                      ? 'bg-primary animate-pulse'
                      : 'bg-slate-700'
                  }`}
                  title={`${p.type}: ${p.syncStatus || 'pending'}`}
                />
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-2">Photos saved locally and uploading in background</p>
          </div>
        )}

        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h2 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] flex items-center gap-2 mb-1">
              JOB REF: {job.id}
            </h2>
            <h3 className="text-3xl font-bold text-white tracking-tight leading-none">{job.title}</h3>
            <p className="text-xs text-slate-300 font-medium tracking-tight">{job.client} • {job.address}</p>
          </div>
          <div className="text-right flex items-center gap-3">
            <button
              onClick={() => {
                saveDraftState({ step, photos, checklist, notes, signerName, signerRole, w3w, coords, locationStatus, locationVerified });
                showAlert('Progress Saved', 'Your work has been saved locally. You can close this page and return via the same link to continue.', 'info');
              }}
              className="size-10 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              aria-label="Save Progress"
              title="Save & Exit Later"
            >
              <span className="material-symbols-outlined text-lg">save</span>
            </button>
            <button
              onClick={() => setShowHelp(true)}
              className="size-10 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              aria-label="Help"
            >
              <span className="material-symbols-outlined text-lg">help</span>
            </button>
            <div className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${isOnline ? 'bg-success animate-pulse' : 'bg-warning'}`}></span>
              <p className={`text-[10px] font-black uppercase tracking-widest ${isOnline ? 'text-success' : 'text-warning'}`}>{isOnline ? 'Online' : 'Offline'}</p>
            </div>
          </div>
        </div>

        {step > 0 && step < 5 && (
          <div className="space-y-3">
            {/* Step counter */}
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-primary uppercase tracking-widest">
                Step {step} of 4
              </p>
              <p className="text-[10px] text-slate-400">
                {step === 1 && 'Safety & Location'}
                {step === 2 && 'Capture Evidence'}
                {step === 3 && 'Review Summary'}
                {step === 4 && 'Final Sign-off'}
              </p>
            </div>
            <div className="flex gap-2">
            {['Access', 'Evidence', 'Summary', 'Sign-off'].map((label, idx) => {
              const stepNum = idx + 1;
              const isCompleted = step > stepNum;
              const isLocked = maxCompletedStep >= stepNum && step !== stepNum;
              const isCurrent = step === stepNum;
              return (
                <div key={label} className="flex-1 space-y-2">
                  <div className={`h-1.5 rounded-full transition-all duration-500 ${isCompleted ? (isLocked ? 'bg-slate-500' : 'bg-primary shadow-[0_0_8px_rgba(37,99,235,0.4)]') : 'bg-slate-800'}`} />
                  <div className="flex items-center justify-center gap-1">
                    {isLocked && <span className="material-symbols-outlined text-[8px] text-slate-400">lock</span>}
                    <p className={`text-[8px] font-black uppercase tracking-widest text-center ${isCurrent ? 'text-primary' : isLocked ? 'text-slate-400' : 'text-slate-400'}`}>{label}</p>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        )}

        {step === 0 && (
          <div className="space-y-8 animate-in">
            <header className="space-y-3 text-center">
              <div className="bg-primary/20 size-20 rounded-[2.5rem] flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-primary text-5xl font-black">assignment</span>
              </div>
              <h2 className="text-4xl font-semibold tracking-tight leading-none text-white">Job Assignment</h2>
              <p className="text-slate-400 text-sm font-normal tracking-tight max-w-md mx-auto">Review the job details before you start.</p>
            </header>

            <div className="bg-slate-900 border border-white/15 rounded-[3rem] overflow-hidden shadow-2xl">
              <div className="px-8 py-6 border-b border-white/15 bg-white/[0.02]">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Job Details</p>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Service Description</p>
                  <p className="text-2xl font-bold text-white tracking-tight">{job.title}</p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Client</p>
                    <p className="text-sm font-medium text-white">{job.client}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Reference</p>
                    <p className="text-sm font-mono text-primary font-black">{job.id}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Location</p>
                  <div className="bg-slate-800 p-4 rounded-2xl border border-white/15">
                    <p className="text-sm font-medium text-white tracking-tight leading-relaxed">{job.address}</p>
                  </div>
                </div>

                {job.notes && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Special Instructions</p>
                    <div className="bg-warning/10 border border-warning/20 p-4 rounded-2xl">
                      <p className="text-sm text-white tracking-tight leading-relaxed">{job.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-900 border border-white/15 rounded-[2.5rem] p-8">
              <div className="flex items-center gap-4 mb-6">
                <span className="material-symbols-outlined text-primary text-2xl font-black">info</span>
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">What You Need To Do</p>
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
              className="w-full py-7 bg-primary rounded-[3rem] font-black text-xl tracking-tighter text-white shadow-[0_20px_40px_-12px_rgba(37,99,235,0.4)] flex items-center justify-center gap-4 transition-all active:scale-95 press-spring uppercase"
            >
              <span className="material-symbols-outlined text-3xl font-black">play_arrow</span>
              Start Job
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-8 animate-in">
            <header className="space-y-2">
              <h2 className="text-3xl font-semibold tracking-tight leading-none text-white">Safety Check</h2>
              <p className="text-slate-400 text-sm font-normal tracking-tight">Verify your location and complete the safety checklist.</p>
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
                    locationStatus === 'denied' ? 'bg-warning/20' : 'bg-white/10'
                    }`}>
                    <span className="material-symbols-outlined text-2xl font-black">
                      {locationStatus === 'captured' ? 'near_me' : locationStatus === 'denied' ? 'location_disabled' : 'my_location'}
                    </span>
                  </div>
                  <div className="text-left">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                      Location
                      {locationStatus === 'captured' && (
                        <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold ${
                          locationVerified
                            ? 'bg-success/20 text-success'
                            : 'bg-warning/20 text-warning'
                        }`}>
                          {locationVerified ? 'GPS Verified' : 'Manual/Unverified'}
                        </span>
                      )}
                    </p>
                    <div className="flex flex-col mt-0.5">
                      <div className="flex items-center gap-2">
                        {locationStatus === 'captured' && <span className="text-red-500 font-black text-xs">{'///'}</span>}
                        <p className={`text-[10px] font-black uppercase tracking-widest ${locationStatus === 'captured' ? 'text-white' : 'opacity-60'}`}>
                          {locationStatus === 'captured' ? w3w.replace('///', '') :
                            locationStatus === 'capturing' ? `Acquiring Signal... ${gpsCountdown}s` :
                              locationStatus === 'denied' ? 'Permission Denied' : 'Tap to Get Location'}
                        </p>
                      </div>
                      {locationStatus === 'captured' && coords.lat && (
                        <p className="text-[8px] font-mono text-slate-300 uppercase">GPS: {coords.lat.toFixed(6)}, {coords.lng?.toFixed(6)}</p>
                      )}
                      {locationStatus === 'captured' && locationWarning && (
                        <p className="text-[8px] text-warning mt-1">{locationWarning}</p>
                      )}
                    </div>
                  </div>
                </div>
                {locationStatus === 'captured' && <span className="material-symbols-outlined text-success font-black">check_circle</span>}
                {locationStatus === 'denied' && <span className="material-symbols-outlined text-warning font-black">error</span>}
                {locationStatus === 'capturing' && (
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                  </div>
                )}
              </button>

              {/* GPS Capture Progress with Cancel */}
              {locationStatus === 'capturing' && (
                <div className="bg-primary/10 border border-primary/30 rounded-[2rem] p-5 space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative size-12">
                        <svg className="size-12 -rotate-90">
                          <circle
                            cx="24"
                            cy="24"
                            r="20"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="4"
                            className="text-slate-700"
                          />
                          <circle
                            cx="24"
                            cy="24"
                            r="20"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="4"
                            strokeDasharray={2 * Math.PI * 20}
                            strokeDashoffset={2 * Math.PI * 20 * (1 - gpsCountdown / 15)}
                            className="text-primary transition-all duration-1000"
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-primary">
                          {gpsCountdown}
                        </span>
                      </div>
                      <div>
                        <p className="text-[11px] font-black text-primary uppercase tracking-tight">Acquiring GPS Signal</p>
                        <p className="text-[9px] text-slate-400 uppercase tracking-tight">Please wait while we verify your location</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        cancelGpsCapture();
                      }}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl text-[10px] font-black text-slate-300 uppercase tracking-wider transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

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
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest pl-2">Safety Checklist</p>
                {checklist.map((item, idx) => (
                  <button
                    key={item.id}
                    ref={(el) => { checklistRefs.current[idx] = el; }}
                    onClick={() => handleChecklistToggle(idx)}
                    className={`w-full flex items-center gap-4 p-5 rounded-[1.5rem] border transition-all text-left focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-slate-950 ${item.checked ? 'bg-primary/5 border-primary/30 text-white' : 'bg-slate-900 border-white/15 text-slate-300'}`}
                  >
                    <span className="material-symbols-outlined text-2xl font-black">
                      {item.checked ? 'check_box' : 'check_box_outline_blank'}
                    </span>
                    <span className="text-xs font-medium tracking-tight">{item.label}</span>
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
              Continue
              <span className="material-symbols-outlined font-black">arrow_forward</span>
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8 animate-in">
            <header className="space-y-2">
              <h2 className="text-3xl font-semibold tracking-tight leading-none text-white">Photos</h2>
              <p className="text-slate-400 text-sm font-normal tracking-tight">Take photos before, during, and after the work.</p>
            </header>

            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
              {(['Before', 'During', 'After', 'Evidence'] as PhotoType[]).map(type => (
                <button
                  key={type}
                  onClick={() => setActivePhotoType(type)}
                  className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border transition-all whitespace-nowrap ${activePhotoType === type ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'}`}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-5">
              <input type="file" accept="image/*" capture="environment" className="hidden" ref={fileInputRef} onChange={onFileSelect} />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-[2.5rem] border-2 border-dashed border-primary/40 bg-primary/5 flex flex-col items-center justify-center gap-4 text-primary group active:scale-95 press-spring transition-all min-h-[44px]"
                aria-label={`Capture ${activePhotoType} photo`}
              >
                <div className="size-14 bg-primary/10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110">
                  <span className="material-symbols-outlined text-4xl font-black" aria-hidden="true">add_a_photo</span>
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
                      <button
                        onClick={() => confirmDeletePhoto(p)}
                        className="w-full min-h-[44px] py-2 bg-black/80 backdrop-blur-md hover:bg-black/90 text-white text-[9px] font-black uppercase tracking-widest rounded-xl border border-white/10 transition-colors"
                        aria-label="Delete photo capture"
                      >
                        Delete Capture
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-5 rounded-3xl font-black text-[10px] uppercase tracking-[0.2em] transition-all bg-slate-900 border border-white/10 text-white hover:bg-slate-800"
              >
                Back to Safety
              </button>
              <button
                disabled={photos.length === 0}
                onClick={() => setStep(3)}
                className="flex-[2] py-5 bg-primary rounded-3xl font-black text-xs uppercase tracking-[0.2em] text-white shadow-2xl shadow-primary/30 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-8 animate-in">
            <header className="space-y-2">
              <h2 className="text-3xl font-semibold tracking-tight leading-none text-white">Job Summary</h2>
              <p className="text-slate-400 text-sm font-normal tracking-tight">Review operational notes and evidence before sign-off.</p>
            </header>

            <div className="space-y-6">
              <div className="bg-slate-900 border border-white/10 p-8 rounded-[3rem] space-y-4 shadow-2xl">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Operational Narrative</p>
                <textarea
                  ref={notesRef}
                  value={notes}
                  onChange={(e) => { setNotes(e.target.value); writeLocalDraft({ notes: e.target.value }); }}
                  placeholder="Summarize the work completed for the client's review..."
                  className="w-full bg-slate-800 border-slate-600 rounded-[1.5rem] p-6 text-white text-sm min-h-[160px] focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-slate-950 outline-none transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="bg-slate-900 border border-white/10 p-8 rounded-[2.5rem] space-y-4">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Evidence Distribution</p>
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
                    <p className="text-[10px] text-slate-400 leading-relaxed uppercase tracking-tight">Return to Photos to capture at least one photo before proceeding to sign-off.</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-5 rounded-3xl font-black text-[10px] uppercase tracking-[0.2em] transition-all bg-slate-900 border border-white/10 text-white hover:bg-slate-800"
              >
                Back to Photos
              </button>
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
              <h2 className="text-3xl font-semibold tracking-tight leading-none text-white">Sign Off</h2>
              <p className="text-slate-400 text-sm font-normal tracking-tight">Get the client to sign and confirm the work is complete.</p>
            </header>

            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="tech-signer-name" className="text-[10px] font-black text-slate-300 uppercase tracking-widest pl-2">Signatory Identification</label>
                <input
                  id="tech-signer-name"
                  ref={signerNameRef}
                  type="text"
                  placeholder="Full Legal Name"
                  value={signerName}
                  onChange={e => setSignerName(e.target.value)}
                  className="w-full bg-slate-900 border-white/10 border rounded-3xl p-5 text-white outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-slate-950 transition-all uppercase font-bold text-xs"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="tech-signer-role" className="text-[10px] font-black text-slate-300 uppercase tracking-widest pl-2">Authorisation Role</label>
                <select
                  id="tech-signer-role"
                  value={signerRole}
                  onChange={e => setSignerRole(e.target.value)}
                  className="w-full bg-slate-900 border-white/10 border rounded-3xl p-5 text-white outline-none focus:border-primary uppercase font-black text-[10px] appearance-none cursor-pointer"
                >
                  <option value="Client">Client / Property Owner</option>
                  <option value="Manager">On-Site Manager</option>
                  <option value="Agent">Authorized Representative</option>
                </select>
              </div>
            </div>

            {/* UX Flow Contract: Attestation checkbox - REQUIRED before sealing */}
            <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-4">
              {/* eslint-disable-next-line jsx-a11y/label-has-associated-control -- htmlFor matches sr-only input */}
              <label htmlFor="attestation-confirmed" className="flex items-start gap-4 cursor-pointer group">
                <span className="sr-only">I confirm I am satisfied with the work completed</span>
                <div className="relative flex-shrink-0 mt-0.5">
                  <input
                    id="attestation-confirmed"
                    type="checkbox"
                    checked={attestationConfirmed}
                    onChange={(e) => setAttestationConfirmed(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="size-6 rounded-lg border-2 border-slate-600 bg-slate-800 peer-checked:bg-success peer-checked:border-success transition-all flex items-center justify-center">
                    {attestationConfirmed && (
                      <span className="material-symbols-outlined text-white text-sm font-black">check</span>
                    )}
                  </div>
                </div>
                <div className="flex-1" aria-hidden="true">
                  <p className="text-xs font-bold text-white leading-relaxed">
                    I confirm I am satisfied with the work completed
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                    By signing below, the signatory acknowledges that the work described has been completed to their satisfaction.
                  </p>
                </div>
              </label>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 rounded-[3rem] p-8 border-4 border-slate-900 shadow-2xl relative">
                <p className="text-[9px] font-black text-slate-300 absolute top-4 inset-x-0 text-center uppercase tracking-[0.3em] pointer-events-none">JobProof Secure Sign-Off</p>
                <div className="h-60 relative border-2 border-dashed border-slate-200 rounded-3xl overflow-hidden bg-white/60 shadow-inner">
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={240}
                    className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
                    style={{ touchAction: 'none' }}
                    onMouseDown={(e) => {
                      isDrawing.current = true;
                      const canvas = canvasRef.current;
                      const ctx = canvas?.getContext('2d');
                      if (ctx && canvas) {
                        const rect = canvas.getBoundingClientRect();
                        const scaleX = canvas.width / rect.width;
                        const scaleY = canvas.height / rect.height;
                        ctx.beginPath();
                        ctx.moveTo(e.nativeEvent.offsetX * scaleX, e.nativeEvent.offsetY * scaleY);
                      }
                    }}
                    onMouseMove={(e) => {
                      if (!isDrawing.current) return;
                      const canvas = canvasRef.current;
                      const ctx = canvas?.getContext('2d');
                      if (ctx && canvas) {
                        const rect = canvas.getBoundingClientRect();
                        const scaleX = canvas.width / rect.width;
                        const scaleY = canvas.height / rect.height;
                        ctx.strokeStyle = '#020617'; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
                        ctx.lineTo(e.nativeEvent.offsetX * scaleX, e.nativeEvent.offsetY * scaleY); ctx.stroke();
                      }
                    }}
                    onMouseUp={() => (isDrawing.current = false)}
                    onMouseLeave={() => (isDrawing.current = false)}
                    onTouchStart={(e) => {
                      isDrawing.current = true;
                      const canvas = canvasRef.current;
                      const rect = canvas?.getBoundingClientRect();
                      const touch = e.touches[0];
                      const ctx = canvas?.getContext('2d');
                      if (ctx && rect && canvas) {
                        // CRITICAL FIX: Scale touch coordinates to match canvas internal dimensions
                        const scaleX = canvas.width / rect.width;
                        const scaleY = canvas.height / rect.height;
                        const x = (touch.clientX - rect.left) * scaleX;
                        const y = (touch.clientY - rect.top) * scaleY;
                        ctx.beginPath();
                        ctx.strokeStyle = '#020617'; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
                        ctx.moveTo(x, y);
                      }
                      e.preventDefault();
                    }}
                    onTouchMove={(e) => {
                      if (!isDrawing.current) return;
                      const canvas = canvasRef.current;
                      const rect = canvas?.getBoundingClientRect();
                      const touch = e.touches[0];
                      const ctx = canvas?.getContext('2d');
                      if (ctx && rect && canvas) {
                        // CRITICAL FIX: Scale touch coordinates to match canvas internal dimensions
                        const scaleX = canvas.width / rect.width;
                        const scaleY = canvas.height / rect.height;
                        const x = (touch.clientX - rect.left) * scaleX;
                        const y = (touch.clientY - rect.top) * scaleY;
                        ctx.lineTo(x, y);
                        ctx.stroke();
                      }
                      e.preventDefault();
                    }}
                    onTouchEnd={() => (isDrawing.current = false)}
                  ></canvas>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handlePreviewSignature}
                  className="flex-1 py-4 bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 press-spring flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm font-black">visibility</span>
                  Preview
                </button>
                <button
                  onClick={clearSignature}
                  className="flex-1 py-4 bg-slate-900 text-slate-400 hover:text-white border border-white/10 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 press-spring flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm font-black">backspace</span>
                  Clear & Re-Sign
                </button>
              </div>
            </div>

            {/* Pre-Seal Validation Checklist */}
            <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-4 space-y-3">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Pre-Seal Checklist</p>
              <div className="space-y-2">
                <div className={`flex items-center gap-3 p-3 rounded-xl ${locationStatus === 'captured' ? 'bg-success/10' : 'bg-slate-800'}`}>
                  <span className={`material-symbols-outlined text-lg ${locationStatus === 'captured' ? 'text-success' : 'text-slate-400'}`}>
                    {locationStatus === 'captured' ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                  <div className="flex-1">
                    <p className={`text-xs font-bold ${locationStatus === 'captured' ? 'text-white' : 'text-slate-400'}`}>Location Captured</p>
                    {locationStatus === 'captured' && (
                      <p className="text-[10px] text-slate-400">{locationVerified ? 'GPS Verified' : 'Manual Entry'}</p>
                    )}
                  </div>
                </div>
                <div className={`flex items-center gap-3 p-3 rounded-xl ${photos.length > 0 ? 'bg-success/10' : 'bg-slate-800'}`}>
                  <span className={`material-symbols-outlined text-lg ${photos.length > 0 ? 'text-success' : 'text-slate-400'}`}>
                    {photos.length > 0 ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                  <div className="flex-1">
                    <p className={`text-xs font-bold ${photos.length > 0 ? 'text-white' : 'text-slate-400'}`}>Photos Captured</p>
                    {photos.length > 0 && (
                      <p className="text-[10px] text-slate-400">{photos.length} photo{photos.length > 1 ? 's' : ''} ({photos.filter(p => p.syncStatus === 'synced' || !p.isIndexedDBRef).length} synced)</p>
                    )}
                  </div>
                </div>
                <div className={`flex items-center gap-3 p-3 rounded-xl ${checklist.every(c => !c.required || c.checked) ? 'bg-success/10' : 'bg-slate-800'}`}>
                  <span className={`material-symbols-outlined text-lg ${checklist.every(c => !c.required || c.checked) ? 'text-success' : 'text-slate-400'}`}>
                    {checklist.every(c => !c.required || c.checked) ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                  <div className="flex-1">
                    <p className={`text-xs font-bold ${checklist.every(c => !c.required || c.checked) ? 'text-white' : 'text-slate-400'}`}>Safety Checks Complete</p>
                    <p className="text-[10px] text-slate-400">{checklist.filter(c => c.checked).length}/{checklist.length} items checked</p>
                  </div>
                </div>
                <div className={`flex items-center gap-3 p-3 rounded-xl ${signerName && signerName.trim().length > 2 ? 'bg-success/10' : 'bg-slate-800'}`}>
                  <span className={`material-symbols-outlined text-lg ${signerName && signerName.trim().length > 2 ? 'text-success' : 'text-slate-400'}`}>
                    {signerName && signerName.trim().length > 2 ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                  <div className="flex-1">
                    <p className={`text-xs font-bold ${signerName && signerName.trim().length > 2 ? 'text-white' : 'text-slate-400'}`}>Signer Identified</p>
                    {signerName && signerName.trim().length > 2 && (
                      <p className="text-[10px] text-slate-400">{signerName} ({signerRole})</p>
                    )}
                  </div>
                </div>
                <div className={`flex items-center gap-3 p-3 rounded-xl ${attestationConfirmed ? 'bg-success/10' : 'bg-slate-800'}`}>
                  <span className={`material-symbols-outlined text-lg ${attestationConfirmed ? 'text-success' : 'text-slate-400'}`}>
                    {attestationConfirmed ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                  <div className="flex-1">
                    <p className={`text-xs font-bold ${attestationConfirmed ? 'text-white' : 'text-slate-400'}`}>Satisfaction Confirmed</p>
                    <p className="text-[10px] text-slate-400">Legal attestation checkbox</p>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleSealWithConfirmation}
              disabled={isSubmitting || !signerName || photos.length === 0 || !attestationConfirmed}
              className="w-full py-7 bg-success rounded-[3rem] font-black text-xl tracking-tighter text-white shadow-[0_20px_40px_-12px_rgba(16,185,129,0.4)] flex items-center justify-center gap-4 transition-all active:scale-95 press-spring uppercase disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <div className="size-7 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <span className="material-symbols-outlined text-3xl font-black">lock</span>
                  Review & Seal Evidence
                </>
              )}
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={maxCompletedStep >= 4}
              className={`w-full py-4 font-black uppercase text-[10px] tracking-widest transition-all ${maxCompletedStep >= 4 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-400 hover:text-white'}`}
              title={maxCompletedStep >= 4 ? 'Cannot go back after signing' : undefined}
            >
              {maxCompletedStep >= 4 ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-xs">lock</span>
                  Signed — No Changes Allowed
                </span>
              ) : 'Back to Summary'}
            </button>
          </div>
        )}
      </div>

      {/* Styled Dialogs - Replacing native alert/confirm */}
      {dialog.type === 'alert' && (
        <ConfirmDialog
          isOpen={true}
          onClose={closeDialog}
          onConfirm={closeDialog}
          title={dialog.title}
          message={dialog.message}
          variant={dialog.variant || 'info'}
          confirmLabel="OK"
          cancelLabel=""
          icon={dialog.variant === 'danger' ? 'error' : dialog.variant === 'warning' ? 'warning' : 'info'}
        />
      )}

      {dialog.type === 'confirm' && (
        <ConfirmDialog
          isOpen={true}
          onClose={closeDialog}
          onConfirm={() => {
            if (dialog.onConfirm) dialog.onConfirm();
            closeDialog();
          }}
          title={dialog.title}
          message={dialog.message}
          variant={dialog.variant || 'warning'}
          confirmLabel={dialog.confirmLabel || 'Confirm'}
          cancelLabel={dialog.cancelLabel || 'Cancel'}
        />
      )}

      {dialog.type === 'prompt' && (
        <Modal isOpen={true} onClose={closeDialog} title={dialog.title} size="sm">
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">{dialog.message}</p>
            <input
              type="text"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder={dialog.promptPlaceholder}
              className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex gap-3">
              <ActionButton variant="secondary" onClick={closeDialog} fullWidth>
                Cancel
              </ActionButton>
              <ActionButton
                variant="primary"
                onClick={() => {
                  if (dialog.onConfirm) (dialog.onConfirm as (value: string) => void)(promptInput);
                  closeDialog();
                }}
                fullWidth
              >
                Confirm
              </ActionButton>
            </div>
          </div>
        </Modal>
      )}

      {/* Manual Location Entry Modal */}
      {showManualLocationModal && (
        <Modal isOpen={true} onClose={() => setShowManualLocationModal(false)} title="Enter Coordinates" size="sm">
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">
              Enter the GPS coordinates for this location. This will be flagged as unverified in the audit trail.
            </p>
            <div className="space-y-3">
              <div>
                <label htmlFor="manual-latitude" className="block text-xs text-slate-400 mb-1">Latitude</label>
                <input
                  id="manual-latitude"
                  type="number"
                  step="any"
                  value={manualLatInput}
                  onChange={(e) => setManualLatInput(e.target.value)}
                  placeholder="e.g., 51.505"
                  className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label htmlFor="manual-longitude" className="block text-xs text-slate-400 mb-1">Longitude</label>
                <input
                  id="manual-longitude"
                  type="number"
                  step="any"
                  value={manualLngInput}
                  onChange={(e) => setManualLngInput(e.target.value)}
                  placeholder="e.g., -0.09"
                  className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <ActionButton variant="secondary" onClick={() => setShowManualLocationModal(false)} fullWidth>
                Cancel
              </ActionButton>
              <ActionButton variant="primary" onClick={submitManualLocation} fullWidth>
                Save Location
              </ActionButton>
            </div>
          </div>
        </Modal>
      )}

      {/* Photo Deletion Confirmation */}
      {photoToDelete && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setPhotoToDelete(null)}
          onConfirm={executeDeletePhoto}
          title="Delete Photo?"
          message="This action will be logged in the audit trail and cannot be undone. The photo will be permanently removed from this job."
          variant="danger"
          confirmLabel="Delete Photo"
          cancelLabel="Keep"
          icon="delete"
        />
      )}

      {/* Technician Help Modal */}
      {showHelp && (
        <Modal isOpen={true} onClose={() => setShowHelp(false)} title="Help & Support" size="lg">
          <div className="space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Quick Tips */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">lightbulb</span>
                Quick Tips
              </h3>
              <div className="grid gap-3">
                <div className="bg-slate-800 p-4 rounded-xl">
                  <p className="text-xs font-bold text-white">Working Offline?</p>
                  <p className="text-xs text-slate-400 mt-1">Your photos and data are saved locally and will sync automatically when you&apos;re back online. Keep working!</p>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl">
                  <p className="text-xs font-bold text-white">Photo Tips</p>
                  <p className="text-xs text-slate-400 mt-1">Take clear photos of work done. Use Before/During/After categories. Each photo is GPS-tagged and timestamped.</p>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl">
                  <p className="text-xs font-bold text-white">Signature</p>
                  <p className="text-xs text-slate-400 mt-1">The client signs to confirm work was completed. Make sure they sign clearly for your records.</p>
                </div>
              </div>
            </div>

            {/* FAQs */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">quiz</span>
                Common Questions
              </h3>
              <div className="space-y-2">
                <details className="bg-slate-800 rounded-xl p-4 cursor-pointer group">
                  <summary className="text-xs font-bold text-white">What if GPS doesn&apos;t work?</summary>
                  <p className="text-xs text-slate-400 mt-2">If GPS is blocked, you can enter coordinates manually. This will be flagged as &quot;unverified&quot; in the report.</p>
                </details>
                <details className="bg-slate-800 rounded-xl p-4 cursor-pointer group">
                  <summary className="text-xs font-bold text-white">Can I go back and change something?</summary>
                  <p className="text-xs text-slate-400 mt-2">You can go back to previous steps until you sign. After signing, the evidence is locked for legal integrity.</p>
                </details>
                <details className="bg-slate-800 rounded-xl p-4 cursor-pointer group">
                  <summary className="text-xs font-bold text-white">What happens when I seal the job?</summary>
                  <p className="text-xs text-slate-400 mt-2">Sealing finalizes the evidence bundle for this job. The client and manager receive a professional report.</p>
                </details>
                <details className="bg-slate-800 rounded-xl p-4 cursor-pointer group">
                  <summary className="text-xs font-bold text-white">I see &quot;Syncing&quot; but nothing happens</summary>
                  <p className="text-xs text-slate-400 mt-2">If sync seems stuck, your data is safe locally. Move to better signal area. Sync will auto-retry for up to 12 minutes.</p>
                </details>
              </div>
            </div>

            {/* Contact */}
            <InfoBox
              icon="support_agent"
              title="Need More Help?"
              variant="tip"
              persistKey="tech_help_contact"
            >
              Contact your manager or dispatcher. They can see your job status and assist remotely.
            </InfoBox>

            <ActionButton variant="secondary" onClick={() => setShowHelp(false)} fullWidth>
              Close Help
            </ActionButton>
          </div>
        </Modal>
      )}

      {/* Signature Preview Modal */}
      {showSignaturePreview && signaturePreviewData && (
        <Modal isOpen={true} onClose={() => setShowSignaturePreview(false)} title="Signature Preview" size="lg">
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-4 shadow-inner">
              <img
                src={signaturePreviewData}
                alt="Signature Preview"
                className="w-full h-auto"
              />
            </div>
            <div className="bg-slate-800 rounded-xl p-4">
              <p className="text-xs text-slate-400">
                <span className="font-bold text-white">Signer:</span> {signerName} ({signerRole})
              </p>
              <p className="text-xs text-slate-400 mt-1">
                <span className="font-bold text-white">Date:</span> {new Date().toLocaleDateString()}
              </p>
            </div>
            <p className="text-xs text-slate-400 text-center">
              If the signature looks correct, proceed to seal. Otherwise, close and re-sign.
            </p>
            <div className="flex gap-3">
              <ActionButton variant="secondary" onClick={() => setShowSignaturePreview(false)} fullWidth>
                Close
              </ActionButton>
              <ActionButton
                variant="primary"
                onClick={() => {
                  setShowSignaturePreview(false);
                  setShowSealConfirmation(true);
                }}
                fullWidth
              >
                Proceed to Seal
              </ActionButton>
            </div>
          </div>
        </Modal>
      )}

      {/* Seal Confirmation Modal */}
      {showSealConfirmation && (
        <Modal isOpen={true} onClose={() => setShowSealConfirmation(false)} title="Confirm Evidence Seal" size="lg">
          <div className="space-y-6">
            {/* Summary Header */}
            <div className="bg-success/10 border border-success/30 rounded-2xl p-6 text-center">
              <span className="material-symbols-outlined text-success text-5xl mb-3">verified_user</span>
              <h3 className="text-lg font-black text-white uppercase tracking-tight">Ready to Seal Evidence</h3>
              <p className="text-sm text-slate-400 mt-2">This action cannot be undone. Evidence will be cryptographically sealed.</p>
            </div>

            {/* Evidence Summary */}
            <div className="bg-slate-800 rounded-xl p-4 space-y-3">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Evidence Summary</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-900 rounded-lg p-3">
                  <p className="text-2xl font-black text-primary">{photos.length}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Photos</p>
                </div>
                <div className="bg-slate-900 rounded-lg p-3">
                  <p className="text-2xl font-black text-success">✓</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Signature</p>
                </div>
                <div className="bg-slate-900 rounded-lg p-3">
                  <p className="text-sm font-black text-white truncate">{signerName}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Signed By</p>
                </div>
                <div className="bg-slate-900 rounded-lg p-3">
                  <p className="text-sm font-black text-white">{locationStatus === 'captured' ? '✓ GPS' : '—'}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Location</p>
                </div>
              </div>
            </div>

            {/* Security Info */}
            <div className="flex items-start gap-3 bg-slate-800 rounded-xl p-4">
              <span className="material-symbols-outlined text-primary text-xl">lock</span>
              <div>
                <p className="text-xs font-bold text-white">RSA-2048 Cryptographic Seal</p>
                <p className="text-[10px] text-slate-400 mt-1">Evidence will be hashed with SHA-256 and signed with RSA-2048 private key. This creates tamper-proof verification.</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <ActionButton variant="secondary" onClick={() => setShowSealConfirmation(false)} fullWidth>
                Cancel
              </ActionButton>
              <ActionButton
                variant="primary"
                onClick={() => {
                  setShowSealConfirmation(false);
                  handleFinalSeal();
                }}
                fullWidth
                icon="lock"
              >
                Seal Evidence Now
              </ActionButton>
            </div>
          </div>
        </Modal>
      )}
    </Layout>
  );
};

export default TechnicianPortal;
