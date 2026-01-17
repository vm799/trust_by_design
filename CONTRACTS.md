# API CONTRACTS
**Trust by Design - JobProof**
**Version:** 1.0.0
**Last Updated:** 2026-01-17
**Status:** Foundation Verified (Phases C.1-C.5)

---

## OVERVIEW

This document defines all API contracts between the frontend and backend systems:
- **Supabase RPC Functions** (PostgreSQL stored procedures)
- **Supabase Edge Functions** (Deno serverless functions)
- **Database Schemas** (Tables, columns, constraints)
- **CRUD Operations** (via lib/db.ts, lib/auth.ts, lib/sealing.ts, lib/audit.ts)

**Contract Principles:**
1. **Request/Response Shapes** — All types defined in TypeScript
2. **Error Handling** — All operations return `{ success: boolean, data?, error? }`
3. **Workspace Isolation** — All queries scoped by `workspace_id` via RLS
4. **Immutability** — Sealed evidence cannot be modified (enforced by triggers)
5. **Audit Trail** — All mutations logged to `audit_logs` table

---

## 1. SUPABASE RPC FUNCTIONS

RPC functions are PostgreSQL stored procedures called via `supabase.rpc(name, params)`.

### 1.1 `create_workspace_with_owner`

**Purpose:** Create new workspace and owner user profile during sign-up.

**Signature:**
```sql
CREATE OR REPLACE FUNCTION create_workspace_with_owner(
  p_user_id UUID,
  p_email TEXT,
  p_workspace_name TEXT,
  p_workspace_slug TEXT,
  p_full_name TEXT DEFAULT NULL
) RETURNS UUID
```

**Request:**
```typescript
{
  p_user_id: string;        // UUID from auth.users.id
  p_email: string;          // User email
  p_workspace_name: string; // Display name (e.g., "Acme Inc")
  p_workspace_slug: string; // URL-safe slug (e.g., "acme-inc-1705442234")
  p_full_name?: string;     // Optional full name
}
```

**Response:**
```typescript
UUID // workspace_id
```

**Errors:**
- `23505` — Duplicate slug (slug already exists)
- `23503` — Foreign key violation (user_id not in auth.users)

**Example:**
```typescript
const { data: workspaceId, error } = await supabase.rpc('create_workspace_with_owner', {
  p_user_id: authData.user.id,
  p_email: 'owner@example.com',
  p_workspace_name: 'Acme Inc',
  p_workspace_slug: 'acme-inc-1705442234',
  p_full_name: 'John Doe'
});
```

**Used In:** `lib/auth.ts:66` (signUp function)

---

### 1.2 `generate_job_access_token`

**Purpose:** Generate UUID magic link token for technician job access.

**Signature:**
```sql
CREATE OR REPLACE FUNCTION generate_job_access_token(
  p_job_id TEXT,
  p_granted_by_user_id UUID,
  p_granted_to_email TEXT DEFAULT NULL,
  p_expires_in_days INTEGER DEFAULT 7
) RETURNS TEXT
```

**Request:**
```typescript
{
  p_job_id: string;              // Job UUID
  p_granted_by_user_id?: UUID;   // Optional: Who created the link
  p_granted_to_email?: string;   // Optional: Restrict to specific email
  p_expires_in_days?: number;    // Default: 7 days
}
```

**Response:**
```typescript
string // UUID token (e.g., "a1b2c3d4-e5f6-...")
```

**Errors:**
- `23503` — Job not found
- `23503` — User not found

**Example:**
```typescript
const { data: token, error } = await supabase.rpc('generate_job_access_token', {
  p_job_id: '123e4567-e89b-12d3-a456-426614174000'
});

const magicLinkUrl = `${window.location.origin}/#/track/${token}`;
```

**Used In:** `lib/db.ts:798` (generateMagicLink function)

---

### 1.3 `log_audit_event`

**Purpose:** Log audit event to append-only audit_logs table.

**Signature:**
```sql
CREATE OR REPLACE FUNCTION log_audit_event(
  p_workspace_id UUID,
  p_user_id UUID,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id TEXT,
  p_metadata JSONB DEFAULT NULL
) RETURNS UUID
```

**Request:**
```typescript
{
  p_workspace_id: string;    // Workspace UUID
  p_user_id: string;         // User UUID
  p_action: string;          // Action name (e.g., "job_created")
  p_resource_type: string;   // Resource type (e.g., "job")
  p_resource_id: string;     // Resource UUID
  p_metadata?: object;       // Optional additional context
}
```

**Response:**
```typescript
UUID // audit_log_id
```

**Errors:**
- `23503` — Workspace not found
- `23503` — User not found

**Example:**
```typescript
const { data: auditId, error } = await supabase.rpc('log_audit_event', {
  p_workspace_id: 'workspace-uuid',
  p_user_id: 'user-uuid',
  p_action: 'job_created',
  p_resource_type: 'job',
  p_resource_id: 'job-uuid',
  p_metadata: { title: 'Emergency Repair', client: 'Acme Corp' }
});
```

**Used In:** `lib/audit.ts:45` (logAuditEvent function)

---

### 1.4 `get_audit_logs`

**Purpose:** Retrieve audit logs for workspace (paginated).

**Signature:**
```sql
CREATE OR REPLACE FUNCTION get_audit_logs(
  p_workspace_id UUID,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
) RETURNS TABLE(...)
```

**Request:**
```typescript
{
  p_workspace_id: string;
  p_resource_type?: string;  // Optional filter
  p_resource_id?: string;    // Optional filter
  p_limit?: number;          // Default: 100
  p_offset?: number;         // Default: 0
}
```

**Response:**
```typescript
Array<{
  id: string;
  workspace_id: string;
  user_id: string;
  user_email: string;
  action: string;
  resource_type: string;
  resource_id: string;
  metadata: object;
  created_at: string; // ISO 8601
}>
```

**Errors:**
- `23503` — Workspace not found

**Example:**
```typescript
const { data: logs, error } = await supabase.rpc('get_audit_logs', {
  p_workspace_id: 'workspace-uuid',
  p_limit: 50,
  p_offset: 0
});
```

**Used In:** `lib/audit.ts:115` (getAuditLogs function)

---

## 2. SUPABASE EDGE FUNCTIONS

Edge Functions are Deno serverless functions deployed to Supabase Edge Network.

### 2.1 `seal-evidence`

**Purpose:** Cryptographically seal job evidence bundle (server-side only).

**Endpoint:** `POST https://<project-ref>.supabase.co/functions/v1/seal-evidence`

**Authentication:** Required (Bearer token in Authorization header)

**Request:**
```typescript
POST /functions/v1/seal-evidence
Content-Type: application/json
Authorization: Bearer <supabase-anon-key>

{
  "jobId": "uuid-string"
}
```

**Response (Success):**
```typescript
{
  "success": true,
  "evidenceHash": "a1b2c3...", // SHA-256 hash (64 hex chars)
  "signature": "base64-encoded-signature",
  "algorithm": "SHA256-HMAC", // or "SHA256-RSA2048" in production
  "sealedAt": "2026-01-17T12:34:56.789Z",
  "sealedBy": "user@example.com"
}
```

**Response (Error):**
```typescript
{
  "error": "Error message",
  "details": "Additional error details"
}
```

**HTTP Status Codes:**
- `200` — Success
- `400` — Missing jobId parameter
- `401` — Not authenticated
- `403` — Access denied (not in workspace)
- `404` — Job not found
- `409` — Job already sealed
- `500` — Server error

**Behavior:**
1. Authenticate user via Authorization header
2. Fetch job from database (with RLS enforcement)
3. Build evidence bundle (job + photos + signature + metadata)
4. Compute SHA-256 hash of canonical JSON
5. Sign hash with HMAC-SHA256 (or RSA-2048 in production)
6. Insert seal record into `evidence_seals` table
7. Update `jobs.sealed_at` timestamp
8. Invalidate magic link tokens (via trigger)
9. Return hash + signature

**Side Effects:**
- Creates row in `evidence_seals` table
- Updates `jobs.sealed_at` column
- Sets `jobs.status` to "Submitted"
- Triggers invalidate magic link tokens
- Logs audit event (via database trigger)

**Immutability:**
- After sealing, job CANNOT be modified (enforced by trigger `prevent_job_update_after_seal`)
- Evidence bundle stored in `evidence_seals.evidence_bundle` (JSONB) for verification

**Example:**
```typescript
const { data, error } = await supabase.functions.invoke('seal-evidence', {
  body: { jobId: 'job-uuid' }
});

if (data.success) {
  console.log('Sealed:', data.evidenceHash);
}
```

**Used In:** `lib/sealing.ts:78` (sealEvidence function)

**File:** `supabase/functions/seal-evidence/index.ts`

---

### 2.2 `verify-evidence`

**Purpose:** Verify integrity of sealed evidence bundle.

**Endpoint:** `POST https://<project-ref>.supabase.co/functions/v1/verify-evidence`

**Authentication:** Required (Bearer token in Authorization header)

**Request:**
```typescript
POST /functions/v1/verify-evidence
Content-Type: application/json
Authorization: Bearer <supabase-anon-key>

{
  "jobId": "uuid-string"
}
```

**Response (Success):**
```typescript
{
  "success": true,
  "isValid": true,
  "evidenceHash": "a1b2c3...",
  "algorithm": "SHA256-HMAC",
  "sealedAt": "2026-01-17T12:34:56.789Z",
  "sealedBy": "user@example.com",
  "message": "Evidence seal is valid and untampered",
  "verification": {
    "hashMatch": true,
    "signatureValid": true,
    "timestamp": "2026-01-17T14:00:00.000Z"
  }
}
```

**Response (Tampered):**
```typescript
{
  "success": true,
  "isValid": false,
  "message": "TAMPERED: Evidence hash does not match seal",
  "verification": {
    "hashMatch": false,
    "signatureValid": true,
    "timestamp": "2026-01-17T14:00:00.000Z"
  }
}
```

**Response (Error):**
```typescript
{
  "error": "Error message",
  "details": "Additional error details"
}
```

**HTTP Status Codes:**
- `200` — Success (verification complete, check `isValid` field)
- `400` — Missing jobId parameter
- `401` — Not authenticated
- `403` — Access denied
- `404` — Job not sealed
- `500` — Server error

**Behavior:**
1. Fetch sealed evidence bundle from `evidence_seals` table
2. Fetch current job data from `jobs` table
3. Rebuild evidence bundle from current data
4. Compute SHA-256 hash of rebuilt bundle
5. Compare hash to stored hash
6. Verify signature (HMAC or RSA)
7. Return validation result

**Example:**
```typescript
const { data, error } = await supabase.functions.invoke('verify-evidence', {
  body: { jobId: 'job-uuid' }
});

if (data.isValid) {
  console.log('Evidence is authentic');
} else {
  console.error('TAMPERED:', data.message);
}
```

**Used In:** `lib/sealing.ts:159` (verifyEvidence function)

**File:** `supabase/functions/verify-evidence/index.ts`

---

## 3. DATABASE SCHEMAS

All tables use UUID primary keys and include RLS (Row Level Security).

### 3.1 `workspaces`

**Purpose:** Multi-tenant workspace isolation.

**Schema:**
```sql
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  subscription_tier TEXT DEFAULT 'free', -- free, pro, team, enterprise
  subscription_status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS Policies:**
- `Users can view own workspace` — SELECT allowed if user belongs to workspace
- `Owners can update own workspace` — UPDATE allowed if user.role = 'owner'

**Indexes:**
- `idx_workspaces_slug` on `slug`

---

### 3.2 `users`

**Purpose:** User profiles extending auth.users with workspace membership.

**Schema:**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'member', -- owner, admin, member, technician
  identity_level TEXT NOT NULL DEFAULT 'account', -- account, verified, kyc
  mfa_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_sign_in_at TIMESTAMPTZ
);
```

**RLS Policies:**
- `Users can view workspace members` — SELECT allowed if same workspace_id
- `Users can update own profile` — UPDATE allowed if id = auth.uid()

**Indexes:**
- `idx_users_workspace` on `workspace_id`
- `idx_users_email` on `email`
- `idx_users_role` on `role`

---

### 3.3 `jobs`

**Purpose:** Field service jobs with evidence capture.

**Schema:**
```sql
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_technician_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Job details
  title TEXT NOT NULL,
  client_name TEXT,
  client_id UUID REFERENCES clients(id),
  technician_name TEXT,
  technician_id UUID,
  status TEXT NOT NULL, -- Pending, In Progress, Submitted, Approved
  scheduled_date TEXT,
  address TEXT,
  lat FLOAT,
  lng FLOAT,
  w3w TEXT, -- What3Words address

  -- Work details
  notes TEXT,
  work_summary TEXT,
  safety_checklist JSONB,
  site_hazards TEXT[],

  -- Evidence
  photos JSONB, -- Array of photo objects
  signature_url TEXT,
  signer_name TEXT,
  signer_role TEXT,

  -- Sealing (Phase C.3)
  sealed_at TIMESTAMPTZ, -- NULL = unsealed

  -- Metadata
  template_id TEXT,
  price FLOAT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS Policies:**
- `Workspace members can view jobs` — SELECT allowed if same workspace_id
- `Workspace members can create jobs` — INSERT allowed
- `Workspace members can update unsealed jobs` — UPDATE allowed if sealed_at IS NULL
- `Cannot update sealed jobs` — Enforced by trigger `prevent_job_update_after_seal`

**Triggers:**
- `prevent_job_update_after_seal` — BEFORE UPDATE, raises exception if sealed_at IS NOT NULL
- `prevent_job_delete_after_seal` — BEFORE DELETE, raises exception if sealed_at IS NOT NULL

**Indexes:**
- `idx_jobs_workspace` on `workspace_id`
- `idx_jobs_created_by` on `created_by_user_id`
- `idx_jobs_assigned` on `assigned_technician_id`

---

### 3.4 `clients`

**Purpose:** Customer/client records.

**Schema:**
```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS Policies:**
- `Workspace members can view clients` — SELECT allowed if same workspace_id
- `Workspace members can manage clients` — INSERT/UPDATE/DELETE allowed

**Indexes:**
- `idx_clients_workspace` on `workspace_id`

---

### 3.5 `technicians`

**Purpose:** Field technician records.

**Schema:**
```sql
CREATE TABLE technicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS Policies:**
- `Workspace members can view technicians` — SELECT allowed if same workspace_id
- `Workspace members can manage technicians` — INSERT/UPDATE/DELETE allowed

**Indexes:**
- `idx_technicians_workspace` on `workspace_id`
- `idx_technicians_user` on `user_id`

---

### 3.6 `job_access_tokens`

**Purpose:** Magic link tokens for technician job access.

**Schema:**
```sql
CREATE TABLE job_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  granted_to_email TEXT,
  granted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  first_used_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS Policies:**
- `Anyone can validate tokens` — SELECT allowed (token validation needs public access)
- `Workspace members can create tokens` — INSERT allowed if job belongs to workspace

**Indexes:**
- `idx_tokens_job` on `job_id`
- `idx_tokens_token` on `token`
- `idx_tokens_expires` on `expires_at`

---

### 3.7 `evidence_seals`

**Purpose:** Cryptographic seals for evidence bundles.

**Schema:**
```sql
CREATE TABLE evidence_seals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  evidence_hash TEXT NOT NULL CHECK (evidence_hash ~ '^[a-f0-9]{64}$'),
  signature TEXT NOT NULL CHECK (length(signature) > 0),
  algorithm TEXT NOT NULL DEFAULT 'SHA256-RSA2048',
  sealed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sealed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  sealed_by_email TEXT NOT NULL,
  evidence_bundle JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS Policies:**
- `Workspace members can view seals` — SELECT allowed if same workspace_id
- `Cannot modify seals` — UPDATE/DELETE not allowed (immutable)

**Constraints:**
- `valid_hash_format` — Hash must be 64 lowercase hex characters
- `valid_signature_format` — Signature must be non-empty

**Indexes:**
- `idx_evidence_seals_job_id` on `job_id`
- `idx_evidence_seals_workspace_id` on `workspace_id`
- `idx_evidence_seals_sealed_at` on `sealed_at DESC`

---

### 3.8 `audit_logs`

**Purpose:** Append-only audit trail for compliance.

**Schema:**
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email TEXT,
  ip_address INET,
  user_agent TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS Policies:**
- `Workspace admins can view audit logs` — SELECT allowed if user.role IN ('owner', 'admin')
- `Audit logs cannot be deleted` — DELETE policy: `USING (false)`
- `Audit logs cannot be updated` — UPDATE policy: `USING (false)`

**Triggers:**
- Database triggers auto-log job CREATE/UPDATE/DELETE
- Manually call `log_audit_event()` for other events

**Indexes:**
- `idx_audit_workspace` on `workspace_id`
- `idx_audit_user` on `user_id`
- `idx_audit_action` on `action`
- `idx_audit_resource` on `(resource_type, resource_id)`
- `idx_audit_created` on `created_at DESC`

---

## 4. CRUD OPERATIONS

All CRUD operations return typed results with `.success` and `.error` fields.

### 4.1 Jobs

**Create Job:**
```typescript
import { createJob } from './lib/db';

const result = await createJob({
  title: 'Emergency Repair',
  client: 'Acme Corp',
  technician: 'John Doe',
  address: '123 Main St',
  date: '2026-01-20',
  status: 'Pending'
});

if (result.success) {
  console.log('Job created:', result.data.id);
} else {
  console.error('Error:', result.error);
}
```

**Get Jobs (Workspace):**
```typescript
import { getJobs } from './lib/db';

const result = await getJobs(workspaceId);

if (result.success) {
  console.log('Jobs:', result.data); // Job[]
}
```

**Get Job by ID:**
```typescript
import { getJobById } from './lib/db';

const result = await getJobById(jobId);

if (result.success) {
  console.log('Job:', result.data);
}
```

**Update Job:**
```typescript
import { updateJob } from './lib/db';

const result = await updateJob(jobId, {
  status: 'In Progress',
  workSummary: 'Completed diagnostics'
});

if (result.success) {
  console.log('Job updated');
}
```

**Delete Job:**
```typescript
import { deleteJob } from './lib/db';

const result = await deleteJob(jobId);

if (result.success) {
  console.log('Job deleted');
}
```

---

### 4.2 Magic Links

**Generate Magic Link:**
```typescript
import { generateMagicLink } from './lib/db';

const result = await generateMagicLink(jobId);

if (result.success) {
  console.log('Magic link:', result.url);
  console.log('Token:', result.token);
  console.log('Expires:', result.expiresAt);
}
```

**Validate Magic Link:**
```typescript
import { validateMagicLink } from './lib/db';

const result = await validateMagicLink(token);

if (result.success) {
  console.log('Valid token, job:', result.jobId);
} else {
  console.error('Invalid or expired:', result.error);
}
```

**Get Job by Token:**
```typescript
import { getJobByToken } from './lib/db';

const result = await getJobByToken(token);

if (result.success) {
  console.log('Job:', result.data);
}
```

---

### 4.3 Evidence Sealing

**Seal Evidence:**
```typescript
import { sealEvidence } from './lib/sealing';

const result = await sealEvidence(jobId);

if (result.success) {
  console.log('Evidence hash:', result.evidenceHash);
  console.log('Signature:', result.signature);
  console.log('Sealed at:', result.sealedAt);
}
```

**Verify Evidence:**
```typescript
import { verifyEvidence } from './lib/sealing';

const result = await verifyEvidence(jobId);

if (result.success && result.isValid) {
  console.log('Evidence is authentic');
} else {
  console.error('TAMPERED:', result.message);
}
```

**Get Seal Status:**
```typescript
import { getSealStatus } from './lib/sealing';

const result = await getSealStatus(jobId);

if (result.success) {
  if (result.data.isSealed) {
    console.log('Sealed at:', result.data.sealedAt);
    console.log('Hash:', result.data.evidenceHash);
  } else {
    console.log('Not sealed');
  }
}
```

---

### 4.4 Audit Logs

**Log Event:**
```typescript
import { logAuditEvent } from './lib/audit';

await logAuditEvent({
  eventType: 'job_sealed',
  resourceType: 'job',
  resourceId: jobId,
  metadata: {
    evidenceHash: 'abc123...',
    sealedBy: 'user@example.com'
  }
});
```

**Get Audit Logs:**
```typescript
import { getAuditLogs } from './lib/audit';

const result = await getAuditLogs({
  resourceType: 'job',
  resourceId: jobId,
  limit: 50,
  offset: 0
});

if (result.success) {
  console.log('Logs:', result.logs);
  console.log('Total:', result.total);
}
```

---

## 5. ERROR CODES

### 5.1 PostgreSQL Error Codes

| Code | Name | Meaning | Handling |
|------|------|---------|----------|
| `23505` | unique_violation | Duplicate key (e.g., slug exists) | Show user-friendly error |
| `23503` | foreign_key_violation | Referenced record not found | Check FK exists before insert |
| `23514` | check_violation | CHECK constraint failed | Validate data before insert |
| `P0001` | raise_exception | Custom exception (e.g., sealed job) | Show error message to user |

### 5.2 Supabase Auth Error Codes

| Code | Meaning | Handling |
|------|---------|----------|
| `invalid_credentials` | Wrong email/password | Show "Invalid credentials" |
| `email_not_confirmed` | Email verification pending | Show "Check your email" |
| `user_already_exists` | Email already registered | Show "Email already in use" |
| `weak_password` | Password too weak | Show password requirements |

### 5.3 Edge Function HTTP Status Codes

| Status | Meaning | When |
|--------|---------|------|
| `200` | Success | Operation completed successfully |
| `400` | Bad Request | Missing required parameter |
| `401` | Unauthorized | Not authenticated |
| `403` | Forbidden | Authenticated but not authorized |
| `404` | Not Found | Resource doesn't exist |
| `409` | Conflict | Resource already sealed/exists |
| `500` | Server Error | Internal error (log and report) |

---

## 6. TESTING GUIDE

### 6.1 Database Migrations

**Verify migrations deployed:**
```sql
-- Check RLS policies exist
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename IN ('jobs', 'evidence_seals', 'audit_logs');

-- Check triggers exist
SELECT tgname, tgrelid::regclass
FROM pg_trigger
WHERE tgname LIKE '%seal%' OR tgname LIKE '%audit%';

-- Check functions exist
SELECT proname
FROM pg_proc
WHERE proname IN ('create_workspace_with_owner', 'generate_job_access_token', 'log_audit_event');
```

**Test RLS enforcement:**
```typescript
// Create two workspaces, verify isolation
const workspace1 = await createWorkspace('Workspace 1');
const workspace2 = await createWorkspace('Workspace 2');

// Sign in as user1 (workspace1)
await signIn('user1@workspace1.com', 'password');

// Try to access workspace2 job (should fail)
const result = await getJobById(workspace2JobId);
assert(result.success === false); // RLS blocks access
```

### 6.2 Edge Functions

**Deploy functions:**
```bash
supabase functions deploy seal-evidence
supabase functions deploy verify-evidence
```

**Test sealing:**
```typescript
// Create and seal job
const job = await createJob({ title: 'Test Job' });
const seal = await sealEvidence(job.id);

assert(seal.success === true);
assert(seal.evidenceHash.length === 64);
assert(seal.signature.length > 0);

// Verify seal
const verify = await verifyEvidence(job.id);
assert(verify.isValid === true);
```

**Test immutability:**
```typescript
// Seal job
await sealEvidence(jobId);

// Try to update (should fail)
const result = await updateJob(jobId, { status: 'Cancelled' });
assert(result.success === false);
assert(result.error.includes('sealed'));
```

### 6.3 Failure Paths

**Test expired token:**
```typescript
// Mock expired token (expires_at in past)
const result = await validateMagicLink(expiredToken);
assert(result.success === false);
assert(result.error.includes('expired'));
```

**Test network failure:**
```typescript
// Disconnect network, verify localStorage fallback
navigator.onLine = false;

const result = await getJobs(workspaceId);
// Should load from localStorage, not fail
assert(jobs.length > 0);
```

**Test 500 error:**
```typescript
// Mock Supabase 500 response
const result = await createJob(jobData);
assert(result.success === false);
assert(result.error instanceof Error);
```

---

## 7. DEPLOYMENT CHECKLIST

### 7.1 Database

- [ ] Run migrations: `supabase db push`
- [ ] Verify RLS policies created
- [ ] Verify triggers created
- [ ] Verify functions created
- [ ] Test workspace isolation
- [ ] Test sealed job immutability

### 7.2 Edge Functions

- [ ] Deploy seal-evidence: `supabase functions deploy seal-evidence`
- [ ] Deploy verify-evidence: `supabase functions deploy verify-evidence`
- [ ] Set environment variables: `SEAL_SECRET_KEY`
- [ ] Test sealing flow end-to-end
- [ ] Test verification flow end-to-end

### 7.3 Environment Variables

**Supabase Dashboard:**
- `SEAL_SECRET_KEY` — HMAC secret key (or RSA private key path)

**Frontend (.env):**
- `VITE_SUPABASE_URL` — Project URL
- `VITE_SUPABASE_ANON_KEY` — Anon/public key

### 7.4 Production Upgrades

- [ ] Replace HMAC with RSA-2048 (seal-evidence/index.ts:190)
- [ ] Store private key in Supabase Vault (not env var)
- [ ] Generate public key for verification distribution
- [ ] Update algorithm field: `SHA256-RSA2048`
- [ ] Add audit log retention policy (Phase E.2)

---

## 8. VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-17 | Initial contracts for Phases C.1-C.5 |

---

**Document Status:** ✅ Complete
**Next Review:** Before Phase D.1 (GPS Validation)
**Maintainer:** Trust by Design Team
