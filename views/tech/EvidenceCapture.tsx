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
import { saveMediaLocal, getMediaLocal, db, StorageQuotaExceededError } from '../../lib/offline/db';
import OfflineIndicator from '../../components/OfflineIndicator';
import { showToast } from '../../lib/microInteractions';

type PhotoType = 'before' | 'during' | 'after';

interface CapturedPhoto {
  dataUrl: string;
  type: PhotoType;
  timestamp: string;
  location?: { lat: number; lng: number };
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [saveConfirmation, setSaveConfirmation] = useState(false);
  const [draftSaveWarning, setDraftSaveWarning] = useState(false);
  const [storageFullWarning, setStorageFullWarning] = useState(false);
  const [cameraRetryCount, setCameraRetryCount] = useState(0);

  // Draft key for photo persistence (survives app crash)
  const draftKey = `photo_draft_${jobId}`;

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
      // P0 CRITICAL: Never silently fail - user must know photo is at risk
      console.error('[EvidenceCapture] Draft save failed:', err);

      // P0-3 FIX: Detect storage quota exceeded specifically
      if (err instanceof StorageQuotaExceededError) {
        setStorageFullWarning(true);
        setDraftSaveWarning(false);
      } else {
        setDraftSaveWarning(true);
        setStorageFullWarning(false);
      }
    }
  }, [draftKey, jobId]);

  // Start camera
  useEffect(() => {
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
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
      } catch (err) {
        console.error('Camera access failed:', err);
        setError('Unable to access camera. Please grant camera permissions.');
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Get location
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (err) => {
          console.warn('Geolocation failed:', err);
        }
      );
    }
  }, []);

  const capturePhoto = () => {
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

    // Convert to data URL
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    const photo: CapturedPhoto = {
      dataUrl,
      type: photoType,
      timestamp: new Date().toISOString(),
      location: location || undefined,
    };

    // Persist to IndexedDB immediately (survives app crash)
    persistDraft(photo);
    setCapturedPhoto(photo);
  };

  const retakePhoto = async () => {
    setCapturedPhoto(null);
    // Clear draft - user wants to take a new photo
    try {
      await db.media.delete(draftKey);
    } catch {
      // Non-critical
    }
  };

  const savePhoto = async () => {
    if (!capturedPhoto || !job) return;

    setSaving(true);
    try {
      const newPhoto = {
        id: `photo_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        url: capturedPhoto.dataUrl, // In production, this would be uploaded to storage
        localPath: capturedPhoto.dataUrl,
        type: capturedPhoto.type,
        timestamp: capturedPhoto.timestamp,
        lat: capturedPhoto.location?.lat,
        lng: capturedPhoto.location?.lng,
        verified: false,
        syncStatus: SYNC_STATUS.PENDING,
      };

      const updatedPhotos = [...(job.photos || []), newPhoto];
      const updatedJob: Job = { ...job, photos: updatedPhotos };

      // Sprint 1 Task 1.5: Atomic draft cleanup using Dexie transaction
      // CRITICAL: Job update and draft deletion must be atomic
      // If app crashes between these operations, we either:
      // - Lose the photo (if job update fails after draft delete)
      // - Have orphaned draft (if draft delete fails after job update)
      // Using a transaction ensures both succeed or both fail
      await db.transaction('rw', db.jobs, db.media, async () => {
        // 1. Commit job update to local DB
        await db.jobs.put({
          ...updatedJob,
          syncStatus: SYNC_STATUS.PENDING,
          lastUpdated: Date.now()
        });

        // 2. Delete draft atomically (if job put fails, this won't run)
        await db.media.delete(draftKey);
      });

      // 3. Update context (reflects the committed DB state)
      contextUpdateJob(updatedJob);

      // Show "Saved to device" confirmation (Sprint 1 Task 1.2)
      // CRITICAL: Technician needs certainty that photo is safe
      setSaveConfirmation(true);

      // FIELD UX: Show confirmation toast before navigating
      showToast('Photo Captured', 'Saved locally - will sync when online', 'success');

      // Wait 1.5s so user sees confirmation, then navigate
      setTimeout(() => {
        navigate(`/tech/job/${job.id}`);
      }, 1500);
    } catch (error) {
      setError('Failed to save photo. Please try again.');
    } finally {
      setSaving(false);
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
    } catch (err) {
      console.error('Camera retry failed:', err);
      setCameraRetryCount(prev => prev + 1);
      setError('Unable to access camera. Please grant camera permissions.');
    }
  };

  // P0-7: Check if we've exceeded retry threshold
  const showEscalation = cameraRetryCount >= 3;

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-sm mx-auto text-center">
          <span className="material-symbols-outlined text-5xl text-red-400 mb-4">
            {isCameraPermissionError ? 'no_photography' : 'error'}
          </span>
          <h2 className="text-white text-lg font-bold mb-2">
            {isCameraPermissionError ? 'Camera Access Required' : 'Something Went Wrong'}
          </h2>
          <p className="text-slate-300 text-sm mb-6">{error}</p>

          {/* Sprint 3 Task 3.3: Step-by-step instructions for camera permission */}
          {isCameraPermissionError && !showEscalation && (
            <div className="bg-slate-900 border border-white/10 rounded-xl p-4 mb-6 text-left">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">How to enable camera:</p>
              <ol className="space-y-2 text-sm text-slate-300">
                <li className="flex gap-2">
                  <span className="text-primary font-bold">1.</span>
                  <span>Open your device <strong className="text-white">Settings</strong></span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold">2.</span>
                  <span>Find <strong className="text-white">JobProof</strong> in the app list</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold">3.</span>
                  <span>Enable <strong className="text-white">Camera</strong> permission</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold">4.</span>
                  <span>Return here and tap <strong className="text-white">Try Again</strong></span>
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
              <p className="text-sm text-slate-300 mb-4">
                Camera access is blocked by your device. You need to change this in your device settings, not in the app.
              </p>
              <div className="space-y-2 text-sm text-slate-300">
                <p className="font-bold text-white">Options:</p>
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
              className="w-full px-6 py-4 bg-slate-800 text-slate-300 rounded-xl font-medium min-h-[56px]"
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

      {/* Save Confirmation Toast (Sprint 1 Task 1.2) */}
      {/* CRITICAL: Technician needs visual certainty that photo is safe */}
      {saveConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-emerald-500 text-white px-8 py-6 rounded-2xl flex flex-col items-center gap-3 shadow-2xl shadow-emerald-500/30 animate-scale-in">
            <span className="material-symbols-outlined text-5xl">check_circle</span>
            <span className="font-black text-lg uppercase tracking-wider">Saved to Device</span>
            <span className="text-sm text-emerald-100">Photo stored safely</span>
          </div>
        </div>
      )}

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

            {/* Metadata Overlay */}
            <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur px-3 py-2 rounded-lg">
              <p className="text-xs text-white">
                {new Date(capturedPhoto.timestamp).toLocaleString('en-AU')}
              </p>
              {capturedPhoto.location && (
                <p className="text-[10px] text-slate-400">
                  {capturedPhoto.location.lat.toFixed(6)}, {capturedPhoto.location.lng.toFixed(6)}
                </p>
              )}
            </div>
          </div>

          {/* Photo Type Selector */}
          <div className="bg-slate-950 px-4 py-3 border-t border-white/10">
            <p className="text-xs text-slate-500 text-center mb-2">Photo Type</p>
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
                    px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all
                    ${capturedPhoto.type === type
                      ? 'bg-primary text-white'
                      : 'bg-slate-800 text-slate-400'}
                  `}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-slate-950 px-4 py-4 pb-safe flex gap-3">
            <button
              onClick={retakePhoto}
              disabled={saving}
              className="flex-1 py-4 bg-slate-800 text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span className="material-symbols-outlined">refresh</span>
              Retake
            </button>
            <button
              onClick={savePhoto}
              disabled={saving}
              className="flex-1 py-4 bg-primary text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? (
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
            className="absolute top-4 left-4 z-10 p-3 min-w-[44px] min-h-[44px] bg-black/50 backdrop-blur rounded-full text-white"
          >
            <span className="material-symbols-outlined">close</span>
          </button>

          {/* FIELD UX: Offline safety indicator */}
          <div className="absolute top-4 right-4 z-10">
            <OfflineIndicator variant="compact" />
          </div>

          {/* Video Feed */}
          <div className="flex-1 relative overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Location Overlay */}
            {location && (
              <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur px-3 py-2 rounded-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-emerald-400">location_on</span>
                <span className="text-xs text-white">GPS Active</span>
              </div>
            )}
          </div>

          {/* Photo Type Selector */}
          <div className="bg-slate-950 px-4 py-3 border-t border-white/10">
            <p className="text-xs text-slate-500 text-center mb-2">Capturing</p>
            <div className="flex justify-center gap-2">
              {(['before', 'during', 'after'] as PhotoType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setPhotoType(type)}
                  className={`
                    px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all
                    ${photoType === type
                      ? 'bg-primary text-white'
                      : 'bg-slate-800 text-slate-400'}
                  `}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Capture Button */}
          <div className="bg-slate-950 px-4 py-6 pb-safe flex justify-center">
            <button
              onClick={capturePhoto}
              className="size-20 rounded-full bg-white border-4 border-primary shadow-lg shadow-primary/30 flex items-center justify-center active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-4xl text-primary">photo_camera</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EvidenceCapture;
