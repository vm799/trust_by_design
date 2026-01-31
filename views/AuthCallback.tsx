import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { getSupabase } from '../lib/supabase';

/**
 * Phase 6.5: Auth Callback Handler (Fixed Jan 2026)
 *
 * CRITICAL: Handles HashRouter + Supabase URL hash token conflict.
 *
 * The Problem:
 * - HashRouter uses URL hash for routing: /#/auth/callback
 * - Supabase appends tokens to URL hash: #access_token=xxx
 * - Combined URL: /#/auth/callback#access_token=xxx (double hash!)
 * - Supabase's detectSessionInUrl can't parse this correctly
 *
 * The Solution:
 * - Manually extract tokens from the malformed URL hash
 * - Use setSession() to establish the session directly
 * - Fall back to normal auth state listener
 *
 * Flow:
 * 1. User clicks magic link in email
 * 2. Supabase redirects to /#/auth/callback#access_token=xxx&...
 * 3. This component extracts tokens from the double-hash URL
 * 4. Sets session manually and redirects to dashboard
 */

/**
 * Extract Supabase tokens from HashRouter-conflicted URL
 * URL format: /#/auth/callback#access_token=xxx&refresh_token=yyy&...
 * window.location.hash = /auth/callback#access_token=xxx&refresh_token=yyy&...
 */
const extractTokensFromHash = (): { access_token?: string; refresh_token?: string } | null => {
  const fullHash = window.location.hash;
  console.log('[AuthCallback] Full hash:', fullHash);

  // Look for the second # which indicates Supabase tokens
  const secondHashIndex = fullHash.indexOf('#', 1);
  if (secondHashIndex === -1) {
    console.log('[AuthCallback] No second hash found - no embedded tokens');
    return null;
  }

  // Extract the token fragment after the second #
  const tokenFragment = fullHash.substring(secondHashIndex + 1);
  console.log('[AuthCallback] Token fragment:', tokenFragment);

  if (!tokenFragment || !tokenFragment.includes('access_token=')) {
    console.log('[AuthCallback] No access_token found in fragment');
    return null;
  }

  // Parse the token fragment as URL params
  const params = new URLSearchParams(tokenFragment);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');

  if (access_token) {
    console.log('[AuthCallback] Tokens extracted successfully');
    return { access_token, refresh_token: refresh_token || undefined };
  }

  return null;
};

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);
  const hasRedirected = useRef(false);
  const hasAttemptedTokenExtraction = useRef(false);

  // CRITICAL FIX: Extract tokens from HashRouter URL and set session manually
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

    console.log('[AuthCallback] Starting auth callback processing...');

    // Try to extract tokens from HashRouter URL immediately
    const tryTokenExtraction = async () => {
      if (hasAttemptedTokenExtraction.current || hasRedirected.current) return;
      hasAttemptedTokenExtraction.current = true;

      const tokens = extractTokensFromHash();

      if (tokens?.access_token) {
        console.log('[AuthCallback] Attempting to set session from extracted tokens...');

        try {
          // Set session using the extracted tokens
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || '',
          });

          if (sessionError) {
            console.error('[AuthCallback] setSession error:', sessionError);
            // Token might be expired or invalid
            if (sessionError.message?.includes('expired') ||
                sessionError.message?.includes('invalid') ||
                sessionError.message?.includes('already used')) {
              setError('Sign-in link expired or already used. Please request a new link.');
              setProcessing(false);
              return;
            }
            // Other errors - let the listener handle it
          } else if (data.session) {
            console.log('[AuthCallback] Session set successfully');

            // Don't create workspace here - let the user go through OAuthSetup
            // for a more personal experience where they can enter their name
            // and company name. App.tsx routing will redirect new users to /auth/setup.

            hasRedirected.current = true;
            setProcessing(false);
            // Clean up the URL hash to remove tokens
            window.history.replaceState(null, '', window.location.pathname + '#/');
            navigate('/', { replace: true });
            return;
          }
        } catch (err) {
          console.error('[AuthCallback] Token extraction error:', err);
        }
      }
    };

    // Run token extraction immediately
    tryTokenExtraction();

    // Also subscribe to auth state changes as backup
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthCallback] Auth event:', event, 'Session:', !!session);

      // Prevent double redirect
      if (hasRedirected.current) return;

      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') && session) {
        console.log(`[AuthCallback] ${event} event received with session, redirecting to dashboard`);
        hasRedirected.current = true;
        setProcessing(false);
        navigate('/', { replace: true });
      }
      // Don't show error on INITIAL_SESSION without session - token extraction may still work
    });

    // Check for existing session immediately (no delay)
    const checkExistingSession = async () => {
      if (hasRedirected.current) return;

      const { data: { session } } = await supabase.auth.getSession();

      if (session && !hasRedirected.current) {
        console.log('[AuthCallback] Existing session found, redirecting');
        hasRedirected.current = true;
        setProcessing(false);
        navigate('/', { replace: true });
      }
    };

    // Run session check immediately - no 1-second delay
    const sessionCheckTimer = setTimeout(checkExistingSession, 50);

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
  // Give enough time for token extraction and session establishment
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (processing && !isAuthenticated && !hasRedirected.current) {
        // Check if there were tokens in the URL but session failed
        const hadTokens = window.location.hash.includes('access_token=');
        if (hadTokens) {
          setError('Sign-in link expired or already used. Please request a new link.');
        } else {
          setError('Authentication timed out. Please try signing in again.');
        }
        setProcessing(false);
      }
    }, 10000); // 10 second timeout - tokens should process quickly

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
            Verifying your credentials...
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;
