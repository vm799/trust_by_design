import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { getSupabase } from '../lib/supabase';
import { resumeIntentAndGetPath, getNavigationIntent } from '../lib/navigationIntent';

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

  // Look for the second # which indicates Supabase tokens
  const secondHashIndex = fullHash.indexOf('#', 1);
  if (secondHashIndex === -1) {
    return null;
  }

  // Extract the token fragment after the second #
  const tokenFragment = fullHash.substring(secondHashIndex + 1);

  if (!tokenFragment || !tokenFragment.includes('access_token=')) {
    return null;
  }

  // Parse the token fragment as URL params
  const params = new URLSearchParams(tokenFragment);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');

  if (access_token) {
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

    // Try to extract tokens from HashRouter URL immediately
    const tryTokenExtraction = async () => {
      if (hasAttemptedTokenExtraction.current || hasRedirected.current) return;
      hasAttemptedTokenExtraction.current = true;

      const tokens = extractTokensFromHash();

      if (tokens?.access_token) {

        try {
          // Set session using the extracted tokens
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || '',
          });

          if (sessionError) {
            console.error('[AuthCallback] setSession error:', {
              message: sessionError.message,
              status: (sessionError as { status?: number }).status,
              code: (sessionError as { code?: string }).code,
            });

            // Check for rate limiting / security block errors
            const errMsg = sessionError.message?.toLowerCase() || '';
            if (errMsg.includes('rate') || errMsg.includes('too many') ||
                errMsg.includes('security') || errMsg.includes('exceeded')) {
              hasRedirected.current = true;
              setProcessing(false);
              setError(
                'Sign-in temporarily blocked due to too many attempts. ' +
                'This is a security measure. Please wait 5-10 minutes and request a new link.'
              );
              return;
            }

            // Token might be expired or invalid - navigate to dedicated expired view
            if (errMsg.includes('expired') || errMsg.includes('invalid') ||
                errMsg.includes('already used') || errMsg.includes('not found')) {
              hasRedirected.current = true;
              setProcessing(false);
              navigate('/auth/expired', { replace: true });
              return;
            }
            // Other errors - let the listener handle it
          } else if (data.session) {

            // Don't create workspace here - let the user go through OAuthSetup
            // for a more personal experience where they can enter their name
            // and company name. App.tsx routing will redirect new users to /auth/setup.

            // CRITICAL: Check hasRedirected BEFORE navigating.
            // setSession() above fires onAuthStateChange synchronously, which may
            // have already navigated via the listener (line 178). Without this check,
            // BOTH the listener AND this code path call navigate() — double navigation
            // causing a brief re-mount and wasted render.
            if (hasRedirected.current) return;

            hasRedirected.current = true;
            setProcessing(false);

            // UX Flow Contract: Resume navigation intent if one exists
            const targetPath = resumeIntentAndGetPath();

            // Clean up the URL hash to remove tokens
            window.history.replaceState(null, '', window.location.pathname + '#' + targetPath);
            navigate(targetPath, { replace: true });
            return;
          }
        } catch (err) {
          console.error('[AuthCallback] Token extraction error:', err);
        }
      }
    };

    // Check if URL has tokens - if so, tryTokenExtraction will handle auth
    // Only use fallback session check if no tokens in URL
    const tokensInUrl = window.location.hash.includes('access_token=');

    // Run token extraction immediately if tokens present
    if (tokensInUrl) {
      tryTokenExtraction();
    }

    // Also subscribe to auth state changes as backup
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {

      // Prevent double redirect
      if (hasRedirected.current) return;

      // CRITICAL FIX: Do NOT navigate on TOKEN_REFRESHED.
      // Supabase fires TOKEN_REFRESHED rapidly during session establishment.
      // Navigating on each one creates a cascade: navigate → re-mount → new
      // listener → TOKEN_REFRESHED fires → navigate → 100+ calls in 10 seconds.
      // AuthContext handles TOKEN_REFRESHED correctly (ref update, no re-render).
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        // UX Flow Contract: Resume navigation intent if one exists
        const targetPath = resumeIntentAndGetPath();
        hasRedirected.current = true;
        setProcessing(false);
        navigate(targetPath, { replace: true });
      }
      // Don't show error on INITIAL_SESSION without session - token extraction may still work
    });

    // Only check for existing session if NO tokens in URL
    // This prevents redundant getSession() call when setSession() is already handling auth
    let sessionCheckTimer: ReturnType<typeof setTimeout> | undefined;

    if (!tokensInUrl) {
      const checkExistingSession = async () => {
        if (hasRedirected.current) return;

        const { data: { session } } = await supabase.auth.getSession();

        if (session && !hasRedirected.current) {
          // UX Flow Contract: Resume navigation intent if one exists
          const targetPath = resumeIntentAndGetPath();
          hasRedirected.current = true;
          setProcessing(false);
          navigate(targetPath, { replace: true });
        }
      };

      // Run session check after brief delay - only when no tokens present
      sessionCheckTimer = setTimeout(checkExistingSession, 50);
    }

    return () => {
      subscription.unsubscribe();
      if (sessionCheckTimer) clearTimeout(sessionCheckTimer);
    };
  }, [navigate, searchParams]);

  // Fallback: Once authenticated via AuthContext, redirect.
  // This catches cases where the primary paths (token extraction or
  // onAuthStateChange listener) didn't fire — e.g., user navigated to
  // /auth/callback while already logged in, or non-standard auth flows.
  useEffect(() => {
    if (!isLoading && isAuthenticated && !hasRedirected.current) {
      // Only consume intent if nobody else has navigated yet
      const targetPath = resumeIntentAndGetPath();
      hasRedirected.current = true;
      setProcessing(false);
      navigate(targetPath, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Timeout fallback - if stuck for too long, navigate to expired view
  // Give enough time for token extraction and session establishment
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (processing && !isAuthenticated && !hasRedirected.current) {
        // Check if there were tokens in the URL but session failed
        const hadTokens = window.location.hash.includes('access_token=');
        if (hadTokens) {
          // Token was present but failed - navigate to dedicated expired view
          hasRedirected.current = true;
          setProcessing(false);
          navigate('/auth/expired', { replace: true });
        } else {
          // No tokens - generic auth timeout
          setError('Authentication timed out. Please try signing in again.');
          setProcessing(false);
        }
      }
    }, 10000); // 10 second timeout - tokens should process quickly

    return () => clearTimeout(timeout);
  }, [processing, isAuthenticated, navigate]);

  if (error) {
    // UX Flow Contract: Show intent context in error state
    const storedIntent = getNavigationIntent();
    const hasJobIntent = storedIntent?.jobId;

    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col items-center justify-center px-4 transition-colors">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="bg-danger/10 size-20 rounded-full flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-danger text-4xl">error</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">
              Sign In Failed
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{error}</p>
            {hasJobIntent && (
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-2">
                You were trying to access Job #{storedIntent.jobId}
              </p>
            )}
          </div>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/auth', { replace: true })}
              className="w-full min-h-[44px] py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-sm uppercase tracking-wider transition-all"
            >
              {hasJobIntent ? 'Resend Link' : 'Try Again'}
            </button>
            <button
              onClick={() => navigate('/home', { replace: true })}
              className="w-full min-h-[44px] py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-xl font-bold text-sm uppercase tracking-wider transition-all"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col items-center justify-center px-4 transition-colors">
      <div className="text-center space-y-6">
        <div className="size-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">
            Signing You In
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Verifying your credentials...
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;
