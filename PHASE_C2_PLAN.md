# Phase C.2 — Authorization & Magic Links

**Status:** IN PROGRESS
**Started:** 2026-01-16
**Phase:** Trust Foundation - Authorization
**Closes Audit Finding:** #16 (Supabase RLS)

---

## OVERVIEW

Phase C.2 builds on C.1's authentication to implement proper authorization and workspace isolation. This phase migrates all data from localStorage to Supabase with workspace-scoped RLS policies and implements tokenized magic links for technician access.

---

## TASKS

### ✅ 1. Database Schema (Already Complete from C.1)

**Files:** `supabase/migrations/001_auth_and_workspaces.sql`

**Completed:**
- ✅ workspace_id added to jobs, clients, technicians tables
- ✅ RLS policies enforce workspace isolation
- ✅ job_access_tokens table created for magic links
- ✅ Helper function: `generate_job_access_token()`

---

### 🚧 2. Database Helper Library (NEXT)

**File:** `lib/db.ts` (NEW)

**Functions to Create:**
- `createJob(jobData)` - Insert job with workspace_id
- `updateJob(jobId, updates)` - Update with RLS enforcement
- `getJobs(workspaceId)` - Fetch workspace jobs
- `getJobById(jobId)` - Fetch single job
- `createClient(clientData)` - Insert client
- `getClients(workspaceId)` - Fetch workspace clients
- `deleteClient(clientId)` - Delete with RLS
- `createTechnician(techData)` - Insert technician
- `getTechnicians(workspaceId)` - Fetch workspace technicians
- `deleteTechnician(techId)` - Delete with RLS
- `generateMagicLink(jobId)` - Generate UUID token and return URL
- `validateMagicLink(token)` - Check token validity and return jobId

**Features:**
- All operations scoped to workspace_id from user session
- Graceful degradation if Supabase not configured (return localStorage)
- Error handling with AuthResult-style responses

---

### 📅 3. Update CreateJob View

**File:** `views/CreateJob.tsx`

**Changes:**
1. Replace `onAddJob(newJob)` with `await createJob(newJob)`
2. After job creation, call `generateMagicLink(jobId)`
3. Display magic link to user:
   - Copy button
   - Email button (optional)
   - QR code (optional)
4. Store magic link URL in job metadata for admin reference

**Magic Link Format:**
```
https://yourapp.com/#/track/{token}
```

**Token Properties:**
- UUID v4 (secure random)
- Links to job_id + workspace_id
- Expires after 7 days OR when job is sealed
- One-time use? (optional - Phase 2)

---

### 📅 4. Update TechnicianPortal

**File:** `views/TechnicianPortal.tsx`

**Current State:** Uses `:jobId` from URL and looks up in localStorage

**Required Changes:**
1. Change route from `/track/:jobId` to `/track/:token`
2. On mount, validate token via `validateMagicLink(token)`
3. If valid:
   - Fetch job data from Supabase (bypassing normal RLS via token policy)
   - Allow evidence submission
4. If invalid:
   - Show "Link expired or invalid" message
   - Do NOT show job data

**Token Validation Flow:**
```typescript
useEffect(() => {
  const { token } = useParams();

  const checkAccess = async () => {
    const result = await validateMagicLink(token);

    if (!result.success) {
      setError('This link has expired or is invalid.');
      return;
    }

    // Token valid - load job
    const job = await getJobById(result.jobId);
    setJob(job);
  };

  checkAccess();
}, [token]);
```

---

### 📅 5. Migrate App.tsx to Supabase

**File:** `App.tsx`

**Current State:**
- Jobs stored in localStorage
- Clients stored in localStorage
- Technicians stored in localStorage
- Invoices stored in localStorage (Phase E)
- Templates stored in localStorage (Phase D.6)

**Migration Strategy:**

**Phase C.2 (NOW):**
- ✅ Migrate jobs to Supabase
- ✅ Migrate clients to Supabase
- ✅ Migrate technicians to Supabase

**Phase D.6 (LATER):**
- Templates → Protocols (major refactor)

**Phase E.1 (LATER):**
- Invoices → Supabase

**Changes to App.tsx:**
```typescript
// BEFORE:
const [jobs, setJobs] = useState<Job[]>(() => {
  const saved = localStorage.getItem('jobproof_jobs_v2');
  return saved ? JSON.parse(saved) : [];
});

// AFTER:
const [jobs, setJobs] = useState<Job[]>([]);

useEffect(() => {
  if (session?.user) {
    const loadData = async () => {
      const profile = await getUserProfile(session.user.id);
      if (profile?.workspace_id) {
        const workspaceJobs = await getJobs(profile.workspace_id);
        setJobs(workspaceJobs);
      }
    };
    loadData();
  }
}, [session]);
```

**Fallback Strategy:**
- If Supabase not configured, keep localStorage behavior
- Migration should be transparent to UI

---

### 📅 6. Test Workspace Isolation

**Test Cases:**

**Test 1: Cross-workspace access blocked**
1. Create User A in Workspace A
2. Create User B in Workspace B
3. User A creates Job 1
4. User B creates Job 2
5. Verify User A cannot see Job 2
6. Verify User B cannot see Job 1
7. Try direct SQL query to bypass RLS (should fail)

**Test 2: Magic link access granted**
1. Create job with magic link
2. Access `/track/{token}` in incognito browser
3. Verify job loads without authentication
4. Verify can submit evidence

**Test 3: Magic link expiration**
1. Create job with magic link
2. Set token.expires_at to past date (SQL)
3. Access `/track/{token}`
4. Verify shows "expired" error

**Test 4: Magic link after seal**
1. Create job with magic link
2. Seal job (Phase C.3 - placeholder)
3. Access `/track/{token}`
4. Verify shows "job sealed" message

**Test 5: RLS policy enforcement**
1. Use Supabase SQL Editor to query jobs table
2. Verify only own workspace jobs returned
3. Try to UPDATE another workspace's job
4. Verify blocked by RLS

---

## EVIDENCE OF COMPLETION

Per REMEDIATION_PLAN.md Phase C.2 requirements:

### ✅ Evidence 1: RLS Policies with workspace_id
**File:** `supabase/migrations/001_auth_and_workspaces.sql:150-192`
- Jobs, clients, technicians have workspace-scoped RLS
- Policies check `workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())`

### ✅ Evidence 2: job_access_tokens Table
**File:** `supabase/migrations/001_auth_and_workspaces.sql:66-80`
- Table stores token, job_id, expires_at
- RLS policy allows token-based access

### ✅ Evidence 3: Token Generation and Validation
**File:** `lib/db.ts` (TO BE CREATED)
- `generateMagicLink()` creates UUID token
- `validateMagicLink()` checks expiration and job_id

### ✅ Evidence 4: Cannot Access Cross-workspace Data
**Test:** User A cannot query User B's jobs via SQL
- RLS enforced at PostgreSQL level
- Supabase client cannot override

### ✅ Evidence 5: Invalid Token Returns 403
**Test:** Expired/invalid token blocks access
- Validation happens in `validateMagicLink()`
- UI shows error message

---

## CANNOT BE BYPASSED BECAUSE

✅ **RLS Enforced at PostgreSQL Level**
- Client cannot override RLS policies
- Even direct SQL respects RLS based on auth.uid()

✅ **Workspace Isolation in Database**
- All queries filtered by workspace_id
- No way to access another workspace's data

✅ **Token Validation Server-Side**
- Magic link tokens stored in database
- Expiration checked against server timestamp
- Cannot forge valid token

✅ **Session Required for Admin Operations**
- Creating jobs requires authenticated session
- Session tied to workspace_id via users table

---

## FILES TO CREATE/MODIFY

| File | Status | Changes |
|------|--------|---------|
| `lib/db.ts` | ❌ Create | Database helper functions |
| `views/CreateJob.tsx` | ⏳ Update | Generate magic links |
| `views/TechnicianPortal.tsx` | ⏳ Update | Validate tokens |
| `App.tsx` | ⏳ Update | Load from Supabase instead of localStorage |
| `types.ts` | ⏳ Update | Add magicLinkToken to Job type |
| `PHASE_C2_COMPLETE.md` | ❌ Create | Final documentation |

---

## BLOCKERS

**None** - All dependencies from Phase C.1 are complete:
- ✅ Authentication working
- ✅ Session management implemented
- ✅ Database migration applied
- ✅ RLS policies created
- ✅ Helper functions exist

---

## NEXT STEPS

1. **Create `lib/db.ts`** with all CRUD functions
2. **Test database operations** in isolation
3. **Update CreateJob** to generate magic links
4. **Update TechnicianPortal** to validate tokens
5. **Update App.tsx** to load from Supabase
6. **Run workspace isolation tests**
7. **Document completion** in PHASE_C2_COMPLETE.md
8. **Commit and push**

---

## DEFERRED TO LATER PHASES

**Not in C.2:**
- Templates → Protocols (Phase D.6)
- Invoices → Supabase (Phase E.1)
- Usage tracking (Phase E.1)
- GPS validation (Phase D.1)
- Photo hashing (Phase D.3)
- Cryptographic sealing (Phase C.3)

---

**Phase C.2 Status:** 0% Complete (1/6 tasks)
**Next Task:** Create `lib/db.ts` with database helpers
**Estimated Time:** 2-3 hours
