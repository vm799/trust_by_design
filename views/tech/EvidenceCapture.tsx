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
import { saveMediaLocal, getMediaLocal, db } from '../../lib/offline/db';
import OfflineIndicator from '../../components/OfflineIndicator';

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
  const persistDraft = useCallback(async (photo: CapturedPhoto) => {
    try {
      await saveMediaLocal(draftKey, jobId || '', JSON.stringify(photo));
    } catch {
      // Silently fail - photo still in state, just not persisted
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
        syncStatus: 'pending' as const,
      };

      const updatedPhotos = [...(job.photos || []), newPhoto];
      // Use DataContext updateJob with full Job object
      const updatedJob: Job = { ...job, photos: updatedPhotos };
      contextUpdateJob(updatedJob);

      // Clear draft from IndexedDB (photo is now committed to job)
      try {
        await db.media.delete(draftKey);
      } catch {
        // Non-critical - draft will be orphaned but not cause issues
      }

      // Go back to job detail
      navigate(`/tech/job/${job.id}`);
    } catch (error) {
      console.error('Failed to save photo:', error);
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

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <span className="material-symbols-outlined text-5xl text-red-400 mb-4">error</span>
          <p className="text-white mb-4">{error}</p>
          <button
            onClick={goBack}
            className="px-6 py-3 bg-primary text-white rounded-xl font-medium"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Offline status indicator */}
      <OfflineIndicator />

      {/* Hidden canvas for capturing */}
      <canvas ref={canvasRef} className="hidden" />

      {capturedPhoto ? (
        /* Photo Preview */
        <div className="flex-1 flex flex-col">
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
            className="absolute top-4 left-4 z-10 p-2 bg-black/50 backdrop-blur rounded-full text-white"
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
