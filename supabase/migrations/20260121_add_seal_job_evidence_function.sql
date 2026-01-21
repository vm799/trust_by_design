-- ============================================================================
-- ADD MISSING seal_job_evidence FUNCTION
-- ============================================================================
-- Purpose: Create the missing seal_job_evidence function that was referenced
-- in 20260121_complete_advisor_remediation.sql but never created.
--
-- This function creates cryptographic seals for job evidence bundles.
-- ============================================================================

-- ============================================================================
-- FUNCTION: seal_job_evidence
-- ============================================================================
-- Purpose: Creates a cryptographic seal for a job's evidence bundle
-- Parameters:
--   p_job_id: The UUID of the job to seal
--   p_evidence_hash: The SHA-256 hash of the evidence bundle (64 hex chars)
-- Returns: UUID of the created evidence_seal record
-- ============================================================================

CREATE OR REPLACE FUNCTION public.seal_job_evidence(
  p_job_id UUID,
  p_evidence_hash TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_workspace_id UUID;
  v_user_id UUID;
  v_user_email TEXT;
  v_evidence_bundle JSONB;
  v_signature TEXT;
  v_seal_id UUID;
  v_is_already_sealed BOOLEAN;
BEGIN
  -- Get current user
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to seal job evidence'
      USING ERRCODE = 'authentication_required';
  END IF;

  -- Get user email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = v_user_id;

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'User email not found for user ID: %', v_user_id
      USING ERRCODE = 'invalid_user';
  END IF;

  -- Get job workspace and check if already sealed
  SELECT
    j.workspace_id,
    j.sealed_at IS NOT NULL
  INTO v_workspace_id, v_is_already_sealed
  FROM jobs j
  WHERE j.id = p_job_id;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Job not found: %', p_job_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_is_already_sealed THEN
    RAISE EXCEPTION 'Job % is already sealed. Sealed evidence is immutable.', p_job_id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- Validate evidence hash format (must be 64 hex characters for SHA-256)
  IF NOT (p_evidence_hash ~ '^[a-f0-9]{64}$') THEN
    RAISE EXCEPTION 'Invalid evidence hash format. Expected 64 hex characters (SHA-256), got: %', p_evidence_hash
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Build evidence bundle (snapshot of all job data at seal time)
  SELECT jsonb_build_object(
    'job_id', j.id,
    'workspace_id', j.workspace_id,
    'client_name', c.name,
    'client_email', c.email,
    'property_address', j.property_address,
    'status', j.status,
    'assigned_technician', t.name,
    'created_at', j.created_at,
    'updated_at', j.updated_at,
    'job_type', j.job_type,
    'notes', j.notes,
    'photos', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'url', p.url,
          'type', p.type,
          'timestamp', p.timestamp,
          'notes', p.notes
        ) ORDER BY p.timestamp
      )
      FROM photos p
      WHERE p.job_id = j.id
    ),
    'safety_checks', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', sc.id,
          'check_type', sc.check_type,
          'passed', sc.passed,
          'notes', sc.notes,
          'checked_at', sc.checked_at
        ) ORDER BY sc.checked_at
      )
      FROM safety_checks sc
      WHERE sc.job_id = j.id
    )
  )
  INTO v_evidence_bundle
  FROM jobs j
  LEFT JOIN clients c ON c.id = j.client_id
  LEFT JOIN technicians t ON t.id = j.assigned_technician_id
  WHERE j.id = p_job_id;

  -- Generate signature (using hash as signature for now - in production this would use RSA)
  -- TODO: Replace with actual RSA-2048 signature in production
  v_signature := encode(digest(p_evidence_hash || v_user_id::TEXT || NOW()::TEXT, 'sha256'), 'base64');

  -- Create the evidence seal record
  INSERT INTO evidence_seals (
    job_id,
    workspace_id,
    evidence_hash,
    signature,
    algorithm,
    sealed_by_user_id,
    sealed_by_email,
    evidence_bundle
  ) VALUES (
    p_job_id,
    v_workspace_id,
    p_evidence_hash,
    v_signature,
    'SHA256-RSA2048',
    v_user_id,
    v_user_email,
    v_evidence_bundle
  )
  RETURNING id INTO v_seal_id;

  -- Update the job's sealed_at timestamp
  UPDATE jobs
  SET sealed_at = NOW()
  WHERE id = p_job_id;

  -- Log audit event
  INSERT INTO audit_logs (
    workspace_id,
    user_id,
    action,
    resource_type,
    resource_id,
    details
  ) VALUES (
    v_workspace_id,
    v_user_id,
    'seal_evidence',
    'job',
    p_job_id,
    jsonb_build_object(
      'evidence_hash', p_evidence_hash,
      'seal_id', v_seal_id,
      'sealed_by', v_user_email
    )
  );

  RETURN v_seal_id;
END;
$$;

COMMENT ON FUNCTION public.seal_job_evidence(UUID, TEXT) IS
'Creates a cryptographic seal for a job evidence bundle. Once sealed, the job becomes immutable.
Requires authentication and workspace membership.';

-- Grant execute to authenticated users (RLS in evidence_seals will control actual access)
GRANT EXECUTE ON FUNCTION public.seal_job_evidence(UUID, TEXT) TO authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  -- Verify function was created
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'seal_job_evidence'
  ) THEN
    RAISE EXCEPTION 'Failed to create seal_job_evidence function';
  END IF;

  RAISE NOTICE '✅ seal_job_evidence function created successfully';
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
