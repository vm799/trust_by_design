/**
 * Landing Page V2 - With Proper Auth Flow
 * =========================================
 *
 * This is an updated landing page that uses the AuthFlowManager
 * to prevent circular redirects and handle auth properly.
 *
 * Key improvements:
 * - No circular redirects (proper state management)
 * - Ensures user row exists before rendering
 * - Handles 406 errors gracefully
 * - Handles null workspace_id properly
 * - Proper loading states
 */

import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthFlow } from '../hooks/useAuthFlow';

const LandingPageV2: React.FC = () => {
  const navigate = useNavigate();
  const { isLoading, isAuthenticated, user, needsSetup, error } = useAuthFlow();

  /**
   * Handle authentication state changes
   * This effect runs when auth state is fully loaded
   */
  useEffect(() => {
    // Don't redirect while loading
    if (isLoading) {
      return;
    }

    // If authenticated and needs setup, redirect to OAuth setup page
    if (isAuthenticated && needsSetup) {
      console.log('[LandingPageV2] User needs setup, redirecting to /auth/setup');
      navigate('/auth/setup', { replace: true });
      return;
    }

    // If fully authenticated with complete profile, redirect based on persona
    if (isAuthenticated && user && user.workspace) {
      console.log('[LandingPageV2] User authenticated, redirecting based on persona');

      // Get primary persona (first active persona)
      const primaryPersona = user.personas.find((p) => p.is_active)?.persona_type?.toLowerCase();

      // Redirect based on persona
      if (primaryPersona === 'technician' || primaryPersona === 'contractor' || primaryPersona === 'solo_contractor') {
        navigate('/contractor', { replace: true });
      } else if (primaryPersona === 'client') {
        navigate('/client', { replace: true });
      } else {
        // Default to admin for managers/owners or users without persona
        navigate('/admin', { replace: true });
      }
      return;
    }

    // If not authenticated, stay on landing page (no redirect)
    console.log('[LandingPageV2] User not authenticated, showing landing page');
  }, [isLoading, isAuthenticated, user, needsSetup, navigate]);

  /**
   * Show loading state while auth is initializing
   */
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  /**
   * Show error state if auth initialization failed
   */
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-4">
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-400 mb-2">Authentication Error</h2>
          <p className="text-red-300 mb-4">{error.message}</p>
          <p className="text-sm text-red-400 font-mono">{error.code}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  /**
   * Main landing page content (shown when not authenticated)
   */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">JP</span>
            </div>
            <span className="text-white text-xl font-bold">JobProof</span>
          </div>
          <nav className="flex items-center space-x-4">
            <Link
              to="/pricing"
              className="text-slate-300 hover:text-white transition-colors"
            >
              Pricing
            </Link>
            <Link
              to="/auth"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors"
            >
              Sign In
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Evidence-First Job Documentation
          </h1>
          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            Cryptographic proof for every job. Build trust with clients through
            immutable evidence and professional documentation.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/auth"
              className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-semibold rounded-lg transition-colors shadow-lg"
            >
              Get Started Free
            </Link>
            <Link
              to="/pricing"
              className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white text-lg font-semibold rounded-lg transition-colors border border-white/20"
            >
              View Pricing
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-20 grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
            <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Cryptographic Sealing</h3>
            <p className="text-slate-400">
              Every job is cryptographically sealed with SHA-256 hashing and RSA-2048 signatures.
              Evidence cannot be tampered with after sealing.
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
            <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Smart Photo Evidence</h3>
            <p className="text-slate-400">
              Capture timestamped, geotagged photos with automatic organization.
              Build comprehensive evidence bundles.
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
            <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Professional Reports</h3>
            <p className="text-slate-400">
              Generate branded PDF reports with evidence, signatures, and compliance certifications.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 mt-20 border-t border-white/10">
        <div className="flex flex-col md:flex-row items-center justify-between text-slate-400 text-sm">
          <p>&copy; 2026 JobProof. All rights reserved.</p>
          <div className="flex items-center space-x-6 mt-4 md:mt-0">
            <Link to="/legal" className="hover:text-white transition-colors">
              Terms
            </Link>
            <Link to="/legal" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <Link to="/help" className="hover:text-white transition-colors">
              Help
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPageV2;
