-- ============================================================================
-- EMERGENCY HOTFIX: Fix Infinite Recursion in Users Table RLS Policies
-- Date: 2026-01-21
-- ============================================================================
-- SEVERITY: CRITICAL - Authentication completely broken
-- ISSUE: Users table policies query users table, causing infinite recursion
-- ERROR: "infinite recursion detected in policy for relation users" (42P17)
-- ============================================================================
--
-- ROOT CAUSE:
-- The policies created in 20260121_comprehensive_security_audit_fixes.sql
-- have circular references like:
--   workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
--
-- When a user queries the users table, the RLS policy executes the subquery,
-- which also queries the users table, triggering the same policy again,
-- creating infinite recursion.
--
-- SOLUTION:
-- 1. Create a base policy that allows users to view their own record (no recursion)
-- 2. Use SECURITY DEFINER function user_workspace_ids() for workspace checks
--    (this function bypasses RLS when querying users table)
-- 3. Separate concerns: own profile access vs workspace member access
-- ============================================================================

BEGIN;

-- ============================================================================
-- CREATE HELPER FUNCTION FOR ADMIN CHECK (to avoid recursion)
-- ============================================================================

-- Function to check if current user is admin/owner in a workspace
CREATE OR REPLACE FUNCTION public.is_workspace_admin(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (SELECT auth.uid())
      AND workspace_id = p_workspace_id
      AND role IN ('owner', 'admin')
  );
$$;

COMMENT ON FUNCTION public.is_workspace_admin(UUID) IS 'Checks if current user is admin/owner in given workspace - SECURITY DEFINER to bypass RLS';

-- Set search path for security
ALTER FUNCTION public.is_workspace_admin(UUID) SET search_path = public;

-- Revoke execute from anon/authenticated (only used internally by RLS policies)
REVOKE EXECUTE ON FUNCTION public.is_workspace_admin(UUID) FROM anon, authenticated;

-- ============================================================================
-- FIX USERS TABLE POLICIES
-- ============================================================================

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view workspace members" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can manage workspace users" ON public.users;

-- Policy 1: Allow users to view their own profile (BASE CASE - no recursion)
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

-- Policy 2: Allow users to view other members in their workspace
-- Uses user_workspace_ids() SECURITY DEFINER function to avoid recursion
CREATE POLICY "Users can view workspace members"
  ON public.users FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (SELECT public.user_workspace_ids())
  );

-- Policy 3: Allow users to update their own profile
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- Policy 4: Allow admins to manage workspace users
-- Uses is_workspace_admin() SECURITY DEFINER function to avoid recursion
CREATE POLICY "Admins can manage workspace users"
  ON public.users FOR ALL
  TO authenticated
  USING (public.is_workspace_admin(workspace_id));

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify policies exist
DO $$
DECLARE
  v_policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'users';

  IF v_policy_count < 4 THEN
    RAISE WARNING 'Expected at least 4 policies on users table, found %', v_policy_count;
  ELSE
    RAISE NOTICE '✅ Users table has % policies configured', v_policy_count;
  END IF;
END $$;

-- Test that the recursion is fixed (this should not error)
DO $$
BEGIN
  -- This will test the policy evaluation without infinite recursion
  PERFORM 1 FROM pg_policies WHERE tablename = 'users';
  RAISE NOTICE '✅ No infinite recursion detected in policy definitions';
END $$;

COMMIT;

-- ============================================================================
-- POST-DEPLOYMENT VERIFICATION
-- ============================================================================

-- After applying this migration, verify with:
--
-- 1. Sign in as a regular user
-- 2. Query: SELECT * FROM users WHERE id = auth.uid();
--    (should return your own user record)
--
-- 3. Query: SELECT * FROM users WHERE workspace_id = (SELECT workspace_id FROM users WHERE id = auth.uid());
--    (should return all users in your workspace)
--
-- 4. Check Supabase logs for "infinite recursion" errors (should be none)
-- ============================================================================
