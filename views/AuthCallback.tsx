import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { getSupabase } from '../lib/supabase';

/**
 * Phase 6.5: Auth Callback Handler (Fixed Jan 2026)
 *
 * Dedicated route for handling Supabase magic link callbacks.
 * This ensures proper session establishment before redirecting to dashboard.
 *
 * CRITICAL FIX: Uses onAuthStateChange listener instead of just getSession()
 * getSession() may return null because Supabase processes URL tokens async.
 * The listener catches the SIGNED_IN event once tokens are processed.
 *
 * Flow:
 * 1. User clicks magic link in email
 * 2. Supabase redirects to /auth/callback with tokens in URL hash
 * 3. Supabase client processes tokens (async) and fires onAuthStateChange
 * 4. This component catches SIGNED_IN event and redirects to dashboard
 */
const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);
  const hasRedirected = useRef(false);

  // CRITICAL FIX: Listen for auth state change from Supabase
  // This catches the session AFTER Supabase processes URL tokens
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setError('Authentication service unavailable');
      setProcessing(false);
      return;
    }

    // Check for error in URL params first (Supabase passes errors this way)
    const errorParam = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    if (errorParam) {
      setError(errorDescription || errorParam);
      setProcessing(false);
      return;
    }

    console.log('[AuthCallback] Setting up auth state listener...');

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthCallback] Auth event:', event, 'Session:', !!session);

      // Prevent double redirect
      if (hasRedirected.current) return;

      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') && session) {
        console.log(`[AuthCallback] ${event} event received with session, redirecting to dashboard`);
        hasRedirected.current = true;
        setProcessing(false);
        // Redirect to root which uses PersonaRedirect for proper routing
        navigate('/', { replace: true });
      } else if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session)) {
        // SIGNED_OUT or initial load with no session (token expired/invalid)
        console.log(`[AuthCallback] ${event} event with no session - token may be expired`);
        setError('Sign-in link expired or already used. Please request a new link.');
        setProcessing(false);
      }
    });

    // Also check if session already exists (user might be already logged in)
    const checkExistingSession = async () => {
      if (hasRedirected.current) return;

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('[AuthCallback] Session check error:', sessionError);
        // Don't set error yet - wait for the listener to potentially fire
        return;
      }

      if (session && !hasRedirected.current) {
        console.log('[AuthCallback] Existing session found, redirecting');
        hasRedirected.current = true;
        setProcessing(false);
        navigate('/', { replace: true });
      }
    };

    // Small delay to let Supabase process URL tokens first
    const sessionCheckTimer = setTimeout(checkExistingSession, 500);

    return () => {
      subscription.unsubscribe();
      clearTimeout(sessionCheckTimer);
    };
  }, [navigate, searchParams]);

  // Fallback: Once authenticated via AuthContext, redirect
  useEffect(() => {
    if (!isLoading && isAuthenticated && !hasRedirected.current) {
      console.log('[AuthCallback] AuthContext confirmed auth, redirecting');
      hasRedirected.current = true;
      setProcessing(false);
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Timeout fallback - if stuck for too long, show error
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (processing && !isAuthenticated && !hasRedirected.current) {
        setError('Authentication timed out. Please try signing in again.');
        setProcessing(false);
      }
    }, 20000); // 20 second timeout (increased from 15s)

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
