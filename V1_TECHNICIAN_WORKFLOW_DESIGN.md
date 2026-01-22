# JobProof V1 Technician Workflow Design

**Generated:** 2026-01-22
**Stage:** MLP → UAT
**Objective:** Frictionless, offline-first, audit-proof evidence collection

---

## Executive Summary

This document consolidates the design specifications from all 7 subagents responsible for the V1 technician workflow. The workflow prioritises:

- **Offline-first** operation with local persistence
- **Token-based** access (no login required)
- **Linear but flexible** workflow for field conditions
- **Audit-proof** evidence sealing before transmission
- **Multi-channel dispatch** (email, WhatsApp, QR)

---

## SUBAGENT 1: TechnicianAuthAgent

### Responsibility
- Resolve job token from magic link
- Validate job access (expiry, revoked, date/time-sensitive)
- Gate workflow strictly to assigned job
- Provide token persistence during offline/online switching

### Current Implementation Status

| Feature | Status | File Reference |
|---------|--------|----------------|
| Token generation | ✅ Implemented | `lib/db.ts:generateMagicLink()` |
| Token validation | ✅ Implemented | `lib/db.ts:validateMagicLink()` |
| Expiry check (7 days) | ✅ Implemented | `lib/db.ts:66-86` |
| Revocation check | ✅ Implemented | `job_access_tokens.revoked_at` |
| Sealed job blocking | ✅ Implemented | `TechnicianPortal.tsx:186-191` |
| Offline token caching | ✅ Implemented | IndexedDB persistence |

### Token Validation Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    TOKEN VALIDATION FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  MAGIC LINK RECEIVED                                            │
│  URL: /track/{token}?jobId={jobId}                              │
│        │                                                        │
│        ▼                                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 1. EXTRACT TOKEN                                        │    │
│  │    - From URL path: /track/:token                       │    │
│  │    - Or query param: ?token=xxx                         │    │
│  └─────────────────┬───────────────────────────────────────┘    │
│                    │                                            │
│                    ▼                                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 2. CHECK LOCAL CACHE (Offline Support)                  │    │
│  │    - IndexedDB: jobs table                              │    │
│  │    - Match by token or jobId                            │    │
│  │    - If found AND offline → Use cached job              │    │
│  └─────────────────┬───────────────────────────────────────┘    │
│                    │                                            │
│         ┌─────────┴─────────┐                                   │
│         │                   │                                   │
│    [ONLINE]            [OFFLINE]                                │
│         │                   │                                   │
│         ▼                   ▼                                   │
│  ┌──────────────┐   ┌──────────────┐                           │
│  │ 3a. VALIDATE │   │ 3b. USE      │                           │
│  │ WITH API     │   │ LOCAL CACHE  │                           │
│  └──────┬───────┘   └──────┬───────┘                           │
│         │                   │                                   │
│         ▼                   │                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 4. VALIDATION CHECKS                                    │    │
│  │                                                         │    │
│  │    □ Token exists in job_access_tokens                  │    │
│  │    □ Token not expired (expires_at > NOW)               │    │
│  │    □ Token not revoked (revoked_at IS NULL)             │    │
│  │    □ Job not sealed (sealed_at IS NULL for edits)       │    │
│  │    □ Job date is valid (warn if overdue/future)         │    │
│  │                                                         │    │
│  └─────────────────┬───────────────────────────────────────┘    │
│                    │                                            │
│         ┌─────────┴─────────────────────┐                       │
│         │                               │                       │
│    [VALID]                         [INVALID]                    │
│         │                               │                       │
│         ▼                               ▼                       │
│  ┌──────────────┐               ┌──────────────┐                │
│  │ 5a. GRANT    │               │ 5b. SHOW     │                │
│  │ ACCESS       │               │ ERROR        │                │
│  │              │               │              │                │
│  │ - Load job   │               │ - Expired    │                │
│  │ - Cache      │               │ - Revoked    │                │
│  │   locally    │               │ - Not found  │                │
│  │ - Update     │               │ - Sealed     │                │
│  │   use_count  │               │              │                │
│  └──────────────┘               └──────────────┘                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Token Validation Pseudocode

```typescript
// lib/auth/tokenValidator.ts

interface TokenValidationResult {
  valid: boolean;
  job?: Job;
  error?: 'EXPIRED' | 'REVOKED' | 'NOT_FOUND' | 'SEALED' | 'NETWORK_ERROR';
  isOffline?: boolean;
}

const TOKEN_EXPIRY_DAYS = 7;

async function validateJobToken(token: string): Promise<TokenValidationResult> {
  // 1. Check local cache first (offline support)
  const cachedJob = await getJobFromIndexedDB(token);
  const isOnline = navigator.onLine;

  if (!isOnline && cachedJob) {
    // Offline mode: use cached job
    return {
      valid: true,
      job: cachedJob,
      isOffline: true,
    };
  }

  if (!isOnline && !cachedJob) {
    return {
      valid: false,
      error: 'NETWORK_ERROR',
      isOffline: true,
    };
  }

  // 2. Online validation
  try {
    const { data: tokenRecord, error } = await supabase
      .from('job_access_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (error || !tokenRecord) {
      return { valid: false, error: 'NOT_FOUND' };
    }

    // 3. Check expiry
    if (new Date(tokenRecord.expires_at) < new Date()) {
      return { valid: false, error: 'EXPIRED' };
    }

    // 4. Check revocation
    if (tokenRecord.revoked_at) {
      return { valid: false, error: 'REVOKED' };
    }

    // 5. Fetch job
    const { data: job } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', tokenRecord.job_id)
      .single();

    if (!job) {
      return { valid: false, error: 'NOT_FOUND' };
    }

    // 6. Check if sealed (read-only access if sealed)
    if (job.sealed_at) {
      return {
        valid: true,
        job: { ...job, readOnly: true },
        error: 'SEALED', // Warning, not blocking
      };
    }

    // 7. Update token usage
    await supabase
      .from('job_access_tokens')
      .update({
        use_count: tokenRecord.use_count + 1,
        last_used_at: new Date().toISOString(),
        first_used_at: tokenRecord.first_used_at || new Date().toISOString(),
      })
      .eq('id', tokenRecord.id);

    // 8. Cache job locally
    await cacheJobToIndexedDB(job, token);

    return { valid: true, job };

  } catch (error) {
    // Network error: try local cache
    if (cachedJob) {
      return {
        valid: true,
        job: cachedJob,
        isOffline: true,
      };
    }
    return { valid: false, error: 'NETWORK_ERROR' };
  }
}

// Token persistence during offline/online switching
function persistTokenLocally(token: string, jobId: string): void {
  localStorage.setItem('jobproof_active_token', JSON.stringify({
    token,
    jobId,
    timestamp: Date.now(),
  }));
}

function getPersistedToken(): { token: string; jobId: string } | null {
  const stored = localStorage.getItem('jobproof_active_token');
  if (!stored) return null;

  const { token, jobId, timestamp } = JSON.parse(stored);

  // Clear if older than 7 days
  if (Date.now() - timestamp > TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000) {
    localStorage.removeItem('jobproof_active_token');
    return null;
  }

  return { token, jobId };
}
```

### Edge Cases Handled

| Scenario | Behaviour |
|----------|-----------|
| Token expired | Show "Link expired" with manager contact info |
| Token revoked | Show "Access revoked" message |
| Job already sealed | Allow read-only view, block edits |
| Offline with cached job | Continue workflow with local data |
| Offline without cache | Show "Connect to internet" message |
| Network drops mid-workflow | Auto-switch to offline mode |
| Multiple jobs same token | Invalid - one token per job |

---

## SUBAGENT 2: JobExecutionFlowAgent

### Responsibility
- Implement linear workflow with offline resilience
- Handle field conditions (poor light, network loss)
- Provide visual affordances for completed steps

### Execution Flow Diagram

```
┌────────────────────────────────────────────────────────────────┐
│              TECHNICIAN JOB EXECUTION WORKFLOW                 │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  STEP 0: JOB ASSIGNMENT REVIEW                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Job Title: {title}                                       │  │
│  │ Client: {client_name}                                    │  │
│  │ Address: {address}  [Open in Maps]                       │  │
│  │ Date/Time: {scheduled_date}                              │  │
│  │                                                          │  │
│  │ ⚠️  OVERDUE - 2 days late (if applicable)                │  │
│  │ 📅 SCHEDULED - In 3 hours (if applicable)                │  │
│  │                                                          │  │
│  │ Special Instructions:                                    │  │
│  │ - {notes}                                                │  │
│  │                                                          │  │
│  │ [ACCEPT JOB & START]                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                     │
│                          ▼                                     │
│  STEP 1: SAFETY CHECKLIST                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Complete all safety checks before starting:              │  │
│  │                                                          │  │
│  │ ☑ Personal Protective Equipment (PPE) confirmed         │  │
│  │ ☑ Site hazards identified and mitigated                 │  │
│  │ ☐ Permits and authorisations verified                   │  │
│  │ ☐ Work area clear of bystanders                         │  │
│  │                                                          │  │
│  │ [CONTINUE] ← Disabled until all checked                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                     │
│                          ▼ (Cannot go back)                    │
│  STEP 2: LOCATION VERIFICATION                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ● GPS Active: -33.8688, 151.2093                        │  │
│  │ ● W3W: ///filled.count.soap                             │  │
│  │ ● Accuracy: 5m                                           │  │
│  │                                                          │  │
│  │ [VERIFY LOCATION]                                        │  │
│  │                                                          │  │
│  │ Location doesn't match? [Enter Manually]                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                     │
│                          ▼ (Cannot go back)                    │
│  STEP 3: BEFORE PHOTOS                                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Capture BEFORE photos (minimum 1 required)               │  │
│  │                                                          │  │
│  │ ┌─────────┐ ┌─────────┐ ┌─────────┐                     │  │
│  │ │  📷     │ │  ✓      │ │  +      │                     │  │
│  │ │ Capture │ │ synced  │ │  Add    │                     │  │
│  │ └─────────┘ └─────────┘ └─────────┘                     │  │
│  │                                                          │  │
│  │ Photos: 2 captured, 1 synced, 1 pending                  │  │
│  │                                                          │  │
│  │ 💡 Poor lighting? Enable flash in camera                │  │
│  │                                                          │  │
│  │ [CONTINUE] ← Enabled when 1+ photos captured             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                     │
│                          ▼ (Cannot go back)                    │
│  STEP 4: PERFORM WORK                                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Work in progress...                                      │  │
│  │                                                          │  │
│  │ During Photos (optional):                                │  │
│  │ [CAPTURE DURING PHOTO]                                   │  │
│  │                                                          │  │
│  │ [MARK WORK COMPLETE]                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                     │
│                          ▼ (Cannot go back)                    │
│  STEP 5: AFTER PHOTOS                                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Capture AFTER photos (minimum 1 required)                │  │
│  │                                                          │  │
│  │ ┌─────────┐ ┌─────────┐ ┌─────────┐                     │  │
│  │ │  📷     │ │  ✓      │ │  +      │                     │  │
│  │ │ Capture │ │ synced  │ │  Add    │                     │  │
│  │ └─────────┘ └─────────┘ └─────────┘                     │  │
│  │                                                          │  │
│  │ [CONTINUE]                                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                     │
│                          ▼ (Cannot go back)                    │
│  STEP 6: JOB NOTES                                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Describe the work completed:                             │  │
│  │                                                          │  │
│  │ ┌────────────────────────────────────────────────────┐   │  │
│  │ │ Replaced damaged floorboards in kitchen area.     │   │  │
│  │ │ Sanded and sealed with polyurethane coating.      │   │  │
│  │ │ Allow 24 hours before walking on surface.         │   │  │
│  │ └────────────────────────────────────────────────────┘   │  │
│  │                                                          │  │
│  │ [CONTINUE]                                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                     │
│                          ▼ (Cannot go back)                    │
│  STEP 7: CLIENT SIGNATURE                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Client Sign-Off                                          │  │
│  │                                                          │  │
│  │ Full Name: [_____________________]                       │  │
│  │ Role: [Client/Owner ▼]                                   │  │
│  │                                                          │  │
│  │ ┌────────────────────────────────────────────────────┐   │  │
│  │ │                                                    │   │  │
│  │ │         ✍️ Sign here                               │   │  │
│  │ │                                                    │   │  │
│  │ └────────────────────────────────────────────────────┘   │  │
│  │                                                          │  │
│  │ [Clear]                          [SUBMIT JOB]            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                     │
│                          ▼                                     │
│  STEP 8: SEAL & SEND                                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 🔒 Sealing evidence...                                   │  │
│  │                                                          │  │
│  │ [████████████████████░░░░] 80%                           │  │
│  │                                                          │  │
│  │ ● Photos uploading: 3/4                                  │  │
│  │ ● Signature uploaded: ✓                                  │  │
│  │ ● Evidence hash: pending...                              │  │
│  │                                                          │  │
│  │ ⚠️ Do not close app until complete                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                     │
│                          ▼                                     │
│  STEP 9: SEND REPORT                                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ✅ JOB COMPLETE                                          │  │
│  │                                                          │  │
│  │ Evidence sealed at: 22 Jan 2026, 14:32 AEST              │  │
│  │ Evidence hash: abc123...def456                           │  │
│  │                                                          │  │
│  │ Send report to:                                          │  │
│  │                                                          │  │
│  │ ┌─────────────────────────────────────────────────────┐  │  │
│  │ │ [✓] Manager (john@company.com)         [📧 Email]  │  │  │
│  │ │ [✓] Client (client@example.com)        [📧 Email]  │  │  │
│  │ │ [ ] Client Mobile (+61 412 345 678)    [WhatsApp]  │  │  │
│  │ │ [ ] Generate QR Code                   [QR]        │  │  │
│  │ └─────────────────────────────────────────────────────┘  │  │
│  │                                                          │  │
│  │ [SEND REPORT]                                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                     │
│                          ▼                                     │
│  COMPLETE                                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ✅ Report sent successfully                              │  │
│  │                                                          │  │
│  │ Manager notified: ✓                                      │  │
│  │ Client notified: ✓                                       │  │
│  │                                                          │  │
│  │ [VIEW JOB SUMMARY]  [BACK TO JOBS]                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Workflow State Machine

```typescript
// Workflow step definitions
type WorkflowStep =
  | 'job_review'        // Step 0
  | 'safety_checklist'  // Step 1
  | 'location_verify'   // Step 2
  | 'before_photos'     // Step 3
  | 'work_in_progress'  // Step 4
  | 'after_photos'      // Step 5
  | 'job_notes'         // Step 6
  | 'signature'         // Step 7
  | 'sealing'           // Step 8
  | 'send_report'       // Step 9
  | 'complete';         // Final

interface WorkflowState {
  currentStep: WorkflowStep;
  completedSteps: WorkflowStep[];
  stepData: {
    safetyChecklist: boolean[];
    location: { lat: number; lng: number; w3w?: string };
    beforePhotos: Photo[];
    duringPhotos: Photo[];
    afterPhotos: Photo[];
    notes: string;
    signature: { name: string; role: string; dataUrl: string };
  };
  isOffline: boolean;
  syncStatus: 'idle' | 'syncing' | 'complete' | 'error';
}

// Step validation rules
const stepValidation: Record<WorkflowStep, (state: WorkflowState) => boolean> = {
  job_review: () => true, // Always valid to start
  safety_checklist: (s) => s.stepData.safetyChecklist.every(Boolean),
  location_verify: (s) => Boolean(s.stepData.location.lat && s.stepData.location.lng),
  before_photos: (s) => s.stepData.beforePhotos.length >= 1,
  work_in_progress: () => true, // Technician decision
  after_photos: (s) => s.stepData.afterPhotos.length >= 1,
  job_notes: () => true, // Optional
  signature: (s) => Boolean(s.stepData.signature.name && s.stepData.signature.dataUrl),
  sealing: () => true, // System step
  send_report: () => true, // System step
  complete: () => true,
};
```

### Poor Light Handling

```typescript
// Camera capture with poor light detection
async function capturePhotoWithLightCheck(): Promise<CaptureResult> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: 'environment',
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  });

  // Analyse frame brightness
  const brightness = await analyseFrameBrightness(stream);

  if (brightness < 30) {
    // Poor light detected
    return {
      success: false,
      warning: 'POOR_LIGHT',
      suggestions: [
        'Enable camera flash',
        'Move to brighter area',
        'Use torch/flashlight',
        'Retry capture',
      ],
    };
  }

  // Proceed with capture
  const photo = await captureFrame(stream);
  return { success: true, photo };
}

function analyseFrameBrightness(stream: MediaStream): number {
  const video = document.createElement('video');
  video.srcObject = stream;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  ctx.drawImage(video, 0, 0, 100, 100); // Sample at low res
  const imageData = ctx.getImageData(0, 0, 100, 100);

  // Calculate average brightness (0-255)
  let totalBrightness = 0;
  for (let i = 0; i < imageData.data.length; i += 4) {
    const r = imageData.data[i];
    const g = imageData.data[i + 1];
    const b = imageData.data[i + 2];
    // Luminosity formula
    totalBrightness += (0.299 * r + 0.587 * g + 0.114 * b);
  }

  return totalBrightness / (100 * 100);
}
```

---

## SUBAGENT 3: EvidenceAgent

### Responsibility
- Capture metadata: timestamps, geolocation, device info, W3W
- Attach photos, notes, signature to single job object
- Seal job evidence locally until send
- Prevent edits once sealed
- Provide status flag: pending / sent / failed

### Evidence Data Model

```typescript
// types/evidence.ts

interface Evidence {
  id: string;
  jobId: string;
  workspaceId: string;

  // Photos with full metadata
  photos: EvidencePhoto[];

  // Notes
  notes: string;

  // Signature
  signature: EvidenceSignature;

  // Location baseline
  location: EvidenceLocation;

  // Safety checklist
  safetyChecklist: SafetyCheckItem[];

  // Sealing metadata
  sealedAt?: string;
  evidenceHash?: string;
  sealedBy?: string;

  // Sync status
  syncStatus: 'draft' | 'pending' | 'syncing' | 'synced' | 'failed';
  lastSyncAttempt?: string;
  syncErrors?: string[];
}

interface EvidencePhoto {
  id: string;
  type: 'before' | 'during' | 'after' | 'evidence';

  // Storage reference
  localKey: string;           // IndexedDB key
  remoteUrl?: string;         // Supabase storage URL

  // Metadata
  timestamp: string;          // ISO 8601
  capturedAt: string;         // Human readable

  // Location
  lat?: number;
  lng?: number;
  accuracy?: number;          // Metres
  w3w?: string;               // What3Words address

  // Device info
  deviceInfo: {
    userAgent: string;
    platform: string;
    screenWidth: number;
    screenHeight: number;
  };

  // Integrity
  photoHash: string;          // SHA-256
  hashAlgorithm: 'SHA-256';

  // Sync
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  syncAttempts: number;
}

interface EvidenceSignature {
  name: string;
  role: 'client' | 'manager' | 'agent';
  localKey: string;           // IndexedDB key
  remoteUrl?: string;         // Supabase storage URL
  timestamp: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
}

interface EvidenceLocation {
  lat: number;
  lng: number;
  accuracy: number;
  w3w?: string;
  timestamp: string;
  source: 'gps' | 'manual' | 'cached';
}

interface SafetyCheckItem {
  id: string;
  label: string;
  checked: boolean;
  checkedAt?: string;
}
```

### Local Evidence Sealing Pseudocode

```typescript
// lib/evidence/sealing.ts

interface SealResult {
  success: boolean;
  evidenceHash?: string;
  sealedAt?: string;
  error?: string;
}

async function sealEvidenceLocally(jobId: string): Promise<SealResult> {
  try {
    // 1. Gather all evidence data
    const evidence = await getEvidenceFromIndexedDB(jobId);

    if (!evidence) {
      return { success: false, error: 'Evidence not found' };
    }

    // 2. Validate minimum requirements
    const validation = validateEvidenceCompleteness(evidence);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // 3. Create canonical evidence object (deterministic JSON)
    const canonicalEvidence = createCanonicalEvidence(evidence);

    // 4. Calculate SHA-256 hash of evidence
    const evidenceHash = await calculateEvidenceHash(canonicalEvidence);

    // 5. Create seal record
    const seal: EvidenceSeal = {
      jobId,
      evidenceHash,
      sealedAt: new Date().toISOString(),
      sealedLocally: true,
      photoHashes: evidence.photos.map(p => p.photoHash),
      signatureIncluded: Boolean(evidence.signature),
      locationIncluded: Boolean(evidence.location),
    };

    // 6. Store seal locally
    await storeSealLocally(seal);

    // 7. Mark evidence as sealed (prevent further edits)
    await markEvidenceSealed(jobId, evidenceHash);

    // 8. Queue for upload
    await queueSealForSync(seal);

    return {
      success: true,
      evidenceHash,
      sealedAt: seal.sealedAt,
    };

  } catch (error) {
    console.error('Seal failed:', error);
    return { success: false, error: 'Sealing failed' };
  }
}

function createCanonicalEvidence(evidence: Evidence): string {
  // Sort photos by timestamp for deterministic order
  const sortedPhotos = [...evidence.photos].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Create deterministic object
  const canonical = {
    jobId: evidence.jobId,
    photos: sortedPhotos.map(p => ({
      hash: p.photoHash,
      type: p.type,
      timestamp: p.timestamp,
      location: p.lat && p.lng ? { lat: p.lat, lng: p.lng } : null,
    })),
    notes: evidence.notes,
    signature: evidence.signature ? {
      name: evidence.signature.name,
      role: evidence.signature.role,
      timestamp: evidence.signature.timestamp,
    } : null,
    location: evidence.location,
    safetyChecklist: evidence.safetyChecklist.filter(s => s.checked),
  };

  // JSON.stringify with sorted keys
  return JSON.stringify(canonical, Object.keys(canonical).sort());
}

async function calculateEvidenceHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function validateEvidenceCompleteness(evidence: Evidence): { valid: boolean; error?: string } {
  // At least 1 before photo
  const beforePhotos = evidence.photos.filter(p => p.type === 'before');
  if (beforePhotos.length < 1) {
    return { valid: false, error: 'At least 1 before photo required' };
  }

  // At least 1 after photo
  const afterPhotos = evidence.photos.filter(p => p.type === 'after');
  if (afterPhotos.length < 1) {
    return { valid: false, error: 'At least 1 after photo required' };
  }

  // Signature required
  if (!evidence.signature?.name || !evidence.signature?.localKey) {
    return { valid: false, error: 'Client signature required' };
  }

  // Location required
  if (!evidence.location?.lat || !evidence.location?.lng) {
    return { valid: false, error: 'Location verification required' };
  }

  return { valid: true };
}
```

### Edit Prevention After Seal

```typescript
// Immutability guard
function canEditEvidence(jobId: string): boolean {
  const job = getJobFromCache(jobId);

  if (!job) return false;

  // Sealed jobs are immutable
  if (job.sealedAt) {
    console.warn('Cannot edit sealed job');
    return false;
  }

  // Submitted jobs pending seal are also locked
  if (job.status === 'Submitted') {
    console.warn('Cannot edit submitted job');
    return false;
  }

  return true;
}

// Wrapper for all edit operations
async function updateEvidence(
  jobId: string,
  updates: Partial<Evidence>
): Promise<{ success: boolean; error?: string }> {
  if (!canEditEvidence(jobId)) {
    return {
      success: false,
      error: 'Evidence is sealed and cannot be modified',
    };
  }

  // Proceed with update...
  return await performEvidenceUpdate(jobId, updates);
}
```

---

## SUBAGENT 4: DispatchAgent

### Responsibility
- Trigger sending of job report once sealed
- Allow technician to choose sending method
- Ensure job not marked complete until sending succeeds
- Track sent status per method

### Dispatch Flow Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                    DISPATCH FLOW                               │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  EVIDENCE SEALED                                               │
│        │                                                       │
│        ▼                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ SELECT RECIPIENTS                                       │   │
│  │                                                         │   │
│  │ Manager:                                                │   │
│  │ ☑ john@company.com                    [Email]           │   │
│  │                                                         │   │
│  │ Client:                                                 │   │
│  │ ☑ client@example.com                  [Email]           │   │
│  │ ☐ +61 412 345 678                     [WhatsApp]        │   │
│  │                                                         │   │
│  │ Other:                                                  │   │
│  │ ☐ Generate QR Code for client         [QR]              │   │
│  │ ☐ Add email address                   [+ Add]           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                     │
│                          ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ DISPATCH QUEUE                                          │   │
│  │                                                         │   │
│  │ ┌─────────────────────────────────────────────────────┐ │   │
│  │ │ Email to: john@company.com          ⏳ Sending...   │ │   │
│  │ └─────────────────────────────────────────────────────┘ │   │
│  │ ┌─────────────────────────────────────────────────────┐ │   │
│  │ │ Email to: client@example.com        ✓ Sent         │ │   │
│  │ └─────────────────────────────────────────────────────┘ │   │
│  │ ┌─────────────────────────────────────────────────────┐ │   │
│  │ │ QR Code generated                   ✓ Ready        │ │   │
│  │ └─────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                     │
│                          ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ COMPLETION STATUS                                       │   │
│  │                                                         │   │
│  │ Job marked complete: ✓                                  │   │
│  │ All dispatches successful: ✓                            │   │
│  │                                                         │   │
│  │ [VIEW REPORT]  [SHARE QR]  [DONE]                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Dispatch Methods

```typescript
// lib/dispatch/methods.ts

type DispatchChannel = 'email' | 'whatsapp' | 'qr' | 'sms';

interface DispatchRequest {
  jobId: string;
  channel: DispatchChannel;
  recipient: {
    email?: string;
    phone?: string;
    name?: string;
  };
  reportUrl: string;
}

interface DispatchResult {
  success: boolean;
  channel: DispatchChannel;
  status: 'sent' | 'failed' | 'pending';
  timestamp?: string;
  error?: string;
  deliveryId?: string;
}

// Email dispatch (V1)
async function dispatchViaEmail(request: DispatchRequest): Promise<DispatchResult> {
  const { jobId, recipient, reportUrl } = request;

  if (!recipient.email) {
    return { success: false, channel: 'email', status: 'failed', error: 'No email address' };
  }

  try {
    // Call Supabase Edge Function or Resend API
    const response = await fetch('/api/dispatch/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: recipient.email,
        subject: `Job Report: Job #${jobId.slice(0, 6)}`,
        template: 'job-report',
        data: {
          recipientName: recipient.name,
          reportUrl,
          jobId,
        },
      }),
    });

    if (!response.ok) {
      throw new Error('Email send failed');
    }

    const result = await response.json();

    return {
      success: true,
      channel: 'email',
      status: 'sent',
      timestamp: new Date().toISOString(),
      deliveryId: result.messageId,
    };

  } catch (error) {
    return {
      success: false,
      channel: 'email',
      status: 'failed',
      error: error.message,
    };
  }
}

// WhatsApp dispatch (V2 roadmap)
async function dispatchViaWhatsApp(request: DispatchRequest): Promise<DispatchResult> {
  const { recipient, reportUrl } = request;

  if (!recipient.phone) {
    return { success: false, channel: 'whatsapp', status: 'failed', error: 'No phone number' };
  }

  // Generate WhatsApp deep link
  const message = encodeURIComponent(
    `Your job report is ready: ${reportUrl}`
  );
  const whatsappUrl = `https://wa.me/${recipient.phone}?text=${message}`;

  // Open WhatsApp (mobile) or show link (desktop)
  if (isMobile()) {
    window.location.href = whatsappUrl;
  } else {
    window.open(whatsappUrl, '_blank');
  }

  return {
    success: true,
    channel: 'whatsapp',
    status: 'pending', // User must complete in WhatsApp
    timestamp: new Date().toISOString(),
  };
}

// QR Code generation
async function generateQRCode(request: DispatchRequest): Promise<DispatchResult & { qrDataUrl?: string }> {
  const { reportUrl } = request;

  try {
    // Generate QR using qrcode library
    const QRCode = await import('qrcode');
    const qrDataUrl = await QRCode.toDataURL(reportUrl, {
      width: 256,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    return {
      success: true,
      channel: 'qr',
      status: 'sent',
      timestamp: new Date().toISOString(),
      qrDataUrl,
    };

  } catch (error) {
    return {
      success: false,
      channel: 'qr',
      status: 'failed',
      error: 'QR generation failed',
    };
  }
}
```

### Job Completion Rules

```typescript
// Job is only marked complete when:
function canMarkJobComplete(job: Job, dispatches: DispatchResult[]): boolean {
  // 1. Evidence must be sealed
  if (!job.sealedAt || !job.evidenceHash) {
    return false;
  }

  // 2. At least one dispatch must succeed
  const successfulDispatches = dispatches.filter(d => d.status === 'sent');
  if (successfulDispatches.length === 0) {
    return false;
  }

  // 3. All photos must be synced
  const unsyncedPhotos = job.photos.filter(p => p.syncStatus !== 'synced');
  if (unsyncedPhotos.length > 0) {
    return false;
  }

  return true;
}
```

---

## SUBAGENT 5: OfflineSyncAgent

### Responsibility
- Maintain local storage queue for pending jobs
- Retry send automatically when network available
- Update job ticket status once sent successfully
- Provide clear visual affordance of queued vs sent items

### Offline Queue Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    OFFLINE SYNC ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ INDEXEDDB (Dexie)                                       │    │
│  │                                                         │    │
│  │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │    │
│  │ │ jobs        │ │ queue       │ │ media       │        │    │
│  │ │             │ │             │ │             │        │    │
│  │ │ id          │ │ id (auto)   │ │ id          │        │    │
│  │ │ syncStatus  │ │ type        │ │ jobId       │        │    │
│  │ │ lastUpdated │ │ payload     │ │ dataUrl     │        │    │
│  │ │ ...jobData  │ │ synced      │ │ type        │        │    │
│  │ │             │ │ retryCount  │ │             │        │    │
│  │ │             │ │ createdAt   │ │             │        │    │
│  │ └─────────────┘ └─────────────┘ └─────────────┘        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                          │                                      │
│                          │ Sync Worker                          │
│                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ SYNC STATE MACHINE                                      │    │
│  │                                                         │    │
│  │   ┌────────┐                                            │    │
│  │   │ IDLE   │◄────────────────────────────────┐          │    │
│  │   └───┬────┘                                 │          │    │
│  │       │ Queue has items                      │          │    │
│  │       ▼                                      │          │    │
│  │   ┌────────┐                                 │          │    │
│  │   │ CHECK  │─── Offline ───► Wait for       │          │    │
│  │   │ NETWORK│               network           │          │    │
│  │   └───┬────┘                   │             │          │    │
│  │       │ Online                 │             │          │    │
│  │       ▼                        │             │          │    │
│  │   ┌────────┐                   │             │          │    │
│  │   │ SYNC   │◄──────────────────┘             │          │    │
│  │   │ ITEM   │                                 │          │    │
│  │   └───┬────┘                                 │          │    │
│  │       │                                      │          │    │
│  │   ┌───┴───┐                                  │          │    │
│  │   │       │                                  │          │    │
│  │ Success  Fail                                │          │    │
│  │   │       │                                  │          │    │
│  │   ▼       ▼                                  │          │    │
│  │ Mark    Increment ────► Max retries? ──Yes──►│          │    │
│  │ synced  retry          │                     │          │    │
│  │   │     count          No                    │          │    │
│  │   │       │            │                     │          │    │
│  │   │       │            ▼                     │          │    │
│  │   │       │         Backoff wait ────────────┘          │    │
│  │   │       │                                             │    │
│  │   └───┬───┘                                             │    │
│  │       │                                                 │    │
│  │       ▼                                                 │    │
│  │   Next item in queue ───────────────────────────────────┘    │
│  │                                                              │
│  └──────────────────────────────────────────────────────────────┘
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Offline Queue Management Pseudocode

```typescript
// lib/offline/queueManager.ts

interface QueueItem {
  id: number;
  type: 'UPDATE_JOB' | 'UPLOAD_PHOTO' | 'UPLOAD_SIGNATURE' | 'SEAL_JOB' | 'DISPATCH';
  payload: any;
  synced: boolean;
  retryCount: number;
  maxRetries: number;
  createdAt: number;
  lastAttempt?: number;
  error?: string;
}

const RETRY_DELAYS = [2000, 5000, 15000, 30000, 60000]; // Exponential backoff
const MAX_RETRIES = 5;

class OfflineQueueManager {
  private db: JobProofDatabase;
  private isProcessing = false;
  private networkListener: (() => void) | null = null;

  constructor() {
    this.db = getDatabase();
    this.setupNetworkListener();
    this.startBackgroundSync();
  }

  // Add item to queue
  async queueAction(type: QueueItem['type'], payload: any): Promise<number> {
    const item: Omit<QueueItem, 'id'> = {
      type,
      payload,
      synced: false,
      retryCount: 0,
      maxRetries: MAX_RETRIES,
      createdAt: Date.now(),
    };

    const id = await this.db.queue.add(item);

    // Attempt immediate sync if online
    if (navigator.onLine && !this.isProcessing) {
      this.processQueue();
    }

    return id;
  }

  // Process queue
  async processQueue(): Promise<void> {
    if (this.isProcessing || !navigator.onLine) {
      return;
    }

    this.isProcessing = true;

    try {
      const pendingItems = await this.db.queue
        .where('synced')
        .equals(false)
        .sortBy('createdAt');

      for (const item of pendingItems) {
        // Check if should retry (backoff)
        if (item.lastAttempt) {
          const delay = RETRY_DELAYS[Math.min(item.retryCount, RETRY_DELAYS.length - 1)];
          if (Date.now() - item.lastAttempt < delay) {
            continue; // Skip, not ready for retry
          }
        }

        await this.processItem(item);
      }

    } finally {
      this.isProcessing = false;
    }
  }

  // Process single item
  private async processItem(item: QueueItem): Promise<void> {
    try {
      await this.db.queue.update(item.id, { lastAttempt: Date.now() });

      switch (item.type) {
        case 'UPDATE_JOB':
          await this.syncJobUpdate(item.payload);
          break;
        case 'UPLOAD_PHOTO':
          await this.syncPhotoUpload(item.payload);
          break;
        case 'UPLOAD_SIGNATURE':
          await this.syncSignatureUpload(item.payload);
          break;
        case 'SEAL_JOB':
          await this.syncJobSeal(item.payload);
          break;
        case 'DISPATCH':
          await this.syncDispatch(item.payload);
          break;
      }

      // Success: mark as synced
      await this.db.queue.update(item.id, { synced: true });

      // Notify UI
      this.emitSyncEvent('item_synced', item);

    } catch (error) {
      // Failure: increment retry count
      const newRetryCount = item.retryCount + 1;

      if (newRetryCount >= item.maxRetries) {
        // Max retries reached: mark as failed
        await this.db.queue.update(item.id, {
          retryCount: newRetryCount,
          error: error.message,
          synced: true, // Remove from active queue
        });

        // Move to failed queue for manual intervention
        await this.moveToFailedQueue(item, error.message);

        // Notify UI
        this.emitSyncEvent('item_failed', item);

      } else {
        // Update retry count
        await this.db.queue.update(item.id, {
          retryCount: newRetryCount,
          error: error.message,
        });
      }
    }
  }

  // Network change listener
  private setupNetworkListener(): void {
    this.networkListener = () => {
      if (navigator.onLine) {
        console.log('Network restored, processing queue...');
        this.processQueue();
      }
    };

    window.addEventListener('online', this.networkListener);
  }

  // Background sync (every 30 seconds)
  private startBackgroundSync(): void {
    setInterval(() => {
      if (navigator.onLine && !this.isProcessing) {
        this.processQueue();
      }
    }, 30000);
  }

  // Get queue status for UI
  async getQueueStatus(): Promise<{
    pending: number;
    syncing: number;
    failed: number;
    items: QueueItem[];
  }> {
    const allItems = await this.db.queue.toArray();
    const pending = allItems.filter(i => !i.synced && i.retryCount < i.maxRetries);
    const failed = allItems.filter(i => i.retryCount >= i.maxRetries);

    return {
      pending: pending.length,
      syncing: this.isProcessing ? 1 : 0,
      failed: failed.length,
      items: pending,
    };
  }

  // Event emitter for UI updates
  private emitSyncEvent(event: string, data: any): void {
    window.dispatchEvent(new CustomEvent('jobproof:sync', {
      detail: { event, data },
    }));
  }
}

// Singleton instance
let queueManager: OfflineQueueManager | null = null;

export function getQueueManager(): OfflineQueueManager {
  if (!queueManager) {
    queueManager = new OfflineQueueManager();
  }
  return queueManager;
}
```

### Visual Sync Status Component

```typescript
// components/SyncStatusIndicator.tsx

interface SyncStatusProps {
  jobId?: string;
}

function SyncStatusIndicator({ jobId }: SyncStatusProps) {
  const [status, setStatus] = useState<{
    pending: number;
    syncing: number;
    failed: number;
  }>({ pending: 0, syncing: 0, failed: 0 });

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    // Listen for sync events
    const handleSync = (e: CustomEvent) => {
      refreshStatus();
    };

    window.addEventListener('jobproof:sync', handleSync);
    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));

    refreshStatus();

    return () => {
      window.removeEventListener('jobproof:sync', handleSync);
    };
  }, []);

  const refreshStatus = async () => {
    const queueStatus = await getQueueManager().getQueueStatus();
    setStatus(queueStatus);
  };

  return (
    <div className="sync-status flex items-center gap-2">
      {/* Online/Offline indicator */}
      <div className={`size-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />

      {/* Pending uploads */}
      {status.pending > 0 && (
        <div className="flex items-center gap-1 text-amber-500">
          <span className="material-symbols-outlined text-sm animate-spin">sync</span>
          <span className="text-xs">{status.pending} pending</span>
        </div>
      )}

      {/* Failed uploads */}
      {status.failed > 0 && (
        <button
          onClick={() => retryFailed()}
          className="flex items-center gap-1 text-red-500 hover:text-red-400"
        >
          <span className="material-symbols-outlined text-sm">error</span>
          <span className="text-xs">{status.failed} failed - tap to retry</span>
        </button>
      )}

      {/* All synced */}
      {status.pending === 0 && status.failed === 0 && isOnline && (
        <div className="flex items-center gap-1 text-emerald-500">
          <span className="material-symbols-outlined text-sm">check_circle</span>
          <span className="text-xs">Synced</span>
        </div>
      )}

      {/* Offline banner */}
      {!isOnline && (
        <div className="text-slate-400 text-xs">
          Offline - changes will sync when connected
        </div>
      )}
    </div>
  );
}
```

---

## SUBAGENT 6: UXOptimizationAgent

### Responsibility
- Ensure all input fields are large, mobile-friendly
- Auto-focus next field
- Disable backtracking once step complete
- Ensure continue/submit buttons indicate action
- Handle poor light or camera failures gracefully

### Mobile-First Input Specifications

| Element | Minimum Size | Touch Target | Notes |
|---------|--------------|--------------|-------|
| Text Input | 52px height | 48px x 48px | Large finger-friendly |
| Select | 52px height | 48px x 48px | Dropdown arrow visible |
| Textarea | 120px min | Full width | 4+ rows visible |
| Button (Primary) | 56px height | Full width | Bold, high contrast |
| Button (Secondary) | 48px height | Min 120px | Visible outline |
| Checkbox | 24px x 24px | 48px x 48px | Visible checkmark |
| Photo Capture | 80px x 80px | 80px x 80px | Large camera icon |

### Auto-Focus Flow

```typescript
// hooks/useAutoFocusFlow.ts

interface FocusConfig {
  fieldId: string;
  ref: RefObject<HTMLElement>;
  enabled: boolean;
}

function useAutoFocusFlow(fields: FocusConfig[]) {
  const currentIndex = useRef(0);

  // Auto-focus first enabled field on mount
  useEffect(() => {
    const firstEnabled = fields.find(f => f.enabled);
    if (firstEnabled?.ref.current) {
      setTimeout(() => firstEnabled.ref.current?.focus(), 100);
    }
  }, []);

  // Move to next field
  const focusNext = useCallback(() => {
    const enabledFields = fields.filter(f => f.enabled);
    currentIndex.current = Math.min(
      currentIndex.current + 1,
      enabledFields.length - 1
    );

    const nextField = enabledFields[currentIndex.current];
    if (nextField?.ref.current) {
      nextField.ref.current.focus();
      nextField.ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [fields]);

  // Move to previous field
  const focusPrev = useCallback(() => {
    currentIndex.current = Math.max(currentIndex.current - 1, 0);

    const enabledFields = fields.filter(f => f.enabled);
    const prevField = enabledFields[currentIndex.current];
    if (prevField?.ref.current) {
      prevField.ref.current.focus();
    }
  }, [fields]);

  return { focusNext, focusPrev, currentIndex: currentIndex.current };
}

// Usage example
function JobNotesStep() {
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);

  const { focusNext } = useAutoFocusFlow([
    { fieldId: 'notes', ref: notesRef, enabled: true },
    { fieldId: 'submit', ref: submitRef, enabled: true },
  ]);

  return (
    <div>
      <textarea
        ref={notesRef}
        onKeyDown={(e) => {
          if (e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault();
            focusNext();
          }
        }}
        className="w-full px-5 py-4 min-h-[120px] bg-slate-800 border border-white/10 rounded-xl"
        placeholder="Describe the work completed..."
      />

      <button
        ref={submitRef}
        className="w-full py-4 mt-4 bg-primary text-white rounded-xl font-bold"
      >
        Continue
      </button>
    </div>
  );
}
```

### Backtracking Prevention

```typescript
// hooks/useStepProtection.ts

function useStepProtection(currentStep: number, onBack: () => void) {
  const [showWarning, setShowWarning] = useState(false);

  const handleBack = useCallback(() => {
    // Steps 3+ (after photos started) require confirmation
    if (currentStep >= 3) {
      setShowWarning(true);
    } else {
      onBack();
    }
  }, [currentStep, onBack]);

  const confirmBack = useCallback(() => {
    setShowWarning(false);
    onBack();
  }, [onBack]);

  const cancelBack = useCallback(() => {
    setShowWarning(false);
  }, []);

  return {
    handleBack,
    confirmBack,
    cancelBack,
    showWarning,
  };
}

// Warning modal component
function BacktrackWarningModal({ onConfirm, onCancel }: Props) {
  return (
    <Modal open onClose={onCancel}>
      <div className="p-6 text-center">
        <span className="material-symbols-outlined text-5xl text-amber-500 mb-4">
          warning
        </span>

        <h3 className="text-xl font-bold text-white mb-2">
          Go Back?
        </h3>

        <p className="text-slate-400 mb-6">
          Going back may lose your progress for this step.
          Are you sure you want to continue?
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-slate-700 text-white rounded-xl"
          >
            Stay Here
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 bg-red-500 text-white rounded-xl"
          >
            Go Back
          </button>
        </div>
      </div>
    </Modal>
  );
}
```

### Visual Affordances

```typescript
// Step completion indicators
function StepIndicator({ step, status }: { step: number; status: 'pending' | 'current' | 'complete' }) {
  return (
    <div className={`
      size-10 rounded-full flex items-center justify-center font-bold
      transition-all duration-300
      ${status === 'complete' ? 'bg-emerald-500 text-white scale-110' : ''}
      ${status === 'current' ? 'bg-primary text-white ring-4 ring-primary/30' : ''}
      ${status === 'pending' ? 'bg-slate-700 text-slate-400' : ''}
    `}>
      {status === 'complete' ? (
        <span className="material-symbols-outlined">check</span>
      ) : (
        step
      )}
    </div>
  );
}

// Toast notification for actions
function showActionToast(message: string, type: 'success' | 'error' | 'info') {
  const toast = document.createElement('div');
  toast.className = `
    fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl
    flex items-center gap-3 shadow-2xl z-50 animate-in slide-in-from-bottom
    ${type === 'success' ? 'bg-emerald-500' : ''}
    ${type === 'error' ? 'bg-red-500' : ''}
    ${type === 'info' ? 'bg-primary' : ''}
  `;

  const icon = type === 'success' ? 'check_circle' :
               type === 'error' ? 'error' : 'info';

  toast.innerHTML = `
    <span class="material-symbols-outlined text-white">${icon}</span>
    <span class="text-white font-medium">${message}</span>
  `;

  document.body.appendChild(toast);

  // Haptic feedback on mobile
  if ('vibrate' in navigator) {
    navigator.vibrate(type === 'success' ? [50] : [100, 50, 100]);
  }

  // Remove after 3 seconds
  setTimeout(() => {
    toast.classList.add('animate-out', 'slide-out-to-bottom');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
```

---

## SUBAGENT 7: ReportingAgent

### Responsibility
- Construct final job report object
- Mark job complete only when report successfully transmitted
- Provide audit trail for manager

### Job Report Structure

```typescript
// types/report.ts

interface JobReport {
  // Identification
  reportId: string;
  jobId: string;
  workspaceId: string;

  // Header
  title: string;
  client: {
    name: string;
    email?: string;
    phone?: string;
  };
  technician: {
    name: string;
    email: string;
  };

  // Schedule
  scheduledDate: string;
  completedDate: string;
  duration?: string;

  // Location
  location: {
    address: string;
    lat: number;
    lng: number;
    w3w?: string;
  };

  // Evidence
  safetyChecklist: {
    item: string;
    checked: boolean;
    checkedAt?: string;
  }[];

  photos: {
    type: 'before' | 'during' | 'after';
    url: string;
    timestamp: string;
    location?: { lat: number; lng: number };
    w3w?: string;
  }[];

  notes: string;

  signature: {
    name: string;
    role: string;
    imageUrl: string;
    timestamp: string;
  };

  // Integrity
  evidenceHash: string;
  sealedAt: string;
  sealedBy: string;

  // Audit
  generatedAt: string;
  reportVersion: '1.0';
}
```

### Audit Trail

```typescript
// lib/audit/trail.ts

interface AuditEntry {
  id: string;
  jobId: string;
  action: AuditAction;
  actor: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

type AuditAction =
  | 'JOB_VIEWED'
  | 'JOB_STARTED'
  | 'PHOTO_CAPTURED'
  | 'PHOTO_SYNCED'
  | 'NOTES_ADDED'
  | 'SIGNATURE_CAPTURED'
  | 'EVIDENCE_SEALED'
  | 'REPORT_GENERATED'
  | 'REPORT_SENT'
  | 'REPORT_VIEWED';

async function logAuditEntry(
  jobId: string,
  action: AuditAction,
  metadata?: Record<string, any>
): Promise<void> {
  const entry: AuditEntry = {
    id: generateUUID(),
    jobId,
    action,
    actor: getCurrentTechnicianId() || 'anonymous',
    timestamp: new Date().toISOString(),
    metadata,
  };

  // Store locally first (offline support)
  await storeAuditLocally(entry);

  // Queue for sync
  await queueAction('AUDIT_LOG', entry);
}

// Usage throughout workflow
await logAuditEntry(jobId, 'PHOTO_CAPTURED', {
  photoType: 'before',
  hasLocation: true,
  hasW3W: true,
});

await logAuditEntry(jobId, 'EVIDENCE_SEALED', {
  evidenceHash: seal.evidenceHash,
  photoCount: job.photos.length,
});

await logAuditEntry(jobId, 'REPORT_SENT', {
  channel: 'email',
  recipient: 'client@example.com',
  deliveryId: result.deliveryId,
});
```

---

## Consolidated UAT Compliance Checklist

### Critical Path Items

- [x] Token-based access (no login required)
- [x] Single job per token
- [x] 7-day token expiry
- [x] Sealed job blocking (read-only after seal)
- [x] Offline token caching
- [x] Safety checklist completion
- [x] Location verification (GPS + W3W)
- [x] Photo capture with metadata
- [x] SHA-256 photo hashing
- [x] Signature capture (canvas)
- [x] Local evidence sealing
- [x] IndexedDB persistence
- [x] Sync queue with retry
- [x] Network status detection
- [x] Visual sync indicators

### Needs Implementation

- [ ] Email dispatch integration (Resend/SendGrid)
- [ ] WhatsApp deep link dispatch
- [ ] QR code generation
- [ ] Full W3W API integration
- [ ] Photo EXIF extraction
- [ ] Biometric signature verification
- [ ] Push notifications
- [ ] Background sync service worker

### V2 Roadmap Items

- [ ] SMS dispatch
- [ ] Time tracking
- [ ] Advanced analytics
- [ ] Signature verification AI
- [ ] Voice notes

---

## Implementation Priority

| Phase | Features | Effort |
|-------|----------|--------|
| **Phase 1** | Core workflow (done), local sealing, basic dispatch | 1-2 weeks |
| **Phase 2** | Email dispatch, sync polish, W3W integration | 1-2 weeks |
| **Phase 3** | WhatsApp/QR dispatch, notifications | 1 week |
| **Phase 4** | Advanced UX, poor light handling, biometrics | 2 weeks |

---

*Report generated by Claude for JobProof V1 Technician Workflow Design.*
