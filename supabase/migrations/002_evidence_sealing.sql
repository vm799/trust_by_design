-- =====================================================================
-- MIGRATION 002: EVIDENCE SEALING INFRASTRUCTURE
-- =====================================================================
-- Phase: C.3 - Cryptographic Sealing
-- Purpose: Implement cryptographic sealing for evidence bundles
-- Features:
--   - evidence_seals table for seal metadata
--   - sealed_at column on jobs table
--   - Database trigger to prevent sealed record modification
--   - Helper functions for seal operations
-- =====================================================================

-- =====================================================================
-- 1. EVIDENCE SEALS TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS evidence_seals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Cryptographic data
  evidence_hash TEXT NOT NULL, -- SHA-256 hash (64 hex characters)
  signature TEXT NOT NULL, -- RSA-2048 signature (base64 encoded)
  algorithm TEXT NOT NULL DEFAULT 'SHA256-RSA2048',

  -- Metadata
  sealed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sealed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  sealed_by_email TEXT NOT NULL,

  -- Evidence snapshot (stored for verification)
  evidence_bundle JSONB NOT NULL,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_hash_format CHECK (evidence_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT valid_signature_format CHECK (length(signature) > 0)
);

COMMENT ON TABLE evidence_seals IS 'Cryptographic seals for evidence bundles - immutable once created';
COMMENT ON COLUMN evidence_seals.evidence_hash IS 'SHA-256 hash of canonical JSON evidence bundle';
COMMENT ON COLUMN evidence_seals.signature IS 'RSA-2048 signature of evidence hash';
COMMENT ON COLUMN evidence_seals.evidence_bundle IS 'Complete evidence bundle at time of sealing (for verification)';

-- Indexes
CREATE INDEX idx_evidence_seals_job_id ON evidence_seals(job_id);
CREATE INDEX idx_evidence_seals_workspace_id ON evidence_seals(workspace_id);
CREATE INDEX idx_evidence_seals_sealed_at ON evidence_seals(sealed_at DESC);

-- =====================================================================
-- 2. ADD sealed_at COLUMN TO JOBS TABLE
-- =====================================================================

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS sealed_at TIMESTAMPTZ;

COMMENT ON COLUMN jobs.sealed_at IS 'Timestamp when job evidence was cryptographically sealed - NULL = unsealed';

CREATE INDEX IF NOT EXISTS idx_jobs_sealed_at ON jobs(sealed_at) WHERE sealed_at IS NOT NULL;

-- =====================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================

-- Enable RLS on evidence_seals table
ALTER TABLE evidence_seals ENABLE ROW LEVEL SECURITY;

-- Users can view seals for their workspace jobs
CREATE POLICY "Users can view workspace evidence seals"
  ON evidence_seals FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
  );

-- Only the sealing function can insert seals (not users directly)
CREATE POLICY "Only seal function can insert seals"
  ON evidence_seals FOR INSERT
  WITH CHECK (false); -- Will be overridden by SECURITY DEFINER function

-- Seals are immutable - no updates or deletes
CREATE POLICY "Seals cannot be updated"
  ON evidence_seals FOR UPDATE
  USING (false);

CREATE POLICY "Seals cannot be deleted"
  ON evidence_seals FOR DELETE
  USING (false);

-- =====================================================================
-- 4. TRIGGER: PREVENT SEALED JOB MODIFICATION
-- =====================================================================

CREATE OR REPLACE FUNCTION prevent_sealed_job_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if job is sealed
  IF OLD.sealed_at IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot modify sealed job (ID: %). Job was sealed at % UTC. Sealed evidence is immutable.',
      OLD.id,
      OLD.sealed_at
    USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION prevent_sealed_job_modification() IS 'Prevents any modifications to jobs that have been cryptographically sealed';

-- Attach trigger to jobs table
DROP TRIGGER IF EXISTS prevent_job_update_after_seal ON jobs;
CREATE TRIGGER prevent_job_update_after_seal
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_sealed_job_modification();

-- =====================================================================
-- 5. TRIGGER: PREVENT SEALED JOB DELETION
-- =====================================================================

CREATE OR REPLACE FUNCTION prevent_sealed_job_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.sealed_at IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot delete sealed job (ID: %). Sealed evidence must be preserved.',
      OLD.id
    USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_job_delete_after_seal ON jobs;
CREATE TRIGGER prevent_job_delete_after_seal
  BEFORE DELETE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_sealed_job_deletion();

-- =====================================================================
-- 6. HELPER FUNCTION: GET SEAL STATUS
-- =====================================================================

CREATE OR REPLACE FUNCTION get_job_seal_status(p_job_id UUID)
RETURNS TABLE(
  is_sealed BOOLEAN,
  sealed_at TIMESTAMPTZ,
  sealed_by TEXT,
  evidence_hash TEXT,
  signature TEXT,
  algorithm TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    j.sealed_at IS NOT NULL as is_sealed,
    j.sealed_at,
    es.sealed_by_email,
    es.evidence_hash,
    es.signature,
    es.algorithm
  FROM jobs j
  LEFT JOIN evidence_seals es ON es.job_id = j.id
  WHERE j.id = p_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_job_seal_status(UUID) IS 'Returns seal status and metadata for a given job ID';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_job_seal_status(UUID) TO authenticated;

-- =====================================================================
-- 7. HELPER FUNCTION: GET EVIDENCE BUNDLE
-- =====================================================================

CREATE OR REPLACE FUNCTION get_evidence_bundle(p_job_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_bundle JSONB;
BEGIN
  -- Check if seal exists
  SELECT evidence_bundle INTO v_bundle
  FROM evidence_seals
  WHERE job_id = p_job_id;

  IF v_bundle IS NULL THEN
    RAISE EXCEPTION 'No seal found for job ID: %', p_job_id;
  END IF;

  RETURN v_bundle;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_evidence_bundle(UUID) IS 'Returns the stored evidence bundle for verification';

GRANT EXECUTE ON FUNCTION get_evidence_bundle(UUID) TO authenticated;

-- =====================================================================
-- 8. HELPER FUNCTION: INVALIDATE MAGIC LINK TOKENS ON SEAL
-- =====================================================================

CREATE OR REPLACE FUNCTION invalidate_tokens_on_seal()
RETURNS TRIGGER AS $$
BEGIN
  -- When a job is sealed, expire all its magic link tokens
  IF NEW.sealed_at IS NOT NULL AND OLD.sealed_at IS NULL THEN
    UPDATE job_access_tokens
    SET expires_at = NOW()
    WHERE job_id = NEW.id
      AND expires_at > NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION invalidate_tokens_on_seal() IS 'Automatically expires magic link tokens when a job is sealed';

DROP TRIGGER IF EXISTS invalidate_tokens_on_job_seal ON jobs;
CREATE TRIGGER invalidate_tokens_on_job_seal
  AFTER UPDATE ON jobs
  FOR EACH ROW
  WHEN (NEW.sealed_at IS NOT NULL AND OLD.sealed_at IS NULL)
  EXECUTE FUNCTION invalidate_tokens_on_seal();

-- =====================================================================
-- 9. HELPER FUNCTION: COUNT WORKSPACE SEALS (for usage metrics)
-- =====================================================================

CREATE OR REPLACE FUNCTION count_workspace_seals(p_workspace_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM evidence_seals
  WHERE workspace_id = p_workspace_id;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION count_workspace_seals(UUID) IS 'Returns total number of seals for a workspace (for billing/usage tracking)';

GRANT EXECUTE ON FUNCTION count_workspace_seals(UUID) TO authenticated;

-- =====================================================================
-- 10. VALIDATION: ENSURE JOBS TABLE EXISTS
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jobs') THEN
    RAISE EXCEPTION 'Migration dependency not met: jobs table does not exist. Run migration 001 first.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspaces') THEN
    RAISE EXCEPTION 'Migration dependency not met: workspaces table does not exist. Run migration 001 first.';
  END IF;
END $$;

-- =====================================================================
-- MIGRATION COMPLETE
-- =====================================================================

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 002 (Evidence Sealing) completed successfully';
  RAISE NOTICE 'Created: evidence_seals table with RLS policies';
  RAISE NOTICE 'Added: jobs.sealed_at column';
  RAISE NOTICE 'Created: Triggers to prevent sealed job modification';
  RAISE NOTICE 'Created: Helper functions for seal operations';
END $$;
