# DOMAIN ANALYSIS — Truth Extraction
**Date:** 2026-01-17
**Method:** Read-only analysis of existing codebase
**Sources:** types.ts, schema.sql, migrations/*.sql, views/*.tsx, BUSINESS_OVERVIEW.md, REMEDIATION_PLAN.md

---

## 1. ACTORS

### Primary Actors (Human)
- **Admin** — Creates jobs, manages workspace, generates invoices, views all workspace data
- **Technician** — Accesses jobs via magic link, captures photos/signatures, completes safety checklist
- **Client** — Views completed job reports (referenced in BUSINESS_OVERVIEW.md, limited UI implementation)

### Secondary Actors (System)
- **Sync Worker** — Background process that uploads queued photos/signatures from IndexedDB to Supabase Storage
- **Seal Service** — Server-side Edge Function that cryptographically seals evidence bundles
- **Audit Logger** — Database triggers that log all data access/mutations

---

## 2. DOMAIN ENTITIES

### 2.1 Workspace
**Description:** Multi-tenant container for organization data. All other entities belong to exactly one workspace.

**Lifecycle:**
- Create → (name, slug assigned) → Active → UNKNOWN (no deletion mechanism observed)

**Ownership:** System (created during user signup)

**Source:** supabase/migrations/001_auth_and_workspaces.sql:11-23

---

### 2.2 User
**Description:** Authenticated account with workspace membership and role-based permissions.

**Lifecycle:**
- Create → (email verified) → Active → UNKNOWN (deletion mechanism not observed)

**Ownership:** Self + Workspace admin

**Source:**
- types.ts:99-105 (UserProfile interface)
- supabase/migrations/001_auth_and_workspaces.sql:35-55

---

### 2.3 Job
**Description:** Field service work order with evidence capture workflow.

**Lifecycle:**
1. Create → Pending
2. Assign → (technician receives magic link) → In Progress
3. Submit → (technician submits evidence) → Submitted
4. Seal → (optional: admin seals evidence) → IMMUTABLE
5. Archive → Archived
6. UNKNOWN: Can archived jobs be deleted? Not specified.

**Ownership:** Workspace

**Source:**
- types.ts:34-69
- supabase/schema.sql:7-35
- supabase/migrations/001_auth_and_workspaces.sql:140-146

**Fields:** See Section 4.1

---

### 2.4 Photo
**Description:** Evidence image captured during job execution, stored with geolocation metadata.

**Lifecycle:**
1. Capture → (stored in IndexedDB) → Pending sync
2. Upload → (synced to Supabase Storage) → Synced
3. Job Seal → (parent job sealed) → IMMUTABLE
4. UNKNOWN: Can photos be deleted independently? Not specified.

**Ownership:** Job (cascade delete with job)

**Source:**
- types.ts:14-25
- supabase/schema.sql:45-64

---

### 2.5 Client
**Description:** Customer/client organization that receives field service.

**Lifecycle:**
- Create → Active → UNKNOWN (update/delete mechanisms not observed)

**Ownership:** Workspace

**Source:**
- types.ts:82-88
- supabase/schema.sql:89-98
- supabase/migrations/001_auth_and_workspaces.sql:149-150

---

### 2.6 Technician
**Description:** Field worker who performs job site work. May or may not have a User account.

**Lifecycle:**
- Create → Available | On Site | Off Duty → UNKNOWN (status change triggers not observed)

**Ownership:** Workspace

**Source:**
- types.ts:90-97
- supabase/schema.sql:105-114
- supabase/migrations/001_auth_and_workspaces.sql:153-156

**Relationship to User:** Optional (user_id column nullable)

---

### 2.7 SafetyCheck
**Description:** Individual item in job safety checklist (e.g., "PPE worn").

**Lifecycle:**
- Create → (job created) → Unchecked → Checked → (job sealed) → IMMUTABLE

**Ownership:** Job (cascade delete with job)

**Source:**
- types.ts:7-12
- supabase/schema.sql:73-82

---

### 2.8 JobTemplate
**Description:** Reusable protocol template for creating jobs (mentioned but NOT implemented).

**Lifecycle:**
- UNKNOWN

**Ownership:** UNKNOWN

**Source:**
- types.ts:27-32
- REMEDIATION_PLAN.md:81 (marked as incomplete: "Empty defaultTasks")

**ILLUSION:** UI references templates (views/CreateJob.tsx:12) but:
- No database table exists for templates
- Stored only in localStorage
- Not synced to server
- defaultTasks always empty array

---

### 2.9 Invoice
**Description:** Billing document generated from completed job (mentioned but NOT fully implemented).

**Lifecycle:**
- Generate → Draft → Sent → Paid | Overdue → UNKNOWN

**Ownership:** Workspace

**Source:**
- types.ts:71-80
- REMEDIATION_PLAN.md:78 (marked as partial: "CRUD only, no payment")

**ILLUSION:** UI shows invoice generation (views/JobReport.tsx) but:
- No database table exists for invoices
- Stored only in localStorage
- No payment processing integration
- QuickBooks sync marked as "future feature"

---

### 2.10 JobAccessToken
**Description:** Tokenized magic link granting temporary access to specific job.

**Lifecycle:**
1. Generate → (UUID token created) → Active
2. Access → (technician opens link) → First use tracked
3. Expire → (7 days elapsed OR job sealed) → Revoked
4. UNKNOWN: Can tokens be manually revoked? Not observed.

**Ownership:** Workspace

**Source:**
- supabase/migrations/001_auth_and_workspaces.sql:69-89
- lib/db.ts:785-831 (generateMagicLink, validateMagicLink functions)

---

### 2.11 EvidenceSeal
**Description:** Cryptographic seal record making evidence bundle immutable.

**Lifecycle:**
- Create → (evidence hash + signature computed) → PERMANENT (no updates/deletes allowed)

**Ownership:** Workspace

**Source:**
- supabase/migrations/002_evidence_sealing.sql:17-41
- supabase/functions/seal-evidence/index.ts

**Immutability:** Database triggers prevent modification of sealed jobs (see Section 5)

---

### 2.12 AuditLog
**Description:** Append-only record of all data access and mutations.

**Lifecycle:**
- Create → PERMANENT (no updates/deletes allowed)

**Ownership:** Workspace

**Source:**
- supabase/migrations/001_auth_and_workspaces.sql:103-123
- supabase/migrations/003_audit_trail.sql

---

## 3. RELATIONSHIPS

### Workspace
- **Children:**
  - users (1-to-many)
  - jobs (1-to-many)
  - clients (1-to-many)
  - technicians (1-to-many)
  - job_access_tokens (1-to-many, via jobs)
  - evidence_seals (1-to-many, via jobs)
  - audit_logs (1-to-many)

### User
- **Parent:** workspace (many-to-1)
- **Children:** NONE directly (user_id nullable foreign keys on technicians, audit_logs)

### Job
- **Parent:** workspace (many-to-1)
- **Children:**
  - photos (1-to-many, cascade delete)
  - safety_checks (1-to-many, cascade delete)
  - job_access_tokens (1-to-many, UNKNOWN cascade behavior)
  - evidence_seals (1-to-1, cascade delete)
- **References:**
  - client (many-to-1, nullable, TEXT not FK in schema.sql)
  - technician (many-to-1, nullable, TEXT not FK in schema.sql)
  - created_by_user (many-to-1, added in migration 001)
  - assigned_technician_user (many-to-1, added in migration 001)

**INCONSISTENCY:** Job references client/technician by TEXT id in schema.sql but migration 001 adds created_by_user_id/assigned_technician_id UUIDs. Unclear which is authoritative.

### Photo
- **Parent:** job (many-to-1, cascade delete)
- **Children:** NONE

### Client
- **Parent:** workspace (many-to-1)
- **Children:** NONE directly (jobs reference clients by TEXT id, no FK constraint)

### Technician
- **Parent:** workspace (many-to-1)
- **Children:** NONE directly (jobs reference technicians by TEXT id, no FK constraint)
- **Optional link to User:** user_id (many-to-1, nullable)

### SafetyCheck
- **Parent:** job (many-to-1, cascade delete)
- **Children:** NONE

### JobAccessToken
- **Parent:** job (many-to-1, TEXT reference, UNKNOWN cascade)
- **Parent:** workspace (UNKNOWN - not in schema.sql, implied by job relationship)
- **References:** granted_by_user (many-to-1, nullable)

### EvidenceSeal
- **Parent:** job (1-to-1, cascade delete)
- **Parent:** workspace (many-to-1)
- **References:** sealed_by_user (many-to-1, nullable)

### AuditLog
- **Parent:** workspace (many-to-1)
- **References:** user (many-to-1, nullable)
- **References:** resource (many-to-1, polymorphic TEXT reference to any entity)

---

## 4. REQUIRED DATA FIELDS

### 4.1 Job

| Field | Type | Required | Source | Notes |
|-------|------|----------|--------|-------|
| id | UUID/TEXT | Yes | System | INCONSISTENCY: TEXT in schema.sql, UUID in migrations |
| workspace_id | UUID | Yes | System | Added in migration 001 |
| title | Text | Yes | User input | |
| client | Text | Yes | User selection | Client name (copied from client record) |
| clientId | Text/UUID | Yes | User selection | INCONSISTENCY: TEXT in types.ts, no FK in schema |
| technician | Text | Yes | User selection | Technician name (copied from technician record) |
| techId | Text/UUID | Yes | User selection | INCONSISTENCY: TEXT in types.ts, no FK in schema |
| status | Enum | Yes | System | Pending \| In Progress \| Submitted \| Archived |
| date | Text | Yes | System | Created date, format: "16 Jan 2024" (locale-specific) |
| address | Text | No | User input | Job site address |
| lat | Decimal | No | System/Device | GPS latitude |
| lng | Decimal | No | System/Device | GPS longitude |
| w3w | Text | No | System | what3words address (ILLUSION: randomly generated, not real API) |
| notes | Text | No | User input | Job instructions |
| workSummary | Text | No | Technician input | Work performed summary |
| photos | Array | Yes | Technician | Photo[] array (stored as JSONB in migration schema, separate table in schema.sql) |
| signature | Text/null | No | Technician | Signature data URL or storage URL |
| signerName | Text | No | Technician input | Person who signed |
| signerRole | Text | No | Technician input | e.g., "Homeowner" |
| safetyChecklist | Array | Yes | System | SafetyCheck[] array (separate table in schema.sql) |
| siteHazards | Array | No | Technician input | String[] of identified hazards |
| completedAt | Timestamp | No | System | When job submitted |
| templateId | Text | No | User selection | JobTemplate reference (ILLUSION: templates not in DB) |
| syncStatus | Enum | Yes | System | synced \| pending \| failed |
| lastUpdated | Number | Yes | System | Unix timestamp |
| price | Number | No | User input | Job price (currency not specified) |
| magicLinkToken | UUID | No | System | Generated token for magic link |
| magicLinkUrl | Text | No | Derived | Full URL: https://.../#/track/{token} |
| sealedAt | Timestamp | No | System | When evidence sealed (NULL = not sealed) |
| sealedBy | Email | No | System | Email of user who sealed |
| evidenceHash | Text | No | System | SHA-256 hash of evidence bundle |
| isSealed | Boolean | No | Derived | Computed from !!sealedAt |
| created_by_user_id | UUID | No | System | Added in migration 001 |
| assigned_technician_id | UUID | No | System | Added in migration 001 |

**INCONSISTENCY:** Job table has two competing schemas:
- schema.sql: TEXT id, photos as separate table, safety_checks as separate table
- migrations/001: Assumes jobs exists, adds UUID columns for workspace/users
- types.ts: Stores photos/safetyChecklist as arrays in Job object

**UNKNOWN:** Which schema is authoritative? Is schema.sql deprecated?

### 4.2 Photo

| Field | Type | Required | Source | Notes |
|-------|------|----------|--------|-------|
| id | UUID/TEXT | Yes | System | |
| job_id | UUID/TEXT | Yes | System | Parent job reference |
| url | Text | Yes | System | IndexedDB key OR Supabase Storage URL |
| timestamp | Timestamp | Yes | System | Capture time |
| lat | Decimal | No | Device | GPS latitude |
| lng | Decimal | No | Device | GPS longitude |
| w3w | Text | No | System | what3words (ILLUSION: fake) |
| verified | Boolean | Yes | System | Always true (ILLUSION: no verification logic) |
| syncStatus | Enum | Yes | System | synced \| pending \| failed |
| type | Enum | Yes | User selection | Before \| During \| After \| Evidence |
| isIndexedDBRef | Boolean | No | System | True if url is IndexedDB key |

### 4.3 Client

| Field | Type | Required | Source | Notes |
|-------|------|----------|--------|-------|
| id | UUID/TEXT | Yes | System | |
| workspace_id | UUID | Yes | System | Added in migration 001 |
| name | Text | Yes | User input | |
| email | Text | No | User input | |
| phone | Text | No | User input | UNKNOWN: format validation |
| address | Text | No | User input | |
| totalJobs | Number | No | Derived | Count of jobs (ILLUSION: not calculated from DB) |
| created_at | Timestamp | Yes | System | |
| last_updated | Number | No | System | Unix timestamp |

**ILLUSION:** types.ts includes `totalJobs` field but no evidence of automatic calculation from database.

### 4.4 Technician

| Field | Type | Required | Source | Notes |
|-------|------|----------|--------|-------|
| id | UUID/TEXT | Yes | System | |
| workspace_id | UUID | Yes | System | Added in migration 001 |
| user_id | UUID | No | System | Link to User account (nullable) |
| name | Text | Yes | User input | |
| email | Text | No | User input | |
| phone | Text | No | User input | |
| specialty | Text | No | User input | Schema.sql only, not in types.ts |
| status | Enum | No | System | Available \| On Site \| Off Duty (types.ts only, not in schema.sql) |
| rating | Number | No | Derived | types.ts only (ILLUSION: no calculation logic) |
| jobsCompleted | Number | No | Derived | types.ts only (ILLUSION: not calculated from DB) |
| created_at | Timestamp | Yes | System | |
| last_updated | Number | No | System | Unix timestamp |

**ILLUSION:** types.ts includes rating and jobsCompleted but no evidence of automatic calculation.

### 4.5 SafetyCheck

| Field | Type | Required | Source | Notes |
|-------|------|----------|--------|-------|
| id | UUID/TEXT | Yes | System | |
| job_id | UUID/TEXT | Yes | System | Parent job reference |
| label | Text | Yes | System | Checklist item text |
| checked | Boolean | Yes | Technician | Default false |
| required | Boolean | Yes | System | Default true |
| created_at | Timestamp | Yes | System | |

**UNKNOWN:** Are required safety checks enforced before job submission? Code not observed.

### 4.6 User

| Field | Type | Required | Source | Notes |
|-------|------|----------|--------|-------|
| id | UUID | Yes | System | References auth.users(id) |
| workspace_id | UUID | Yes | System | |
| email | Text | Yes | User input | |
| full_name | Text | No | User input | |
| avatar_url | Text | No | User input | |
| role | Enum | Yes | System | owner \| admin \| member \| technician |
| identity_level | Enum | Yes | System | account \| verified \| kyc (default: account) |
| mfa_enabled | Boolean | Yes | User | Default false |
| created_at | Timestamp | Yes | System | |
| updated_at | Timestamp | Yes | System | |
| last_sign_in_at | Timestamp | No | System | |

### 4.7 Workspace

| Field | Type | Required | Source | Notes |
|-------|------|----------|--------|-------|
| id | UUID | Yes | System | |
| name | Text | Yes | User input | Organisation name |
| slug | Text | Yes | System | URL-safe identifier (unique) |
| subscription_tier | Enum | Yes | System | free \| pro \| team \| enterprise (default: free) |
| subscription_status | Enum | Yes | System | active \| cancelled \| suspended (default: active) |
| created_at | Timestamp | Yes | System | |
| updated_at | Timestamp | Yes | System | |

**ILLUSION:** Subscription tiers exist in schema but:
- No payment processing (REMEDIATION_PLAN.md:64 marks as Phase E.1)
- No usage enforcement (REMEDIATION_PLAN.md:65)
- BillingView.tsx shows "Free Beta Access" (Phase C.5 fix)

### 4.8 JobAccessToken

| Field | Type | Required | Source | Notes |
|-------|------|----------|--------|-------|
| id | UUID | Yes | System | |
| job_id | TEXT | Yes | System | INCONSISTENCY: TEXT not UUID |
| token | TEXT | Yes | System | UUID token (unique) |
| granted_to_email | Text | No | User input | Optional: restrict to specific email |
| granted_by_user_id | UUID | No | System | User who created link |
| expires_at | Timestamp | Yes | System | 7 days from creation |
| revoked_at | Timestamp | No | System | Manual revocation timestamp |
| first_used_at | Timestamp | No | System | First access timestamp |
| last_used_at | Timestamp | No | System | Most recent access |
| use_count | Number | Yes | System | Access count (default 0) |
| created_at | Timestamp | Yes | System | |

### 4.9 EvidenceSeal

| Field | Type | Required | Source | Notes |
|-------|------|----------|--------|-------|
| id | UUID | Yes | System | |
| job_id | UUID | Yes | System | UNIQUE constraint (1-to-1) |
| workspace_id | UUID | Yes | System | |
| evidence_hash | TEXT | Yes | System | SHA-256 hash (64 hex chars) |
| signature | TEXT | Yes | System | Base64-encoded signature |
| algorithm | TEXT | Yes | System | SHA256-HMAC or SHA256-RSA2048 |
| sealed_at | Timestamp | Yes | System | |
| sealed_by_user_id | UUID | No | System | |
| sealed_by_email | TEXT | Yes | System | |
| evidence_bundle | JSONB | Yes | System | Snapshot of job+photos+signature+metadata |
| created_at | Timestamp | Yes | System | |

**PARTIAL IMPLEMENTATION:** seal-evidence Edge Function uses HMAC-SHA256 placeholder, not production RSA-2048 (REALITY_AUDIT_REPORT.md:280).

### 4.10 AuditLog

| Field | Type | Required | Source | Notes |
|-------|------|----------|--------|-------|
| id | UUID | Yes | System | |
| workspace_id | UUID | Yes | System | |
| user_id | UUID | No | System | Nullable (some events may not have user) |
| user_email | TEXT | No | System | |
| ip_address | INET | No | System | |
| user_agent | TEXT | No | System | |
| action | TEXT | Yes | System | e.g., "job_created", "evidence_sealed" |
| resource_type | TEXT | Yes | System | e.g., "job", "photo" |
| resource_id | TEXT | Yes | System | Polymorphic reference |
| metadata | JSONB | No | System | Additional context |
| created_at | Timestamp | Yes | System | |

### 4.11 Invoice (NOT IN DATABASE)

**ILLUSION:** Invoice entity exists in types.ts but:
- No database table
- Stored only in localStorage (App.tsx:184)
- No sync to server
- QuickBooks integration marked as "future feature" (REMEDIATION_PLAN.md:122)

| Field | Type | Required | Source | Notes |
|-------|------|----------|--------|-------|
| id | Text | Yes | System | localStorage only |
| jobId | Text | Yes | System | |
| clientId | Text | Yes | System | |
| clientName | Text | Yes | Derived | |
| amount | Number | Yes | User input | |
| status | Enum | Yes | System | Draft \| Sent \| Paid \| Overdue |
| issuedDate | Text | Yes | System | |
| dueDate | Text | Yes | System | |

### 4.12 JobTemplate (NOT IN DATABASE)

**ILLUSION:** JobTemplate entity exists in types.ts but:
- No database table
- Stored only in localStorage (App.tsx:57-63)
- defaultTasks always empty array (REMEDIATION_PLAN.md:81)
- Protocol system marked for future implementation (REMEDIATION_PLAN.md:47)

| Field | Type | Required | Source | Notes |
|-------|------|----------|--------|-------|
| id | Text | Yes | System | localStorage only |
| name | Text | Yes | User input | |
| description | Text | Yes | User input | |
| defaultTasks | Array | Yes | User input | Always [] in practice |

---

## 5. IMMUTABILITY RULES

### 5.1 Evidence Seals (Permanent)
**Trigger:** When admin clicks "Seal Evidence" button.

**What becomes immutable:**
- Evidence seal record itself (INSERT only, no UPDATE/DELETE)
- Evidence bundle snapshot (JSONB) stored in evidence_seal
- Evidence hash (SHA-256)
- Signature (HMAC or RSA)

**Enforcement:**
- RLS policies on evidence_seals table prevent UPDATE/DELETE
- Source: supabase/migrations/002_evidence_sealing.sql:237-243

### 5.2 Sealed Jobs (Permanent)
**Trigger:** When evidence seal is created for job.

**What becomes immutable:**
- Job record (all columns)
- Related photos
- Related safety_checks
- Job cannot be deleted

**Enforcement:**
- Database trigger `prevent_job_update_after_seal` raises exception on UPDATE attempt
- Database trigger `prevent_job_delete_after_seal` raises exception on DELETE attempt
- Source: supabase/migrations/002_evidence_sealing.sql:97-144

**Exception Behavior:**
```sql
RAISE EXCEPTION
  'Cannot modify sealed job (ID: %). Job was sealed at % UTC. Sealed evidence is immutable.',
  OLD.id,
  OLD.sealed_at
USING ERRCODE = 'integrity_constraint_violation';
```

**UNKNOWN:** Can photos/safety_checks be deleted independently even if job is sealed? Triggers only on jobs table observed.

### 5.3 Audit Logs (Permanent)
**Trigger:** Continuous (all data access/mutations).

**What becomes immutable:**
- Audit log records (all columns)

**Enforcement:**
- RLS policy prevents DELETE: `FOR DELETE USING (false)`
- RLS policy prevents UPDATE: `FOR UPDATE USING (false)`
- Source: supabase/migrations/003_audit_trail.sql:143-150

### 5.4 Magic Link Tokens (Revokable)
**Trigger:** 7 days after creation OR job sealed.

**What becomes immutable:**
- Token string (cannot be changed)
- Expiration timestamp (cannot be extended)

**What can change:**
- revoked_at (can be set to revoke manually)
- first_used_at, last_used_at, use_count (usage tracking)

**UNKNOWN:** Automatic revocation on seal not observed in code. Migration mentions trigger but code not found.

---

## 6. ACCESS RULES

### 6.1 Workspace Isolation (RLS)

**Rule:** Users can only access data within their own workspace.

**Enforcement:**
```sql
-- Example from supabase/migrations/001_auth_and_workspaces.sql:190-196
CREATE POLICY "Users can view own workspace"
  ON workspaces FOR SELECT
  USING (
    id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
  );
```

**Applies to:** jobs, clients, technicians, photos, safety_checks, audit_logs, evidence_seals

**Cannot be bypassed:** RLS enforced at PostgreSQL level, Supabase client cannot override.

**EXCEPTION:** Magic link access bypasses auth requirement (see 6.2).

### 6.2 Magic Link Access (Token-based)

**Rule:** Valid token grants read-only access to specific job, regardless of workspace.

**Who can generate:** Workspace members (admins)

**Who can access:** Anyone with token URL (no authentication required)

**Expiration:** 7 days OR job sealed (whichever comes first)

**What can be accessed:**
- Job details (read-only)
- Photos (read-only)
- Safety checklist (can be updated - INCONSISTENCY)
- Signature (can be added - INCONSISTENCY)

**Enforcement:**
- Token validated against job_access_tokens table
- Expiration checked: `NOW() < expires_at AND revoked_at IS NULL`
- Source: lib/db.ts:832-876

**INCONSISTENCY:** Magic link access is described as "read-only" in documentation but TechnicianPortal.tsx allows updating job data (photos, signature, safety checklist).

**UNKNOWN:** Are there separate RLS policies for token-based access? Not observed in migrations.

### 6.3 Role-Based Permissions

**Roles defined:** owner | admin | member | technician

**Observed behaviors:**
- **owner:** Can update workspace settings (supabase/migrations/001_auth_and_workspaces.sql:198-205)
- **admin:** UNKNOWN (no specific policies observed)
- **member:** UNKNOWN (no specific policies observed)
- **technician:** UNKNOWN (no specific policies observed)

**UNKNOWN:** What are the specific permissions for each role? No comprehensive RBAC matrix found.

### 6.4 CRUD Permissions by Entity

#### Jobs
- **Create:** Workspace members (UNKNOWN: all roles or specific roles?)
- **Read:** Workspace members + valid token holders
- **Update:** Workspace members (BEFORE seal), NONE (AFTER seal)
- **Delete:** Workspace members (BEFORE seal), NONE (AFTER seal)

#### Photos
- **Create:** Technicians via magic link, Workspace members
- **Read:** Workspace members + valid token holders
- **Update:** UNKNOWN
- **Delete:** UNKNOWN (possibly cascade with job)

#### Clients
- **Create:** Workspace members
- **Read:** Workspace members
- **Update:** Workspace members
- **Delete:** UNKNOWN

#### Technicians
- **Create:** Workspace members
- **Read:** Workspace members
- **Update:** Workspace members
- **Delete:** UNKNOWN

#### Users
- **Create:** System (via signup flow)
- **Read:** Workspace members (same workspace only)
- **Update:** Self (own profile), UNKNOWN (can admins update other users?)
- **Delete:** UNKNOWN

#### Evidence Seals
- **Create:** Authenticated users (UNKNOWN: any role or admin only?)
- **Read:** Workspace members
- **Update:** NONE (immutable)
- **Delete:** NONE (immutable)

#### Audit Logs
- **Create:** System (automatic via triggers) + manual via lib/audit.ts
- **Read:** Workspace admins (supabase/migrations/003_audit_trail.sql:148)
- **Update:** NONE (immutable)
- **Delete:** NONE (immutable)

#### Job Access Tokens
- **Create:** Workspace members who can access the job
- **Read:** UNKNOWN (public validation endpoint exists: lib/db.ts:832)
- **Update:** System only (revoked_at, usage tracking)
- **Delete:** UNKNOWN

---

## 7. UNKNOWN OR AMBIGUOUS AREAS

### 7.1 Schema Inconsistencies

**Issue:** Two competing database schemas exist:

1. **schema.sql** (175 lines):
   - TEXT primary keys (id, job_id, etc.)
   - Photos as separate table
   - Safety checks as separate table
   - Anonymous RLS policies (allow all access)

2. **migrations/001_auth_and_workspaces.sql** (582 lines):
   - Assumes jobs table exists
   - Adds UUID columns (workspace_id, created_by_user_id, assigned_technician_id)
   - Adds workspace-scoped RLS policies
   - Drops anonymous policies

**Question:** Which schema is authoritative? Is schema.sql deprecated?

**Evidence:** CONTRACTS.md references migration schema as authoritative, but schema.sql still exists.

**Impact:** Cannot determine actual database structure without deployment verification.

---

### 7.2 Job References to Clients/Technicians

**Issue:** Jobs reference clients and technicians in two ways:

1. **TEXT id + name** (schema.sql, types.ts):
   ```typescript
   client: string;      // Name
   clientId: string;    // TEXT id
   technician: string;  // Name
   techId: string;      // TEXT id
   ```

2. **UUID foreign keys** (migration 001):
   ```sql
   created_by_user_id UUID REFERENCES users(id)
   assigned_technician_id UUID REFERENCES users(id)
   ```

**Question:** Are client/technician TEXT ids replaced by UUID user_ids? Or do both coexist?

**Impact:** Unclear whether client/technician records are actually enforced via foreign keys.

---

### 7.3 Photo/Safety Check Storage

**Issue:** Conflicting storage models:

1. **types.ts:** Photos and safetyChecklist stored as arrays in Job object:
   ```typescript
   photos: Photo[];
   safetyChecklist: SafetyCheck[];
   ```

2. **schema.sql:** Photos and safety_checks as separate tables with job_id foreign keys.

3. **migration 002:** Evidence bundle stores photos as JSONB:
   ```sql
   evidence_bundle JSONB NOT NULL
   ```

**Question:** Are photos/safety_checks stored in separate tables OR as JSONB in jobs table OR both?

**Impact:** Unclear how to query photos/safety_checks.

---

### 7.4 Deletion Policies

**Issue:** Deletion behavior not specified for most entities.

**Questions:**
- Can workspaces be deleted?
- Can users be deleted? (GDPR right to erasure?)
- Can clients be deleted? What happens to their jobs?
- Can technicians be deleted? What happens to their jobs?
- Can unsealed jobs be deleted?
- Can photos be deleted independently of jobs?
- Can job access tokens be deleted (vs revoked)?

**Evidence:** Only sealed jobs have explicit deletion prevention (triggers raise exception).

**Impact:** GDPR compliance unclear.

---

### 7.5 Invoice/Template Implementation Status

**Issue:** Invoices and JobTemplates exist in TypeScript types but not in database.

**Questions:**
- Are invoices/templates planned for database migration?
- Should they be removed from types.ts?
- Are they intentionally localStorage-only for beta?

**Evidence:**
- REMEDIATION_PLAN.md:78 marks invoicing as "CRUD only, no payment"
- REMEDIATION_PLAN.md:81 marks templates as "Empty defaultTasks"
- App.tsx stores both in localStorage only

**Impact:** UI references features that aren't persisted server-side.

---

### 7.6 what3words Integration

**Issue:** what3words addresses appear throughout UI but no API integration found.

**Evidence:**
- REMEDIATION_PLAN.md:68: "Random word generator" (fake)
- REMEDIATION_PLAN.md:108-110: Decision required - integrate API or remove feature

**Current behavior:** w3w field populated with random words (ILLUSION).

**Impact:** Users may believe location is verified via what3words when it's not.

---

### 7.7 GPS Validation

**Issue:** GPS coordinates captured but not validated against job address.

**Evidence:**
- REMEDIATION_PLAN.md:62: "No GPS validation" (marked as Phase C.4)
- Photo.verified always true (types.ts:21) despite no verification logic

**Current behavior:** GPS stored but not validated (ILLUSION: "verified" flag always true).

**Impact:** Cannot trust GPS matches job site.

---

### 7.8 Safety Checklist Enforcement

**Issue:** Safety checks have required flag but unclear if enforced.

**Evidence:**
- SafetyCheck.required field exists (types.ts:11)
- No enforcement logic observed in TechnicianPortal.tsx
- REMEDIATION_PLAN.md:79: "Captured but not enforced"

**Question:** Can jobs be submitted with required safety checks unchecked?

**Impact:** Safety compliance may not be enforced.

---

### 7.9 Subscription Enforcement

**Issue:** Subscription tiers exist in workspace table but no usage limits enforced.

**Evidence:**
- REMEDIATION_PLAN.md:64: "Hardcoded 'Enterprise Protocol'" (fixed in Phase C.5)
- REMEDIATION_PLAN.md:65: "No automated deletion" (retention policies)
- BillingView.tsx shows "Free Beta Access" (Phase C.5)

**Questions:**
- Are jobs/month limits enforced?
- Are storage limits enforced?
- Are sealing operations metered?

**Impact:** All users have unlimited access regardless of tier.

---

### 7.10 Signature Binding

**Issue:** Signatures captured but not cryptographically bound to signer identity.

**Evidence:**
- REMEDIATION_PLAN.md:77: "Ink capture only, need to bind to account ID + job"
- Signature stored as canvas data URL or storage URL
- signerName/signerRole are free-text fields

**Question:** How is signer identity verified? Anyone can type any name.

**Impact:** Signatures not legally defensible (no proof of who actually signed).

---

### 7.11 Magic Link Permissions

**Issue:** Documentation claims magic links are read-only, but code allows updates.

**Evidence:**
- BUSINESS_OVERVIEW.md:122: "Technician Opens Link" (implies read-only)
- TechnicianPortal.tsx: Allows uploading photos, adding signature, updating job
- CONTRACTS.md does not specify read-only restriction

**Question:** Are magic links read-only or full edit access?

**Impact:** Security model unclear.

---

### 7.12 Edge Function Deployment Status

**Issue:** seal-evidence and verify-evidence functions exist in code but deployment status unknown.

**Evidence:**
- REALITY_AUDIT_REPORT.md:280: "Edge Functions not deployed"
- FOUNDATION_VERIFICATION_SUMMARY.md: "Deployment pending user execution"

**Questions:**
- Are Edge Functions deployed to production?
- Is sealing functional or still placeholder?
- Is RSA-2048 implemented or still HMAC-SHA256 placeholder?

**Impact:** Cannot verify if sealing actually works.

---

### 7.13 Audit Trail Triggers

**Issue:** Migration 001 creates audit_logs table, Migration 003 creates triggers, but unclear which events are logged.

**Evidence:**
- Migration 001: Table structure only
- Migration 003: Job CRUD triggers mentioned in CONTRACTS.md
- No triggers observed in schema.sql

**Questions:**
- Which events trigger audit logs automatically?
- Which require manual lib/audit.ts calls?
- Are photo/signature access events logged?
- Are magic link access events logged?

**Impact:** Unclear what is actually audited.

---

### 7.14 Multi-Device Sync

**Issue:** IndexedDB used for offline storage, but sync behavior unclear.

**Evidence:**
- BUSINESS_OVERVIEW.md:74: "IndexedDB (Offline Storage)"
- types.ts: syncStatus field (synced | pending | failed)
- db.ts mentioned in BUSINESS_OVERVIEW but sync logic not detailed

**Questions:**
- Can same job be opened on multiple devices simultaneously?
- What happens if two devices modify same job offline?
- Last-write-wins or conflict detection?

**Impact:** Data integrity risk if multiple technicians access same job.

---

### 7.15 Photo Upload Limits

**Issue:** No observed limits on photo count or size.

**Questions:**
- Is there a maximum number of photos per job?
- Is there a maximum photo file size?
- Are photos compressed before upload?

**Evidence:** CreateJob.tsx initializes with empty photos array, no limits observed.

**Impact:** Storage costs unbounded.

---

### 7.16 Time Zone Handling

**Issue:** Timestamps stored but time zone handling unclear.

**Evidence:**
- schema.sql uses TIMESTAMPTZ (time zone aware)
- types.ts uses string timestamps (format unclear)
- Job.date uses locale-specific format: `toLocaleDateString('en-GB')`

**Questions:**
- Are all timestamps UTC?
- How are timestamps displayed to users?
- What time zone is used for magic link expiration?

**Impact:** Timestamp confusion in multi-time-zone deployments.

---

## 8. CONTRADICTIONS DETECTED

### 8.1 Job ID Type Mismatch
- **schema.sql:** `id TEXT PRIMARY KEY`
- **migrations/001:** Assumes UUID (adds FK constraints to UUID columns)
- **types.ts:** `id: string` (could be either)

### 8.2 Photo Storage Dual Model
- **types.ts:** `photos: Photo[]` (array in Job object)
- **schema.sql:** `photos` table with `job_id` FK (separate table)
- **lib/db.ts:** Photos stored as JSONB in evidence_bundle

### 8.3 RLS Policy Conflict
- **schema.sql:** Anonymous access allowed (lines 130-153)
- **migrations/001:** Drops anonymous policies, adds workspace-scoped policies (lines 168-449)

### 8.4 Magic Link Read vs Write
- **BUSINESS_OVERVIEW.md:** Implies read-only access
- **TechnicianPortal.tsx:** Full read-write access (can modify job)

### 8.5 Subscription Status
- **migration 001:** subscription_tier/subscription_status columns exist
- **REMEDIATION_PLAN.md:** Marks subscription as "not implemented" (Phase E.1)
- **BillingView.tsx:** Shows "Free Beta Access" (Phase C.5 fix)

### 8.6 Template Implementation
- **types.ts:** JobTemplate interface exists
- **views/CreateJob.tsx:** References templates prop
- **REMEDIATION_PLAN.md:** "Empty defaultTasks" (not implemented)
- **No database table:** Templates only in localStorage

### 8.7 Photo Verified Flag
- **types.ts:** `verified: boolean` exists on Photo
- **schema.sql:** `verified BOOLEAN DEFAULT true`
- **REMEDIATION_PLAN.md:** "NO verification logic" (always true)

### 8.8 Technician Fields
- **types.ts:** Has `status`, `rating`, `jobsCompleted`
- **schema.sql:** Has `specialty` (not in types.ts)
- **No overlap:** Different field sets entirely

---

## CONCLUSION

This analysis reveals **significant ambiguity** between:
1. **Declared types** (types.ts)
2. **Initial schema** (schema.sql)
3. **Migration schema** (migrations/*.sql)
4. **Implementation status** (REMEDIATION_PLAN.md marks many as incomplete)

**Primary concerns:**
- Schema authority unclear (schema.sql vs migrations)
- Multiple storage models for same entities (photos, safety_checks)
- Many TypeScript fields have no database backing (rating, jobsCompleted, verified)
- Deletion policies completely unspecified
- RBAC matrix incomplete

**Recommendation:** Deployment verification required to determine actual database structure and behavior.
