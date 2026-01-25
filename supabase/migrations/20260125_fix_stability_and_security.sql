-- ============================================================================
-- MIGRATION: Fix Stability and Security Issues
-- Date: 2026-01-25
-- ============================================================================
-- Based on actual database schema query results
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: FIX 9 FUNCTIONS MISSING search_path
-- ============================================================================

ALTER FUNCTION public.complete_onboarding_step(uuid, uuid, text, jsonb)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.create_tech_access_link(text)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.generate_job_access_token(text, uuid, text, integer)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.get_technician_id()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.get_user_workflow()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.is_manager()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.photos_sync_workspace_id()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.user_workspaces()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.validate_tech_access(text, text, text)
  SET search_path = public, pg_temp;

-- ============================================================================
-- SECTION 2: FIX INSECURE users_insert POLICY
-- ============================================================================
-- Current: WITH CHECK (true) for public role - allows anyone to insert users!

DROP POLICY IF EXISTS "users_insert" ON public.users;

-- ============================================================================
-- SECTION 3: CREATE INDEXES FOR UNINDEXED FOREIGN KEYS
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
-- SECTION 4: DROP UNUSED INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_workspaces_slug;
DROP INDEX IF EXISTS idx_users_workspace;
DROP INDEX IF EXISTS idx_users_role;
DROP INDEX IF EXISTS idx_tokens_job;
DROP INDEX IF EXISTS idx_tokens_token;

COMMIT;
