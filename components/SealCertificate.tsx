/**
 * SealCertificate Component
 *
 * Generates a downloadable certificate image for sealed jobs.
 * Shows job details, seal hash, timestamp, and verification URL.
 *
 * Phase: 10/10 UX Improvements
 */

import React, { useRef, useCallback, useState } from 'react';
import type { Job } from '../types';
import Modal from './ui/Modal';

interface SealCertificateProps {
  job: Job;
  isOpen: boolean;
  onClose: () => void;
}

const SealCertificate: React.FC<SealCertificateProps> = ({ job, isOpen, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Format date in British English with UTC timezone for legal validity
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

  const generateCertificate = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsGenerating(true);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Certificate dimensions (portrait A4-like aspect ratio)
    const width = 800;
    const height = 1000;
    canvas.width = width;
    canvas.height = height;

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#0f172a');
    gradient.addColorStop(1, '#1e293b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Border
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, width - 40, height - 40);

    // Inner border
    ctx.strokeStyle = '#10b98140';
    ctx.lineWidth = 2;
    ctx.strokeRect(35, 35, width - 70, height - 70);

    // Corner decorations
    const cornerSize = 40;
    ctx.fillStyle = '#10b981';
    // Top-left
    ctx.fillRect(20, 20, cornerSize, 4);
    ctx.fillRect(20, 20, 4, cornerSize);
    // Top-right
    ctx.fillRect(width - 20 - cornerSize, 20, cornerSize, 4);
    ctx.fillRect(width - 24, 20, 4, cornerSize);
    // Bottom-left
    ctx.fillRect(20, height - 24, cornerSize, 4);
    ctx.fillRect(20, height - 20 - cornerSize, 4, cornerSize);
    // Bottom-right
    ctx.fillRect(width - 20 - cornerSize, height - 24, cornerSize, 4);
    ctx.fillRect(width - 24, height - 20 - cornerSize, 4, cornerSize);

    // Header
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 14px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('JOBPROOF EVIDENCE SEAL', width / 2, 80);

    // Shield icon representation (using text)
    ctx.font = 'bold 60px system-ui';
    ctx.fillStyle = '#10b981';
    ctx.fillText('✓', width / 2, 160);

    // Certificate title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px system-ui';
    ctx.fillText('CERTIFICATE OF AUTHENTICITY', width / 2, 220);

    // Subtitle
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px system-ui';
    ctx.fillText('Cryptographically Sealed Evidence Record', width / 2, 250);

    // Decorative line
    ctx.strokeStyle = '#10b98160';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(100, 280);
    ctx.lineTo(width - 100, 280);
    ctx.stroke();

    // Job details section
    let y = 330;
    const leftCol = 120;
    const rightCol = 420;

    const drawField = (label: string, value: string, x: number, yPos: number) => {
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 11px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(label.toUpperCase(), x, yPos);
      ctx.fillStyle = '#ffffff';
      ctx.font = '16px system-ui';
      ctx.fillText(value, x, yPos + 22);
    };

    // Job title (full width)
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('JOB TITLE', width / 2, y);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px system-ui';
    const title = job.title.length > 40 ? job.title.substring(0, 40) + '...' : job.title;
    ctx.fillText(title, width / 2, y + 30);

    y += 80;

    // Two column layout
    drawField('Client', job.client || 'N/A', leftCol, y);
    drawField('Technician', job.technician || 'N/A', rightCol, y);

    y += 70;

    drawField('Location', job.address || 'N/A', leftCol, y);
    drawField('W3W', job.w3w || 'Not captured', rightCol, y);

    y += 70;

    drawField('Evidence Photos', `${job.photos?.length || 0} photos captured`, leftCol, y);
    drawField('Status', job.status || 'Sealed', rightCol, y);

    // Seal section
    y += 90;
    ctx.strokeStyle = '#10b98140';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(100, y);
    ctx.lineTo(width - 100, y);
    ctx.stroke();

    y += 40;

    // Seal badge
    ctx.fillStyle = '#10b98120';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 200, y, 400, 120, 16);
    ctx.fill();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Sealed at
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('SEALED', width / 2, y + 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px system-ui';
    ctx.fillText(formatDate(job.sealedAt), width / 2, y + 55);

    // Hash
    ctx.fillStyle = '#64748b';
    ctx.font = '10px monospace';
    ctx.fillText('SHA-256 HASH', width / 2, y + 85);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px monospace';
    ctx.fillText(truncateHash(job.evidenceHash, 48), width / 2, y + 102);

    // Verification URL
    y += 160;
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 11px system-ui';
    ctx.fillText('VERIFY THIS CERTIFICATE', width / 2, y);
    ctx.fillStyle = '#3b82f6';
    ctx.font = '14px system-ui';
    const verifyUrl = `${window.location.origin}/#/verify/${job.id}`;
    ctx.fillText(verifyUrl, width / 2, y + 22);

    // Footer
    y = height - 80;
    ctx.fillStyle = '#475569';
    ctx.font = '11px system-ui';
    ctx.fillText('This certificate confirms evidence integrity using RSA-2048 + SHA-256 encryption', width / 2, y);
    ctx.fillText(`Generated: ${new Date().toLocaleDateString('en-GB')} | Job ID: ${job.id.substring(0, 8)}...`, width / 2, y + 18);

    // JobProof branding
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 14px system-ui';
    ctx.fillText('JOBPROOF.PRO', width / 2, height - 40);

    setIsGenerating(false);
  }, [job]);

  const downloadCertificate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `JobProof-Certificate-${job.title.replace(/[^a-z0-9]/gi, '-').substring(0, 30)}-${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
  }, [job.title]);

  // Generate certificate when modal opens
  React.useEffect(() => {
    if (isOpen) {
      // Small delay to ensure canvas is mounted
      setTimeout(generateCertificate, 100);
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
            <span className="material-symbols-outlined text-4xl text-success font-black">verified</span>
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
            className="w-full h-auto rounded-xl"
            style={{ maxHeight: '400px', objectFit: 'contain' }}
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

        {/* Certificate Details Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800/50 border border-white/5 rounded-xl p-3">
            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Sealed</p>
            <p className="text-sm font-bold text-white mt-1">{formatDate(job.sealedAt)}</p>
          </div>
          <div className="bg-slate-800/50 border border-white/5 rounded-xl p-3">
            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Evidence</p>
            <p className="text-sm font-bold text-white mt-1">{job.photos?.length || 0} photos + signature</p>
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
            className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white border border-white/10 rounded-xl text-sm font-semibold tracking-wider transition-all"
          >
            Close
          </button>
          <button
            onClick={downloadCertificate}
            className="flex-1 px-4 py-3 bg-success hover:bg-success/90 text-white rounded-xl text-sm font-semibold tracking-wider transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">download</span>
            Download
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default React.memo(SealCertificate);
