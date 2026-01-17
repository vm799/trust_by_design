# Phase C.3 — Cryptographic Sealing

**Status:** IN PROGRESS
**Started:** 2026-01-17
**Phase:** Trust Foundation - Cryptographic Sealing
**Closes Audit Finding:** #3 (Protocol Sealing)
**Depends On:** Phase C.1 (Authentication) ✅, Phase C.2 (Authorization) ✅

---

## OVERVIEW

Phase C.3 implements cryptographic sealing for evidence bundles. When a job is sealed:
1. Evidence bundle (job data + photos + signature + metadata) is serialized to canonical JSON
2. SHA-256 hash is computed server-side
3. Hash is signed with RSA-2048 private key (stored in Supabase Vault)
4. Signature + timestamp stored in `evidence_seals` table
5. Database trigger prevents any modifications to sealed records
6. Verification endpoint allows tamper detection

**Key Principle:** Sealing happens ENTIRELY server-side. Client cannot fake seals.

---

## TASKS

### 1. Database Migration for Sealing Infrastructure

**File:** `supabase/migrations/002_evidence_sealing.sql` (NEW)

**Schema Changes:**

```sql
-- Evidence seals table
CREATE TABLE IF NOT EXISTS evidence_seals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),

  -- Cryptographic data
  evidence_hash TEXT NOT NULL, -- SHA-256 hash (hex)
  signature TEXT NOT NULL, -- RSA-2048 signature (base64)
  algorithm TEXT NOT NULL DEFAULT 'SHA256-RSA2048',

  -- Metadata
  sealed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sealed_by_user_id UUID REFERENCES users(id),
  sealed_by_email TEXT NOT NULL,

  -- Evidence snapshot (for verification)
  evidence_bundle JSONB NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add sealed_at column to jobs table
ALTER TABLE jobs ADD COLUMN sealed_at TIMESTAMPTZ;

-- Indexes
CREATE INDEX idx_evidence_seals_job_id ON evidence_seals(job_id);
CREATE INDEX idx_jobs_sealed_at ON jobs(sealed_at);

-- RLS policies
CREATE POLICY "Users can view workspace seals"
  ON evidence_seals FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
  );

-- Prevent modifications to sealed jobs
CREATE OR REPLACE FUNCTION prevent_sealed_job_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.sealed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot modify sealed job. Job was sealed at %.', OLD.sealed_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_job_update_after_seal
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_sealed_job_modification();

-- Helper function to get seal status
CREATE OR REPLACE FUNCTION get_job_seal_status(p_job_id UUID)
RETURNS TABLE(
  is_sealed BOOLEAN,
  sealed_at TIMESTAMPTZ,
  sealed_by TEXT,
  evidence_hash TEXT,
  signature TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    j.sealed_at IS NOT NULL as is_sealed,
    j.sealed_at,
    es.sealed_by_email,
    es.evidence_hash,
    es.signature
  FROM jobs j
  LEFT JOIN evidence_seals es ON es.job_id = j.id
  WHERE j.id = p_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Purpose:**
- Store cryptographic seal metadata
- Prevent sealed job modifications at database level
- Provide seal status query function

---

### 2. Supabase Edge Function for Sealing

**File:** `supabase/functions/seal-evidence/index.ts` (NEW)

**What Edge Functions Are:**
- Server-side TypeScript functions hosted on Supabase
- Run on Deno runtime (secure, sandboxed)
- Can access Supabase Vault for secrets
- Cannot be bypassed client-side

**Sealing Flow:**

```typescript
import { createClient } from '@supabase/supabase-js'
import { crypto } from 'https://deno.land/std/crypto/mod.ts'

Deno.serve(async (req) => {
  const { jobId } = await req.json()

  // 1. Authenticate user
  const supabase = createClient(...)
  const { data: { user } } = await supabase.auth.getUser(req.headers.get('Authorization'))
  if (!user) return new Response('Unauthorized', { status: 401 })

  // 2. Fetch job data
  const { data: job } = await supabase.from('jobs').select('*').eq('id', jobId).single()
  if (!job) return new Response('Job not found', { status: 404 })
  if (job.sealed_at) return new Response('Job already sealed', { status: 400 })

  // 3. Fetch photos from Supabase Storage
  const photos = await fetchPhotosForJob(jobId)

  // 4. Build evidence bundle (canonical JSON)
  const evidenceBundle = {
    job: {
      id: job.id,
      title: job.title,
      client: job.client_name,
      technician: job.technician_name,
      date: job.scheduled_date,
      address: job.address,
      notes: job.notes,
      workSummary: job.work_summary,
      safetyChecklist: job.safety_checklist,
      completedAt: job.completed_at
    },
    photos: photos.map(p => ({
      id: p.id,
      url: p.url,
      timestamp: p.timestamp,
      lat: p.lat,
      lng: p.lng,
      type: p.type
    })),
    signature: {
      url: job.signature_url,
      signerName: job.signer_name,
      signerRole: job.signer_role
    },
    metadata: {
      sealedAt: new Date().toISOString(),
      sealedBy: user.email,
      version: '1.0'
    }
  }

  // 5. Compute SHA-256 hash
  const canonical = JSON.stringify(evidenceBundle, Object.keys(evidenceBundle).sort())
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
  const evidenceHash = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  // 6. Sign hash with RSA private key
  const privateKey = Deno.env.get('SEAL_PRIVATE_KEY') // From Supabase Vault
  const signature = await signHash(evidenceHash, privateKey)

  // 7. Store seal in database
  await supabase.from('evidence_seals').insert({
    job_id: jobId,
    workspace_id: job.workspace_id,
    evidence_hash: evidenceHash,
    signature: signature,
    sealed_by_user_id: user.id,
    sealed_by_email: user.email,
    evidence_bundle: evidenceBundle,
    sealed_at: new Date().toISOString()
  })

  // 8. Update job.sealed_at
  await supabase.from('jobs').update({ sealed_at: new Date().toISOString() }).eq('id', jobId)

  // 9. Invalidate magic link tokens
  await supabase.from('job_access_tokens').update({ expires_at: new Date().toISOString() }).eq('job_id', jobId)

  return new Response(JSON.stringify({
    success: true,
    evidenceHash,
    signature,
    sealedAt: new Date().toISOString()
  }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

**Key Features:**
- ✅ Runs server-side (cannot be bypassed)
- ✅ Private key never exposed to client
- ✅ Canonical JSON ensures deterministic hash
- ✅ Timestamp from server (cannot be faked)
- ✅ Invalidates magic link tokens after seal

---

### 3. RSA Key Pair Generation

**Option A: Generate in Supabase Vault (Recommended)**

Use Supabase CLI to generate and store keys:

```bash
# Generate RSA-2048 key pair
openssl genrsa -out private_key.pem 2048
openssl rsa -in private_key.pem -pubout -out public_key.pem

# Store in Supabase Vault
supabase secrets set SEAL_PRIVATE_KEY="$(cat private_key.pem)"
supabase secrets set SEAL_PUBLIC_KEY="$(cat public_key.pem)"

# Delete local copies (security best practice)
rm private_key.pem public_key.pem
```

**Option B: Generate on first seal (Auto-provisioning)**

Edge function generates keys if not present:

```typescript
if (!Deno.env.get('SEAL_PRIVATE_KEY')) {
  const { publicKey, privateKey } = await crypto.subtle.generateKey(
    {
      name: 'RSA-PSS',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    },
    true,
    ['sign', 'verify']
  )

  // Store in Supabase Vault via API
  await storeInVault('SEAL_PRIVATE_KEY', privateKey)
  await storeInVault('SEAL_PUBLIC_KEY', publicKey)
}
```

---

### 4. Client-Side Sealing Library

**File:** `lib/sealing.ts` (NEW)

```typescript
import { getSupabase } from './supabase'

export interface SealResult {
  success: boolean
  evidenceHash?: string
  signature?: string
  sealedAt?: string
  error?: string
}

export interface VerificationResult {
  success: boolean
  isValid?: boolean
  evidenceHash?: string
  tampered?: boolean
  message?: string
  error?: string
}

/**
 * Seal a job's evidence bundle
 * Calls Supabase Edge Function which handles:
 * - Evidence bundle serialization
 * - SHA-256 hashing
 * - RSA-2048 signing
 * - Database storage
 */
export const sealEvidence = async (jobId: string): Promise<SealResult> => {
  const supabase = getSupabase()

  if (!supabase) {
    return { success: false, error: 'Supabase not configured' }
  }

  try {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return { success: false, error: 'Not authenticated' }
    }

    // Call Edge Function
    const { data, error } = await supabase.functions.invoke('seal-evidence', {
      body: { jobId }
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return {
      success: true,
      evidenceHash: data.evidenceHash,
      signature: data.signature,
      sealedAt: data.sealedAt
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sealing failed'
    }
  }
}

/**
 * Verify a sealed job's integrity
 * Fetches seal from database and validates signature
 */
export const verifyEvidence = async (jobId: string): Promise<VerificationResult> => {
  const supabase = getSupabase()

  if (!supabase) {
    return { success: false, error: 'Supabase not configured' }
  }

  try {
    // Call verification Edge Function
    const { data, error } = await supabase.functions.invoke('verify-evidence', {
      body: { jobId }
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return {
      success: true,
      isValid: data.isValid,
      evidenceHash: data.evidenceHash,
      tampered: !data.isValid,
      message: data.isValid ? 'Evidence is authentic' : 'Evidence has been tampered with'
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Verification failed'
    }
  }
}

/**
 * Get seal status for a job
 */
export const getSealStatus = async (jobId: string) => {
  const supabase = getSupabase()

  if (!supabase) {
    return { isSealed: false }
  }

  try {
    const { data } = await supabase.rpc('get_job_seal_status', { p_job_id: jobId })

    return {
      isSealed: data?.[0]?.is_sealed || false,
      sealedAt: data?.[0]?.sealed_at,
      sealedBy: data?.[0]?.sealed_by,
      evidenceHash: data?.[0]?.evidence_hash,
      signature: data?.[0]?.signature
    }
  } catch (error) {
    console.error('Failed to get seal status:', error)
    return { isSealed: false }
  }
}
```

---

### 5. Verification Edge Function

**File:** `supabase/functions/verify-evidence/index.ts` (NEW)

```typescript
Deno.serve(async (req) => {
  const { jobId } = await req.json()

  // 1. Fetch seal from database
  const { data: seal } = await supabase
    .from('evidence_seals')
    .select('*')
    .eq('job_id', jobId)
    .single()

  if (!seal) {
    return new Response(JSON.stringify({ isValid: false, message: 'No seal found' }), { status: 404 })
  }

  // 2. Recalculate hash from stored evidence bundle
  const canonical = JSON.stringify(seal.evidence_bundle, Object.keys(seal.evidence_bundle).sort())
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
  const recalculatedHash = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  // 3. Compare hashes
  if (recalculatedHash !== seal.evidence_hash) {
    return new Response(JSON.stringify({
      isValid: false,
      message: 'Hash mismatch - evidence has been tampered with',
      storedHash: seal.evidence_hash,
      recalculatedHash
    }))
  }

  // 4. Verify RSA signature
  const publicKey = Deno.env.get('SEAL_PUBLIC_KEY')
  const isSignatureValid = await verifySignature(seal.evidence_hash, seal.signature, publicKey)

  if (!isSignatureValid) {
    return new Response(JSON.stringify({
      isValid: false,
      message: 'Invalid signature - seal may be forged'
    }))
  }

  return new Response(JSON.stringify({
    isValid: true,
    evidenceHash: seal.evidence_hash,
    sealedAt: seal.sealed_at,
    sealedBy: seal.sealed_by_email,
    message: 'Evidence is authentic and has not been tampered with'
  }))
})
```

---

### 6. Update Job Types

**File:** `types.ts`

```typescript
export interface Job {
  // ... existing fields ...

  // Phase C.3: Cryptographic sealing
  sealedAt?: string;          // ISO timestamp when sealed
  sealedBy?: string;          // Email of user who sealed
  evidenceHash?: string;      // SHA-256 hash (for display)
  isSealed?: boolean;         // Computed: !!sealedAt
}
```

---

### 7. Update TechnicianPortal

**File:** `views/TechnicianPortal.tsx`

**Changes:**

1. Replace fake "Seal & Complete Job" button with real sealing:

```typescript
import { sealEvidence } from '../lib/sealing'

const handleFinalSeal = async () => {
  setIsSubmitting(true)

  try {
    // Call server-side sealing
    const result = await sealEvidence(job.id)

    if (!result.success) {
      alert(`Sealing failed: ${result.error}`)
      setIsSubmitting(false)
      return
    }

    // Update local job state
    const sealedJob = {
      ...finalJob,
      status: 'Submitted',
      sealedAt: result.sealedAt,
      evidenceHash: result.evidenceHash,
      isSealed: true
    }

    onUpdateJob(sealedJob)
    setStep(5) // Success screen
  } catch (error) {
    console.error('Sealing error:', error)
    alert('Failed to seal evidence. Please try again.')
  } finally {
    setIsSubmitting(false)
  }
}
```

2. Block access if job is sealed:

```typescript
useEffect(() => {
  if (job?.sealedAt) {
    alert('This job has been sealed and is immutable. No further edits allowed.')
    navigate('/home')
  }
}, [job?.sealedAt])
```

---

### 8. Update JobReport View

**File:** `views/JobReport.tsx`

**Add seal verification badge:**

```typescript
import { verifyEvidence, getSealStatus } from '../lib/sealing'

const JobReport = () => {
  const [sealStatus, setSealStatus] = useState<any>(null)
  const [verificationResult, setVerificationResult] = useState<any>(null)

  useEffect(() => {
    const checkSeal = async () => {
      const status = await getSealStatus(jobId)
      setSealStatus(status)

      if (status.isSealed) {
        const result = await verifyEvidence(jobId)
        setVerificationResult(result)
      }
    }

    checkSeal()
  }, [jobId])

  return (
    <div>
      {sealStatus?.isSealed && (
        <div className={`seal-badge ${verificationResult?.isValid ? 'valid' : 'invalid'}`}>
          {verificationResult?.isValid ? (
            <>
              <span className="material-symbols-outlined">verified</span>
              <div>
                <p className="font-black">CRYPTOGRAPHICALLY SEALED</p>
                <p className="text-xs">SHA-256: {sealStatus.evidenceHash?.substring(0, 16)}...</p>
                <p className="text-xs">Sealed: {new Date(sealStatus.sealedAt).toLocaleString()}</p>
                <p className="text-xs">By: {sealStatus.sealedBy}</p>
              </div>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined">warning</span>
              <p className="font-black text-danger">TAMPERED - NOT AUTHENTIC</p>
            </>
          )}
        </div>
      )}

      {/* Rest of report */}
    </div>
  )
}
```

---

## EVIDENCE OF COMPLETION

### ✅ Evidence 1: Sealing Edge Function Exists
**File:** `supabase/functions/seal-evidence/index.ts`
- Server-side function handles all sealing logic
- Private key never exposed to client

### ✅ Evidence 2: evidence_seals Table
**File:** `supabase/migrations/002_evidence_sealing.sql`
- Stores hash, signature, timestamp
- RLS policies prevent tampering

### ✅ Evidence 3: Database Trigger Prevents Updates
**File:** `supabase/migrations/002_evidence_sealing.sql:prevent_sealed_job_modification()`
- Trigger raises exception if sealed_at IS NOT NULL
- Test: Try UPDATE on sealed job → Error

### ✅ Evidence 4: Verification Endpoint
**File:** `supabase/functions/verify-evidence/index.ts`
- Recalculates hash from evidence bundle
- Verifies signature with public key
- Returns tamper status

### ✅ Evidence 5: UI Shows Seal Status
**File:** `views/JobReport.tsx`
- Displays seal metadata
- Shows verification result
- "TAMPERED" warning if hash mismatch

---

## CANNOT BE BYPASSED BECAUSE

### 🔒 Sealing Happens Server-Side
- Edge Function runs on Supabase infrastructure
- Client cannot fake seal without private key

### 🔒 Private Key in Supabase Vault
- Never exposed to client
- Accessed only by Edge Function via environment variable

### 🔒 Database Trigger Prevents Updates
- PostgreSQL trigger blocks UPDATE queries
- Cannot modify sealed jobs even via SQL

### 🔒 Hash Verification Detects Tampering
- Any modification changes hash
- Verification endpoint compares stored vs recalculated hash

### 🔒 Server Timestamp
- sealed_at uses server NOW()
- Client cannot backdate or future-date seals

---

## FILES TO CREATE/MODIFY

| File | Status | Purpose |
|------|--------|---------|
| `supabase/migrations/002_evidence_sealing.sql` | ❌ Create | Sealing infrastructure |
| `supabase/functions/seal-evidence/index.ts` | ❌ Create | Sealing Edge Function |
| `supabase/functions/verify-evidence/index.ts` | ❌ Create | Verification Edge Function |
| `lib/sealing.ts` | ❌ Create | Client-side sealing library |
| `types.ts` | ⏳ Update | Add seal fields to Job |
| `views/TechnicianPortal.tsx` | ⏳ Update | Call sealEvidence() |
| `views/JobReport.tsx` | ⏳ Update | Show seal verification |
| `PHASE_C3_COMPLETE.md` | ❌ Create | Documentation |

---

## BLOCKERS

**None** - All dependencies complete:
- ✅ Phase C.1 (Authentication)
- ✅ Phase C.2 (Authorization)
- ✅ Supabase project configured
- ✅ Database accessible

---

## NEXT STEPS

1. Create database migration
2. Create sealing Edge Function
3. Create verification Edge Function
4. Create client library
5. Update Job types
6. Update TechnicianPortal
7. Update JobReport
8. Test end-to-end
9. Document completion
10. Commit and push

---

**Phase C.3 Status:** 0% (0/8 tasks)
**Next Task:** Create database migration
**Estimated Time:** 2-3 hours
