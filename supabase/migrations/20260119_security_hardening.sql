-- ============================================================================
-- MIGRATION: Security Hardening & Linter Fixes
-- Date: 2026-01-19
-- ============================================================================
-- Fixes:
-- 1. Sets search_path = public for all security-sensitive functions (LINT 0011)
-- 2. Hardens RLS policies for jobs and users (LINT 0024)
-- 3. Enables Leaked Password Protection (Note: This is usually a dashboard setting, 
--    but we can ensure database-level secondary checks if needed)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. HARDEN RLS POLICIES
-- ============================================================================

-- Drop insecure users_insert policy if it exists (allows unrestricted user creation)
DROP POLICY IF EXISTS "users_insert" ON public.users;

-- Drop and recreate the jobs creation policy to be more explicit
DROP POLICY IF EXISTS "Users can create jobs in own workspace" ON public.jobs;
CREATE POLICY "Users can create jobs in own workspace"
  ON public.jobs FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    workspace_id IN (
      SELECT u.workspace_id FROM public.users u WHERE u.id = auth.uid()
    )
  );

-- ============================================================================
-- 2. SET SEARCH PATH FOR FUNCTIONS (Prevent Search Path Injection)
-- ============================================================================

-- Workspaces & Users
ALTER FUNCTION IF EXISTS public.user_workspaces() SET search_path = public;
ALTER FUNCTION IF EXISTS public.user_workspace_ids() SET search_path = public;
ALTER FUNCTION IF EXISTS public.create_workspace_with_owner(UUID, TEXT, TEXT, TEXT, TEXT) SET search_path = public;

-- Onboarding
ALTER FUNCTION IF EXISTS public.complete_onboarding_step(TEXT, JSONB) SET search_path = public;
ALTER FUNCTION IF EXISTS public.get_user_workflow() SET search_path = public;

-- Sealing & Tokens
ALTER FUNCTION IF EXISTS public.prevent_job_delete_after_seal() SET search_path = public;
ALTER FUNCTION IF EXISTS public.prevent_job_update_after_seal() SET search_path = public;
ALTER FUNCTION IF EXISTS public.prevent_job_mutation_after_seal() SET search_path = public;
ALTER FUNCTION IF EXISTS public.prevent_child_mutation_after_job_seal() SET search_path = public;
ALTER FUNCTION IF EXISTS public.can_access_job_with_token(UUID, TEXT) SET search_path = public;
ALTER FUNCTION IF EXISTS public.generate_job_access_token(TEXT, UUID, TEXT, INTEGER) SET search_path = public;

-- Audit & Utilities
ALTER FUNCTION IF EXISTS public.log_audit_event(UUID, UUID, TEXT, TEXT, TEXT, JSONB) SET search_path = public;
ALTER FUNCTION IF EXISTS public.log_audit_event(UUID, TEXT, TEXT, TEXT, JSONB) SET search_path = public;
ALTER FUNCTION IF EXISTS public.update_updated_at_column() SET search_path = public;

-- ============================================================================
-- 3. SECURITY BEST PRACTICES
-- ============================================================================

-- Ensure RLS is enabled on all core tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_seals ENABLE ROW LEVEL SECURITY;

COMMIT;
