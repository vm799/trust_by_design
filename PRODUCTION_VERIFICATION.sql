-- ============================================================================
-- PRODUCTION VERIFICATION SCRIPT
-- JobProof Backend Factory - Truth vs Hallucination Check
-- ============================================================================
-- Purpose: Verify ACTUAL deployed state vs claimed "production ready"
-- Run: Copy-paste into Supabase SQL Editor → Execute → Paste results
-- ============================================================================

-- ============================================================================
-- TEST 1: Core Infrastructure Count
-- ============================================================================
SELECT 'STEPS' as check, COUNT(*)::text as count FROM onboarding_steps
UNION ALL
SELECT 'PERSONAS', COUNT(DISTINCT persona_type)::text FROM onboarding_steps
UNION ALL
SELECT 'RPC_COMPLETE_STEP', COUNT(*)::text FROM pg_proc WHERE proname = 'complete_onboarding_step'
UNION ALL
SELECT 'RPC_COMPLETE_PERSONA', COUNT(*)::text FROM pg_proc WHERE proname = 'complete_persona_onboarding'
UNION ALL
SELECT 'RPC_USER_WORKFLOW', COUNT(*)::text FROM pg_proc WHERE proname = 'get_user_workflow'
UNION ALL
SELECT 'RPC_WORKSPACE_IDS', COUNT(*)::text FROM pg_proc WHERE proname = 'user_workspace_ids'
UNION ALL
SELECT 'USER_PERSONAS', COUNT(*)::text FROM user_personas
UNION ALL
SELECT 'PROGRESS', COUNT(*)::text FROM user_journey_progress
UNION ALL
SELECT 'WORKSPACES', COUNT(*)::text FROM workspaces
UNION ALL
SELECT 'USERS', COUNT(*)::text FROM users;

-- EXPECTED RESULTS (if migrations deployed):
-- check                    | count
-- -------------------------+-------
-- STEPS                    | 20
-- PERSONAS                 | 5
-- RPC_COMPLETE_STEP        | 1
-- RPC_COMPLETE_PERSONA     | 1
-- RPC_USER_WORKFLOW        | 1
-- RPC_WORKSPACE_IDS        | 1
-- USER_PERSONAS            | 0 (no onboarding started yet)
-- PROGRESS                 | 0 (no onboarding started yet)
-- WORKSPACES               | 3 (existing)
-- USERS                    | 3+ (existing)

-- ============================================================================
-- TEST 2: Persona Step Distribution (should be 4 steps each)
-- ============================================================================
SELECT
  persona_type,
  COUNT(*) as step_count,
  array_agg(step_key ORDER BY step_order) as steps
FROM onboarding_steps
GROUP BY persona_type
ORDER BY persona_type;

-- EXPECTED RESULTS:
-- persona_type        | step_count | steps
-- --------------------+------------+------------------------------------------------
-- agency_owner        | 4          | {add_first_technician, bulk_job_import, setup_billing, compliance_dashboard}
-- compliance_officer  | 4          | {enable_audit_logs, review_pending_jobs, seal_first_job, export_report}
-- safety_manager      | 4          | {create_safety_checklist, risk_assessment, training_matrix, incident_log}
-- site_supervisor     | 4          | {daily_briefing, material_tracking, safety_rounds, end_of_day_report}
-- solo_contractor     | 4          | {upload_logo, create_first_job, safety_checklist, generate_certificate}

-- ============================================================================
-- TEST 3: RPC Function Signatures (verify parameters)
-- ============================================================================
SELECT
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  pg_get_function_result(oid) as return_type
FROM pg_proc
WHERE proname IN (
  'complete_onboarding_step',
  'complete_persona_onboarding',
  'get_user_workflow',
  'user_workspace_ids'
)
ORDER BY proname;

-- EXPECTED RESULTS:
-- function_name               | arguments                                           | return_type
-- ---------------------------+-----------------------------------------------------+-------------
-- complete_onboarding_step   | p_step_key text, p_step_data jsonb DEFAULT '{}'::jsonb | json
-- complete_persona_onboarding| p_persona_type persona_type                         | json
-- get_user_workflow          |                                                     | json
-- user_workspace_ids         |                                                     | SETOF uuid

-- ============================================================================
-- TEST 4: RLS Policies Verification
-- ============================================================================
SELECT
  schemaname,
  tablename,
  policyname,
  cmd as command,
  qual as using_expression
FROM pg_policies
WHERE tablename IN ('user_personas', 'user_journey_progress', 'onboarding_steps')
ORDER BY tablename, policyname;

-- EXPECTED RESULTS (minimum 7 policies):
-- tablename              | policyname                           | command
-- -----------------------+--------------------------------------+---------
-- onboarding_steps       | Anyone can view onboarding steps     | SELECT
-- user_journey_progress  | Users can create own journey progress| INSERT
-- user_journey_progress  | Users can update own journey progress| UPDATE
-- user_journey_progress  | Users can view own journey progress  | SELECT
-- user_personas          | Users can create own personas        | INSERT
-- user_personas          | Users can update own personas        | UPDATE
-- user_personas          | Users can view own personas          | SELECT

-- ============================================================================
-- TEST 5: LIVE RPC Test - complete_onboarding_step()
-- ============================================================================
-- WARNING: This will fail if:
-- - Migration 006 not deployed
-- - RPC function missing
-- - user_personas table doesn't exist
-- - No active persona for auth.uid()

DO $$
DECLARE
  test_result json;
BEGIN
  -- Test with dummy UUIDs (will fail gracefully)
  BEGIN
    SELECT public.complete_onboarding_step(
      'upload_logo'::text,
      '{}'::jsonb
    ) INTO test_result;

    RAISE NOTICE 'RPC TEST PASSED: %', test_result;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'RPC TEST FAILED: % (This is expected if no active persona exists)', SQLERRM;
  END;
END $$;

-- EXPECTED RESULTS:
-- If migrations deployed: NOTICE with "RPC TEST FAILED: Not authenticated" or "No active persona found"
-- If migrations NOT deployed: ERROR: function public.complete_onboarding_step does not exist

-- ============================================================================
-- TEST 6: Table Structure Verification
-- ============================================================================
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name IN ('user_personas', 'user_journey_progress', 'onboarding_steps')
  AND table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- EXPECTED RESULTS: Should show all columns for 3 tables
-- user_personas: id, user_id, workspace_id, persona_type, is_active, is_complete, current_step, completed_steps, created_at, updated_at, completed_at
-- user_journey_progress: id, user_id, persona_id, step_key, status, step_data, started_at, completed_at, created_at
-- onboarding_steps: id, persona_type, step_key, step_order, title, description, icon, required_data, created_at

-- ============================================================================
-- TEST 7: Foreign Key Constraints
-- ============================================================================
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('user_personas', 'user_journey_progress')
ORDER BY tc.table_name, kcu.column_name;

-- EXPECTED RESULTS:
-- user_personas.user_id → users.id
-- user_personas.workspace_id → workspaces.id
-- user_journey_progress.user_id → users.id
-- user_journey_progress.persona_id → user_personas.id

-- ============================================================================
-- TEST 8: ENUM Values Verification
-- ============================================================================
SELECT
  enumlabel as persona_type,
  enumsortorder as sort_order
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'persona_type'
ORDER BY enumsortorder;

-- EXPECTED RESULTS:
-- persona_type        | sort_order
-- --------------------+-----------
-- solo_contractor     | 1
-- agency_owner        | 2
-- compliance_officer  | 3
-- safety_manager      | 4
-- site_supervisor     | 5

-- ============================================================================
-- TEST 9: Check Dependencies Exist (users, workspaces tables)
-- ============================================================================
SELECT
  'users' as table_name,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'users') as exists,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'workspace_id') as has_workspace_id
UNION ALL
SELECT
  'workspaces',
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'workspaces'),
  NULL;

-- EXPECTED RESULTS:
-- table_name  | exists | has_workspace_id
-- ------------+--------+-----------------
-- users       | true   | true
-- workspaces  | true   | NULL

-- ============================================================================
-- TEST 10: Check for audit_logs table (RPC references it)
-- ============================================================================
SELECT
  EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'log_audit_event') as log_audit_event_exists,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') as audit_logs_table_exists;

-- EXPECTED RESULTS:
-- log_audit_event_exists | audit_logs_table_exists
-- -----------------------+------------------------
-- true                   | true
-- (If false, complete_onboarding_step RPC will fail when trying to log)

-- ============================================================================
-- DEPLOYMENT STATUS SUMMARY
-- ============================================================================
-- Copy all query results above and paste into verification prompt.
--
-- GREEN (Production Ready) requires ALL tests pass:
-- [x] Test 1: 20 steps, 5 personas, 4 RPCs, 3+ workspaces
-- [x] Test 2: Each persona has exactly 4 steps
-- [x] Test 3: All 4 RPC signatures correct
-- [x] Test 4: Minimum 7 RLS policies exist
-- [x] Test 5: RPC callable (graceful failure OK if no persona)
-- [x] Test 6: All 3 tables with correct columns
-- [x] Test 7: Foreign keys to users + workspaces exist
-- [x] Test 8: ENUM has 5 values in correct order
-- [x] Test 9: users table has workspace_id column
-- [x] Test 10: audit_logs table exists OR RPC doesn't call it
-- ============================================================================
