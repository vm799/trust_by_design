# JobProof Testing - Quick Reference Card
**Print & Keep With You While Testing**

---

## 🎯 Test Overview (One Page)

| Scenario | Tests | Duration | Critical? | Status |
|----------|-------|----------|-----------|--------|
| 1️⃣ Single Device Persistence | 1.1-1.6 | 6h | YES | PENDING |
| 2️⃣ Sealed Job Protection | 2.1-2.5 | 5h | YES | PENDING |
| 3️⃣ Invoiced Job Protection | 3.1-3.3 | 3h | YES | PENDING |
| 4️⃣ Cross-Device Sync | 4.1-4.6 | 6h | YES | PENDING |
| 5️⃣ Orphaned Records | 5.1-5.4 | 4h | YES* | PENDING |
| 6️⃣ Storage Quota | 6.1-6.4 | 4h | YES | PENDING |
| 7️⃣ Multi-Tab | 7.1-7.4 | 4h | NO | PENDING |
| 8️⃣ Offline Deletion | 8.1-8.3 | 3h | YES | PENDING |
| **TOTAL** | **35** | **20h** | **8 critical** | |

*Test 5.1 may expose CRITICAL BUG (orphaned records)

---

## 🔧 Pre-Test Checklist (15 min)

```
SETUP COMPLETE?
□ 3 test accounts created (admin-a, admin-b, tech-c)
□ All in SAME workspace
□ 2+ browsers/devices available
□ Cleared all localStorage/IndexedDB
□ DevTools ready (F12)
□ Internet connection stable
□ Phone/screenshot capability ready

QUICK TEST:
□ Can access app at localhost:3000 or deployment URL
□ Can login with admin-a account
□ Can see Jobs/Clients/Technicians list
□ DevTools Console accessible
```

---

## 📱 Day 1 Execution (6 hours) - Single Device Persistence

### Test 1.1: Job Offline Persist (5 min)
```
GO OFFLINE → Create Job → Refresh → Job Still Here?
✅ YES → PASS
❌ NO → FAIL - Screenshot + check console
```

**Quick Check Commands:**
```javascript
// Is job in IndexedDB?
(await (await import('./lib/offline/db')).getDb()).jobs.toArray()

// Does it have right status?
// Job.syncStatus should be 'pending' (offline) then 'synced' (online)
```

### Test 1.2-1.3: Client & Tech Offline (4 min each)
Same pattern as 1.1 but for clients/technicians

### Test 1.4: Form Draft Auto-Save (5 min)
```
Type slowly in Job form → Draft saves every keystroke?
✅ YES (check IndexedDB) → PASS
❌ NO draft saved → FAIL
```

### Test 1.5: Multi Drafts (6 min)
```
Edit 3 different forms (Job, Client, Tech)
✅ All 3 in IndexedDB → PASS
❌ Only 1 saved → FAIL
```

### Test 1.6: Supabase Down (5 min)
```
Block Supabase in DevTools Network
Create job offline
Unblock Supabase
✅ Job stays in IndexedDB, syncs when available → PASS
❌ Job lost → FAIL
```

**Day 1 Expected:** ✅ 6/6 PASS

---

## 🔐 Day 2 Execution (8 hours) - Protection & Orphans

### Test 2.1: Sealed Job → No Delete Button (8 min)
```
1. Seal a completed job
2. Open job detail
3. Look for delete button

✅ Button HIDDEN/DISABLED → PASS
❌ Button visible → FAIL - CRITICAL BUG
```

**Quick Check:** `job.sealedAt` should have timestamp

### Test 2.2: Try Delete Sealed via API (5 min)
```
Sealed job → Try delete in console
const {deleteJob} = useData(); deleteJob('sealed-id')

✅ Error shown "Cannot delete sealed job" → PASS
❌ Job deleted → FAIL - CRITICAL
```

### Test 2.3: Sealed Persists After Logout (6 min)
```
1. Seal job
2. Logout/Login
3. Open sealed job
4. Check delete button

✅ Still hidden → PASS
❌ Visible → FAIL
```

### Test 2.4-2.5: Sealed + Invoiced, Multiple Sealed (6 min each)
```
Sealed + Invoice = Double protection?
Multiple sealed jobs = All protected?

✅ YES → PASS
❌ Any deletable → FAIL - CRITICAL
```

### Test 3.1: Invoiced Job → No Delete (6 min)
```
Create invoice for job
Open job detail
Check delete button

✅ Hidden → PASS
❌ Visible → FAIL - CRITICAL
```

### Test 3.2: Delete Invoice → Delete Job Works (6 min)
```
1. Invoice job (delete button hidden)
2. Delete invoice
3. Refresh
4. Check job again

✅ Delete button now visible & works → PASS
❌ Still hidden → FAIL
```

### Test 3.3: Sealed + Invoiced (6 min)
```
Both protections on same job
Try every way to delete

✅ All blocked → PASS
❌ Any path works → FAIL - CRITICAL
```

### Tests 5.1-5.4: Orphans (Total 18 min) 🔴 CRITICAL
```
TEST 5.1 - THE BUG CHECK:
1. Create job offline
2. Sync to Supabase
3. Delete job from Supabase (admin)
4. App syncs/refreshes

✅ Job gone from IndexedDB → PASS
❌ Job reappears = BUG! → FAIL - P0 CRITICAL

⚠️ IF FAIL: STOP TESTING, CREATE GITHUB ISSUE
```

**Quick Check:**
```javascript
// After syncing deletion, check:
(await (await import('./lib/offline/db')).getDb()).jobs.count()
// Should be 1 less than before
```

### Tests 6.1-6.4: Storage Quota (4 min each)
```
6.1: Fill localStorage → Can still work?
6.2: Fill IndexedDB → User gets error?
6.3: Both full → No crash?
6.4: Delete data → Can save again?

✅ YES to all → PASS
❌ Silent failure → FAIL
```

**Day 2 Expected:** ✅ 17/17 PASS (except maybe 5.1 bug)

---

## 🌍 Day 3 Execution (6 hours) - Cross-Device & Multi-Tab

### Test 4.1: Device A Creates → Device B Sees (8 min)
```
Device A (OFFLINE): Create job "Test Cross"
Device A (ONLINE): Wait 10 sec for sync
Device B: Refresh page

✅ "Test Cross" appears on Device B → PASS
❌ Only on Device A → FAIL
```

### Test 4.2: Delete on A → B Reflects (6 min)
```
Device A: Delete job
Device B: Refresh

✅ Job gone on B → PASS
❌ Still on B → FAIL
```

### Test 4.3: Edit on A → B Sees (6 min)
```
Device A: Change job status/notes
Device B: Refresh

✅ Change visible on B → PASS
❌ Old data on B → FAIL
```

### Test 4.4: Concurrent Edit (6 min)
```
Device A & B: Edit SAME field
Both save quickly

⚠️ One version wins → OK (conflict resolution)
❌ Corruption → FAIL
```

### Test 4.5: A Offline, B Online (8 min)
```
Device A: OFFLINE
Device B: Create job
Device A: GO ONLINE

✅ Device A sees Device B's job → PASS
❌ Job missing → FAIL
```

### Test 4.6: Photo Syncs (8 min)
```
Device A: Add photo
Device B: Refresh

✅ Photo visible on B → PASS
❌ Photo missing → FAIL
```

### Tests 7.1-7.4: Multi-Tab (4 min each)
```
7.1: Tab A creates → Tab B sees? (refresh ok)
7.2: Tab A offline, B online → sync works?
7.3: Concurrent delete → no crash?
7.4: IndexedDB shared → both tabs same data?

✅ YES → PASS
❌ Data diverge → FAIL
```

### Tests 8.1-8.3: Offline Deletion (3 min each)
```
8.1: Create offline → Delete offline → Sync online → GONE?
8.2: No undo for offline delete?
8.3: Multiple ops in order?

✅ YES → PASS
❌ Data issues → FAIL
```

**Day 3 Expected:** ✅ 18/18 PASS

---

## 🚨 Critical Failures to Watch For

| Test | Failure = Bug | Severity | Action |
|------|---------------|----------|--------|
| 5.1 | Orphaned job reappears | 🔴 P0 | STOP - Create issue |
| 2.1, 2.2 | Sealed job deletable | 🔴 P0 | STOP - Create issue |
| 3.1, 3.2 | Invoiced job deletable | 🔴 P0 | STOP - Create issue |
| 4.1, 4.2 | Cross-device not syncing | 🔴 P0 | STOP - Create issue |
| 6.2 | IndexedDB full crashes app | 🟡 P1 | Continue, doc issue |

**If ANY 🔴 FAILS: Block deployment**

---

## 📋 Results Tracking (Fill As You Go)

```
DAY 1 (Single Device)
1.1 □ ✅ PASS  1.2 □ ✅ PASS  1.3 □ ✅ PASS
1.4 □ ✅ PASS  1.5 □ ✅ PASS  1.6 □ ✅ PASS
  └─ Day 1: 6/6

DAY 2 (Protection & Orphans)
2.1 □ ✅ PASS  2.2 □ ✅ PASS  2.3 □ ✅ PASS
2.4 □ ✅ PASS  2.5 □ ✅ PASS  3.1 □ ✅ PASS
3.2 □ ✅ PASS  3.3 □ ✅ PASS  5.1 □ ✅ PASS ⚠️
5.2 □ ✅ PASS  5.3 □ ✅ PASS  5.4 □ ✅ PASS
6.1 □ ✅ PASS  6.2 □ ✅ PASS  6.3 □ ✅ PASS
6.4 □ ✅ PASS
  └─ Day 2: 17/17

DAY 3 (Cross-Device & Multi-Tab)
4.1 □ ✅ PASS  4.2 □ ✅ PASS  4.3 □ ✅ PASS
4.4 □ ✅ PASS  4.5 □ ✅ PASS  4.6 □ ✅ PASS
7.1 □ ✅ PASS  7.2 □ ✅ PASS  7.3 □ ✅ PASS
7.4 □ ✅ PASS  8.1 □ ✅ PASS  8.2 □ ✅ PASS
8.3 □ ✅ PASS
  └─ Day 3: 18/18

TOTAL: 35/35 PASS (100%) ✅ READY FOR DEPLOYMENT
```

---

## 🖥️ Essential Console Commands

**Bookmark these for quick access:**

### Check IndexedDB
```javascript
(async()=>{const db=await(await import('./lib/offline/db')).getDb();
console.log('Jobs:',await db.jobs.count(),
'Clients:',await db.clients.count(),
'Queue:',await db.queue.count())})()
```

### Check Sync Queue
```javascript
const q=JSON.parse(localStorage.getItem('jobproof_sync_queue')||'[]');
console.log('Pending syncs:',q.length,q)
```

### Check Storage
```javascript
navigator.storage.estimate().then(e=>console.log(
`Use: ${(e.usage/1024/1024).toFixed(1)}MB / ${(e.quota/1024/1024).toFixed(1)}MB`))
```

### Clear All Data
```javascript
(async()=>{const{clearAllData}=await import('./lib/offline/db');
await clearAllData();localStorage.clear();console.log('✓ Cleared')})()
```

### Check Job Sealed Status
```javascript
(async()=>{const db=await(await import('./lib/offline/db')).getDb();
const j=await db.jobs.where('id').equals('JOB_ID').first();
console.log('Sealed:',!!j.sealedAt,'Sealed At:',j.sealedAt)})()
```

---

## 📸 Screenshot Checklist

**Capture these for documentation:**

- [ ] Test 1.1: IndexedDB with pending job
- [ ] Test 2.1: Sealed job detail (no delete button)
- [ ] Test 2.2: Error toast "Cannot delete sealed job"
- [ ] Test 4.1: Job on Device B after Device A sync
- [ ] Test 5.1: IndexedDB after orphan deletion (empty)
- [ ] Test 6.2: Error toast "Device storage full"
- [ ] Any FAIL test: Console error + UI state

---

## ⏱️ Time Tracking

```
Start Time: _____ (Date/Time)
Day 1 End: _____
Day 2 End: _____
Day 3 End: _____
Total Time: _____ hours

Notes:
_____________________________________________
_____________________________________________
```

---

## 🐛 Issue Template (For Failures)

When a test fails:

```
Title: [Test #.#] Brief Description

Body:
## Test Case
[Scenario name and number]

## Expected
[What should happen]

## Actual
[What happened instead]

## Steps to Reproduce
1. [Step 1]
2. [Step 2]

## Screenshot
[Attach]

## Console Error
[Paste error]

## Environment
- Browser: [Chrome/Firefox/Safari]
- Device: [Desktop/Mobile]
- OS: [Windows/Mac/iOS/Android]
```

---

## ✅ Sign-Off

When all tests complete:

```
FINAL RESULTS:
✅ Passed: ___ / 35
❌ Failed: ___ / 35
Pass Rate: ___%

CRITICAL ISSUES: ___
(Must be 0 to deploy)

Tester Signature: __________________
Date: __________________

Recommendation:
[ ] ✅ READY FOR DEPLOYMENT
[ ] ⚠️ READY WITH KNOWN ISSUES
[ ] ❌ NOT READY (P0 bugs exist)
```

---

## 📞 Support Contacts

**Questions during testing?**
1. Check `TEST_PLAN_PERSISTENCE_DELETION.md` (full details)
2. Check `TEST_MATRIX_DETAILED.md` (test case specifics)
3. Check `TEST_PLAN_SUMMARY.md` (overview)
4. Check console for error messages
5. Create GitHub issue if blocked

**File Locations:**
- 📄 Full Test Plan: `TEST_PLAN_PERSISTENCE_DELETION.md`
- 📋 Test Matrix: `TEST_MATRIX_DETAILED.md`
- 📊 Summary: `TEST_PLAN_SUMMARY.md`
- 🎟️ This Card: `TESTER_QUICK_REFERENCE.md`

---

## 🎬 Quick Start (For First-Time Testers)

1. **Read This Card** (5 min) ← You are here
2. **Print It** (1 page)
3. **Complete Pre-Test Checklist** (15 min)
4. **Day 1: Tests 1.1-1.6** (6 hours)
   - If all PASS → continue to Day 2
   - If any FAIL → stop, document, create issue
5. **Day 2: Tests 2.1-6.4** (8 hours)
   - Watch for Test 5.1 (orphan bug risk)
   - If critical fail → STOP, don't continue to Day 3
6. **Day 3: Tests 4.1-8.3** (6 hours)
   - Should be smooth if Days 1-2 passed
7. **Sign-Off** (1 hour documentation)

**Total: 20 hours over 3 days**

---

**Version:** 1.0
**Last Updated:** February 2026
**Print Date:** __________

*Keep with you while testing. Good luck!*
