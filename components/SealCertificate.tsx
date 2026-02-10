/**
 * SealCertificate Component
 *
 * Generates a downloadable certificate image for sealed jobs.
 * UX improvements:
 * - Clear visual hierarchy with distinct heading sizes
 * - Client signature rendered in certificate
 * - Photo count broken down by type (before/during/after)
 * - Completion notes included if present
 * - Better spacing and section separation
 * - Stronger color coding for sealed status
 *
 * Phase: 10/10 UX Improvements
 */

import React, { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import type { Job } from '../types';
import Modal from './ui/Modal';

interface SealCertificateProps {
  job: Job;
  isOpen: boolean;
  onClose: () => void;
}

const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    }) + ' UTC';
  } catch {
    return dateString;
  }
};

const truncateHash = (hash: string | undefined, length: number = 32): string => {
  if (!hash) return 'N/A';
  if (hash.length <= length) return hash;
  return `${hash.substring(0, length / 2)}...${hash.substring(hash.length - length / 2)}`;
};

const SealCertificate: React.FC<SealCertificateProps> = ({ job, isOpen, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const photoCounts = useMemo(() => ({
    before: (job.photos || []).filter(p => p.type?.toLowerCase() === 'before').length,
    during: (job.photos || []).filter(p => p.type?.toLowerCase() === 'during').length,
    after: (job.photos || []).filter(p => p.type?.toLowerCase() === 'after').length,
    total: (job.photos || []).length,
  }), [job.photos]);

  const generateCertificate = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsGenerating(true);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsGenerating(false);
      return;
    }

    const width = 800;
    const height = 1120;
    canvas.width = width;
    canvas.height = height;

    // Background
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#0f172a');
    gradient.addColorStop(0.5, '#1e293b');
    gradient.addColorStop(1, '#0f172a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Outer border
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.strokeRect(16, 16, width - 32, height - 32);

    // Inner border
    ctx.strokeStyle = '#10b98130';
    ctx.lineWidth = 1;
    ctx.strokeRect(28, 28, width - 56, height - 56);

    // Corner accents
    const drawCorner = (x: number, y: number, dx: number, dy: number) => {
      ctx.fillStyle = '#10b981';
      ctx.fillRect(x, y, dx * 35, 3);
      ctx.fillRect(x, y, 3, dy * 35);
    };
    drawCorner(16, 16, 1, 1);
    drawCorner(width - 16, 16, -1, 1);
    drawCorner(16, height - 16, 1, -1);
    drawCorner(width - 16, height - 16, -1, -1);

    // Top banner
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('JOBPROOF  \u2022  EVIDENCE  SEAL  \u2022  CERTIFICATE', width / 2, 68);

    // Verified icon
    ctx.font = 'bold 52px system-ui';
    ctx.fillStyle = '#10b981';
    ctx.fillText('\u2713', width / 2, 140);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px system-ui';
    ctx.fillText('CERTIFICATE OF AUTHENTICITY', width / 2, 186);

    // Subtitle
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px system-ui';
    ctx.fillText('Cryptographically Sealed Evidence Record', width / 2, 212);

    // Divider
    ctx.strokeStyle = '#10b98140';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(80, 236);
    ctx.lineTo(width - 80, 236);
    ctx.stroke();

    let y = 276;

    // Job title
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 10px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('JOB', width / 2, y);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui';
    const title = job.title.length > 45 ? job.title.substring(0, 45) + '...' : job.title;
    ctx.fillText(title, width / 2, y + 26);

    y += 60;

    // Field helpers
    const drawFieldLeft = (label: string, value: string, yPos: number) => {
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 9px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(label.toUpperCase(), 100, yPos);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '15px system-ui';
      const v = value.length > 28 ? value.substring(0, 28) + '...' : value;
      ctx.fillText(v, 100, yPos + 20);
    };

    const drawFieldRight = (label: string, value: string, yPos: number) => {
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 9px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(label.toUpperCase(), 440, yPos);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '15px system-ui';
      const v = value.length > 28 ? value.substring(0, 28) + '...' : value;
      ctx.fillText(v, 440, yPos + 20);
    };

    drawFieldLeft('Client', job.client || 'N/A', y);
    drawFieldRight('Technician', job.technician || 'N/A', y);
    y += 55;
    drawFieldLeft('Location', job.address || 'N/A', y);
    drawFieldRight('W3W', job.w3w || 'Not captured', y);
    y += 55;
    drawFieldLeft('Job Date', formatDate(job.date), y);
    drawFieldRight('Status', job.status || 'Sealed', y);

    // Evidence section
    y += 60;
    ctx.strokeStyle = '#10b98130';
    ctx.beginPath();
    ctx.moveTo(80, y);
    ctx.lineTo(width - 80, y);
    ctx.stroke();

    y += 30;
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 10px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('EVIDENCE CAPTURED', width / 2, y);

    y += 28;
    const drawPhotoBadge = (label: string, count: number, color: string, x: number) => {
      ctx.fillStyle = color + '30';
      ctx.beginPath();
      ctx.roundRect(x - 50, y - 12, 100, 30, 8);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.font = 'bold 13px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(`${count} ${label}`, x, y + 6);
    };

    drawPhotoBadge('Before', photoCounts.before, '#3b82f6', width / 2 - 140);
    drawPhotoBadge('During', photoCounts.during, '#f59e0b', width / 2);
    drawPhotoBadge('After', photoCounts.after, '#10b981', width / 2 + 140);

    y += 36;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`${photoCounts.total} total photos + client signature`, width / 2, y);

    // Completion notes
    if (job.completionNotes) {
      y += 35;
      ctx.strokeStyle = '#f59e0b30';
      ctx.beginPath();
      ctx.moveTo(100, y);
      ctx.lineTo(width - 100, y);
      ctx.stroke();

      y += 24;
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 10px system-ui';
      ctx.fillText('COMPLETION NOTES', width / 2, y);

      y += 18;
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '12px system-ui';
      const noteLines = job.completionNotes.split('\n').slice(0, 3);
      for (const line of noteLines) {
        const trimmed = line.length > 70 ? line.substring(0, 70) + '...' : line;
        ctx.fillText(trimmed, width / 2, y);
        y += 16;
      }
    }

    // Seal section
    y += 20;
    ctx.strokeStyle = '#10b98140';
    ctx.beginPath();
    ctx.moveTo(80, y);
    ctx.lineTo(width - 80, y);
    ctx.stroke();

    y += 30;

    const sealBoxY = y;
    ctx.fillStyle = '#10b98115';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 210, sealBoxY, 420, 110, 16);
    ctx.fill();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(width / 2 - 210, sealBoxY, 420, 110, 16);
    ctx.stroke();

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('\u2713  CRYPTOGRAPHICALLY SEALED', width / 2, sealBoxY + 28);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px system-ui';
    ctx.fillText(formatDate(job.sealedAt), width / 2, sealBoxY + 52);

    ctx.fillStyle = '#64748b';
    ctx.font = '9px monospace';
    ctx.fillText('SHA-256 EVIDENCE HASH', width / 2, sealBoxY + 76);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px monospace';
    ctx.fillText(truncateHash(job.evidenceHash, 52), width / 2, sealBoxY + 92);

    y = sealBoxY + 130;

    // Client signature
    if (job.clientConfirmation?.signature) {
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('CLIENT SIGNATURE', width / 2, y);

      y += 8;
      try {
        const img = new Image();
        img.src = job.clientConfirmation.signature;
        await new Promise<void>((resolve) => {
          img.onload = () => {
            const sigWidth = 200;
            const sigHeight = 60;
            ctx.drawImage(img, width / 2 - sigWidth / 2, y, sigWidth, sigHeight);
            resolve();
          };
          img.onerror = () => resolve();
          setTimeout(resolve, 500);
        });
      } catch {
        // Skip if signature rendering fails
      }

      y += 72;
      ctx.fillStyle = '#475569';
      ctx.font = '10px system-ui';
      ctx.fillText(`Signed: ${formatDate(job.clientConfirmation.timestamp)}`, width / 2, y);
      y += 20;
    }

    // Verification URL
    y += 10;
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 10px system-ui';
    ctx.fillText('VERIFY THIS CERTIFICATE', width / 2, y);
    ctx.fillStyle = '#3b82f6';
    ctx.font = '13px system-ui';
    const verifyUrl = `${window.location.origin}/#/verify/${job.id}`;
    ctx.fillText(verifyUrl, width / 2, y + 20);

    // Footer
    const footerY = height - 68;
    ctx.fillStyle = '#475569';
    ctx.font = '10px system-ui';
    ctx.fillText('This certificate confirms evidence integrity using RSA-2048 + SHA-256 cryptographic sealing', width / 2, footerY);
    ctx.fillText(`Generated: ${new Date().toLocaleDateString('en-GB')}  |  Job ID: ${job.id.substring(0, 8)}...`, width / 2, footerY + 16);

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 13px system-ui';
    ctx.fillText('JOBPROOF.PRO', width / 2, height - 36);

    setIsGenerating(false);
  }, [job, photoCounts]);

  const downloadCertificate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `JobProof-Certificate-${job.title.replace(/[^a-z0-9]/gi, '-').substring(0, 30)}-${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
  }, [job.title]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(generateCertificate, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, generateCertificate]);

  if (!job.sealedAt) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="lg">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="size-16 mx-auto mb-4 rounded-2xl bg-success/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-success font-black" aria-hidden="true">verified</span>
          </div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">
            Seal Certificate
          </h2>
          <p className="text-sm text-slate-300 mt-1">
            Download your cryptographic evidence certificate
          </p>
        </div>

        {/* Certificate Preview */}
        <div className="relative bg-slate-900 rounded-2xl p-4 overflow-hidden">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`Seal certificate for job: ${job.title}`}
            className="w-full h-auto rounded-xl"
            style={{ maxHeight: '450px', objectFit: 'contain' }}
          />
          {isGenerating && (
            <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center rounded-xl">
              <div className="flex items-center gap-3">
                <div className="size-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                <span className="text-sm text-slate-400">Generating certificate...</span>
              </div>
            </div>
          )}
        </div>

        {/* Certificate Details */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800/50 border border-white/5 rounded-xl p-3">
            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Sealed</p>
            <p className="text-sm font-bold text-white mt-1">{formatDate(job.sealedAt)}</p>
          </div>
          <div className="bg-slate-800/50 border border-white/5 rounded-xl p-3">
            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Evidence</p>
            <p className="text-sm font-bold text-white mt-1">{photoCounts.total} photos + signature</p>
          </div>
        </div>

        {/* Photo Breakdown */}
        <div className="flex gap-2">
          <div className="flex-1 bg-blue-500/10 border border-blue-500/20 rounded-xl p-2.5 text-center">
            <p className="text-lg font-bold text-blue-400">{photoCounts.before}</p>
            <p className="text-[9px] font-bold text-blue-400/70 uppercase">Before</p>
          </div>
          <div className="flex-1 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-center">
            <p className="text-lg font-bold text-amber-400">{photoCounts.during}</p>
            <p className="text-[9px] font-bold text-amber-400/70 uppercase">During</p>
          </div>
          <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 text-center">
            <p className="text-lg font-bold text-emerald-400">{photoCounts.after}</p>
            <p className="text-[9px] font-bold text-emerald-400/70 uppercase">After</p>
          </div>
        </div>

        {/* Hash */}
        <div className="bg-slate-800/50 border border-white/5 rounded-xl p-4">
          <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2">Evidence Hash (SHA-256)</p>
          <p className="text-xs font-mono text-slate-100 break-all">{job.evidenceHash || 'N/A'}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white border border-white/10 rounded-xl text-sm font-semibold tracking-wider transition-all min-h-[48px]"
          >
            Close
          </button>
          <button
            onClick={downloadCertificate}
            className="flex-1 px-4 py-3 bg-success hover:bg-success/90 text-white rounded-xl text-sm font-semibold tracking-wider transition-all flex items-center justify-center gap-2 min-h-[48px]"
          >
            <span className="material-symbols-outlined text-lg" aria-hidden="true">download</span>
            Download
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default React.memo(SealCertificate);
