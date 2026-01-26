-- Migration: Add get_job_by_magic_link_token RPC for anonymous job access
-- Purpose: Fix "Job not found" error - allow fetching full job data via magic link token
-- Date: 2026-01-26
--
-- ROOT CAUSE:
-- getJobByToken() in lib/db.ts validates token via RPC (works), then queries jobs table directly
-- RLS blocks anonymous access to jobs table, causing "Job not found" error
--
-- FIX:
-- Create SECURITY DEFINER RPC function that validates token AND returns full job data
-- Grant execute to 'anon' role for anonymous access via magic links

-- Drop if exists (for idempotent migrations)
DROP FUNCTION IF EXISTS public.get_job_by_magic_link_token(TEXT);

-- Create the function that returns full job data
CREATE OR REPLACE FUNCTION public.get_job_by_magic_link_token(p_token TEXT)
RETURNS TABLE(
  id TEXT,
  title TEXT,
  client_name TEXT,
  client_id UUID,
  technician_name TEXT,
  technician_id UUID,
  status TEXT,
  scheduled_date TIMESTAMP WITH TIME ZONE,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  w3w TEXT,
  notes TEXT,
  work_summary TEXT,
  photos JSONB,
  signature_url TEXT,
  signer_name TEXT,
  signer_role TEXT,
  safety_checklist JSONB,
  site_hazards JSONB,
  completed_at TIMESTAMP WITH TIME ZONE,
  template_id UUID,
  sync_status TEXT,
  last_updated BIGINT,
  price DECIMAL,
  workspace_id UUID,
  sealed_at TIMESTAMP WITH TIME ZONE,
  sealed_by UUID,
  evidence_hash TEXT,
  magic_link_token TEXT,
  magic_link_url TEXT,
  is_valid BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_token_data RECORD;
  v_job RECORD;
BEGIN
  -- 1. First try job_access_tokens table (primary token storage)
  SELECT
    jat.job_id,
    jat.expires_at
  INTO v_token_data
  FROM public.job_access_tokens jat
  WHERE jat.token = p_token
  LIMIT 1;

  IF FOUND THEN
    -- Check if expired
    IF v_token_data.expires_at < NOW() THEN
      RETURN QUERY SELECT
        NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::UUID, NULL::TEXT, NULL::UUID,
        NULL::TEXT, NULL::TIMESTAMP WITH TIME ZONE, NULL::TEXT, NULL::DOUBLE PRECISION,
        NULL::DOUBLE PRECISION, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::JSONB,
        NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::JSONB, NULL::JSONB,
        NULL::TIMESTAMP WITH TIME ZONE, NULL::UUID, NULL::TEXT, NULL::BIGINT,
        NULL::DECIMAL, NULL::UUID, NULL::TIMESTAMP WITH TIME ZONE, NULL::UUID,
        NULL::TEXT, NULL::TEXT, NULL::TEXT,
        false, -- is_valid
        'This link has expired. Please ask your manager to send a new link.'::TEXT;
      RETURN;
    END IF;

    -- Get full job data
    SELECT * INTO v_job
    FROM public.jobs j
    WHERE j.id::TEXT = v_token_data.job_id;

    IF FOUND THEN
      -- Check if sealed (but still return the data for viewing)
      RETURN QUERY SELECT
        v_job.id::TEXT,
        v_job.title,
        v_job.client_name,
        v_job.client_id,
        v_job.technician_name,
        v_job.technician_id,
        v_job.status,
        v_job.scheduled_date,
        v_job.address,
        v_job.lat,
        v_job.lng,
        v_job.w3w,
        v_job.notes,
        v_job.work_summary,
        v_job.photos,
        v_job.signature_url,
        v_job.signer_name,
        v_job.signer_role,
        v_job.safety_checklist,
        v_job.site_hazards,
        v_job.completed_at,
        v_job.template_id,
        v_job.sync_status,
        v_job.last_updated,
        v_job.price,
        v_job.workspace_id,
        v_job.sealed_at,
        v_job.sealed_by,
        v_job.evidence_hash,
        v_job.magic_link_token,
        v_job.magic_link_url,
        true, -- is_valid
        NULL::TEXT; -- no error
      RETURN;
    END IF;
  END IF;

  -- 2. Fallback: Try jobs.magic_link_token column (for tokens stored directly on job)
  SELECT * INTO v_job
  FROM public.jobs j
  WHERE j.magic_link_token = p_token
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT
      v_job.id::TEXT,
      v_job.title,
      v_job.client_name,
      v_job.client_id,
      v_job.technician_name,
      v_job.technician_id,
      v_job.status,
      v_job.scheduled_date,
      v_job.address,
      v_job.lat,
      v_job.lng,
      v_job.w3w,
      v_job.notes,
      v_job.work_summary,
      v_job.photos,
      v_job.signature_url,
      v_job.signer_name,
      v_job.signer_role,
      v_job.safety_checklist,
      v_job.site_hazards,
      v_job.completed_at,
      v_job.template_id,
      v_job.sync_status,
      v_job.last_updated,
      v_job.price,
      v_job.workspace_id,
      v_job.sealed_at,
      v_job.sealed_by,
      v_job.evidence_hash,
      v_job.magic_link_token,
      v_job.magic_link_url,
      true, -- is_valid
      NULL::TEXT; -- no error
    RETURN;
  END IF;

  -- 3. Token not found - return error
  RETURN QUERY SELECT
    NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::UUID, NULL::TEXT, NULL::UUID,
    NULL::TEXT, NULL::TIMESTAMP WITH TIME ZONE, NULL::TEXT, NULL::DOUBLE PRECISION,
    NULL::DOUBLE PRECISION, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::JSONB,
    NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::JSONB, NULL::JSONB,
    NULL::TIMESTAMP WITH TIME ZONE, NULL::UUID, NULL::TEXT, NULL::BIGINT,
    NULL::DECIMAL, NULL::UUID, NULL::TIMESTAMP WITH TIME ZONE, NULL::UUID,
    NULL::TEXT, NULL::TEXT, NULL::TEXT,
    false, -- is_valid
    'Invalid or expired link. Please check the URL or contact your manager.'::TEXT;
  RETURN;
END;
$$;

-- Grant execute to anonymous users (for magic link access)
GRANT EXECUTE ON FUNCTION public.get_job_by_magic_link_token(TEXT) TO anon;

-- Also grant to authenticated users (for consistency)
GRANT EXECUTE ON FUNCTION public.get_job_by_magic_link_token(TEXT) TO authenticated;

-- Add documentation
COMMENT ON FUNCTION public.get_job_by_magic_link_token(TEXT) IS
'Returns full job data by magic link token. SECURITY DEFINER bypasses RLS for anonymous access. Checks both job_access_tokens table and jobs.magic_link_token column.';
