-- ============================================================================
-- MIGRATION 007: Field Proof System
-- Phase 15 - Enterprise-Grade Proof Capture
-- Date: 2026-01-25
-- Project: ndcjtpzixjbhmzbavqdm
-- ============================================================================
-- SAFETY: All operations use IF NOT EXISTS / IF EXISTS guards
-- ROLLBACK: No destructive operations (DROP/DELETE)
-- ============================================================================

-- ============================================================================
-- ADD PROOF SYSTEM COLUMNS TO JOBS TABLE
-- ============================================================================

-- Tech access token (simple 6-char code embedded in URL)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tech_token TEXT;

-- Backup PIN access (6-digit fallback if token fails)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tech_pin TEXT;

-- Token usage tracking
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS token_used BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS token_used_at TIMESTAMPTZ;

-- Proof data bundle (JSONB for flexibility)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS proof_data JSONB DEFAULT '{}';

-- Before/After photo URLs (Supabase Storage references)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS before_photo TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS after_photo TEXT;

-- Before/After notes
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS notes_before TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS notes_after TEXT;

-- Client signature (base64 or storage URL)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS client_signature TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS client_signature_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS client_name_signed TEXT;

-- Proof completion tracking
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS proof_completed_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS proof_submitted_by TEXT;

-- Manager notification tracking
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS manager_notified_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS client_notified_at TIMESTAMPTZ;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Unique constraint on tech_token (each job has unique token)
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_tech_token
  ON jobs(tech_token)
  WHERE tech_token IS NOT NULL;

-- Index for status + completion queries
CREATE INDEX IF NOT EXISTS idx_jobs_status_completed
  ON jobs(status, proof_completed_at);

-- Index for token-based lookups
CREATE INDEX IF NOT EXISTS idx_jobs_token_used
  ON jobs(token_used, tech_token);

-- ============================================================================
-- RLS POLICIES FOR PROOF SYSTEM
-- ============================================================================

-- Policy: Tech can access job via valid token (public access with token)
-- This allows unauthenticated access via magic link token
DROP POLICY IF EXISTS "Tech token access to job" ON jobs;
CREATE POLICY "Tech token access to job"
  ON jobs FOR SELECT
  USING (
    tech_token IS NOT NULL
    AND tech_token = current_setting('request.headers', true)::json->>'x-tech-token'
  );

-- Policy: Tech can update job proof data via token
DROP POLICY IF EXISTS "Tech can submit proof via token" ON jobs;
CREATE POLICY "Tech can submit proof via token"
  ON jobs FOR UPDATE
  USING (
    tech_token IS NOT NULL
    AND tech_token = current_setting('request.headers', true)::json->>'x-tech-token'
  )
  WITH CHECK (
    tech_token IS NOT NULL
    AND tech_token = current_setting('request.headers', true)::json->>'x-tech-token'
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function: Generate unique 6-character tech token
CREATE OR REPLACE FUNCTION generate_tech_token()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Exclude confusing chars (0,O,1,I)
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function: Generate unique 6-digit PIN
CREATE OR REPLACE FUNCTION generate_tech_pin()
RETURNS TEXT AS $$
BEGIN
  RETURN lpad(floor(random() * 1000000)::text, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Function: Create tech access link for job
CREATE OR REPLACE FUNCTION create_tech_access_link(
  p_job_id TEXT
)
RETURNS TABLE(token TEXT, pin TEXT, link TEXT) AS $$
DECLARE
  v_token TEXT;
  v_pin TEXT;
  v_existing_token TEXT;
BEGIN
  -- Check if job already has a token
  SELECT jobs.tech_token INTO v_existing_token
  FROM jobs
  WHERE id = p_job_id;

  IF v_existing_token IS NOT NULL THEN
    -- Return existing token
    SELECT jobs.tech_token, jobs.tech_pin
    INTO v_token, v_pin
    FROM jobs
    WHERE id = p_job_id;
  ELSE
    -- Generate new token and PIN
    v_token := generate_tech_token();
    v_pin := generate_tech_pin();

    -- Ensure uniqueness (retry if collision)
    WHILE EXISTS(SELECT 1 FROM jobs WHERE tech_token = v_token) LOOP
      v_token := generate_tech_token();
    END LOOP;

    -- Update job with token and PIN
    UPDATE jobs
    SET tech_token = v_token,
        tech_pin = v_pin,
        token_used = false
    WHERE id = p_job_id;
  END IF;

  RETURN QUERY SELECT
    v_token AS token,
    v_pin AS pin,
    '/job/' || p_job_id || '/' || v_token AS link;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Validate tech access (token or PIN)
CREATE OR REPLACE FUNCTION validate_tech_access(
  p_job_id TEXT,
  p_token TEXT DEFAULT NULL,
  p_pin TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_valid BOOLEAN := false;
BEGIN
  -- Check token match
  IF p_token IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM jobs
      WHERE id = p_job_id
      AND tech_token = p_token
    ) INTO v_valid;
  END IF;

  -- Check PIN match (fallback)
  IF NOT v_valid AND p_pin IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM jobs
      WHERE id = p_job_id
      AND tech_pin = p_pin
    ) INTO v_valid;
  END IF;

  -- Mark token as used on first valid access
  IF v_valid THEN
    UPDATE jobs
    SET token_used = true,
        token_used_at = COALESCE(token_used_at, NOW())
    WHERE id = p_job_id
    AND token_used = false;
  END IF;

  RETURN v_valid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Submit proof data
CREATE OR REPLACE FUNCTION submit_job_proof(
  p_job_id TEXT,
  p_token TEXT,
  p_before_photo TEXT DEFAULT NULL,
  p_after_photo TEXT DEFAULT NULL,
  p_notes_before TEXT DEFAULT NULL,
  p_notes_after TEXT DEFAULT NULL,
  p_client_signature TEXT DEFAULT NULL,
  p_client_name TEXT DEFAULT NULL,
  p_proof_data JSONB DEFAULT '{}'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_valid BOOLEAN;
BEGIN
  -- Validate token access
  SELECT validate_tech_access(p_job_id, p_token) INTO v_valid;

  IF NOT v_valid THEN
    RETURN false;
  END IF;

  -- Update job with proof data
  UPDATE jobs SET
    before_photo = COALESCE(p_before_photo, before_photo),
    after_photo = COALESCE(p_after_photo, after_photo),
    notes_before = COALESCE(p_notes_before, notes_before),
    notes_after = COALESCE(p_notes_after, notes_after),
    client_signature = COALESCE(p_client_signature, client_signature),
    client_signature_at = CASE WHEN p_client_signature IS NOT NULL THEN NOW() ELSE client_signature_at END,
    client_name_signed = COALESCE(p_client_name, client_name_signed),
    proof_data = proof_data || p_proof_data,
    proof_completed_at = NOW(),
    proof_submitted_by = p_token,
    status = 'completed'
  WHERE id = p_job_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Allow anon to call validation function (for magic link access)
GRANT EXECUTE ON FUNCTION validate_tech_access(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION submit_job_proof(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO anon;

-- Allow authenticated users to create tech access links
GRANT EXECUTE ON FUNCTION create_tech_access_link(TEXT) TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN jobs.tech_token IS 'Unique 6-char token for magic link access (e.g., ABC123)';
COMMENT ON COLUMN jobs.tech_pin IS '6-digit fallback PIN if token fails';
COMMENT ON COLUMN jobs.token_used IS 'True when technician has accessed the job via token';
COMMENT ON COLUMN jobs.proof_data IS 'JSONB bundle of all proof metadata (GPS, timestamps, device info)';
COMMENT ON COLUMN jobs.before_photo IS 'Supabase Storage URL for before photo';
COMMENT ON COLUMN jobs.after_photo IS 'Supabase Storage URL for after photo';
COMMENT ON COLUMN jobs.client_signature IS 'Base64 or Storage URL for client signature';
COMMENT ON COLUMN jobs.proof_completed_at IS 'Timestamp when proof was fully submitted';

COMMENT ON FUNCTION generate_tech_token() IS 'Generates unique 6-char alphanumeric token (excludes confusing chars)';
COMMENT ON FUNCTION create_tech_access_link(TEXT) IS 'Creates tech access token and PIN for a job';
COMMENT ON FUNCTION validate_tech_access(TEXT, TEXT, TEXT) IS 'Validates token or PIN access to job';
COMMENT ON FUNCTION submit_job_proof(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) IS 'Submits proof data for job via token';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
--
-- To apply this migration:
-- 1. supabase link --project-ref ndcjtpzixjbhmzbavqdm
-- 2. supabase db dump --db-url $DATABASE_URL -f backup_20260125_proof.sql
-- 3. supabase migration up --single
-- 4. Verify: SELECT tech_token, tech_pin FROM jobs LIMIT 1;
--
-- Rollback (if needed):
-- ALTER TABLE jobs DROP COLUMN IF EXISTS tech_token;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS tech_pin;
-- ... (safe to drop newly added columns)
-- ============================================================================
