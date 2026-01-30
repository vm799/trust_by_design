// =====================================================================
// SUPABASE EDGE FUNCTION: RATE LIMITER
// =====================================================================
// Purpose: Rate limit API requests by IP address
// Deploy: supabase functions deploy rate-limiter
// Usage: Call this function before sensitive operations
// =====================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// In-memory rate limit store (resets on cold start)
// For production, consider using Supabase KV or Redis
const rateLimits = new Map<string, { count: number; resetAt: number }>();

// Configuration - adjust based on your usage patterns
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 100; // 100 requests per minute per IP
const STRICT_MODE_THRESHOLD = 500; // Trigger strict mode above this
const STRICT_MODE_LIMIT = 10; // Reduced limit in strict mode

// Track global request count for DDoS detection
let globalRequestCount = 0;
let globalResetAt = Date.now() + RATE_LIMIT_WINDOW_MS;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-job-id, x-job-token',
  'Access-Control-Max-Age': '86400',
};

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

function isStrictMode(): boolean {
  const now = Date.now();
  if (now > globalResetAt) {
    globalRequestCount = 0;
    globalResetAt = now + RATE_LIMIT_WINDOW_MS;
  }
  return globalRequestCount > STRICT_MODE_THRESHOLD;
}

function checkRateLimit(ip: string): {
  limited: boolean;
  remaining: number;
  resetIn: number;
  strictMode: boolean;
} {
  const now = Date.now();
  const strictMode = isStrictMode();
  const maxRequests = strictMode ? STRICT_MODE_LIMIT : MAX_REQUESTS_PER_WINDOW;

  // Increment global counter
  globalRequestCount++;

  // Clean up expired records
  const record = rateLimits.get(ip);
  if (record && record.resetAt <= now) {
    rateLimits.delete(ip);
  }

  const current = rateLimits.get(ip);

  if (!current) {
    // First request from this IP
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return {
      limited: false,
      remaining: maxRequests - 1,
      resetIn: RATE_LIMIT_WINDOW_MS,
      strictMode,
    };
  }

  if (current.count >= maxRequests) {
    // Rate limited
    return {
      limited: true,
      remaining: 0,
      resetIn: current.resetAt - now,
      strictMode,
    };
  }

  // Increment counter
  current.count++;
  return {
    limited: false,
    remaining: maxRequests - current.count,
    resetIn: current.resetAt - now,
    strictMode,
  };
}

// Suspicious pattern detection
function isSuspiciousRequest(req: Request): { suspicious: boolean; reason?: string } {
  const userAgent = req.headers.get('user-agent') || '';
  const referer = req.headers.get('referer') || '';

  // Check for missing or suspicious user agents
  if (!userAgent || userAgent.length < 10) {
    return { suspicious: true, reason: 'Missing or invalid User-Agent' };
  }

  // Check for known bot patterns
  const botPatterns = ['curl', 'wget', 'python-requests', 'axios', 'node-fetch'];
  const lowerUA = userAgent.toLowerCase();
  for (const pattern of botPatterns) {
    if (lowerUA.includes(pattern)) {
      return { suspicious: true, reason: `Bot pattern detected: ${pattern}` };
    }
  }

  return { suspicious: false };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const clientIP = getClientIP(req);
  const { limited, remaining, resetIn, strictMode } = checkRateLimit(clientIP);
  const { suspicious, reason } = isSuspiciousRequest(req);

  const rateLimitHeaders = {
    ...corsHeaders,
    'Content-Type': 'application/json',
    'X-RateLimit-Limit': (strictMode ? STRICT_MODE_LIMIT : MAX_REQUESTS_PER_WINDOW).toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(resetIn / 1000).toString(),
  };

  // Log suspicious requests (would go to Supabase logs)
  if (suspicious) {
    console.warn(`Suspicious request from ${clientIP}: ${reason}`);
  }

  if (limited) {
    // Log rate limit hit
    console.warn(`Rate limit exceeded for IP: ${clientIP}`);

    return new Response(
      JSON.stringify({
        error: 'Too Many Requests',
        message: strictMode
          ? 'Server is under high load. Please try again later.'
          : 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(resetIn / 1000),
        strictMode,
      }),
      {
        status: 429,
        headers: {
          ...rateLimitHeaders,
          'Retry-After': Math.ceil(resetIn / 1000).toString(),
        },
      }
    );
  }

  // Return success with rate limit info
  return new Response(
    JSON.stringify({
      success: true,
      allowed: true,
      rateLimit: {
        remaining,
        resetIn: Math.ceil(resetIn / 1000),
        limit: strictMode ? STRICT_MODE_LIMIT : MAX_REQUESTS_PER_WINDOW,
      },
      strictMode,
      suspicious,
    }),
    {
      status: 200,
      headers: rateLimitHeaders,
    }
  );
});
