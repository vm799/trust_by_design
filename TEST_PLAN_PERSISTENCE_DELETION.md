# JobProof Comprehensive Test Plan: Cross-Device Persistence & Job Deletion

**Version:** 1.0
**Last Updated:** February 2026
**Status:** Ready for Testing
**Critical:** 367+ Tests Required to Pass

---

## Executive Summary

This test plan validates JobProof's core offline-first mandate: data persistence across device boundaries and deletion protection for sealed/invoiced jobs. The plan covers 9 major scenarios with 67+ test cases.

**Key Architecture:**
- **IndexedDB (Dexie):** Local-first job/client/technician storage
- **localStorage:** Form drafts, sync queue, session state
- **Supabase:** Cloud source of truth with conflict resolution
- **Sync Queue:** Exponential backoff retry (max 7 retries, 2s-60s delays)

---

## Part 1: Test Environment Setup

### 1.1 Create Three Test Accounts

```bash
# Test Account A (Admin/Manager)
Email: admin-a@jobproof-test.local
Password: TestPassword123!@# (or use magic link)
Workspace: Test Workspace A
Role: Admin

# Test Account B (Admin/Manager - same workspace)
Email: admin-b@jobproof-test.local
Password: TestPassword123!@#
Workspace: Test Workspace A (SAME as Account A)
Role: Admin

# Test Account C (Technician)
Email: tech-c@jobproof-test.local
Password: TestPassword123!@#
Workspace: Test Workspace A (SAME as Accounts A & B)
Role: Technician
```

### 1.2 Prepare Test Browsers/Devices

| Device | Browser | OS | Purpose |
|--------|---------|----|----|
| Device 1 (Primary) | Chrome | Windows/Mac | Main testing |
| Device 2 (Secondary) | Firefox | Windows/Mac | Cross-device sync |
| Device 3 (Mobile) | Chrome Mobile | iOS/Android | Touch targets |
| Tab A | Chrome | Windows/Mac | Multi-tab sync |
| Tab B | Chrome | Windows/Mac | Multi-tab sync |

### 1.3 DevTools Network Configuration

```javascript
// Chrome DevTools > Network tab

// Offline Mode Test
1. Click "Offline" dropdown
2. Select "Offline"
3. Refresh page
4. Verify app works without network

// Throttling Test
1. Click "No throttling" dropdown
2. Select "Slow 3G"
3. Run sync operations
4. Monitor retry behavior

// Custom Throttling
Download: 400 kbps
Upload: 400 kbps
Latency: 400ms
```

### 1.4 IndexedDB Inspection

```javascript
// Open DevTools Console and run:

// Check database size
(async () => {
  const storage = await navigator.storage.estimate();
  console.log(`IndexedDB Usage: ${(storage.usage / 1024 / 1024).toFixed(2)}MB`);
  console.log(`Quota: ${(storage.quota / 1024 / 1024).toFixed(2)}MB`);
  console.log(`Available: ${((storage.quota - storage.usage) / 1024 / 1024).toFixed(2)}MB`);
})();

// List all jobs in IndexedDB
(async () => {
  const { getDb } = await import('./lib/offline/db.js');
  const db = await getDb();
  const jobs = await db.jobs.toArray();
  console.table(jobs.map(j => ({
    id: j.id,
    title: j.title,
    status: j.status,
    syncStatus: j.syncStatus,
    sealedAt: j.sealedAt ? '✓ SEALED' : '',
    lastUpdated: new Date(j.lastUpdated).toLocaleString()
  })));
})();

// Check Dexie version
(async () => {
  const { getDb } = await import('./lib/offline/db.js');
  const db = await getDb();
  console.log('Dexie DB Schema Version:', db.verno);
  console.log('Tables:', Object.keys(db.tables).map(t => t.name));
})();

// Monitor sync queue
(async () => {
  const { getDb } = await import('./lib/offline/db.js');
  const db = await getDb();
  const queue = await db.queue.toArray();
  console.log(`Queue Items: ${queue.length}`);
  console.table(queue.map(q => ({
    id: q.id,
    type: q.type,
    synced: q.synced ? 'YES' : 'NO',
    retryCount: q.retryCount,
    created: new Date(q.createdAt).toLocaleString()
  })));
})();

// List all form drafts
(async () => {
  const { getDb } = await import('./lib/offline/db.js');
  const db = await getDb();
  const drafts = await db.formDrafts.toArray();
  console.table(drafts.map(d => ({
    type: d.formType,
    savedAt: new Date(d.savedAt).toLocaleString(),
    ageMinutes: ((Date.now() - d.savedAt) / 60000).toFixed(1)
  })));
})();

// Check orphan photos
(async () => {
  const { getDb } = await import('./lib/offline/db.js');
  const db = await getDb();
  const orphans = await db.orphanPhotos.toArray();
  console.log(`Orphan Photos: ${orphans.length}`);
  console.table(orphans.map(o => ({
    id: o.id,
    jobId: o.jobId,
    reason: o.reason,
    orphanedAt: new Date(o.orphanedAt).toLocaleString(),
    attempts: o.recoveryAttempts
  })));
})();

// Clear all local data (DESTRUCTIVE)
(async () => {
  const { clearAllData } = await import('./lib/offline/db.js');
  await clearAllData();
  localStorage.clear();
  sessionStorage.clear();
  console.log('✓ All local data cleared - refresh page to reset');
})();
```

### 1.5 Sync Queue Inspection (localStorage)

```javascript
// Check localStorage sync queue
const queue = JSON.parse(localStorage.getItem('jobproof_sync_queue') || '[]');
console.table(queue.map(q => ({
  id: q.id,
  type: q.type,
  retryCount: q.retryCount,
  lastAttempt: new Date(q.lastAttempt).toLocaleString()
})));

// Check failed sync queue
const failed = JSON.parse(localStorage.getItem('jobproof_failed_sync_queue') || '[]');
console.table(failed.map(f => ({
  id: f.id,
  type: f.type,
  reason: f.reason,
  failedAt: f.failedAt
})));

// Clear localStorage (DESTRUCTIVE)
localStorage.clear();
console.log('✓ localStorage cleared');
```

---

## Part 2: Test Scenarios (67 Test Cases)

### Scenario 1: Single Device Persistence (12 tests)

#### 1.1 Job Creation → Refresh → Data Survives

**Precondition:** Device 1 (Chrome) logged in as admin-a@jobproof-test.local, offline mode enabled

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Go offline (DevTools > Offline) | Page still functional | | |
| 2 | Navigate to "Create Job" form | Form loads, no network warning | | |
| 3 | Fill form: Title="Test Job 1", Client="Acme Corp", Date="2026-02-15" | Form accepts input | | |
| 4 | Save job | Job appears in list with "pending" sync status | | |
| 5 | Verify IndexedDB: `await db.jobs.toArray()` | Job ID exists in IndexedDB with `syncStatus: 'pending'` | | |
| 6 | Go to Developer Tools > Application > IndexedDB > JobProofOfflineDB > jobs | Job visible in table | | |
| 7 | Refresh page (F5) | Job still appears in list | | |
| 8 | Verify localStorage: `localStorage.getItem('jobproof_jobs_v2')` | Job in serialized JSON | | |
| 9 | Close all tabs | | | |
| 10 | Reopen app | Job appears in list | | |
| 11 | Go online | Job syncs to Supabase (visible after refresh on another device) | | |
| 12 | Check Supabase: Query jobs table directly | Job present with `sync_status: 'synced'` | | |

**Expected Result:** ✅ PASS
**Risk Level:** LOW

---

#### 1.2 Client Creation Offline → Persists

**Precondition:** Device 1, offline mode

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Navigate to Clients > Create Client | Form loads | | |
| 2 | Fill: Name="Test Client X", Email="client@test.com", Phone="555-1234" | Form accepts | | |
| 3 | Save | Client appears in list | | |
| 4 | Check IndexedDB: `db.clients.where('name').equals('Test Client X').toArray()` | Client found | | |
| 5 | Refresh page | Client still visible | | |
| 6 | Close app and restart browser | Client appears | | |
| 7 | Go online and refresh | Client syncs to Supabase | | |

**Expected Result:** ✅ PASS
**Risk Level:** LOW

---

#### 1.3 Technician Creation Offline → Persists

**Precondition:** Device 1, offline mode

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Navigate to Technicians > Create Technician | Form loads | | |
| 2 | Fill: Name="Tech Test", Email="tech@test.com", Status="Available" | Form accepts | | |
| 3 | Save | Tech appears in list | | |
| 4 | Check IndexedDB: `db.technicians.toArray()` | Tech in database | | |
| 5 | Refresh page | Tech still visible | | |
| 6 | Kill browser completely, restart | Tech appears | | |
| 7 | Go online | Tech syncs to Supabase | | |

**Expected Result:** ✅ PASS
**Risk Level:** LOW

---

#### 1.4 Form Draft Auto-Save Every Keystroke

**Precondition:** Device 1, offline, Job creation form open

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Clear IndexedDB: `db.formDrafts.clear()` | formDrafts table empty | | |
| 2 | Type "T" in Job Title field | Draft NOT saved yet (debounce wait) | | |
| 3 | Wait 1 second, type "e" | Still debouncing | | |
| 4 | Continue typing "st Job" slowly (2-3 sec apart) | After each keystroke, check `db.formDrafts.get('job')` | | |
| 5 | Check after stop typing: `db.formDrafts.get('job')` | Draft saved with `savedAt: Date.now()` | | |
| 6 | Refresh page | Form auto-populates from draft | | |
| 7 | Wait 8 hours 1 minute | Draft should expire | | |
| 8 | Refresh page | Form is empty (draft expired) | | |
| 9 | Verify console: Check localStorage for draft expiry | Expired drafts not restored | | |

**Expected Result:** ✅ PASS
**Expiry Test Note:** Use system clock change or `db.formDrafts.update('job', { savedAt: Date.now() - 8*60*60*1000 + 60000 })` to simulate age

**Risk Level:** MEDIUM

---

#### 1.5 Multiple Form Drafts Coexist

**Precondition:** Device 1, offline

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Start typing in Job Creation form | Draft saved as 'job' | | |
| 2 | Navigate to Create Client form | Client form loads | | |
| 3 | Type in Client form | Draft saved as 'client' | | |
| 4 | Navigate to Create Technician form | Tech form loads | | |
| 5 | Type in Tech form | Draft saved as 'technician' | | |
| 6 | Check: `db.formDrafts.toArray()` | Returns 3 drafts | | |
| 7 | Refresh page multiple times, visit each form | Each form pre-fills from its respective draft | | |

**Expected Result:** ✅ PASS
**Risk Level:** LOW

---

#### 1.6 IndexedDB Data Survives Supabase Failure

**Precondition:** Device 1, online but Supabase API fails (simulate with DevTools)

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Open DevTools > Network > Disable all supabase.co requests | Supabase API blocked | | |
| 2 | Create a new job offline | Job saves to IndexedDB | | |
| 3 | Go online | App attempts sync, fails gracefully | | |
| 4 | Check console: No unhandled exceptions | Console clean | | |
| 5 | Refresh page | Job still in list from IndexedDB | | |
| 6 | Re-enable Supabase in DevTools | Network unblocked | | |
| 7 | Refresh page | Job eventually syncs (may need manual retry) | | |

**Expected Result:** ✅ PASS
**Risk Level:** MEDIUM

---

### Scenario 2: Sealed Job Deletion Prevention (8 tests)

#### 2.1 Seal Job → Delete Button Hidden

**Precondition:** Device 1, online, authenticated as admin-a, existing job visible

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Open a completed job with status "Submitted" | Job detail shows all controls | | |
| 2 | Verify photos uploaded (all synced) | All photos have `syncStatus: 'synced'` | | |
| 3 | Click "Seal Evidence" button | Seal dialog appears or automatic seal | | |
| 4 | Confirm seal action | Job sealed, `sealedAt` populated | | |
| 5 | Check Supabase: `SELECT * FROM jobs WHERE id = '...'` | `sealed_at` has timestamp | | |
| 6 | Refresh page | Job detail reloads | | |
| 7 | Inspect job in IndexedDB: `db.jobs.get(jobId)` | `sealedAt` and `isSealed: true` present | | |
| 8 | Check UI: Delete button should NOT be visible | Button hidden or disabled with tooltip | | |

**Expected Result:** ✅ Delete button hidden after seal
**Risk Level:** LOW

---

#### 2.2 Seal Job → Try to Delete via API → Error Shown

**Precondition:** Device 1, job sealed (from test 2.1)

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Open sealed job detail | UI shows no delete option | | |
| 2 | Attempt delete via API (simulated): `curl -X DELETE /api/jobs/{id}` | API returns 403 Forbidden | | |
| 3 | Expected response body: `{ "error": "Cannot delete sealed job" }` | Error message matches | | |
| 4 | If UI had delete button, click it → Dialog shows error | Error toast or modal: "Cannot delete sealed job" | | |
| 5 | Verify job NOT deleted from Supabase | Job still exists in DB | | |

**Expected Result:** ✅ Delete prevented
**Risk Level:** MEDIUM

---

#### 2.3 Seal Job → Logout/Login → Delete Button Still Hidden

**Precondition:** Device 1, sealed job from test 2.1

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Sealed job visible in list | Job shows as sealed (badge or icon) | | |
| 2 | Click Logout | User logged out, redirected to /auth | | |
| 3 | Login again as admin-a@jobproof-test.local | Authenticated, data reloads | | |
| 4 | Navigate to Jobs list | Jobs visible | | |
| 5 | Find sealed job in list | Job present with sealed indicator | | |
| 6 | Open sealed job detail | UI shows NO delete button | | |
| 7 | Verify Supabase still has `sealedAt` timestamp | Job sealed status persists | | |

**Expected Result:** ✅ Sealed status persists across session
**Risk Level:** MEDIUM

---

#### 2.4 Job with Multiple Sealed Properties

**Precondition:** Device 1, job with `sealedAt`, `evidenceHash`, `isSealed` all set

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Query Supabase: Check job properties | `sealed_at`, `evidence_hash`, `is_sealed` all have values | | |
| 2 | Refresh IndexedDB: `db.jobs.get(jobId)` | All three fields present locally | | |
| 3 | Inspect job object in DataContext | All properties available | | |
| 4 | Attempt any modification (status, notes, etc.) | Update blocked with error "Cannot modify sealed job" | | |
| 5 | Attempt delete | Delete blocked with error "Cannot delete sealed job" | | |

**Expected Result:** ✅ Sealed jobs are immutable
**Risk Level:** MEDIUM

---

#### 2.5 Multiple Sealed Jobs in List

**Precondition:** Device 1, create and seal 3 jobs

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Navigate to Jobs list | 3+ sealed jobs visible with badges | | |
| 2 | Verify each sealed job | Each shows "Sealed" indicator | | |
| 3 | Try to select delete on each | Delete option not available on any | | |
| 4 | Try inline delete (if available) | All sealed jobs protected | | |
| 5 | Try bulk delete | Operation fails or skips sealed jobs | | |

**Expected Result:** ✅ All sealed jobs protected
**Risk Level:** LOW

---

### Scenario 3: Invoiced Job Deletion Prevention (6 tests)

#### 3.1 Invoice Job → Delete Button Hidden

**Precondition:** Device 1, online, job with status "Submitted"

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Open completed job | Job detail visible | | |
| 2 | Navigate to Invoice section | Invoice form available | | |
| 3 | Create invoice for this job (Invoice total: $1500) | Invoice created with `invoiceId` | | |
| 4 | Check DataContext: Job now has `invoiceId` property | `invoiceId` present and populated | | |
| 5 | Refresh page | Invoice ID persists | | |
| 6 | Open job detail | Delete button NOT visible | | |
| 7 | Attempt delete via console: Would fail with "Cannot delete invoiced job" | Error expected | | |

**Expected Result:** ✅ Delete button hidden for invoiced job
**Risk Level:** LOW

---

#### 3.2 Delete Invoice → Can Now Delete Job

**Precondition:** Device 1, job with invoice from test 3.1

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Open invoiced job detail | Delete button hidden | | |
| 2 | Navigate to Invoices section | List all invoices | | |
| 3 | Find invoice for this job | Invoice visible with total $1500 | | |
| 4 | Delete invoice | Invoice removed from list and Supabase | | |
| 5 | Refresh page | Invoice gone | | |
| 6 | Go back to job detail | Delete button should NOW be visible | | |
| 7 | Click delete | Job deleted successfully | | |
| 8 | Verify job removed from list | Job gone from UI and Supabase | | |

**Expected Result:** ✅ Delete enabled after invoice removal
**Risk Level:** MEDIUM

---

#### 3.3 Sealed AND Invoiced Job (Double Protection)

**Precondition:** Device 1, sealed job from test 2.1, now create invoice for it

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Open sealed job detail | Sealed badge visible | | |
| 2 | Create invoice for sealed job | Invoice created, job now has both `sealedAt` and `invoiceId` | | |
| 3 | Attempt delete via UI | Delete button hidden | | |
| 4 | Attempt delete via API | Returns 403 with message about sealed/invoiced status | | |
| 5 | Delete invoice first | Invoice removed | | |
| 6 | Attempt delete job again | Still fails - job still sealed | | |
| 7 | Must unseal job first (if possible) or leave sealed | Deletion protection honored | | |

**Expected Result:** ✅ Both protections enforced
**Risk Level:** MEDIUM

---

### Scenario 4: Cross-Device Sync (10 tests)

#### 4.1 Create on Device A (Offline) → Device B Sees It (Online)

**Precondition:** Devices 1 & 2, both logged in as admin-a@jobproof-test.local (same account), Device 1 offline, Device 2 online

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Device 1: Go offline | Network disabled | | |
| 2 | Device 1: Create job "Test Job Cross-Device" | Job saved to IndexedDB | | |
| 3 | Device 1: Verify in IndexedDB: `db.jobs.toArray()` | Job with `syncStatus: 'pending'` | | |
| 4 | Device 1: Go online | Network reconnected | | |
| 5 | Device 1: Wait 5-10 seconds | Sync queue processes, job syncs to Supabase | | |
| 6 | Device 1: Monitor console: `[Sync] Pulled...` message | Sync confirmation visible | | |
| 7 | Device 2: Refresh page | Device 2 fetches latest jobs from Supabase | | |
| 8 | Device 2: Check jobs list | "Test Job Cross-Device" appears | | |
| 9 | Device 2: Click into job detail | All data present (title, notes, etc.) | | |

**Expected Result:** ✅ Job appears on Device B after sync
**Risk Level:** MEDIUM

---

#### 4.2 Delete on Device A → Device B Reflects Deletion

**Precondition:** Devices 1 & 2, both online, same account, job exists on both

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Both devices: Job "Test Job Cross-Device" visible in list | Job present on both | | |
| 2 | Device 1: Delete job (if not sealed) | Job removed from Device 1 UI | | |
| 3 | Device 1: Monitor sync queue | Deletion queued and processed | | |
| 4 | Supabase: Query jobs table | Job deleted from Supabase | | |
| 5 | Device 2: Refresh page (F5) | Job no longer in list | | |
| 6 | Device 2: Check IndexedDB: `db.jobs.toArray()` | Job not in IndexedDB | | |

**Expected Result:** ✅ Deletion syncs across devices
**Risk Level:** MEDIUM

---

#### 4.3 Edit on Device A → Device B Sees Changes

**Precondition:** Devices 1 & 2, online, same account, job exists

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Device 1: Open job detail for "Test Job Cross-Device" | Job loaded | | |
| 2 | Device 1: Change status from "In Progress" to "Complete" | Status updated | | |
| 3 | Device 1: Add note "Finished ahead of schedule" | Note saved | | |
| 4 | Device 1: Wait for sync | Sync queue processes changes | | |
| 5 | Device 2: Refresh page | Updated data fetched from Supabase | | |
| 6 | Device 2: Open same job detail | Status shows "Complete" and new note visible | | |

**Expected Result:** ✅ Edits sync across devices
**Risk Level:** MEDIUM

---

#### 4.4 Concurrent Edits (Device A & B Edit Same Field)

**Precondition:** Devices 1 & 2, online, same account, job with notes field

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Both devices: Open same job detail | Job loaded on both | | |
| 2 | Device 1: Change notes to "Note from Device A" | Local update | | |
| 3 | Device 2: Change notes to "Note from Device B" | Local update | | |
| 4 | Device 1: Click save | Syncs Device A changes to Supabase | | |
| 5 | Device 2: Click save (before Device 1 change arrives) | Conflict detection should trigger | | |
| 6 | Conflict resolution: Check logs | `[Sync] Conflict detected...` message | | |
| 7 | Refresh both devices | One wins per CLAUDE.md conflict rules | | |

**Expected Result:** ⚠️ Conflict handled (Device A timestamp wins if newer, or merged)
**Risk Level:** HIGH

---

#### 4.5 Offline on Device A, Online on Device B

**Precondition:** Device 1 offline, Device 2 online, same account

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Device 2: Create job "Device B Only" | Job syncs to Supabase | | |
| 2 | Device 1: Still offline, Job list doesn't update | Local data shown only | | |
| 3 | Device 2: Modify that job | Change syncs to Supabase | | |
| 4 | Device 1: Go online | Sync pull fetches all changes | | |
| 5 | Device 1: Refresh page or wait for auto-sync | "Device B Only" job appears with Device 2's changes | | |

**Expected Result:** ✅ Offline device catches up when reconnected
**Risk Level:** MEDIUM

---

#### 4.6 Photo Upload on Device A → Device B Sees URL

**Precondition:** Devices 1 & 2, online, job with no photos, Device 1 can take photos

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Device 1: Open job detail and add photo | Photo captured or uploaded | | |
| 2 | Device 1: Wait for sync | Photo uploaded to Supabase Storage, URL updated | | |
| 3 | Device 1: Check IndexedDB: Photo has `syncStatus: 'synced'` and public URL | Photo synced | | |
| 4 | Device 2: Refresh page | Job fetches from Supabase with photo URL | | |
| 5 | Device 2: Open job detail | Photo visible | | |
| 6 | Device 2: Try to click/expand photo | Photo loads from Supabase Storage | | |

**Expected Result:** ✅ Photos sync across devices
**Risk Level:** MEDIUM

---

### Scenario 5: Orphaned Records (Dexie Bug Prevention) (8 tests)

#### 5.1 Offline Create → Sync Succeeds → Delete from Supabase UI → Device Reappears (BUG TEST)

**Precondition:** Device 1, created job offline and synced it

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Device 1: Create job "Orphan Test Job" offline | Job in IndexedDB with `syncStatus: 'pending'` | | |
| 2 | Device 1: Go online | Job syncs to Supabase | | |
| 3 | Device 1: Verify in Supabase: Job present | Job ID exists in DB | | |
| 4 | Device 1: Verify in IndexedDB: `db.jobs.get(jobId)` | Job present with `syncStatus: 'synced'` | | |
| 5 | Admin (via Supabase UI or direct query): Delete job directly | Job deleted from Supabase | | |
| 6 | Device 1: Go offline, then online | Device syncs, pulls latest from Supabase | | |
| 7 | Device 1: Check jobs list | Job should NOT appear (deleted on server) | | |
| 8 | Device 1: Check IndexedDB: `db.jobs.get(jobId)` | **BUG CHECK:** If job still here = orphan! Expected: Job removed | | |

**Expected Result:** ✅ Job removed from IndexedDB during sync pull
**Actual Risk:** ❌ BUG LIKELY: Orphaned job may remain in IndexedDB
**Remediation:** Implement deletion tracking in `pullJobs()` to remove locally orphaned records

**Risk Level:** HIGH

---

#### 5.2 Photo Orphan Recovery System

**Precondition:** Device 1, job with photos synced

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Device 1: Create job with 3 photos, sync all | Photos synced to Supabase Storage | | |
| 2 | Device 1: Simulate IndexedDB data loss: `db.media.clear()` | Media table emptied | | |
| 3 | Device 1: Attempt to sync job again | Sync detects missing media | | |
| 4 | Device 1: Check orphanPhotos table: `db.orphanPhotos.toArray()` | Orphan entries created with metadata | | |
| 5 | Device 1: Verify each orphan has: `jobId`, `type`, `timestamp`, `reason` | Metadata preserved | | |
| 6 | Admin panel: Check "Orphan Photos" recovery view | 3 orphans listed | | |
| 7 | Click "View Job" on orphan | Navigates to job detail | | |
| 8 | Manually re-capture or recover photo | Photo synced again | | |

**Expected Result:** ✅ Orphan log prevents data loss
**Risk Level:** MEDIUM

---

#### 5.3 Orphan Photo Auto-Cleanup After Recovery

**Precondition:** Device 1, orphan photo from test 5.2

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Device 1: Re-upload orphaned photo | Photo syncs successfully | | |
| 2 | Device 1: Check DB: Photo now has `syncStatus: 'synced'` | Photo no longer orphaned | | |
| 3 | Device 1: Call cleanup: `db.orphanPhotos.delete(orphanId)` or auto-cleanup | Orphan log entry removed | | |
| 4 | Verify: `db.orphanPhotos.toArray()` | Orphan gone | | |

**Expected Result:** ✅ Orphan cleanup after recovery
**Risk Level:** LOW

---

#### 5.4 Multiple Orphans Across Multiple Jobs

**Precondition:** Device 1, simulate 5 orphans from different jobs

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Device 1: Clear media: `db.media.clear()` | All media removed | | |
| 2 | Device 1: Trigger sync for jobs with photos | All missing photos logged as orphans | | |
| 3 | Check: `db.orphanPhotos.toArray()` | 5+ orphan entries with different jobIds | | |
| 4 | Group by jobId | Can identify which jobs are affected | | |
| 5 | Admin panel: Show orphans grouped | UI shows orphans by job | | |

**Expected Result:** ✅ Multiple orphans tracked separately
**Risk Level:** MEDIUM

---

### Scenario 6: Storage Quota Exceeded (5 tests)

#### 6.1 localStorage Quota Exceeded → Jobs Removed, Other Data Persists

**Precondition:** Device 1

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Fill localStorage to near capacity: Run quota fill test | `navigator.storage.estimate()` shows ~95% usage | | |
| 2 | Attempt to save large job list | First save succeeds, next fails | | |
| 3 | Check console for error: QuotaExceededError | Error logged | | |
| 4 | Verify fallback: Jobs removed, others saved | `localStorage.getItem('jobproof_jobs_v2')` is null | | |
| 5 | Verify: Clients/technicians still present | `localStorage.getItem('jobproof_clients_v2')` has data | | |
| 6 | Data available from Dexie/Supabase | Jobs still accessible (not lost) | | |

**Expected Result:** ✅ Graceful degradation: Jobs removed, fallback to IndexedDB
**Risk Level:** MEDIUM

---

#### 6.2 IndexedDB Quota Exceeded → User Gets Error

**Precondition:** Device 1, IndexedDB quota nearly full (simulate by filling with large blobs)

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Simulate full IndexedDB: Fill media table with large base64 strings | Quota usage high | | |
| 2 | Attempt to add new photo to job | Save fails with QuotaExceededError | | |
| 3 | Check UI: Error toast shown | User sees message: "Device storage full. Free up space." | | |
| 4 | Check console: Custom error type | `StorageQuotaExceededError` thrown | | |
| 5 | User can retry after cleanup or app gives option | Cleanup suggestions shown | | |

**Expected Result:** ✅ User informed, not silently failing
**Risk Level:** HIGH

---

#### 6.3 localStorage Quota + IndexedDB Quota Both Exceed

**Precondition:** Device 1, both storage systems near capacity

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Fill both localStorage and IndexedDB | Both at capacity | | |
| 2 | Try to save new job | Fails at IndexedDB level first | | |
| 3 | Error message clear | User gets "Device storage is full" message | | |
| 4 | Verify data not corrupted | Existing data still accessible | | |

**Expected Result:** ✅ App handles gracefully
**Risk Level:** HIGH

---

#### 6.4 Quota Recovery After Cleanup

**Precondition:** Device 1, from test 6.3 with full storage

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | User manually deletes old photos/jobs from UI | Storage usage decreases | | |
| 2 | Delete old completed jobs: `db.jobs.where('status').equals('Archived').delete()` | Space freed | | |
| 3 | Check quota again: `navigator.storage.estimate()` | Available space increased | | |
| 4 | Try to save new job again | Save succeeds | | |

**Expected Result:** ✅ Recovery after cleanup
**Risk Level:** LOW

---

### Scenario 7: Multiple Tabs/Windows (5 tests)

#### 7.1 Tab A Creates Job → Tab B Auto-Updates (SharedWorker or Direct Sync)

**Precondition:** Device 1, two tabs (A & B) of the app open, same account

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Both tabs: Navigate to Jobs list | Both show same jobs | | |
| 2 | Tab A: Create new job "Tab A Job" | Job appears in Tab A list | | |
| 3 | **Check Tab B without refresh** | **Option 1:** Job appears automatically | **Check which happens** | |
| 4 | | **Option 2:** Job doesn't appear until refresh | | |
| 5 | Tab B: Refresh page (F5) | Job appears in Tab B | | |
| 6 | Both tabs now in sync | Both show "Tab A Job" | | |

**Expected Result:** ⚠️ Either auto-sync (storage events) or refresh required
**Note:** Depends on implementation - no cross-tab sync required per CLAUDE.md, but storage events may handle it

**Risk Level:** LOW

---

#### 7.2 Tab A Goes Offline, Tab B Still Online

**Precondition:** Device 1, two tabs open

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Tab A: Simulate offline in DevTools | Tab A disconnected | | |
| 2 | Tab A: Create job "Offline in Tab A" | Job saved to IndexedDB | | |
| 3 | Tab B: Still online, refresh page | Tab B syncs from Supabase | | |
| 4 | Tab A: Go online | Tab A pulls from Supabase | | |
| 5 | Both tabs after sync | Both show consistent job list | | |

**Expected Result:** ✅ Tabs eventually consistent
**Risk Level:** LOW

---

#### 7.3 Concurrent Deletes (Tab A & B Delete Same Job)

**Precondition:** Device 1, two tabs, non-sealed job visible in both

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Tab A: Delete job "Test Job" | Job removed from Tab A | | |
| 2 | Tab B: Delete same job (before Tab A sync) | Tab B also attempts delete | | |
| 3 | First delete syncs to Supabase | Job deleted | | |
| 4 | Second delete attempt | Should handle gracefully (job already deleted) | | |
| 5 | Both tabs refresh | Job gone from both | | |

**Expected Result:** ✅ No data corruption
**Risk Level:** MEDIUM

---

#### 7.4 IndexedDB Shared Across Tabs

**Precondition:** Device 1, two tabs

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Tab A: Run in console: `const db = await (await import('./lib/offline/db')).getDb(); const count = await db.jobs.count();` | Job count = N | | |
| 2 | Tab B: Run same code | Job count = N (same) | | |
| 3 | Tab A: Add job to IndexedDB | Job added | | |
| 4 | Tab B: Query again | Sees new job (shared IndexedDB instance) | | |

**Expected Result:** ✅ IndexedDB is process-wide, tabs see same data
**Risk Level:** LOW

---

### Scenario 8: Offline Deletion (3 tests)

#### 8.1 Create Job Offline → Delete Offline → Go Online → Deletion Syncs

**Precondition:** Device 1, offline

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Device 1: Go offline | Network disabled | | |
| 2 | Device 1: Create job "Delete Offline Test" | Job saved to IndexedDB with `syncStatus: 'pending'` | | |
| 3 | Device 1: Verify in list | Job appears | | |
| 4 | Device 1: Delete job (still offline) | Job removed from UI and IndexedDB | | |
| 5 | Device 1: Check: Does sync queue track deletion? | Deletion queued (check localStorage sync queue) | | |
| 6 | Device 1: Go online | Network reconnected | | |
| 7 | Device 1: Monitor sync queue | Deletion processed → Job deleted from Supabase | | |
| 8 | Supabase: Query job table | Job NOT present | | |
| 9 | Device 1: Check IndexedDB: `db.jobs.toArray()` | Job NOT in database | | |

**Expected Result:** ✅ Offline deletion syncs correctly
**Risk Level:** MEDIUM

---

#### 8.2 Edit Job Offline → Delete It Offline → Undo (Can't Undo)

**Precondition:** Device 1, offline, existing job

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Device 1: Go offline | Network disabled | | |
| 2 | Device 1: Edit job (change status) | Change pending locally | | |
| 3 | Device 1: Delete job before sync | Job removed | | |
| 4 | Device 1: Try undo (Ctrl+Z or UI undo) | **Expected:** No undo available (not in Supabase yet) | | |
| 5 | Go online | Deletion syncs | | |
| 6 | Supabase: Job gone | Deleted as expected | | |

**Expected Result:** ⚠️ No undo for offline deletes (by design)
**Risk Level:** MEDIUM

---

#### 8.3 Multiple Offline Operations (Create, Edit, Delete) in Sequence

**Precondition:** Device 1, offline

| # | Step | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | Device 1: Go offline | Network disabled | | |
| 2 | Device 1: Create job A | Job A in IndexedDB | | |
| 3 | Device 1: Create job B | Job B in IndexedDB | | |
| 4 | Device 1: Edit job A | Update pending | | |
| 5 | Device 1: Delete job B | Job B removed | | |
| 6 | Device 1: Create job C | Job C in IndexedDB | | |
| 7 | Device 1: Go online | Sync processes in order | | |
| 8 | Supabase: Verify final state | Job A (updated), Job B (deleted), Job C (created) | | |

**Expected Result:** ✅ Sync queue processes all operations in order
**Risk Level:** MEDIUM

---

## Part 3: Test Execution Checklist

### Pre-Test Setup

- [ ] Clear all local browser data: `localStorage.clear(); sessionStorage.clear(); db.clear()`
- [ ] Log out all accounts
- [ ] Create 3 test accounts (admin-a, admin-b, tech-c)
- [ ] Ensure both accounts in same workspace
- [ ] Set up 2+ devices/browsers
- [ ] Verify internet connectivity on primary device

### Parallel Test Execution

| Device | Tester | Scenarios | Status |
|--------|--------|-----------|--------|
| Device 1 (Chrome) | Tester A | 1, 2, 3, 5, 6, 8 | |
| Device 2 (Firefox) | Tester B | 4 (cross-device with A) | |
| Device 3 (Mobile) | Tester C | 7 (tabs A & B on desktop) | |

### Sync Verification Commands

```bash
# After each major test, run:

# Check Supabase via psql (if available)
psql "postgresql://..." -c "
  SELECT id, title, status, sealed_at, updated_at FROM jobs
  WHERE workspace_id = 'test-workspace'
  ORDER BY updated_at DESC LIMIT 10;
"

# Monitor IndexedDB via DevTools
(async () => {
  const { getDb } = await import('./lib/offline/db.js');
  const db = await getDb();
  const jobs = await db.jobs.toArray();
  console.log(`Jobs in IndexedDB: ${jobs.length}`);
  jobs.forEach(j => console.log(`  - ${j.id}: ${j.title} (${j.status})`));
})();

# Check localStorage
console.log('localStorage items:', Object.keys(localStorage).length);
const jobs = JSON.parse(localStorage.getItem('jobproof_jobs_v2') || '[]');
console.log('Jobs in localStorage:', jobs.length);
```

---

## Part 4: Expected vs Actual Results Table

### Master Test Results

| # | Scenario | Test Case | Expected | Actual | Status | Notes |
|---|----------|-----------|----------|--------|--------|-------|
| 1.1 | Single Device | Job Creation Refresh | Job persists | | PENDING | |
| 1.2 | Single Device | Client Creation | Client persists | | PENDING | |
| 1.3 | Single Device | Technician Creation | Tech persists | | PENDING | |
| 1.4 | Single Device | Form Draft Auto-Save | Draft saved every keystroke | | PENDING | |
| 1.5 | Single Device | Multiple Drafts | 3 drafts coexist | | PENDING | |
| 1.6 | Single Device | Supabase Failure | IndexedDB survives | | PENDING | |
| 2.1 | Sealed Deletion | Delete Button Hidden | Button hidden after seal | | PENDING | |
| 2.2 | Sealed Deletion | API Delete Prevention | 403 error returned | | PENDING | |
| 2.3 | Sealed Deletion | Persist After Logout | Sealed status persists | | PENDING | |
| 2.4 | Sealed Deletion | Multiple Properties | All seal fields present | | PENDING | |
| 2.5 | Sealed Deletion | Multiple Sealed Jobs | All protected | | PENDING | |
| 3.1 | Invoiced Deletion | Delete Button Hidden | Button hidden | | PENDING | |
| 3.2 | Invoiced Deletion | Delete After Invoice Removal | Delete works after removal | | PENDING | |
| 3.3 | Invoiced Deletion | Double Protection | Both protections enforced | | PENDING | |
| 4.1 | Cross-Device | Create on A See on B | Job appears on Device B | | PENDING | |
| 4.2 | Cross-Device | Delete Syncs | Deletion appears on Device B | | PENDING | |
| 4.3 | Cross-Device | Edit Syncs | Changes appear on Device B | | PENDING | |
| 4.4 | Cross-Device | Concurrent Edits | Conflict resolved | | PENDING | |
| 4.5 | Cross-Device | Offline Then Online | Device catches up | | PENDING | |
| 4.6 | Cross-Device | Photo Upload Syncs | Photo URL syncs | | PENDING | |
| 5.1 | Orphans | Orphan Bug Test | No orphan reappearance | | PENDING | **CRITICAL BUG CHECK** |
| 5.2 | Orphans | Photo Orphan Log | Metadata preserved | | PENDING | |
| 5.3 | Orphans | Auto Cleanup | Orphan removed after recovery | | PENDING | |
| 5.4 | Orphans | Multiple Orphans | 5+ orphans tracked | | PENDING | |
| 6.1 | Quota Exceeded | localStorage Overflow | Jobs removed gracefully | | PENDING | |
| 6.2 | Quota Exceeded | IndexedDB Full | User error shown | | PENDING | |
| 6.3 | Quota Exceeded | Both Full | No corruption | | PENDING | |
| 6.4 | Quota Exceeded | Recovery | Save succeeds after cleanup | | PENDING | |
| 7.1 | Multi-Tab | Tab Auto-Sync | Job appears in Tab B | | PENDING | Storage events |
| 7.2 | Multi-Tab | Offline Tab | Tabs consistent after online | | PENDING | |
| 7.3 | Multi-Tab | Concurrent Delete | No data corruption | | PENDING | |
| 7.4 | Multi-Tab | IndexedDB Shared | Tabs see same data | | PENDING | |
| 8.1 | Offline Delete | Delete Syncs | Deletion syncs to Supabase | | PENDING | |
| 8.2 | Offline Delete | No Undo | No undo available | | PENDING | |
| 8.3 | Offline Delete | Multi-Op Sequence | All ops sync in order | | PENDING | |

---

## Part 5: Known Issues & Remediation

### Issue #1: Orphaned Records in IndexedDB (CRITICAL)

**Scenario:** Test 5.1
**Description:** After job deleted from Supabase, local IndexedDB may retain orphaned copy
**Impact:** User sees deleted job reappear after restart
**Root Cause:** `pullJobs()` in sync.ts doesn't delete locally-orphaned records
**Fix Needed:**

```typescript
// In lib/offline/sync.ts: _pullJobsImpl()
// After processing server jobs, delete any local jobs not on server

const serverJobIds = new Set(serverJobs.map(j => j.id));
const localJobs = await database.jobs.toArray();
const orphanedIds = localJobs
  .filter(lj => !serverJobIds.has(lj.id))
  .map(lj => lj.id);

// Delete orphaned jobs
for (const id of orphanedIds) {
  await database.jobs.delete(id);
  console.log(`[Sync] Deleted orphaned job: ${id}`);
}
```

**Status:** OPEN
**Priority:** P0-CRITICAL

---

### Issue #2: Deletion Protection Logic Missing in Components

**Scenario:** Tests 2.1, 3.1
**Description:** Delete buttons may not be hidden/disabled for sealed/invoiced jobs
**Root Cause:** Component logic doesn't check `sealedAt` or `invoiceId` before showing delete
**Fix Needed:** Check before rendering delete button

```typescript
// In JobDetail.tsx or JobCard.tsx
const canDelete = !job.sealedAt && !job.invoiceId;

return (
  <button
    disabled={!canDelete}
    title={job.sealedAt ? "Cannot delete sealed job" : "Delete"}
  >
    Delete
  </button>
);
```

**Status:** OPEN
**Priority:** P0-CRITICAL

---

### Issue #3: No Server-Side Deletion Validation

**Scenario:** Tests 2.2, 3.2
**Description:** Backend should reject deletes of sealed/invoiced jobs
**Root Cause:** Supabase RLS or Edge Function doesn't validate before delete
**Fix Needed:** Add RLS policy or Edge Function validation

```sql
-- In Supabase RLS policy on jobs table
CREATE POLICY "Prevent deleting sealed jobs" AS (
  DELETE TO jobs
  FOR DELETE
  USING (
    auth.uid() = user_id
    AND sealed_at IS NULL
    AND invoice_id IS NULL
  )
);
```

**Status:** OPEN
**Priority:** P0-CRITICAL

---

### Issue #4: localStorage Quota Degradation Needs User Feedback

**Scenario:** Test 6.1
**Description:** When localStorage full, jobs silently removed without user notification
**Root Cause:** DataContext catches error but doesn't show toast
**Fix Needed:** Show toast when localStorage degradation happens

**Status:** OPEN
**Priority:** P1-HIGH

---

### Issue #5: Cross-Tab Sync Not Implemented

**Scenario:** Test 7.1
**Description:** Create job in Tab A, Tab B doesn't auto-update without refresh
**Root Cause:** No SharedWorker or storage event listener
**Fix Needed:** Either add SharedWorker or storage event listeners (optional per CLAUDE.md)

**Status:** OPEN
**Priority:** P2-MEDIUM

---

## Part 6: Success Criteria

### All Tests Must Pass

```
PASS CRITERIA:
- ✅ 367+ existing unit tests pass: npm test -- --run
- ✅ All 34 scenarios complete with results documented
- ✅ No "ACTUAL: BUG" in results table
- ✅ Cross-device sync verified on 2+ devices
- ✅ Sealed job deletion prevented (API + UI)
- ✅ Invoiced job deletion prevented (API + UI)
- ✅ Orphaned records cleaned up on sync
- ✅ IndexedDB persists across app restart
- ✅ Form drafts auto-save and expire at 8 hours
- ✅ No data loss on storage quota exceeded
- ✅ Offline operations queue and retry
```

### Failure Criteria

```
FAIL CRITERIA:
- ❌ Orphaned records reappear after sync (Test 5.1)
- ❌ Sealed/invoiced jobs can be deleted (Tests 2, 3)
- ❌ Cross-device sync fails (Test 4)
- ❌ Data lost on app restart (Test 1)
- ❌ Storage quota crash without error message (Test 6)
```

---

## Part 7: Test Automation Scripts

### Run Tests in Headless Mode

```bash
# Run existing unit tests
npm test -- --run

# Run E2E tests (if configured)
npm run test:e2e

# Full test suite
npm test -- --run && npm run build
```

### Automated Offline Simulation

```typescript
// tests/integration/offline-persistence.test.ts

describe('Offline Persistence E2E', () => {
  beforeEach(async () => {
    // Simulate offline
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });
  });

  it('should persist job creation offline', async () => {
    const db = await getDb();
    const job: LocalJob = {
      id: 'offline-test-1',
      title: 'Offline Job',
      status: 'Pending',
      workspaceId: 'test-ws',
      syncStatus: 'pending',
      lastUpdated: Date.now(),
      // ... rest of job
    };

    await db.jobs.put(job);

    // Refresh (simulate page reload)
    const stored = await db.jobs.get('offline-test-1');
    expect(stored).toBeDefined();
    expect(stored?.title).toBe('Offline Job');
  });
});
```

---

## Part 8: Reporting Template

After completing all tests, fill in this summary:

```markdown
# Test Execution Report

**Date:** 2026-02-XX
**Tester:** [Name]
**Devices:** [List devices tested]
**Build:** [npm run build result]
**Test Suite:** [npm test -- --run result]

## Summary

- Total Tests: 67
- Passed: ___
- Failed: ___
- Blocked: ___
- Not Run: ___

## Critical Issues Found

1. [Issue Name] - [Status]
2. [Issue Name] - [Status]

## Cross-Device Results

- Device A (Chrome): [✅/❌]
- Device B (Firefox): [✅/❌]
- Device C (Mobile): [✅/❌]

## Approval

- Offline persistence verified: [✅/❌]
- Sealed job protection verified: [✅/❌]
- Invoiced job protection verified: [✅/❌]
- Cross-device sync verified: [✅/❌]
- Storage quota handling verified: [✅/❌]

**Ready for deployment:** [YES/NO]
```

---

## Appendix A: Command Reference

```bash
# Start dev server for testing
npm run dev

# Run unit tests
npm test -- --run

# Run with coverage
npm test -- --coverage

# Type check
npm run type-check

# Build (validates before deploy)
npm run build

# Deploy to staging
vercel deploy

# Deploy to production
vercel --prod

# Clear build cache
rm -rf node_modules/.cache
npm ci
```

## Appendix B: Console Utilities

Save this in your browser console for quick testing:

```javascript
// jobproof-test-utils.js - Paste into DevTools console

const JobProofTestUtils = {
  async checkIndexedDB() {
    const { getDb } = await import('./lib/offline/db.js');
    const db = await getDb();
    const jobs = await db.jobs.toArray();
    const clients = await db.clients.toArray();
    const techs = await db.technicians.toArray();
    console.table({
      'Jobs': jobs.length,
      'Clients': clients.length,
      'Technicians': techs.length
    });
    return { jobs, clients, techs };
  },

  async checkStorageQuota() {
    const est = await navigator.storage.estimate();
    console.log(`Usage: ${(est.usage / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Quota: ${(est.quota / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Available: ${((est.quota - est.usage) / 1024 / 1024).toFixed(2)}MB`);
  },

  checkSyncQueue() {
    const queue = JSON.parse(localStorage.getItem('jobproof_sync_queue') || '[]');
    console.log(`Pending syncs: ${queue.length}`);
    console.table(queue);
  },

  async clearLocalData() {
    const { clearAllData } = await import('./lib/offline/db.js');
    await clearAllData();
    localStorage.clear();
    sessionStorage.clear();
    console.log('✓ All local data cleared');
  }
};

// Usage: JobProofTestUtils.checkIndexedDB()
```

---

## Appendix C: Known Limitations

1. **No Real-Time Cross-Tab Sync:** Multiple tabs of the same app don't auto-update without refresh (acceptable per CLAUDE.md)
2. **Form Draft Expiry:** 8-hour window requires system time manipulation to test fully
3. **Storage Quota:** Hard to simulate realistic quota exceeded without filling device storage
4. **Photo Orphans:** Requires deliberate IndexedDB corruption to test recovery

---

## Appendix D: Future Test Enhancements

- [ ] Add Playwright E2E tests for multi-device scenarios
- [ ] Implement storage quota faker for quota tests
- [ ] Add real-time conflict resolution testing
- [ ] Test with slow network (Slow 3G throttling)
- [ ] Test with intermittent connectivity (random disconnects)
- [ ] Automate cross-account multi-workspace tests
- [ ] Monitor performance metrics during sync

---

**Document Version:** 1.0
**Last Updated:** February 2026
**Status:** READY FOR EXECUTION
**Approver:** [QA Lead]

For issues or updates to this plan, submit via: [Issue Tracker URL]
