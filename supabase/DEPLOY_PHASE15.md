# Phase 15: Enterprise-Grade Schema Migration

## Supabase Project: `ndcjtpzixjbhmzbavqdm`

---

## MANDATORY SAFETY PROTOCOL

### GATE 1: Backup (REQUIRED FIRST)

```bash
# Link to project
supabase link --project-ref ndcjtpzixjbhmzbavqdm

# Create backup BEFORE any changes
supabase db dump --db-url "$DATABASE_URL" -f backup_20260125_proof.sql

# Verify backup created
ls -la backup_20260125_proof.sql
```

**CHECKPOINT:** `backup_20260125_proof.sql` file exists

---

### GATE 2: Local Test (REQUIRED)

```bash
# Reset local DB and apply all migrations
supabase db reset

# Verify migration applied
supabase db diff --local

# Generate TypeScript types
supabase gen types typescript --local > supabase/types.ts
```

**CHECKPOINT:** No errors in local migration

---

### GATE 3: RLS Verification (REQUIRED)

```sql
-- Run in Supabase SQL Editor (local first)

-- Test 1: Anon cannot select jobs without token
SET request.headers = '{}';
SELECT count(*) FROM jobs; -- Should return 0 or error

-- Test 2: With valid token header, can access
SET request.headers = '{"x-tech-token": "ABC123"}';
SELECT count(*) FROM jobs WHERE tech_token = 'ABC123'; -- Should work

-- Test 3: Verify new columns exist
\d jobs | grep -E "(tech_token|tech_pin|proof_data)"
```

**CHECKPOINT:** Anon blocked, token access works

---

### GATE 4: Production Migration (SINGLE)

```bash
# Apply ONLY this migration to production
supabase migration up --single

# Verify in dashboard
# Go to: Table Editor > jobs > Check columns
```

**CHECKPOINT:** New columns visible in production

---

### GATE 5: End-to-End Token Flow

```bash
# 1. Create test job with token
curl -X POST "https://ndcjtpzixjbhmzbavqdm.supabase.co/rest/v1/rpc/create_tech_access_link" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"p_job_id": "test-job-123"}'

# Expected response:
# {"token": "ABC123", "pin": "483920", "link": "/job/test-job-123/ABC123"}

# 2. Validate token access
curl -X POST "https://ndcjtpzixjbhmzbavqdm.supabase.co/rest/v1/rpc/validate_tech_access" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_job_id": "test-job-123", "p_token": "ABC123"}'

# Expected: true
```

**CHECKPOINT:** Token generation and validation works

---

## Migration Summary

### New Columns Added to `jobs` table:

| Column | Type | Description |
|--------|------|-------------|
| `tech_token` | TEXT | Unique 6-char magic link token |
| `tech_pin` | TEXT | 6-digit fallback PIN |
| `token_used` | BOOLEAN | Track if token accessed |
| `token_used_at` | TIMESTAMPTZ | First access timestamp |
| `proof_data` | JSONB | Flexible proof metadata |
| `before_photo` | TEXT | Before photo URL |
| `after_photo` | TEXT | After photo URL |
| `notes_before` | TEXT | Tech notes (before work) |
| `notes_after` | TEXT | Tech notes (after work) |
| `client_signature` | TEXT | Client signature data |
| `client_signature_at` | TIMESTAMPTZ | Signature timestamp |
| `client_name_signed` | TEXT | Printed name on signature |
| `proof_completed_at` | TIMESTAMPTZ | Full proof submission time |
| `proof_submitted_by` | TEXT | Token used for submission |
| `manager_notified_at` | TIMESTAMPTZ | Manager email sent |
| `client_notified_at` | TIMESTAMPTZ | Client email sent |

### New Functions:

| Function | Purpose |
|----------|---------|
| `generate_tech_token()` | Creates unique 6-char token |
| `generate_tech_pin()` | Creates 6-digit PIN |
| `create_tech_access_link(job_id)` | Returns token, PIN, and link |
| `validate_tech_access(job_id, token, pin)` | Validates access |
| `submit_job_proof(...)` | Submits complete proof data |

### New Indexes:

- `idx_jobs_tech_token` (UNIQUE) - Fast token lookups
- `idx_jobs_status_completed` - Status queries
- `idx_jobs_token_used` - Token tracking queries

---

## Rollback Plan (Emergency Only)

```sql
-- Remove new columns (safe - no data loss if columns empty)
ALTER TABLE jobs DROP COLUMN IF EXISTS tech_token;
ALTER TABLE jobs DROP COLUMN IF EXISTS tech_pin;
ALTER TABLE jobs DROP COLUMN IF EXISTS token_used;
ALTER TABLE jobs DROP COLUMN IF EXISTS token_used_at;
ALTER TABLE jobs DROP COLUMN IF EXISTS proof_data;
ALTER TABLE jobs DROP COLUMN IF EXISTS before_photo;
ALTER TABLE jobs DROP COLUMN IF EXISTS after_photo;
ALTER TABLE jobs DROP COLUMN IF EXISTS notes_before;
ALTER TABLE jobs DROP COLUMN IF EXISTS notes_after;
ALTER TABLE jobs DROP COLUMN IF EXISTS client_signature;
ALTER TABLE jobs DROP COLUMN IF EXISTS client_signature_at;
ALTER TABLE jobs DROP COLUMN IF EXISTS client_name_signed;
ALTER TABLE jobs DROP COLUMN IF EXISTS proof_completed_at;
ALTER TABLE jobs DROP COLUMN IF EXISTS proof_submitted_by;
ALTER TABLE jobs DROP COLUMN IF EXISTS manager_notified_at;
ALTER TABLE jobs DROP COLUMN IF EXISTS client_notified_at;

-- Drop functions
DROP FUNCTION IF EXISTS generate_tech_token();
DROP FUNCTION IF EXISTS generate_tech_pin();
DROP FUNCTION IF EXISTS create_tech_access_link(TEXT);
DROP FUNCTION IF EXISTS validate_tech_access(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS submit_job_proof(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB);
```

---

## Post-Migration: Frontend Integration

The tech proof screen URL pattern:

```
https://jobproof.pro/job/{job_id}/{tech_token}
```

Example:
```
https://jobproof.pro/job/123/ABC456
```

PIN fallback:
```
https://jobproof.pro/job/123?pin=483920
```

---

**MIGRATION SAFE TO DEPLOY AFTER ALL GATES PASS**
