# QA Testing Plan: JobProof Week 3 Validation
## Archive Strategy + Audit Export + Sync Conflicts

**Document Version:** 1.0
**Date:** February 2026
**Status:** Ready for QA Execution
**Test Environment:** Staging (staging.jobproof.pro)
**Duration:** 3-4 business days
**Test Lead:** QA Team

---

## Executive Summary

### What's Being Tested

Week 3 introduces three critical features for enterprise compliance and offline-first reliability:

1. **Archive Strategy (Fix 3.1):** 180-day automatic job archival with manual override capability
2. **Audit Export (Fix 3.2):** Multi-format (CSV/JSON) evidence export with SHA-256 integrity verification
3. **Sync Conflicts (Fix 3.3):** Conflict detection, resolution UI, and reconciliation strategy

### Why Testing Matters

- **Compliance Risk:** Archival strategy must not delete evidence prematurely
- **Data Integrity:** Audit exports must match source data cryptographically
- **User Experience:** Sync conflicts must resolve without data loss
- **Performance:** Enterprise deployments with 10K+ jobs must maintain <3s response times
- **Regression Prevention:** Weeks 1-2 features (auth, offline queue, evidence capture) must remain intact

### Business Impact

- **Compliance:** Meets SOC 2 audit trail requirements
- **Enterprise Sales:** Audit export enables data recovery and regulatory verification
- **Field Operations:** Sync conflict resolution keeps offline-first workers productive
- **Stability:** Archive thresholds prevent database bloat

---

## Test Objectives

### Primary Goals

| Objective | Success Criteria | Owner |
|-----------|-----------------|-------|
| Validate 180-day archive logic | 0 false positives, <5% false negatives | QA Engineer #1 |
| Verify audit export integrity | SHA-256 hashes match, <2% data loss | QA Engineer #2 |
| Test conflict detection | 100% detection rate for simultaneous edits | QA Engineer #1 |
| Verify conflict resolution UI | All 4 strategies display correctly | QA Engineer #3 |
| Regression testing | Weeks 1-2 features: 0 regressions | QA Engineer #2 |
| Load testing | 10K jobs: <3s load, <150MB memory | QA Engineer #3 |
| Performance testing | 60fps scroll, <100ms interactions | QA Engineer #1 |
| Cross-browser | Chrome, Firefox, Safari, Edge | QA Engineer #2 |

### Pass/Fail Criteria

**PASS:** All test cases marked ✅, zero critical bugs, regression suite green
**FAIL:** Any critical bug (data loss, auth bypass, crash), regression failure
**CONDITIONAL:** Minor UI issues can proceed with ticket if non-blocking

---

## Test Environment Setup

### Prerequisites

```bash
# Verify test environment
✓ Staging database: Fresh copy of production data (anonymized)
✓ Network: Simulated latency (100ms), packet loss (5%)
✓ Browsers: Latest versions (Chrome 132+, Firefox 133+, Safari 17+)
✓ Devices: Desktop (1920x1080), Tablet (iPad Pro), Mobile (iPhone 15)
✓ VPN: Connected to staging subnet
✓ Test Accounts: See Appendix A (passwords in 1Password)
```

### Test Data Preparation

```sql
-- SQL setup for QA environment
-- Archive threshold testing (requires 180+ day old jobs)
INSERT INTO jobs (...) VALUES (
  id: 'job-180-days',
  created_at: NOW() - INTERVAL '180 days',
  status: 'Complete',
  archived: false
);

-- Conflict testing (simultaneous edits)
INSERT INTO jobs (...) VALUES (
  id: 'job-conflict-test',
  created_at: NOW(),
  status: 'In Progress',
  updated_at: NOW(),
  conflict_marker: NULL
);

-- Audit export testing (high-evidence jobs)
INSERT INTO jobs (...) VALUES (
  id: 'job-audit-10-photos',
  evidence_count: 10,
  has_sealed_evidence: true
);
```

---

## Detailed Test Cases

### Fix 3.1: Archive Strategy (180-Day Threshold)

#### QA-001: Archive Threshold Calculation

**Objective:** Verify 180-day threshold is calculated correctly from job completion date

**Test Steps:**
1. Log in as Admin (test account: qa-admin@jobproof.pro)
2. Navigate to Admin Dashboard → Archive Management
3. Create/view job completed exactly 180 days ago
4. Open Developer Tools → Network tab
5. Trigger archive scan via "Run Archival Check Now" button
6. Observe API request to `/api/admin/archive-jobs`
7. Check job status field in Network response

**Expected Results:**
- Archive scan completes within 5 seconds
- Job status changes from `Complete` to `Archived`
- `archived_at` timestamp set to current UTC time
- Job appears in "Archived Jobs" view
- Network response: `{"archived": 1, "duration_ms": 2845}`

**Pass/Fail Criteria:**
- ✅ Job archived exactly at 180-day mark
- ✅ Response time <5 seconds
- ✅ Timestamp recorded accurately
- ❌ FAIL: Job archived before 180 days (false positive)
- ❌ FAIL: Job not archived after 180 days (false negative)

**Notes:**
- Use server time, not client time (prevents timezone issues)
- 180 days = 15,552,000 seconds
- Include jobs completed on leap years in test set

---

#### QA-002: Archive Bulk Operation (1000+ Jobs)

**Objective:** Verify archive operation scales for large job counts

**Test Steps:**
1. Prepare test dataset: 1,247 jobs (mix of statuses, ages)
   - 1,000 jobs completed 180+ days ago
   - 200 jobs completed <180 days ago
   - 47 jobs with status != 'Complete'
2. Navigate to Admin Dashboard → Archive Management
3. Verify UI shows count: "1,000 jobs eligible for archival"
4. Click "Archive All Eligible Jobs"
5. Monitor progress bar in UI
6. Check browser Developer Tools → Performance tab
7. Wait for completion notification
8. Query database: `SELECT COUNT(*) FROM jobs WHERE archived=true`

**Expected Results:**
- Progress bar shows 0→100% over 8-12 seconds
- UI remains responsive (no frozen screen)
- Database count shows exactly 1,000 archived
- Memory usage remains <200MB (measured via DevTools)
- Network requests are batched (5-10 bulk operations, not 1,000)
- Notification: "✓ Archived 1,000 jobs in 10.2s"

**Pass/Fail Criteria:**
- ✅ All 1,000 jobs archived correctly
- ✅ Other 247 jobs remain unarchived
- ✅ Operation time <15 seconds
- ✅ Memory spike <100MB
- ❌ FAIL: UI freezes (janky progress bar)
- ❌ FAIL: Wrong count archived (off-by-one errors)
- ❌ FAIL: Memory usage >300MB

**Notes:**
- Monitor Safari memory leaks (common with large DOM updates)
- Batch size should be 100-200 jobs per request (configurable)

---

#### QA-003: Manual Archive Override

**Objective:** Verify admin can manually archive incomplete jobs

**Test Steps:**
1. Log in as Admin
2. Navigate to specific job with status "In Progress" completed 100 days ago
3. Click three-dot menu → "Archive Manually"
4. Confirm dialog: "This job is not yet eligible for automatic archival (80 days remaining). Archive anyway?"
5. Click "Archive"
6. Verify job status changes to "Archived"

**Expected Results:**
- Archive option available for any job status (except already archived)
- Confirmation dialog warns about non-standard archival
- Job moves to Archived view immediately
- Audit log records: "Manually archived by qa-admin@jobproof.pro"
- `archive_reason` field = "manual_override"

**Pass/Fail Criteria:**
- ✅ Manual archival works for all statuses
- ✅ Confirmation dialog appears
- ✅ Audit log recorded
- ❌ FAIL: Cannot manually archive incomplete jobs
- ❌ FAIL: No audit trail for manual archival

**Notes:**
- Verify Admin-only permission (regular users should not see this option)
- Test with jobs in every status: Draft, In Progress, Complete, Submitted, etc.

---

#### QA-004: Archive Restore (Undo)

**Objective:** Verify archived jobs can be restored within 30-day grace period

**Test Steps:**
1. Create job and archive it manually
2. Note archive timestamp: `archived_at: 2026-02-01T10:30:00Z`
3. Navigate to Archived Jobs view
4. Find the just-archived job
5. Click three-dot menu → "Restore from Archive"
6. Confirm dialog appears
7. Click "Restore"
8. Verify job status returns to previous state

**Expected Results:**
- Restore option available for archived jobs
- Job status reverts to "Complete" (or previous status)
- `archived_at` field cleared (NULL)
- Audit log records: "Restored from archive by qa-admin@jobproof.pro"
- Job no longer appears in Archived view

**Pass/Fail Criteria:**
- ✅ Restore works within 30 days
- ✅ Previous status preserved
- ✅ Audit trail recorded
- ❌ FAIL: Cannot restore archive (option missing)
- ❌ FAIL: Restore after 30 days succeeds (should fail)
- ❌ FAIL: Status lost during restore

**Notes:**
- Grace period for restore = 30 days from archival
- After 30 days, restore option should be hidden (grayed out with tooltip)
- Test at day 29, day 30, day 31 boundaries

---

#### QA-005: Sealed Jobs Cannot Archive

**Objective:** Verify jobs with sealed evidence cannot be automatically archived

**Test Steps:**
1. Create job with sealed evidence: `sealedAt: 2026-01-01T00:00:00Z`
2. Set completion date to 180+ days ago
3. Run archive scan
4. Check job status

**Expected Results:**
- Job remains in "Complete" status
- Not moved to "Archived"
- UI displays badge: "🔒 Sealed - Cannot archive"
- Audit export still available for sealed jobs

**Pass/Fail Criteria:**
- ✅ Sealed jobs exempted from auto-archive
- ✅ Sealed badge displays correctly
- ❌ FAIL: Sealed job gets archived (data loss risk)

**Notes:**
- Sealed evidence is cryptographic proof of integrity
- Archival irreversibility conflicts with sealed evidence immutability

---

#### QA-006: Invoiced Jobs Cannot Archive

**Objective:** Verify jobs with associated invoices cannot be archived

**Test Steps:**
1. Create job and complete it
2. Create invoice from job: `invoiceId: inv-12345`
3. Set completion date to 180+ days ago
4. Run archive scan
5. Check job status

**Expected Results:**
- Job remains "Complete"
- Not moved to "Archived"
- UI displays badge: "💳 Invoiced - Cannot archive"
- Tooltip explains: "Archival restricted by linked invoice"

**Pass/Fail Criteria:**
- ✅ Invoiced jobs exempted
- ✅ Clear UI messaging
- ❌ FAIL: Invoiced job archived (audit trail risk)

**Notes:**
- Invoice records are immutable
- Job archival would orphan invoice references

---

### Fix 3.2: Audit Export (CSV/JSON/SHA-256)

#### QA-007: CSV Export - Basic Format

**Objective:** Verify CSV export generates correctly formatted file

**Test Steps:**
1. Log in as Compliance Officer (qa-compliance@jobproof.pro)
2. Navigate to Admin Dashboard → Audit Export
3. Select filter: "All jobs"
4. Click "Export as CSV"
5. File downloads: `jobproof-audit-2026-02-07.csv`
6. Open in text editor (not Excel)
7. Verify header row and data rows

**Expected Results:**
```csv
Job ID,Client Name,Technician,Status,Created Date,Completed Date,Evidence Count,Sealed,Invoice ID,Archive Status
job-001,Acme Corp,John Smith,Complete,2026-01-15,2026-01-20,3,true,inv-5001,false
job-002,BuildCo LLC,Sarah Johnson,In Progress,2026-02-01,NULL,0,false,NULL,false
```

- Header row: 10 columns (exact list above)
- All dates in ISO-8601 format (YYYY-MM-DD HH:MM:SS)
- Boolean fields: "true"/"false" (lowercase, not "True"/"yes")
- NULL values represented as empty string or "NULL"
- Special characters escaped (commas in names quoted)
- File size proportional to job count (1KB per 10 jobs)

**Pass/Fail Criteria:**
- ✅ File downloads without errors
- ✅ Header row correct
- ✅ Data rows properly formatted
- ✅ All dates in ISO-8601
- ❌ FAIL: Malformed CSV (won't open in Excel)
- ❌ FAIL: Missing columns
- ❌ FAIL: Data truncated or missing

**Notes:**
- Test with both UTF-8 and special characters (é, ñ, 中文)
- Empty job dataset should produce header-only file
- Large export (10K jobs) should complete in <30 seconds

---

#### QA-008: JSON Export - Structure Validation

**Objective:** Verify JSON export schema matches specification

**Test Steps:**
1. Navigate to Admin Dashboard → Audit Export
2. Select filter: "Jobs from last 30 days"
3. Click "Export as JSON"
4. File downloads: `jobproof-audit-2026-02-07.json`
5. Open in JSON validator (jsonlint.com or similar)
6. Verify schema structure

**Expected Results:**
```json
{
  "export": {
    "timestamp": "2026-02-07T10:30:00Z",
    "count": 245,
    "hash": "sha256:a1b2c3d4e5f6...",
    "jobs": [
      {
        "id": "job-001",
        "clientId": "client-001",
        "clientName": "Acme Corp",
        "technicianId": "tech-001",
        "technicianName": "John Smith",
        "status": "Complete",
        "createdAt": "2026-01-15T09:30:00Z",
        "completedAt": "2026-01-20T16:45:00Z",
        "evidence": [
          {
            "id": "evidence-001",
            "type": "photo",
            "capturedAt": "2026-01-20T10:00:00Z",
            "hash": "sha256:xyz789..."
          }
        ],
        "sealedAt": "2026-01-21T08:00:00Z",
        "invoiceId": "inv-5001",
        "archived": false,
        "archivedAt": null
      }
    ]
  }
}
```

- Valid JSON (no parse errors)
- All timestamps in ISO-8601 UTC
- Evidence array present (even if empty)
- Hash field uses SHA-256 format
- No circular references

**Pass/Fail Criteria:**
- ✅ Valid JSON structure
- ✅ All required fields present
- ✅ Timestamps in UTC
- ✅ Evidence array populated correctly
- ❌ FAIL: Invalid JSON (parse error)
- ❌ FAIL: Missing fields
- ❌ FAIL: Incorrect timestamp format

**Notes:**
- Pretty-print JSON (2-space indent) for readability
- Maximum JSON file size: 100MB (larger exports may be paginated)

---

#### QA-009: SHA-256 Hash Verification

**Objective:** Verify export integrity via SHA-256 hashes

**Test Steps:**
1. Export audit file (CSV or JSON)
2. Copy `hash` field from JSON export header (or from download confirmation)
   Example: `sha256:a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789`
3. In terminal, compute actual file hash:
   ```bash
   sha256sum jobproof-audit-2026-02-07.csv
   # Output: a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789  jobproof-audit-2026-02-07.csv
   ```
4. Compare downloaded hash with computed hash

**Expected Results:**
- File hash matches export header hash exactly
- If file modified (add/delete row), hash no longer matches
- Hash uses only file contents (not metadata like filename)

**Pass/Fail Criteria:**
- ✅ Hashes match (bit-for-bit)
- ✅ Modified file hash differs
- ✅ Hash algorithm confirmed as SHA-256
- ❌ FAIL: Hash mismatch (data corruption in transit)
- ❌ FAIL: Hash not provided in export

**Notes:**
- Hash should be computed on server before download
- Use `crypto.subtle.digest('SHA-256', data)` for browser verification
- Test with corrupted downloads (network interruption simulation)

---

#### QA-010: Export Filters - By Status

**Objective:** Verify export respects status filter

**Test Steps:**
1. Navigate to Audit Export
2. Select "Status" filter dropdown
3. Choose "Complete" (should show only completed jobs)
4. Click "Export as CSV"
5. Open CSV and count rows

**Expected Results:**
- CSV contains only jobs with `status="Complete"`
- Other statuses (In Progress, Draft, etc.) excluded
- Row count matches dashboard filter count

**Pass/Fail Criteria:**
- ✅ Filter applied correctly
- ✅ All exported jobs match filter
- ❌ FAIL: Wrong status jobs included
- ❌ FAIL: Filter ignored

**Notes:**
- Test each status: Draft, In Progress, Complete, Submitted, Archived, Paused, Cancelled
- Combination filters should work (Status=Complete AND Sealed=true)

---

#### QA-011: Export Filters - By Date Range

**Objective:** Verify date range filter in exports

**Test Steps:**
1. Navigate to Audit Export
2. Set date range: "Last 30 days"
3. Export as JSON
4. Count jobs in export

**Expected Results:**
- Export contains only jobs created in last 30 days
- Earliest job creation date: ≥ (today - 30 days)
- Latest job creation date: ≤ today

**Pass/Fail Criteria:**
- ✅ All jobs within date range
- ✅ No jobs outside range
- ❌ FAIL: Date filter ignored
- ❌ FAIL: Off-by-one errors (includes day 31)

**Notes:**
- Test boundary dates (exactly 30 days ago, 29 days ago, 31 days ago)
- Timezone handling: use UTC consistently

---

#### QA-012: Export Performance - 10K Jobs

**Objective:** Verify export completes in reasonable time for large datasets

**Test Steps:**
1. Prepare test dataset: 10,247 jobs with varying evidence counts
2. Select "All jobs" filter
3. Click "Export as JSON"
4. Monitor time to completion
5. Check file size in Downloads folder

**Expected Results:**
- Export completes in <30 seconds
- File size: approximately 50-100MB
- Browser doesn't freeze during export
- Download starts within 5 seconds

**Pass/Fail Criteria:**
- ✅ Export time <30 seconds
- ✅ File size reasonable (not bloated)
- ✅ UI remains responsive
- ❌ FAIL: Export hangs or times out
- ❌ FAIL: Browser memory spikes >500MB
- ❌ FAIL: File size >500MB (compression issue)

**Notes:**
- Monitor browser memory via DevTools Performance tab
- Recommend server-side pagination for exports >50K jobs

---

#### QA-013: Evidence Inclusion in Export

**Objective:** Verify evidence objects fully included in JSON exports

**Test Steps:**
1. Create job with 3 pieces of evidence:
   - Photo (evidence-001)
   - Video (evidence-002)
   - Document PDF (evidence-003)
2. Export job as JSON
3. Search JSON for evidence objects
4. Verify all 3 evidence items present

**Expected Results:**
```json
{
  "evidence": [
    {
      "id": "evidence-001",
      "type": "photo",
      "mimeType": "image/jpeg",
      "capturedAt": "2026-02-01T10:00:00Z",
      "hash": "sha256:...",
      "fileName": "job-001-photo-001.jpg",
      "sizeBytes": 2456789
    },
    {
      "id": "evidence-002",
      "type": "video",
      "mimeType": "video/mp4",
      "capturedAt": "2026-02-01T10:15:00Z",
      "hash": "sha256:...",
      "fileName": "job-001-video-001.mp4",
      "sizeBytes": 125678901
    }
  ]
}
```

- All 3 evidence items present
- Hash values included for integrity
- File sizes recorded
- Mime types correct

**Pass/Fail Criteria:**
- ✅ All evidence items exported
- ✅ Hashes included
- ✅ Metadata complete
- ❌ FAIL: Evidence missing from export
- ❌ FAIL: Hashes not included

**Notes:**
- Evidence URLs should NOT be included (security concern)
- Evidence blobs stored separately; export includes metadata only

---

### Fix 3.3: Sync Conflicts (Detection & Resolution)

#### QA-014: Conflict Detection - Simultaneous Edits

**Objective:** Verify system detects when two clients edit same job simultaneously

**Test Steps:**
1. Prepare two browser windows (same account or different accounts)
   - Window A: Desktop browser (Chrome)
   - Window B: Mobile browser (Safari)
2. Open same job in both windows: `/jobs/job-001`
3. In Window A: Edit field "Status" from "In Progress" to "Complete"
4. Simultaneously in Window B: Edit field "Status" to "Paused"
5. In Window A: Click "Save"
6. Wait 2 seconds
7. In Window B: Click "Save"

**Expected Results:**
- Window A: Save succeeds, job status = "Complete"
- Window B: Save fails, conflict dialog appears
  - Dialog shows: "This job was updated by another user"
  - Options: "Reload Latest", "Overwrite", "Cancel"
  - Latest version shows: "Status: Complete" (Window A's change)

**Pass/Fail Criteria:**
- ✅ Conflict detected (not silent overwrite)
- ✅ User alerted immediately
- ✅ Conflict dialog presented
- ✅ Latest version available to review
- ❌ FAIL: Silent overwrite (Window B's change overwrites Window A)
- ❌ FAIL: Conflict not detected
- ❌ FAIL: Error instead of helpful dialog

**Notes:**
- Test with different conflict types: status, technician, evidence count
- Measure time to detect conflict (should be <2 seconds)

---

#### QA-015: Conflict Resolution - Reload Latest

**Objective:** Verify "Reload Latest" option discards local changes

**Test Steps:**
1. Follow QA-014 steps to trigger conflict
2. Conflict dialog appears
3. Click "Reload Latest"
4. Verify form refreshes with server data

**Expected Results:**
- Form reloads with latest server data
- Window B's unsaved changes discarded (confirm with user)
- Form now shows: "Status: Complete" (Window A's change)
- Toast notification: "✓ Reloaded latest version"
- No data loss (local unsaved data still in IndexedDB draft)

**Pass/Fail Criteria:**
- ✅ Form refreshes with latest data
- ✅ User notified
- ✅ Local draft preserved (auto-recovered on form reopen)
- ❌ FAIL: Local changes lost without IndexedDB backup
- ❌ FAIL: Stale data displayed after reload

**Notes:**
- Verify IndexedDB still contains last-saved draft
- User should be able to re-edit and save again

---

#### QA-016: Conflict Resolution - Overwrite (Force Save)

**Objective:** Verify "Overwrite" option forces local changes

**Test Steps:**
1. Follow QA-014 steps to trigger conflict
2. Conflict dialog shows two versions:
   - "Server Version" (Window A's complete change)
   - "Your Version" (Window B's paused change)
3. Click "Overwrite - Save My Changes"
4. Confirmation: "This will overwrite changes by another user. Continue?"
5. Click "Yes, Overwrite"

**Expected Results:**
- Window B's changes saved successfully
- Server now shows: "Status: Paused"
- Audit log records: "Conflict overwrite: user qa-tester@jobproof.pro overwrote change by qa-admin@jobproof.pro at 2026-02-07 10:30:00Z"
- Both users can view audit trail

**Pass/Fail Criteria:**
- ✅ Local changes saved (overwrite succeeds)
- ✅ Audit trail recorded
- ✅ Other user can see conflict in their audit log
- ❌ FAIL: Overwrite silently loses Window A's changes
- ❌ FAIL: No audit trail

**Notes:**
- Overwrite is last-write-wins strategy
- Should include warning about overwriting another user's changes
- High-risk operation; consider role-based restrictions

---

#### QA-017: Conflict Resolution - Cancel

**Objective:** Verify "Cancel" option discards all changes without saving

**Test Steps:**
1. Follow QA-014 steps to trigger conflict
2. Conflict dialog appears
3. Click "Cancel"

**Expected Results:**
- Dialog closes
- Form reverts to previous state
- Window B's changes NOT saved
- User can manually edit again and retry

**Pass/Fail Criteria:**
- ✅ Changes discarded safely
- ✅ Form returns to previous state
- ✅ No data saved accidentally
- ❌ FAIL: Changes saved despite Cancel

**Notes:**
- Safe default action
- User retains ability to edit and try again

---

#### QA-018: Multi-Field Conflict Detection

**Objective:** Verify conflict detection works across multiple fields

**Test Steps:**
1. Open job in two windows
2. Window A: Change Status + Technician + Evidence
3. Window B: Change Status only
4. Both save simultaneously

**Expected Results:**
- Conflict dialog shows specific fields that conflict
- Fields that don't conflict are NOT flagged as warnings
- User can see exact differences:
  ```
  Field          | Server Value | Your Value
  Status         | Complete     | Paused ⚠️ CONFLICT
  Technician     | Sarah        | Sarah ✓ Same
  Evidence Count | 3            | 3 ✓ Same
  ```

**Pass/Fail Criteria:**
- ✅ Only conflicting fields highlighted
- ✅ Non-conflicting fields show as "✓ Same"
- ✅ Detailed comparison available
- ❌ FAIL: All fields shown as conflicting
- ❌ FAIL: No field-level detail

**Notes:**
- Implement field-level conflict detection (not just job-level)
- Help user understand what specifically conflicts

---

#### QA-019: Offline Conflict Queue

**Objective:** Verify conflicts are queued when offline and resolved on reconnect

**Test Steps:**
1. Enable offline mode: Developer Tools → Network → Offline
2. Edit job: Change status from "In Progress" to "Complete"
3. Click "Save"
4. Notification should appear: "📡 Offline - changes saved locally"
5. Simultaneously (in another browser window online): Same job edited by another user
6. Back in offline window: Re-enable network (set to Online)
7. App automatically syncs

**Expected Results:**
- Offline edit saved to IndexedDB
- No network request attempted while offline
- On reconnect, sync queue processes job
- Conflict detected (vs. changes made while offline)
- Conflict dialog presented
- User can resolve conflict

**Pass/Fail Criteria:**
- ✅ Offline edit queued correctly
- ✅ Conflict detected on reconnect
- ✅ Conflict resolution applies
- ❌ FAIL: Offline changes lost on reconnect
- ❌ FAIL: Silent overwrite (no conflict prompt)

**Notes:**
- This is critical for field workers
- Offline queue must not drop conflicting updates

---

#### QA-020: Conflict UI - Diff View

**Objective:** Verify conflict dialog shows clear visual diff

**Test Steps:**
1. Trigger conflict (QA-014)
2. Conflict dialog displays
3. Verify visual diff rendering

**Expected Results:**
- Two-column layout:
  - Left: "Server Version" (green, older changes)
  - Right: "Your Version" (blue, your changes)
- Conflicting fields highlighted in color
- Side-by-side comparison easy to read
- Mobile: Single-column stacked layout (320px width)

**Pass/Fail Criteria:**
- ✅ Clear visual distinction
- ✅ Mobile layout responsive
- ✅ All fields visible
- ❌ FAIL: Hard to read diff
- ❌ FAIL: Not mobile-friendly

**Notes:**
- Use color: Green for server, Blue for client
- Support keyboard navigation (Tab, Enter, Escape)

---

#### QA-021: Conflict Audit Trail

**Objective:** Verify all conflict resolutions are logged

**Test Steps:**
1. Trigger and resolve conflict (Overwrite option)
2. Navigate to Job → Audit Tab
3. Filter audit log: "conflict_resolution"
4. Verify entry shows:

**Expected Results:**
```
Timestamp: 2026-02-07 10:32:15
Action: conflict_resolution_overwrite
User: qa-tester@jobproof.pro
Details: Overwrote changes by qa-admin@jobproof.pro
Field: Status
Previous Value: Complete
New Value: Paused
Conflict Reason: Simultaneous edit at 2026-02-07 10:30:00
```

**Pass/Fail Criteria:**
- ✅ All conflict resolutions logged
- ✅ Both users can view audit
- ✅ Resolution strategy recorded (overwrite/reload/cancel)
- ✅ Timestamp accurate
- ❌ FAIL: Audit entry missing
- ❌ FAIL: Resolution strategy not recorded

**Notes:**
- Critical for compliance
- Archive export should include conflict entries

---

#### QA-022: Conflict Resolution Undo (Grace Period)

**Objective:** Verify user can undo conflict overwrite within 5 minutes

**Test Steps:**
1. Resolve conflict using "Overwrite" (5 minutes grace period)
2. Within 5 minutes: Click "Undo Last Sync" in job header
3. Verify revert to pre-conflict state

**Expected Results:**
- Job reverts to state before overwrite
- Audit log shows: "Undo conflict resolution" entry
- Overwrite entry still visible (marked as undone)
- Undo option disappears after 5 minutes

**Pass/Fail Criteria:**
- ✅ Undo works within 5 minutes
- ✅ Audit trail preserved
- ✅ Undo button grayed out after 5 minutes
- ❌ FAIL: Cannot undo conflict overwrite
- ❌ FAIL: Grace period not enforced

**Notes:**
- 5-minute grace period allows user to catch mistakes
- After grace period, conflicted data is "locked in"

---

---

## Regression Testing: Weeks 1-2 Features

### Authentication & Session Management

#### QA-023: Magic Link Login Still Works

**Steps:**
1. Log out completely
2. Navigate to login page
3. Enter test email: qa-tester@jobproof.pro
4. Click "Send Magic Link"
5. Check email (test inbox)
6. Click magic link in email
7. Verify logged in to Dashboard

**Expected:** ✅ Magic link works, session established, can access protected routes

**Pass/Fail:** PASS if login works, FAIL if any step breaks

---

#### QA-024: Auth Token Refresh

**Steps:**
1. Log in with magic link
2. Open DevTools → Application → Cookies
3. Note `sb-access-token` expiry time
4. Wait 5 minutes
5. Make API request (e.g., load jobs)
6. Verify token refreshed (expiry time changed)

**Expected:** ✅ Token auto-refreshes, no logout on expiry

**Pass/Fail:** PASS if token refreshes, FAIL if logged out or error

---

### Offline Queue (Sync)

#### QA-025: Offline Job Save Queue

**Steps:**
1. Disconnect network (DevTools → Offline)
2. Create new job form
3. Fill fields: Client, Technician, Status
4. Click "Save"
5. Verify notification: "📡 Offline - changes queued"
6. Reconnect network
7. Verify job syncs to server (check Network tab)

**Expected:** ✅ Job saved offline, synced on reconnect

**Pass/Fail:** PASS if sync succeeds, FAIL if job lost

---

#### QA-026: Evidence Upload Queue

**Steps:**
1. Go offline
2. Open existing job
3. Upload photo to evidence section
4. Verify queued locally (IndexedDB)
5. Go online
6. Verify photo uploads to server

**Expected:** ✅ Evidence queued, uploaded on reconnect

**Pass/Fail:** PASS if evidence persists, FAIL if lost

---

### Evidence Capture

#### QA-027: Photo Capture with Geolocation

**Steps:**
1. Mobile device (or emulator)
2. Navigate to TechPortal → Job → Capture Evidence
3. Click "Take Photo"
4. Grant location permission
5. Capture image
6. Verify metadata includes: GPS coords, timestamp

**Expected:** ✅ Photo with geolocation saved

**Pass/Fail:** PASS if geolocation captured, FAIL if missing

---

#### QA-028: Evidence Sealing

**Steps:**
1. Job with evidence completed
2. Click "Seal Evidence"
3. Verify RSA-2048 signature applied
4. Check `sealedAt` timestamp set
5. Try to delete evidence
6. Verify deletion blocked

**Expected:** ✅ Evidence sealed, deletion prevented

**Pass/Fail:** PASS if seal works, FAIL if evidence can be deleted

---

### Data Consistency

#### QA-029: Job List Reflects Real-Time Changes

**Steps:**
1. Window A: Open Job List
2. Window B: Edit job status (complete a job)
3. Window A: Verify job moves to correct status section
4. Refresh not required

**Expected:** ✅ Real-time update via DataContext

**Pass/Fail:** PASS if list auto-updates, FAIL if requires refresh

---

#### QA-030: Assignment Persistence

**Steps:**
1. Open Job Detail page
2. Click "Assign Technician"
3. Select technician from dropdown
4. Click "Confirm"
5. Refresh page
6. Verify technician assignment persists

**Expected:** ✅ Assignment saved and persists

**Pass/Fail:** PASS if assignment survives refresh, FAIL if lost

---

---

## Load Testing

### QA-031: 10K Jobs Dataset Performance

**Test Setup:**
- Dataset: 10,247 jobs
- Mix: 40% Complete, 30% In Progress, 20% Draft, 10% Archived
- Evidence: Average 3.5 photos per job
- Filters: Various (by status, date range, client)

**Test Steps:**
1. Load Dashboard with full job dataset
2. Measure metrics:
   - Time to initial page render
   - Memory consumption (DevTools)
   - CPU usage
   - Scroll frame rate (60fps target)
3. Apply status filter: "Complete"
4. Re-measure metrics
5. Export all jobs as JSON
6. Monitor memory during export

**Expected Results:**
| Metric | Target | Threshold |
|--------|--------|-----------|
| Initial load | <3 seconds | <5 seconds |
| Memory usage | <150MB | <300MB |
| Scroll FPS | 60 FPS | >50 FPS |
| Filter apply | <500ms | <1 second |
| Export 10K | <30 seconds | <60 seconds |

**Pass/Fail Criteria:**
- ✅ All metrics below thresholds
- ✅ No memory leaks (consistent after 5 minutes)
- ✅ 60fps scroll maintained
- ❌ FAIL: Any metric exceeds threshold
- ❌ FAIL: Memory grows unbounded (leak)

**Notes:**
- Run on: Desktop (Chrome), Tablet (iPad), Mobile (iPhone)
- Monitor with: Chrome DevTools Performance, Lighthouse

---

### QA-032: Archive Bulk Operation (1K+ jobs)

**Test Steps:**
1. Dataset: 1,250 archivable jobs
2. Click "Archive All Eligible"
3. Monitor:
   - Progress bar responsiveness
   - Memory usage
   - API request patterns

**Expected Results:**
- Operation completes in <15 seconds
- UI responsive throughout
- Memory peak <200MB
- Database queries optimized (use indexes)

**Pass/Fail Criteria:**
- ✅ Completes in <15 seconds
- ✅ Memory <200MB peak
- ❌ FAIL: Takes >30 seconds
- ❌ FAIL: Memory >300MB

---

### QA-033: Export 10K Jobs to JSON

**Test Steps:**
1. Select all 10,247 jobs
2. Export to JSON
3. Monitor:
   - Export time
   - File size
   - Memory during generation
   - Network download speed

**Expected Results:**
- Completes in <30 seconds
- File size: 50-100MB (reasonable compression)
- Memory spike <250MB
- Download stream initiated within 5 seconds

**Pass/Fail Criteria:**
- ✅ <30 seconds
- ✅ <250MB memory
- ✅ Reasonable file size
- ❌ FAIL: Hangs or times out
- ❌ FAIL: Memory >500MB

---

---

## Performance Testing

### QA-034: Page Load Time <3 Seconds

**Test Environment:**
- Network: 4G simulated (DevTools)
- Device: Simulated Mobile (Pixel 5)
- Metric: Largest Contentful Paint (LCP)

**Test Steps:**
1. DevTools → Network → Slow 4G
2. Navigate to Dashboard
3. Record LCP metric
4. Repeat 5 times
5. Calculate average

**Expected Results:**
- Average LCP: <3 seconds
- Variation: ±500ms acceptable

**Pass/Fail Criteria:**
- ✅ LCP <3 seconds consistently
- ❌ FAIL: LCP >5 seconds

**Notes:**
- Use Lighthouse for automated measurement
- Test after cache clear (hard refresh)

---

#### QA-035: Interaction to Paint <100ms

**Test Steps:**
1. Load Dashboard
2. Click "View Job Detail" button
3. Measure time from click to page visible
4. Use DevTools: Measure (Shift+Cmd+E on Mac)

**Expected Results:**
- Interaction to Paint: <100ms
- Loading state shown immediately

**Pass/Fail Criteria:**
- ✅ <100ms consistently
- ❌ FAIL: >200ms (feels sluggish)

---

#### QA-036: Scroll Frame Rate (60 FPS)

**Test Steps:**
1. Load job list with 100+ items
2. Open DevTools → Performance
3. Record 5-second scroll
4. Analyze frame rate graph

**Expected Results:**
- 60 FPS maintained throughout scroll
- No dropped frames
- No jank (consistent green bars in Performance tab)

**Pass/Fail Criteria:**
- ✅ 60 FPS maintained
- ✅ <5% dropped frames
- ❌ FAIL: Average <50 FPS
- ❌ FAIL: Visible stutter

**Notes:**
- Test on mobile device (more CPU constrained)
- Use fixed lists (not infinite scroll) for consistency

---

#### QA-037: Memory Stability (5-Minute Session)

**Test Steps:**
1. Open DevTools → Performance
2. Record baseline memory (clear heap)
3. Use app for 5 minutes: navigate, scroll, edit, save
4. Check memory graph
5. Force garbage collection (DevTools)
6. Check final memory

**Expected Results:**
- Memory growth <20MB over 5 minutes
- After GC, returns to near baseline
- No linear growth pattern (leak indicator)

**Pass/Fail Criteria:**
- ✅ <20MB growth
- ✅ Stable after GC
- ❌ FAIL: Unbounded growth
- ❌ FAIL: GC doesn't recover memory

---

---

## Cross-Browser Testing Matrix

| Test | Chrome | Firefox | Safari | Edge | Mobile Chrome | Mobile Safari |
|------|--------|---------|--------|------|---------------|---------------|
| QA-001 to QA-022 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Auth/Session | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Offline queue | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Evidence capture | ✓ | — | ✓ | — | ✓ | ✓ |
| Performance | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

### Browser-Specific Tests

#### QA-038: Safari IndexedDB Quota

**Test:** Verify IndexedDB works in Safari (limited quota: 50MB)

**Steps:**
1. Safari browser
2. Save 500 jobs to IndexedDB
3. Upload 100MB of evidence
4. Verify quota exceeded handling
5. Check fallback to localStorage

**Expected:** ✅ Graceful fallback, no data loss

---

#### QA-039: Firefox Performance

**Test:** Verify export performance in Firefox (different engine)

**Steps:**
1. Firefox browser
2. Export 10K jobs to JSON
3. Monitor memory and time
4. Compare to Chrome baseline

**Expected:** ✅ Within 20% of Chrome performance

---

#### QA-040: Edge IE Compatibility

**Test:** Verify Edge runs without IE-specific bugs

**Steps:**
1. Edge browser
2. Run regression suite (QA-023 to QA-030)
3. Check console for errors

**Expected:** ✅ 0 JS errors in console

---

---

## Success Criteria Checklist

### Pre-Launch Verification

```
MUST PASS (0 tolerance):
☐ All critical bugs fixed
☐ npm test -- --run: 367+ tests green
☐ npm run build: SUCCESS
☐ npm run lint: 0 errors
☐ npm run type-check: 0 errors
☐ No console errors (production build)
☐ No service_role keys in frontend
☐ Archive threshold: 0 false positives
☐ Audit export: SHA-256 integrity verified
☐ Sync conflicts: 100% detection rate
☐ Regression tests: 0 failures

SHOULD PASS (minor issues OK if tracked):
☐ Load test: 10K jobs <3s load
☐ Performance: 60fps scroll maintained
☐ Cross-browser: All browsers green
☐ Mobile: Responsive on 320px-1920px
☐ Accessibility: All touch targets ≥44px
☐ SEO: Lighthouse >80

OPTIONAL (nice to have):
☐ Performance: <2.5s load (vs 3s target)
☐ Export: <20s for 10K jobs (vs 30s target)
☐ Memory: <100MB (vs 150MB target)
```

### UAT Signoff

```
QA Lead: _________________  Date: _______
QA Engineer #1: ___________ Date: _______
QA Engineer #2: ___________ Date: _______
QA Engineer #3: ___________ Date: _______

Product Manager: __________ Date: _______
Engineering Lead: _________ Date: _______

Ready for Production? ☐ YES  ☐ NO (blockers below)
```

---

## Known Risks & Mitigations

### Risk 1: Archive Threshold False Positives

**Risk:** Jobs archived before 180 days (data loss)

**Severity:** CRITICAL

**Mitigation:**
- Automated test: QA-001 (threshold calculation)
- Manual audit: Check 10 archived jobs, verify age ≥180 days
- Rollback plan: Restore from backup if widespread issue
- Monitoring: Alert if >1% jobs archived early

---

### Risk 2: Audit Export Data Loss

**Risk:** Export missing rows or fields (incomplete audit trail)

**Severity:** CRITICAL

**Mitigation:**
- Hash verification: QA-009 (SHA-256 match)
- Spot check: Manually verify 5 random jobs in export vs. database
- Volume test: QA-012 (10K jobs export)
- Backup: Keep audit log on server separately

---

### Risk 3: Conflict Detection Bypass (Silent Overwrite)

**Risk:** Two users' changes merge without conflict (data loss)

**Severity:** CRITICAL

**Mitigation:**
- Automated test: QA-014 (detection)
- Manual test: QA-015, QA-016, QA-017 (all resolution paths)
- Audit trail: QA-021 (all conflicts logged)
- Monitoring: Alert on 0 conflict detections (anomaly)

---

### Risk 4: Performance Regression (10K Jobs Slow)

**Risk:** Load time exceeds 5 seconds (users abandon)

**Severity:** HIGH

**Mitigation:**
- Load test: QA-031 (10K jobs)
- Monitor metrics: LCP, FID, CLS via Lighthouse
- Database indexes: Verify on job status, created_at
- Code review: Check for N+1 queries

---

### Risk 5: Memory Leak in Archive Operation

**Risk:** Memory grows unbounded, browser crashes (>500MB)

**Severity:** HIGH

**Mitigation:**
- Load test: QA-032 (bulk archive)
- DevTools: Monitor memory over 5 minutes
- GC testing: Force garbage collection, verify recovery
- Batch size: Limit to 100-200 jobs per request

---

### Risk 6: Offline Conflict Lost on Reconnect

**Risk:** Offline changes overwritten silently (user data lost)

**Severity:** CRITICAL

**Mitigation:**
- Test: QA-019 (offline conflict queue)
- Verify IndexedDB: Check draft still present after sync
- Audit trail: Confirm conflict logged
- User education: Show "conflict detected" notification

---

### Risk 7: CSV Export Special Character Corruption

**Risk:** Names with commas/quotes misquoted (data unreadable)

**Severity:** MEDIUM

**Mitigation:**
- Format test: QA-007 (CSV header/data)
- Character test: Include names like "O'Brien", "Smith, Jr.", "José"
- Tool test: Open export in Excel, Google Sheets, verify readable
- Encoding: Confirm UTF-8 BOM for Excel compatibility

---

### Risk 8: JSON Export Schema Mismatch

**Risk:** Client applications expect different schema (parsing fails)

**Severity:** MEDIUM

**Mitigation:**
- Schema test: QA-008 (structure validation)
- Version header: Include `version: "1.0"` in export
- Backward compatibility: Deprecation period before schema changes
- Documentation: Publish JSON schema (JSON Schema format)

---

---

## Timeline & Resource Allocation

### 3-Day Test Cycle

| Day | Task | Resource | Duration |
|-----|------|----------|----------|
| **Day 1 (Monday)** | Test environment setup, data prep | QA #1, #2 | 2 hours |
| | Archive tests (QA-001 to QA-006) | QA #1 | 3 hours |
| | Audit export tests (QA-007 to QA-013) | QA #2 | 3 hours |
| | Conflict tests (QA-014 to QA-022) | QA #3 | 3 hours |
| **Day 2 (Tuesday)** | Regression tests (QA-023 to QA-030) | QA #1, #2 | 2 hours |
| | Load testing (QA-031 to QA-033) | QA #3 | 3 hours |
| | Performance testing (QA-034 to QA-037) | QA #1 | 2 hours |
| | Bug documentation & severity assignment | All | 2 hours |
| **Day 3 (Wednesday)** | Cross-browser testing (QA-038 to QA-040) | QA #2 | 2 hours |
| | Regression testing (continued) | QA #1 | 2 hours |
| | Final sign-off & UAT documentation | Lead | 1 hour |
| | Risk assessment & mitigation verification | Lead | 1 hour |

### Resource Requirements

- **QA Engineers:** 3 full-time, 3 days
- **Test Environment:** Staging server, database backup
- **Tools:**
  - Chrome/Firefox/Safari/Edge (latest versions)
  - BrowserStack (cross-device testing)
  - DevTools (performance profiling)
  - Postman (API testing)
  - JSONLint (format validation)
  - SHA-256 calculator (hash verification)

### Deliverables

1. **Test Execution Report** (daily)
   - Tests run: [count]
   - Tests passed: [count]
   - Tests failed: [count]
   - Critical bugs: [list]

2. **Bug Log** (cumulative)
   - ID, Severity, Title, Description, Steps, Status

3. **UAT Sign-Off** (final)
   - QA Lead approval
   - Product/Engineering sign-off
   - Release readiness confirmation

---

## Appendix A: Test Accounts

| Email | Password | Role | Purpose |
|-------|----------|------|---------|
| qa-admin@jobproof.pro | [1Password] | Admin | Archive, audit export |
| qa-compliance@jobproof.pro | [1Password] | Compliance | Audit export tests |
| qa-tester@jobproof.pro | [1Password] | Technician | Conflict, sync tests |
| qa-tech-2@jobproof.pro | [1Password] | Technician | Conflict simultaneous edit |

**Note:** All passwords stored in 1Password with restricted access.

---

## Appendix B: Test Data Setup SQL

```sql
-- Archive testing (180+ day old completed jobs)
INSERT INTO jobs (id, client_id, technician_id, status, created_at, completed_at, archived)
VALUES
  ('job-archive-001', 'client-1', 'tech-1', 'Complete', NOW() - INTERVAL '181 days', NOW() - INTERVAL '181 days', false),
  ('job-archive-002', 'client-2', 'tech-2', 'Complete', NOW() - INTERVAL '200 days', NOW() - INTERVAL '200 days', false);

-- Conflict testing (jobs for simultaneous edit)
INSERT INTO jobs (id, client_id, technician_id, status, created_at)
VALUES ('job-conflict-001', 'client-1', 'tech-1', 'In Progress', NOW());

-- Audit export testing (high-evidence jobs)
INSERT INTO jobs (id, client_id, technician_id, status, created_at, evidence_count)
VALUES ('job-audit-001', 'client-1', 'tech-1', 'Complete', NOW() - INTERVAL '5 days', 10);

-- Load testing (1K+ jobs)
-- Use data generation script: scripts/generate-test-data.ts
-- Generates 10,247 jobs with realistic distribution
```

---

## Appendix C: Bug Severity Definitions

| Severity | Definition | Example | Action |
|----------|-----------|---------|--------|
| CRITICAL | Data loss, security breach, complete feature failure | Archive before 180 days, silent conflict overwrite | Block release |
| HIGH | Major feature broken, significant performance impact | Export hangs, 10K jobs take 2 minutes | Fix before release |
| MEDIUM | Feature partially broken, workaround available | CSV export missing one column | Track for next release |
| LOW | Minor UI issue, cosmetic | Button alignment off by 2px | Nice to have |

---

## Appendix D: Test Execution Checklist

### Pre-Test Checklist
- [ ] Test environment deployed (staging)
- [ ] Database prepared with test data
- [ ] Test accounts created and accessible
- [ ] VPN connected to staging subnet
- [ ] Browsers updated to latest versions
- [ ] DevTools extensions installed (WebAIM, Lighthouse)
- [ ] All QA team members have access
- [ ] 1Password vault contains all test passwords

### Daily Startup
- [ ] Verify staging server is accessible
- [ ] Check database backup completed
- [ ] Review previous day's bug list
- [ ] Assign tests to QA team members
- [ ] Start test execution per timeline

### Daily Shutdown
- [ ] Document all tests executed (test ID, result, notes)
- [ ] Create bug tickets for any failures
- [ ] Assign severity and priority
- [ ] Notify engineering of blockers
- [ ] Backup test results to shared drive

---

## Appendix E: Performance Benchmark Baseline

**Baseline from Week 1-2 (5K jobs, no archival):**

| Metric | Week 1-2 | Week 3 Target | Notes |
|--------|----------|--------------|-------|
| Dashboard load | 2.1s | <3.0s | Archive logic overhead |
| Filter apply | 280ms | <500ms | Can use indexed search |
| Export 1K jobs | 8.5s | <30s | Archive metadata included |
| Memory (idle) | 95MB | <150MB | Archive cache |
| Scroll FPS | 59.8 | >50 | Maintain smoothness |

---

## Appendix F: Known Issues & Exceptions

*Document any pre-existing bugs that should not block Week 3 release:*

Example:
- **Issue:** Safari memory spike on export >50MB
  - **Root Cause:** Blob memory handling in WebKit
  - **Workaround:** Use streaming export, split into chunks
  - **Fix Timeline:** Week 4 performance optimization
  - **Status:** Accepted risk, tracked in backlog #2847

---

## Appendix G: Sign-Off & Approvals

**QA Phase Complete:** _________________________ (QA Lead)

**Ready for Staging Verification:** _________________________ (Product Manager)

**Engineering Verification:** _________________________ (Tech Lead)

**Release Authorized:** _________________________ (Director of Engineering)

**Date:** _________

---

*This QA Testing Plan is a living document. Updates should be tracked and communicated to all stakeholders. Final sign-off required before production deployment.*
