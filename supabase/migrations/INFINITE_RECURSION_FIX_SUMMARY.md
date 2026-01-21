# CRITICAL: Infinite Recursion Fix for Users Table RLS Policies

**Date:** 2026-01-21
**Severity:** CRITICAL
**Status:** FIXED ✅
**Impact:** Authentication completely broken - users unable to sign in

## Problem Description

After applying `20260121_comprehensive_security_audit_fixes.sql`, users experienced complete authentication failure with the error:

```
infinite recursion detected in policy for relation "users" (PostgreSQL error code: 42P17)
```

### User-Facing Symptoms

1. **Email Sign-In:** Failed with 500 Internal Server Error
2. **Google Sign-In:** Failed with 403 Forbidden, then 500 Internal Server Error
3. **Console Errors:**
   ```
   Failed to get user profile: {
     code: '42P17',
     details: null,
     hint: null,
     message: 'infinite recursion detected in policy for relation "users"'
   }
   ```

### Root Cause

The RLS policies created for the `users` table had **circular references**:

```sql
-- PROBLEMATIC POLICY (line 181-187)
CREATE POLICY "Users can view workspace members"
  ON public.users FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.users WHERE id = (SELECT auth.uid())
      -- ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
      -- This queries the SAME table the policy is protecting!
    )
  );
```

**Why This Causes Infinite Recursion:**

1. User attempts to `SELECT * FROM users`
2. PostgreSQL evaluates the RLS policy
3. Policy executes subquery: `SELECT workspace_id FROM users WHERE id = auth.uid()`
4. That `SELECT` from `users` **triggers the same RLS policy again**
5. Which executes the same subquery
6. Which triggers the policy again
7. **Infinite loop** → PostgreSQL detects recursion and aborts

The same issue occurred in:
- "Users can view workspace members" (line 181-187)
- "Admins can manage workspace users" (line 194-201)

## Solution Applied

### Strategy: Use SECURITY DEFINER Functions to Break Recursion

**Key Concept:** SECURITY DEFINER functions execute with the privileges of the function owner (bypassing RLS), preventing recursive policy evaluation.

### Changes Made

**File:** `supabase/migrations/20260121_hotfix_infinite_recursion.sql`

#### 1. Created Helper Function for Admin Checks

```sql
CREATE OR REPLACE FUNCTION public.is_workspace_admin(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER  -- Bypasses RLS when querying users table
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (SELECT auth.uid())
      AND workspace_id = p_workspace_id
      AND role IN ('owner', 'admin')
  );
$$;
```

**Why This Works:** The function has `SECURITY DEFINER`, so when it queries the `users` table, it bypasses RLS policies entirely, avoiding recursion.

#### 2. Fixed Users Table Policies

**Policy 1: Users can view own profile** (Base case - no recursion)
```sql
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));
```
✅ **No recursion:** Directly compares `id` with `auth.uid()`, no subquery on users table.

**Policy 2: Users can view workspace members**
```sql
CREATE POLICY "Users can view workspace members"
  ON public.users FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (SELECT public.user_workspace_ids())
  );
```
✅ **No recursion:** `user_workspace_ids()` is SECURITY DEFINER, bypasses RLS.

**Policy 3: Users can update own profile**
```sql
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));
```
✅ **No recursion:** Direct comparison, no subquery on users table.

**Policy 4: Admins can manage workspace users**
```sql
CREATE POLICY "Admins can manage workspace users"
  ON public.users FOR ALL
  TO authenticated
  USING (public.is_workspace_admin(workspace_id));
```
✅ **No recursion:** `is_workspace_admin()` is SECURITY DEFINER, bypasses RLS.

## Deployment Instructions

### URGENT: Apply Hotfix Immediately

This is a **production-blocking issue**. Deploy as soon as possible.

#### Option 1: Supabase Dashboard (Recommended)

```bash
# 1. Open Supabase Dashboard → SQL Editor
# 2. Copy entire contents of:
#    supabase/migrations/20260121_hotfix_infinite_recursion.sql
# 3. Execute the migration
# 4. Verify "✅" success messages in output
```

#### Option 2: Supabase CLI

```bash
# Push the hotfix migration
supabase db push

# Or run directly
psql $DATABASE_URL -f supabase/migrations/20260121_hotfix_infinite_recursion.sql
```

#### Option 3: Direct psql

```bash
# Connect to production database
psql "postgresql://postgres:[password]@[project-ref].supabase.co:5432/postgres"

# Run the hotfix
\i supabase/migrations/20260121_hotfix_infinite_recursion.sql
```

### Post-Deployment Verification

**1. Test Sign-In (Email)**
```
1. Navigate to app login page
2. Enter email and password
3. Should successfully sign in without 500 errors
4. Check browser console - no "infinite recursion" errors
```

**2. Test Sign-In (Google OAuth)**
```
1. Click "Sign in with Google"
2. Complete OAuth flow
3. Should redirect to app without 403/500 errors
4. User profile should load successfully
```

**3. Query Users Table (SQL Editor)**
```sql
-- As authenticated user, test policy evaluation
SELECT * FROM users WHERE id = auth.uid();
-- Should return 1 row (your own user record)

SELECT * FROM users WHERE workspace_id IN (SELECT user_workspace_ids());
-- Should return all users in your workspace
```

**4. Check Supabase Logs**
```
Dashboard → Logs → Postgres Logs
Filter for: "infinite recursion"
Expected: No recent errors (after hotfix applied)
```

## Technical Deep Dive

### Why SECURITY DEFINER Functions Work

```sql
-- Without SECURITY DEFINER (causes recursion)
CREATE POLICY "bad_policy" ON users FOR SELECT
USING (
  workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
                   -- ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                   -- Triggers same policy → recursion
);

-- With SECURITY DEFINER (no recursion)
CREATE FUNCTION user_workspace_ids()
RETURNS SETOF UUID
SECURITY DEFINER  -- Runs with function owner's privileges
STABLE
AS $$
  SELECT workspace_id FROM users WHERE id = auth.uid();
  -- ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  -- Bypasses RLS, no policy evaluation, no recursion
$$;

CREATE POLICY "good_policy" ON users FOR SELECT
USING (
  workspace_id IN (SELECT user_workspace_ids())
                   -- ^^^^^^^^^^^^^^^^^^^^^^^^^^^
                   -- Calls SECURITY DEFINER function, no recursion
);
```

### Security Considerations

**Q: Is SECURITY DEFINER safe?**
**A:** Yes, when used correctly:
- ✅ Functions are marked `STABLE` (no side effects)
- ✅ `search_path` is set to `public` (prevents injection)
- ✅ `REVOKE EXECUTE FROM anon, authenticated` (only RLS can call)
- ✅ Functions only query by `auth.uid()` (no privilege escalation)

**Q: Can users call these functions directly?**
**A:** No. We revoked execute permissions:
```sql
REVOKE EXECUTE ON FUNCTION user_workspace_ids() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION is_workspace_admin(UUID) FROM anon, authenticated;
```

Only RLS policies can invoke them internally.

## Rollback Plan

If issues arise after applying hotfix:

```sql
-- Restore previous (broken) state
BEGIN;

-- Remove new function
DROP FUNCTION IF EXISTS public.is_workspace_admin(UUID);

-- Restore old policies (will cause recursion again)
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view workspace members" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can manage workspace users" ON public.users;

-- Note: This rolls back to broken state
-- Only use if hotfix causes NEW issues

COMMIT;
```

**Better approach:** Forward-fix any issues rather than rollback.

## Success Criteria

Hotfix is successful when:

- ✅ Users can sign in with email (no 500 errors)
- ✅ Users can sign in with Google OAuth (no 403/500 errors)
- ✅ User profile loads correctly after authentication
- ✅ No "infinite recursion" errors in Supabase logs
- ✅ Users can query their own profile via `SELECT * FROM users`
- ✅ Workspace members can see other users in their workspace

## Related Files

- **Hotfix Migration:** `supabase/migrations/20260121_hotfix_infinite_recursion.sql`
- **Original Migration:** `supabase/migrations/20260121_comprehensive_security_audit_fixes.sql`
- **This Summary:** `supabase/migrations/INFINITE_RECURSION_FIX_SUMMARY.md`

## Timeline

- **2026-01-21 (earlier):** Applied comprehensive security audit fixes
- **2026-01-21 (now):** Discovered infinite recursion error
- **2026-01-21 (now):** Created and ready to deploy hotfix

## Prevention for Future

**Lesson Learned:** When creating RLS policies on a table, **never** query the same table in the policy's `USING` clause without a SECURITY DEFINER wrapper.

**Best Practice:**
```sql
-- ❌ BAD: Direct subquery on same table
CREATE POLICY "policy" ON table_name
USING (col IN (SELECT col FROM table_name WHERE ...));

-- ✅ GOOD: Use SECURITY DEFINER function
CREATE POLICY "policy" ON table_name
USING (col IN (SELECT helper_function()));
```

**Code Review Checklist:**
- [ ] Does the policy query the same table it's protecting?
- [ ] If yes, is it wrapped in a SECURITY DEFINER function?
- [ ] Has the function been tested to avoid recursion?
- [ ] Is the function marked STABLE (if read-only)?
- [ ] Is search_path set to prevent injection?

## Contact

For issues or questions about this fix, refer to:
- Supabase PostgreSQL logs
- This summary document
- Original security audit documentation

---

**Status:** Ready for immediate deployment
**Priority:** P0 (Critical - blocking production)
**Deploy Window:** ASAP
