-- ============================================================================
-- MIGRATION 007: Security-Hardened Field Proof System
-- Phase 15 - Enterprise-Grade Proof Capture with Audit Fixes
-- Date: 2026-01-25
-- Project: ndcjtpzixjbhmzbavqdm
-- ============================================================================
-- SUPABASE-SPECIFIC NOTES:
-- ⚠️ pgcrypto is in 'extensions' schema - use extensions.digest()
-- ⚠️ jobs.id is UUID - cast with ::UUID
-- ⚠️ Use client_id not client, assigned_technician_id not techId
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add proof system columns
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tech_token_hash TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tech_pin_hash TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS token_used BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS token_used_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS proof_data JSONB DEFAULT '{}';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS before_photo TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS after_photo TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS notes_before TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS notes_after TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS client_signature TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS client_signature_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS client_name_signed TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS proof_completed_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS manager_notified_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS client_notified_at TIMESTAMPTZ;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_jobs_tech_token_hash ON jobs(tech_token_hash) WHERE tech_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_workspace_status ON jobs(workspace_id, status) WHERE workspace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_token_expires ON jobs(token_expires_at) WHERE token_expires_at IS NOT NULL AND NOT token_used;

-- Drop existing functions
DROP FUNCTION IF EXISTS generate_tech_access(TEXT, INTEGER);
DROP FUNCTION IF EXISTS validate_tech_token(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS submit_job_proof(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS get_job_proof_status(TEXT);

-- validate_tech_token: Validates token/PIN and returns job data
CREATE OR REPLACE FUNCTION validate_tech_token(p_job_id TEXT, p_raw_token TEXT DEFAULT NULL, p_raw_pin TEXT DEFAULT NULL)
RETURNS TABLE(is_valid BOOLEAN, job_data JSONB)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_token_hash TEXT; v_pin_hash TEXT; v_job_id UUID;
BEGIN
  IF p_raw_token IS NOT NULL THEN v_token_hash := encode(extensions.digest(p_raw_token::bytea, 'sha256'), 'hex'); END IF;
  IF p_raw_pin IS NOT NULL THEN v_pin_hash := encode(extensions.digest(p_raw_pin::bytea, 'sha256'), 'hex'); END IF;

  SELECT j.id INTO v_job_id FROM jobs j WHERE j.id = p_job_id::UUID
  AND ((v_token_hash IS NOT NULL AND j.tech_token_hash = v_token_hash) OR (v_pin_hash IS NOT NULL AND j.tech_pin_hash = v_pin_hash))
  AND NOT COALESCE(j.token_used, false) AND (j.token_expires_at IS NULL OR j.token_expires_at > NOW());

  IF v_job_id IS NOT NULL THEN
    UPDATE jobs SET token_used_at = COALESCE(token_used_at, NOW()) WHERE id = v_job_id AND token_used_at IS NULL;
    RETURN QUERY SELECT true, to_jsonb(j.*) FROM jobs j WHERE j.id = v_job_id;
  ELSE
    RETURN QUERY SELECT false, NULL::JSONB;
  END IF;
END; $$;

-- submit_job_proof: Atomic proof submission with token invalidation
CREATE OR REPLACE FUNCTION submit_job_proof(p_job_id TEXT, p_raw_token TEXT, p_before_photo TEXT DEFAULT NULL, p_after_photo TEXT DEFAULT NULL, p_notes_before TEXT DEFAULT NULL, p_notes_after TEXT DEFAULT NULL, p_client_signature TEXT DEFAULT NULL, p_client_name TEXT DEFAULT NULL, p_proof_metadata JSONB DEFAULT '{}')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_token_hash TEXT; v_job_id UUID;
BEGIN
  v_token_hash := encode(extensions.digest(p_raw_token::bytea, 'sha256'), 'hex');
  SELECT j.id INTO v_job_id FROM jobs j WHERE j.id = p_job_id::UUID AND j.tech_token_hash = v_token_hash
  AND NOT COALESCE(j.token_used, false) AND (j.token_expires_at IS NULL OR j.token_expires_at > NOW()) FOR UPDATE;
  IF v_job_id IS NULL THEN RETURN '{"success":false,"error":"Invalid or expired token"}'::jsonb; END IF;
  UPDATE jobs SET before_photo = COALESCE(p_before_photo, before_photo), after_photo = COALESCE(p_after_photo, after_photo),
    notes_before = COALESCE(p_notes_before, notes_before), notes_after = COALESCE(p_notes_after, notes_after),
    client_signature = COALESCE(p_client_signature, client_signature),
    client_signature_at = CASE WHEN p_client_signature IS NOT NULL THEN NOW() ELSE client_signature_at END,
    client_name_signed = COALESCE(p_client_name, client_name_signed),
    proof_data = COALESCE(proof_data,'{}'::jsonb) || p_proof_metadata || jsonb_build_object('submitted_at', NOW()),
    proof_completed_at = NOW(), token_used = true, token_used_at = NOW(), status = 'completed', completed_at = NOW()
  WHERE id = v_job_id;
  RETURN jsonb_build_object('success', true, 'job_id', v_job_id);
END; $$;

-- Grants
GRANT EXECUTE ON FUNCTION validate_tech_token(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION submit_job_proof(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO anon;
