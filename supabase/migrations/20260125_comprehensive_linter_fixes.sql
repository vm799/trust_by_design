-- ============================================================================
-- MIGRATION: Comprehensive Linter Fixes
-- Date: 2026-01-25
-- ============================================================================
-- Fixes based on actual database query results:
-- 1. Functions missing search_path (with exact signatures)
-- 2. Functions missing pg_temp in search_path
-- 3. RLS policies using auth.uid() instead of (SELECT auth.uid())
-- 4. Duplicate permissive policies consolidation
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: FIX FUNCTIONS MISSING search_path (exact signatures from DB)
-- ============================================================================

-- These two functions exist in DB but were NEVER in migrations!
-- Adding search_path to make them secure

ALTER FUNCTION public.generate_tech_token()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.generate_tech_pin()
  SET search_path = public, pg_temp;

-- This overload of get_workspace_id exists and is missing search_path
ALTER FUNCTION public.get_workspace_id(p_user_id uuid)
  SET search_path = public, pg_temp;

-- ============================================================================
-- SECTION 2: FIX FUNCTIONS WITH search_path=public (missing pg_temp)
-- ============================================================================

ALTER FUNCTION public.complete_onboarding_step(p_step_key text, p_step_data jsonb)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.complete_persona_onboarding(p_persona_type persona_type)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.is_workspace_admin(p_workspace_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.submit_job_proof(
  p_job_id text,
  p_raw_token text,
  p_before_photo text,
  p_after_photo text,
  p_notes_before text,
  p_notes_after text,
  p_client_signature text,
  p_client_name text,
  p_proof_metadata jsonb
) SET search_path = public, pg_temp;

ALTER FUNCTION public.validate_tech_token(p_job_id text, p_raw_token text, p_raw_pin text)
  SET search_path = public, pg_temp;

-- ============================================================================
-- SECTION 3: FIX RLS POLICIES - auth.uid() → (SELECT auth.uid())
-- ============================================================================
-- These policies use auth.uid() without SELECT wrapper, causing per-row evaluation

-- jobs."Manager full access to workspace jobs"
DROP POLICY IF EXISTS "Manager full access to workspace jobs" ON public.jobs;
CREATE POLICY "Manager full access to workspace jobs" ON public.jobs
  FOR ALL
  USING (
    workspace_id IN (
      SELECT users.workspace_id FROM users
      WHERE users.id = (SELECT auth.uid())
      AND users.role IN ('owner', 'admin', 'member')
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT users.workspace_id FROM users
      WHERE users.id = (SELECT auth.uid())
      AND users.role IN ('owner', 'admin', 'member')
    )
  );

-- jobs."Tech reads assigned jobs"
DROP POLICY IF EXISTS "Tech reads assigned jobs" ON public.jobs;
CREATE POLICY "Tech reads assigned jobs" ON public.jobs
  FOR SELECT
  USING (assigned_technician_id = (SELECT auth.uid()));

-- user_personas."Users can read own personas"
DROP POLICY IF EXISTS "Users can read own personas" ON public.user_personas;
CREATE POLICY "Users can read own personas" ON public.user_personas
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- user_subscriptions."Users can view own subscription" - fix auth.uid() = user_id
DROP POLICY IF EXISTS "Users can view own subscription" ON public.user_subscriptions;
-- Keep "Users view own subscription" which already uses (SELECT auth.uid())

-- users - fix policies using bare auth.uid()
DROP POLICY IF EXISTS "Users can always read own profile" ON public.users;
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "users_update" ON public.users;
DROP POLICY IF EXISTS "users_read_policy" ON public.users;

-- workspaces."Users can read own workspace"
DROP POLICY IF EXISTS "Users can read own workspace" ON public.workspaces;
-- Keep "Users can view own workspace" which already uses (SELECT auth.uid())

-- ============================================================================
-- SECTION 4: CONSOLIDATE DUPLICATE POLICIES
-- ============================================================================
-- Keep ONE well-named policy per table/action, drop duplicates

-- === USERS TABLE (6 SELECT → 1) ===
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "users_select_self_or_workspace" ON public.users;
-- Keep "Users can view workspace members" (covers self + workspace)

-- users UPDATE (3 → 1)
DROP POLICY IF EXISTS "users_update_self" ON public.users;
-- Keep "Users can update own profile"

-- === WORKSPACES TABLE ===
-- SELECT (5 → 1)
DROP POLICY IF EXISTS "workspace_member_read" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_select" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_select_workspace_members" ON public.workspaces;
-- Keep "Users can view own workspace"

-- UPDATE (3 → 1)
DROP POLICY IF EXISTS "workspaces_update" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_update_owner_only" ON public.workspaces;
-- Keep "Owners can update own workspace"

-- === JOBS TABLE ===
-- SELECT (5 → 3: workspace users, tech assigned, token holders)
DROP POLICY IF EXISTS "jobs_select_workspace" ON public.jobs;
DROP POLICY IF EXISTS "jobs_workspace_select" ON public.jobs;
-- Keep: "Users can view workspace jobs", "Tech reads assigned jobs", "Token holders can view assigned job"

-- UPDATE (4 → 2: workspace users, token holders)
DROP POLICY IF EXISTS "jobs_workspace_update" ON public.jobs;
DROP POLICY IF EXISTS "jobs_update_workspace" ON public.jobs;
-- Keep: "Users can update workspace jobs", "Token holders can update assigned job"

-- INSERT (2 → 1)
DROP POLICY IF EXISTS "jobs_insert_workspace_check" ON public.jobs;
-- Keep: "Users can create jobs in own workspace"

-- DELETE (2 → 1)
DROP POLICY IF EXISTS "jobs_delete_workspace" ON public.jobs;
DROP POLICY IF EXISTS "jobs_workspace_delete" ON public.jobs;
-- Will be handled by "Manager full access to workspace jobs" FOR ALL

-- ALL (2 → 1)
DROP POLICY IF EXISTS "jobs_access_policy" ON public.jobs;
-- Keep: "Manager full access to workspace jobs"

-- === PHOTOS TABLE ===
-- SELECT (4 → 2)
DROP POLICY IF EXISTS "photos_select_workspace_or_owner" ON public.photos;
DROP POLICY IF EXISTS "photos_workspace_select" ON public.photos;
-- Keep: "Users can view photos for accessible jobs", "Token holders can view photos for assigned job"

-- INSERT (3 → 2)
DROP POLICY IF EXISTS "photos_insert_workspace_check" ON public.photos;
-- Keep: "Users can insert photos for accessible jobs", "Token holders can insert photos for assigned job"

-- DELETE (2 → 1)
DROP POLICY IF EXISTS "photos_delete" ON public.photos;
-- Keep: "photos_delete_workspace_or_owner"

-- UPDATE (2 → 1)
DROP POLICY IF EXISTS "photos_update" ON public.photos;
-- Keep: "photos_update_workspace_or_owner"

-- === CLIENTS TABLE ===
-- SELECT (3 → 1)
DROP POLICY IF EXISTS "clients_select_workspace" ON public.clients;
DROP POLICY IF EXISTS "clients_workspace_select" ON public.clients;
-- Keep: "Users can view workspace clients"

-- UPDATE (2 → 1)
DROP POLICY IF EXISTS "clients_update_workspace" ON public.clients;
DROP POLICY IF EXISTS "clients_workspace_update" ON public.clients;
-- Handled by "Users can manage workspace clients" FOR ALL

-- DELETE (2 → 1)
DROP POLICY IF EXISTS "clients_delete_workspace" ON public.clients;
DROP POLICY IF EXISTS "clients_workspace_delete" ON public.clients;
-- Handled by "Users can manage workspace clients" FOR ALL

-- === TECHNICIANS TABLE ===
-- SELECT (2 → 1)
DROP POLICY IF EXISTS "technicians_select_workspace" ON public.technicians;
-- Keep: "Users can view technicians in their workspace"

-- INSERT (2 → 1)
DROP POLICY IF EXISTS "technicians_insert_workspace_check" ON public.technicians;
-- Keep: "Users can create technicians in their workspace"

-- UPDATE (2 → 1)
DROP POLICY IF EXISTS "technicians_update_workspace" ON public.technicians;
-- Keep: "Users can update technicians in their workspace"

-- === EVIDENCE_SEALS TABLE ===
-- SELECT (4 → 1)
DROP POLICY IF EXISTS "evidence_seals_workspace_select" ON public.evidence_seals;
DROP POLICY IF EXISTS "evidence_seals_select_workspace" ON public.evidence_seals;
DROP POLICY IF EXISTS "seals_read_policy" ON public.evidence_seals;
-- Keep: "Users can view workspace evidence seals"

-- === AUDIT_LOGS TABLE ===
-- SELECT (3 → 1)
DROP POLICY IF EXISTS "audit_read_policy" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_workspace_select" ON public.audit_logs;
-- Keep: "Users can view workspace audit logs"

-- === JOB_ACCESS_TOKENS TABLE ===
-- SELECT (3 → 2: workspace users + anon validation)
DROP POLICY IF EXISTS "job_access_tokens_workspace_select" ON public.job_access_tokens;
-- Keep: "Users can view workspace job tokens", "Anonymous users can validate tokens"

-- === SAFETY_CHECKS TABLE ===
-- SELECT (3 → 2)
DROP POLICY IF EXISTS "safety_checks_workspace_select" ON public.safety_checks;
-- Keep: "Users can view safety checks for accessible jobs", "Token holders can view safety checks for assigned job"

-- === USER_PERSONAS TABLE ===
-- SELECT (3 → 1) - consolidate to one
DROP POLICY IF EXISTS "user_personas_select_workspace_or_self" ON public.user_personas;
DROP POLICY IF EXISTS "Users can view own personas" ON public.user_personas;
-- Keep: "Users can read own personas" (recreated above with SELECT wrapper)

-- INSERT (2 → 1)
DROP POLICY IF EXISTS "user_personas_insert_workspace_check" ON public.user_personas;
-- Keep: "Users can create own personas"

-- UPDATE (2 → 1)
DROP POLICY IF EXISTS "user_personas_update_workspace_or_self" ON public.user_personas;
-- Keep: "Users can update own personas"

-- === USER_SUBSCRIPTIONS TABLE ===
-- ALL policy issue - "Users can view own subscription" shouldn't be FOR ALL
-- Drop the FOR ALL version, keep the FOR SELECT version
-- Note: Already dropped "Users can view own subscription" above

-- ============================================================================
-- SECTION 5: ADD MISSING FUNCTIONS TO VERSION CONTROL
-- ============================================================================
-- These functions existed in DB but not in migrations. Now they're documented.

-- generate_tech_token() - generates 6-char alphanumeric token
-- Already exists, just added search_path above. Definition for reference:
/*
CREATE OR REPLACE FUNCTION public.generate_tech_token()
RETURNS text
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;
*/

-- generate_tech_pin() - generates 6-digit PIN
-- Already exists, just added search_path above. Definition for reference:
/*
CREATE OR REPLACE FUNCTION public.generate_tech_pin()
RETURNS text
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN lpad(floor(random() * 1000000)::text, 6, '0');
END;
$$;
*/

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================================
/*
-- Check all SECURITY DEFINER functions have proper search_path:
SELECT proname,
  CASE WHEN 'search_path=public, pg_temp' = ANY(proconfig) THEN '✅' ELSE '❌' END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.prosecdef = true
ORDER BY status, proname;

-- Check duplicate policies are gone:
SELECT tablename, cmd, count(*)
FROM pg_policies
WHERE schemaname = 'public' AND permissive = 'PERMISSIVE'
GROUP BY tablename, cmd
HAVING count(*) > 2
ORDER BY count(*) DESC;

-- Check for policies still using bare auth.uid():
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
AND qual::text LIKE '%auth.uid()%'
AND qual::text NOT LIKE '%(select auth.uid())%'
AND qual::text NOT LIKE '%(SELECT auth.uid())%';
*/
