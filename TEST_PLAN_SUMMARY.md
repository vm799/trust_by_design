# JobProof Test Plan - Executive Summary & Quick Reference

**Last Updated:** February 2026 | **Version:** 1.0 | **Status:** Ready for Execution

---

## Quick Test Matrix

| Scenario | # Tests | Focus Area | Risk Level | Critical |
|----------|---------|-----------|-----------|----------|
| **1. Single Device Persistence** | 6 | IndexedDB/localStorage durability | LOW | ✅ YES |
| **2. Sealed Job Deletion Protection** | 5 | Prevent deletion of sealed evidence | MEDIUM | ✅ YES |
| **3. Invoiced Job Deletion Protection** | 3 | Prevent deletion of invoiced jobs | MEDIUM | ✅ YES |
| **4. Cross-Device Sync** | 6 | Device A ↔ Device B consistency | HIGH | ✅ YES |
| **5. Orphaned Records** | 4 | Data integrity after sync failures | HIGH | ✅ YES (BUG) |
| **6. Storage Quota Exceeded** | 4 | Handle localStorage/IndexedDB full | HIGH | ✅ YES |
| **7. Multiple Tabs/Windows** | 4 | Tab A ↔ Tab B consistency | LOW | NO |
| **8. Offline Deletion** | 3 | Delete offline, sync online | MEDIUM | YES |
| **TOTAL** | **35** | **All scenarios** | **MIXED** | **8 Critical** |

---

## Test Execution Roadmap (3-Day Sprint)

### Day 1: Single Device Persistence (6 hours)
- ✅ Test 1.1-1.6: Job/Client/Tech offline persistence
- ✅ IndexedDB inspection via DevTools
- ✅ Form draft auto-save validation
- **Expected:** All tests PASS

### Day 2: Deletion Protection & Orphans (8 hours)
- ✅ Test 2.1-2.5: Sealed job protection
- ✅ Test 3.1-3.3: Invoiced job protection
- ✅ Test 5.1-5.4: Orphaned records (CRITICAL BUG CHECK)
- ✅ Test 6.1-6.4: Storage quota handling
- **Expected:** Tests 2,3,6 PASS | Test 5.1 may expose BUG

### Day 3: Cross-Device & Multi-Tab (6 hours)
- ✅ Test 4.1-4.6: Device A ↔ Device B sync
- ✅ Test 7.1-7.4: Multi-tab behavior
- ✅ Test 8.1-8.3: Offline deletion
- **Expected:** All tests PASS

---

## Critical Issues to Watch For

### 🔴 Issue #1: Orphaned Records Bug (Test 5.1)

**What to Test:**
```
1. Create job offline → Sync to Supabase
2. Delete job from Supabase (direct/UI)
3. App syncs → Pulls latest
4. Check: Does job reappear? (YES = BUG)
```

**Why Critical:** User sees deleted job come back after restart

**Expected:** Job removed from IndexedDB during sync
**Actual Risk:** Job may remain in IndexedDB (orphan)

**Remediation Needed:**
```typescript
// In lib/offline/sync.ts _pullJobsImpl():
const localJobs = await database.jobs.toArray();
const serverJobIds = new Set(serverJobs.map(j => j.id));
const orphaned = localJobs.filter(lj => !serverJobIds.has(lj.id));
for (const job of orphaned) await database.jobs.delete(job.id);
```

---

### 🔴 Issue #2: Deletion Protection Not Enforced

**What to Test:**
```
1. Seal a job
2. Try to delete via UI button
3. Try to delete via API call
```

**Expected:** Both blocked
**Actual Risk:** Deletion may succeed (no protection)

**Verification:**
- Check UI: Delete button should be hidden/disabled
- Check backend: Supabase RLS should reject DELETE

**Remediation Needed:**
- Frontend: Hide delete button when `sealedAt` or `invoiceId` present
- Backend: Add RLS policy rejecting deletes of sealed/invoiced jobs

---

### 🟡 Issue #3: No User Feedback on Storage Quota

**What to Test:**
```
1. Fill localStorage to 95% capacity
2. Try to save data
3. Check: Does user see error?
```

**Expected:** Toast/error message shown
**Actual Risk:** Silent failure (jobs removed from localStorage)

**Remediation Needed:**
- Show toast: "Local storage full. Data saved to cloud instead."

---

## Test Execution Checklist

### Pre-Test (30 min)
- [ ] Create 3 test accounts (admin-a, admin-b, tech-c) in same workspace
- [ ] Prepare 2+ devices/browsers (Chrome, Firefox recommended)
- [ ] Clear all local browser data: `localStorage.clear(); db.clear()`
- [ ] Verify Supabase connection available
- [ ] Print this document

### During Test (18 hours)
- [ ] Follow Day 1 → Day 2 → Day 3 roadmap
- [ ] Fill in results table as you go
- [ ] Screenshot failures for documentation
- [ ] Monitor console for errors/warnings

### Post-Test (2 hours)
- [ ] Compile all results into Test Report
- [ ] Identify any FAIL items
- [ ] Create GitHub issues for bugs
- [ ] Recommend go/no-go decision

---

## Device Setup Guide

### Setup Device 1 (Primary)

```bash
# Open Chrome DevTools (F12)

# Step 1: Clear all data
localStorage.clear()
sessionStorage.clear()

# Step 2: Check IndexedDB
# Go to Application > IndexedDB > JobProofOfflineDB
# Right-click > Delete Database

# Step 3: Open DevTools Console
# Paste these commands:

// Inspect current state
(async () => {
  const { getDb } = await import('./lib/offline/db.js');
  const db = await getDb();
  const jobs = await db.jobs.toArray();
  const storage = await navigator.storage.estimate();
  console.log('Jobs:', jobs.length);
  console.log('Storage:', `${(storage.usage/1024/1024).toFixed(2)}MB / ${(storage.quota/1024/1024).toFixed(2)}MB`);
})();

# Step 4: Test Offline Mode
# DevTools > Network > Offline (checkbox)
# Refresh page - should still work
```

### Setup Device 2 (Cross-Device Testing)

```bash
# Same as Device 1, but use Firefox or Safari
# Login with admin-b@jobproof-test.local (same workspace)
# This allows cross-device sync testing
```

---

## Key DevTools Commands

### Monitor IndexedDB During Test

```javascript
// Run this every 5 minutes to track changes
(async () => {
  const { getDb } = await import('./lib/offline/db.js');
  const db = await getDb();
  const data = {
    jobs: await db.jobs.count(),
    queue: await db.queue.count(),
    media: await db.media.count(),
    drafts: await db.formDrafts.count(),
    clients: await db.clients.count(),
    technicians: await db.technicians.count()
  };
  console.table(data);
})();
```

### Monitor Sync Queue

```javascript
// Watch what's pending sync
const queue = JSON.parse(localStorage.getItem('jobproof_sync_queue') || '[]');
const failed = JSON.parse(localStorage.getItem('jobproof_failed_sync_queue') || '[]');
console.log(`Pending: ${queue.length}, Failed: ${failed.length}`);
console.table(queue.map(q => ({ id: q.id, type: q.type, retries: q.retryCount })));
```

### Simulate Network Conditions

```javascript
// Offline mode
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: false
});

// Back online
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
});

// Check current status
console.log('Online:', navigator.onLine);
```

---

## Pass/Fail Indicators

### ✅ PASS Scenario Examples

**Test 1.1 (Job Offline Persistence):**
- Job created offline → IndexedDB has entry ✓
- Refresh page → Job still in list ✓
- IndexedDB query shows `syncStatus: 'pending'` ✓
- Go online → Job syncs, `syncStatus: 'synced'` ✓

**Test 2.1 (Sealed Job Protection):**
- Job sealed → `sealedAt` timestamp present ✓
- Delete button hidden or disabled ✓
- API delete returns 403 Forbidden ✓
- Job still exists in Supabase ✓

### ❌ FAIL Scenario Examples

**Test 1.1 (FAILS if):**
- Refresh page → Job disappears ❌
- IndexedDB empty after going offline ❌
- No sync after going online ❌

**Test 2.1 (FAILS if):**
- Delete button visible when sealed ❌
- Job deleted from Supabase when sealed ❌
- No error message on delete attempt ❌

**Test 5.1 (FAILS if - CRITICAL BUG):**
- Delete job from Supabase ❌
- App syncs and pulls latest ❌
- **Job reappears in list** ❌ ← This is the orphan bug!

---

## Metrics to Track

For each test, record:

| Metric | Description | Example |
|--------|-------------|---------|
| **Duration** | How long did test take? | 15 minutes |
| **Sync Time** | How long until sync complete? | 5 seconds (online) |
| **Storage Used** | Before/after IndexedDB size | 2.1 MB → 2.3 MB |
| **Errors** | Any console errors? | 0 errors expected |
| **Retries** | How many sync retries needed? | 0 (online), 1-3 (offline) |

---

## What to Do If Test Fails

### Scenario: Test 5.1 Shows Orphaned Job Reappears

1. **Confirm the bug:**
   ```javascript
   // Check if orphaned job in IndexedDB
   (async () => {
     const { getDb } = await import('./lib/offline/db.js');
     const db = await getDb();
     const jobs = await db.jobs.toArray();
     const orphaned = jobs.find(j => j.syncStatus === 'synced' && /* not on server */);
     console.log('Orphaned job:', orphaned);
   })();
   ```

2. **Document the bug:**
   - Screenshot IndexedDB state
   - Note job ID, creation time
   - Record Supabase sync timestamp
   - Create GitHub issue with label `bug:orphaned-records`

3. **Temporary workaround for testing:**
   - Manually delete orphaned job from IndexedDB:
   ```javascript
   (async () => {
     const { getDb } = await import('./lib/offline/db.js');
     const db = await getDb();
     await db.jobs.delete('orphaned-job-id');
   })();
   ```

4. **Block deployment** until fixed (P0-CRITICAL)

---

### Scenario: Test 2.1 Delete Button Still Visible When Sealed

1. **Verify the job is actually sealed:**
   ```javascript
   // Check job properties
   (async () => {
     const { getDb } = await import('./lib/offline/db.js');
     const db = await getDb();
     const job = await db.jobs.get('sealed-job-id');
     console.log('Sealed:', job.sealedAt, 'IsSealed:', job.isSealed);
   })();
   ```

2. **Check UI logic:**
   - Open DevTools Inspector
   - Find delete button element
   - Check if `disabled` attribute or CSS hides it
   - Look for `job.sealedAt` check in component code

3. **Create GitHub issue:**
   - Label: `bug:deletion-protection`
   - Priority: P0-CRITICAL
   - Affected component: JobDetail.tsx or JobCard.tsx

4. **Block deployment** until fixed

---

## Success Criteria Summary

```
✅ All Tests Pass If:

1. Single Device:
   - Jobs/clients/techs persist across refresh
   - Form drafts auto-save every keystroke
   - 8-hour draft expiry works

2. Sealed/Invoiced:
   - Delete buttons hidden when sealed/invoiced
   - API rejects delete with 403 error
   - Status persists across logout/login

3. Cross-Device:
   - Create on Device A → appears on Device B
   - Delete on Device A → removed from Device B
   - Edits sync within 5-10 seconds

4. Orphans:
   - No orphaned records reappear after sync
   - Photo metadata preserved if data lost
   - Multiple orphans tracked separately

5. Storage:
   - localStorage overflow handled gracefully
   - IndexedDB full shows user error
   - No silent data loss

6. Offline:
   - Operations queue when offline
   - Queue syncs in order when online
   - No data corruption on sync
```

---

## Test Results Template

```markdown
# Test Execution Results

**Date:** ___________
**Tester:** ___________
**Build Version:** ___________

## Test Results by Day

### Day 1: Single Device (Tests 1.1-1.6)
- [ ] Test 1.1 Job Persistence: ✅ PASS / ❌ FAIL
- [ ] Test 1.2 Client Persistence: ✅ PASS / ❌ FAIL
- [ ] Test 1.3 Tech Persistence: ✅ PASS / ❌ FAIL
- [ ] Test 1.4 Form Draft Save: ✅ PASS / ❌ FAIL
- [ ] Test 1.5 Multi Drafts: ✅ PASS / ❌ FAIL
- [ ] Test 1.6 Supabase Failure: ✅ PASS / ❌ FAIL

**Summary:** ___ PASS, ___ FAIL

### Day 2: Protection & Orphans (Tests 2.1-6.4)
[Similar format...]

### Day 3: Cross-Device (Tests 4.1-8.3)
[Similar format...]

## Overall Results

- **Total Tests:** 35
- **Passed:** ___
- **Failed:** ___
- **Blocked:** ___

## Critical Issues Found

1. [Issue] - [Severity] - [Status: OPEN/FIXED]
2. [Issue] - [Severity] - [Status: OPEN/FIXED]

## Deployment Recommendation

- [ ] ✅ READY FOR DEPLOYMENT
- [ ] ⚠️ READY WITH KNOWN ISSUES (list above)
- [ ] ❌ NOT READY (P0 bugs must be fixed)
```

---

## Reference: Full Test Plan Location

For detailed test steps, preconditions, and commands:

📄 **File:** `/home/user/trust_by_design/TEST_PLAN_PERSISTENCE_DELETION.md`

- Part 1: Environment Setup (pages 3-5)
- Part 2: Test Scenarios (pages 6-22) ← Most detailed
- Part 3: Execution Checklist (pages 23-24)
- Part 4: Results Table (pages 25-27)
- Part 5: Known Issues (pages 28-32)
- Part 6-8: Automation & Appendices (pages 33-40)

---

## Support & Issues

**Questions during testing?**
1. Check the full TEST_PLAN_PERSISTENCE_DELETION.md
2. Review DevTools console for error messages
3. Check Supabase logs for sync failures
4. Create GitHub issue with:
   - Screenshot
   - Console logs
   - Steps to reproduce
   - Expected vs actual behavior

**Report bugs to:** [QA Channel/Email]
**Deployment decisions:** [Product Owner]

---

**Ready to start testing? Begin with Day 1 setup in the full test plan document.**

**Print this page for quick reference during testing sessions.**
