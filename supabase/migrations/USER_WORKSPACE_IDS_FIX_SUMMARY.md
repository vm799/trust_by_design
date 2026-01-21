# user_workspace_ids() Function Dependency Fix

**Date:** 2026-01-21
**Severity:** HIGH
**Status:** FIXED ✅

## Problem Description

When running the security audit migration `20260121_comprehensive_security_audit_fixes.sql`, the following error occurred:

```
ERROR: 2BP01: cannot drop function user_workspace_ids() because other objects depend on it
```

### Root Cause

The migration attempted to drop and recreate the `user_workspace_ids()` function using:

```sql
DROP FUNCTION IF EXISTS public.user_workspace_ids();
CREATE OR REPLACE FUNCTION public.user_workspace_ids() ...
```

However, this function has multiple dependencies from Row Level Security (RLS) policies defined in earlier migrations, specifically:

1. **technicians table** policies (from `005_site_supervisor_persona.sql`):
   - "Users can view technicians in their workspace"
   - "Users can create technicians in their workspace"
   - "Users can update technicians in their workspace"
   - "Users can delete technicians in their workspace"

2. **user_personas table** policies (from `006_persona_onboarding_foundation.sql`)

When attempting to drop a function with dependent objects, PostgreSQL requires either:
- Using `DROP FUNCTION ... CASCADE` (dangerous - drops all dependent policies)
- Or avoiding the drop entirely

## Solution Applied

**Removed the `DROP FUNCTION IF EXISTS` statement** and relied solely on `CREATE OR REPLACE FUNCTION`, which updates the function definition in place without breaking dependencies.

### Changes Made

**File:** `supabase/migrations/20260121_comprehensive_security_audit_fixes.sql`

**Before (Line 47-50):**
```sql
-- Function: Get current user's workspace IDs (for multiple workspace support)
-- Already exists, but let's optimize it
DROP FUNCTION IF EXISTS public.user_workspace_ids();
CREATE OR REPLACE FUNCTION public.user_workspace_ids()
```

**After (Line 47-49):**
```sql
-- Function: Get current user's workspace IDs (for multiple workspace support)
-- Update in place to avoid breaking dependent RLS policies
CREATE OR REPLACE FUNCTION public.user_workspace_ids()
```

## Impact Analysis

### Benefits
✅ **No Breaking Changes** - All existing RLS policies remain functional
✅ **Safe Migration** - Function is updated in place without dependency issues
✅ **Performance Optimizations Preserved** - All security and performance improvements are retained

### What Remains Unchanged
- Function signature: `RETURNS SETOF UUID`
- Function properties: `SECURITY DEFINER`, `STABLE`
- Function logic: Returns workspace IDs for authenticated users
- All dependent RLS policies continue to work without modification

## Testing & Verification

### 1. Run the Verification Script

Execute the verification script to ensure the fix is properly applied:

```bash
psql $DATABASE_URL -f supabase/migrations/VERIFY_USER_WORKSPACE_IDS_FIX.sql
```

The script checks:
- ✅ Function exists with correct properties (SECURITY DEFINER, STABLE)
- ✅ All dependent RLS policies exist
- ✅ RLS is enabled on all key tables
- ✅ Helper functions are properly configured
- ✅ Performance indexes are created

### 2. Apply the Migration

Apply the updated migration to your Supabase instance:

```bash
# Using Supabase CLI
supabase db push

# Or directly via psql
psql $DATABASE_URL -f supabase/migrations/20260121_comprehensive_security_audit_fixes.sql
```

### 3. Functional Testing

Test key workflows to ensure RLS policies work correctly:

```sql
-- Test 1: Verify user can access own workspace
SELECT public.user_workspace_ids();

-- Test 2: Verify technicians policies work
SELECT * FROM public.technicians LIMIT 1;

-- Test 3: Verify jobs policies work
SELECT * FROM public.jobs LIMIT 1;

-- Test 4: Verify audit logs access (admin only)
SELECT * FROM public.audit_logs LIMIT 1;
```

## Deployment Instructions

### For Vercel/Supabase Production

1. **Backup Current State**
   ```bash
   # Create a backup of your database before applying
   supabase db dump -f backup_$(date +%Y%m%d).sql
   ```

2. **Apply Migration via Supabase Dashboard**
   - Go to Supabase Dashboard → SQL Editor
   - Copy the entire contents of `20260121_comprehensive_security_audit_fixes.sql`
   - Execute the migration
   - Verify no errors in the output

3. **Run Verification Script**
   - In the same SQL Editor, run `VERIFY_USER_WORKSPACE_IDS_FIX.sql`
   - Ensure all tests pass with ✅ markers

4. **Monitor Application**
   - Check Vercel logs for any RLS-related errors
   - Test critical user workflows (job creation, photo uploads, etc.)
   - Monitor Supabase dashboard for query performance

### Alternative: Git-based Deployment

If using Supabase GitHub integration:

```bash
# Commit the fixed migration
git add supabase/migrations/20260121_comprehensive_security_audit_fixes.sql
git commit -m "fix: Remove DROP FUNCTION to prevent dependency error"
git push origin claude/jobproof-audit-spec-PEdmd

# Supabase will auto-apply migrations from the branch
```

## Rollback Plan

If issues arise after deployment:

```sql
BEGIN;

-- Rollback is not needed for this fix since we're not breaking anything
-- The function update is backwards compatible
-- However, if you need to rollback the entire migration:

-- 1. Restore from backup
-- psql $DATABASE_URL < backup_YYYYMMDD.sql

-- 2. Or manually revert policies (see rollback section in migration file)

COMMIT;
```

## Additional Notes

### Why CREATE OR REPLACE is Better

1. **Atomic Update**: Function definition is updated atomically
2. **No Dependency Breaking**: Dependent objects remain intact
3. **Zero Downtime**: No intermediate state where function doesn't exist
4. **PostgreSQL Best Practice**: Recommended approach for function updates

### Other Files Checked

- ✅ `20260119_security_hardening.sql` - No issues
- ✅ `20260119_fix_rls_security_issues.sql` - No issues
- ✅ `005_site_supervisor_persona.sql` - Contains dependent policies (expected)
- ✅ `006_persona_onboarding_foundation.sql` - Rollback section only (safe)

## Related Security Improvements

This migration (after the fix) provides:

1. **Normalized auth.uid() Usage** - Consistent `(SELECT auth.uid())` wrapper
2. **Performance Indexes** - 15+ indexes for RLS predicate optimization
3. **Helper Functions** - Centralized SECURITY DEFINER functions
4. **Token Hashing** - SHA-256 hashing for job access tokens
5. **Search Path Protection** - All functions have `search_path = public`

## Success Criteria

Migration is successful when:

- ✅ No errors during SQL execution
- ✅ All verification checks pass
- ✅ Application functions normally
- ✅ No RLS policy violations in logs
- ✅ Query performance is maintained or improved

## Contact & Support

- **Migration File**: `supabase/migrations/20260121_comprehensive_security_audit_fixes.sql`
- **Verification Script**: `supabase/migrations/VERIFY_USER_WORKSPACE_IDS_FIX.sql`
- **This Summary**: `supabase/migrations/USER_WORKSPACE_IDS_FIX_SUMMARY.md`

For issues or questions, refer to the Supabase documentation or check the migration rollback section.
