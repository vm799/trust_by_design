/**
 * EvidenceCapture - Camera Capture for Technicians
 *
 * Full-screen camera UI for capturing evidence photos.
 *
 * Phase G: Technician Portal
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../../lib/DataContext';
import { Job } from '../../types';
import { SYNC_STATUS } from '../../lib/constants';
import { saveMediaLocal, getMediaLocal, getDatabase, StorageQuotaExceededError } from '../../lib/offline/db';
import OfflineIndicator from '../../components/OfflineIndicator';
import { showToast, playCameraShutter } from '../../lib/microInteractions';
import { compressImage } from '../../lib/imageCompression';
import { hapticSuccess, hapticWarning } from '../../lib/haptics';
import { MetadataHUD, BunkerStatusBadge } from '../../components/evidence';
import { convertToW3W } from '../../lib/services/what3words';
import { PhotoSavedConfirmation } from '../../components/PhotoSavedConfirmation';

type PhotoType = 'before' | 'during' | 'after';

interface CapturedPhoto {
  dataUrl: string;
  type: PhotoType;
  timestamp: string;
  location?: { lat: number; lng: number; accuracy?: number };
  w3w?: string;
  w3wVerified?: boolean;
}

const EvidenceCapture: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  // Use DataContext for state management
  const { jobs, updateJob: contextUpdateJob } = useData();

  // Memoized job derivation from DataContext
  const job = useMemo(() => jobs.find(j => j.id === jobId) || null, [jobs, jobId]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photoType, setPhotoType] = useState<PhotoType>('before');
  const [capturedPhoto, setCapturedPhoto] = useState<CapturedPhoto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [draftSaveWarning, setDraftSaveWarning] = useState(false);
  const [storageFullWarning, setStorageFullWarning] = useState(false);
  const [cameraRetryCount, setCameraRetryCount] = useState(0);
  const [photoSaveStatus, setPhotoSaveStatus] = useState<'saving' | 'saved' | 'error' | null>(null);
  const [photoSaveError, setPhotoSaveError] = useState<string | null>(null);
  const [lastPhotoFile, setLastPhotoFile] = useState<CapturedPhoto | null>(null);

  // Bunker-proof UI state
  const [w3w, setW3w] = useState<string | null>(null);
  const [w3wVerified, setW3wVerified] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isAcquiringGPS, setIsAcquiringGPS] = useState(true);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch W3W when location changes
  useEffect(() => {
    if (!location) return;
    setIsAcquiringGPS(false);

    const fetchW3W = async () => {
      try {
        const result = await convertToW3W(location.lat, location.lng);
        if (result) {
          setW3w(result.words);
          // W3W is considered verified if we got a result from the API
          setW3wVerified(true);
        }
      } catch {
        // W3W fetch failed - continue without it
        setW3wVerified(false);
      }
    };
    fetchW3W();
  }, [location]);

  // Draft key for photo persistence (survives app crash)
  const draftKey = useMemo(() => `photo_draft_${jobId}`, [jobId]);

  // Restore draft photo on mount (survives app crash/reload)
  useEffect(() => {
    const restoreDraft = async () => {
      if (!jobId) return;
      try {
        const draftData = await getMediaLocal(draftKey);
        if (draftData) {
          const parsed = JSON.parse(draftData) as CapturedPhoto;
          setCapturedPhoto(parsed);
        }
      } catch {
        // Draft corrupted or missing - ignore
      }
    };
    restoreDraft();
  }, [jobId, draftKey]);

  // Persist captured photo to IndexedDB immediately (offline-first)
  // P0 FIX: Silent failure removed - user MUST know if draft save fails
  const persistDraft = useCallback(async (photo: CapturedPhoto) => {
    try {
      await saveMediaLocal(draftKey, jobId || '', JSON.stringify(photo));
      setDraftSaveWarning(false); // Clear warning on success
      setStorageFullWarning(false);
    } catch (err) {
      // P0-3 FIX: Detect storage quota exceeded specifically
      if (err instanceof StorageQuotaExceededError) {
        setStorageFullWarning(true);
        setDraftSaveWarning(false);
        hapticWarning();
      } else {
        setDraftSaveWarning(true);
        setStorageFullWarning(false);
        hapticWarning();
      }
    }
  }, [draftKey, jobId]);

  // Start camera
  useEffect(() => {
    let mediaStream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch {
        setError('Unable to access camera. Please grant camera permissions.');
      }
    };

    startCamera();

    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Get location with accuracy
  useEffect(() => {
    if ('geolocation' in navigator) {
      setIsAcquiringGPS(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
          setIsAcquiringGPS(false);
        },
        () => {
          setIsAcquiringGPS(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    } else {
      setIsAcquiringGPS(false);
    }
  }, []);

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0);

    // Play camera shutter sound + haptic for tactile feedback
    playCameraShutter();
    hapticSuccess();

    // Convert to data URL and compress to <500KB for storage efficiency
    const rawDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const { dataUrl } = await compressImage(rawDataUrl, 500);

    const photo: CapturedPhoto = {
      dataUrl,
      type: photoType,
      timestamp: new Date().toISOString(),
      location: location || undefined,
      w3w: w3w || undefined,
      w3wVerified: w3wVerified,
    };

    // Persist to IndexedDB immediately (survives app crash)
    persistDraft(photo);
    setCapturedPhoto(photo);
  };

  const retakePhoto = async () => {
    setCapturedPhoto(null);
    // Clear draft - user wants to take a new photo
    try {
      const database = await getDatabase();
      await database.media.delete(draftKey);
    } catch {
      // Non-critical
    }
  };

  const savePhoto = async (photoToSave?: CapturedPhoto) => {
    const photo = photoToSave || capturedPhoto;
    if (!photo || !job) return;

    setPhotoSaveStatus('saving');
    setPhotoSaveError(null);
    setLastPhotoFile(photo);

    try {
      const photoId = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      // CRITICAL FIX: Store photo Base64 in IndexedDB media table with a reference key
      // The sync queue checks isIndexedDBRef to know it needs to upload from IndexedDB
      // Without this, photos NEVER sync to Supabase (isIndexedDBRef was undefined)
      const mediaKey = `media_${photoId}`;

      const newPhoto = {
        id: photoId,
        url: mediaKey, // IndexedDB key reference — NOT raw Base64
        localPath: mediaKey,
        type: photo.type,
        timestamp: photo.timestamp,
        lat: photo.location?.lat,
        lng: photo.location?.lng,
        accuracy: photo.location?.accuracy,
        w3w: photo.w3w,
        w3w_verified: photo.w3wVerified,
        verified: false,
        syncStatus: SYNC_STATUS.PENDING,
        isIndexedDBRef: true, // CRITICAL: Tells sync queue to retrieve from IndexedDB
      };

      const updatedPhotos = [...(job.photos || []), newPhoto];
      const updatedJob: Job = { ...job, photos: updatedPhotos };

      // Sprint 1 Task 1.5: Atomic draft cleanup using Dexie transaction
      // CRITICAL: Job update, photo storage, and draft deletion must be atomic
      // If app crashes between these operations, we either:
      // - Lose the photo (if job update fails after draft delete)
      // - Have orphaned draft (if draft delete fails after job update)
      // Using a transaction ensures all succeed or all fail
      const database = await getDatabase();
      await database.transaction('rw', database.jobs, database.media, async () => {
        // 1. Store photo Base64 in media table (sync queue retrieves from here)
        await database.media.put({
          id: mediaKey,
          jobId: job.id,
          data: photo.dataUrl,
          createdAt: Date.now()
        });

        // 2. Commit job update to local DB
        await database.jobs.put({
          ...updatedJob,
          syncStatus: SYNC_STATUS.PENDING,
          lastUpdated: Date.now()
        });

        // 3. Delete draft atomically (if job put fails, this won't run)
        await database.media.delete(draftKey);
      });

      // 3. Update context (reflects the committed DB state)
      contextUpdateJob(updatedJob);

      // FIX 2.3: Show photo saved confirmation (green checkmark, auto-dismiss after 2s)
      hapticSuccess();
      setPhotoSaveStatus('saved');

      // Auto-dismiss after 2 seconds
      setTimeout(() => {
        setPhotoSaveStatus(null);
      }, 2000);

      // FIELD UX: Show confirmation toast and navigate back
      // NOTE: Photo is saved to local vault but NOT yet cryptographically sealed
      // Sealing happens later via manager review in EvidenceReview.tsx
      showToast('Photo saved to local vault - will sync when online', 'success');
      navigate(`/tech/job/${job?.id}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to save photo. Please try again.';
      setPhotoSaveStatus('error');
      setPhotoSaveError(errorMsg);
      setError(null); // Don't show full-screen error, just confirmation error
    }
  };

  const goBack = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    navigate(`/tech/job/${jobId}`);
  };

  // Sprint 3 Task 3.3: Check if this is a camera permission error
  const isCameraPermissionError = error?.includes('camera') || error?.includes('permission');

  // Try again handler - attempts to restart camera
  // P0-7 FIX: Track retry attempts and provide escalation after 3 failures
  const handleTryAgain = async () => {
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      setStream(mediaStream);
      setCameraRetryCount(0); // Reset on success
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch {
      setCameraRetryCount(prev => prev + 1);
      setError('Unable to access camera. Please grant camera permissions.');
    }
  };

  // P0-7: Check if we've exceeded retry threshold
  const showEscalation = cameraRetryCount >= 3;

  if (error) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center p-4 transition-colors">
        <div className="max-w-sm mx-auto text-center">
          <span className="material-symbols-outlined text-5xl text-red-400 mb-4">
            {isCameraPermissionError ? 'no_photography' : 'error'}
          </span>
          <h2 className="text-slate-900 dark:text-white text-lg font-bold mb-2">
            {isCameraPermissionError ? 'Camera Access Required' : 'Something Went Wrong'}
          </h2>
          <p className="text-slate-600 dark:text-slate-300 text-sm mb-6">{error}</p>

          {/* Sprint 3 Task 3.3: Step-by-step instructions for camera permission */}
          {isCameraPermissionError && !showEscalation && (
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl p-4 mb-6 text-left">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">How to enable camera:</p>
              <ol className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <li className="flex gap-2">
                  <span className="text-primary font-bold">1.</span>
                  <span>Open your device <strong className="text-slate-900 dark:text-white">Settings</strong></span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold">2.</span>
                  <span>Find <strong className="text-slate-900 dark:text-white">JobProof</strong> in the app list</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold">3.</span>
                  <span>Enable <strong className="text-slate-900 dark:text-white">Camera</strong> permission</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold">4.</span>
                  <span>Return here and tap <strong className="text-slate-900 dark:text-white">Try Again</strong></span>
                </li>
              </ol>
            </div>
          )}

          {/* P0-7 FIX: Escalation path after 3 failed retries */}
          {isCameraPermissionError && showEscalation && (
            <div className="bg-red-900/50 border border-red-500/30 rounded-xl p-4 mb-6 text-left">
              <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">warning</span>
                Camera Blocked
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                Camera access is blocked by your device. You need to change this in your device settings, not in the app.
              </p>
              <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <p className="font-bold text-slate-900 dark:text-white">Options:</p>
                <ul className="space-y-2 ml-4 list-disc">
                  <li>Check device Settings → JobProof → Camera = ON</li>
                  <li>Contact your manager if you need help</li>
                  <li>Go back and complete photos later</li>
                </ul>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleTryAgain}
              className="w-full px-6 py-4 bg-primary text-white rounded-xl font-bold flex items-center justify-center gap-2 min-h-[56px]"
            >
              <span className="material-symbols-outlined">refresh</span>
              Try Again
            </button>
            <button
              onClick={goBack}
              className="w-full px-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-medium min-h-[56px]"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Offline status indicator */}
      <OfflineIndicator />

      {/* FIX 2.3: Photo saved confirmation UI */}
      <PhotoSavedConfirmation
        show={photoSaveStatus !== null}
        status={photoSaveStatus || 'saving'}
        errorMessage={photoSaveError || undefined}
        onRetry={
          photoSaveStatus === 'error' && lastPhotoFile
            ? () => savePhoto(lastPhotoFile)
            : undefined
        }
      />

      {/* Hidden canvas for capturing */}
      <canvas ref={canvasRef} className="hidden" />

      {capturedPhoto ? (
        /* Photo Preview */
        <div className="flex-1 flex flex-col">
          {/* P0-3 FIX: Storage full warning - device needs space */}
          {storageFullWarning && (
            <div className="bg-red-500 px-4 py-3 flex items-center gap-3">
              <span className="material-symbols-outlined text-white">storage</span>
              <div className="flex-1">
                <p className="text-white font-bold text-sm">Device Storage Full</p>
                <p className="text-red-100 text-xs">Delete old photos/apps to free space, then save</p>
              </div>
            </div>
          )}
          {/* P0 FIX: Draft save warning - user must know if photo is at risk */}
          {draftSaveWarning && !storageFullWarning && (
            <div className="bg-amber-500 px-4 py-3 flex items-center gap-3">
              <span className="material-symbols-outlined text-amber-900">warning</span>
              <div className="flex-1">
                <p className="text-amber-900 font-bold text-sm">Photo Not Backed Up</p>
                <p className="text-amber-800 text-xs">Save now to avoid losing this photo</p>
              </div>
            </div>
          )}
          {/* Preview Image */}
          <div className="flex-1 relative">
            <img
              src={capturedPhoto.dataUrl}
              alt="Captured"
              className="w-full h-full object-contain"
            />

            {/* Forensic Metadata HUD */}
            <MetadataHUD
              location={capturedPhoto.location}
              w3w={capturedPhoto.w3w}
              w3wVerified={capturedPhoto.w3wVerified}
              timestamp={new Date(capturedPhoto.timestamp).getTime()}
              isOffline={isOffline}
              className="absolute bottom-4 left-4 right-4 max-w-sm"
            />
          </div>

          {/* Photo Type Selector */}
          <div className="bg-white dark:bg-slate-950 px-4 py-3 border-t border-slate-200 dark:border-white/10">
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-2">Photo Type</p>
            <div className="flex justify-center gap-2">
              {(['before', 'during', 'after'] as PhotoType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    const updated = { ...capturedPhoto, type };
                    setCapturedPhoto(updated);
                    persistDraft(updated);
                  }}
                  className={`
                    px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all min-h-[44px]
                    ${capturedPhoto.type === type
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}
                  `}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Spacer to prevent content from hiding behind fixed action bar */}
          <div className="h-24" />

          {/* Actions - FIXED bottom for thumb access */}
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200 dark:border-white/10 px-4 py-4 pb-safe flex gap-3">
            <button
              onClick={retakePhoto}
              disabled={photoSaveStatus === 'saving'}
              className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50 min-h-[56px]"
            >
              <span className="material-symbols-outlined">refresh</span>
              Retake
            </button>
            <button
              onClick={() => savePhoto()}
              disabled={photoSaveStatus === 'saving'}
              className="flex-1 py-4 bg-primary text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50 min-h-[56px]"
            >
              {photoSaveStatus === 'saving' ? (
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined">check</span>
              )}
              Use Photo
            </button>
          </div>
        </div>
      ) : (
        /* Camera View */
        <div className="flex-1 flex flex-col">
          {/* Cancel Button */}
          <button
            onClick={goBack}
            aria-label="Cancel and go back"
            className="absolute top-4 left-4 z-10 p-3 min-w-[44px] min-h-[44px] bg-black/50 backdrop-blur rounded-full text-white"
          >
            <span className="material-symbols-outlined">close</span>
          </button>

          {/* Video Feed */}
          <div className="flex-1 relative overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Forensic Metadata HUD - Camera View */}
            <MetadataHUD
              location={location}
              w3w={w3w}
              w3wVerified={w3wVerified}
              isAcquiringGPS={isAcquiringGPS}
              timestamp={Date.now()}
              isOffline={isOffline}
              compact={true}
              className="absolute bottom-4 left-4"
            />

            {/* Bunker Status Badge - Top Right */}
            <div className="absolute top-4 right-4 z-10">
              <BunkerStatusBadge
                state={isOffline ? 'local' : 'synced'}
                isOffline={isOffline}
                showLabel={false}
                size="md"
              />
            </div>
          </div>

          {/* Photo Type Selector with Counts */}
          <div className="bg-white dark:bg-slate-950 px-4 py-3 border-t border-slate-200 dark:border-white/10">
            <div className="flex justify-center gap-2">
              {(['before', 'during', 'after'] as PhotoType[]).map((type) => {
                const existingPhotos = (job?.photos || []).filter((p) => p.type?.toLowerCase() === type);
                const typeColors = {
                  before: { active: 'bg-blue-500 text-white', inactive: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400', badge: 'bg-blue-400/20 text-blue-300' },
                  during: { active: 'bg-amber-500 text-white', inactive: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400', badge: 'bg-amber-400/20 text-amber-300' },
                  after: { active: 'bg-emerald-500 text-white', inactive: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400', badge: 'bg-emerald-400/20 text-emerald-300' },
                };
                const colors = typeColors[type];
                const isSelected = photoType === type;

                return (
                  <button
                    key={type}
                    onClick={() => setPhotoType(type)}
                    className={`
                      flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium capitalize transition-all min-h-[48px]
                      ${isSelected ? colors.active : colors.inactive}
                    `}
                  >
                    {type}
                    <span className={`
                      text-[10px] font-bold px-1.5 py-0.5 rounded-md
                      ${isSelected ? 'bg-white/20 text-white' : colors.badge}
                    `}>
                      {existingPhotos.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Spacer to prevent content from hiding behind fixed capture bar */}
          <div className="h-32" />

          {/* Capture Button - FIXED bottom for thumb access */}
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200 dark:border-white/10 px-4 py-4 pb-safe flex flex-col items-center gap-2">
            <button
              onClick={capturePhoto}
              aria-label="Capture photo"
              className="size-20 rounded-full bg-white border-4 border-primary shadow-lg shadow-primary/30 flex items-center justify-center active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-4xl text-primary">photo_camera</span>
            </button>
            <p className="text-[10px] text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Tap to capture {photoType}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default EvidenceCapture;
