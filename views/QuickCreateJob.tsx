/**
 * QuickCreateJob.tsx - Manager's "Quick-Create" Page
 *
 * Simple, fast job creation that generates a "Bunker Link" for technicians.
 * No complex routing, no auth required for technician access.
 *
 * Flow:
 * 1. Manager fills form (Job Name, Client Email, Manager Email, W3W)
 * 2. Job saved to Supabase
 * 3. Bunker Link displayed: /run/[job_id]
 * 4. Manager shares link with technician
 *
 * @author Claude Code - End-to-End Recovery
 */

import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getBunkerRunUrl } from '../lib/redirects';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface JobFormData {
  jobName: string;
  clientName: string;
  clientEmail: string;
  managerEmail: string;
  address: string;
  w3w: string;
  notes: string;
}

interface CreatedJob {
  id: string;
  bunkerLink: string;
}

export default function QuickCreateJob() {
  const [formData, setFormData] = useState<JobFormData>({
    jobName: '',
    clientName: '',
    clientEmail: '',
    managerEmail: '',
    address: '',
    w3w: '',
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdJob, setCreatedJob] = useState<CreatedJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateJobId = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `JOB-${timestamp}-${random}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const jobId = generateJobId();

      // Save to Supabase
      if (SUPABASE_URL && SUPABASE_ANON_KEY) {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/bunker_jobs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Prefer': 'return=representation',
          },
          body: JSON.stringify({
            id: jobId,
            title: formData.jobName || `Job ${jobId}`,
            client: formData.clientName || 'Client',
            client_email: formData.clientEmail,
            manager_email: formData.managerEmail,
            address: formData.address,
            w3w: formData.w3w,
            notes: formData.notes,
            status: 'Pending',
            created_at: new Date().toISOString(),
            last_updated: new Date().toISOString(),
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to create job: ${errorText}`);
        }
      }

      // Generate bunker link with emails embedded in hash URL
      // This enables the Public-Private handshake - tech receives emails in URL
      const bunkerLink = getBunkerRunUrl(jobId, {
        managerEmail: formData.managerEmail,
        clientEmail: formData.clientEmail || undefined,
      });

      setCreatedJob({ id: jobId, bunkerLink });

      // Reset form
      setFormData({
        jobName: '',
        clientName: '',
        clientEmail: '',
        managerEmail: '',
        address: '',
        w3w: '',
        notes: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create job');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = async () => {
    if (createdJob) {
      await navigator.clipboard.writeText(createdJob.bunkerLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleInputChange = (field: keyof JobFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const createAnother = () => {
    setCreatedJob(null);
    setCopied(false);
  };

  // Success state - show bunker link
  if (createdJob) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          {/* Success Header */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600/20 rounded-full mb-4">
              <span className="text-4xl">✓</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Job Created!</h1>
            <p className="text-slate-400 mt-2">Share this link with your technician</p>
          </div>

          {/* Job ID */}
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
            <p className="text-xs text-slate-400 mb-1">JOB ID</p>
            <p className="text-lg font-mono font-bold text-white">{createdJob.id}</p>
          </div>

          {/* Bunker Link */}
          <div className="bg-blue-900/30 p-4 rounded-xl border border-blue-700">
            <p className="text-xs text-blue-400 mb-2 font-medium">BUNKER LINK (works offline)</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={createdJob.bunkerLink}
                readOnly
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm font-mono"
              />
              <button
                onClick={copyToClipboard}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  copied
                    ? 'bg-green-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* QR Code */}
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 text-center">
            <div className="inline-block p-4 bg-white rounded-lg mb-3">
              <QRCodeSVG value={createdJob.bunkerLink} size={128} level="M" />
            </div>
            <p className="text-sm text-slate-400">Scan to open on technician&apos;s phone</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={createAnother}
              className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
            >
              Create Another
            </button>
            <a
              href={createdJob.bunkerLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors text-center"
            >
              Test Link →
            </a>
          </div>

          {/* Instructions */}
          <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
            <h3 className="text-sm font-medium text-slate-300 mb-2">Next Steps:</h3>
            <ol className="text-sm text-slate-400 space-y-1 list-decimal list-inside">
              <li>Send this link to your technician</li>
              <li>They open it on their phone (works offline!)</li>
              <li>They capture before/after photos + signature</li>
              <li>When back online, data syncs automatically</li>
              <li>PDF report emailed to you</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // Form state
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-md mx-auto p-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Quick Create Job</h1>
          <p className="text-slate-400">Create a job and get a bunker-proof link</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Job Details */}
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 space-y-4">
            <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wide">Job Details</h2>

            <div>
              <label htmlFor="qcj-job-name" className="block text-sm font-medium text-slate-300 mb-2">
                Job Name *
              </label>
              <input
                id="qcj-job-name"
                type="text"
                value={formData.jobName}
                onChange={(e) => handleInputChange('jobName', e.target.value)}
                placeholder="e.g., Kitchen Renovation - 123 Main St"
                required
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="qcj-client-name" className="block text-sm font-medium text-slate-300 mb-2">
                Client Name
              </label>
              <input
                id="qcj-client-name"
                type="text"
                value={formData.clientName}
                onChange={(e) => handleInputChange('clientName', e.target.value)}
                placeholder="e.g., John Smith"
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="qcj-address" className="block text-sm font-medium text-slate-300 mb-2">
                Address
              </label>
              <input
                id="qcj-address"
                type="text"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                placeholder="e.g., 123 Main St, City, State"
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="qcj-w3w" className="block text-sm font-medium text-slate-300 mb-2">
                What3Words Location
              </label>
              <input
                id="qcj-w3w"
                type="text"
                value={formData.w3w}
                onChange={(e) => handleInputChange('w3w', e.target.value)}
                placeholder="e.g., ///filled.count.soap"
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">
                Find your W3W at what3words.com
              </p>
            </div>
          </div>

          {/* Contact Details */}
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 space-y-4">
            <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wide">Report Delivery</h2>

            <div>
              <label htmlFor="qcj-manager-email" className="block text-sm font-medium text-slate-300 mb-2">
                Manager Email * (receives report)
              </label>
              <input
                id="qcj-manager-email"
                type="email"
                value={formData.managerEmail}
                onChange={(e) => handleInputChange('managerEmail', e.target.value)}
                placeholder="manager@company.com"
                required
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="qcj-client-email" className="block text-sm font-medium text-slate-300 mb-2">
                Client Email (optional - also receives report)
              </label>
              <input
                id="qcj-client-email"
                type="email"
                value={formData.clientEmail}
                onChange={(e) => handleInputChange('clientEmail', e.target.value)}
                placeholder="client@email.com"
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
            <label htmlFor="qcj-notes" className="block text-sm font-medium text-slate-300 mb-2">
              Notes for Technician
            </label>
            <textarea
              id="qcj-notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Any special instructions..."
              rows={3}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || !formData.jobName || !formData.managerEmail}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-bold text-lg transition-colors btn-field"
          >
            {isSubmitting ? 'Creating...' : 'CREATE JOB & GET LINK'}
          </button>
        </form>

        {/* Back Link */}
        <div className="mt-6 text-center">
          <a
            href="/#/admin"
            className="text-slate-400 hover:text-white text-sm transition-colors"
          >
            ← Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
