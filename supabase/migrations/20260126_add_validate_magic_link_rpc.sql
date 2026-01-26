-- Migration: Add validate_magic_link_token RPC for anonymous access
-- Purpose: Fix "Job not found" error when technicians click magic links in new browser
-- Date: 2026-01-26
--
-- ROOT CAUSE:
-- validateMagicLink() in lib/db.ts queries job_access_tokens and jobs tables directly
-- RLS policies block anonymous access to these tables
-- This causes "Job not found" error in cross-browser technician invite flow
--
-- FIX:
-- Create SECURITY DEFINER RPC function that bypasses RLS
-- Grant execute to 'anon' role for anonymous access via magic links

-- Drop if exists (for idempotent migrations)
DROP FUNCTION IF EXISTS public.validate_magic_link_token(TEXT);

-- Create the validation function
CREATE OR REPLACE FUNCTION public.validate_magic_link_token(p_token TEXT)
RETURNS TABLE(
  job_id TEXT,
  workspace_id UUID,
  is_sealed BOOLEAN,
  is_expired BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_token_data RECORD;
  v_job_data RECORD;
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
        v_token_data.job_id::TEXT,
        NULL::UUID,
        false,
        true; -- is_expired
      RETURN;
    END IF;

    -- Get job details
    SELECT
      j.workspace_id,
      j.sealed_at IS NOT NULL AS is_sealed
    INTO v_job_data
    FROM public.jobs j
    WHERE j.id::TEXT = v_token_data.job_id;

    IF FOUND THEN
      RETURN QUERY SELECT
        v_token_data.job_id::TEXT,
        v_job_data.workspace_id,
        v_job_data.is_sealed,
        false; -- not expired
      RETURN;
    END IF;
  END IF;

  -- 2. Fallback: Try jobs.magic_link_token column (for tokens stored directly on job)
  SELECT
    j.id::TEXT AS job_id,
    j.workspace_id,
    j.sealed_at IS NOT NULL AS is_sealed
  INTO v_job_data
  FROM public.jobs j
  WHERE j.magic_link_token = p_token
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT
      v_job_data.job_id,
      v_job_data.workspace_id,
      v_job_data.is_sealed,
      false; -- not expired (magic_link_token doesn't have expiry)
    RETURN;
  END IF;

  -- 3. Token not found - return empty result set
  RETURN;
END;
$$;

-- Grant execute to anonymous users (for magic link access)
GRANT EXECUTE ON FUNCTION public.validate_magic_link_token(TEXT) TO anon;

-- Also grant to authenticated users (for consistency)
GRANT EXECUTE ON FUNCTION public.validate_magic_link_token(TEXT) TO authenticated;

-- Add documentation
COMMENT ON FUNCTION public.validate_magic_link_token(TEXT) IS
'Validates magic link token and returns job details. SECURITY DEFINER bypasses RLS for anonymous access. Checks both job_access_tokens table and jobs.magic_link_token column.';
