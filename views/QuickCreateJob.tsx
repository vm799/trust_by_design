/**
 * QuickCreateJob.tsx - Public "Quick-Create" Page
 *
 * Simple, fast job creation that generates a "Bunker Link" for technicians.
 * No auth required. Works offline via IndexedDB fallback.
 *
 * Flow:
 * 1. Manager fills form (Job Name, Client Name, Manager Email, Address)
 * 2. Job saved to Supabase bunker_jobs + main jobs table (or queued offline)
 * 3. Bunker Link displayed: /run/[job_id]
 * 4. Manager shares link with technician
 *
 * Architecture:
 * - Optimistic: show bunker link immediately, sync in background
 * - Offline: save to IndexedDB, sync when online
 * - Bridge: also upserts into main jobs table for admin visibility
 */

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getBunkerRunUrl } from '../lib/redirects';
import Dexie, { type Table } from 'dexie';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// IndexedDB for offline queuing
interface PendingBunkerJob {
  id: string;
  payload: Record<string, unknown>;
  bunkerLink: string;
  createdAt: number;
  synced: boolean;
}

class QuickCreateDB extends Dexie {
  pending!: Table<PendingBunkerJob, string>;
  constructor() {
    super('QuickCreateDB');
    this.version(1).stores({ pending: 'id, synced, createdAt' });
  }
}

const qcDb = new QuickCreateDB();

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
  syncStatus: 'synced' | 'pending' | 'failed';
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
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Network status tracking
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync pending jobs when coming online
  useEffect(() => {
    if (!isOnline) return;
    const syncPending = async () => {
      try {
        const pending = await qcDb.pending.where('synced').equals(0).toArray();
        for (const job of pending) {
          try {
            await syncToSupabase(job.payload);
            await qcDb.pending.update(job.id, { synced: true });
          } catch { /* will retry next time online */ }
        }
      } catch { /* non-critical */ }
    };
    syncPending();
  }, [isOnline]);

  const generateJobId = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `JOB-${timestamp}-${random}`;
  };

  const syncToSupabase = async (payload: Record<string, unknown>) => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;

    // Save to bunker_jobs
    const response = await fetch(`${SUPABASE_URL}/rest/v1/bunker_jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status}`);
    }

    // Bridge: also upsert into main jobs table
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          id: payload.id,
          title: payload.title || `Bunker Job ${payload.id}`,
          description: payload.notes || '',
          notes: payload.notes || '',
          status: 'Pending',
          photos: [],
          created_at: payload.created_at,
          updated_at: new Date().toISOString(),
          origin: 'bunker',
        }),
      });
    } catch { /* Non-blocking bridge */ }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const jobId = generateJobId();

      const payload = {
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
      };

      const bunkerLink = getBunkerRunUrl(jobId, {
        managerEmail: formData.managerEmail,
        clientEmail: formData.clientEmail || undefined,
      });

      // Optimistic: show the link immediately
      let syncStatus: CreatedJob['syncStatus'] = 'pending';

      if (isOnline && SUPABASE_URL && SUPABASE_ANON_KEY) {
        try {
          await syncToSupabase(payload);
          syncStatus = 'synced';
        } catch {
          // Save to IndexedDB for later sync
          await qcDb.pending.put({
            id: jobId,
            payload,
            bunkerLink,
            createdAt: Date.now(),
            synced: false,
          });
          syncStatus = 'pending';
        }
      } else {
        // Offline: save to IndexedDB
        await qcDb.pending.put({
          id: jobId,
          payload,
          bunkerLink,
          createdAt: Date.now(),
          synced: false,
        });
        syncStatus = 'pending';
      }

      setCreatedJob({ id: jobId, bunkerLink, syncStatus });

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

  // Shared input classes for consistency
  const inputClasses = 'w-full bg-gray-100 dark:bg-slate-800 border-2 border-slate-600 focus:border-primary rounded-xl py-4 px-5 text-slate-900 dark:text-white placeholder-slate-500 outline-none transition-all min-h-[56px]';
  const labelClasses = 'text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest block mb-2';

  // Success state
  if (createdJob) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          {/* Success Header */}
          <div className="text-center">
            <div className="bg-success/20 size-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-success text-4xl">check_circle</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Job Created</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">Share this link with your technician</p>
          </div>

          {/* Sync Status */}
          {createdJob.syncStatus !== 'synced' && (
            <div className="bg-amber-900/30 p-3 rounded-xl border border-amber-700/50 flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-400 text-lg">cloud_off</span>
              <span className="text-xs text-amber-300 font-medium">
                Saved offline. Will sync when connected.
              </span>
            </div>
          )}

          {/* Job ID */}
          <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-white/15">
            <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Job ID</p>
            <p className="text-lg font-mono font-bold text-slate-900 dark:text-white">{createdJob.id}</p>
          </div>

          {/* Bunker Link */}
          <div className="bg-primary/10 p-4 rounded-xl border border-primary/30">
            <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">Bunker Link (works offline)</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={createdJob.bunkerLink}
                readOnly
                className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm font-mono"
              />
              <button
                onClick={copyToClipboard}
                className={`px-4 py-2 rounded-xl font-black text-sm uppercase transition-all min-h-[44px] ${
                  copied
                    ? 'bg-success text-white'
                    : 'bg-primary hover:bg-primary-hover text-white'
                }`}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* QR Code */}
          <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-white/15 text-center">
            <div className="inline-block p-4 bg-white rounded-xl mb-3">
              <QRCodeSVG value={createdJob.bunkerLink} size={128} level="M" />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Scan to open on technician&apos;s phone</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={createAnother}
              className="flex-1 py-4 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-xl font-black uppercase tracking-widest text-sm transition-all active:scale-[0.98] min-h-[56px]"
            >
              Create Another
            </button>
            <a
              href={createdJob.bunkerLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-4 bg-success hover:bg-green-500 text-white rounded-xl font-black uppercase tracking-widest text-sm transition-all text-center flex items-center justify-center min-h-[56px]"
            >
              Test Link
            </a>
          </div>

          {/* Instructions */}
          <div className="bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-white/10">
            <h3 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Next Steps</h3>
            <ol className="text-sm text-slate-500 dark:text-slate-400 space-y-1 list-decimal list-inside">
              <li>Send this link to your technician</li>
              <li>They open it on their phone (works offline)</li>
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
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
      <div className="max-w-md mx-auto p-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="material-symbols-outlined text-primary text-4xl mb-2">bolt</span>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Quick Create Job</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Create a job and get a bunker-proof link</p>
          {!isOnline && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-900/30 border border-amber-700/50 rounded-xl">
              <span className="material-symbols-outlined text-amber-400 text-sm">cloud_off</span>
              <span className="text-xs text-amber-300 font-medium">Offline - job will sync when connected</span>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-700/50 rounded-xl text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Job Details */}
          <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-white/15 space-y-4">
            <h2 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Job Details</h2>

            <div>
              <label htmlFor="qcj-job-name" className={labelClasses}>
                Job Name *
              </label>
              <input
                id="qcj-job-name"
                type="text"
                value={formData.jobName}
                onChange={(e) => handleInputChange('jobName', e.target.value)}
                placeholder="e.g., Kitchen Renovation - 123 Main St"
                required
                className={inputClasses}
              />
            </div>

            <div>
              <label htmlFor="qcj-client-name" className={labelClasses}>
                Client Name
              </label>
              <input
                id="qcj-client-name"
                type="text"
                value={formData.clientName}
                onChange={(e) => handleInputChange('clientName', e.target.value)}
                placeholder="e.g., John Smith"
                className={inputClasses}
              />
            </div>

            <div>
              <label htmlFor="qcj-address" className={labelClasses}>
                Address
              </label>
              <input
                id="qcj-address"
                type="text"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                placeholder="e.g., 123 Main St, City, State"
                className={inputClasses}
              />
            </div>

            <div>
              <label htmlFor="qcj-w3w" className={labelClasses}>
                What3Words Location
              </label>
              <input
                id="qcj-w3w"
                type="text"
                value={formData.w3w}
                onChange={(e) => handleInputChange('w3w', e.target.value)}
                placeholder="e.g., ///filled.count.soap"
                className={inputClasses}
              />
            </div>
          </div>

          {/* Contact Details */}
          <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-white/15 space-y-4">
            <h2 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Report Delivery</h2>

            <div>
              <label htmlFor="qcj-manager-email" className={labelClasses}>
                Manager Email * <span className="normal-case text-slate-500">(receives report)</span>
              </label>
              <input
                id="qcj-manager-email"
                type="email"
                value={formData.managerEmail}
                onChange={(e) => handleInputChange('managerEmail', e.target.value)}
                placeholder="manager@company.com"
                required
                className={inputClasses}
              />
            </div>

            <div>
              <label htmlFor="qcj-client-email" className={labelClasses}>
                Client Email <span className="normal-case text-slate-500">(optional)</span>
              </label>
              <input
                id="qcj-client-email"
                type="email"
                value={formData.clientEmail}
                onChange={(e) => handleInputChange('clientEmail', e.target.value)}
                placeholder="client@email.com"
                className={inputClasses}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-white/15">
            <label htmlFor="qcj-notes" className={labelClasses}>
              Notes for Technician
            </label>
            <textarea
              id="qcj-notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Any special instructions..."
              rows={3}
              className={`${inputClasses} resize-none`}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || !formData.jobName || !formData.managerEmail}
            className="w-full py-4 bg-primary hover:bg-primary-hover disabled:bg-gray-200 dark:disabled:bg-slate-700 disabled:text-slate-500 dark:disabled:text-slate-400 text-white rounded-xl font-black text-sm uppercase tracking-widest transition-all active:scale-[0.98] shadow-xl shadow-primary/20 min-h-[56px]"
          >
            {isSubmitting ? 'Creating...' : 'Create Job & Get Link'}
          </button>
        </form>

        {/* Back Link */}
        <div className="mt-6 text-center">
          <a
            href="/#/admin"
            className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm transition-colors"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
