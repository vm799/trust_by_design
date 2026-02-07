# JobProof Test Matrix - Detailed Test Cases

**Last Updated:** February 2026 | **Total Test Cases:** 35 | **Estimated Duration:** 20 hours

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Test should PASS |
| ❌ | Test indicates BUG if FAILS |
| ⚠️ | Known limitation, partial functionality acceptable |
| 🔴 | CRITICAL - blocks deployment |
| 🟡 | HIGH - should fix before release |
| 🟢 | MEDIUM/LOW - nice to have |

---

## Test Matrix: All 35 Test Cases

### Category 1: Single Device Persistence (6 tests)

#### 1.1 Job Creation → Refresh → Persists ✅
- **Priority:** 🔴 CRITICAL
- **Duration:** 5 min
- **Setup:** Device 1 (Chrome), offline mode enabled
- **Steps:**
  1. Go offline: DevTools > Network > Offline
  2. Create job: Title="Test Job 1", Client="Acme", Date="2026-02-15"
  3. Verify: Job in list with "pending" status
  4. Verify: IndexedDB has job - Run: `(await (await import('./lib/offline/db')).getDb()).jobs.get('job-id')`
  5. Refresh page (F5)
  6. Verify: Job still in list
  7. Go online
  8. Verify: Job syncs to Supabase (check console for `[Sync] Pulled...`)

**Expected Result:** ✅ Job survives refresh, syncs when online
**Fail Condition:** Job disappears on refresh
**Pass Threshold:** 5/5 checks pass

---

#### 1.2 Client Creation Offline → Persists ✅
- **Priority:** 🔴 CRITICAL
- **Duration:** 4 min
- **Setup:** Device 1, offline
- **Steps:**
  1. Go offline
  2. Navigate: Clients > Create Client
  3. Fill: Name="Test Client X", Email="client@test.com", Phone="555-1234"
  4. Save
  5. Verify: Client appears in list
  6. Verify: IndexedDB - `(await (await import('./lib/offline/db')).getDb()).clients.where('name').equals('Test Client X').count()` = 1
  7. Refresh page
  8. Verify: Client still visible
  9. Go online, refresh
  10. Verify: Client in Supabase

**Expected Result:** ✅ Client persists offline and syncs
**Fail Condition:** Client lost on refresh
**Pass Threshold:** 8/10 checks pass

---

#### 1.3 Technician Creation Offline → Persists ✅
- **Priority:** 🔴 CRITICAL
- **Duration:** 4 min
- **Setup:** Device 1, offline
- **Steps:**
  1. Go offline
  2. Navigate: Technicians > Create Technician
  3. Fill: Name="Tech Test", Email="tech@test.com", Status="Available"
  4. Save
  5. Verify: Tech appears in list
  6. Verify: IndexedDB - `(await (await import('./lib/offline/db')).getDb()).technicians.count()` > 0
  7. Kill browser completely
  8. Restart browser, navigate to app
  9. Verify: Tech appears in list
  10. Go online
  11. Verify: Tech syncs to Supabase

**Expected Result:** ✅ Tech survives app restart
**Fail Condition:** Tech lost after app close
**Pass Threshold:** 9/11 checks pass

---

#### 1.4 Form Draft Auto-Save Every Keystroke ✅
- **Priority:** 🔴 CRITICAL
- **Duration:** 5 min
- **Setup:** Device 1, offline, Job creation form open
- **Steps:**
  1. Clear drafts: `(await (await import('./lib/offline/db')).getDb()).formDrafts.clear()`
  2. Type "T" in Job Title field
  3. Wait 2 seconds
  4. Type "e" (so "Te" now)
  5. Check: `(await (await import('./lib/offline/db')).getDb()).formDrafts.get('job')`
  6. Continue typing slowly: "st Job"
  7. Stop typing, wait 1.5 seconds
  8. Check IndexedDB draft again
  9. Verify: `savedAt` timestamp is recent (within 2 seconds)
  10. Refresh page
  11. Verify: Form field pre-populated with draft

**Expected Result:** ✅ Draft saved after keystroke pause
**Fail Condition:** Draft not saved or not restored
**Pass Threshold:** 9/11 checks pass

---

#### 1.5 Multiple Form Drafts Coexist ✅
- **Priority:** 🟡 HIGH
- **Duration:** 6 min
- **Setup:** Device 1, offline
- **Steps:**
  1. Start Job creation, type a title, navigate away
  2. Verify: Job draft saved in IndexedDB
  3. Navigate to Client creation, type a name, navigate away
  4. Navigate to Tech creation, type a name, navigate away
  5. Check: `(await (await import('./lib/offline/db')).getDb()).formDrafts.toArray()` = 3 entries
  6. Verify: formTypes are ['job', 'client', 'technician']
  7. Refresh page, navigate to each form
  8. Verify: Each form pre-filled from its draft

**Expected Result:** ✅ 3+ drafts coexist without conflict
**Fail Condition:** Only one draft saved, others overwritten
**Pass Threshold:** 7/8 checks pass

---

#### 1.6 IndexedDB Data Survives Supabase Failure ✅
- **Priority:** 🟡 HIGH
- **Duration:** 5 min
- **Setup:** Device 1, online but Supabase blocked
- **Steps:**
  1. Open DevTools > Network tab
  2. Block supabase.co: Type "supabase" in filter, right-click > Block request URL
  3. Create new job "Offline Job"
  4. Verify: Job saves to IndexedDB (local persistence works)
  5. Go online (unblock Supabase in DevTools)
  6. Refresh page
  7. Verify: Job still in list (from IndexedDB)
  8. Wait 10 seconds
  9. Verify: Job eventually syncs (console shows `[Sync]` messages)
  10. Check Supabase: Job present in DB

**Expected Result:** ✅ Data safe in IndexedDB even when Supabase down
**Fail Condition:** Job lost when Supabase unavailable
**Pass Threshold:** 8/10 checks pass

---

### Category 2: Sealed Job Deletion Protection (5 tests)

#### 2.1 Seal Job → Delete Button Hidden ✅
- **Priority:** 🔴 CRITICAL
- **Duration:** 8 min
- **Setup:** Device 1, online, existing completed job with photos
- **Steps:**
  1. Navigate to Jobs > find a job with all photos uploaded
  2. Verify: Job status is "Submitted"
  3. Verify: All photos have `syncStatus: 'synced'`
  4. Click "Seal Evidence" or await auto-seal trigger
  5. Verify: Seal dialog or confirmation shown
  6. Confirm seal action
  7. Wait 3 seconds for sync
  8. Verify: Console shows `[Auto-Seal] Successfully sealed...`
  9. Check Supabase directly: `SELECT sealed_at FROM jobs WHERE id='...';` - should have timestamp
  10. Refresh page
  11. Open job detail again
  12. **Verify: Delete button is NOT visible** (hidden or disabled)
  13. Inspect element: Check `<button>` is `disabled` or `style="display:none"`

**Expected Result:** ✅ Delete button hidden after seal
**Fail Condition:** ❌ Delete button still clickable when sealed
**Pass Threshold:** 11/13 checks pass

---

#### 2.2 Seal Job → Try to Delete via API → Error Shown ✅
- **Priority:** 🔴 CRITICAL
- **Duration:** 5 min
- **Setup:** Device 1, sealed job from test 2.1
- **Steps:**
  1. Open sealed job detail
  2. Verify: No delete option visible
  3. Open DevTools Console
  4. Attempt delete via DataContext: `const { deleteJob } = useData(); deleteJob('sealed-job-id')`
  5. Monitor console: Should show error or warning
  6. Verify: Job still in list (not deleted)
  7. Check Supabase: Job still exists
  8. Check UI: Error toast should appear "Cannot delete sealed job"

**Expected Result:** ✅ Delete rejected, error shown
**Fail Condition:** ❌ Job deleted when sealed
**Pass Threshold:** 6/8 checks pass

---

#### 2.3 Seal Job → Logout/Login → Delete Still Blocked ✅
- **Priority:** 🟡 HIGH
- **Duration:** 6 min
- **Setup:** Device 1, sealed job from test 2.1
- **Steps:**
  1. Sealed job visible in list with "Sealed" badge
  2. Click Logout
  3. Verify: Redirected to /auth
  4. Login again: admin-a@jobproof-test.local
  5. Wait for data load
  6. Navigate to Jobs list
  7. Find sealed job
  8. Verify: "Sealed" badge still visible
  9. Open job detail
  10. **Verify: Delete button NOT visible**
  11. Check DataContext: Job has `sealedAt` timestamp
  12. Verify: Supabase job still has sealed_at timestamp

**Expected Result:** ✅ Sealed status persists across sessions
**Fail Condition:** ❌ Sealed status lost after logout/login
**Pass Threshold:** 10/12 checks pass

---

#### 2.4 Sealed + Invoiced Job (Double Protection) ✅
- **Priority:** 🟡 HIGH
- **Duration:** 7 min
- **Setup:** Device 1, sealed job from test 2.1
- **Steps:**
  1. Take sealed job, create invoice for it
  2. Verify: Job now has both `sealedAt` and `invoiceId`
  3. Try to delete via UI: No button visible
  4. Try to delete via API (simulated)
  5. **Verify: Error message includes both "sealed" AND "invoiced"**
  6. Delete invoice
  7. Try to delete job: Should still fail (sealed)
  8. Verify: Sealed status prevents deletion even after invoice removed

**Expected Result:** ✅ Both protections enforced
**Fail Condition:** ❌ Either protection bypassed
**Pass Threshold:** 6/8 checks pass

---

#### 2.5 Multiple Sealed Jobs → All Protected ✅
- **Priority:** 🟢 MEDIUM
- **Duration:** 4 min
- **Setup:** Device 1, 3+ sealed jobs visible
- **Steps:**
  1. Navigate to Jobs list
  2. Verify: All sealed jobs show "Sealed" badge
  3. For each sealed job:
     - Open detail
     - Verify: No delete button visible
  4. Try bulk delete (if available): Should skip sealed jobs or show error
  5. Verify: All jobs still exist

**Expected Result:** ✅ All sealed jobs protected
**Fail Condition:** ❌ Any sealed job deletable
**Pass Threshold:** 4/5 checks pass

---

### Category 3: Invoiced Job Deletion Protection (3 tests)

#### 3.1 Invoice Job → Delete Button Hidden ✅
- **Priority:** 🔴 CRITICAL
- **Duration:** 6 min
- **Setup:** Device 1, online, completed job
- **Steps:**
  1. Open completed job with status "Submitted"
  2. Navigate to Invoice section
  3. Create invoice: Total=$1500, Notes="Final Payment"
  4. Save invoice
  5. Verify: Invoice created in list
  6. Verify: Job now has `invoiceId` property
  7. Refresh page
  8. Verify: Invoice persists
  9. Open job detail again
  10. **Verify: Delete button NOT visible**
  11. Try to delete via DataContext: Should show error "Cannot delete invoiced job"

**Expected Result:** ✅ Delete button hidden for invoiced job
**Fail Condition:** ❌ Job deletable when invoiced
**Pass Threshold:** 9/11 checks pass

---

#### 3.2 Delete Invoice → Can Now Delete Job ✅
- **Priority:** 🔴 CRITICAL
- **Duration:** 6 min
- **Setup:** Device 1, invoiced job from test 3.1
- **Steps:**
  1. Verify: Invoiced job, delete button hidden
  2. Navigate to Invoices section
  3. Find invoice for this job
  4. Delete invoice
  5. Verify: Invoice removed from list
  6. Refresh page
  7. Verify: Invoice gone
  8. Navigate back to job detail
  9. **Verify: Delete button NOW visible**
  10. Click delete
  11. **Verify: Job deleted successfully**
  12. Verify: Job removed from Supabase

**Expected Result:** ✅ Delete enabled after invoice removal
**Fail Condition:** ❌ Delete still blocked or button still hidden
**Pass Threshold:** 10/12 checks pass

---

#### 3.3 Sealed AND Invoiced Job (Cannot Delete Either Way) ✅
- **Priority:** 🟡 HIGH
- **Duration:** 6 min
- **Setup:** Device 1, sealed job from test 2.1 with invoice
- **Steps:**
  1. Take sealed job, create invoice for it
  2. Verify: `sealedAt` AND `invoiceId` both present
  3. Try to delete via UI: No button
  4. Try via API: 403 Forbidden
  5. Delete invoice
  6. Try to delete again: Still fails (sealed)
  7. Verify: Sealed prevents deletion regardless of invoice
  8. Try to unseal (if mechanism exists): Should fail or require admin
  9. Verify: Job permanently locked

**Expected Result:** ✅ Both protections must be satisfied
**Fail Condition:** ❌ Job deletable if only one protection removes
**Pass Threshold:** 7/9 checks pass

---

### Category 4: Cross-Device Sync (6 tests)

#### 4.1 Create on Device A (Offline) → Device B Sees It ✅
- **Priority:** 🔴 CRITICAL
- **Duration:** 8 min
- **Setup:** Device 1 (offline), Device 2 (online), both logged in as admin-a@jobproof-test.local
- **Steps:**
  1. Device 1: Go offline (DevTools > Offline)
  2. Device 1: Create job "Cross-Device Test 1"
  3. Device 1: Verify in IndexedDB: `syncStatus: 'pending'`
  4. Device 1: Go online
  5. Device 1: Wait 5-10 seconds (sync processes)
  6. Device 1: Check console: `[Sync] Pulled...` appears
  7. Device 1: Verify in IndexedDB: `syncStatus: 'synced'`
  8. Device 2: Refresh page
  9. **Device 2: Check jobs list → "Cross-Device Test 1" appears**
  10. Device 2: Click into job → All data present

**Expected Result:** ✅ Job syncs to Device B
**Fail Condition:** ❌ Job doesn't appear on Device B
**Pass Threshold:** 9/10 checks pass

---

#### 4.2 Delete on Device A → Device B Reflects Deletion ✅
- **Priority:** 🔴 CRITICAL
- **Duration:** 6 min
- **Setup:** Device 1 & 2 online, same account, job from test 4.1 exists
- **Steps:**
  1. Both devices: "Cross-Device Test 1" visible in jobs list
  2. Device 1: Delete job (if not sealed)
  3. Device 1: Verify removed from UI
  4. Device 1: Check console: Sync queue processes deletion
  5. Supabase: Query jobs table → job_id NOT present
  6. Device 2: Refresh page
  7. **Device 2: "Cross-Device Test 1" no longer in list**
  8. Device 2: Check IndexedDB: Job not present

**Expected Result:** ✅ Deletion syncs across devices
**Fail Condition:** ❌ Job reappears on Device B or persists
**Pass Threshold:** 7/8 checks pass

---

#### 4.3 Edit on Device A → Device B Sees Changes ✅
- **Priority:** 🟡 HIGH
- **Duration:** 6 min
- **Setup:** Device 1 & 2, same account, job exists
- **Steps:**
  1. Both devices: Create or find job "Cross-Device Edit Test"
  2. Device 1: Open job detail
  3. Device 1: Change status "In Progress" → "Complete"
  4. Device 1: Add note "Finished ahead of schedule"
  5. Device 1: Save/sync
  6. Device 1: Wait 5 seconds
  7. Device 2: Refresh page
  8. Device 2: Open same job
  9. **Device 2: Status = "Complete", note visible**
  10. Verify: lastUpdated timestamp updated

**Expected Result:** ✅ Edits sync across devices
**Fail Condition:** ❌ Changes not visible on Device B
**Pass Threshold:** 9/10 checks pass

---

#### 4.4 Concurrent Edits (Device A & B Edit Same Field) ⚠️
- **Priority:** 🟡 HIGH
- **Duration:** 6 min
- **Setup:** Device 1 & 2, same account, job with notes field
- **Steps:**
  1. Both devices: Open same job detail
  2. Device 1: Change notes to "Edit from Device A"
  3. Device 2: Change notes to "Edit from Device B"
  4. Device 1: Click save (syncs first)
  5. Device 2: Click save (detects conflict)
  6. Check console: `[Sync] Conflict detected...` message appears
  7. Refresh both devices
  8. Verify: One version wins (determined by timestamp or conflict rules)
  9. Notes field shows one of the edits (not corrupted)

**Expected Result:** ⚠️ Conflict handled gracefully (not necessarily both preserved)
**Fail Condition:** ❌ Data corruption or error thrown
**Pass Threshold:** 7/9 checks pass

---

#### 4.5 Offline Device A, Online Device B → Eventually Consistent ✅
- **Priority:** 🟡 HIGH
- **Duration:** 8 min
- **Setup:** Device 1 offline, Device 2 online, same account
- **Steps:**
  1. Device 1: Go offline
  2. Device 2: Create job "Device B Only Job"
  3. Device 2: Verify job syncs to Supabase
  4. Device 1: Still offline, jobs list doesn't show new job
  5. Device 1: Go online
  6. Device 1: Sync pull fetches latest
  7. **Device 1: "Device B Only Job" now appears in list**
  8. Device 1: Can open and view job details
  9. Verify: Timestamps match between devices

**Expected Result:** ✅ Offline device catches up when reconnected
**Fail Condition:** ❌ Data doesn't sync after going online
**Pass Threshold:** 8/9 checks pass

---

#### 4.6 Photo Upload on Device A → Device B Sees Public URL ✅
- **Priority:** 🟡 HIGH
- **Duration:** 8 min
- **Setup:** Device 1 & 2, job with no photos
- **Steps:**
  1. Device 1: Open job, add photo (capture or upload)
  2. Device 1: Wait for sync: Console shows `[Sync] Photo uploaded...`
  3. Device 1: Check IndexedDB: Photo has `syncStatus: 'synced'` and public URL
  4. Device 1: Verify Supabase Storage: Photo file exists
  5. Device 2: Refresh page
  6. Device 2: Open same job
  7. **Device 2: Photo visible with public URL**
  8. Device 2: Click photo → loads from Supabase Storage
  9. Both devices: Photo in same state

**Expected Result:** ✅ Photos sync across devices with URLs
**Fail Condition:** ❌ Photo doesn't appear or shows as IndexedDB ref
**Pass Threshold:** 8/9 checks pass

---

### Category 5: Orphaned Records - Data Integrity (4 tests)

#### 5.1 Orphaned Job Reappearance BUG TEST 🔴 CRITICAL BUG DETECTION
- **Priority:** 🔴 CRITICAL
- **Duration:** 10 min
- **Setup:** Device 1, online
- **Steps:**
  1. Device 1: Create job "Orphan Test Job" offline, verify in IndexedDB
  2. Device 1: Go online
  3. Device 1: Wait for sync: Job syncs to Supabase
  4. Verify: Supabase has job with `sync_status: 'synced'`
  5. Verify: IndexedDB shows `syncStatus: 'synced'`
  6. **Admin Panel (different session):** Delete job directly from Supabase (via SQL or UI)
  7. Verify: Job deleted from Supabase
  8. Device 1: Force refresh/go online again
  9. Device 1: Pull from Supabase (refresh page or manual sync)
  10. **Device 1: Check jobs list → "Orphan Test Job" should NOT appear**
  11. **Device 1: Check IndexedDB: `(await (await import('./lib/offline/db')).getDb()).jobs.get('orphan-test-job-id')` should be UNDEFINED**
  12. **If job still in IndexedDB = BUG ❌ (ORPHANED RECORD)**

**Expected Result:** ✅ Job removed from IndexedDB during sync pull
**Actual Risk:** ❌ BUG LIKELY: Job remains as orphan
**Fail Condition:** Job in IndexedDB but not in Supabase
**Pass Threshold:** ALL 12 checks must pass (critical)

**⚠️ IF TEST FAILS:**
- This is CRITICAL BUG: orphaned records
- Block deployment
- Create P0 GitHub issue
- See TEST_PLAN_PERSISTENCE_DELETION.md Part 5 for remediation code

---

#### 5.2 Photo Orphan Metadata Preservation ✅
- **Priority:** 🟡 HIGH
- **Duration:** 7 min
- **Setup:** Device 1, job with 3 uploaded photos
- **Steps:**
  1. Create/find job with 3 photos all synced
  2. Simulate IndexedDB data loss: `(await (await import('./lib/offline/db')).getDb()).media.clear()`
  3. Attempt to sync job again
  4. Monitor sync: Console should show photo sync failures
  5. Check orphanPhotos table: `(await (await import('./lib/offline/db')).getDb()).orphanPhotos.toArray()`
  6. **Verify: 3 orphan entries with metadata:**
     - photo.id ✓
     - photo.type (before/during/after) ✓
     - photo.timestamp ✓
     - photo.reason = "IndexedDB data lost" ✓
  7. Navigate to admin panel: Check "Orphan Photos" recovery view
  8. Verify: 3 orphans listed with job title and photo details

**Expected Result:** ✅ Photo metadata preserved in orphan log
**Fail Condition:** ❌ Metadata lost or orphan log not created
**Pass Threshold:** 7/8 checks pass

---

#### 5.3 Orphan Photo Auto-Cleanup After Recovery ✅
- **Priority:** 🟢 MEDIUM
- **Duration:** 5 min
- **Setup:** Device 1, orphan photo from test 5.2
- **Steps:**
  1. From orphan log, re-upload orphaned photo manually
  2. Photo syncs successfully
  3. Verify: Photo now has `syncStatus: 'synced'` in main job
  4. Call cleanup: `(await (await import('./lib/offline/db')).getDb()).orphanPhotos.delete(orphan_id)` OR auto-cleanup triggers
  5. Check orphanPhotos table: `(await (await import('./lib/offline/db')).getDb()).orphanPhotos.toArray()`
  6. **Verify: Orphan entry removed**
  7. Admin panel: Orphan list updated

**Expected Result:** ✅ Orphan cleanup after recovery
**Fail Condition:** ❌ Orphan entry persists after recovery
**Pass Threshold:** 6/7 checks pass

---

#### 5.4 Multiple Orphans Across Jobs (Tracking) ✅
- **Priority:** 🟢 MEDIUM
- **Duration:** 6 min
- **Setup:** Device 1, simulate 5 orphans from different jobs
- **Steps:**
  1. Clear media: `(await (await import('./lib/offline/db')).getDb()).media.clear()`
  2. Trigger sync for multiple jobs with photos
  3. Monitor: All missing photos logged as orphans
  4. Check: `(await (await import('./lib/offline/db')).getDb()).orphanPhotos.toArray()`
  5. **Verify: 5+ orphan entries with different jobIds**
  6. Verify: Each orphan has correct jobId and job title
  7. Admin panel: Show orphans grouped by job
  8. Can filter orphans by job
  9. Metadata preserved for each

**Expected Result:** ✅ Multiple orphans tracked separately
**Fail Condition:** ❌ Orphans merged/lost
**Pass Threshold:** 8/9 checks pass

---

### Category 6: Storage Quota Exceeded (4 tests)

#### 6.1 localStorage Quota Exceeded → Graceful Degradation ✅
- **Priority:** 🟡 HIGH
- **Duration:** 8 min
- **Setup:** Device 1
- **Steps:**
  1. Fill localStorage to ~95% capacity:
     ```javascript
     for(let i=0;i<100;i++)localStorage.setItem(`test_${i}`,'x'.repeat(50000));
     ```
  2. Check storage: `(await navigator.storage.estimate()).usage / (await navigator.storage.estimate()).quota > 0.95`
  3. Attempt to save DataContext (create/update job)
  4. Monitor console: QuotaExceededError caught
  5. Check: `localStorage.getItem('jobproof_jobs_v2')` = null (jobs removed)
  6. Verify: Other keys persist:
     - `localStorage.getItem('jobproof_clients_v2')` still present ✓
     - `localStorage.getItem('jobproof_technicians_v2')` still present ✓
  7. Verify: Data still accessible from Dexie/Supabase
  8. Jobs list still shows (from IndexedDB or Supabase)

**Expected Result:** ✅ Jobs removed from localStorage, others saved, no data loss
**Fail Condition:** ❌ Data corruption or silent failure
**Pass Threshold:** 7/8 checks pass

---

#### 6.2 IndexedDB Quota Exceeded → User Error Shown ✅
- **Priority:** 🟡 HIGH
- **Duration:** 7 min
- **Setup:** Device 1, IndexedDB quota nearly full
- **Steps:**
  1. Simulate full IndexedDB: Fill media table with large base64 strings
     ```javascript
     const db=await(await import('./lib/offline/db')).getDb();
     for(let i=0;i<50;i++) {
       await db.media.put({
         id:`large_${i}`,
         jobId:'test',
         data:'x'.repeat(1000000), // 1MB each
         createdAt: Date.now()
       });
     }
     ```
  2. Check quota: `(await navigator.storage.estimate()).usage / (await navigator.storage.estimate()).quota > 0.95`
  3. Attempt to add new photo
  4. Monitor: Save fails with QuotaExceededError
  5. **Verify: UI shows error toast:** "Device storage is full. Free up space."
  6. Console: `StorageQuotaExceededError` type thrown
  7. User can see what failed (photo upload)
  8. No silent failure

**Expected Result:** ✅ User informed immediately
**Fail Condition:** ❌ Silent failure or app crash
**Pass Threshold:** 7/8 checks pass

---

#### 6.3 Both localStorage AND IndexedDB Full → Handles Gracefully ✅
- **Priority:** 🟡 HIGH
- **Duration:** 8 min
- **Setup:** Device 1, both storage systems near capacity
- **Steps:**
  1. Fill localStorage: `for(let i=0;i<100;i++)localStorage.setItem(\`test_\${i}\`,'x'.repeat(50000));`
  2. Fill IndexedDB: (as in test 6.2)
  3. Verify both near capacity
  4. Try to save new job
  5. Fails at IndexedDB level (first write attempt)
  6. Error message clear: "Device storage is full"
  7. Existing data not corrupted
  8. App remains functional (can read, just not write)

**Expected Result:** ✅ App gracefully handles full storage
**Fail Condition:** ❌ Data corruption or crash
**Pass Threshold:** 7/8 checks pass

---

#### 6.4 Storage Quota Recovery After Cleanup ✅
- **Priority:** 🟢 MEDIUM
- **Duration:** 6 min
- **Setup:** Device 1, from test 6.3 with full storage
- **Steps:**
  1. User manually deletes old photos/jobs from UI
  2. Old completed jobs deleted: `await db.jobs.delete(...)`
  3. Old photos deleted
  4. Check quota: `(await navigator.storage.estimate()).usage` decreases
  5. Verify available space increases
  6. Try to save new job again
  7. **Save succeeds**
  8. New job appears in list

**Expected Result:** ✅ Recovery after cleanup
**Fail Condition:** ❌ Can't recover space or still fails
**Pass Threshold:** 7/8 checks pass

---

### Category 7: Multiple Tabs/Windows (4 tests)

#### 7.1 Tab A Creates Job → Tab B Auto-Syncs (or Requires Refresh) ⚠️
- **Priority:** 🟢 MEDIUM
- **Duration:** 5 min
- **Setup:** Device 1, Chrome with 2 tabs (A & B) open, same account
- **Steps:**
  1. Tab A & B: Both show jobs list
  2. Tab A: Create new job "Tab A Job"
  3. Tab A: Verify job appears
  4. **Check Tab B WITHOUT refresh:**
     - **Option 1:** Job appears automatically (storage events) ✓
     - **Option 2:** Job doesn't appear yet ⚠️ (acceptable, refresh required)
  5. Tab B: Refresh page (F5)
  6. **Tab B: "Tab A Job" appears**
  7. Both tabs now in sync

**Expected Result:** ⚠️ Either auto-sync or refresh-sync acceptable
**Fail Condition:** ❌ Job doesn't appear even after refresh
**Pass Threshold:** 5/7 checks pass

---

#### 7.2 Tab A Offline, Tab B Online → Eventually Consistent ⚠️
- **Priority:** 🟢 MEDIUM
- **Duration:** 6 min
- **Setup:** Device 1, Chrome with 2 tabs
- **Steps:**
  1. Tab A: Simulate offline (DevTools for just Tab A impossible, use localStorage marker instead)
  2. Tab A: Create job "Offline in Tab A"
  3. Tab A: Verify in IndexedDB (shared)
  4. Tab B: Still online, refresh page
  5. Tab B: Syncs from Supabase (shows online jobs)
  6. Tab A: Go "online" again (remove offline marker)
  7. **Both tabs:** Job list eventually consistent
  8. Verify: No data corruption

**Expected Result:** ⚠️ Eventually consistent (acceptable delay)
**Fail Condition:** ❌ Jobs diverge permanently
**Pass Threshold:** 6/8 checks pass

---

#### 7.3 Concurrent Delete (Tab A & B Delete Same Job) ✅
- **Priority:** 🟡 HIGH
- **Duration:** 5 min
- **Setup:** Device 1, Chrome with 2 tabs, non-sealed job
- **Steps:**
  1. Tab A & B: Both show same job "Delete Race Test"
  2. Tab A: Click delete
  3. Tab B: Click delete (before Tab A syncs)
  4. Tab A: Delete syncs to Supabase (job deleted)
  5. Tab B: Delete attempt (job already deleted)
  6. Monitor: Should handle gracefully (no error thrown)
  7. Both tabs refresh
  8. **Verify: Job gone from both tabs, no data corruption**

**Expected Result:** ✅ No data corruption
**Fail Condition:** ❌ Error thrown or conflicted state
**Pass Threshold:** 7/8 checks pass

---

#### 7.4 IndexedDB Shared Across Tabs ✅
- **Priority:** 🟢 MEDIUM
- **Duration:** 4 min
- **Setup:** Device 1, Chrome with 2 tabs
- **Steps:**
  1. Tab A: Run in console:
     ```javascript
     (async () => {
       const { getDb } = await import('./lib/offline/db.js');
       const db = await getDb();
       const count = await db.jobs.count();
       console.log('Tab A jobs:', count);
     })();
     ```
  2. Tab B: Run same code
  3. **Verify: Both return same count**
  4. Tab A: Add job to IndexedDB: `db.jobs.put({...})`
  5. Tab B: Query again
  6. **Verify: Sees new job (shared IndexedDB)**

**Expected Result:** ✅ IndexedDB process-wide, tabs share instance
**Fail Condition:** ❌ Tabs see different IndexedDB states
**Pass Threshold:** 5/6 checks pass

---

### Category 8: Offline Deletion (3 tests)

#### 8.1 Create Offline → Delete Offline → Sync Online → Gone ✅
- **Priority:** 🔴 CRITICAL
- **Duration:** 8 min
- **Setup:** Device 1, offline
- **Steps:**
  1. Device 1: Go offline
  2. Device 1: Create job "Delete Offline Test"
  3. Verify: IndexedDB shows `syncStatus: 'pending'`
  4. Device 1: Delete job (still offline)
  5. Verify: Job removed from UI and IndexedDB
  6. Check localStorage sync queue: Does deletion operation exist?
  7. Device 1: Go online
  8. Wait 5-10 seconds for sync
  9. Monitor console: Sync processes deletion
  10. **Verify: Job NOT in Supabase** (SELECT * FROM jobs WHERE id = '...' returns null)
  11. **Verify: Job NOT in IndexedDB** after sync

**Expected Result:** ✅ Offline deletion syncs correctly, job gone
**Fail Condition:** ❌ Job reappears or deletion not synced
**Pass Threshold:** 10/11 checks pass

---

#### 8.2 Edit + Delete Offline → No Undo ⚠️
- **Priority:** 🟢 MEDIUM
- **Duration:** 5 min
- **Setup:** Device 1, offline, existing job
- **Steps:**
  1. Device 1: Go offline
  2. Device 1: Edit job (change status)
  3. Verify: Change in IndexedDB with `syncStatus: 'pending'`
  4. Device 1: Delete job before syncing edit
  5. Job removed
  6. Try undo (Ctrl+Z or UI undo button): **Should NOT appear/work**
  7. Reason: Edit never reached Supabase, so no undo possible
  8. Go online
  9. Verify: Deletion syncs (job gone)

**Expected Result:** ⚠️ No undo for offline deletes (by design)
**Fail Condition:** ❌ Undo shows or job comes back
**Pass Threshold:** 6/8 checks pass

---

#### 8.3 Multi-Op Sequence (Create, Edit, Delete) → Syncs in Order ✅
- **Priority:** 🟡 HIGH
- **Duration:** 7 min
- **Setup:** Device 1, offline
- **Steps:**
  1. Device 1: Go offline
  2. Device 1: Create Job A
  3. Device 1: Create Job B
  4. Device 1: Edit Job A (change notes)
  5. Device 1: Delete Job B
  6. Device 1: Create Job C
  7. Verify: IndexedDB shows all 3 jobs (A, C with updated notes for A)
  8. Verify: Sync queue has operations in order
  9. Device 1: Go online
  10. Wait for sync
  11. **Verify Supabase state:**
     - Job A exists (with updated notes) ✓
     - Job B does NOT exist (deleted) ✓
     - Job C exists (created) ✓
  12. **All operations applied in correct order**

**Expected Result:** ✅ Sync queue processes all ops in FIFO order
**Fail Condition:** ❌ Operations out of order or missing
**Pass Threshold:** 11/12 checks pass

---

## Test Results Tracking Template

```markdown
# Test Results - [Date: YYYY-MM-DD]

## Category 1: Single Device Persistence (6 tests)
- [ ] 1.1 Job Creation: ✅ PASS / ❌ FAIL / ⏭️ SKIP
  - Notes: ___________
- [ ] 1.2 Client Creation: ✅ PASS / ❌ FAIL / ⏭️ SKIP
- [ ] 1.3 Tech Creation: ✅ PASS / ❌ FAIL / ⏭️ SKIP
- [ ] 1.4 Form Draft Auto-Save: ✅ PASS / ❌ FAIL / ⏭️ SKIP
- [ ] 1.5 Multiple Drafts: ✅ PASS / ❌ FAIL / ⏭️ SKIP
- [ ] 1.6 Supabase Failure: ✅ PASS / ❌ FAIL / ⏭️ SKIP

**Category Total: ___ / 6 PASS**

## Category 2: Sealed Job Deletion (5 tests)
- [ ] 2.1 Delete Button Hidden: ✅ PASS / ❌ FAIL / ⏭️ SKIP
- [ ] 2.2 API Delete Prevention: ✅ PASS / ❌ FAIL / ⏭️ SKIP
- [ ] 2.3 Persist After Logout: ✅ PASS / ❌ FAIL / ⏭️ SKIP
- [ ] 2.4 Double Protection: ✅ PASS / ❌ FAIL / ⏭️ SKIP
- [ ] 2.5 Multiple Sealed Jobs: ✅ PASS / ❌ FAIL / ⏭️ SKIP

**Category Total: ___ / 5 PASS**

[Continue for all 8 categories...]

## Overall Summary

- **Total Tests:** 35
- **Passed:** ___
- **Failed:** ___
- **Skipped:** ___
- **Pass Rate:** ___ %

## Critical Issues

1. [Issue Name] - P0 - [ ] FIXED / [ ] BLOCKED

## Deployment Recommendation

- [ ] ✅ READY (all tests pass)
- [ ] ⚠️ READY WITH ISSUES (known items, documented)
- [ ] ❌ BLOCKED (P0 failures must be fixed)
```

---

## Summary: Test Execution Statistics

| Metric | Value |
|--------|-------|
| Total Test Cases | 35 |
| Critical (P0) | 8 |
| High (P1) | 13 |
| Medium (P2) | 10 |
| Low (P3) | 4 |
| Estimated Duration | 20 hours |
| Required Devices | 2-3 |
| Pass Threshold | 90%+ (32/35) |
| Known Bug Risk | Test 5.1 (Orphans) |

---

**Next Steps:**
1. Print TEST_PLAN_SUMMARY.md for quick reference
2. Review this matrix before testing
3. Follow Day 1-3 roadmap in summary
4. Fill in results as you execute each test
5. Report any FAIL results to GitHub

**Questions?** See full TEST_PLAN_PERSISTENCE_DELETION.md document.
