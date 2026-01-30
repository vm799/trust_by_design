-- ============================================================================
-- SUPABASE SECURITY & PERFORMANCE REMEDIATION
-- Generated: 2026-01-30
-- Status: SAFE TO RUN (all destructive operations are commented out)
-- ============================================================================
-- Instructions:
-- 1. Run this file as-is to collect diagnostics
-- 2. Review output before uncommenting any changes
-- 3. Apply changes one section at a time
-- ============================================================================

-- ============================================================================
-- SECTION A: DIAGNOSTIC QUERIES (READ-ONLY)
-- ============================================================================

-- A1: Check if pg_stat_statements is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_stat_statements';

-- A2: Tables with RLS enabled/disabled
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity, tablename;

-- A3: Current RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  LEFT(qual::text, 100) as using_clause,
  LEFT(with_check::text, 100) as with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- A4: Table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname || '.' || tablename)) AS table_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
LIMIT 20;

-- A5: Index usage statistics
SELECT
  schemaname,
  relname AS table_name,
  indexrelname AS index_name,
  idx_scan AS times_used,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC
LIMIT 20;

-- A6: Dead tuple ratio (bloat indicator)
SELECT
  schemaname,
  relname AS table_name,
  n_dead_tup AS dead_tuples,
  n_live_tup AS live_tuples,
  ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_ratio_pct
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND n_live_tup > 0
ORDER BY dead_ratio_pct DESC
LIMIT 20;

-- A7: Current long-running queries (if any)
SELECT
  pid,
  now() - pg_stat_activity.query_start AS duration,
  LEFT(query, 100) as query_preview,
  state,
  wait_event_type
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds'
  AND state != 'idle'
ORDER BY duration DESC;

-- A8: Cache hit rates
SELECT
  schemaname,
  relname,
  heap_blks_read,
  heap_blks_hit,
  ROUND(100.0 * heap_blks_hit / NULLIF(heap_blks_hit + heap_blks_read, 0), 2) AS hit_ratio
FROM pg_statio_user_tables
WHERE heap_blks_read + heap_blks_hit > 0
  AND schemaname = 'public'
ORDER BY heap_blks_read DESC
LIMIT 20;

-- A9: Check for vulnerable bunker table policies
SELECT
  tablename,
  policyname,
  qual as using_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename LIKE 'bunker%'
  AND (qual::text = 'true' OR qual IS NULL);

-- A10: Role settings (statement timeout)
SELECT rolname, rolconfig
FROM pg_roles
WHERE rolname IN ('anon', 'authenticated', 'service_role');

-- ============================================================================
-- SECTION B: CRITICAL SECURITY FIX - BUNKER TABLES
-- ============================================================================
-- STATUS: COMMENTED OUT - Review and uncomment to apply
-- ============================================================================

/*
-- B1: Drop insecure bunker policies
DROP POLICY IF EXISTS "bunker_jobs_insert_anon" ON bunker_jobs;
DROP POLICY IF EXISTS "bunker_jobs_select_by_id" ON bunker_jobs;
DROP POLICY IF EXISTS "bunker_jobs_update_by_id" ON bunker_jobs;
DROP POLICY IF EXISTS "bunker_photos_policy" ON bunker_photos;
DROP POLICY IF EXISTS "bunker_signatures_policy" ON bunker_signatures;

-- B2: Create secure job-ID-based policies
CREATE POLICY "bunker_jobs_token_select" ON bunker_jobs
  FOR SELECT
  TO anon, authenticated
  USING (
    id = current_setting('request.headers', true)::json->>'x-job-id'
    OR (
      (SELECT auth.uid()) IS NOT NULL
      AND workspace_id IN (
        SELECT workspace_id FROM users WHERE id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "bunker_jobs_token_update" ON bunker_jobs
  FOR UPDATE
  TO anon, authenticated
  USING (
    id = current_setting('request.headers', true)::json->>'x-job-id'
  )
  WITH CHECK (
    id = current_setting('request.headers', true)::json->>'x-job-id'
  );

CREATE POLICY "bunker_jobs_authenticated_insert" ON bunker_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = (SELECT auth.uid())
    )
  );

CREATE POLICY "bunker_photos_via_job" ON bunker_photos
  FOR ALL
  TO anon, authenticated
  USING (
    job_id = current_setting('request.headers', true)::json->>'x-job-id'
    OR EXISTS (
      SELECT 1 FROM bunker_jobs bj
      WHERE bj.id = bunker_photos.job_id
        AND bj.workspace_id IN (
          SELECT workspace_id FROM users WHERE id = (SELECT auth.uid())
        )
    )
  )
  WITH CHECK (
    job_id = current_setting('request.headers', true)::json->>'x-job-id'
    OR EXISTS (
      SELECT 1 FROM bunker_jobs bj
      WHERE bj.id = bunker_photos.job_id
        AND bj.workspace_id IN (
          SELECT workspace_id FROM users WHERE id = (SELECT auth.uid())
        )
    )
  );

CREATE POLICY "bunker_signatures_via_job" ON bunker_signatures
  FOR ALL
  TO anon, authenticated
  USING (
    job_id = current_setting('request.headers', true)::json->>'x-job-id'
    OR EXISTS (
      SELECT 1 FROM bunker_jobs bj
      WHERE bj.id = bunker_signatures.job_id
        AND bj.workspace_id IN (
          SELECT workspace_id FROM users WHERE id = (SELECT auth.uid())
        )
    )
  )
  WITH CHECK (
    job_id = current_setting('request.headers', true)::json->>'x-job-id'
    OR EXISTS (
      SELECT 1 FROM bunker_jobs bj
      WHERE bj.id = bunker_signatures.job_id
        AND bj.workspace_id IN (
          SELECT workspace_id FROM users WHERE id = (SELECT auth.uid())
        )
    )
  );
*/

-- ============================================================================
-- SECTION C: PERFORMANCE INDEXES
-- ============================================================================
-- STATUS: COMMENTED OUT - Safe to apply after review
-- ============================================================================

/*
-- C1: Bunker table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bunker_jobs_id_workspace
  ON bunker_jobs(id, workspace_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bunker_photos_job_id_btree
  ON bunker_photos(job_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bunker_signatures_job_id_btree
  ON bunker_signatures(job_id);
*/

-- ============================================================================
-- SECTION D: MONITORING SETUP
-- ============================================================================
-- STATUS: COMMENTED OUT - Safe to apply after review
-- ============================================================================

/*
-- D1: Create alerts table
CREATE TABLE IF NOT EXISTS public.api_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  ip_address TEXT,
  user_id UUID,
  request_count INTEGER,
  threshold INTEGER,
  window_minutes INTEGER,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_alerts_created ON public.api_alerts(created_at DESC);

ALTER TABLE public.api_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view alerts" ON public.api_alerts
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) IN (
      SELECT id FROM users WHERE role IN ('owner', 'admin')
    )
  );
*/

-- ============================================================================
-- SECTION E: CLEANUP QUERIES (DIAGNOSTIC ONLY)
-- ============================================================================
-- STATUS: READ-ONLY - Never auto-delete production data
-- ============================================================================

-- E1: Count anonymous users by creation date
SELECT
  date_trunc('day', created_at) AS created_date,
  COUNT(*) AS user_count
FROM auth.users
WHERE is_anonymous = true OR email IS NULL
GROUP BY date_trunc('day', created_at)
ORDER BY created_date DESC
LIMIT 10;

-- E2: Check which tables exist in public schema
SELECT
  table_name,
  CASE WHEN table_name LIKE 'bunker%' THEN 'bunker table' ELSE 'regular table' END as table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- ============================================================================
-- END OF SAFE-TO-RUN DIAGNOSTICS
-- ============================================================================
-- Next steps:
-- 1. Review output of diagnostic queries above
-- 2. Uncomment Section B to fix critical security issues
-- 3. Uncomment Section C to add performance indexes
-- 4. Uncomment Section D to set up monitoring
-- ============================================================================
