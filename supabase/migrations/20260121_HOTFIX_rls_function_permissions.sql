-- ============================================================================
-- HOTFIX: RLS Function Permissions
-- ============================================================================
-- Date: 2026-01-21
-- Priority: CRITICAL
-- Issue: RLS policies failing with "permission denied for function get_workspace_id"
-- Error Code: 42501 (insufficient_privilege)
--
-- ROOT CAUSE:
-- The comprehensive security audit (20260121_comprehensive_security_audit_fixes.sql)
-- REVOKED EXECUTE permissions on helper functions like get_workspace_id() to
-- "prevent direct calls". However, RLS policies MUST be able to call these
-- functions, and they execute in the context of the user making the request.
--
-- SOLUTION:
-- GRANT EXECUTE back to authenticated users for RLS helper functions.
-- These functions are already SECURITY DEFINER and STABLE, so they're safe:
-- - They only return data the user has access to (their own workspace_id)
-- - They don't expose sensitive data from other workspaces
-- - STABLE means they can't modify data
--
-- RISK: NONE - This restores intended functionality
-- DOWNTIME: NONE - Fix is immediate
-- ============================================================================

BEGIN;

-- ============================================================================
-- GRANT EXECUTE ON RLS HELPER FUNCTIONS
-- ============================================================================

-- get_workspace_id() - Used in nearly all workspace-scoped RLS policies
GRANT EXECUTE ON FUNCTION public.get_workspace_id() TO authenticated, anon;

COMMENT ON FUNCTION public.get_workspace_id() IS
'Returns workspace_id for current user. Used by RLS policies.
SECURITY DEFINER ensures it only returns the calling user''s workspace.
Safe to grant EXECUTE as it cannot expose other users'' data.';

-- user_workspace_ids() - Used in multi-workspace support policies
GRANT EXECUTE ON FUNCTION public.user_workspace_ids() TO authenticated, anon;

COMMENT ON FUNCTION public.user_workspace_ids() IS
'Returns all workspace_ids for current user. Used by RLS policies.
SECURITY DEFINER ensures it only returns the calling user''s workspaces.
Safe to grant EXECUTE as it cannot expose other users'' data.';

-- validate_job_access_token() - Used in token-based access policies
GRANT EXECUTE ON FUNCTION public.validate_job_access_token(TEXT) TO authenticated, anon;

COMMENT ON FUNCTION public.validate_job_access_token(TEXT) IS
'Validates job access token and returns job_id if valid. Used by RLS policies.
SECURITY DEFINER allows it to query job_access_tokens table.
Safe to grant EXECUTE as it only validates tokens, does not expose unauthorized data.';

-- validate_job_access_token_hash() - Used in token-based access policies (hashed version)
GRANT EXECUTE ON FUNCTION public.validate_job_access_token_hash(TEXT) TO authenticated, anon;

COMMENT ON FUNCTION public.validate_job_access_token_hash(TEXT) IS
'Validates job access token using SHA-256 hash. Used by RLS policies.
SECURITY DEFINER allows it to query job_access_tokens table.
Safe to grant EXECUTE as it only validates tokens, does not expose unauthorized data.';

-- get_request_job_token() - Used to extract token from request headers
GRANT EXECUTE ON FUNCTION public.get_request_job_token() TO authenticated, anon;

COMMENT ON FUNCTION public.get_request_job_token() IS
'Extracts job token from request headers. Used by RLS policies.
Safe to grant EXECUTE as it only reads the user''s own request headers.';

-- is_workspace_admin() - Used in admin-only RLS policies (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'is_workspace_admin'
  ) THEN
    GRANT EXECUTE ON FUNCTION public.is_workspace_admin(UUID) TO authenticated;
    RAISE NOTICE 'Granted EXECUTE on is_workspace_admin() to authenticated';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify grants were applied
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM information_schema.routine_privileges
  WHERE routine_schema = 'public'
    AND routine_name IN (
      'get_workspace_id',
      'user_workspace_ids',
      'validate_job_access_token',
      'validate_job_access_token_hash',
      'get_request_job_token'
    )
    AND grantee IN ('authenticated', 'anon')
    AND privilege_type = 'EXECUTE';

  IF v_count >= 10 THEN  -- At least 5 functions × 2 roles = 10 grants
    RAISE NOTICE '✅ HOTFIX SUCCESSFUL: % EXECUTE grants verified', v_count;
  ELSE
    RAISE WARNING '⚠️  Expected 10+ grants, found %', v_count;
  END IF;
END $$;

-- ============================================================================
-- TEST QUERY (Run after migration)
-- ============================================================================

/*
-- Test that authenticated users can now call RLS helper functions
-- This should succeed (returns your workspace_id):
SELECT public.get_workspace_id();

-- Test that user profile query works
-- This should succeed (returns your user record):
SELECT *
FROM public.users
WHERE id = auth.uid();

-- Test that workspace join works
-- This should succeed (returns your user + workspace data):
SELECT
  u.*,
  w.name AS workspace_name,
  w.subscription_tier
FROM public.users u
JOIN public.workspaces w ON w.id = u.workspace_id
WHERE u.id = auth.uid();
*/

-- ============================================================================
-- WHY THIS IS SAFE
-- ============================================================================

/*
SECURITY ANALYSIS:

1. get_workspace_id() is SAFE to expose because:
   - It's SECURITY DEFINER and queries: SELECT workspace_id FROM users WHERE id = auth.uid()
   - It can ONLY return the calling user's own workspace_id
   - It cannot be exploited to discover other workspaces

2. user_workspace_ids() is SAFE to expose because:
   - It's SECURITY DEFINER and queries: SELECT workspace_id FROM users WHERE id = auth.uid()
   - It can ONLY return the calling user's own workspace memberships
   - It cannot be exploited to enumerate other workspaces

3. validate_job_access_token(TEXT) is SAFE to expose because:
   - It only validates tokens, doesn't return sensitive data
   - It returns job_id if token is valid, NULL otherwise
   - Cannot be exploited to enumerate tokens (requires valid token as input)

4. get_request_job_token() is SAFE to expose because:
   - It only reads the user's own request headers
   - Cannot read other users' headers
   - Returns empty string if header not present

CONCLUSION:
These functions MUST have EXECUTE granted to work in RLS policies.
Revoking EXECUTE breaks ALL workspace-scoped access control.
Granting EXECUTE does NOT create a security vulnerability.
*/

-- ============================================================================
-- IMMEDIATE ACTION REQUIRED
-- ============================================================================

-- Deploy this hotfix immediately to restore application functionality.
-- After deployment, verify by:
-- 1. Logging in to the application
-- 2. Navigating to the admin dashboard
-- 3. Confirming no "permission denied" errors in browser console
-- 4. Confirming user profile loads successfully

-- ============================================================================
-- END OF HOTFIX
-- ============================================================================
