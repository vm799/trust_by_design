/**
 * BunkerSuccess.tsx - Success Page After Job Sync
 *
 * Displays confirmation that the job report was sent.
 * Part of the Public-Private Handshake - shows manager email from localStorage.
 *
 * Features:
 * - Shows "Report Sent to [Manager Email]"
 * - "New Job" button to go to Job Log
 * - "Create Another" button for managers
 * - Works completely offline (reads from localStorage)
 *
 * @author Claude Code - Public-Private Handshake
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HandshakeService } from '../lib/handshakeService';

// LocalStorage keys (must match BunkerRun.tsx)
const STORAGE_KEYS = {
  MANAGER_EMAIL: 'bunker_manager_email',
  CLIENT_EMAIL: 'bunker_client_email',
  JOB_ID: 'bunker_current_job_id',
  JOB_TITLE: 'bunker_job_title',
} as const;

interface JobDetails {
  id: string | null;
  title: string | null;
  managerEmail: string | null;
  clientEmail: string | null;
}

export default function BunkerSuccess() {
  const navigate = useNavigate();
  const [jobDetails, setJobDetails] = useState<JobDetails>({
    id: null,
    title: null,
    managerEmail: null,
    clientEmail: null,
  });

  // Load job details from localStorage on mount
  useEffect(() => {
    const details: JobDetails = {
      id: localStorage.getItem(STORAGE_KEYS.JOB_ID),
      title: localStorage.getItem(STORAGE_KEYS.JOB_TITLE),
      managerEmail: localStorage.getItem(STORAGE_KEYS.MANAGER_EMAIL),
      clientEmail: localStorage.getItem(STORAGE_KEYS.CLIENT_EMAIL),
    };
    setJobDetails(details);
    console.log('[BunkerSuccess] Loaded job details from localStorage:', details);
  }, []);

  const handleNewJob = () => {
    // CRITICAL FIX: Clear handshake lock to allow next technician to access new jobs
    HandshakeService.clear();
    console.log('[BunkerSuccess] Handshake cleared for next job');

    // Clear stored job details for next job
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    // Navigate to job log to see completed jobs
    navigate('/job-log');
  };

  const handleCreateAnother = () => {
    // CRITICAL FIX: Clear handshake lock to allow next technician to access new jobs
    HandshakeService.clear();
    console.log('[BunkerSuccess] Handshake cleared for create another');

    // Clear stored job details for next job
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    // Navigate to create job page (for managers)
    navigate('/create-job');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 text-center">
        {/* Success Icon */}
        <div className="inline-flex items-center justify-center w-24 h-24 bg-green-600/20 rounded-full mx-auto">
          <span className="text-6xl">&#x2713;</span>
        </div>

        {/* Success Message */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white">Job Complete!</h1>
          <p className="text-lg text-slate-400">Evidence synced successfully</p>
        </div>

        {/* Job Details Card */}
        {jobDetails.id && (
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 text-left space-y-3">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Job ID</p>
              <p className="text-lg font-mono font-bold text-white">{jobDetails.id}</p>
            </div>
            {jobDetails.title && (
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide">Job Title</p>
                <p className="text-white">{jobDetails.title}</p>
              </div>
            )}
          </div>
        )}

        {/* Report Sent Confirmation */}
        <div className="bg-green-900/30 p-6 rounded-xl border border-green-700 space-y-3">
          <div className="flex items-center justify-center gap-2 text-green-400">
            <span className="text-2xl">&#x2709;</span>
            <span className="font-medium">Report Sent</span>
          </div>

          {jobDetails.managerEmail ? (
            <div className="space-y-2">
              <p className="text-sm text-green-300">
                PDF report emailed to:
              </p>
              <p className="text-lg font-medium text-white">
                {jobDetails.managerEmail}
              </p>
              {jobDetails.clientEmail && (
                <p className="text-sm text-green-300/70">
                  Also sent to: {jobDetails.clientEmail}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-green-300">
              Report will be available in the dashboard
            </p>
          )}
        </div>

        {/* Next Steps */}
        <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
          <h3 className="text-sm font-medium text-slate-300 mb-2">What happens next?</h3>
          <ul className="text-sm text-slate-400 space-y-1 text-left list-disc list-inside">
            <li>Manager reviews the evidence</li>
            <li>Client receives their copy</li>
            <li>Job is marked as complete</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleNewJob}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-lg transition-colors"
          >
            View Job Log
          </button>
          <button
            onClick={handleCreateAnother}
            className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
          >
            Create New Job
          </button>
        </div>

        {/* Footer */}
        <p className="text-xs text-slate-500">
          Your evidence is securely stored and tamper-proof
        </p>
      </div>
    </div>
  );
}
