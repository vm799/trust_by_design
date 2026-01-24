import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { getSupabase } from '../lib/supabase';

/**
 * Phase 6.5: Auth Callback Handler
 *
 * Dedicated route for handling Supabase magic link callbacks.
 * This ensures proper session establishment before redirecting to dashboard.
 *
 * Flow:
 * 1. User clicks magic link in email
 * 2. Supabase redirects to /auth/callback with tokens in URL hash
 * 3. This component waits for session to be established
 * 4. Redirects to appropriate dashboard based on user role/persona
 */
const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const supabase = getSupabase();
        if (!supabase) {
          setError('Authentication service unavailable');
          setProcessing(false);
          return;
        }

        // Check for error in URL params (Supabase passes errors this way)
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');
        if (errorParam) {
          setError(errorDescription || errorParam);
          setProcessing(false);
          return;
        }

        // Get the session - Supabase handles token extraction from URL hash
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('[AuthCallback] Session error:', sessionError);
          setError(sessionError.message);
          setProcessing(false);
          return;
        }

        if (session) {
          console.log('[AuthCallback] Session established, redirecting to dashboard');
          // Small delay to ensure AuthContext picks up the session
          setTimeout(() => {
            // Redirect to root which will use PersonaRedirect for proper routing
            navigate('/', { replace: true });
          }, 100);
        } else {
          // No session yet - wait for auth state change
          console.log('[AuthCallback] Waiting for session...');
        }
      } catch (err) {
        console.error('[AuthCallback] Error:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
        setProcessing(false);
      }
    };

    handleCallback();
  }, [navigate, searchParams]);

  // Once authenticated via AuthContext, redirect
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      console.log('[AuthCallback] Auth context confirmed, redirecting');
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Timeout fallback - if stuck for too long, show error
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (processing && !isAuthenticated) {
        setError('Authentication timed out. Please try signing in again.');
        setProcessing(false);
      }
    }, 15000); // 15 second timeout

    return () => clearTimeout(timeout);
  }, [processing, isAuthenticated]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="bg-danger/10 size-20 rounded-full flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-danger text-4xl">error</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-white uppercase tracking-tight">
              Sign In Failed
            </h1>
            <p className="text-slate-400 text-sm">{error}</p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/auth', { replace: true })}
              className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-sm uppercase tracking-widest transition-all"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/home', { replace: true })}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm uppercase tracking-widest transition-all"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
      <div className="text-center space-y-6">
        <div className="size-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
        <div className="space-y-2">
          <h1 className="text-xl font-black text-white uppercase tracking-tight">
            Signing You In
          </h1>
          <p className="text-slate-400 text-sm">
            Please wait while we verify your credentials...
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;
