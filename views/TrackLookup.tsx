import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Track Lookup Page
 * Entry point for technicians who have received a dispatch link
 *
 * Features:
 * - Accepts full URL or just token
 * - Clean UX for technicians
 * - Mobile-optimized
 * - Clear instructions
 */
const TrackLookup: React.FC = () => {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!input.trim()) {
      setError('Please enter your dispatch link or token');
      return;
    }

    try {
      // Extract token from various formats
      let token = input.trim();

      // If it's a full URL, extract the token
      if (token.includes('/track/')) {
        const parts = token.split('/track/');
        token = parts[1] || '';
        // Remove hash if present
        token = token.replace('#', '').split('?')[0];
      } else if (token.includes('#/track/')) {
        const parts = token.split('#/track/');
        token = parts[1] || '';
        token = token.split('?')[0];
      }

      if (!token) {
        setError('Invalid link format. Please paste the full link you received.');
        return;
      }

      // Navigate to the track page
      navigate(`/track/${token}`);
    } catch (err) {
      setError('Invalid link format. Please paste the full link you received.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-6 md:px-6 md:py-8">
      <div className="max-w-xl w-full space-y-8 animate-in">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="size-20 bg-primary/20 rounded-[2rem] flex items-center justify-center mx-auto border border-primary/20">
            <span className="material-symbols-outlined text-primary text-5xl">engineering</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tighter uppercase">
              Access Your Job
            </h1>
            <p className="text-slate-400 text-base sm:text-lg max-w-md mx-auto">
              Enter the link you received via SMS, email, or QR code
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 sm:p-8 space-y-4">
            <label className="block">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">
                Job Link or Token
              </span>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste your magic link or token here"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-4 px-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-primary outline-none transition-all text-sm sm:text-base"
              />
            </label>

            {error && (
              <div className="bg-danger/10 border border-danger/20 rounded-xl p-4">
                <p className="text-danger text-sm font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">error</span>
                  {error}
                </p>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-4 bg-primary hover:bg-primary-hover text-white font-black rounded-xl uppercase tracking-widest text-sm transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">arrow_forward</span>
              Open Job
            </button>
          </div>
        </form>

        {/* Help Text */}
        <div className="bg-white/5 border border-white/5 rounded-2xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-primary flex-shrink-0">help_center</span>
            <div className="space-y-2 text-sm text-slate-300">
              <p className="font-bold text-white">Examples of valid formats:</p>
              <ul className="space-y-1 text-xs">
                <li className="font-mono text-slate-400">
                  https://jobproof.pro/#/track/abc123-def456
                </li>
                <li className="font-mono text-slate-400">
                  abc123-def456
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer Links */}
        <div className="text-center space-y-3">
          <p className="text-slate-300 text-sm">
            Don't have a job link?
          </p>
          <button
            onClick={() => navigate('/auth')}
            className="text-primary hover:text-primary-hover font-bold text-sm uppercase tracking-widest transition-colors"
          >
            Sign in as Manager →
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrackLookup;
