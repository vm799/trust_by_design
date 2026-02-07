# WEEK 2 DEFENSIVE EXECUTION PLAN
## Careful, Robust, Optimized Implementation

**Status:** Pre-flight checklist before agent swarm launch
**Date:** February 7, 2026
**Token Budget Remaining:** 405 tokens (64% of original 1,430)
**Parallel Strategy:** 2 parallel + 1 sequential dependent

---

## 🛡️ DEFENSIVE PRINCIPLES (Non-Negotiable)

### 1. Test-First, Always
- ✅ Write test cases BEFORE implementation
- ✅ All edge cases documented
- ✅ Failure modes tested explicitly
- ✅ No "this should work" declarations

### 2. One Concern Per Fix
- ✅ Fix 2.1: ONLY virtual scrolling (JobsList)
- ✅ Fix 2.2: ONLY form draft migration
- ✅ Fix 2.3: ONLY photo confirmation (depends on 2.2)

### 3. Isolation & Rollback
- ✅ Each fix in separate commit
- ✅ Each fix independently deployable
- ✅ Rollback path documented for each

### 4. Integration Before Merge
- ✅ All 3 fixes tested together
- ✅ No regression in existing tests
- ✅ New tests don't flake

---

## 📋 WEEK 2 FIX SPECIFICATIONS

### FIX 2.1: Virtual Scrolling for JobsList

**GOAL:** Handle 500+ jobs without memory/performance issues

**Current State (Before):**
```typescript
// views/app/jobs/JobsList.tsx
const jobs = useMemo(() =>
  jobsData.filter(j => j.status !== JOB_STATUS.SUBMITTED),
  [jobsData]
);

return (
  <div className="space-y-2">
    {jobs.map(job => <JobCard key={job.id} job={job} />)}
  </div>
);
// ❌ PROBLEM: Renders ALL 500+ cards in DOM at once
// ❌ IMPACT: Scroll lag on low-end devices, memory bloat
```

**Target State (After):**
```typescript
import { FixedSizeList as List } from 'react-window';

// Virtualized list renders only visible items
<List
  height={containerHeight}
  itemCount={jobs.length}
  itemSize={CARD_HEIGHT} // 88px typical job card
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <JobCard job={jobs[index]} />
    </div>
  )}
</List>
// ✅ SOLUTION: Only 6-8 cards in DOM (rest virtual)
// ✅ PERFORMANCE: Smooth scroll at 60fps
```

**Files to Modify:**
1. `views/app/jobs/JobsList.tsx` (primary) - ~80 LOC changes
2. `package.json` - Add `react-window` (^1.8.10)
3. `tests/unit/views/JobsList.test.tsx` (enhance) - +15 tests

**Defensive Requirements:**
- [ ] Measure: Container height detection (ResizeObserver)
- [ ] Test: Scroll to bottom (pagination)
- [ ] Test: Filtering while scrolled (index update)
- [ ] Test: Adding/removing jobs (list update)
- [ ] Test: Performance: Scroll 1000 items in <16ms
- [ ] Test: Mobile (iOS SafariViewController)
- [ ] Test: Accessibility (keyboard nav still works)
- [ ] Test: No memory leaks (ResizeObserver cleanup)

**Critical Edge Cases:**
```typescript
test('handles empty job list', () => {
  // Should not crash with itemCount=0
});

test('scroll position preserved on filter', () => {
  // User scrolls to job #200
  // Filter changes
  // Scroll position should reset (expected), OR preserve (if still valid)
});

test('keyboard navigation still works', () => {
  // Tab through cards
  // Arrow keys might not work (virtualized)
  // Ensure accessible fallback
});

test('performance: 1000 jobs scroll smooth', () => {
  // Add 1000 items, measure scroll FPS
  // Should hit 60fps target
});

test('mobile viewport (iPhone 12)', () => {
  // Scroll on actual mobile Safari
  // Touch gestures still responsive
  // No jank on pinch-zoom
});
```

**Dependencies:**
- None - Fix 2.1 is independent

**Rollback Plan:**
- If virtual scroll causes layout issues → Remove `react-window`, use CSS `contain: layout`
- If performance doesn't improve → Use 2-column virtualization
- If accessibility fails → Add keyboard nav wrapper component

---

### FIX 2.2: JobForm Draft Migration to IndexedDB

**GOAL:** Migrate form drafts from localStorage (5MB limit) to IndexedDB (safer, larger)

**Current State (Before):**
```typescript
// views/app/jobs/JobForm.tsx
const saveDraft = useCallback((formData) => {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
  // ❌ PROBLEM 1: 5MB limit (large jobs fail silently)
  // ❌ PROBLEM 2: No quota checking
  // ❌ PROBLEM 3: Synced with localStorage cleanup (Fix 1.3)
}, []);
```

**Target State (After):**
```typescript
// views/app/jobs/JobForm.tsx (using IndexedDB)
const saveDraft = useCallback(async (formData) => {
  try {
    // Check quota BEFORE attempting save
    const hasSpace = await hasSpaceFor(
      JSON.stringify(formData).length
    );

    if (!hasSpace) {
      showNotification('Device storage full - archive old jobs', 'warning');
      return false;
    }

    // Save to IndexedDB (no size limit)
    const db = await getDatabase();
    await db.formDrafts.put({
      formType: 'job',
      data: formData,
      savedAt: Date.now(),
      wsId: workspaceId
    });

    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      showNotification('Storage full', 'error');
      return false;
    }
    throw error;
  }
}, [workspaceId]);

// Load draft on mount
useEffect(() => {
  const loadDraft = async () => {
    const db = await getDatabase();
    const draft = await db.formDrafts.get('job');
    if (draft && Date.now() - draft.savedAt < DRAFT_EXPIRY_MS) {
      // Auto-populate form
      setFormData(draft.data);
    }
  };

  loadDraft().catch(console.error);
}, []);
```

**Files to Modify:**
1. `views/app/jobs/JobForm.tsx` (primary) - ~40 LOC changes
2. `lib/offline/db.ts` (schema update) - +5 LOC
3. `lib/utils/storageUtils.ts` (new utility) - ~30 LOC
4. `tests/unit/jobFormDraft.test.ts` (new) - +40 LOC, 6 tests

**Defensive Requirements:**
- [ ] Migration: Read from localStorage, write to IndexedDB
- [ ] Backward compat: Support old localStorage format (temporary)
- [ ] Test: Form loads with large draft (>1MB)
- [ ] Test: Draft expires after 8 hours (handled by cleanup)
- [ ] Test: Quota check prevents write, shows warning
- [ ] Test: IndexedDB failure → fallback (log, don't crash)
- [ ] Test: Concurrent form instances (multi-tab)
- [ ] Test: Draft survives app kill (iOS background termination)
- [ ] Test: Draft cleared on logout (workspace isolation)

**Critical Edge Cases:**
```typescript
test('saves large job form (1MB+)', () => {
  // Create form with notes, photos metadata, timeline
  // Ensure save succeeds to IndexedDB
  // localStorage would fail at 5MB
});

test('quota check prevents write', () => {
  // Mock quota exceeded scenario
  // Form prevents save
  // Shows user warning
  // Form data NOT lost (still in memory + draft)
});

test('handles IndexedDB transaction abort', () => {
  // Simulate db.formDrafts.put() throws QuotaExceededError
  // Should gracefully degrade
  // User notified
  // Form doesn't crash
});

test('multi-tab sync (same workspace)', () => {
  // Tab A: Enter draft
  // Tab B: Refresh
  // Tab B should NOT load stale draft from localStorage
  // Should use IndexedDB (fresh)
});

test('workspace isolation', () => {
  // User A logs out
  // User B logs in
  // User A's drafts should be inaccessible
  // Enforce via wsId in key
});

test('migration from localStorage to IndexedDB', () => {
  // Simulate old localStorage draft existing
  // First load: migrate to IndexedDB
  // Second load: use IndexedDB (not localStorage)
});
```

**Dependencies:**
- Depends on: Fix 2.2 completion (form drafts saved)
- Blocks: Fix 2.3 (photo confirmation needs form draft safety)

**Rollback Plan:**
- If IndexedDB fails → Keep localStorage fallback
- If migration breaks → Clear drafts, start fresh
- If workspace isolation fails → Add wsId prefix to key names

---

### FIX 2.3: Photo Lifecycle Certainty UI

**GOAL:** User sees "Saved to device" confirmation after photo capture

**Current State (Before):**
```typescript
// views/tech/EvidenceCapture.tsx
const handlePhotoCapture = async (file: File) => {
  // Photo is captured
  // Compressed
  // Saved to IndexedDB
  // ❌ PROBLEM: User doesn't know if saved
  // ❌ IMPACT: Clicks "Use" multiple times thinking it failed
};

// Result: Duplicate photos, confused user
```

**Target State (After):**
```typescript
// views/tech/EvidenceCapture.tsx
const [photoSaveStatus, setPhotoSaveStatus] = useState<'saving' | 'saved' | 'error' | null>(null);

const handlePhotoCapture = async (file: File) => {
  setPhotoSaveStatus('saving');

  try {
    // Save photo to IndexedDB (with quota check)
    const photoId = await savePhotoToIndexedDB(file, jobId);

    // ✅ Clear success state
    setPhotoSaveStatus('saved');

    // Auto-dismiss after 2 seconds
    setTimeout(() => setPhotoSaveStatus(null), 2000);

    // Add to form
    addPhotoToJob(photoId);

  } catch (error) {
    setPhotoSaveStatus('error');
    showNotification('Failed to save photo', 'error');
  }
};

// UI component
{photoSaveStatus === 'saving' && (
  <PhotoSavingSpinner />
)}

{photoSaveStatus === 'saved' && (
  <PhotoSavedConfirmation /> // Green checkmark, "Saved to device", 2s auto-dismiss
)}

{photoSaveStatus === 'error' && (
  <PhotoSaveError onRetry={() => handlePhotoCapture(file)} />
)}
```

**Files to Modify:**
1. `views/tech/EvidenceCapture.tsx` (primary) - ~50 LOC changes
2. `components/PhotoSavedConfirmation.tsx` (new) - ~60 LOC
3. `tests/unit/components/PhotoSavedConfirmation.test.tsx` (new) - +25 LOC, 4 tests

**Defensive Requirements:**
- [ ] Test: Confirmation appears immediately after save
- [ ] Test: Auto-dismisses after 2 seconds
- [ ] Test: Doesn't auto-dismiss if error
- [ ] Test: Retry button works on error
- [ ] Test: Accessibility: Screen reader reads status
- [ ] Test: Won't show duplicate confirmations
- [ ] Test: Mobile (iOS) - not cut off by notch
- [ ] Test: High contrast (light mode & dark mode)

**Critical Edge Cases:**
```typescript
test('confirmation appears only after IndexedDB write succeeds', () => {
  // Mock slow IndexedDB write (100ms)
  // Confirmation should NOT appear until write completes
});

test('dismisses after 2 seconds', () => {
  // Show confirmation
  // Wait 2s
  // Assert: Component unmounts
  // Should not have stale state
});

test('error state persists (no auto-dismiss)', () => {
  // Save fails
  // Error shown
  // Wait 3s
  // Assert: Error still visible (user must acknowledge)
});

test('rapid photo capture (5 in a row)', () => {
  // Capture 5 photos quickly
  // Each should show confirmation
  // No overlap/conflict
  // All save successfully
});

test('photo saved while form unsaved', () => {
  // Photo: saved ✓
  // Form: unsaved
  // User should see: "Photo saved, but form not saved"
  // (related to Fix 2.2 form draft)
});

test('accessibility: screen reader announces "Photo saved"', () => {
  // Assert: aria-live="polite" or aria-atomic
  // Message should be announced
});
```

**Dependencies:**
- Blocks: None
- Depends on: Fix 2.2 (form draft safety)

**Rollback Plan:**
- If confirmation UI breaks → Revert to silent save (prior state)
- If accessibility fails → Use toast notification instead of inline
- If performance issue → Lazy-load confirmation component

---

## 🧪 TEST STRATEGY

### Test Execution Order (Careful, Robust)

**Phase 1: Unit Tests (Each Fix)**
```
Fix 2.1: Virtual Scrolling
├─ Component rendering (empty, 10, 100, 1000 items)
├─ Scroll performance (60fps target)
├─ Filtering/updating list
├─ Accessibility
└─ Memory leaks (ResizeObserver cleanup)

Fix 2.2: Form Draft Migration
├─ Save to IndexedDB
├─ Load from IndexedDB
├─ Quota checking
├─ Backward compatibility (localStorage fallback)
├─ Multi-tab isolation
└─ Workspace isolation

Fix 2.3: Photo Confirmation
├─ Show confirmation after save
├─ Auto-dismiss timing
├─ Error handling
├─ Rapid captures
└─ Accessibility
```

**Phase 2: Integration Tests (2.1 + 2.2 + 2.3 together)**
```
Scenario 1: Create job, scroll to bottom, add photos
- Verify: Virtual scroll works with live data updates
- Verify: Photos save with confirmations
- Verify: Form draft saves automatically

Scenario 2: Mobile (iOS) - Long job list, add photos
- Verify: 200+ jobs scroll smooth
- Verify: Photo confirm doesn't cover form
- Verify: Form draft persists after app kill

Scenario 3: Quota exceeded scenario
- Fill IndexedDB to >90%
- Attempt to save photo
- Verify: Warning shown
- Verify: Form draft still saveable
- Verify: No data loss
```

**Phase 3: Regression Tests (Full Suite)**
```
npm test -- --run
- Target: 670-680 tests passing
- No failures in existing tests
- No new flaky tests
```

### Quality Checkpoints

**Before Commit (Each Fix):**
- [ ] Tests pass: `npm test -- --run`
- [ ] Build succeeds: `npm run build`
- [ ] Type-safe: `npm run type-check`
- [ ] Lints: `npm run lint`
- [ ] No console.warn or console.error from new code
- [ ] Edge cases documented in tests

**Before Merge (After All 3 Fixes):**
- [ ] Integration tests pass
- [ ] No regressions in Week 1 fixes
- [ ] Memory profiling: <150MB at 1000 jobs
- [ ] Bundle size impact: <50KB additional (react-window is ~30KB)
- [ ] Performance: JobsList scroll 60fps at 1000 items

---

## 🎯 EXECUTION SEQUENCE

```
TIMELINE:

T+0:  Launch agent for Fix 2.1 (Virtual Scrolling)
      └─ Parallel with Fix 2.2

T+0:  Launch agent for Fix 2.2 (Form Draft Migration)
      └─ Parallel with Fix 2.1
      └─ Blocks Fix 2.3

T+30min: (Assuming Fix 2.1 & 2.2 done) Launch Fix 2.3 (Photo Confirm)
         └─ Sequential (depends on Fix 2.2)

T+4h: All fixes committed & tested
T+4.5h: Integration tests complete
T+5h:  Final regression tests (full suite)
T+5.5h: Ready for merge/deployment
```

**Parallel Execution:**
- Agent 1: Fix 2.1 (Virtual Scrolling) - Independent
- Agent 2: Fix 2.2 (Form Draft Migration) - Independent
- Agent 3: Fix 2.3 (Photo Confirmation) - Wait for Agent 2, then execute

---

## 🛡️ DEFENSIVE CODING PATTERNS

### Pattern 1: Pre-flight Checks
```typescript
// Before every operation that could fail
async function savePhotoWithDefense(file: File): Promise<boolean> {
  // 1. Check preconditions
  if (!file) throw new Error('No file provided');
  if (!jobId) throw new Error('Job context missing');

  // 2. Check quota
  const hasSpace = await checkStorageQuota(file.size);
  if (!hasSpace) {
    notifyUser('Storage full', 'warning');
    return false; // Fail gracefully, don't throw
  }

  // 3. Execute with try/catch
  try {
    const result = await db.media.add({ ... });
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      notifyUser('Storage quota exceeded', 'error');
      return false;
    }
    // Unknown error - throw for debugging
    throw error;
  }
}
```

### Pattern 2: Explicit Cleanup
```typescript
// ResizeObserver, setTimeout, event listeners must clean up
useEffect(() => {
  const resizeObserver = new ResizeObserver(handleResize);
  const container = containerRef.current;

  if (container) {
    resizeObserver.observe(container);
  }

  // Explicit cleanup
  return () => {
    if (container) {
      resizeObserver.unobserve(container);
    }
    resizeObserver.disconnect();
  };
}, []);
```

### Pattern 3: Explicit Error Boundaries
```typescript
// Every async operation needs error boundary
const saveDraft = async (data) => {
  try {
    // Operation
    await db.formDrafts.put(data);
  } catch (error) {
    // Log for debugging (don't swallow)
    console.error('[JobForm] Draft save failed:', error);

    // Handle specific errors
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      showNotification('Storage full - archive jobs', 'error');
      return false;
    }

    // Re-throw unknown errors
    throw error;
  }
};
```

### Pattern 4: Accessibility First
```typescript
// Every UI change must be accessible
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  className="photo-confirmation"
>
  <CheckIcon aria-hidden="true" />
  <span>Photo saved to device</span>
</div>
```

---

## 📊 TOKEN BUDGET ALLOCATION (Week 2)

```
Total Available: 405 tokens (reserve)
Week 2 Allocation: ~520 tokens (from original budget)

Fix 2.1 (Virtual Scrolling):
  └─ 190 tokens (code + tests + perf verification)

Fix 2.2 (Form Draft Migration):
  └─ 175 tokens (code + tests + migration logic)

Fix 2.3 (Photo Confirmation):
  └─ 125 tokens (code + tests + accessibility)

Buffer/Contingency: 30 tokens

Total: 520 tokens (within budget)
```

---

## ✅ LAUNCH READINESS CHECKLIST

Before agents begin:
- [ ] All 3 fixes have detailed specifications (above)
- [ ] All edge cases documented
- [ ] Test cases pre-written (not during implementation)
- [ ] Defensive patterns defined
- [ ] Rollback plans documented
- [ ] Token budget allocated
- [ ] Parallel execution strategy clear
- [ ] Quality gates defined
- [ ] Integration test plan clear

**Status: READY TO LAUNCH**

---

**Next: Deploy Week 2 agents with these specifications (no ad-hoc decisions)**
