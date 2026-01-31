/**
 * VoiceNote Component
 *
 * Allows technicians to record voice notes for evidence annotation.
 * Uses MediaRecorder API with fallback for unsupported browsers.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { hapticTap, hapticSuccess, hapticWarning } from '../lib/haptics';

interface VoiceNoteProps {
  jobId: string;
  onRecordingComplete: (audioBlob: Blob, duration: number) => void;
  maxDuration?: number; // Max recording duration in seconds
  disabled?: boolean;
}

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioUrl: string | null;
}

const VoiceNote: React.FC<VoiceNoteProps> = ({
  onRecordingComplete,
  maxDuration = 120, // 2 minutes default
  disabled = false
}) => {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioUrl: null
  });
  const [isSupported, setIsSupported] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check browser support
  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsSupported(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (!isSupported || disabled) return;

    try {
      hapticTap();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4'
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        const url = URL.createObjectURL(blob);

        setState(prev => ({
          ...prev,
          audioUrl: url,
          isRecording: false
        }));

        onRecordingComplete(blob, state.duration);
        hapticSuccess();

        // Cleanup stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.start(1000); // Capture in 1-second chunks

      // Start timer
      timerRef.current = window.setInterval(() => {
        setState(prev => {
          const newDuration = prev.duration + 1;
          if (newDuration >= maxDuration) {
            stopRecording();
          }
          return { ...prev, duration: newDuration };
        });
      }, 1000);

      setState({
        isRecording: true,
        isPaused: false,
        duration: 0,
        audioUrl: null
      });

    } catch (error) {
      console.error('[VoiceNote] Failed to start recording:', error);
      if ((error as Error).name === 'NotAllowedError') {
        setPermissionDenied(true);
        hapticWarning();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupported, disabled, maxDuration, onRecordingComplete, state.duration]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [state.isRecording]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.pause();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setState(prev => ({ ...prev, isPaused: true }));
      hapticTap();
    }
  }, [state.isRecording]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isPaused) {
      mediaRecorderRef.current.resume();
      timerRef.current = window.setInterval(() => {
        setState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
      setState(prev => ({ ...prev, isPaused: false }));
      hapticTap();
    }
  }, [state.isPaused]);

  const clearRecording = useCallback(() => {
    if (state.audioUrl) {
      URL.revokeObjectURL(state.audioUrl);
    }
    setState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      audioUrl: null
    });
    hapticTap();
  }, [state.audioUrl]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Not supported message
  if (!isSupported) {
    return (
      <div className="bg-slate-800/50 rounded-xl p-4 text-center">
        <span className="material-symbols-outlined text-slate-500 text-2xl">mic_off</span>
        <p className="text-xs text-slate-500 mt-2">Voice notes not supported in this browser</p>
      </div>
    );
  }

  // Permission denied message
  if (permissionDenied) {
    return (
      <div className="bg-warning/10 border border-warning/30 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-warning">mic_off</span>
          <div>
            <p className="text-xs font-bold text-warning">Microphone Access Denied</p>
            <p className="text-xs text-slate-400 mt-1">
              Enable microphone in browser settings to record voice notes
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">mic</span>
          <span className="text-xs font-bold text-white uppercase tracking-wide">Voice Note</span>
        </div>
        <span className="text-xs text-slate-400">{formatTime(state.duration)} / {formatTime(maxDuration)}</span>
      </div>

      {/* Recording Visualizer */}
      {state.isRecording && (
        <div className="flex items-center justify-center gap-1 h-8">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className={`w-1 bg-primary rounded-full transition-all ${state.isPaused ? 'h-2' : 'animate-pulse'}`}
              style={{
                height: state.isPaused ? '8px' : `${Math.random() * 24 + 8}px`,
                animationDelay: `${i * 0.1}s`
              }}
            />
          ))}
        </div>
      )}

      {/* Audio Playback */}
      {state.audioUrl && !state.isRecording && (
        <audio
          src={state.audioUrl}
          controls
          className="w-full h-10 rounded-lg"
        />
      )}

      {/* Controls */}
      <div className="flex gap-2">
        {!state.isRecording && !state.audioUrl && (
          <button
            onClick={startRecording}
            disabled={disabled}
            className="flex-1 py-3 bg-primary rounded-xl font-bold text-xs text-white uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">mic</span>
            Start Recording
          </button>
        )}

        {state.isRecording && (
          <>
            <button
              onClick={state.isPaused ? resumeRecording : pauseRecording}
              className="flex-1 py-3 bg-slate-800 border border-white/10 rounded-xl font-bold text-xs text-white uppercase tracking-wide flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">
                {state.isPaused ? 'play_arrow' : 'pause'}
              </span>
              {state.isPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={stopRecording}
              className="flex-1 py-3 bg-success rounded-xl font-bold text-xs text-white uppercase tracking-wide flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">stop</span>
              Done
            </button>
          </>
        )}

        {state.audioUrl && !state.isRecording && (
          <>
            <button
              onClick={clearRecording}
              className="flex-1 py-3 bg-slate-800 border border-white/10 rounded-xl font-bold text-xs text-slate-400 uppercase tracking-wide flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">delete</span>
              Discard
            </button>
            <button
              onClick={startRecording}
              className="flex-1 py-3 bg-primary rounded-xl font-bold text-xs text-white uppercase tracking-wide flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">refresh</span>
              Re-record
            </button>
          </>
        )}
      </div>

      {/* Progress Bar */}
      {state.isRecording && (
        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full bg-primary transition-all ${state.isPaused ? '' : 'animate-pulse'}`}
            style={{ width: `${(state.duration / maxDuration) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default VoiceNote;
