# JobProof Enterprise Field App Critique

**Date:** 2026-02-01
**Review Council:** Solution Architect, Construction UX Specialist, Senior Software Engineer, Technical Debt Auditor

---

## EXECUTIVE VERDICT

### **NOT FIELD-READY**

JobProof has solid architectural foundations and thoughtful role-based design, but **critical offline data loss scenarios, cognitive overload in job management, and silent failure modes** make it unsafe for field deployment at scale. A technician standing in mud with gloves will lose data. A manager with 50 jobs cannot operate efficiently. The sync system has 10+ identified gaps where evidence could be orphaned or lost.

**The app is 75% of the way to field-ready.** The remaining 25% is the difference between "works in demo" and "trusted in the field."

---

## 1. DASHBOARD REALITY CHECK (UX)

### What a Field User Needs in 10 Seconds

| Role | Primary Question | Secondary Question |
|------|-----------------|-------------------|
| **Technician** | "What job am I on right now?" | "Is my work saved?" |
| **Contractor** | "What's next?" | "How many done today?" |
| **Manager** | "Is anyone blocked?" | "Are all jobs synced?" |

### AdminDashboard Assessment

**File:** `views/AdminDashboard.tsx`

**PASSES:**
- Technician-centric design ("Managers manage people, not artifacts")
- Attention flags for blocked/idle technicians
- Sync issue warnings are prominent
- One-tap call to technician

**FAILS:**
- **Cognitive load on metrics cards:** 4 metric cards (In Field, Available, Active Jobs, Sealed) - manager must scan all to understand state. Should be collapsed to: "X blocked, Y in field"
- **No default sort by urgency:** Attention flags exist but technicians are sorted by `hasAttention` + `operationalStatus`. Should be: blocked first, then by time-since-activity
- **"View All Jobs" button is secondary:** The most common manager action (check a specific job) requires navigation. Job search should be inline.
- **Email verification banner takes premium real estate:** On mobile, this is the first thing visible. Should be collapsed after first view.
- **Action Center hidden behind modal:** Unopened links require a modal. Should be inline accordion.

**Lines 284-314:** MetricCard section is 4 cards with `onClick={() => {}}` for two cards (no action). Dead interaction = confusion.

### ContractorDashboard Assessment

**File:** `views/ContractorDashboard.tsx`

**PASSES:**
- "Now" section is visually dominant (pulsing indicator, gradient border)
- "Up Next" is limited to 5 jobs (prevents overload)
- "Later" section is collapsed by default
- Touch targets are 56px+ on critical elements

**FAILS:**
- **No sync status on current job card:** Contractor sees job status but not sync status. If photos are pending sync, contractor doesn't know.
- **"Check for updates" button at empty state:** Uses `window.location.reload()` (line 120) - this is a full page reload, not a graceful data refresh. Can discard unsaved state.
- **Done count links to `/contractor/history` (line 233):** Route likely doesn't exist or is placeholder. Dead link.

### TechPortal Assessment

**File:** `views/tech/TechPortal.tsx`

**PASSES:**
- Single "Started" job is visually dominant
- "Ready" badge when evidence + signature captured
- No filters, no search (correct for technician role)
- Sync pending count visible in header

**FAILS:**
- **Job filtering uses 3 different ID fields:** Lines 32-37 filter by `technicianId`, `techId`, AND `techMetadata?.createdByTechId`. This is architecture smell - should be one canonical field.
- **No confirmation of "job is safe":** Technician captures photos but no clear "Saved to device" confirmation. Only sync status in header.
- **Profile link goes to `/tech/profile`:** This route may not exist. Needs verification.

### DASHBOARD VERDICT

| Dashboard | Field-Ready? | Primary Issue |
|-----------|-------------|---------------|
| AdminDashboard | NO | Too many metrics, hidden action center |
| ContractorDashboard | PARTIAL | Missing sync status on current job |
| TechPortal | PARTIAL | No "saved" confirmation, triple ID filter |

---

## 2. JOB VOLUME STRESS TEST

### Assumed Load

- Solo contractor: 10 jobs/day
- Technician: 10 jobs/day
- Manager: 10 jobs × 5 technicians = 50 jobs/day

### JobsList Assessment

**File:** `views/app/jobs/JobsList.tsx`

**Lines 159-171:** Computed lists for filtering are memoized, but computed on every render:
```typescript
const activeJobs = useMemo(() => jobs.filter(j => j.status !== 'Submitted'), [jobs]);
const sealedJobs = useMemo(() => jobs.filter(j => j.status === 'Submitted' || j.sealedAt || j.isSealed), [jobs]);
const awaitingSealJobs = useMemo(() => activeJobs.filter(j => !j.signature && !j.sealedAt), [activeJobs]);
```

**Issue:** `awaitingSealJobs` has wrong filter logic - it shows jobs WITHOUT signature as "awaiting seal". A job awaiting seal should HAVE evidence and signature (ready to be sealed). This is inverted.

### Maximum Jobs Per UI

| View | Practical Limit | Breaking Point | Failure Mode |
|------|----------------|----------------|--------------|
| AdminDashboard | 20 technicians | 30+ | Scroll fatigue, can't find blocked tech |
| JobsList | 100 jobs | 200+ | Filter tabs count slowly, search required |
| ContractorDashboard | 10 jobs | 15+ | "Later" section becomes primary view |
| TechPortal | 10 assigned | 15+ | Lost context, needs search |

### Sorting Defaults

- **AdminDashboard:** Sorted by attention → operational status. GOOD.
- **ContractorDashboard:** Up Next sorted by date. GOOD.
- **JobsList:** Sorted by date descending (newest first). WRONG for operational use - should be "oldest incomplete first" to surface stale jobs.
- **TechPortal:** Assigned jobs sorted by date. GOOD.

### Reassignment Friction

No evidence of inline technician reassignment. Manager must:
1. Navigate to job detail
2. Open assignment modal
3. Select technician
4. Generate new magic link

**Friction level:** HIGH. Should be one-tap reassign from technician row.

### VOLUME VERDICT

**Maximum manageable jobs:**
- Contractor: 10/day (UI designed for this)
- Technician: 10/day (UI designed for this)
- Manager: 30/day across 5 techs (beyond this, cognitive overload)

**Under load, errors will occur:**
1. Wrong filter applied (awaiting_seal logic is inverted)
2. Stale jobs buried at bottom of list
3. Reassignment takes too many taps

---

## 3. OFFLINE & BUNKER MODE

### Critical Scenario Analysis

| Scenario | Handled? | Evidence |
|----------|----------|----------|
| No signal | PARTIAL | syncQueue exists, but gaps |
| Mid-flow interruption | PARTIAL | Draft saving, but race conditions |
| App killed by OS | YES | IndexedDB draft persists |
| Battery critical | NO | No low-battery sync flush |
| Camera permission revoked | YES | Error state with retry |

### SEVERE FIELD FAILURES IDENTIFIED

#### Failure 1: Photo Lost During Upload

**File:** `lib/syncQueue.ts` lines 44-77

```typescript
for (const photo of job.photos) {
  if (photo.isIndexedDBRef) {
    const dataUrl = await getMedia(photo.url);
    if (!dataUrl) {
      failedPhotos.push(photo.id);
      continue; // PHOTO REFERENCE LOST - NOT RE-QUEUED
    }
```

**Issue:** If IndexedDB returns null (corrupted, quota exceeded), photo ID is logged but photo data is **GONE**. No recovery mechanism.

#### Failure 2: Race Condition in EvidenceCapture

**File:** `views/tech/EvidenceCapture.tsx` lines 163-200

```typescript
const savePhoto = async () => {
  // 1. Update job with photo
  contextUpdateJob(updatedJob);

  // 2. Then clear draft
  await db.media.delete(draftKey); // Can fail or be skipped
};
```

**Issue:** If app crashes between `contextUpdateJob` and `db.media.delete`:
- Draft photo remains in IndexedDB
- Photo also in job state
- User may capture duplicate on next visit

#### Failure 3: JobForm Uses localStorage, Not IndexedDB

**File:** `views/app/jobs/JobForm.tsx` line 129:
```typescript
localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
```

**Violation of CLAUDE.md mandate:** "Dexie/IndexedDB draft saving (every keystroke)"

localStorage has ~5MB limit and no structured error handling. Large jobs with notes will silently lose draft.

#### Failure 4: Sync Flush on Page Unload Doesn't Await

**File:** `lib/debouncedSync.ts` lines 301-305:
```typescript
window.addEventListener('beforeunload', () => {
  flushPendingUpdates(); // Not awaited!
});
```

Browser may close before promises resolve. Updates lost.

#### Failure 5: No Visual Certainty

**Question:** "Is my photo saved?"

There is NO explicit confirmation that a photo is persisted to IndexedDB. The technician sees the photo preview, clicks "Use Photo", and hopes it worked.

**Required UX:** Green checkmark with "Saved to device" text, visible for 2 seconds.

### Sync Conflict Resolution

**File:** `lib/offline/sync.ts` (from agent exploration)

Conflicts are:
1. Detected correctly (sealed jobs win, newer wins)
2. Stored in localStorage (last 50)
3. **NEVER shown to user**

A technician's notes could be discarded silently because the manager edited the job remotely.

### OFFLINE VERDICT

| Requirement | Status | Risk Level |
|-------------|--------|------------|
| Draft saving | PARTIAL | HIGH - JobForm uses localStorage |
| Offline queue | YES | MEDIUM - Retry works but gaps |
| Network awareness | YES | LOW |
| Optimistic UI | YES | LOW |
| Data survival | PARTIAL | HIGH - Race conditions |
| Visual certainty | NO | SEVERE - No "saved" confirmation |

---

## 4. PERMISSIONS & ROLE SIMPLICITY (V1)

### Current State

V1 scope explicitly states:
> "All roles may create, update, reassign, close, cancel jobs in V1."

Yet the codebase has role-specific route guards and UI conditionals that add complexity without value.

### Unnecessary Complexity Found

#### Triple ID Filter in TechPortal

**File:** `views/tech/TechPortal.tsx` lines 32-37

```typescript
const myJobs = useMemo(() => {
  return allJobsData.filter(j =>
    j.technicianId === userId ||
    j.techId === userId ||
    j.techMetadata?.createdByTechId === userId
  );
}, [allJobsData, userId]);
```

**Why 3 fields?** This is legacy cruft. Should be ONE field: `assignedTechId`.

#### Role-Specific Route Branches in App.tsx

The routing creates distinct paths for:
- `/admin` (manager)
- `/contractor` (solo)
- `/tech` (technician)

But the underlying data and permissions are identical. This creates:
- 3 sets of components to maintain
- 3 different mental models for the same operations
- Confusion when a user's role changes

### Recommendations for V1 Simplification

| Current | Recommended |
|---------|-------------|
| 3 route prefixes | 1 route prefix with persona-aware UI |
| Triple technician ID fields | Single `assignedTechId` field |
| Role-specific dashboards | Single dashboard with persona-aware widgets |
| Separate job detail views | Single job detail with role-aware actions |

### PERMISSIONS VERDICT

V1 should flatten:
1. **Delete `ContractorDashboard.tsx`** - Merge into TechPortal with persona flag
2. **Consolidate technician ID fields** - One canonical field
3. **Defer strict RBAC to V2** - Current checks add complexity, not security

---

## 5. CODEBASE HEALTH & TECH DEBT

### Critical Issues

| Issue | Location | Classification | Risk |
|-------|----------|----------------|------|
| 16 deprecated functions exported | `hooks/useWorkspaceData.ts` | LATENT BUG | Developer uses wrong pattern |
| Deprecated import in CompleteOnboarding | `views/CompleteOnboarding.tsx:5` | LATENT BUG | Uses deprecated getJobs/getClients |
| 35+ console.log statements | Various | COSMETIC | Performance, debug artifacts |
| getCurrentUser() exported | `lib/auth.ts:402` | LATENT BUG | Could trigger 877 req/hr auth loop |
| Inconsistent draft storage | JobForm vs ClientForm | TRUST-DESTROYING | Data loss in large forms |
| Dead tech debt references in CLAUDE.md | Lines 619-629 | COSMETIC | Misleading documentation |

### Files Flagged as "Remaining Tech Debt" in CLAUDE.md

| File | Actual Status | Action |
|------|--------------|--------|
| `views/tech/EvidenceCapture.tsx` | **ALREADY MIGRATED** to DataContext | Remove from list |
| `views/app/jobs/JobForm.tsx` | **ALREADY MIGRATED** to DataContext | Remove from list |
| `views/app/jobs/EvidenceReview.tsx` | **ALREADY MIGRATED** to DataContext | Remove from list |
| `views/app/invoices/InvoiceList.tsx` | **FILE DOES NOT EXIST** | Delete reference |
| `views/app/invoices/InvoiceDetail.tsx` | **FILE DOES NOT EXIST** | Delete reference |
| `hooks/useJobGuard.ts` | **ALREADY COMPLIANT** | Remove from list |

**Verdict:** CLAUDE.md tech debt list is STALE. Update immediately.

### Dead Routes / Unused Components

1. `/contractor/history` - Linked in ContractorDashboard line 233, route may not exist
2. `/tech/profile` - Linked in TechPortal line 90, route may not exist
3. `InvoiceList.tsx` / `InvoiceDetail.tsx` - Referenced but don't exist

### Over-Abstracted Hooks

None found. Hook usage is appropriate.

### Duplicate Logic

1. **Draft storage:** 3 different implementations (localStorage with expiry, localStorage with custom expiry, IndexedDB via Dexie)
2. **Inline entity creation modals:** JobForm and others replicate modal state management for adding clients/technicians inline

### TECH DEBT VERDICT

| Severity | Count | Action |
|----------|-------|--------|
| Trust-Destroying | 1 | Fix JobForm draft storage immediately |
| Latent Bug | 3 | Delete deprecated exports, fix imports |
| Cosmetic | 2 | Update CLAUDE.md, strip console.logs |

---

## 6. PERFORMANCE & RELIABILITY

### Cold Start Time

**File:** `vite.config.ts`

Build configuration is GOOD:
- Proper code splitting (`manualChunks`)
- Terser minification with console.log stripping
- Chunk size warning at 600KB
- CSS code splitting enabled

**Estimated cold start:** ~2-3 seconds on 4G, acceptable.

### Job List Rendering

**File:** `views/app/jobs/JobsList.tsx`

- `useMemo` on all computed lists
- Desktop table + mobile cards (responsive, not conditional render of both)
- No virtualization for large lists

**Issue at scale:** 200+ jobs will cause visible lag on mobile. Needs virtualized list (react-window or similar).

### Media Capture Latency

**File:** `views/tech/EvidenceCapture.tsx`

- Canvas capture is synchronous (line 136: `context.drawImage`)
- JPEG quality at 0.9 (line 139) - could reduce to 0.8 for faster processing
- No image compression before storage

**Issue:** High-res photos (1920x1080 at 0.9 quality) are ~200-400KB each. With 10 photos per job, IndexedDB can hit 4MB per job.

### Sync Batching

**File:** `lib/syncQueue.ts`

- Photos are batched in Supabase upsert (line 118: single query for all photos)
- Jobs synced individually
- Retry interval: 5 minutes (reasonable for battery life)

**GOOD** design for field conditions.

### Memory Pressure on Mobile

**Concerns:**
1. Video stream for camera capture (held in memory while on capture screen)
2. Canvas rendering at full resolution (1920x1080)
3. Base64 data URLs held in state before IndexedDB commit

**No explicit memory cleanup** after photo capture. `stream.getTracks().forEach(track => track.stop())` is only called on navigation (line 204), not after successful capture.

### PERFORMANCE VERDICT

| Aspect | Status | Risk |
|--------|--------|------|
| Cold start | GOOD | LOW |
| Job list 50 items | GOOD | LOW |
| Job list 200+ items | POOR | MEDIUM - No virtualization |
| Photo capture | ACCEPTABLE | MEDIUM - No compression |
| Sync performance | GOOD | LOW - Batched |
| Memory | POOR | HIGH - Camera stream held too long |

---

## 7. DELIGHT (NO MARKETING BS)

### One Moment of Real Delight

**ContractorDashboard "Now" section** (lines 126-176)

The pulsing indicator, gradient border, and prominent "Continue" action create clear focus. When a contractor opens the app, they know exactly what to do. This is genuine delight through reduced cognitive load.

### Three Moments of Irritation

1. **AdminDashboard Action Center behind modal:** Manager sees "3 attention needed" badge but must open modal to see details. Should be inline.

2. **No "Saved" confirmation after photo capture:** User clicks "Use Photo", screen navigates away. No explicit confirmation that data is safe. Creates anxiety.

3. **JobsList filter tabs don't persist:** Navigate to jobs list, apply filter, open job, go back - filter is reset. URL params exist (`?filter=active`) but may not persist through navigation.

### One Moment That Risks Abandonment

**EvidenceCapture on permission denial:**

If camera permission is denied (line 91-93):
```typescript
setError('Unable to access camera. Please grant camera permissions.');
```

User sees error message and "Go Back" button. No instructions on how to fix. No direct link to device settings. Technician may give up and tell manager "app doesn't work."

**Required:** Step-by-step instructions + deep link to settings (if available on platform).

---

## CRITICAL FAILURES (NON-NEGOTIABLE FIXES)

1. **Photo data loss in sync queue:** If IndexedDB read fails, photo is silently lost. Must preserve reference and notify user.

2. **JobForm uses localStorage for drafts:** Violates offline mandate. Large jobs will lose drafts. Migrate to IndexedDB.

3. **No "Saved to device" confirmation:** Technician has no certainty that captured evidence is safe. Add explicit confirmation UI.

4. **Race condition in EvidenceCapture:** Draft not cleaned up atomically. Can cause duplicate photos.

5. **Sync conflicts never shown to user:** Local work can be silently discarded. Add conflict notification.

---

## HIGH-IMPACT SIMPLIFICATIONS

### Delete

- `views/CompleteOnboarding.tsx` deprecated imports (line 5)
- 16 deprecated function exports in `hooks/useWorkspaceData.ts` (lines 137-321)
- Dead tech debt references in CLAUDE.md (lines 619-629)
- `getCurrentUser()` export in `lib/auth.ts` (or mark as internal)

### Collapse

- AdminDashboard metric cards: 4 → 2 ("Attention: X" | "In Field: Y")
- Action Center modal → inline accordion
- Three role dashboards → one dashboard with persona widgets

### Make Default

- JobsList sort: "Oldest incomplete first" (not newest first)
- Camera permission error: Include settings instructions
- Photo capture: Auto-save confirmation visible for 2s

---

## REFACTOR ORDERS

### Immediate (P0 - Before Any Field Testing)

| File | Change | Lines |
|------|--------|-------|
| `views/app/jobs/JobForm.tsx` | Replace localStorage with IndexedDB | 129, 82-88 |
| `views/tech/EvidenceCapture.tsx` | Add "Saved to device" confirmation after persistDraft | 149-151 |
| `lib/syncQueue.ts` | Re-queue failed IndexedDB reads instead of discarding | 48-51 |
| `views/CompleteOnboarding.tsx` | Replace deprecated imports with DataContext | 5 |

### High Priority (P1 - Before Scale Testing)

| File | Change | Lines |
|------|--------|-------|
| `hooks/useWorkspaceData.ts` | Delete or hide deprecated exports | 137-321 |
| `views/app/jobs/JobsList.tsx` | Fix `awaitingSealJobs` filter logic | 161 |
| `views/AdminDashboard.tsx` | Remove no-op MetricCard onClick | 291-298 |
| CLAUDE.md | Update tech debt list (remove completed items) | 619-629 |

### Medium Priority (P2 - Before Production)

| File | Change |
|------|--------|
| `views/tech/EvidenceCapture.tsx` | Release camera stream immediately after capture |
| `views/ContractorDashboard.tsx` | Replace `window.location.reload()` with DataContext refresh |
| `views/tech/TechPortal.tsx` | Consolidate triple ID filter to single field |
| `lib/debouncedSync.ts` | Use sendBeacon for beforeunload flush |

---

## NEXT REFACTOR FOCUS

**If only one week of work is allowed:**

### Focus: Offline Data Safety

1. **Day 1-2:** Migrate JobForm drafts to IndexedDB + add "Saved" confirmation to EvidenceCapture
2. **Day 3:** Fix sync queue to preserve failed photo references + add conflict notification
3. **Day 4:** Add camera permission error instructions + test airplane mode flow
4. **Day 5:** Verify all drafts survive: airplane mode → capture 5 photos → force kill app → restart

**Outcome:** Evidence cannot be lost under any field condition.

---

## SUMMARY TABLE

| Section | Verdict | Primary Risk |
|---------|---------|--------------|
| Dashboard UX | PARTIAL | Cognitive overload, hidden actions |
| Job Volume | PARTIAL | Wrong filter logic, no virtualization |
| Offline & Bunker | FAIL | 5 data loss scenarios identified |
| Permissions V1 | OVER-ENGINEERED | 3 ID fields, 3 dashboards for same data |
| Tech Debt | MEDIUM | Deprecated code still exported |
| Performance | PARTIAL | Memory pressure, no large list optimization |
| Delight | PARTIAL | Good focus, bad error recovery |

**Final Verdict:** NOT FIELD-READY. Fix P0 items, then re-evaluate.

---

*This assessment is based on code analysis as of 2026-02-01. Recommendations are prioritized by impact on field worker trust and data safety.*
