# SPRINT: Cold Weather UX Hardening

**Target Score:** 62/100 → 85/100
**Sprint Duration:** 1 cycle
**Branch:** `claude/cold-weather-ux-audit-F1s9Z`

---

## VERIFICATION ORCHESTRATOR

Each fix MUST pass this gate before marked GREEN:

```
[ ] Code change complete
[ ] Before/after context documented (20 lines)
[ ] npm test -- --run passes
[ ] npm run build succeeds
[ ] Manual UAT script verified
[ ] Evidence captured (screenshot or test output)
```

---

## PHASE 1: CRITICAL (Ship Blockers)

### FIX-001: Dashboard.tsx Broken Code
**Risk:** CRITICAL - Runtime crash
**File:** `views/app/Dashboard.tsx:44-79`

**Problem:** Orphaned code block references undefined variables (`jobs`, `items`, `clients`) inside `getEvidenceStatus()` function.

**Before (lines 44-79):**
```typescript
// This code is INSIDE getEvidenceStatus() but references external vars
jobs.filter(j => j.status === 'Submitted' && !j.sealedAt)
  .forEach(job => {
    items.push({ ... });  // 'items' not defined
  });
```

**Fix:** DELETE lines 44-79 entirely (orphaned fragment from merge)

**Verification:**
```bash
npm test -- --run
npm run build
# Navigate to /admin dashboard - should render without crash
```

**UAT Script:**
1. Open incognito browser
2. Login as manager
3. Navigate to /admin
4. Expect: Dashboard loads, shows "Needs Proof" section
5. No console errors

**Status:** [ ] PENDING → [ ] IN_PROGRESS → [ ] GREEN

---

### FIX-002: EvidenceCapture Offline Indicator
**Risk:** CRITICAL - Field worker thinks photo is lost
**File:** `views/tech/EvidenceCapture.tsx`

**Problem:** No OfflineIndicator component, no "Photo Saved" confirmation

**Before:** Photo saves silently, navigates away with no feedback

**Fix:**
1. Import OfflineIndicator component
2. Add to header area
3. Add toast confirmation on save: "Photo Captured - Saved locally"

**Add after line 12:**
```typescript
import { OfflineIndicator } from '../../components/OfflineIndicator';
import { showToast } from '../../lib/microInteractions';
```

**Add in JSX header area (after line ~250):**
```typescript
<OfflineIndicator className="absolute top-4 right-16 z-10" />
```

**Add in savePhoto function (after line ~140):**
```typescript
showToast('Photo Captured', 'Saved locally - will sync when online', 'success');
```

**Verification:**
```bash
npm test -- --run
npm run build
```

**UAT Script:**
1. Enable airplane mode
2. Open /tech/capture/{jobId}
3. Capture a photo
4. Expect: Toast shows "Photo Captured - Saved locally"
5. Expect: OfflineIndicator visible in header

**Status:** [ ] PENDING → [ ] IN_PROGRESS → [ ] GREEN

---

### FIX-003: Layout Persona Badge
**Risk:** CRITICAL - Role confusion on shared devices
**File:** `components/Layout.tsx:68`

**Problem:** Shows `user.role` ("Member") not `user.persona` ("Solo Contractor")

**Before (line 68):**
```typescript
<p className="text-[10px] text-slate-300 truncate uppercase font-black tracking-widest">
  {user?.role || 'Member'}
</p>
```

**Fix:** Display persona with visual badge

**After:**
```typescript
<p className="text-[10px] text-slate-300 truncate uppercase font-black tracking-widest">
  {user?.persona || user?.role || 'Member'}
</p>
{user?.persona && (
  <span className="text-[8px] text-primary bg-primary/10 px-2 py-0.5 rounded-full">
    Active Role
  </span>
)}
```

**Verification:**
```bash
npm test -- --run
npm run build
```

**UAT Script:**
1. Login as solo_contractor
2. Expect: Sidebar shows "Solo Contractor" not "Member"
3. Expect: "Active Role" badge visible

**Status:** [ ] PENDING → [ ] IN_PROGRESS → [ ] GREEN

---

## PHASE 2: HIGH PRIORITY (Data Loss Prevention)

### FIX-004: ClientForm useWorkspaceData Migration
**Risk:** HIGH - Silent data loss
**File:** `views/app/clients/ClientForm.tsx:14,40`

**Problem:** Uses deprecated `useWorkspaceData` hook instead of `useData`

**Before (line 14):**
```typescript
import { useWorkspaceData } from '../../../hooks/useWorkspaceData';
```

**Before (line 40):**
```typescript
const { clients, createClient, updateClient } = useWorkspaceData();
```

**Fix:**
```typescript
// Line 14:
import { useData } from '../../../lib/DataContext';

// Line 40:
const { clients, addClient, updateClient: contextUpdateClient } = useData();
```

**Also update function calls:**
- `createClient(newClient)` → `addClient(newClient)`
- `updateClient(id, data)` → `contextUpdateClient({ ...existingClient, ...data })`

**Verification:**
```bash
npm test -- --run
npm run build
```

**UAT Script:**
1. Create new client
2. Refresh page
3. Expect: Client still exists
4. Edit client name
5. Refresh page
6. Expect: Name change persisted

**Status:** [ ] PENDING → [ ] IN_PROGRESS → [ ] GREEN

---

### FIX-005: TechnicianForm useWorkspaceData Migration
**Risk:** HIGH - Silent data loss
**File:** `views/app/technicians/TechnicianForm.tsx:13,43`

**Problem:** Uses deprecated `useWorkspaceData` hook instead of `useData`

**Before (line 13):**
```typescript
import { useWorkspaceData } from '../../../hooks/useWorkspaceData';
```

**Fix:** Same pattern as FIX-004

**Status:** [ ] PENDING → [ ] IN_PROGRESS → [ ] GREEN

---

### FIX-006: JobSwitcher ConfirmDialog
**Risk:** HIGH - Accidental job switch with gloves
**File:** `components/JobSwitcher.tsx:63`

**Problem:** Uses browser `alert()` instead of proper confirmation

**Before (line 63):**
```typescript
alert('Please pause your current job before switching.');
```

**Fix:**
1. Import ConfirmDialog
2. Add state for dialog visibility
3. Replace alert with modal showing pause options

**Add import:**
```typescript
import { ConfirmDialog } from './ui/ConfirmDialog';
```

**Replace alert with:**
```typescript
setShowPauseDialog(true);
// Render ConfirmDialog in JSX
```

**Verification:**
```bash
npm test -- --run
npm run build
```

**UAT Script:**
1. Start a job (In Progress)
2. Open job switcher
3. Try to resume a paused job
4. Expect: Modal asks "Pause current job?"
5. Confirm → navigates to other job

**Status:** [ ] PENDING → [ ] IN_PROGRESS → [ ] GREEN

---

### FIX-007: Reduce Sync Retry Window
**Risk:** HIGH - 12-minute feedback delay
**File:** `lib/syncQueue.ts:23`

**Problem:** 12-minute total retry window before user notification

**Before (line 23):**
```typescript
export const RETRY_DELAYS = [2000, 5000, 15000, 30000, 60000, 120000, 180000, 300000];
```

**Fix:** Reduce to 3-minute window with faster early feedback
```typescript
// FIELD-OPTIMIZED: 3-minute window with faster early feedback
// Total: 2s + 4s + 8s + 15s + 30s + 60s + 60s = 179s (~3 minutes)
export const RETRY_DELAYS = [2000, 4000, 8000, 15000, 30000, 60000, 60000];
const MAX_RETRIES = 7;
```

**Verification:**
```bash
npm test -- --run
npm run build
```

**Status:** [ ] PENDING → [ ] IN_PROGRESS → [ ] GREEN

---

### FIX-008: Photo Saved Toast Confirmation
**Risk:** HIGH - Technician thinks photo lost
**File:** `views/tech/EvidenceCapture.tsx` (covered in FIX-002)

**Merged into FIX-002**

**Status:** [ ] MERGED

---

## PHASE 3: MEDIUM PRIORITY (UX Polish)

### FIX-009: Admin Route Persona Validation
**Risk:** MEDIUM - Technicians can access admin views
**File:** `App.tsx:541-569`

**Problem:** Routes only check `isAuthenticated`, not persona

**Fix:** Add persona check for admin routes

**Before:**
```typescript
<Route path="/admin" element={
  isAuthenticated ? (
    <AdminDashboard {...} />
  ) : <Navigate to="/auth" replace />
} />
```

**After:**
```typescript
<Route path="/admin" element={
  isAuthenticated && user?.persona &&
  ['agency_owner', 'compliance_officer', 'safety_manager'].includes(user.persona) ? (
    <AdminDashboard {...} />
  ) : isAuthenticated ? (
    <Navigate to="/home" replace />
  ) : <Navigate to="/auth" replace />
} />
```

**Status:** [ ] PENDING → [ ] IN_PROGRESS → [ ] GREEN

---

### FIX-010: JobList Pagination
**Risk:** MEDIUM - DOM overload at 100+ jobs
**File:** `views/app/jobs/JobList.tsx`

**Problem:** Renders ALL jobs without pagination

**Fix:** Add pagination with 20 items per page

**Status:** [ ] PENDING → [ ] IN_PROGRESS → [ ] GREEN

---

### FIX-011: Delete Dead View Components
**Risk:** MEDIUM - Maintenance confusion
**Files to DELETE:**
- `views/app/jobs/JobList.tsx` (duplicate of JobsList.tsx)
- `views/app/clients/ClientList.tsx` (duplicate)
- `views/app/clients/ClientDetail.tsx` (unused)
- `views/app/invoices/InvoiceList.tsx` (unused)
- `views/app/invoices/InvoiceDetail.tsx` (unused)
- `views/app/technicians/TechnicianList.tsx` (unused)
- `views/public/CertificateVerify.tsx` (orphaned)

**Verification:**
```bash
# After deletion:
npm test -- --run
npm run build
# Grep for imports - should find 0 references
grep -r "JobList" views/ --include="*.tsx" | grep -v JobsList
```

**Status:** [ ] PENDING → [ ] IN_PROGRESS → [ ] GREEN

---

## VERIFICATION CHECKLIST (Run Before Commit)

```bash
# MANDATORY before every commit:
npm test -- --run && npm run lint && npm run type-check && npm run build

# Expected output:
# ✓ 367+ tests passed
# ✓ 0 lint errors
# ✓ 0 type errors
# ✓ Build successful
```

---

## SCORING PROJECTION

| Fix | Dimension | Points Added |
|-----|-----------|--------------|
| FIX-001 | Tech Debt | +3 |
| FIX-002 | Offline Safety | +2 |
| FIX-003 | Role Handling | +2 |
| FIX-004 | Tech Debt | +1 |
| FIX-005 | Tech Debt | +1 |
| FIX-006 | Attention Control | +1 |
| FIX-007 | Failure Handling | +2 |
| FIX-009 | Role Handling | +1 |
| FIX-010 | Job Volume | +2 |
| FIX-011 | Tech Debt | +1 |

**Projected Score:** 62 + 16 = **78/100**

Additional fixes needed for 85+:
- End-of-day closure ritual (+3)
- Post-sync "what changed" notification (+2)
- Touch target fixes (14 violations) (+2)

---

## COMMIT MESSAGE TEMPLATE

```
fix(field-ux): [FIX-XXX] <description>

- Before: <problem>
- After: <solution>
- Evidence: <test output or UAT result>

Closes cold-weather-ux audit item XXX

https://claude.ai/code/session_01QtnVstLZmm5S3UFtohv8BG
```

---

## DAILY STANDUP TRACKER

| Date | Fixes Completed | Tests Passing | Build Status | Blocker |
|------|-----------------|---------------|--------------|---------|
| Day 1 (2026-02-01) | FIX-001 to FIX-008 (8 fixes) | 367/367 | SUCCESS | None |
| Day 2 | | | | |
| Day 3 | | | | |

---

## PHASE 1 COMPLETION EVIDENCE

**Commit:** `6b16420`
**Branch:** `claude/cold-weather-ux-audit-F1s9Z`
**Push:** SUCCESS

**Test Output:**
```
Test Files  21 passed (21)
     Tests  367 passed (367)
  Duration  17.31s
```

**Build Output:**
```
✓ built in 10.68s
45 chunks generated
```

**Files Changed:**
- components/JobSwitcher.tsx (+35 lines)
- components/Layout.tsx (+25 lines)
- lib/syncQueue.ts (+3 lines, -3 lines)
- views/app/Dashboard.tsx (+6 lines, -36 lines)
- views/app/clients/ClientForm.tsx (+8 lines, -4 lines)
- views/app/technicians/TechnicianForm.tsx (+8 lines, -4 lines)
- views/tech/EvidenceCapture.tsx (+11 lines, -2 lines)

---

*This sprint plan is the orchestration source of truth. No fix is GREEN until verification passes.*
