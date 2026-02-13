/**
 * ClientConfirmationCanvas - Client satisfaction signature pad
 *
 * Simple, elegant client sign-off component for job completion.
 * "I confirm I am satisfied with the completed job"
 *
 * Features:
 * - Clean signature capture (HTML5 canvas)
 * - Satisfaction confirmation checkbox
 * - Dark mode compatible
 * - Touch-friendly (56px+ for gloved hands)
 * - Offline-first (saves to IndexedDB)
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '../lib/animations';
import { showSuccessCheckmark } from '../lib/microInteractions';
import { useCanvasTheme } from '../hooks/useCanvasTheme';

interface ClientConfirmationCanvasProps {
  clientName?: string;
  onConfirmed?: (signature: string, timestamp: string) => void;
  onCancel?: () => void;
  disabled?: boolean;
  locationW3W?: string;
  photosSealed?: number;
}

const ClientConfirmationCanvas: React.FC<ClientConfirmationCanvasProps> = ({
  clientName = 'Client',
  onConfirmed,
  onCancel,
  disabled = false,
  locationW3W,
  photosSealed = 0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const signatureImageRef = useRef<ImageData | null>(null); // Store signature data across redraws
  const undoStackRef = useRef<ImageData[]>([]); // Undo history stack

  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [canUndo, setCanUndo] = useState(false); // Track if undo is available

  // Use canvas theme hook for dynamic colours
  const { bg, stroke, line, isDark } = useCanvasTheme();

  /**
   * Initialize and redraw canvas with current theme colours
   * Called on mount and when theme changes
   */
  const initializeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3;

      // Fill background with theme colour
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Draw signature line guide
      ctx.strokeStyle = line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(20, rect.height - 40);
      ctx.lineTo(rect.width - 20, rect.height - 40);
      ctx.stroke();

      // Reset for drawing with theme stroke colour
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 3;

      // Restore signature if it exists (after theme change)
      if (signatureImageRef.current && hasSignature) {
        try {
          ctx.putImageData(signatureImageRef.current, 0, 0);
        } catch (error) {
          console.warn('Failed to restore signature after theme change:', error);
        }
      }
    }
  }, [bg, stroke, line, hasSignature]);

  // Initialize canvas on mount and when theme changes
  useEffect(() => {
    initializeCanvas();
  }, [initializeCanvas]);

  const getCoordinates = useCallback(
    (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();

      if ('touches' in e) {
        const touch = e.touches[0];
        return {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
        };
      }
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    []
  );

  const startDrawing = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (disabled) return;
      e.preventDefault();

      setIsDrawing(true);
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        const { x, y } = getCoordinates(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
      }
    },
    [disabled, getCoordinates]
  );

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing || disabled) return;
      e.preventDefault();

      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        const { x, y } = getCoordinates(e);
        ctx.lineTo(x, y);
        ctx.stroke();
        setHasSignature(true);

        // Store signature data for restoration on theme change
        try {
          const canvas = canvasRef.current;
          const rect = containerRef.current?.getBoundingClientRect();
          if (canvas && rect) {
            signatureImageRef.current = ctx.getImageData(
              0,
              0,
              rect.width * (window.devicePixelRatio || 1),
              rect.height * (window.devicePixelRatio || 1)
            );
          }
        } catch (error) {
          console.warn('Failed to store signature image data:', error);
        }
      }
    },
    [isDrawing, disabled, getCoordinates]
  );

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.closePath();

      // Save state to undo stack
      const canvas = canvasRef.current;
      const rect = containerRef.current?.getBoundingClientRect();
      if (canvas && rect && hasSignature) {
        try {
          const imageData = ctx.getImageData(
            0,
            0,
            rect.width * (window.devicePixelRatio || 1),
            rect.height * (window.devicePixelRatio || 1)
          );
          undoStackRef.current.push(imageData);
          setCanUndo(undoStackRef.current.length > 0);
        } catch (error) {
          console.warn('Failed to save undo state:', error);
        }
      }
    }
  }, [hasSignature]);

  /**
   * Undo the last stroke
   */
  const undo = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || undoStackRef.current.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Pop the last state
    const previousState = undoStackRef.current.pop();
    if (previousState) {
      try {
        ctx.putImageData(previousState, 0, 0);
        signatureImageRef.current = previousState;

        // Update UI state
        const hasAnySignature = previousState.data.some((byte) => byte !== 0);
        setHasSignature(hasAnySignature);
        setCanUndo(undoStackRef.current.length > 0);
      } catch (error) {
        console.warn('Failed to undo:', error);
      }
    }
  }, []);

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    const rect = container.getBoundingClientRect();

    if (ctx) {
      // Clear with theme background colour
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Redraw signature line with theme colour
      ctx.strokeStyle = line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(20, rect.height - 40);
      ctx.lineTo(rect.width - 20, rect.height - 40);
      ctx.stroke();

      // Reset for drawing with theme stroke colour
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 3;

      // Clear stored signature data and undo stack
      signatureImageRef.current = null;
      undoStackRef.current = [];

      setHasSignature(false);
      setIsConfirmed(false);
      setCanUndo(false);
    }
  }, [bg, line, stroke]);

  const handleConfirm = useCallback(async () => {
    if (!hasSignature || !isConfirmed || !canvasRef.current || !containerRef.current) return;

    setIsSaving(true);
    try {
      const signatureDataUrl = canvasRef.current.toDataURL('image/png');
      const timestamp = new Date().toISOString();

      // Show success checkmark animation (Notion-style)
      const cleanup = showSuccessCheckmark(containerRef.current);

      // Wait for animation to complete before calling onConfirmed
      setTimeout(() => {
        cleanup();
        onConfirmed?.(signatureDataUrl, timestamp);
      }, 1200);
    } catch (error) {
      setIsSaving(false);
      console.error('Failed to confirm signature:', error);
    }
  }, [hasSignature, isConfirmed, onConfirmed]);

  const canSave = hasSignature && isConfirmed && !isSaving;

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-emerald-50 dark:bg-emerald-950/20">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">
              verified
            </span>
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">
              Client Confirmation
            </h3>
            <p className="text-sm text-slate-500">
              {clientName}, please sign to confirm satisfaction
            </p>
          </div>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={disabled}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 min-h-[44px] min-w-[44px]"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        )}
      </div>

      {/* Attestation Details */}
      {(locationW3W || photosSealed > 0) && (
        <div className="px-4 pt-4">
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-4 space-y-2">
            <p className="text-xs font-bold text-blue-900 dark:text-blue-200 uppercase tracking-widest mb-3">Evidence Details</p>
            {locationW3W && (
              <div className="flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-xs text-blue-600 dark:text-blue-400">location_on</span>
                <span className="text-slate-700 dark:text-slate-300">
                  <span className="font-bold">Location:</span> {locationW3W}
                </span>
              </div>
            )}
            {photosSealed > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-xs text-green-600 dark:text-green-400">verified</span>
                <span className="text-slate-700 dark:text-slate-300">
                  <span className="font-bold">{photosSealed} sealed photo{photosSealed !== 1 ? 's' : ''}</span> cryptographically signed
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <span className="material-symbols-outlined text-xs text-slate-600 dark:text-slate-400">schedule</span>
              <span className="text-slate-700 dark:text-slate-300">
                <span className="font-bold">Timestamp:</span> {new Date().toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Signature Canvas */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Signature Pad
          </p>
          <span className={`text-xs font-bold px-2 py-1 rounded-md ${
            isDark
              ? 'bg-slate-700 text-slate-200'
              : 'bg-amber-100 text-amber-900'
          }`}>
            {isDark ? '🌙 Dark Mode' : '☀️ Light Mode'}
          </span>
        </div>

        <div
          ref={containerRef}
          className="h-[200px] rounded-xl overflow-hidden border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800"
        >
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full h-full cursor-crosshair touch-none"
          />
        </div>

        {!hasSignature && (
          <p className="text-xs text-slate-500 text-center mt-2">
            Sign above the line with your finger or stylus
          </p>
        )}

        {/* Action buttons */}
        {hasSignature && (
          <div className="mt-3 flex gap-2 flex-wrap">
            <button
              onClick={undo}
              disabled={disabled || !canUndo}
              className={`px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-1 ${
                canUndo && !disabled
                  ? 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  : 'text-slate-400 dark:text-slate-500 cursor-not-allowed'
              }`}
            >
              <span className="material-symbols-outlined text-base">undo</span>
              <span>Undo</span>
            </button>

            <button
              onClick={clearSignature}
              disabled={disabled}
              className="px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Clear signature
            </button>
          </div>
        )}
      </div>

      {/* Formal Attestation Checkbox */}
      <div className="px-4 pb-4">
        <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border-2 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 dark:hover:border-emerald-600 transition-colors">
          <input
            type="checkbox"
            checked={isConfirmed}
            onChange={(e) => setIsConfirmed(e.target.checked)}
            disabled={disabled}
            className="mt-1 w-6 h-6 rounded accent-emerald-500"
          />
          <span className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm">
            <strong className="text-slate-900 dark:text-white block mb-1">
              ✓ Formal Attestation & Authorization
            </strong>
            I certify that I have inspected the completed work and am fully satisfied with the quality and results.
            I confirm that all photographic evidence has been sealed and authenticated.
            I authorize invoicing for this job and accept the documented evidence as official proof of completion.
          </span>
        </label>
      </div>

      {/* Action Buttons */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
        <motion.button
          onClick={handleConfirm}
          disabled={!canSave}
          whileHover={canSave ? { y: -2 } : undefined}
          whileTap={canSave ? { scale: 0.98 } : undefined}
          className={`w-full px-6 py-4 rounded-xl font-bold text-lg min-h-[56px] transition-all flex items-center justify-center gap-2 ${
            canSave
              ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
          }`}
        >
          {isSaving ? (
            <>
              <span className="material-symbols-outlined animate-spin">
                progress_activity
              </span>
              Saving...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined">check_circle</span>
              Confirm & Sign
            </>
          )}
        </motion.button>

        {!hasSignature && (
          <p className="text-xs text-center text-slate-500 mt-2">
            Signature required
          </p>
        )}
        {hasSignature && !isConfirmed && (
          <p className="text-xs text-center text-amber-600 dark:text-amber-400 mt-2">
            Please check the confirmation box
          </p>
        )}
      </div>
    </motion.div>
  );
};

export default React.memo(ClientConfirmationCanvas);
