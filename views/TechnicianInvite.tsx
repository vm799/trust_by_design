import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Job } from '../types';
import { getJobByToken, recordMagicLinkAccess } from '../lib/db';
import { OfflineBanner } from '../components/OfflineBanner';

/**
 * TechnicianInvite - Simple invite landing page for technicians
 *
 * This is a lightweight entry point that:
 * 1. Validates the magic link token
 * 2. Displays job details (title, client, address)
 * 3. Allows technician to proceed to the full work interface
 *
 * Route: /#/technician/:token
 */

interface InviteState {
  status: 'loading' | 'valid' | 'expired' | 'invalid' | 'error';
  job: Job | null;
  errorMessage: string | null;
}

const TechnicianInvite: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<InviteState>({
    status: 'loading',
    job: null,
    errorMessage: null,
  });

  // Load job by token on mount
  useEffect(() => {
    const loadJob = async () => {
      if (!token) {
        setState({
          status: 'invalid',
          job: null,
          errorMessage: 'No invite token provided.',
        });
        return;
      }

      try {
        const result = await getJobByToken(token);

        if (result.success && result.data) {
          // Record that link was accessed
          recordMagicLinkAccess(token);

          setState({
            status: 'valid',
            job: result.data,
            errorMessage: null,
          });
        } else {
          // Determine error type from message
          const errorMsg = result.error || 'Invalid or expired link.';
          const isExpired = errorMsg.toLowerCase().includes('expired');

          setState({
            status: isExpired ? 'expired' : 'invalid',
            job: null,
            errorMessage: errorMsg,
          });
        }
      } catch (error) {
        console.error('[TechnicianInvite] Error loading job:', error);
        setState({
          status: 'error',
          job: null,
          errorMessage: 'Failed to load job. Please check your connection.',
        });
      }
    };

    loadJob();
  }, [token]);

  // Handle proceeding to full work interface
  const handleStartWork = () => {
    if (state.job && token) {
      // Navigate to full TechnicianPortal with token
      navigate(`/track/${token}?jobId=${state.job.id}`);
    }
  };

  // Loading state
  if (state.status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="size-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-sm font-black uppercase tracking-widest">
            Loading Job...
          </p>
        </div>
      </div>
    );
  }

  // Error states
  if (state.status === 'expired' || state.status === 'invalid' || state.status === 'error') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <OfflineBanner />
        <div className="max-w-md w-full bg-slate-900 border border-white/10 rounded-[2rem] p-8 text-center space-y-6">
          <div className={`size-20 rounded-2xl flex items-center justify-center mx-auto ${
            state.status === 'expired' ? 'bg-warning/20' : 'bg-danger/20'
          }`}>
            <span className={`material-symbols-outlined text-5xl ${
              state.status === 'expired' ? 'text-warning' : 'text-danger'
            }`}>
              {state.status === 'expired' ? 'schedule' : 'error'}
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-white uppercase tracking-tight">
              {state.status === 'expired' ? 'Link Expired' : 'Invalid Link'}
            </h1>
            <p className="text-slate-400 text-sm">
              {state.errorMessage || 'This invite link is no longer valid.'}
            </p>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-4 text-left space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              What to do:
            </p>
            <ul className="text-sm text-slate-300 space-y-1">
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_forward</span>
                Contact your manager for a new link
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-primary text-sm mt-0.5">arrow_forward</span>
                Check if you have the correct URL
              </li>
            </ul>
          </div>

          <button
            onClick={() => navigate('/track-lookup')}
            className="w-full py-4 bg-primary text-white font-black rounded-xl uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.98]"
          >
            Enter Link Manually
          </button>
        </div>
      </div>
    );
  }

  // Valid job - show details
  const { job } = state;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <OfflineBanner />
      <div className="max-w-md w-full bg-slate-900 border border-white/10 rounded-[2rem] p-8 space-y-6">
        {/* Success Header */}
        <div className="text-center space-y-3">
          <div className="bg-success/20 size-20 rounded-2xl flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-success text-5xl">task_alt</span>
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight">
            Job Assignment
          </h1>
          <p className="text-slate-400 text-sm">
            You've been assigned a new job
          </p>
        </div>

        {/* Job Details Card */}
        <div className="bg-slate-800/50 rounded-xl p-5 border border-white/5 space-y-4">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Job Title
            </p>
            <p className="text-lg font-bold text-white">{job?.title || 'Untitled Job'}</p>
          </div>

          {job?.clientName && (
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                Client
              </p>
              <p className="text-white font-medium">{job.clientName}</p>
            </div>
          )}

          {job?.address && (
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                Location
              </p>
              <p className="text-slate-300 text-sm">{job.address}</p>
            </div>
          )}

          {job?.scheduledDate && (
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                Scheduled
              </p>
              <p className="text-slate-300 text-sm">
                {new Date(job.scheduledDate).toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          )}

          {job?.status && (
            <div className="flex items-center gap-2 pt-2 border-t border-white/5">
              <span className={`size-3 rounded-full ${
                job.status === 'Pending' ? 'bg-warning' :
                job.status === 'In Progress' ? 'bg-primary' :
                job.status === 'Complete' || job.status === 'Submitted' ? 'bg-success' :
                'bg-slate-500'
              }`} />
              <span className="text-sm font-bold text-slate-300 uppercase tracking-wide">
                {job.status}
              </span>
            </div>
          )}
        </div>

        {/* Notes Preview */}
        {job?.notes && (
          <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              Job Notes
            </p>
            <p className="text-sm text-slate-300 line-clamp-3">{job.notes}</p>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleStartWork}
          className="w-full py-5 bg-primary text-white font-black text-lg rounded-xl uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.98] flex items-center justify-center gap-3"
        >
          <span className="material-symbols-outlined text-2xl">play_arrow</span>
          Start Work
        </button>

        {/* Footer Info */}
        <p className="text-center text-xs text-slate-500">
          You can work offline. Photos and data will sync when connected.
        </p>
      </div>
    </div>
  );
};

export default TechnicianInvite;
