# 🏃 Dashboard Refactor Sprint Board
**Project:** JobProof Dashboard Unification
**Sprint Start:** February 2026
**Last Updated:** 2026-02-02
**Branch:** `claude/dashboard-sprint-planning-UeB4n`

---

## ✅ BASELINE VERIFICATION (2026-02-02)

| Check | Result | Notes |
|-------|--------|-------|
| **Test Suite** | ✅ 524/524 passed | All tests green in 18.43s |
| **Type Check** | ⚠️ 14 errors | Pre-existing errors (documented in DEBT-1 to DEBT-4) |
| **Production Build** | ✅ Success | Built in 10.72s, 39 chunks |
| **Legacy Audit: technicianRows** | ✅ 0 matches | Legacy code fully removed |
| **Legacy Audit: getJobs** | ✅ 0 matches | Deprecated hook not used |

**Pre-existing TypeScript Errors (non-blocking):**
- `FocusCard.tsx:132` - unknown to ReactNode (DEBT-3)
- `views/app/*/index.ts` - module resolution (DEBT-2)
- `JobForm.tsx:137` - FormData conversion (DEBT-4)
- `EvidenceCapture.tsx:195,211,227,482` - SYNC_STATUS + variant prop (DEBT-1)

---

## 📋 Architecture Invariants (MUST PRESERVE)

All tasks must respect these 6 invariants from `lib/deriveDashboardState.ts`:

| ID | Invariant | Enforcement |
|----|-----------|-------------|
| **INV-1** | Focus is null or single entity | Type system: `FocusEntity \| null` |
| **INV-2** | Queue length ≤ 5 (MAX_QUEUE_SIZE) | Early break during derivation |
| **INV-3** | No duplicate IDs across focus/queue/background | `usedIds` Set tracks all IDs |
| **INV-4** | All routes start with `/` | Validation function enforces |
| **INV-5** | Queue sorted by urgency descending | Post-build sort: `b.urgency - a.urgency` |
| **INV-6** | Idle technicians never in focus or queue | `!tw.isIdle` filter before adding |

> ⚠️ **ARCHITECTURE FREEZE:** The derivation function is the SINGLE SOURCE OF TRUTH. Dashboard views are render-only wrappers.

---

## 📦 BACKLOG (Non-Blocking Deferred Debt)

These items are tracked but not blocking current work. Address in future sprints.

| ID | Title | Description | Role | Priority | Est. Effort |
|----|-------|-------------|------|----------|-------------|
| **DEBT-1** | EvidenceCapture TypeScript errors | TypeScript errors in `views/tech/EvidenceCapture.tsx` (SYNC_STATUS import, OfflineIndicator variant prop). Non-blocking—component functions correctly at runtime. Fix involves adding missing import and correcting prop type. | Developer | P2 | 1h |
| **DEBT-2** | Module resolution errors in index.ts | TypeScript module resolution errors in `views/app/*/index.ts` files. Lazy loading works despite TS complaints. Root cause is barrel export pattern interaction with Vite. | Developer | P2 | 2h |
| **DEBT-3** | FocusCard metadata type assertion | `components/dashboard/FocusCard.tsx:132` has `'unknown'` to ReactNode type assertion. Cosmetic issue—renders correctly. Should use proper generic or type guard. | Developer | P2 | 0.5h |
| **DEBT-4** | JobForm FormData conversion | `views/app/jobs/JobForm.tsx:137` has FormData to `Record<string,unknown>` conversion. Runtime safe but TypeScript unhappy. Needs proper FormData typing. | Developer | P2 | 1h |
| **DEBT-5** | lastSyncTime tracking in DataContext | TODO in `useDashboard.ts:47` - lastSyncTime not yet tracked in DataContext. Current `isStale` detection uses hardcoded 5-minute threshold. Fallback works but is imprecise. | Developer | P1 | 3h |
| **DEBT-6** | ManagerFocusDashboard evaluation | `views/app/ManagerFocusDashboard.tsx` is an alternative implementation not currently routed. Needs A/B testing evaluation before deletion or promotion decision. | PM | P2 | 4h |
| **DEBT-7** | UnopenedLinksActionCenter consolidation | Parallel action surface for magic link management. Functional but could be consolidated into FocusCard attention items for unified UX. | Developer | P1 | 6h |

---

## 🚀 CURRENT SPRINT TASKS

### Sprint Goal
> Stabilize all three dashboard views (Admin, Contractor, Client), complete migration verification, ship 5 cleanup PRs, and achieve 100% test coverage on count consistency.

---

### 🔴 P0 - Critical Path (Must Complete)

#### TASK-001: Verify Count Consistency Tests Pass
| Field | Value |
|-------|-------|
| **Title** | Verify count consistency regression tests |
| **Description** | Run the count consistency regression tests added in commit `27e4ac7` to confirm the "17 → 0" bug fix is stable. These tests verify that displayed counts in headers always match the actual number of rendered items in UnifiedDashboard. Failure indicates a parallel derivation bug. |
| **Role** | QA |
| **Priority** | P0 |
| **Estimated Effort** | 0.5h |
| **Dependencies** | None |
| **Status** | ✅ `done` |
| **Commands** | `npm test -- --run tests/unit/deriveDashboardState.test.ts` |
| **Success Criteria** | All 33 tests pass, specifically "Count Consistency Regression" block (4 tests) |
| **Invariants** | Validates INV-3 (no duplicate IDs) and count matching |

#### TASK-002: Full Test Suite Verification
| Field | Value |
|-------|-------|
| **Title** | Run full test suite and build verification |
| **Description** | Execute the complete test suite (524+ tests), type checking, and production build to establish a stable baseline before any cleanup PRs. This is the gate for all subsequent work. Any failures must be triaged before proceeding. |
| **Role** | QA |
| **Priority** | P0 |
| **Estimated Effort** | 0.5h |
| **Dependencies** | None |
| **Status** | ✅ `done` |
| **Commands** | `npm test -- --run && npm run type-check && npm run build` |
| **Success Criteria** | All tests pass, build succeeds (pre-existing TS errors acceptable) |
| **Invariants** | All 6 invariants validated via unit tests |

#### TASK-003: Stable ID Fix Verification (Contractor)
| Field | Value |
|-------|-------|
| **Title** | Verify stable ID fix in ContractorDashboard activeJobCount |
| **Description** | The `activeJobCount` useMemo in ContractorDashboard previously used unstable job filtering that caused count mismatches. Verify the fix uses stable IDs matching those in deriveDashboardState. Cross-reference with INV-3 (no duplicate IDs). |
| **Role** | Developer |
| **Priority** | P0 |
| **Estimated Effort** | 1h |
| **Dependencies** | TASK-001 |
| **Status** | ✅ `done` |
| **Files** | `views/ContractorDashboard.tsx` |
| **Success Criteria** | activeJobCount header matches queue length in all scenarios |
| **Invariants** | INV-3 (no duplicate IDs) |
| **Verification** | Line 45-54: Uses `user.id` (UUID) to match `job.techId` / `job.technicianId` |

---

### 🟠 P1 - High Priority (Sprint Committed)

#### TASK-004: PR #1 - Admin Dashboard Cleanup
| Field | Value |
|-------|-------|
| **Title** | Remove unused imports from AdminDashboard |
| **Description** | Audit and remove legacy imports from AdminDashboard.tsx that are no longer used after UnifiedDashboard migration. Specifically: JOB_STATUS, TECHNICIAN_STATUS, SYNC_STATUS, canTechnicianAcceptJobs helper, and any technicianRows/activeJobs filter code. Keep EmailVerificationBanner, UnopenedLinksActionCenter, and custom header with "New Job" button. |
| **Role** | Developer |
| **Priority** | P1 |
| **Estimated Effort** | 2h |
| **Dependencies** | TASK-002 |
| **Status** | `todo` |
| **Branch** | `claude/dashboard-cleanup-admin-{sessionId}` |
| **Commit** | `refactor(admin): remove legacy imports (JOB_STATUS, technicianRows helpers)` |
| **Files** | `views/AdminDashboard.tsx` |
| **Group** | Admin/Manager |
| **Invariants** | N/A (cleanup only) |

#### TASK-005: PR #2 - Contractor Stable ID Test
| Field | Value |
|-------|-------|
| **Title** | Add unit test for Contractor activeJobCount stable IDs |
| **Description** | Write a dedicated unit test verifying that ContractorDashboard's activeJobCount useMemo uses stable IDs that match the IDs used by deriveDashboardState. This prevents future regressions of the count mismatch bug. Test should cover: matching tech by both `techId` and `technicianId` fields, exclusion of completed jobs, and ID stability across re-renders. |
| **Role** | Developer |
| **Priority** | P1 |
| **Estimated Effort** | 3h |
| **Dependencies** | TASK-003 |
| **Status** | `todo` |
| **Branch** | `claude/dashboard-cleanup-contractor-{sessionId}` |
| **Commit** | `test(contractor): add unit test for activeJobCount stable ID matching` |
| **Files** | `tests/unit/ContractorDashboard.test.ts` (new) |
| **Group** | Contractor |
| **Invariants** | INV-3 (no duplicate IDs) |

#### TASK-006: PR #3 - Client Invoice Logic Documentation
| Field | Value |
|-------|-------|
| **Title** | Document invoice logic separation from deriveDashboardState |
| **Description** | Add architectural documentation explaining why ClientDashboard keeps invoice-specific logic (pendingInvoices, unpaidCount) separate from deriveDashboardState. The derivation function handles job state only—invoice state has different lifecycle, permissions, and sync requirements. This prevents future "consolidation" attempts that would break the architecture. |
| **Role** | Developer |
| **Priority** | P1 |
| **Estimated Effort** | 1.5h |
| **Dependencies** | TASK-002 |
| **Status** | `todo` |
| **Branch** | `claude/dashboard-cleanup-client-{sessionId}` |
| **Commit** | `docs(client): add comment explaining invoice logic kept separate from deriveDashboardState` |
| **Files** | `views/ClientDashboard.tsx` |
| **Group** | Client |
| **Invariants** | Architecture freeze documentation |

#### TASK-007: PR #4 - TypeScript Error Fixes
| Field | Value |
|-------|-------|
| **Title** | Resolve pre-existing TypeScript errors |
| **Description** | Fix TypeScript errors that exist in the codebase but don't block functionality: (1) Add missing SYNC_STATUS import to EvidenceCapture.tsx, (2) Fix OfflineIndicator variant prop type, (3) Correct FocusCard metadata type from unknown to proper generic. These are cosmetic but improve developer experience and CI reliability. |
| **Role** | Developer |
| **Priority** | P1 |
| **Estimated Effort** | 2h |
| **Dependencies** | TASK-002 |
| **Status** | `todo` |
| **Branch** | `claude/dashboard-ts-fixes-{sessionId}` |
| **Commit** | `fix(types): add SYNC_STATUS import to EvidenceCapture, fix FocusCard metadata type` |
| **Files** | `views/tech/EvidenceCapture.tsx`, `components/dashboard/FocusCard.tsx` |
| **Group** | Cross-cutting |
| **Invariants** | N/A (type fixes only) |

#### TASK-008: PR #5 - UnopenedLinksActionCenter ADR
| Field | Value |
|-------|-------|
| **Title** | Create ADR for UnopenedLinksActionCenter consolidation path |
| **Description** | Write an Architecture Decision Record (ADR) documenting the evaluation and migration path for consolidating UnopenedLinksActionCenter into the FocusCard attention system. Document: current behavior, proposed FocusEntity integration, severity mapping (unopened links → warning), and migration steps. Do NOT implement—document only. |
| **Role** | Developer |
| **Priority** | P1 |
| **Estimated Effort** | 2h |
| **Dependencies** | TASK-002 |
| **Status** | `todo` |
| **Branch** | `claude/dashboard-unopened-links-{sessionId}` |
| **Commit** | `docs(attention): add ADR for UnopenedLinksActionCenter → FocusCard migration path` |
| **Files** | `docs/adr/ADR-003-unopened-links-consolidation.md` (new) |
| **Group** | Admin/Manager |
| **Invariants** | INV-1 (focus is null or single entity) |

---

### 🟡 P1 - Migration Verification Checklist

| ID | Task | Role | Priority | Est. | Status | Group |
|----|------|------|----------|------|--------|-------|
| **MIG-01** | Verify all dashboard views import UnifiedDashboard from `../components/dashboard` | Developer | P1 | 0.5h | `todo` | All |
| **MIG-02** | Verify no direct `useData().jobs` filtering in dashboard wrappers (except role-specific header counts) | Developer | P1 | 1h | `todo` | All |
| **MIG-03** | Verify role prop: AdminDashboard→`role='manager'`, ContractorDashboard→`role='solo_contractor'`, ClientDashboard→`role='client'` | Developer | P1 | 0.5h | `todo` | All |
| **MIG-04** | Verify custom header/emptyState props use `useMemo()` to prevent re-renders | Developer | P1 | 1h | `todo` | All |
| **MIG-05** | Verify Layout wrapper props: `isAdmin={true}` for manager, `isAdmin={false}` for contractor/client | Developer | P1 | 0.5h | `todo` | All |
| **MIG-06** | Verify OfflineIndicator present in ContractorDashboard, EmailVerificationBanner in AdminDashboard | Developer | P1 | 0.5h | `todo` | Contractor, Admin |
| **MIG-07** | Verify no useState for jobs/clients/technicians in any dashboard wrapper | Developer | P1 | 0.5h | `todo` | All |
| **MIG-08** | Verify error boundaries wrap dashboard routes in App.tsx with `fallbackRoute='/home'` | Developer | P1 | 0.5h | `todo` | All |
| **MIG-09** | Audit: `grep -r 'technicianRows' views/` returns 0 matches (legacy code removed) | QA | P1 | 0.25h | `todo` | All |
| **MIG-10** | Audit: `grep -r 'getJobs' views/` returns 0 matches (deprecated hook not used) | QA | P1 | 0.25h | `todo` | All |

---

### 🟢 P1 - Manual Testing Checklist

| ID | Test Scenario | Role | Priority | Est. | Status | Group |
|----|---------------|------|----------|------|--------|-------|
| **TEST-01** | Offline mode: airplane mode → refresh → dashboards render from IndexedDB | QA | P1 | 0.5h | `todo` | All |
| **TEST-02** | Count consistency: job counts in headers match UnifiedDashboard queue lengths | QA | P1 | 0.5h | `todo` | All |
| **TEST-03** | Navigation: FocusCard actionRoute navigates correctly | QA | P1 | 0.25h | `todo` | All |
| **TEST-04** | Navigation: QueueList item.route navigates correctly | QA | P1 | 0.25h | `todo` | All |
| **TEST-05** | Sync indicators: pending/failed jobs show SyncStatusBadge in FocusCard/QueueList | QA | P1 | 0.5h | `todo` | All |
| **TEST-06** | Login as manager → /admin → verify FocusCard shows highest-priority job/technician | QA | P1 | 0.25h | `todo` | Admin |
| **TEST-07** | Login as manager → /admin → verify QueueList shows ≤5 items sorted by urgency | QA | P1 | 0.25h | `todo` | Admin |
| **TEST-08** | Login as contractor → /contractor → verify activeJobCount header matches visible jobs | QA | P1 | 0.25h | `todo` | Contractor |
| **TEST-09** | Login as contractor → /contractor → verify "All Clear" empty state when no jobs | QA | P1 | 0.25h | `todo` | Contractor |
| **TEST-10** | Login as client → /client → verify invoice "Action Required" section renders | QA | P1 | 0.25h | `todo` | Client |
| **TEST-11** | Create job offline → verify SyncStatusBadge shows 'pending' | QA | P1 | 0.5h | `todo` | All |

---

### 🔵 P2 - Deletion Plan (Post-Verification)

Execute these ONLY after all P0/P1 tasks complete and tests pass.

| ID | Action | Description | Files | Group | Dependencies |
|----|--------|-------------|-------|-------|--------------|
| **DEL-01** | KEEP | AdminDashboard.tsx as thin wrapper (Layout, EmailVerificationBanner, UnopenedLinksActionCenter) | `views/AdminDashboard.tsx` | Admin | MIG-01 to MIG-10 |
| **DEL-02** | DELETE | Legacy state computation (technicianRows, activeJobs filters) if any remains | `views/AdminDashboard.tsx` | Admin | MIG-09 |
| **DEL-03** | DELETE | Unused imports: JOB_STATUS, TECHNICIAN_STATUS, SYNC_STATUS, canTechnicianAcceptJobs if not used | `views/AdminDashboard.tsx` | Admin | TASK-004 |
| **DEL-04** | KEEP | Custom dashboardHeader with "New Job" button (role-specific UX) | `views/AdminDashboard.tsx` | Admin | - |
| **DEL-05** | EVALUATE | ManagerFocusDashboard.tsx for deletion or promotion after A/B testing | `views/app/ManagerFocusDashboard.tsx` | Admin | DEBT-6 |
| **DEL-06** | KEEP | ContractorDashboard.tsx as thin wrapper (Layout isAdmin=false, OnboardingTour, OfflineIndicator) | `views/ContractorDashboard.tsx` | Contractor | MIG-01 to MIG-10 |
| **DEL-07** | KEEP | activeJobCount useMemo (uses stable IDs, P0 fix applied) | `views/ContractorDashboard.tsx` | Contractor | TASK-003 |
| **DEL-08** | KEEP | Custom emptyState ("All Clear" messaging) | `views/ContractorDashboard.tsx` | Contractor | - |
| **DEL-09** | DELETE | SoloContractorDashboard.tsx if exists and unused | `views/app/SoloContractorDashboard.tsx` | Contractor | MIG-02 |
| **DEL-10** | VERIFY | OnboardingTour still fires via showOnboarding prop | `views/ContractorDashboard.tsx` | Contractor | TEST-09 |
| **DEL-11** | KEEP | ClientDashboard.tsx as thin wrapper (Layout isAdmin=false, invoice "Action Required" section) | `views/ClientDashboard.tsx` | Client | MIG-01 to MIG-10 |
| **DEL-12** | KEEP | Invoice-specific logic (pendingInvoices, unpaidCount) - not derivable from job state | `views/ClientDashboard.tsx` | Client | TASK-006 |
| **DEL-13** | KEEP | Custom header with job count + pending invoices display | `views/ClientDashboard.tsx` | Client | - |
| **DEL-14** | DELETE | Duplicate job filtering logic - delegate to UnifiedDashboard | `views/ClientDashboard.tsx` | Client | MIG-02 |
| **DEL-15** | VERIFY | Invoice navigation routes: `/#/invoices/:id` | `views/ClientDashboard.tsx` | Client | TEST-10 |

---

## 🔮 FUTURE SPRINT IDEAS

### UX Improvements (Mobile-First, Offline-First)

| ID | Title | Description | Role | Priority | Est. Effort | Invariants |
|----|-------|-------------|------|----------|-------------|------------|
| **FUT-01** | Consolidate UnopenedLinksActionCenter | Integrate unopened links into deriveDashboardState as attention `FocusEntity` items with `severity='warning'`. Eliminates parallel action surface, unifies UX. Must respect INV-1 (single focus). | Developer | P1 | 8h | INV-1, INV-3 |
| **FUT-02** | Real-time sync tracking | Track `lastSyncAt` in DataContext, pass to deriveDashboardState for accurate `isStale` calculation. Replace hardcoded 5-minute threshold with actual sync timestamp. | Developer | P1 | 4h | N/A |
| **FUT-03** | QueueList swipe gestures | Add swipe-to-action gestures for mobile: swipe right to call tech, swipe left to reassign, long-press to pause. Reduces tap depth for field workers. Requires 44px+ touch targets. | Developer | P2 | 12h | N/A |
| **FUT-04** | BackgroundCollapse count preview | Show item counts in collapsed header (e.g., "3 completed, 2 idle") without expanding. Gives managers quick overview without UI clutter. | Developer | P2 | 4h | N/A |
| **FUT-05** | Pull-to-refresh | Implement pull gesture on UnifiedDashboard to trigger `DataContext.refresh()`. Standard mobile UX pattern for offline-first apps. | Developer | P2 | 3h | N/A |
| **FUT-06** | Attention sound/haptics | Play subtle audio or vibrate when new critical `FocusEntity` appears (manager role only). Configurable in settings. Must not fire on initial load. | Developer | P2 | 4h | INV-1 |
| **FUT-07** | A/B test ManagerFocusDashboard | Evaluate exception-based view vs. full-list view for manager efficiency. Set up feature flag, track time-to-action metrics, analyze after 2 weeks. | PM | P2 | 8h | N/A |
| **FUT-08** | Keyboard shortcuts | Add power-user shortcuts: `j`/`k` to navigate queue, `Enter` to open focus action, `Esc` to collapse expanded sections. Desktop only. | Developer | P2 | 6h | N/A |
| **FUT-09** | Enhanced offline indicator | Show time-since-offline in OfflineBanner (e.g., "Offline for 23 minutes") instead of just "You are offline". Helps users gauge sync risk. | Developer | P2 | 2h | N/A |
| **FUT-10** | Manual sync retry UI | Let users manually trigger sync for specific failed jobs from SyncStatusBadge. Shows retry button on failed items, calls syncQueue.retry(jobId). | Developer | P1 | 5h | N/A |

---

## 📊 Sprint Summary

### By Priority
| Priority | Count | Total Effort |
|----------|-------|--------------|
| P0 (Critical) | 3 | 2h |
| P1 (Committed) | 16 | ~15h |
| P2 (Nice-to-have) | 7 | ~18h |

### By Role
| Role | Tasks |
|------|-------|
| Developer | TASK-003, TASK-004, TASK-005, TASK-006, TASK-007, TASK-008, MIG-01 to MIG-08 |
| QA | TASK-001, TASK-002, MIG-09, MIG-10, TEST-01 to TEST-11 |
| PM | DEBT-6, FUT-07 |

### By Dashboard Group
| Group | Tasks |
|-------|-------|
| Admin/Manager | TASK-004, TASK-008, MIG-06, TEST-06, TEST-07, DEL-01 to DEL-05 |
| Contractor | TASK-003, TASK-005, MIG-06, TEST-08, TEST-09, DEL-06 to DEL-10 |
| Client | TASK-006, TEST-10, DEL-11 to DEL-15 |
| All/Cross-cutting | TASK-001, TASK-002, TASK-007, MIG-01 to MIG-05, MIG-07 to MIG-10, TEST-01 to TEST-05, TEST-11 |

---

## ✅ Definition of Done

A task is complete when:

1. **Code changes** pass `npm test -- --run` (all tests green)
2. **Code changes** pass `npm run build` (build succeeds)
3. **PR tasks** are merged to main via reviewed PR
4. **Migration tasks** are verified with grep/audit commands
5. **Manual tests** are executed and pass on all 3 roles
6. **All 6 invariants** remain intact (verified via unit tests)
7. **No regressions** in count consistency tests

---

## 📝 Notes

- **Session ID for branches:** Replace `{sessionId}` with actual Claude Code session ID
- **Architecture freeze:** Do NOT modify `deriveDashboardState.ts` without PM approval
- **Offline-first:** All changes must work in airplane mode
- **Touch targets:** Minimum 44px for all interactive elements
- **DataContext:** Always use `useData()`, never `useState` for jobs/clients/technicians

---

*Generated: 2026-02-02 | Sprint Board for JobProof Dashboard Refactor*
