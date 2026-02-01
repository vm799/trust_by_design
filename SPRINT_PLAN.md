# JobProof Field-Ready Sprint Plan

**Goal:** Transform JobProof from "works in demo" to "trusted in the field"
**Total Effort:** 4 Sprints (5 days each)
**Start Date:** TBD
**Target:** 100% offline data safety, zero silent failures

---

## Sprint Overview

| Sprint | Focus | Days | Outcome |
|--------|-------|------|---------|
| **Sprint 1** | Offline Data Safety | 5 | Evidence cannot be lost |
| **Sprint 2** | Code Hygiene & Bug Fixes | 5 | No deprecated patterns, correct logic |
| **Sprint 3** | UX Simplification | 5 | Reduced cognitive load, faster workflows |
| **Sprint 4** | Performance & Scale | 5 | Handles 200+ jobs, low memory pressure |

---

## Sprint 1: Offline Data Safety (P0 - CRITICAL)

**Theme:** "A technician's photo must NEVER be lost"

### Day 1-2: Draft Storage Migration

#### Task 1.1: Migrate JobForm to IndexedDB
**File:** `views/app/jobs/JobForm.tsx`
**Current:** localStorage with 8-hour expiry (line 129)
**Target:** Dexie IndexedDB with structured error handling

```typescript
// BEFORE (line 129)
localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));

// AFTER
await db.drafts.put({
  key: DRAFT_STORAGE_KEY,
  data: draft,
  updatedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
});
```

**Acceptance Criteria:**
- [ ] Draft saves on every keystroke to IndexedDB
- [ ] Draft survives: airplane mode → close browser → reopen
- [ ] Draft auto-loads on form mount
- [ ] Expired drafts (8h+) auto-deleted on load
- [ ] Large drafts (>1MB) handled without silent failure

**Test Plan:**
```bash
# Manual test
1. Open JobForm, fill all fields with 5000-char notes
2. Enable airplane mode
3. Force kill browser (not just close tab)
4. Reopen browser, navigate to JobForm
5. EXPECT: All fields restored including 5000-char notes
```

---

#### Task 1.2: Add "Saved to Device" Confirmation
**File:** `views/tech/EvidenceCapture.tsx`
**Current:** No explicit save confirmation (photo just appears in list)
**Target:** Visual confirmation with checkmark

**Lines to modify:** After `persistDraft()` call (approximately line 149-151)

```typescript
// AFTER persistDraft succeeds
setSaveConfirmation({ show: true, photoId: photo.id });
setTimeout(() => setSaveConfirmation({ show: false, photoId: null }), 2000);
```

**UI Addition:**
```tsx
{saveConfirmation.show && (
  <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-success text-white px-4 py-2 rounded-full flex items-center gap-2 animate-fade-in-up z-50">
    <span className="material-symbols-outlined">check_circle</span>
    <span className="font-bold text-sm">Saved to device</span>
  </div>
)}
```

**Acceptance Criteria:**
- [ ] Green "Saved to device" toast appears after photo capture
- [ ] Toast visible for 2 seconds
- [ ] Toast appears even in airplane mode
- [ ] Distinct from sync status (this is LOCAL save confirmation)

---

### Day 3: Sync Queue Resilience

#### Task 1.3: Preserve Failed Photo References
**File:** `lib/syncQueue.ts`
**Current:** Lines 48-51 discard photo if IndexedDB read fails
**Target:** Re-queue and notify user

```typescript
// BEFORE (lines 48-51)
if (!dataUrl) {
  failedPhotos.push(photo.id);
  continue; // LOST FOREVER
}

// AFTER
if (!dataUrl) {
  // Photo data corrupted or missing - cannot recover automatically
  orphanedPhotos.push({
    id: photo.id,
    jobId: job.id,
    reason: 'IndexedDB read failed',
    timestamp: new Date().toISOString()
  });

  // Store in persistent orphan log
  const orphanLog = JSON.parse(localStorage.getItem('jobproof_orphaned_photos') || '[]');
  orphanLog.push(orphanedPhotos[orphanedPhotos.length - 1]);
  localStorage.setItem('jobproof_orphaned_photos', JSON.stringify(orphanLog));

  // Notify user immediately
  showPersistentNotification({
    type: 'error',
    title: 'Photo Recovery Needed',
    message: `Photo ${photo.id.slice(0,8)} could not be synced. The original may need to be recaptured.`,
    persistent: true
  });

  continue;
}
```

**Acceptance Criteria:**
- [ ] Failed photo reads stored in orphan log
- [ ] User notified with persistent notification
- [ ] Orphan log accessible via settings/debug screen
- [ ] Job sync continues with remaining photos (partial success)

---

#### Task 1.4: Add Conflict Notification
**File:** `lib/offline/sync.ts` (conflict resolution section)
**Current:** Conflicts logged but never shown to user
**Target:** User notification when local work is overwritten

```typescript
// After conflict resolution (where newer/sealed wins)
if (conflictResolution === 'remote_wins') {
  showPersistentNotification({
    type: 'warning',
    title: 'Changes Synced',
    message: `Job "${job.title}" was updated by another user. Your local changes have been merged.`,
    persistent: false
  });

  // Store in conflict history
  const conflictHistory = JSON.parse(localStorage.getItem('jobproof_conflict_history') || '[]');
  conflictHistory.push({
    jobId: job.id,
    localVersion: localJob,
    remoteVersion: remoteJob,
    resolution: 'remote_wins',
    timestamp: new Date().toISOString()
  });
  // Keep last 50
  if (conflictHistory.length > 50) conflictHistory.shift();
  localStorage.setItem('jobproof_conflict_history', JSON.stringify(conflictHistory));
}
```

**Acceptance Criteria:**
- [ ] User sees toast when conflict resolved
- [ ] Toast indicates which job was affected
- [ ] Conflict history stored (last 50)
- [ ] No silent data loss

---

### Day 4: Race Condition Fixes

#### Task 1.5: Atomic Draft Cleanup in EvidenceCapture
**File:** `views/tech/EvidenceCapture.tsx`
**Current:** Job update and draft delete are separate operations
**Target:** Transactional cleanup

```typescript
// BEFORE
contextUpdateJob(updatedJob);
await db.media.delete(draftKey);

// AFTER - Use Dexie transaction
await db.transaction('rw', db.jobs, db.media, async () => {
  // 1. Commit job update to local DB
  await db.jobs.put(updatedJob);

  // 2. Delete draft atomically
  await db.media.delete(draftKey);
});

// 3. Then update context (which will pick up from DB)
contextUpdateJob(updatedJob);
```

**Acceptance Criteria:**
- [ ] Draft delete only happens if job update succeeds
- [ ] No duplicate photos possible from interrupted operations
- [ ] Transaction rollback on any failure

---

#### Task 1.6: Fix beforeunload Sync Flush
**File:** `lib/debouncedSync.ts`
**Current:** Line 301-305 calls `flushPendingUpdates()` without awaiting
**Target:** Use sendBeacon for reliable unload sync

```typescript
// BEFORE
window.addEventListener('beforeunload', () => {
  flushPendingUpdates(); // Not awaited!
});

// AFTER
window.addEventListener('beforeunload', () => {
  const pendingData = getPendingUpdatesSummary();
  if (pendingData.length > 0) {
    // sendBeacon is designed for unload - browser guarantees delivery
    navigator.sendBeacon('/api/sync-flush', JSON.stringify(pendingData));
  }
});

// Also add visibilitychange for iOS Safari
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    flushPendingUpdates(); // Async is fine here
  }
});
```

**Acceptance Criteria:**
- [ ] Pending updates survive page close
- [ ] Works on iOS Safari (visibilitychange fallback)
- [ ] No data loss on browser crash/close

---

### Day 5: End-to-End Verification

#### Task 1.7: Airplane Mode Test Suite
**New File:** `tests/e2e/offline-safety.spec.ts`

```typescript
test.describe('Offline Data Safety', () => {
  test('photos survive airplane mode + app kill', async ({ page }) => {
    // 1. Navigate to capture screen
    await page.goto('/tech/job/test-job-1/capture');

    // 2. Go offline
    await page.context().setOffline(true);

    // 3. Capture 5 photos
    for (let i = 0; i < 5; i++) {
      await page.click('[data-testid="capture-btn"]');
      await page.click('[data-testid="confirm-btn"]');
      await expect(page.locator('[data-testid="save-confirmation"]')).toBeVisible();
    }

    // 4. Force navigation away (simulates app kill)
    await page.evaluate(() => window.location.href = 'about:blank');

    // 5. Return to capture screen
    await page.goto('/tech/job/test-job-1/capture');

    // 6. Verify all 5 photos restored
    await expect(page.locator('[data-testid="photo-thumbnail"]')).toHaveCount(5);
  });

  test('job form draft survives offline + browser close', async ({ page }) => {
    // Similar pattern for JobForm
  });

  test('sync conflicts notify user', async ({ page }) => {
    // Simulate conflict scenario
  });
});
```

**Acceptance Criteria:**
- [ ] All offline tests pass
- [ ] Tests run in CI
- [ ] Manual QA sign-off on physical device

---

### Sprint 1 Definition of Done

- [ ] All 7 tasks completed
- [ ] `npm test -- --run` passes
- [ ] `npm run build` succeeds
- [ ] Manual airplane mode test passed on Android + iOS
- [ ] No console errors related to storage
- [ ] Orphan photo log accessible in UI

---

## Sprint 2: Code Hygiene & Bug Fixes (P1)

**Theme:** "Delete the landmines before someone steps on them"

### Day 1: Deprecated Code Removal

#### Task 2.1: Delete Deprecated useWorkspaceData Exports
**File:** `hooks/useWorkspaceData.ts`
**Lines:** 137-321 (deprecated standalone functions)

**Action:** Delete or mark as `@internal`:
- `getJobs()` - Use `useData().jobs`
- `getClients()` - Use `useData().clients`
- `getTechnicians()` - Use `useData().technicians`
- `updateJob()` - Use `contextUpdateJob()`
- etc.

**Acceptance Criteria:**
- [ ] No deprecated exports accessible from outside module
- [ ] All imports updated to DataContext pattern
- [ ] Architecture tests verify pattern

---

#### Task 2.2: Fix CompleteOnboarding Imports
**File:** `views/CompleteOnboarding.tsx`
**Line:** 5

```typescript
// BEFORE
import { getJobs, getClients } from '../hooks/useWorkspaceData';

// AFTER
import { useData } from '../lib/DataContext';
```

---

#### Task 2.3: Remove getCurrentUser Export
**File:** `lib/auth.ts`
**Line:** 402

**Risk:** This export can trigger the 877 req/hr auth loop if used in components.

**Action:**
- Mark as `/** @internal - DO NOT use in components */`
- Or delete entirely and inline where needed

---

### Day 2: Filter Logic Fixes

#### Task 2.4: Fix awaitingSealJobs Filter
**File:** `views/app/jobs/JobsList.tsx`
**Line:** 161

```typescript
// BEFORE (WRONG - shows jobs WITHOUT signature)
const awaitingSealJobs = useMemo(() =>
  activeJobs.filter(j => !j.signature && !j.sealedAt),
[activeJobs]);

// AFTER (CORRECT - shows jobs WITH evidence, ready to seal)
const awaitingSealJobs = useMemo(() =>
  activeJobs.filter(j =>
    j.photos.length > 0 &&
    j.signature &&
    !j.sealedAt &&
    !j.isSealed
  ),
[activeJobs]);
```

---

#### Task 2.5: Fix No-Op MetricCard Clicks
**File:** `views/AdminDashboard.tsx`
**Lines:** 291-298

Two MetricCards have `onClick={() => {}}` which is confusing (looks clickable, does nothing).

**Action:** Either:
- Add navigation action
- Remove onClick entirely (change to non-interactive div)

---

### Day 3: ID Field Consolidation

#### Task 2.6: Consolidate Triple Technician ID Filter
**File:** `views/tech/TechPortal.tsx`
**Lines:** 32-37

```typescript
// BEFORE (3 different ID fields)
j.technicianId === userId ||
j.techId === userId ||
j.techMetadata?.createdByTechId === userId

// AFTER (single canonical field)
j.assignedTechId === userId
```

**Migration Required:**
1. Add `assignedTechId` field to Job type
2. Migrate existing data (set `assignedTechId = technicianId || techId`)
3. Update all assignment logic to use `assignedTechId`
4. Deprecate old fields

---

### Day 4: Documentation Cleanup

#### Task 2.7: Update CLAUDE.md Tech Debt List
**File:** `CLAUDE.md`
**Lines:** 619-629

Remove already-fixed items:
- ~~`views/tech/EvidenceCapture.tsx`~~ - Already uses DataContext
- ~~`views/app/jobs/JobForm.tsx`~~ - Already uses DataContext
- ~~`views/app/jobs/EvidenceReview.tsx`~~ - Already uses DataContext
- ~~`views/app/invoices/InvoiceList.tsx`~~ - File doesn't exist
- ~~`views/app/invoices/InvoiceDetail.tsx`~~ - File doesn't exist
- ~~`hooks/useJobGuard.ts`~~ - Already compliant

---

#### Task 2.8: Verify/Fix Dead Routes
Check and fix:
- `/contractor/history` - linked in ContractorDashboard line 233
- `/tech/profile` - linked in TechPortal line 90

**Action:** Either create routes or remove links.

---

### Day 5: Console.log Cleanup

#### Task 2.9: Remove Debug Artifacts
Run and fix:
```bash
grep -r "console.log" --include="*.tsx" --include="*.ts" src/ views/ lib/ components/
```

**Keep:** Error logging (`console.error`, `console.warn` for actual issues)
**Delete:** Debug logging (`console.log` for development)

---

### Sprint 2 Definition of Done

- [ ] Zero deprecated hook usage in components
- [ ] All filter logic correct
- [ ] Single technician ID field
- [ ] CLAUDE.md tech debt list accurate
- [ ] No dead routes or links
- [ ] console.log count reduced by 80%+

---

## Sprint 3: UX Simplification (P2)

**Theme:** "Fewer taps, less anxiety, more certainty"

### Day 1-2: Dashboard Consolidation

#### Task 3.1: Collapse AdminDashboard Metrics
**File:** `views/AdminDashboard.tsx`

**Current:** 4 metric cards (In Field, Available, Active Jobs, Sealed)
**Target:** 2 metric cards

```
[Attention Needed: X] [In Field: Y / Z total]
```

The "Attention Needed" count is the only actionable metric.

---

#### Task 3.2: Inline Action Center
**File:** `views/AdminDashboard.tsx`

**Current:** Unopened links behind modal
**Target:** Inline accordion section

```tsx
// Before technician rows, add expandable section
<Disclosure>
  <Disclosure.Button className="...">
    <span>Unopened Links ({unopenedLinks.length})</span>
    <ChevronDownIcon />
  </Disclosure.Button>
  <Disclosure.Panel>
    {unopenedLinks.map(link => (
      <UnopenedLinkRow key={link.id} link={link} />
    ))}
  </Disclosure.Panel>
</Disclosure>
```

---

### Day 3: Error Recovery UX

#### Task 3.3: Camera Permission Error Instructions
**File:** `views/tech/EvidenceCapture.tsx`
**Lines:** 91-93

**Current:**
```
"Unable to access camera. Please grant camera permissions."
[Go Back]
```

**Target:**
```
"Camera access is required to capture evidence photos."

How to enable:
1. Open your device Settings
2. Find JobProof in the app list
3. Enable Camera permission
4. Return here and tap "Try Again"

[Open Settings*] [Try Again] [Go Back]

* Deep link where supported
```

---

#### Task 3.4: Add Retry to All Error States
Audit all `<ErrorState>` usages and ensure `onRetry` prop is provided.

**Pattern:**
```tsx
if (error) {
  return <ErrorState
    message={error}
    onRetry={refresh}  // Always provide!
  />;
}
```

---

### Day 4: Navigation & State Persistence

#### Task 3.5: Persist JobsList Filters Through Navigation
**File:** `views/app/jobs/JobsList.tsx`

**Issue:** Filter resets when navigating to job detail and back.

**Fix:** Use URL search params (already partially implemented) but ensure React Router preserves state:

```tsx
// In JobDetail, use navigate with state
navigate(-1); // Goes back with preserved URL params

// Or store filter in sessionStorage as backup
```

---

#### Task 3.6: Replace window.location.reload()
**File:** `views/ContractorDashboard.tsx`
**Line:** 120

```typescript
// BEFORE
window.location.reload();

// AFTER
const { refresh } = useData();
await refresh();
```

---

### Day 5: Touch Target Audit

#### Task 3.7: Verify All Touch Targets
Run audit:
```bash
grep -r "min-h-\[" --include="*.tsx" | grep -v "44px\|48px\|56px"
```

Any interactive element under 44px must be fixed.

**Focus areas:**
- Filter tab buttons
- Table row actions
- Modal close buttons
- Breadcrumb links

---

### Sprint 3 Definition of Done

- [ ] Dashboard metrics reduced from 4 to 2
- [ ] Action center inline (no modal)
- [ ] Camera permission error has step-by-step instructions
- [ ] All ErrorState components have onRetry
- [ ] JobsList filter persists through navigation
- [ ] No window.location.reload() calls
- [ ] All touch targets >= 44px

---

## Sprint 4: Performance & Scale (P2)

**Theme:** "Works with 200 jobs on a 3-year-old Android"

### Day 1-2: List Virtualization

#### Task 4.1: Add Virtual List to JobsList
**File:** `views/app/jobs/JobsList.tsx`

**Install:** `npm install @tanstack/react-virtual`

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

const parentRef = useRef<HTMLDivElement>(null);

const virtualizer = useVirtualizer({
  count: filteredJobs.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 80, // Estimated row height
});

return (
  <div ref={parentRef} className="h-[600px] overflow-auto">
    <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
      {virtualizer.getVirtualItems().map(virtualRow => (
        <JobRow
          key={filteredJobs[virtualRow.index].id}
          job={filteredJobs[virtualRow.index]}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${virtualRow.start}px)`,
          }}
        />
      ))}
    </div>
  </div>
);
```

**Acceptance Criteria:**
- [ ] 200 jobs render without lag
- [ ] Smooth scroll on Android Chrome
- [ ] Filter changes instant

---

### Day 3: Memory Optimization

#### Task 4.2: Release Camera Stream After Capture
**File:** `views/tech/EvidenceCapture.tsx`
**Line:** 204

**Current:** Stream only released on navigation away.
**Target:** Release immediately after photo confirmed.

```typescript
const confirmPhoto = async () => {
  // ... existing confirm logic ...

  // Release camera stream immediately
  if (streamRef.current) {
    streamRef.current.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }

  // User can tap "Take Another" to reacquire
};

const takeAnother = async () => {
  // Reacquire camera stream
  const stream = await navigator.mediaDevices.getUserMedia({ video: constraints });
  streamRef.current = stream;
  videoRef.current.srcObject = stream;
};
```

---

#### Task 4.3: Image Compression Before Storage
**File:** `views/tech/EvidenceCapture.tsx`

**Current:** JPEG quality 0.9, no resizing
**Target:** Resize to max 1920px, quality 0.8

```typescript
const compressImage = (canvas: HTMLCanvasElement, maxDimension = 1920): string => {
  let width = canvas.width;
  let height = canvas.height;

  // Resize if larger than max
  if (width > maxDimension || height > maxDimension) {
    const ratio = Math.min(maxDimension / width, maxDimension / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);

    const resizedCanvas = document.createElement('canvas');
    resizedCanvas.width = width;
    resizedCanvas.height = height;
    const ctx = resizedCanvas.getContext('2d')!;
    ctx.drawImage(canvas, 0, 0, width, height);

    return resizedCanvas.toDataURL('image/jpeg', 0.8);
  }

  return canvas.toDataURL('image/jpeg', 0.8);
};
```

**Result:** ~50% reduction in photo size (400KB → 200KB typical)

---

### Day 4: Cold Start Optimization

#### Task 4.4: Lazy Load Non-Critical Routes
**File:** `App.tsx`

Verify all routes use `React.lazy()`:
```typescript
const InvoicesView = lazy(() => import('./views/app/invoices/InvoicesView'));
const HelpCenter = lazy(() => import('./views/HelpCenter'));
const Settings = lazy(() => import('./views/Settings'));
```

---

#### Task 4.5: Preload Critical Routes
Add prefetch hints for common navigation paths:

```typescript
// In Layout or navigation component
useEffect(() => {
  // Preload routes user is likely to visit
  import('./views/app/jobs/JobDetail');
  import('./views/tech/EvidenceCapture');
}, []);
```

---

### Day 5: Performance Testing

#### Task 4.6: Add Performance Budget Tests
**New File:** `tests/performance/budget.spec.ts`

```typescript
test.describe('Performance Budget', () => {
  test('JobsList renders 200 jobs under 100ms', async ({ page }) => {
    // Seed 200 jobs
    await page.evaluate(() => {
      // Add 200 mock jobs to DataContext
    });

    const start = performance.now();
    await page.goto('/admin/jobs');
    await page.waitForSelector('[data-testid="job-row"]');
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100);
  });

  test('EvidenceCapture memory under 150MB', async ({ page }) => {
    await page.goto('/tech/job/test/capture');

    // Capture 10 photos
    for (let i = 0; i < 10; i++) {
      await page.click('[data-testid="capture-btn"]');
      await page.click('[data-testid="confirm-btn"]');
    }

    const metrics = await page.metrics();
    expect(metrics.JSHeapUsedSize).toBeLessThan(150 * 1024 * 1024);
  });
});
```

---

### Sprint 4 Definition of Done

- [ ] 200 jobs render without visible lag
- [ ] Camera stream released after each photo
- [ ] Photo size reduced by 50%
- [ ] Cold start under 3s on 4G
- [ ] Performance tests pass
- [ ] Memory under 150MB after 10 photo captures

---

## Risk Register

| Risk | Mitigation | Owner |
|------|------------|-------|
| IndexedDB quota exceeded | Monitor usage, warn at 80%, provide export | Sprint 1 |
| Camera permission denied on iOS | Deep link to settings where possible | Sprint 3 |
| Sync conflicts cause data loss | Conflict resolution with user notification | Sprint 1 |
| Virtual list breaks mobile scrolling | Test on Android Chrome, Safari iOS | Sprint 4 |
| sendBeacon not supported | Fallback to async flush | Sprint 1 |

---

## Success Metrics

| Metric | Before | Target | Measurement |
|--------|--------|--------|-------------|
| Data loss incidents | Unknown | 0 | Error tracking |
| Sync conflict visibility | 0% | 100% | User sees all conflicts |
| Camera to saved confirmation | None | 2s visual | UX observation |
| 200 job render time | Unknown | <100ms | Performance test |
| Memory after 10 photos | Unknown | <150MB | Performance test |
| Touch targets < 44px | Unknown | 0 | Audit script |

---

## Sprint Retrospective Template

After each sprint:

1. **What worked?**
2. **What didn't work?**
3. **What blocked us?**
4. **What do we need for next sprint?**
5. **Should we reprioritize remaining work?**

---

## Appendix: Quick Reference

### Commands
```bash
# Full verification
npm test -- --run && npm run lint && npm run type-check && npm run build

# Run specific test file
npm test -- --run tests/e2e/offline-safety.spec.ts

# Check for deprecated patterns
grep -r "getJobs\|getClients\|getTechnicians" --include="*.tsx" views/
```

### Key Files
- `lib/syncQueue.ts` - Offline sync logic
- `lib/DataContext.tsx` - Central state
- `views/tech/EvidenceCapture.tsx` - Photo capture
- `views/app/jobs/JobForm.tsx` - Job creation
- `views/AdminDashboard.tsx` - Manager hub

---

*This plan transforms JobProof from demo-ready to field-ready in 4 sprints. Prioritization may shift based on user feedback and field testing results.*
