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
-- SECTION 1B: FIX ADDITIONAL FUNCTIONS MISSING search_path (from linter)
-- ============================================================================
-- Using DO blocks with exception handling for functions that may have
-- different signatures in the live database

-- update_updated_at_column() - trigger function, no parameters
DO $$ BEGIN
  ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- check_user_exists(text) - needs pg_temp added
DO $$ BEGIN
  ALTER FUNCTION public.check_user_exists(text) SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- get_workspace_id() - needs pg_temp added
DO $$ BEGIN
  ALTER FUNCTION public.get_workspace_id() SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- Trigger functions for sealed job protection (various possible signatures)
DO $$ BEGIN
  ALTER FUNCTION public.prevent_sealed_job_modification() SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  ALTER FUNCTION public.prevent_sealed_job_deletion() SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  ALTER FUNCTION public.prevent_job_update_after_seal() SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  ALTER FUNCTION public.prevent_job_delete_after_seal() SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  ALTER FUNCTION public.prevent_job_mutation_after_seal() SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  ALTER FUNCTION public.prevent_child_mutation_after_job_seal() SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- Token access functions (various possible signatures)
DO $$ BEGIN
  ALTER FUNCTION public.can_access_job_with_token(uuid, text) SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  ALTER FUNCTION public.generate_tech_token(text) SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  ALTER FUNCTION public.generate_tech_token(uuid) SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  ALTER FUNCTION public.generate_tech_pin(text) SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  ALTER FUNCTION public.generate_tech_pin(uuid) SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- Token validation and invalidation functions
DO $$ BEGIN
  ALTER FUNCTION public.validate_job_access_token(text) SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  ALTER FUNCTION public.validate_job_access_token_hash(text) SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  ALTER FUNCTION public.get_request_job_token() SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  ALTER FUNCTION public.invalidate_tokens_on_seal() SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- Seal-related helper functions
DO $$ BEGIN
  ALTER FUNCTION public.get_job_seal_status(uuid) SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  ALTER FUNCTION public.get_evidence_bundle(uuid) SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  ALTER FUNCTION public.count_workspace_seals(uuid) SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- User/workspace helper functions
DO $$ BEGIN
  ALTER FUNCTION public.user_workspace_ids() SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  ALTER FUNCTION public.create_default_subscription() SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

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
