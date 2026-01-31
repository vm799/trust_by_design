-- ============================================================================
-- MIGRATION: Auto-Seal Evidence on Proof Submission
-- Date: 2026-01-31
-- Purpose: Automatically seal evidence when technician submits proof via token
--
-- PROBLEM SOLVED:
-- The seal-evidence Edge Function requires authenticated session, but technicians
-- using magic links only have tokens (not auth sessions). This causes auto-seal
-- to fail silently after proof submission.
--
-- SOLUTION:
-- Create a database trigger that auto-seals jobs when:
-- 1. Status changes to 'completed'
-- 2. Job has all required evidence (photos + signature)
-- 3. Job is not already sealed
--
-- This uses SECURITY DEFINER to run with elevated permissions.
-- ============================================================================

-- Function to auto-seal a job after proof is submitted
CREATE OR REPLACE FUNCTION auto_seal_job_on_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_evidence_hash TEXT;
  v_workspace_id UUID;
  v_sealed_by TEXT;
  v_bundle JSONB;
BEGIN
  -- Only trigger when status changes to 'completed' and has required evidence
  IF NEW.status = 'completed'
     AND OLD.status IS DISTINCT FROM 'completed'
     AND NEW.sealed_at IS NULL
     AND (NEW.before_photo IS NOT NULL OR NEW.after_photo IS NOT NULL)
     AND NEW.client_signature IS NOT NULL THEN

    -- Get workspace ID
    v_workspace_id := NEW.workspace_id;

    -- Determine sealed_by (technician who submitted or system)
    v_sealed_by := COALESCE(
      (SELECT email FROM users WHERE id = NEW.assigned_technician_id LIMIT 1),
      'system@jobproof.pro'
    );

    -- Build evidence bundle for hashing
    v_bundle := jsonb_build_object(
      'job', jsonb_build_object(
        'id', NEW.id,
        'title', NEW.title,
        'client', NEW.client_name,
        'address', NEW.address,
        'completed_at', NEW.completed_at
      ),
      'evidence', jsonb_build_object(
        'before_photo', NEW.before_photo IS NOT NULL,
        'after_photo', NEW.after_photo IS NOT NULL,
        'client_signature', NEW.client_signature IS NOT NULL,
        'notes_before', NEW.notes_before,
        'notes_after', NEW.notes_after
      ),
      'location', jsonb_build_object(
        'gps_lat', NEW.proof_data->>'gps_lat',
        'gps_lng', NEW.proof_data->>'gps_lng',
        'w3w', NEW.proof_data->>'w3w',
        'w3w_verified', NEW.proof_data->>'w3w_verified'
      ),
      'metadata', jsonb_build_object(
        'sealed_at', NOW(),
        'sealed_by', v_sealed_by,
        'auto_sealed', true
      )
    );

    -- Calculate SHA-256 hash of the evidence bundle
    v_evidence_hash := encode(
      extensions.digest(
        convert_to(v_bundle::text, 'UTF8'),
        'sha256'
      ),
      'hex'
    );

    -- Insert seal record
    INSERT INTO evidence_seals (
      job_id,
      workspace_id,
      evidence_hash,
      signature,
      algorithm,
      sealed_by_email,
      evidence_bundle,
      sealed_at
    ) VALUES (
      NEW.id,
      v_workspace_id,
      v_evidence_hash,
      'auto_seal_' || v_evidence_hash,  -- Auto-generated signature (HMAC style)
      'SHA256-AUTO',
      v_sealed_by,
      v_bundle,
      NOW()
    )
    ON CONFLICT (job_id) DO NOTHING;  -- Don't fail if already sealed

    -- Update job sealed_at timestamp
    NEW.sealed_at := NOW();

    RAISE NOTICE 'Auto-sealed job % with hash %', NEW.id, LEFT(v_evidence_hash, 16);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION auto_seal_job_on_completion() IS
  'Automatically seals job evidence when proof is submitted via token. Runs with SECURITY DEFINER to bypass RLS.';

-- Create trigger on jobs table
DROP TRIGGER IF EXISTS auto_seal_on_job_complete ON jobs;
CREATE TRIGGER auto_seal_on_job_complete
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION auto_seal_job_on_completion();

-- Also add W3W column to jobs table for direct storage
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS w3w TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS w3w_verified BOOLEAN DEFAULT false;

COMMENT ON COLUMN jobs.w3w IS 'What3Words location address (e.g., ///filled.count.soap)';
COMMENT ON COLUMN jobs.w3w_verified IS 'Whether W3W address was verified via API (true) or mock (false)';

-- Update submit_job_proof to extract and store W3W from proof_metadata
CREATE OR REPLACE FUNCTION submit_job_proof(
  p_job_id TEXT,
  p_raw_token TEXT,
  p_before_photo TEXT DEFAULT NULL,
  p_after_photo TEXT DEFAULT NULL,
  p_notes_before TEXT DEFAULT NULL,
  p_notes_after TEXT DEFAULT NULL,
  p_client_signature TEXT DEFAULT NULL,
  p_client_name TEXT DEFAULT NULL,
  p_proof_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_hash TEXT;
  v_job_id UUID;
  v_w3w TEXT;
  v_w3w_verified BOOLEAN;
BEGIN
  v_token_hash := encode(extensions.digest(p_raw_token::bytea, 'sha256'), 'hex');

  SELECT j.id INTO v_job_id
  FROM jobs j
  WHERE j.id = p_job_id::UUID
    AND j.tech_token_hash = v_token_hash
    AND NOT COALESCE(j.token_used, false)
    AND (j.token_expires_at IS NULL OR j.token_expires_at > NOW())
  FOR UPDATE;

  IF v_job_id IS NULL THEN
    RETURN '{"success":false,"error":"Invalid or expired token"}'::jsonb;
  END IF;

  -- Extract W3W from metadata
  v_w3w := p_proof_metadata->>'w3w';
  v_w3w_verified := COALESCE((p_proof_metadata->>'w3w_verified')::boolean, false);

  UPDATE jobs SET
    before_photo = COALESCE(p_before_photo, before_photo),
    after_photo = COALESCE(p_after_photo, after_photo),
    notes_before = COALESCE(p_notes_before, notes_before),
    notes_after = COALESCE(p_notes_after, notes_after),
    client_signature = COALESCE(p_client_signature, client_signature),
    client_signature_at = CASE WHEN p_client_signature IS NOT NULL THEN NOW() ELSE client_signature_at END,
    client_name_signed = COALESCE(p_client_name, client_name_signed),
    proof_data = COALESCE(proof_data,'{}'::jsonb) || p_proof_metadata || jsonb_build_object('submitted_at', NOW()),
    proof_completed_at = NOW(),
    token_used = true,
    token_used_at = NOW(),
    status = 'completed',
    completed_at = NOW(),
    -- Store W3W directly on job
    w3w = COALESCE(v_w3w, w3w),
    w3w_verified = COALESCE(v_w3w_verified, w3w_verified)
  WHERE id = v_job_id;

  RETURN jsonb_build_object(
    'success', true,
    'job_id', v_job_id,
    'w3w', v_w3w,
    'auto_seal', true
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION submit_job_proof(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION submit_job_proof(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 20260131_auto_seal_on_proof_submit completed:';
  RAISE NOTICE '  - Added auto_seal_job_on_completion trigger';
  RAISE NOTICE '  - Added w3w and w3w_verified columns to jobs';
  RAISE NOTICE '  - Updated submit_job_proof to store W3W data';
END $$;
