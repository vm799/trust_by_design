-- ============================================================================
-- MIGRATION: Fix Stability and Security Issues
-- Date: 2026-01-25
-- ============================================================================
-- PURPOSE: Address linter errors causing instability and timeouts
--
-- FIXES:
-- 1. SECURITY (Critical): Set search_path on public functions
-- 2. SECURITY (High): users_insert RLS policy with WITH CHECK (true)
-- 3. PERFORMANCE (High): 7 unindexed foreign keys causing table scans
-- 4. PERFORMANCE (Low): 5 unused indexes causing write overhead
--
-- APPROACH: Use ALTER FUNCTION to set search_path (safer than DROP/CREATE)
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: SET search_path ON EXISTING FUNCTIONS (Safe ALTER approach)
-- ============================================================================
-- Using ALTER FUNCTION preserves triggers and dependencies
-- ============================================================================

-- Alter existing functions to set search_path (won't fail if function doesn't exist)
DO $$
BEGIN
  -- Helper functions
  ALTER FUNCTION IF EXISTS public.user_workspaces() SET search_path = public, extensions;
  ALTER FUNCTION IF EXISTS public.user_workspace_ids() SET search_path = public, extensions;
  ALTER FUNCTION IF EXISTS public.get_workspace_id() SET search_path = public, extensions;
  ALTER FUNCTION IF EXISTS public.check_user_exists(TEXT) SET search_path = public, extensions;

  -- Onboarding functions
  ALTER FUNCTION IF EXISTS public.complete_onboarding_step(TEXT, JSONB) SET search_path = public, extensions;
  ALTER FUNCTION IF EXISTS public.get_user_workflow() SET search_path = public, extensions;

  -- Token functions
  ALTER FUNCTION IF EXISTS public.generate_job_access_token(TEXT, UUID, TEXT, INTEGER) SET search_path = public, extensions;
  ALTER FUNCTION IF EXISTS public.validate_job_access_token(TEXT) SET search_path = public, extensions;
  ALTER FUNCTION IF EXISTS public.validate_job_access_token_hash(TEXT) SET search_path = public, extensions;
  ALTER FUNCTION IF EXISTS public.get_request_job_token() SET search_path = public, extensions;
  ALTER FUNCTION IF EXISTS public.can_access_job_with_token(UUID, TEXT) SET search_path = public, extensions;

  -- Trigger functions (these have dependencies - never drop them)
  ALTER FUNCTION IF EXISTS public.update_updated_at_column() SET search_path = public, extensions;
  ALTER FUNCTION IF EXISTS public.photos_sync_workspace_id() SET search_path = public, extensions;
  ALTER FUNCTION IF EXISTS public.prevent_job_delete_after_seal() SET search_path = public, extensions;
  ALTER FUNCTION IF EXISTS public.prevent_job_update_after_seal() SET search_path = public, extensions;
  ALTER FUNCTION IF EXISTS public.prevent_job_mutation_after_seal() SET search_path = public, extensions;
  ALTER FUNCTION IF EXISTS public.prevent_child_mutation_after_job_seal() SET search_path = public, extensions;

  -- Proof system functions
  ALTER FUNCTION IF EXISTS public.generate_tech_access(TEXT, INTEGER) SET search_path = public, extensions;
  ALTER FUNCTION IF EXISTS public.validate_tech_token(TEXT, TEXT, TEXT) SET search_path = public, extensions;
  ALTER FUNCTION IF EXISTS public.submit_job_proof(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) SET search_path = public, extensions;
  ALTER FUNCTION IF EXISTS public.get_job_proof_status(TEXT) SET search_path = public, extensions;

  -- Sealing functions
  ALTER FUNCTION IF EXISTS public.get_job_seal_status(UUID) SET search_path = public, extensions;
  ALTER FUNCTION IF EXISTS public.get_evidence_bundle(UUID) SET search_path = public, extensions;
  ALTER FUNCTION IF EXISTS public.count_workspace_seals(UUID) SET search_path = public, extensions;
  ALTER FUNCTION IF EXISTS public.seal_job_evidence(TEXT, TEXT, TEXT, JSONB) SET search_path = public, extensions;

  -- Audit functions
  ALTER FUNCTION IF EXISTS public.log_audit_event(UUID, UUID, TEXT, TEXT, TEXT, JSONB) SET search_path = public, extensions;
  ALTER FUNCTION IF EXISTS public.get_audit_logs(UUID, INTEGER, INTEGER, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) SET search_path = public, extensions;

  -- Workspace functions
  ALTER FUNCTION IF EXISTS public.create_workspace_with_owner(UUID, TEXT, TEXT, TEXT, TEXT) SET search_path = public, extensions;
  ALTER FUNCTION IF EXISTS public.is_workspace_admin(UUID) SET search_path = public, extensions;

EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'Some functions do not exist, skipping...';
END $$;

-- ============================================================================
-- SECTION 2: CREATE NEW HELPER FUNCTIONS (if they don't exist)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_current_workspace_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
  SELECT workspace_id FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('owner', 'admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.get_technician_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
  SELECT id FROM public.technicians WHERE user_id = auth.uid()
$$;

-- ============================================================================
-- SECTION 3: FIX RLS POLICY - users_insert
-- ============================================================================

DROP POLICY IF EXISTS "users_insert" ON public.users;

-- Create secure user insert policy (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'users' AND schemaname = 'public') THEN
    DROP POLICY IF EXISTS "users_insert_secure" ON public.users;
    CREATE POLICY "users_insert_secure"
      ON public.users
      FOR INSERT
      TO authenticated
      WITH CHECK (id = (SELECT auth.uid()));
  END IF;
END $$;

-- ============================================================================
-- SECTION 4: CREATE MISSING INDEXES FOR FOREIGN KEYS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_evidence_seals_sealed_by_user
  ON public.evidence_seals(sealed_by_user_id);

CREATE INDEX IF NOT EXISTS idx_job_access_tokens_granted_by
  ON public.job_access_tokens(granted_by_user_id);

CREATE INDEX IF NOT EXISTS idx_jobs_client_id
  ON public.jobs(client_id);

CREATE INDEX IF NOT EXISTS idx_jobs_technician_id
  ON public.jobs(technician_id);

CREATE INDEX IF NOT EXISTS idx_safety_checks_job_id
  ON public.safety_checks(job_id);

CREATE INDEX IF NOT EXISTS idx_user_journey_progress_persona
  ON public.user_journey_progress(persona_id);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user
  ON public.user_subscriptions(user_id);

-- ============================================================================
-- SECTION 5: DROP UNUSED INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_workspaces_slug;
DROP INDEX IF EXISTS idx_users_workspace;
DROP INDEX IF EXISTS idx_users_role;
DROP INDEX IF EXISTS idx_tokens_job;
DROP INDEX IF EXISTS idx_tokens_token;

COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
