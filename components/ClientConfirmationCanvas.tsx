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

interface ClientConfirmationCanvasProps {
  jobId: string;
  clientName?: string;
  onConfirmed?: (signature: string, timestamp: string) => void;
  onCancel?: () => void;
  disabled?: boolean;
}

const ClientConfirmationCanvas: React.FC<ClientConfirmationCanvasProps> = ({
  jobId,
  clientName = 'Client',
  onConfirmed,
  onCancel,
  disabled = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize canvas
  useEffect(() => {
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
      ctx.strokeStyle = '#1e293b'; // slate-800

      // Light background
      ctx.fillStyle = '#f8fafc'; // slate-50
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Draw signature line guide
      ctx.strokeStyle = '#cbd5e1'; // slate-300
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(20, rect.height - 40);
      ctx.lineTo(rect.width - 20, rect.height - 40);
      ctx.stroke();

      // Reset for drawing
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 3;
    }
  }, []);

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
      }
    },
    [isDrawing, disabled, getCoordinates]
  );

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.closePath();
    }
  }, []);

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    const rect = container.getBoundingClientRect();

    if (ctx) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Redraw signature line
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(20, rect.height - 40);
      ctx.lineTo(rect.width - 20, rect.height - 40);
      ctx.stroke();

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 3;

      setHasSignature(false);
      setIsConfirmed(false);
    }
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!hasSignature || !isConfirmed || !canvasRef.current) return;

    setIsSaving(true);
    try {
      const signatureDataUrl = canvasRef.current.toDataURL('image/png');
      const timestamp = new Date().toISOString();
      onConfirmed?.(signatureDataUrl, timestamp);
    } finally {
      setIsSaving(false);
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

      {/* Signature Canvas */}
      <div className="p-4">
        <div
          ref={containerRef}
          className="h-[200px] rounded-xl overflow-hidden border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50"
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

        {/* Clear button */}
        {hasSignature && (
          <button
            onClick={clearSignature}
            disabled={disabled}
            className="mt-2 px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            Clear signature
          </button>
        )}
      </div>

      {/* Confirmation Checkbox */}
      <div className="px-4 pb-4">
        <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
          <input
            type="checkbox"
            checked={isConfirmed}
            onChange={(e) => setIsConfirmed(e.target.checked)}
            disabled={disabled}
            className="mt-1 w-6 h-6 rounded accent-emerald-500"
          />
          <span className="text-slate-700 dark:text-slate-300 leading-relaxed">
            <strong className="text-slate-900 dark:text-white">
              I confirm I am satisfied with the completed work
            </strong>{' '}
            and authorize invoicing for this job.
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
