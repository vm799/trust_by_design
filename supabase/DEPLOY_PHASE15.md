# Phase 15: Security-Hardened Schema Migration

## Supabase Project: `ndcjtpzixjbhmzbavqdm`

---

## SUPABASE-SPECIFIC GOTCHAS (READ FIRST!)

### 1. pgcrypto Extension Lives in `extensions` Schema

Supabase installs pgcrypto in the `extensions` schema, **not** `public`. When using `SET search_path = public` in SECURITY DEFINER functions, you MUST prefix pgcrypto calls:

```sql
-- ❌ WRONG (will fail with "function digest does not exist")
v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

-- ✅ CORRECT (explicitly reference extensions schema)
v_token_hash := encode(extensions.digest(v_token::bytea, 'sha256'), 'hex');
```

### 2. Column Names - Use Snake Case

The `jobs` table uses `assigned_technician_id`, **not** `techId`. Always verify column names before writing RLS policies.

### 3. Type Casting Required

Always use explicit type casts in function calls:
- `p_job_id::TEXT`
- `v_token::bytea`

---

## SECURITY AUDIT FIXES IMPLEMENTED

| Issue | Severity | Fix |
|-------|----------|-----|
| Raw tokens stored in DB | CRITICAL | SHA256 hashed only |
| Public table access | CRITICAL | Revoked, RPC only |
| Timing attacks | CRITICAL | Constant-time hash compare |
| Non-atomic operations | HIGH | SECURITY DEFINER stored procs |
| Missing indexes | HIGH | Added for RLS columns |
| Oversized JSONB | HIGH | Storage URLs, not base64 |

---

## MANDATORY SAFETY PROTOCOL

### GATE 1: Backup (REQUIRED FIRST)

```bash
# Link to project
supabase link --project-ref ndcjtpzixjbhmzbavqdm

# Create backup BEFORE any changes
supabase db dump -f backup_security_20260125.sql

# Verify backup created
ls -la backup_security_20260125.sql
```

**CHECKPOINT:** `backup_security_20260125.sql` file exists

---

### GATE 2: Local Test (REQUIRED)

```bash
# Reset local DB and apply all migrations
supabase db reset

# Check migration applied
supabase migration list

# Generate TypeScript types
supabase gen types typescript --local > supabase/types.ts
```

**CHECKPOINT:** No errors in local migration

---

### GATE 3: RLS + Security Verification (REQUIRED)

Run these queries in **Supabase SQL Editor** (NOT psql!):

```sql
-- Test 1: Verify new columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'jobs'
AND column_name LIKE 'tech_%';

-- Expected: tech_token_hash, tech_pin_hash, token_expires_at, token_used, etc.

-- Test 2: Verify indexes exist
SELECT indexname
FROM pg_indexes
WHERE tablename = 'jobs'
AND indexname LIKE 'idx_jobs_%';

-- Expected: idx_jobs_tech_token_hash, idx_jobs_workspace_status, idx_jobs_token_expires

-- Test 3: Verify RPC functions exist
SELECT proname
FROM pg_proc
WHERE proname IN ('generate_tech_access', 'validate_tech_token', 'submit_job_proof', 'get_job_proof_status');

-- Expected: All 4 functions

-- Test 4: Anon cannot directly access jobs
SET ROLE anon;
SELECT count(*) FROM jobs; -- Should return 0 or permission denied
RESET ROLE;

-- Test 5: Anon CAN call validation RPC (NOTE: explicit casts required!)
SELECT * FROM validate_tech_token('nonexistent-id'::TEXT, 'ABCDEF'::TEXT, NULL::TEXT);
-- Expected: Returns (false, NULL) - no error
```

**CHECKPOINT:** All 5 tests pass

---

### GATE 4: Production Migration (SINGLE)

```bash
# Apply ONLY this migration to production
supabase migration up --single

# Verify in Supabase Dashboard:
# 1. Table Editor > jobs > Check new columns
# 2. Database > Functions > Check 4 new functions
```

**CHECKPOINT:** Migration successful, no errors

---

### GATE 5: End-to-End Token Flow

```bash
# 1. Generate tech access link (as authenticated user)
curl -X POST "https://ndcjtpzixjbhmzbavqdm.supabase.co/rest/v1/rpc/generate_tech_access" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"p_job_id": "your-job-id"}'

# Expected: {"raw_token": "ABC123", "raw_pin": "483920", "link_url": "/job/your-job-id/ABC123"}
# NOTE: raw_token is returned ONCE - DB only stores hash!

# 2. Validate token (as anon - simulates technician)
curl -X POST "https://ndcjtpzixjbhmzbavqdm.supabase.co/rest/v1/rpc/validate_tech_token" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_job_id": "your-job-id", "p_raw_token": "ABC123"}'

# Expected: {"is_valid": true, "job_data": {...}}

# 3. Submit proof (as anon)
curl -X POST "https://ndcjtpzixjbhmzbavqdm.supabase.co/rest/v1/rpc/submit_job_proof" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "p_job_id": "your-job-id",
    "p_raw_token": "ABC123",
    "p_before_photo": "https://storage.url/before.jpg",
    "p_after_photo": "https://storage.url/after.jpg",
    "p_client_signature": "https://storage.url/sig.png",
    "p_proof_metadata": {"gps_lat": 51.5074, "gps_lng": -0.1278}
  }'

# Expected: {"success": true, "job_id": "...", "completed_at": "..."}
# NOTE: Token is now INVALIDATED - cannot be reused!

# 4. Verify token invalidated
curl -X POST "https://ndcjtpzixjbhmzbavqdm.supabase.co/rest/v1/rpc/validate_tech_token" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_job_id": "your-job-id", "p_raw_token": "ABC123"}'

# Expected: {"is_valid": false, "job_data": null}
```

**CHECKPOINT:** Token flow works, token invalidated after use

---

## Security Architecture

### Token Flow (Never Stored Raw)

```
1. Manager: generate_tech_access(job_id)
   └─> Returns: {raw_token: "ABC123", raw_pin: "483920"}
   └─> DB stores: SHA256("ABC123"), SHA256("483920")

2. Tech clicks: /job/{id}/ABC123
   └─> Frontend calls: validate_tech_token(id, "ABC123")
   └─> DB compares: SHA256("ABC123") === stored_hash
   └─> Returns: Job data if valid

3. Tech submits: submit_job_proof(id, "ABC123", proof...)
   └─> DB verifies hash, locks row, updates atomically
   └─> Sets token_used = true (invalidates token)
   └─> Writes audit log

4. Reuse attempt: validate_tech_token(id, "ABC123")
   └─> Fails: token_used = true
```

### RLS + RPC Security Model

```
┌─────────────────────────────────────────────────────────────┐
│                        ANON USERS                            │
│  ✗ Cannot SELECT/INSERT/UPDATE/DELETE jobs directly         │
│  ✓ Can call validate_tech_token() RPC                       │
│  ✓ Can call submit_job_proof() RPC                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              SECURITY DEFINER FUNCTIONS                      │
│  - Run with definer (owner) privileges                       │
│  - Hash tokens before any comparison                         │
│  - Use FOR UPDATE to lock rows atomically                    │
│  - Write to audit_logs on success                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   AUTHENTICATED USERS                        │
│  ✓ Can SELECT/INSERT/UPDATE jobs in their workspace         │
│  ✓ Can call generate_tech_access() RPC                       │
│  ✓ Can call get_job_proof_status() RPC                       │
│  (RLS enforces workspace isolation)                          │
└─────────────────────────────────────────────────────────────┘
```

---

## New Columns on `jobs` Table

| Column | Type | Security | Description |
|--------|------|----------|-------------|
| `tech_token_hash` | TEXT | SHA256 | Hash of 6-char token |
| `tech_pin_hash` | TEXT | SHA256 | Hash of 6-digit PIN |
| `token_expires_at` | TIMESTAMPTZ | - | Default 7 days |
| `token_used` | BOOLEAN | - | Invalidates after use |
| `token_used_at` | TIMESTAMPTZ | - | First access time |
| `proof_data` | JSONB | - | GPS, device metadata |
| `before_photo` | TEXT | Storage URL | NOT base64! |
| `after_photo` | TEXT | Storage URL | NOT base64! |
| `client_signature` | TEXT | Storage URL | NOT base64! |
| `proof_completed_at` | TIMESTAMPTZ | - | Submission time |

---

## New Functions

| Function | Accessible By | Purpose |
|----------|---------------|---------|
| `generate_tech_access(job_id)` | authenticated | Creates token, stores hash only |
| `validate_tech_token(job_id, token, pin)` | anon | Validates via hash comparison |
| `submit_job_proof(...)` | anon | Atomic proof submission |
| `get_job_proof_status(job_id)` | authenticated | Manager dashboard status |

---

## Rollback Plan (Emergency Only)

```sql
-- Step 1: Drop functions
DROP FUNCTION IF EXISTS generate_tech_access(TEXT, INTEGER);
DROP FUNCTION IF EXISTS validate_tech_token(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS submit_job_proof(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS get_job_proof_status(TEXT);

-- Step 2: Drop security-critical columns
ALTER TABLE jobs DROP COLUMN IF EXISTS tech_token_hash;
ALTER TABLE jobs DROP COLUMN IF EXISTS tech_pin_hash;
ALTER TABLE jobs DROP COLUMN IF EXISTS token_expires_at;

-- Step 3: Other columns can remain (backward compatible)
-- ALTER TABLE jobs DROP COLUMN IF EXISTS token_used;
-- etc.
```

---

## Post-Migration: Frontend URLs

**Tech proof screen:**
```
https://jobproof.pro/job/{job_id}/{token}
```

**PIN fallback:**
```
https://jobproof.pro/job/{job_id}?pin={pin}
```

---

**MIGRATION SAFE TO DEPLOY AFTER ALL 5 GATES PASS**
