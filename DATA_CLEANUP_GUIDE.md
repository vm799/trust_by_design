# 🗑️ Test Data Cleanup Guide

**Purpose:** Remove test/demo technicians, clients, and jobs to prepare for fresh UAT with proper UUID IDs.

**Date:** February 2026
**Risk Level:** MEDIUM-HIGH (permanent deletion)

---

## ⚠️ CRITICAL SAFETY CHECKLIST

Before running any SQL:

- [ ] Database backup created or available
- [ ] Running against TEST/STAGING environment (NOT production)
- [ ] Reviewed all SQL commands below
- [ ] Ran "Phase 1: Verify" commands first
- [ ] Screenshot verification results for audit trail
- [ ] Have rollback procedure saved (see below)

---

## 📍 WHERE TO RUN THESE COMMANDS

1. Go to **Supabase Dashboard** → Your Project
2. Click **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy/paste commands below
5. **Review output carefully before executing**

---

## PHASE 1️⃣: VERIFY TEST DATA (RUN FIRST)

Copy and paste the entire block below into a new SQL query:

```sql
-- ============================================================================
-- PHASE 1: VERIFY TEST DATA COUNT (SAFE - READ ONLY)
-- ============================================================================

-- Show all test/demo workspaces that will be affected
SELECT
  id,
  name,
  slug,
  created_at
FROM workspaces
WHERE slug ILIKE 'test-%'
   OR slug ILIKE 'demo-%'
   OR slug ILIKE 'sandbox-%'
   OR slug ILIKE 'qa-%'
ORDER BY created_at DESC;

-- Count breakdown by workspace
SELECT
  w.slug,
  COUNT(DISTINCT j.id) as jobs_count,
  COUNT(DISTINCT c.id) as clients_count,
  COUNT(DISTINCT u.id) as users_count,
  SUM(CASE WHEN j.id IS NOT NULL THEN 1 ELSE 0 END) as job_records
FROM workspaces w
LEFT JOIN jobs j ON j.workspace_id = w.id
LEFT JOIN clients c ON c.workspace_id = w.id
LEFT JOIN users u ON u.workspace_id = w.id
WHERE w.slug ILIKE 'test-%' OR w.slug ILIKE 'demo-%' OR w.slug ILIKE 'sandbox-%' OR w.slug ILIKE 'qa-%'
GROUP BY w.id, w.slug
ORDER BY jobs_count DESC;

-- Total summary
SELECT
  'Total Test Workspaces' as metric,
  COUNT(*) as count
FROM workspaces
WHERE slug ILIKE 'test-%' OR slug ILIKE 'demo-%' OR slug ILIKE 'sandbox-%' OR slug ILIKE 'qa-%'
UNION ALL
SELECT 'Total Jobs in Test Workspaces', COUNT(*)
FROM jobs
WHERE workspace_id IN (
  SELECT id FROM workspaces
  WHERE slug ILIKE 'test-%' OR slug ILIKE 'demo-%' OR slug ILIKE 'sandbox-%' OR slug ILIKE 'qa-%'
)
UNION ALL
SELECT 'Total Clients in Test Workspaces', COUNT(*)
FROM clients
WHERE workspace_id IN (
  SELECT id FROM workspaces
  WHERE slug ILIKE 'test-%' OR slug ILIKE 'demo-%' OR slug ILIKE 'sandbox-%' OR slug ILIKE 'qa-%'
)
UNION ALL
SELECT 'Total Users in Test Workspaces', COUNT(*)
FROM users
WHERE workspace_id IN (
  SELECT id FROM workspaces
  WHERE slug ILIKE 'test-%' OR slug ILIKE 'demo-%' OR slug ILIKE 'sandbox-%' OR slug ILIKE 'qa-%'
);
```

**✅ Action:** Run this query and **screenshot the results** for your audit trail.

**Expected Output Example:**
```
slug: test-workspace-1
jobs_count: 45
clients_count: 12
users_count: 8

Total Test Workspaces: 3
Total Jobs in Test Workspaces: 120
Total Clients in Test Workspaces: 35
Total Users in Test Workspaces: 24
```

**⚠️ VERIFY:**
- Are the counts reasonable for test data?
- Do you see only test/demo workspaces (not production)?
- Screenshot this result before proceeding!

---

## PHASE 2️⃣: DELETE TEST DATA (DESTRUCTIVE - CAREFUL!)

**Only run this AFTER you've verified Phase 1 results!**

```sql
-- ============================================================================
-- PHASE 2: DELETE TEST DATA (TRANSACTIONS - CAN BE ROLLED BACK)
-- ============================================================================

BEGIN TRANSACTION;

-- Create temp table of test workspace IDs
CREATE TEMP TABLE test_workspaces AS
SELECT id FROM workspaces
WHERE slug ILIKE 'test-%'
   OR slug ILIKE 'demo-%'
   OR slug ILIKE 'sandbox-%'
   OR slug ILIKE 'qa-%';

-- Delete dependent records in order (respects foreign keys)
DELETE FROM job_access_tokens
WHERE job_id IN (SELECT id FROM jobs WHERE workspace_id IN (SELECT id FROM test_workspaces));

DELETE FROM invoices
WHERE workspace_id IN (SELECT id FROM test_workspaces);

DELETE FROM job_status_history
WHERE workspace_id IN (SELECT id FROM test_workspaces);

DELETE FROM job_dispatches
WHERE workspace_id IN (SELECT id FROM test_workspaces);

DELETE FROM client_signoffs
WHERE workspace_id IN (SELECT id FROM test_workspaces);

-- Delete main data
DELETE FROM jobs
WHERE workspace_id IN (SELECT id FROM test_workspaces);

DELETE FROM clients
WHERE workspace_id IN (SELECT id FROM test_workspaces);

DELETE FROM users
WHERE workspace_id IN (SELECT id FROM test_workspaces);

-- Delete workspaces themselves
DELETE FROM workspaces
WHERE id IN (SELECT id FROM test_workspaces);

-- Verify deletion
SELECT COUNT(*) as remaining_test_workspaces FROM workspaces
WHERE slug ILIKE 'test-%' OR slug ILIKE 'demo-%' OR slug ILIKE 'sandbox-%' OR slug ILIKE 'qa-%';

COMMIT TRANSACTION;
```

**⚠️ CRITICAL STEPS:**

1. **Copy entire block above** (all commands between BEGIN and COMMIT)
2. **Paste into SQL Editor**
3. **Review the workspace IDs one more time** before clicking ▶️ Execute
4. **Click Execute** - the transaction will run atomically
5. **Screenshot the result** showing `remaining_test_workspaces: 0`

**If something looks wrong:**
```sql
-- Rollback the entire transaction
ROLLBACK TRANSACTION;
```

---

## PHASE 3️⃣: VERIFY CLEANUP (SAFE - READ ONLY)

After Phase 2 completes successfully, run this:

```sql
-- ============================================================================
-- PHASE 3: VERIFY CLEANUP COMPLETED
-- ============================================================================

-- Verify no test workspaces remain
SELECT COUNT(*) as remaining_test_workspaces FROM workspaces
WHERE slug ILIKE 'test-%'
   OR slug ILIKE 'demo-%'
   OR slug ILIKE 'sandbox-%'
   OR slug ILIKE 'qa-%';
-- Expected: 0

-- Verify production data still intact (assuming you have real workspaces)
SELECT COUNT(*) as total_production_workspaces FROM workspaces;

-- Verify no orphaned job records
SELECT COUNT(*) as orphaned_jobs FROM jobs
WHERE workspace_id IS NULL OR workspace_id NOT IN (SELECT id FROM workspaces);
-- Expected: 0

-- Verify no orphaned client records
SELECT COUNT(*) as orphaned_clients FROM clients
WHERE workspace_id IS NULL OR workspace_id NOT IN (SELECT id FROM workspaces);
-- Expected: 0

-- Show remaining workspaces (should be production only)
SELECT id, name, slug, created_at FROM workspaces
ORDER BY created_at DESC
LIMIT 10;
```

**Expected Results:**
```
remaining_test_workspaces: 0
total_production_workspaces: 1 (or however many real ones you have)
orphaned_jobs: 0
orphaned_clients: 0
```

---

## 🆘 ROLLBACK PROCEDURE (If Something Goes Wrong)

If you ran the deletion and realized it was a mistake:

```sql
-- ============================================================================
-- ROLLBACK (Only works if you haven't committed yet!)
-- ============================================================================

-- If transaction is still open, rollback:
ROLLBACK TRANSACTION;

-- Then re-run Phase 1 to verify data is still there
SELECT COUNT(*) FROM workspaces
WHERE slug ILIKE 'test-%';
```

**⚠️ Important:** Rollback ONLY works if:
1. You're still in the same transaction
2. You haven't clicked the ✓ Commit button in Supabase UI
3. You run ROLLBACK immediately after error

If you've already committed, you'll need to:
1. Restore from database backup
2. Contact Supabase support for point-in-time recovery

---

## 📊 MONITORING AFTER CLEANUP

After cleanup completes, verify the application still works:

```bash
# 1. Check if dev server still runs
npm run dev

# 2. Try creating a NEW client/technician (should generate UUID)
# Open http://localhost:3000
# Navigate to Technicians
# Create a new technician
# Check browser console for the generated ID (should be UUID format like: 550e8400-e29b-41d4-a716-446655440000)

# 3. Try to DELETE the new technician (should work now with UUID)
# Click delete button
# Verify it deletes successfully (no 400 error)
```

---

## 🎯 POST-CLEANUP CHECKLIST

- [ ] Phase 1 results captured (screenshot)
- [ ] Phase 2 executed and committed
- [ ] Phase 3 verified cleanup (screenshot)
- [ ] Application still starts (`npm run dev`)
- [ ] New technician created (has proper UUID)
- [ ] New technician deleted successfully
- [ ] No 400 errors in console
- [ ] Updated this guide with execution date/time

---

## 📝 EXECUTION LOG

**Date/Time:** [Your timestamp]
**Environment:** [test/staging/production]
**Operator:** [Your name]
**Workspaces Deleted:** [Count from Phase 1]
**Jobs Deleted:** [Count from Phase 1]
**Clients Deleted:** [Count from Phase 1]
**Status:** ✅ SUCCESS / ❌ FAILED

---

## 🔗 RELATED DOCUMENTATION

- [CLAUDE.md](./CLAUDE.md) - Architecture rules
- [Data Cleanup Implementation Plan](./DATA_CLEANUP_GUIDE.md) - This file
- Supabase Docs: https://supabase.com/docs/guides/database/json

**Questions?** Check the CLAUDE.md section on "Emergency Procedures" or review the Plan output for comprehensive technical details.
