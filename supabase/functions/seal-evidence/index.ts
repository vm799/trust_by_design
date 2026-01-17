// =====================================================================
// SUPABASE EDGE FUNCTION: SEAL EVIDENCE
// =====================================================================
// Phase: C.3 - Cryptographic Sealing
// Purpose: Server-side cryptographic sealing of evidence bundles
// Security: Private key never exposed to client
// =====================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// =====================================================================
// TYPES
// =====================================================================

interface SealRequest {
  jobId: string
}

interface EvidenceBundle {
  job: {
    id: string
    title: string
    client: string
    clientId: string
    technician: string
    technicianId: string
    date: string
    address: string
    notes: string
    workSummary?: string
    safetyChecklist: any[]
    siteHazards?: string[]
    completedAt?: string
  }
  photos: {
    id: string
    url: string
    timestamp: string
    lat?: number
    lng?: number
    type: string
  }[]
  signature: {
    url: string | null
    signerName?: string
    signerRole?: string
  }
  metadata: {
    sealedAt: string
    sealedBy: string
    version: string
  }
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
    const { jobId }: SealRequest = await req.json()

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: 'Missing jobId parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Initialize Supabase client with user's auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // 3. Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser()

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - valid session required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Fetch job data
    const { data: job, error: jobError } = await supabaseClient
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Check if job is already sealed
    if (job.sealed_at) {
      return new Response(
        JSON.stringify({
          error: 'Job already sealed',
          sealedAt: job.sealed_at,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 6. Check if user has permission to seal (must be in same workspace)
    const { data: userProfile } = await supabaseClient
      .from('users')
      .select('workspace_id')
      .eq('id', user.id)
      .single()

    if (!userProfile || userProfile.workspace_id !== job.workspace_id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - cannot seal job in different workspace' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 7. Build evidence bundle (canonical JSON)
    const evidenceBundle: EvidenceBundle = {
      job: {
        id: job.id,
        title: job.title,
        client: job.client_name,
        clientId: job.client_id,
        technician: job.technician_name,
        technicianId: job.technician_id,
        date: job.scheduled_date,
        address: job.address,
        notes: job.notes || '',
        workSummary: job.work_summary || '',
        safetyChecklist: job.safety_checklist || [],
        siteHazards: job.site_hazards || [],
        completedAt: job.completed_at || new Date().toISOString(),
      },
      photos: job.photos || [],
      signature: {
        url: job.signature_url || null,
        signerName: job.signer_name,
        signerRole: job.signer_role,
      },
      metadata: {
        sealedAt: new Date().toISOString(),
        sealedBy: user.email!,
        version: '1.0',
      },
    }

    // 8. Compute SHA-256 hash (deterministic with sorted keys)
    const canonicalJson = JSON.stringify(evidenceBundle, Object.keys(evidenceBundle).sort())
    const encoder = new TextEncoder()
    const data = encoder.encode(canonicalJson)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const evidenceHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

    // 9. Generate RSA-2048 signature
    //    NOTE: For production, use actual RSA keys from Supabase Vault
    //    This simplified version uses HMAC-SHA256 as a placeholder
    const secretKey = Deno.env.get('SEAL_SECRET_KEY') || 'default-secret-key-CHANGE-IN-PRODUCTION'
    const keyData = encoder.encode(secretKey)
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(evidenceHash))
    const signatureArray = Array.from(new Uint8Array(signatureBuffer))
    const signature = btoa(String.fromCharCode(...signatureArray)) // Base64 encode

    // 10. Store seal in database (using service role client for insert permission)
    const supabaseServiceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const sealedAt = new Date().toISOString()

    const { error: sealError } = await supabaseServiceClient.from('evidence_seals').insert({
      job_id: jobId,
      workspace_id: job.workspace_id,
      evidence_hash: evidenceHash,
      signature: signature,
      algorithm: 'SHA256-HMAC', // In production: 'SHA256-RSA2048'
      sealed_by_user_id: user.id,
      sealed_by_email: user.email,
      evidence_bundle: evidenceBundle,
      sealed_at: sealedAt,
    })

    if (sealError) {
      console.error('Failed to insert seal:', sealError)
      return new Response(
        JSON.stringify({ error: 'Failed to store seal', details: sealError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 11. Update job.sealed_at
    const { error: updateError } = await supabaseServiceClient
      .from('jobs')
      .update({ sealed_at: sealedAt, status: 'Submitted' })
      .eq('id', jobId)

    if (updateError) {
      console.error('Failed to update job seal status:', updateError)
      // Rollback seal insertion
      await supabaseServiceClient.from('evidence_seals').delete().eq('job_id', jobId)
      return new Response(
        JSON.stringify({ error: 'Failed to seal job', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 12. Magic link tokens are automatically invalidated by database trigger

    // 13. Return success response
    return new Response(
      JSON.stringify({
        success: true,
        evidenceHash,
        signature: signature.substring(0, 32) + '...', // Truncate for response
        sealedAt,
        message: 'Evidence sealed successfully',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Sealing error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

/* =====================================================================
 * DEPLOYMENT NOTES:
 * =====================================================================
 *
 * 1. Deploy this function using Supabase CLI:
 *    supabase functions deploy seal-evidence
 *
 * 2. Set environment variables in Supabase Dashboard:
 *    - SEAL_SECRET_KEY (for HMAC) or
 *    - SEAL_PRIVATE_KEY (for RSA-2048 in production)
 *    - SEAL_PUBLIC_KEY (for verification)
 *
 * 3. Grant permissions:
 *    - Function requires SUPABASE_SERVICE_ROLE_KEY to bypass RLS
 *
 * 4. Upgrade to RSA-2048 for production:
 *    - Generate keys: openssl genrsa -out private_key.pem 2048
 *    - Store in Supabase Vault
 *    - Replace HMAC code with RSA signing
 *
 * =====================================================================
 */
