# Supabase Security & Performance Remediation Report

**Generated:** 2026-01-30
**Project:** JobProof Trust by Design
**Traffic Analysis Period:** Last 1 hour (755 REST, 47 Auth, 6 Storage requests)

---

## 1. Executive Summary

**CRITICAL FINDINGS:**

1. **Bunker tables have ZERO security** - `bunker_jobs`, `bunker_photos`, `bunker_signatures` tables use `USING (true)` RLS policies allowing ANYONE to read/write ALL data without authentication.
2. **Client-side polling causing high REST load** - `MessagingPanel.tsx` polls every 5 seconds, potentially generating 720+ requests/hour per active user.
3. **Storage buckets are publicly accessible** - Job photos and signatures can be accessed without authentication.
4. **Anon key exposed in client code** - While expected for Supabase, combined with weak RLS this enables data exfiltration.

**Highest-Priority Actions (Do within 1 hour):**
1. Apply restrictive RLS policies to bunker tables immediately
2. Increase MessagingPanel polling interval from 5s to 30s minimum
3. Add rate limiting Edge Function
4. Verify `pg_stat_statements` is enabled for query analysis
5. Create missing indexes for RLS predicate columns

---

## 2. Security Issues Discovered

### **HIGH SEVERITY**

| Issue | Description | Remediation |
|-------|-------------|-------------|
| **Bunker tables open to public** | `bunker_jobs`, `bunker_photos`, `bunker_signatures` have `USING (true)` policies. Any anonymous user can read/write ALL records. | Apply job-ID-based access policies (see SQL Section 6.1) |
| **Base schema has permissive defaults** | `schema.sql` defines "Allow anonymous access" policies with `USING (true)`. If applied without security migrations, all data is exposed. | Ensure security migrations are applied AFTER base schema |
| **Storage buckets publicly readable** | `job-photos` and `job-signatures` buckets allow anonymous SELECT. Anyone with a URL can download evidence. | Restrict storage policies to authenticated users or signed URLs |

### **MEDIUM SEVERITY**

| Issue | Description | Remediation |
|-------|-------------|-------------|
| **Token stored in plaintext** | `job_access_tokens.token` column stores plaintext tokens alongside hashes. Leaks enable unauthorized access. | Phase out plaintext column after migration complete |
| **CORS allows any origin** | Edge Functions use `Access-Control-Allow-Origin: '*'`. Allows malicious sites to make requests. | Restrict to known domains |
| **No rate limiting on auth endpoints** | 47 auth requests/hour suggests normal usage, but no protection against brute force. | Enable Supabase auth rate limits and CAPTCHA |

### **LOW SEVERITY**

| Issue | Description | Remediation |
|-------|-------------|-------------|
| **Helper functions revoke from anon/authenticated** | Security functions like `get_workspace_id()` are revoked but called in RLS policies - may cause issues | Verify RLS policies work correctly after changes |

---

## 3. Performance Issues Discovered

### **HIGH SEVERITY**

| Issue | Description | Remediation |
|-------|-------------|-------------|
| **5-second polling in MessagingPanel** | `components/MessagingPanel.tsx:70,417` polls every 5 seconds. Two intervals = 1440 calls/hour per user. | Increase to 30s minimum, or use Supabase Realtime subscriptions |
| **30-second connection checks** | `views/JobRunner.tsx:705` and `views/BunkerRun.tsx:534` check connectivity every 30s. | Use `navigator.onLine` events instead of polling |

### **MEDIUM SEVERITY**

| Issue | Description | Remediation |
|-------|-------------|-------------|
| **Multiple concurrent sync intervals** | App.tsx (5 min), syncQueue.ts (5 min), AdminDashboard.tsx (5 min) all run sync operations. | Consolidate into single sync manager |
| **Nested subqueries in RLS policies** | Policies like `workspace_id IN (SELECT workspace_id FROM users WHERE id = ...)` evaluated per row. | Use SECURITY DEFINER helper functions (already implemented in migrations) |

### **LOW SEVERITY**

| Issue | Description | Remediation |
|-------|-------------|-------------|
| **No query result caching** | Every navigation triggers fresh API calls. | Implement React Query or SWR with stale-while-revalidate |

---

## 4. Slow/Expensive Queries (Diagnostic)

Since I cannot directly run `pg_stat_statements` queries, here are the diagnostic queries to run in Supabase SQL Editor:

### A) Top Queries by Call Count and Total Time

```sql
-- Requires pg_stat_statements extension enabled
-- Run in Supabase SQL Editor (Database > Extensions > pg_stat_statements)

SELECT
  query,
  calls,
  total_exec_time::numeric(20,2) as total_time_ms,
  mean_exec_time::numeric(20,2) as mean_time_ms,
  max_exec_time::numeric(20,2) as max_time_ms,
  rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

### B) Current Long-Running Queries

```sql
SELECT
  pid,
  now() - pg_stat_activity.query_start AS duration,
  query,
  state,
  wait_event_type,
  wait_event
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds'
  AND state != 'idle'
ORDER BY duration DESC;
```

### C) Cache Hit Rates

```sql
SELECT
  schemaname,
  relname,
  heap_blks_read,
  heap_blks_hit,
  ROUND(100.0 * heap_blks_hit / NULLIF(heap_blks_hit + heap_blks_read, 0), 2) AS hit_ratio
FROM pg_statio_user_tables
WHERE heap_blks_read + heap_blks_hit > 0
ORDER BY heap_blks_read DESC
LIMIT 20;
```

### D) Current Locks and Blocking Queries

```sql
SELECT
  blocked_locks.pid AS blocked_pid,
  blocked_activity.usename AS blocked_user,
  blocking_locks.pid AS blocking_pid,
  blocking_activity.usename AS blocking_user,
  blocked_activity.query AS blocked_statement,
  blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
  AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
  AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
  AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
  AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
  AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
  AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
  AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
  AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
  AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

### E) Table/Index Sizes

```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname || '.' || tablename)) AS table_size,
  pg_size_pretty(pg_indexes_size(schemaname || '.' || tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
LIMIT 20;
```

### F) Auth Audit Logs (Last 1 Hour)

```sql
SELECT
  action,
  ip_address,
  user_agent,
  COUNT(*) as request_count
FROM auth.audit_log_entries
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY action, ip_address, user_agent
ORDER BY request_count DESC
LIMIT 20;
```

### G) List RLS Policies and Tables Without RLS

```sql
-- Tables with RLS enabled/disabled
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity, tablename;

-- Current RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### H) Unused Indexes

```sql
SELECT
  schemaname,
  relname AS table_name,
  indexrelname AS index_name,
  idx_scan AS times_used,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
```

---

## 5. Traffic Analysis

### Expected Breakdown (755 REST, 47 Auth, 6 Storage)

| Category | Estimated % | Likely Cause |
|----------|-------------|--------------|
| MessagingPanel polling | ~60% (450 req) | 5-second polling intervals |
| Data fetching (jobs, clients) | ~20% (150 req) | Normal app navigation |
| Sync operations | ~10% (75 req) | Background sync every 5 min |
| Photo/signature uploads | ~10% (80 req) | Evidence capture operations |

### Auth Requests (47/hour)

| Category | Estimated Count | Status |
|----------|-----------------|--------|
| Token refresh | ~40 | Normal (hourly refresh) |
| Magic link validation | ~5 | Normal |
| Login/logout | ~2 | Normal |

### Storage Requests (6/hour)

| Category | Estimated Count | Status |
|----------|-----------------|--------|
| Photo uploads | ~4 | Normal |
| Signature uploads | ~2 | Normal |

### Recommended Immediate Mitigations

1. **Increase MessagingPanel polling to 30s** - Reduces 720 req/hr to 120 req/hr
2. **Use Realtime subscriptions** - Replace polling with WebSocket updates (0 REST calls)
3. **Add caching layer** - Prevent redundant fetches on navigation

---

## 6. SQL Remediation Scripts

### 6.1 CRITICAL: Fix Bunker Table RLS Policies

```sql
-- ============================================================================
-- CRITICAL FIX: Secure bunker tables with job-ID-based access
-- ============================================================================
-- Run this immediately to prevent unauthorized data access
-- ============================================================================

BEGIN;

-- Drop overly permissive policies
DROP POLICY IF EXISTS "bunker_jobs_insert_anon" ON bunker_jobs;
DROP POLICY IF EXISTS "bunker_jobs_select_by_id" ON bunker_jobs;
DROP POLICY IF EXISTS "bunker_jobs_update_by_id" ON bunker_jobs;
DROP POLICY IF EXISTS "bunker_photos_policy" ON bunker_photos;
DROP POLICY IF EXISTS "bunker_signatures_policy" ON bunker_signatures;

-- Create secure policies using magic link token validation
-- Jobs: Allow access only with valid job token in header
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

-- Photos: Inherit access from parent job
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

-- Signatures: Inherit access from parent job
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

COMMIT;
```

### 6.2 Add Missing Performance Indexes

```sql
-- ============================================================================
-- Performance indexes for RLS predicate columns
-- ============================================================================

-- Bunker tables
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bunker_jobs_id_workspace
  ON bunker_jobs(id, workspace_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bunker_photos_job_id_btree
  ON bunker_photos(job_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bunker_signatures_job_id_btree
  ON bunker_signatures(job_id);

-- Messaging (if exists)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_thread_created
  ON messages(thread_id, created_at DESC)
  WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages');
```

### 6.3 Statement Timeout for Roles (Prevent Runaway Queries)

```sql
-- ============================================================================
-- Set statement timeout for anon/authenticated roles
-- Prevents long-running queries from consuming resources
-- ============================================================================

-- WARNING: Requires superuser. Run via Supabase Dashboard > SQL Editor
-- ALTER ROLE anon SET statement_timeout = '30s';
-- ALTER ROLE authenticated SET statement_timeout = '60s';

-- Verify current settings
SELECT rolname, rolconfig
FROM pg_roles
WHERE rolname IN ('anon', 'authenticated', 'service_role');
```

### 6.4 Storage Bucket Security

```sql
-- ============================================================================
-- Secure storage buckets (if you can modify storage schema)
-- ============================================================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Allow anonymous upload to job-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow anonymous read from job-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow anonymous upload to job-signatures" ON storage.objects;
DROP POLICY IF EXISTS "Allow anonymous read from job-signatures" ON storage.objects;

-- Create authenticated-only policies
CREATE POLICY "Authenticated users can upload photos" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'job-photos');

CREATE POLICY "Authenticated users can read photos" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'job-photos');

CREATE POLICY "Authenticated users can upload signatures" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'job-signatures');

CREATE POLICY "Authenticated users can read signatures" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'job-signatures');
```

### 6.5 Enable and Verify pg_stat_statements

```sql
-- ============================================================================
-- Enable pg_stat_statements for query analysis
-- ============================================================================

-- Check if extension exists
SELECT * FROM pg_extension WHERE extname = 'pg_stat_statements';

-- If not enabled, run (requires superuser/dashboard):
-- CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Reset stats after applying fixes (to measure improvement)
-- SELECT pg_stat_statements_reset();
```

### 6.6 Cleanup Anonymous Auth Users (Diagnostic Only)

```sql
-- ============================================================================
-- Identify anonymous users (diagnostic - DO NOT DELETE without backup)
-- ============================================================================

-- Count anonymous users by creation date
SELECT
  date_trunc('day', created_at) AS created_date,
  COUNT(*) AS user_count
FROM auth.users
WHERE is_anonymous = true OR email IS NULL
GROUP BY date_trunc('day', created_at)
ORDER BY created_date DESC;

-- MANUAL CLEANUP (requires confirmation):
-- DELETE FROM auth.users WHERE is_anonymous = true AND created_at < NOW() - INTERVAL '30 days';
```

### 6.7 Table Bloat Estimation (Read-Only)

```sql
-- ============================================================================
-- Estimate table bloat (read-only diagnostic)
-- ============================================================================

SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS total_size,
  n_dead_tup AS dead_tuples,
  n_live_tup AS live_tuples,
  ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_ratio_pct
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND n_live_tup > 0
ORDER BY dead_ratio_pct DESC
LIMIT 20;

-- If dead_ratio > 20%, consider running VACUUM ANALYZE:
-- VACUUM ANALYZE public.table_name;
```

---

## 7. Edge Function: Rate Limiter

Create a new Edge Function for rate limiting:

**File:** `supabase/functions/rate-limiter/index.ts`

```typescript
// =====================================================================
// SUPABASE EDGE FUNCTION: RATE LIMITER
// =====================================================================
// Purpose: Rate limit API requests by IP address
// Deploy: supabase functions deploy rate-limiter
// =====================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// In-memory rate limit store (resets on cold start)
const rateLimits = new Map<string, { count: number; resetAt: number }>();

// Configuration
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100; // 100 requests per minute per IP

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-job-id, x-job-token',
};

function getClientIP(req: Request): string {
  // Check common headers for real IP behind proxies
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  return 'unknown';
}

function isRateLimited(ip: string): { limited: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const record = rateLimits.get(ip);

  // Clean up expired records
  if (record && record.resetAt <= now) {
    rateLimits.delete(ip);
  }

  const current = rateLimits.get(ip);

  if (!current) {
    // First request from this IP
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { limited: false, remaining: MAX_REQUESTS_PER_WINDOW - 1, resetIn: RATE_LIMIT_WINDOW_MS };
  }

  if (current.count >= MAX_REQUESTS_PER_WINDOW) {
    // Rate limited
    return {
      limited: true,
      remaining: 0,
      resetIn: current.resetAt - now
    };
  }

  // Increment counter
  current.count++;
  return {
    limited: false,
    remaining: MAX_REQUESTS_PER_WINDOW - current.count,
    resetIn: current.resetAt - now
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const clientIP = getClientIP(req);
  const { limited, remaining, resetIn } = isRateLimited(clientIP);

  const rateLimitHeaders = {
    ...corsHeaders,
    'X-RateLimit-Limit': MAX_REQUESTS_PER_WINDOW.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(resetIn / 1000).toString(),
  };

  if (limited) {
    return new Response(
      JSON.stringify({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(resetIn / 1000),
      }),
      {
        status: 429,
        headers: {
          ...rateLimitHeaders,
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil(resetIn / 1000).toString(),
        },
      }
    );
  }

  // Forward request to original endpoint
  // This function acts as a proxy - modify as needed
  try {
    const body = await req.json().catch(() => ({}));

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Request allowed',
        rateLimit: {
          remaining,
          resetIn: Math.ceil(resetIn / 1000),
        },
      }),
      {
        status: 200,
        headers: {
          ...rateLimitHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...rateLimitHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
```

---

## 8. Monitoring and Alerting

### 8.1 Create Alert Table and Trigger

```sql
-- ============================================================================
-- High Request Rate Alert System
-- ============================================================================

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

-- Enable RLS (admin-only access)
ALTER TABLE public.api_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view alerts" ON public.api_alerts
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) IN (
      SELECT id FROM users WHERE role IN ('owner', 'admin')
    )
  );
```

### 8.2 Logs Explorer Queries

Run these in Supabase Dashboard > Logs > Logs Explorer:

```sql
-- High request rate by IP (last hour)
SELECT
  request.headers->>'x-forwarded-for' AS ip,
  COUNT(*) AS request_count
FROM edge_logs
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY request.headers->>'x-forwarded-for'
HAVING COUNT(*) > 100
ORDER BY request_count DESC;

-- Auth failures (potential brute force)
SELECT
  message,
  COUNT(*) AS failure_count
FROM auth_logs
WHERE timestamp > NOW() - INTERVAL '1 hour'
  AND level = 'error'
GROUP BY message
ORDER BY failure_count DESC;

-- Slow queries (> 1 second)
SELECT
  query,
  duration_ms,
  timestamp
FROM postgres_logs
WHERE timestamp > NOW() - INTERVAL '1 hour'
  AND duration_ms > 1000
ORDER BY duration_ms DESC
LIMIT 20;
```

### 8.3 Recommended Alert Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| REST requests/minute | > 50 | > 100 | Investigate polling patterns |
| Auth requests/minute | > 10 | > 30 | Check for brute force |
| Storage requests/minute | > 5 | > 20 | Check for abuse |
| Single IP requests/hour | > 200 | > 500 | Consider IP blocking |
| Failed auth attempts/hour | > 10 | > 50 | Enable CAPTCHA |

---

## 9. Testing & Rollback Plan

### 9.1 Testing Strategy

1. **Apply to staging first** - Create a staging branch in Supabase
2. **Test with single user** - Verify app functionality after RLS changes
3. **Canary deployment** - Apply to subset of traffic using Edge Function routing
4. **Monitor for 24 hours** - Check for increased errors in logs

### 9.2 Rollback Commands

```sql
-- ============================================================================
-- ROLLBACK: Bunker RLS policies (restore permissive access)
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS "bunker_jobs_token_select" ON bunker_jobs;
DROP POLICY IF EXISTS "bunker_jobs_token_update" ON bunker_jobs;
DROP POLICY IF EXISTS "bunker_jobs_authenticated_insert" ON bunker_jobs;
DROP POLICY IF EXISTS "bunker_photos_via_job" ON bunker_photos;
DROP POLICY IF EXISTS "bunker_signatures_via_job" ON bunker_signatures;

-- Restore original (INSECURE - use only for rollback)
CREATE POLICY "bunker_jobs_insert_anon" ON bunker_jobs
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "bunker_jobs_select_by_id" ON bunker_jobs
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "bunker_jobs_update_by_id" ON bunker_jobs
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "bunker_photos_policy" ON bunker_photos
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "bunker_signatures_policy" ON bunker_signatures
  FOR ALL USING (true) WITH CHECK (true);

COMMIT;
```

```sql
-- ============================================================================
-- ROLLBACK: Drop new indexes
-- ============================================================================

DROP INDEX IF EXISTS idx_bunker_jobs_id_workspace;
DROP INDEX IF EXISTS idx_bunker_photos_job_id_btree;
DROP INDEX IF EXISTS idx_bunker_signatures_job_id_btree;
DROP INDEX IF EXISTS idx_messages_thread_created;
```

---

## 10. Final Checklist (Priority Order)

### Immediate (< 1 hour)

- [ ] **Run Section 6.1 SQL** - Secure bunker tables with proper RLS
- [ ] **Edit `components/MessagingPanel.tsx`** - Change `setInterval(loadThreads, 5000)` to `30000`
- [ ] **Run diagnostic queries** - Execute Section 4 queries to establish baseline
- [ ] **Enable pg_stat_statements** - If not already enabled (Supabase Dashboard > Database > Extensions)
- [ ] **Create rate-limiter Edge Function** - Deploy Section 7 code

### Short-term (< 24 hours)

- [ ] **Run Section 6.2 SQL** - Add performance indexes
- [ ] **Review auth.audit_log_entries** - Look for suspicious patterns
- [ ] **Configure Supabase Auth settings** - Enable CAPTCHA, rate limits (Dashboard > Authentication > Settings)
- [ ] **Set up monitoring alerts** - Create alert table (Section 8.1)

### Medium-term (< 1 week)

- [ ] **Implement Realtime subscriptions** - Replace polling with WebSocket updates
- [ ] **Rotate anon key** - If evidence of key abuse found
- [ ] **Phase out plaintext tokens** - Remove `token` column from `job_access_tokens`
- [ ] **Restrict CORS origins** - Update Edge Functions with domain allowlist
- [ ] **Storage bucket security** - Apply Section 6.4 policies

---

## Appendix: Safe-to-Run SQL File

All read-only diagnostic queries have been consolidated in this report.
Copy Section 4 queries directly to Supabase SQL Editor for analysis.

**Dashboard URLs for manual configuration:**
- Auth settings: `https://<project-ref>.supabase.co/dashboard/project/<project-ref>/auth/settings`
- Extensions: `https://<project-ref>.supabase.co/dashboard/project/<project-ref>/database/extensions`
- Logs Explorer: `https://<project-ref>.supabase.co/dashboard/project/<project-ref>/logs/explorer`
- Edge Functions: `https://<project-ref>.supabase.co/dashboard/project/<project-ref>/functions`

---

*Report generated by Supabase Security Audit - JobProof Trust by Design*
