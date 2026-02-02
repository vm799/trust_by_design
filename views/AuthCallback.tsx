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
            // Token might be expired or invalid - navigate to dedicated expired view
            if (sessionError.message?.includes('expired') ||
                sessionError.message?.includes('invalid') ||
                sessionError.message?.includes('already used')) {
              console.log('[AuthCallback] Link expired/invalid, navigating to /auth/expired');
              hasRedirected.current = true;
              setProcessing(false);
              navigate('/auth/expired', { replace: true });
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

            // UX Flow Contract: Resume navigation intent if one exists
            const targetPath = resumeIntentAndGetPath();
            console.log('[AuthCallback] Resuming intent, navigating to:', targetPath);

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
      console.log('[AuthCallback] Auth event:', event, 'Session:', !!session);

      // Prevent double redirect
      if (hasRedirected.current) return;

      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') && session) {
        // UX Flow Contract: Resume navigation intent if one exists
        const targetPath = resumeIntentAndGetPath();
        console.log(`[AuthCallback] ${event} event received with session, navigating to:`, targetPath);
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
          console.log('[AuthCallback] Existing session found, navigating to:', targetPath);
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

  // Fallback: Once authenticated via AuthContext, redirect
  useEffect(() => {
    if (!isLoading && isAuthenticated && !hasRedirected.current) {
      // UX Flow Contract: Resume navigation intent if one exists
      const targetPath = resumeIntentAndGetPath();
      console.log('[AuthCallback] AuthContext confirmed auth, navigating to:', targetPath);
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
          console.log('[AuthCallback] Timeout with tokens - link likely expired');
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
            {hasJobIntent && (
              <p className="text-slate-500 text-xs mt-2">
                You were trying to access Job #{storedIntent.jobId}
              </p>
            )}
          </div>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/auth', { replace: true })}
              className="w-full min-h-[44px] py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-sm uppercase tracking-widest transition-all"
            >
              {hasJobIntent ? 'Resend Link' : 'Try Again'}
            </button>
            <button
              onClick={() => navigate('/home', { replace: true })}
              className="w-full min-h-[44px] py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm uppercase tracking-widest transition-all"
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
