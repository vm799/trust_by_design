// =====================================================================
// SUPABASE EDGE FUNCTION: SEND MAGIC LINK
// =====================================================================
// Purpose: Proxy magic link requests with Postgres-backed rate limiting
// Deploy: supabase functions deploy send-magic-link
//
// Features:
// - Per-email rate limiting (3/min default)
// - Per-IP rate limiting (10/min default)
// - Global rate limiting (100/min default)
// - Sliding window semantics
// - Audit logging
// - Clear error messages with retry-after
// =====================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

// =====================================================================
// CONFIGURATION
// =====================================================================

interface RateLimitConfig {
  emailLimit: number;
  emailWindowSeconds: number;
  ipLimit: number;
  ipWindowSeconds: number;
  globalLimit: number;
  globalWindowSeconds: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  emailLimit: 3,
  emailWindowSeconds: 60,
  ipLimit: 10,
  ipWindowSeconds: 60,
  globalLimit: 100,
  globalWindowSeconds: 60,
};

// =====================================================================
// CORS HEADERS
// =====================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-forwarded-for, x-real-ip',
  'Access-Control-Max-Age': '86400',
};

// =====================================================================
// HELPER FUNCTIONS
// =====================================================================

function getClientIP(req: Request): string {
  // Check common headers for real IP behind proxies
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  const cfConnectingIP = req.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  return 'unknown';
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// =====================================================================
// MAIN HANDLER
// =====================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Parse request body
    const body = await req.json();
    const email = body.email?.toLowerCase()?.trim();
    const redirectUrl = body.redirectUrl;

    // Validate email
    if (!email || !validateEmail(email)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid email address',
          code: 'INVALID_EMAIL',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get client IP
    const clientIP = getClientIP(req);
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[SendMagicLink] Missing Supabase credentials');
      return new Response(
        JSON.stringify({
          error: 'Server configuration error',
          code: 'CONFIG_ERROR',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // =========================================
    // CHECK RATE LIMITS
    // =========================================

    console.log(`[SendMagicLink] Checking rate limit for email=${email}, ip=${clientIP}`);

    const { data: rateLimitResult, error: rateLimitError } = await supabase.rpc(
      'check_rate_limit',
      {
        p_email: email,
        p_ip_address: clientIP,
        p_email_limit: DEFAULT_CONFIG.emailLimit,
        p_email_window: DEFAULT_CONFIG.emailWindowSeconds,
        p_ip_limit: DEFAULT_CONFIG.ipLimit,
        p_ip_window: DEFAULT_CONFIG.ipWindowSeconds,
        p_global_limit: DEFAULT_CONFIG.globalLimit,
        p_global_window: DEFAULT_CONFIG.globalWindowSeconds,
      }
    );

    if (rateLimitError) {
      console.error('[SendMagicLink] Rate limit check error:', rateLimitError);
      // Fail open: allow the request if rate limit check fails
      // But log it for monitoring
    }

    // If rate limited, return error with details
    if (rateLimitResult && !rateLimitResult.allowed) {
      const limitHit = rateLimitResult.limit_hit;
      const retryAfter = rateLimitResult.retry_after || 60;
      const counts = rateLimitResult.counts || {};

      console.warn(`[SendMagicLink] Rate limit hit: ${limitHit} for ${email} (IP: ${clientIP})`);

      // Log the blocked request
      await supabase.rpc('log_rate_limit_event', {
        p_email: email,
        p_ip_address: clientIP,
        p_allowed: false,
        p_limit_hit: limitHit,
        p_email_count: counts.email,
        p_ip_count: counts.ip,
        p_global_count: counts.global,
        p_retry_after: retryAfter,
        p_user_agent: userAgent,
        p_metadata: { redirectUrl },
      });

      // Return user-friendly error based on limit type
      let userMessage: string;
      let code: string;

      switch (limitHit) {
        case 'email':
          userMessage = `Too many sign-in attempts for this email. Please wait ${retryAfter} seconds before trying again.`;
          code = 'EMAIL_RATE_LIMIT';
          break;
        case 'ip':
          userMessage = `Too many sign-in attempts from your network. Please wait ${retryAfter} seconds before trying again.`;
          code = 'IP_RATE_LIMIT';
          break;
        case 'global':
          userMessage = 'Our sign-in service is experiencing high demand. Please try again in a few minutes.';
          code = 'GLOBAL_RATE_LIMIT';
          break;
        default:
          userMessage = 'Rate limit exceeded. Please try again later.';
          code = 'RATE_LIMIT';
      }

      return new Response(
        JSON.stringify({
          error: userMessage,
          code,
          limit_hit: limitHit,
          retry_after: retryAfter,
          counts: {
            email: counts.email,
            ip: counts.ip,
            global: counts.global,
          },
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit-Email': String(DEFAULT_CONFIG.emailLimit),
            'X-RateLimit-Remaining-Email': String(Math.max(0, DEFAULT_CONFIG.emailLimit - (counts.email || 0))),
            'X-RateLimit-Limit-IP': String(DEFAULT_CONFIG.ipLimit),
            'X-RateLimit-Remaining-IP': String(Math.max(0, DEFAULT_CONFIG.ipLimit - (counts.ip || 0))),
          },
        }
      );
    }

    // =========================================
    // SEND MAGIC LINK VIA SUPABASE AUTH
    // =========================================

    console.log(`[SendMagicLink] Sending magic link to ${email}`);

    // Build the redirect URL
    const finalRedirectUrl = redirectUrl || `${supabaseUrl.replace('.supabase.co', '')}.vercel.app/#/auth/callback`;

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: finalRedirectUrl,
      },
    });

    if (authError) {
      console.error('[SendMagicLink] Auth error:', authError);

      // Log the failed attempt
      await supabase.rpc('log_rate_limit_event', {
        p_email: email,
        p_ip_address: clientIP,
        p_allowed: true, // We allowed it through rate limiting
        p_limit_hit: null,
        p_email_count: rateLimitResult?.counts?.email,
        p_ip_count: rateLimitResult?.counts?.ip,
        p_global_count: rateLimitResult?.counts?.global,
        p_retry_after: null,
        p_user_agent: userAgent,
        p_metadata: { redirectUrl, error: authError.message, error_code: authError.code },
      });

      // Check if this is a Supabase rate limit error
      const errMsg = authError.message?.toLowerCase() || '';
      if (errMsg.includes('rate') || errMsg.includes('exceeded') || errMsg.includes('too many')) {
        return new Response(
          JSON.stringify({
            error: 'Email service rate limit reached. Please wait a few minutes and try again.',
            code: 'SUPABASE_RATE_LIMIT',
            retry_after: 300, // 5 minutes for Supabase rate limits
          }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
              'Retry-After': '300',
            },
          }
        );
      }

      // Check if email is invalid/blocked
      if (errMsg.includes('invalid') || errMsg.includes('blocked') || errMsg.includes('not allowed')) {
        return new Response(
          JSON.stringify({
            error: 'Unable to send to this email address. Please try a different email.',
            code: 'INVALID_EMAIL',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generic error
      return new Response(
        JSON.stringify({
          error: 'Failed to send magic link. Please try again.',
          code: 'AUTH_ERROR',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================
    // SUCCESS
    // =========================================

    console.log(`[SendMagicLink] Magic link sent successfully to ${email}`);

    // Log the successful request
    await supabase.rpc('log_rate_limit_event', {
      p_email: email,
      p_ip_address: clientIP,
      p_allowed: true,
      p_limit_hit: null,
      p_email_count: rateLimitResult?.counts?.email,
      p_ip_count: rateLimitResult?.counts?.ip,
      p_global_count: rateLimitResult?.counts?.global,
      p_retry_after: null,
      p_user_agent: userAgent,
      p_metadata: { redirectUrl, success: true },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Magic link sent successfully. Check your email.',
        remaining: {
          email: Math.max(0, DEFAULT_CONFIG.emailLimit - ((rateLimitResult?.counts?.email || 0) + 1)),
          ip: Math.max(0, DEFAULT_CONFIG.ipLimit - ((rateLimitResult?.counts?.ip || 0) + 1)),
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-RateLimit-Limit-Email': String(DEFAULT_CONFIG.emailLimit),
          'X-RateLimit-Remaining-Email': String(Math.max(0, DEFAULT_CONFIG.emailLimit - ((rateLimitResult?.counts?.email || 0) + 1))),
        },
      }
    );

  } catch (error) {
    console.error('[SendMagicLink] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'An unexpected error occurred. Please try again.',
        code: 'UNEXPECTED_ERROR',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
