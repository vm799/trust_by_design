// =====================================================================
// SUPABASE EDGE FUNCTION: VERIFY EVIDENCE
// =====================================================================
// Phase: C.3 - Cryptographic Sealing
// Purpose: Verify integrity of sealed evidence bundles
// Security: Public verification endpoint - no auth required for transparency
// =====================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// =====================================================================
// TYPES
// =====================================================================

interface VerifyRequest {
  jobId: string
}

// =====================================================================
// CORS HEADERS
// =====================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// =====================================================================
// MAIN HANDLER
// =====================================================================

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Parse request body
    const { jobId }: VerifyRequest = await req.json()

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: 'Missing jobId parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Initialize Supabase client (using anon key for public verification)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Use service role to read seals
    )

    // 3. Fetch seal from database
    const { data: seal, error: sealError } = await supabaseClient
      .from('evidence_seals')
      .select('*')
      .eq('job_id', jobId)
      .single()

    if (sealError || !seal) {
      return new Response(
        JSON.stringify({
          isValid: false,
          message: 'No seal found for this job',
          error: 'SEAL_NOT_FOUND',
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Recalculate hash from stored evidence bundle
    const evidenceBundle = seal.evidence_bundle
    const canonicalJson = JSON.stringify(evidenceBundle, Object.keys(evidenceBundle).sort())
    const encoder = new TextEncoder()
    const data = encoder.encode(canonicalJson)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const recalculatedHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

    // 5. Compare hashes
    if (recalculatedHash !== seal.evidence_hash) {
      return new Response(
        JSON.stringify({
          isValid: false,
          message: 'Evidence has been tampered with - hash mismatch',
          error: 'HASH_MISMATCH',
          storedHash: seal.evidence_hash,
          recalculatedHash: recalculatedHash,
          sealedAt: seal.sealed_at,
          sealedBy: seal.sealed_by_email,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Helper to convert PEM to ArrayBuffer
    function pemToArrayBuffer(pem: string): ArrayBuffer {
      const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
      const binary = atob(b64);
      const buffer = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        buffer[i] = binary.charCodeAt(i);
      }
      return buffer.buffer;
    }

    // 6. Verify signature
    let isSignatureValid = false;

    if (seal.algorithm === 'SHA256-RSA2048') {
      // RSA Verification
      const publicKeyPem = Deno.env.get('SEAL_PUBLIC_KEY');
      if (!publicKeyPem) {
        throw new Error('Server configuration error: Missing SEAL_PUBLIC_KEY');
      }

      try {
        const keyData = pemToArrayBuffer(publicKeyPem);
        const cryptoKey = await crypto.subtle.importKey(
          'spki',
          keyData,
          { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
          false,
          ['verify']
        );

        const signatureBytes = Uint8Array.from(atob(seal.signature), (c) => c.charCodeAt(0));

        isSignatureValid = await crypto.subtle.verify(
          'RSASSA-PKCS1-v1_5',
          cryptoKey,
          signatureBytes,
          encoder.encode(seal.evidence_hash)
        );
      } catch (e) {
        console.error('RSA Verification failed:', e);
        isSignatureValid = false;
      }
    } else {
      // HMAC Fallback (Legacy seals only - requires explicit SEAL_SECRET_KEY)
      const secretKey = Deno.env.get('SEAL_SECRET_KEY');

      if (!secretKey) {
        console.error('CRITICAL: SEAL_SECRET_KEY not configured for HMAC verification');
        throw new Error(
          'Cannot verify HMAC seal: SEAL_SECRET_KEY not configured. ' +
          'Legacy HMAC seals require explicit secret key. ' +
          'RSA-2048 seals recommended for production.'
        );
      }

      console.warn('Verifying HMAC-SHA256 seal - RSA-2048 recommended for production');

      const keyData = encoder.encode(secretKey);
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      );

      // Decode base64 signature
      const signatureBytes = Uint8Array.from(atob(seal.signature), (c) => c.charCodeAt(0));

      isSignatureValid = await crypto.subtle.verify(
        'HMAC',
        cryptoKey,
        signatureBytes,
        encoder.encode(seal.evidence_hash)
      );
    }

    if (!isSignatureValid) {
      return new Response(
        JSON.stringify({
          isValid: false,
          message: 'Invalid signature - seal may be forged',
          error: 'INVALID_SIGNATURE',
          sealedAt: seal.sealed_at,
          sealedBy: seal.sealed_by_email,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 7. All checks passed - evidence is valid
    return new Response(
      JSON.stringify({
        isValid: true,
        message: 'Evidence is authentic and has not been tampered with',
        evidenceHash: seal.evidence_hash,
        algorithm: seal.algorithm,
        sealedAt: seal.sealed_at,
        sealedBy: seal.sealed_by_email,
        verification: {
          hashMatch: true,
          signatureValid: true,
          timestamp: new Date().toISOString(),
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Verification error:', error)
    return new Response(
      JSON.stringify({
        isValid: false,
        error: 'VERIFICATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error during verification',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/* =====================================================================
 * DEPLOYMENT NOTES:
 * =====================================================================
 *
 * 1. Deploy this function using Supabase CLI:
 *    supabase functions deploy verify-evidence
 *
 * 2. Set environment variables in Supabase Dashboard:
 *    - SEAL_SECRET_KEY (for HMAC) or
 *    - SEAL_PUBLIC_KEY (for RSA-2048 verification in production)
 *
 * 3. Public access:
 *    - No authentication required (public transparency)
 *    - Anyone can verify evidence integrity
 *    - Seal data is read-only
 *
 * 4. Upgrade to RSA-2048 for production:
 *    - Use public key from Supabase Vault
 *    - Replace HMAC verification with RSA signature verification
 *
 * =====================================================================
 */
