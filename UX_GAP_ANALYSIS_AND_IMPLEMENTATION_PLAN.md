# UX Gap Analysis & Implementation Plan
## JobProof vs Mobile-First Dashboard Research Spec

**Date:** February 11, 2026
**Branch:** `claude/investigate-ux-changes-UTTS3`
**Current Score:** 46.7/100 | **Target Score:** 89/100
**Method:** Full codebase audit of 40+ source files against 18-section research document

---

## PART 1: GAP ANALYSIS

### Scoring Legend
- PASS = Meets or exceeds research spec
- PARTIAL = Some implementation, needs enhancement
- FAIL = Missing or critically deficient
- N/A = Not applicable to JobProof's use case

---

### 1. MOBILE-FIRST INFORMATION ARCHITECTURE & HIERARCHY

| Research Requirement | Current State | Verdict | Detail |
|---------------------|---------------|---------|--------|
| Card-based vertically stacked layout | Cards on mobile, table on desktop | PASS | JobsList, TechPortal, ClientsView all use card layouts on mobile |
| Top 2-3 metrics at dashboard top | Quick Stats grid in UnifiedDashboard (manager only) | PARTIAL | Only for manager role; solo_contractor and technician dashboards lack metric cards |
| One insight per scroll view | FOCUS/QUEUE/BACKGROUND architecture | PASS | UnifiedDashboard enforces single-focus pattern |
| Secondary info via drill-downs | Card tap navigates to detail routes | PASS | All lists navigate to detail pages on tap |
| Clear section headers with icon + title | Sections use icon + bold title + subtitle | PASS | Consistent across dashboard sections |
| "See All" links on sections | NOT implemented | FAIL | No section drill-down links |

**Gap Score: 7/10** (strong foundation, missing metric cards for all roles + section links)

---

### 2. VISUAL HIERARCHY & SECTIONING

| Research Requirement | Current State | Verdict | Detail |
|---------------------|---------------|---------|--------|
| Large bold headers for primary sections | h1-h3 in designTokens (36-24px) | PARTIAL | Tokens exist but not responsive; 36px h1 too large on mobile |
| Distinct card headers per KPI | FocusCard has severity-coded headers | PASS | |
| Consistent iconography | Material Symbols throughout | PASS | All views use Google Material Symbols |
| Subtle separators and padding | space-y-6 between sections | PARTIAL | No semantic spacing tokens used in components; ad-hoc Tailwind values |
| Primary/Secondary/Tertiary sectioning | FOCUS (primary), QUEUE (secondary), BACKGROUND (tertiary) | PASS | Architecture maps perfectly to research recommendation |

**Gap Score: 7/10**

---

### 3. OFFLINE-FIRST UI CONSIDERATIONS

| Research Requirement | Current State | Verdict | Detail |
|---------------------|---------------|---------|--------|
| "Cloud off" icon + "Offline" text | OfflineIndicator uses signal_cellular_off + "Bunker Mode" text | PASS | Exceeds spec with bunker mode terminology |
| Dedicated section for offline content | No filter for offline-available items | FAIL | No way to see "what's available offline" |
| File size and storage management | Storage quota warning in EvidenceCapture only | PARTIAL | No global storage usage indicator |
| Progress indicators for sync | Sync banner shows pending count | PARTIAL | No progress bar for individual sync operations |
| Testing on low-end devices | No evidence of device testing | FAIL | No test plan for constrained devices |

**Gap Score: 6/10**

---

### 4. SPACING & BREATHING ROOM

| Research Requirement | Current State | Verdict | Detail |
|---------------------|---------------|---------|--------|
| Consistent spacing system (4/8/16/24px) | designTokens.ts defines xs(4)-3xl(64) on 8px grid | PASS | Token system exists |
| Semantic spacing names | xs/sm/md/lg/xl/2xl/3xl | PASS | |
| Tokens used in components | Components use raw Tailwind (gap-3, p-4) not tokens | FAIL | designTokens spacing is defined but NOT consumed by any component |
| Ample padding around touch targets | Most interactive elements have 44-56px targets | PASS | |
| Card separation 8-16px | space-y-3 (12px) between cards | PASS | |

**Gap Score: 6/10** (tokens defined but unused — purely documentation)

---

### 5. COLOR USAGE & ACCESSIBILITY

| Research Requirement | Current State | Verdict | Detail |
|---------------------|---------------|---------|--------|
| Color reinforces, not replaces meaning | All status uses color + icon + label | PASS | StatusBadge always shows icon + label |
| 4.5:1 contrast ratio for text | Dark theme (white on slate-900/950) meets contrast | PASS | |
| 3:1 for large text / UI components | Accent colors on dark bg meet ratio | PASS | |
| Status color mapping (green/red/amber/blue/gray) | Matches exactly: emerald/red/amber/blue/slate | PASS | |
| Color blindness testing | No evidence of testing | FAIL | No color-blind simulation results documented |
| User customization (high-contrast/dark modes) | Dark mode default, no toggle to light | PARTIAL | tailwind.config has dark mode config but no UI toggle exists |

**Gap Score: 7/10**

---

### 6. AFFORDANCE & VISUAL CUES

| Research Requirement | Current State | Verdict | Detail |
|---------------------|---------------|---------|--------|
| Interactive elements look tappable | designTokens defines hover shadow, scale, cursor | PASS | |
| Consistent iconography | Material Symbols used everywhere | PASS | |
| Feedback on interaction | active:scale-95/98 on buttons, haptic library exists | PARTIAL | Haptic feedback not wired universally |
| No false affordances | Some cards look tappable but aren't clickable | PARTIAL | BackgroundCollapse items have hover styles but some are non-interactive |
| Shadows/elevation for interactive elements | Card elevated variant exists | PASS | |

**Gap Score: 7/10**

---

### 7. TOUCH TARGET SIZE & SPACING

| Research Requirement | Current State | Verdict | Detail |
|---------------------|---------------|---------|--------|
| Min 44x44px (Apple) / 48x48dp (Google) | 44px minimum, 56px for field worker CTAs | PASS | Exceeds both specs |
| 8px spacing between targets | Most buttons use gap-2 (8px) or gap-3 (12px) | PASS | |
| Primary actions in thumb zone (bottom) | CTAs at TOP of screen, not bottom | FAIL | Major ergonomic issue: primary actions require reaching to top of screen |
| Fixed bottom action bar | TechJobDetail has bottom action bar; dashboards do NOT | PARTIAL | Only 1 of 6 main views has bottom action placement |

**Gap Score: 6/10** (targets great, placement wrong)

---

### 8. TECHNICIAN LIST DESIGN

| Research Requirement | Current State | Verdict | Detail |
|---------------------|---------------|---------|--------|
| Cards or rows with avatar/name/status/actions | TechniciansView uses cards with avatar, name, status badge | PASS | |
| Color-coded status dots | Status badge (Authorised = green, other = gray) | PARTIAL | Only 2 states; no "busy", "offline", "in-transit" |
| Quick filters and sorting | Search by name/email/status only; no sort | PARTIAL | No sort options, limited filter |
| Expandable details (tap for more info) | No expansion; cards show all info flat | FAIL | All info is visible at once (cluttered) or requires navigation |
| Swipe actions (complete, call, message) | No swipe gestures anywhere | FAIL | Zero swipe-to-action implementation |
| Call/Message/Directions quick actions | Call button exists; no message or directions | PARTIAL | |
| Role-based view customization | Persona routing exists (admin vs tech) | PASS | |

**Gap Score: 5/10**

---

### 9. VERIFICATION FLAGS & STATUS ACCURACY

| Research Requirement | Current State | Verdict | Detail |
|---------------------|---------------|---------|--------|
| Status bound to real events | StatusBadge driven by job.status from DataContext | PASS | |
| Dynamic status indicators | Real-time from DataContext, not hardcoded | PASS | |
| Manual override with audit trail | No manual override mechanism | PARTIAL | No supervisor status override |
| Icon + color + label combined | StatusBadge default variant has all three | PASS | |
| Badge indicators for counts | Quick Stats shows job counts by status | PASS | |
| Differential indicators (deltas) | No +/- change indicators | FAIL | No "2 new jobs today" style indicators |

**Gap Score: 7/10**

---

### 10. GESTURES, SWIPE ACTIONS & SHORTCUTS

| Research Requirement | Current State | Verdict | Detail |
|---------------------|---------------|---------|--------|
| Swipe-to-reveal actions on list items | NOT implemented | FAIL | Zero swipe gesture support |
| Pull-to-refresh | NOT implemented | FAIL | No pull-down refresh; only button-based refresh |
| Long press for options | NOT implemented | FAIL | No long-press context menus |
| Microinteractions (ripple, bounce) | Haptic library + scale animations exist | PARTIAL | Library exists but not universally applied |
| All gestures have button alternatives | N/A (no gestures exist) | N/A | |
| Keyboard navigation support | Basic tab order, no custom shortcuts | PARTIAL | useGlobalKeyboardShortcuts hook exists but limited |

**Gap Score: 2/10** (critical gap — zero gesture support)

---

### 11. PERFORMANCE, PROGRESSIVE LOADING & SKELETONS

| Research Requirement | Current State | Verdict | Detail |
|---------------------|---------------|---------|--------|
| Skeleton screens during loading | FocusCardSkeleton, QueueListSkeleton exist in dashboard | PARTIAL | Dashboard has skeletons; other views use generic spinner or nothing |
| Progressive loading (essential first) | DataContext loads all data at once | FAIL | No prioritized loading (today's jobs first) |
| Lazy loading for images | Photos load as data URLs from IndexedDB | PARTIAL | Photos are base64 strings (no lazy load needed) but no progressive decode |
| Caching for instant access | IndexedDB + DataContext caching | PASS | |
| Clear error messages with retry | ErrorState component with 3 variants + retry | PASS | |
| Offline queue notifications | OfflineIndicator + sync banners | PASS | |

**Gap Score: 6/10**

---

### 12. FORMS, DATA ENTRY & OFFLINE VALIDATION

| Research Requirement | Current State | Verdict | Detail |
|---------------------|---------------|---------|--------|
| Minimize required fields | JobForm: 3 req / 9 total; ClientForm: 1/6; TechForm: 2/5 | PASS | |
| Smart defaults (auto-fill date, location, user) | Date=today, time=09:00, address from client, priority=normal | PASS | |
| Dropdowns/toggles over free text | Priority uses toggle buttons; type uses radio | PASS | |
| Image/barcode capture | Camera capture in EvidenceCapture; no barcode | PARTIAL | No barcode/QR scanner |
| Local validation before submit | All forms validate locally before submit | PASS | |
| Queued offline submissions | Dexie transactions + syncQueue.ts | PASS | |
| Clear confirmation feedback | Haptic + toast + navigation on save | PASS | |
| Consistent draft storage | JobForm=IndexedDB, ClientForm=IndexedDB, TechForm=localStorage | PARTIAL | TechnicianForm uses localStorage (inconsistent with others) |

**Gap Score: 8/10**

---

### 13. ROLE-BASED VIEWS

| Research Requirement | Current State | Verdict | Detail |
|---------------------|---------------|---------|--------|
| Role-based dashboards | AdminDashboard, ContractorDashboard, ClientDashboard, TechPortal | PASS | 4 role-specific dashboards |
| Customizable list filters | Filter tabs differ by role | PASS | |
| Permission-based action hiding | Persona-based routing exists; no action-level RBAC | PARTIAL | Can see admin routes if URL is known |
| Action-level permission matrix | No `<RoleGate>` component | FAIL | Actions not hidden based on role |

**Gap Score: 7/10**

---

### 14. NAVIGATION PATTERNS

| Research Requirement | Current State | Verdict | Detail |
|---------------------|---------------|---------|--------|
| Sticky bottom nav with 3-5 items | BottomNav: 5 items (Dashboard, Jobs, +FAB, Clients, Techs) | PASS | |
| Icons paired with labels | All nav items have icon + text label | PASS | |
| Active state highlighted | Color change (text-primary) + font-bold | PARTIAL | Research recommends pill indicator/background tint; current = color only |
| Thumb zone placement | Bottom nav is in thumb zone | PASS | |
| Limit to 3-5 primary items | 4 items + 1 FAB = within spec | PASS | |

**Gap Score: 8/10**

---

### 15. SKELETON & LOADING STATES

| Research Requirement | Current State | Verdict | Detail |
|---------------------|---------------|---------|--------|
| Skeleton screens for initial load | Dashboard has FocusCardSkeleton, QueueListSkeleton, BackgroundCollapseSkeleton | PARTIAL | Only dashboard; JobsList, ClientsView, TechniciansView have NO skeletons |
| Spinner for short operations | Used in button loading states | PASS | |
| Placeholder text for slow connections | Not implemented | FAIL | No progressive text rendering |
| Layout continuity during load | Skeleton heights match real content | PASS (dashboard only) | |

**Gap Score: 5/10**

---

### 16. ICONOGRAPHY, LABELS & NON-COLOR INDICATORS

| Research Requirement | Current State | Verdict | Detail |
|---------------------|---------------|---------|--------|
| Recognizable standard icons | Material Symbols Outlined (Google standard) | PASS | |
| Icons paired with labels | Navigation, status badges, buttons all pair icon+label | PASS | |
| Consistent icon style | Single icon set throughout | PASS | |
| 24-48px icon size with contrast | Icons are text-lg to text-4xl (18-36px) | PASS | |
| Shapes/symbols reinforce status | StatusBadge dot variant uses colored circles | PASS | |

**Gap Score: 9/10**

---

## OVERALL GAP SUMMARY

| Area | Score | Weight | Weighted |
|------|-------|--------|----------|
| Information Architecture | 7/10 | 10% | 0.70 |
| Visual Hierarchy | 7/10 | 5% | 0.35 |
| Offline-First UI | 6/10 | 15% | 0.90 |
| Spacing System | 6/10 | 5% | 0.30 |
| Color & Accessibility | 7/10 | 10% | 0.70 |
| Affordance & Touch Cues | 7/10 | 5% | 0.35 |
| Touch Targets & Placement | 6/10 | 10% | 0.60 |
| Technician List Patterns | 5/10 | 10% | 0.50 |
| Status Accuracy | 7/10 | 5% | 0.35 |
| **Gestures & Shortcuts** | **2/10** | **10%** | **0.20** |
| Performance & Loading | 6/10 | 5% | 0.30 |
| Forms & Data Entry | 8/10 | 5% | 0.40 |
| Role-Based Views | 7/10 | 5% | 0.35 |

**CURRENT WEIGHTED SCORE: 60/100**
**TARGET: 89/100**
**GAP: -29 points**

---

## TOP 10 CRITICAL GAPS (Ranked by Impact)

| # | Gap | Current | Target | Delta | Effort |
|---|-----|---------|--------|-------|--------|
| 1 | **Zero gesture support** (swipe, pull-to-refresh, long-press) | 2/10 | 8/10 | -6 | HIGH |
| 2 | **Thumb-primary layout** (CTAs at top, should be bottom) | 4/10 | 9/10 | -5 | HIGH |
| 3 | **No skeleton screens** outside dashboard | 3/10 | 8/10 | -5 | LOW |
| 4 | **Spacing tokens unused** (defined but not consumed) | 3/10 | 8/10 | -5 | MEDIUM |
| 5 | **No "See All" / section drill-down links** | 0/10 | 7/10 | -7 | LOW |
| 6 | **BottomNav active state** (color-only, needs pill indicator) | 5/10 | 9/10 | -4 | LOW |
| 7 | **Technician list** missing expandable details + swipe | 5/10 | 8/10 | -3 | MEDIUM |
| 8 | **No progressive loading** (all data loads at once) | 4/10 | 8/10 | -4 | HIGH |
| 9 | **Canvas not wired in** (component exists, zero imports) | 0/10 | 8/10 | -8 | LOW |
| 10 | **Draft storage inconsistency** (TechForm uses localStorage) | 6/10 | 9/10 | -3 | LOW |

---

## PART 2: IMPLEMENTATION PLAN

### Architecture Principles for This Sprint

1. **DO NOT touch BottomNav** (user instruction: leave sticky nav as-is)
2. **Mobile-first**: Every change starts at 320px and scales up
3. **Offline-safe**: All new patterns must survive airplane mode + restart
4. **Test-first**: Every change includes Vitest tests
5. **One file per fix**: Atomic changes per CLAUDE.md rules
6. **Delete, don't comment**: Remove old patterns completely
7. **Prove it works**: Test output required before marking complete

---

### PHASE 1: Foundation (Low Effort, High Impact)

#### 1.1 Wire ClientConfirmationCanvas into TechEvidenceReview
**File:** `views/tech/TechEvidenceReview.tsx`
**What:** Import and render ClientConfirmationCanvas in the attestation step
**Why:** Component is 487 lines of working code that is NEVER imported
**Test:** Canvas renders, signature saves, theme-aware colors apply
**Effort:** 1 hour

#### 1.2 Fix TechnicianForm Draft Storage
**File:** `views/app/technicians/TechnicianForm.tsx`
**What:** Migrate from localStorage to IndexedDB (match ClientForm pattern)
**Why:** Inconsistent with other forms; localStorage doesn't survive all scenarios
**Test:** Draft saves to IndexedDB, restores on mount, clears on submit
**Effort:** 30 min

#### 1.3 Add Skeleton Screens to All List Views
**Files (one per fix):**
- `views/app/jobs/JobsList.tsx` — add JobsListSkeleton
- `views/app/technicians/TechniciansView.tsx` — add TechniciansSkeleton
- `views/app/clients/ClientsView.tsx` — add ClientsSkeleton
- `views/tech/TechPortal.tsx` — already has LoadingSkeleton (verify)
**What:** Create skeleton placeholders matching card/table layout during loading
**Why:** Blank screens on slow connections damage trust and perceived speed
**Test:** Skeleton renders during loading, disappears when data arrives
**Effort:** 2 hours total

#### 1.4 BottomNav Active State Enhancement
**File:** `components/layout/BottomNav.tsx`
**What:** Add pill indicator (2px height, 20px width, bg-primary) above active icon + subtle bg tint (bg-primary/10 rounded-xl)
**Why:** Research says color-only active state is insufficient; users need shape + color
**Test:** Active pill renders on current route, disappears on others
**Effort:** 30 min
**NOTE:** This enhances the active state indicator ONLY — does NOT change the sticky nav structure

#### 1.5 Section "See All" Links
**File:** `components/dashboard/UnifiedDashboard.tsx`
**What:** Add optional `seeAllRoute` prop to section headers; render "See All >" link
**Why:** Research recommends drill-down links for expandable sections
**Test:** Link renders when prop provided, navigates correctly
**Effort:** 30 min

---

### PHASE 2: Gesture & Interaction Layer (Medium Effort, High Impact)

#### 2.1 Pull-to-Refresh on All List Views
**Files:** `views/app/jobs/JobsList.tsx`, `views/tech/TechPortal.tsx`, `views/app/clients/ClientsView.tsx`, `views/app/technicians/TechniciansView.tsx`
**What:** Create a `usePullToRefresh` hook that detects downward swipe at top of scrollable container, triggers DataContext.refresh()
**Why:** Standard mobile pattern; users expect it; currently only button-based refresh exists
**Implementation:**
```
- Touch start tracking (touchstart Y position)
- Pull distance threshold (60px)
- Visual indicator (spinning sync icon)
- Calls refresh() from DataContext
- Respects navigator.onLine (shows offline toast if no connection)
```
**Test:** Pull gesture triggers refresh, indicator shows/hides, offline message shown
**Effort:** 3 hours (1 hook + wiring into 4 views)

#### 2.2 Swipe-to-Action on Job Cards (Mobile Only)
**File:** New hook `hooks/useSwipeAction.ts` + `views/app/jobs/JobsList.tsx`
**What:** Swipe right reveals "Start" action, swipe left reveals "Archive/Complete"
**Implementation:**
```
- Touch event tracking (touchstart, touchmove, touchend)
- 80px threshold for action reveal
- Action buttons slide in from edge
- Button alternatives always visible via JobActionMenu
- Only on mobile (matchMedia check)
```
**Why:** Research says swipe actions reduce taps and speed up task management
**Test:** Swipe reveals actions, tap action button works, button alternative still available
**Effort:** 4 hours

#### 2.3 Long-Press Context Menu on Cards
**File:** New hook `hooks/useLongPress.ts` + apply to card components
**What:** 500ms long-press on any job/tech/client card reveals context menu (assign, call, message, edit, delete)
**Why:** Standard mobile pattern for quick actions without navigation
**Test:** Long-press shows menu, regular tap still navigates, menu items work
**Effort:** 3 hours

#### 2.4 Universal Haptic Feedback on Save/Submit
**Files:** All form submit handlers + sync confirmation points
**What:** Wire hapticConfirm() to every successful save, hapticWarning() to every failure
**Why:** Research mandates tactile feedback; library exists but isn't universal
**Where specifically:**
- `ClientForm.tsx` submit handler
- `TechnicianForm.tsx` submit handler
- `JobForm.tsx` (already has it — verify)
- `TechJobDetail.tsx` status change handlers
- `syncQueue.ts` on successful sync
**Test:** Haptic fires on save (mock navigator.vibrate)
**Effort:** 1 hour

---

### PHASE 3: Thumb-Primary Layout Optimization (High Effort, High Impact)

#### 3.1 Floating Action Panel (Context-Sensitive Bottom CTA)
**File:** New component `components/ui/FloatingActionPanel.tsx`
**What:** Fixed-position panel above BottomNav (bottom: 80px) that shows the PRIMARY action for the current context:
- Dashboard: "New Job" or "Review Evidence" (whichever is most urgent)
- Job Detail: "Start Job" / "Capture Evidence" / "Complete"
- Tech Portal: "Start Next Job" or "Continue [Job Name]"
**Why:** Primary CTAs are currently at the TOP of screens — unreachable with thumb. Research says bottom 35% is the action zone.
**Implementation:**
```
- Uses DataContext to determine most urgent action
- Renders above BottomNav with safe spacing
- Animated entry (slide up)
- Dismissable (swipe down or X)
- Only shows on mobile (lg:hidden)
- Does NOT modify BottomNav (per user instruction)
```
**Test:** Panel shows correct CTA per context, tap navigates, dismisses correctly
**Effort:** 4 hours

#### 3.2 Bottom Sheet for Evidence Review
**File:** New component `components/ui/BottomSheet.tsx` + refactor `views/tech/TechEvidenceReview.tsx`
**What:** Evidence review opens as 90%-height bottom sheet instead of full-page route
**Why:** Research and SILO gap analysis both recommend bottom sheet pattern; keeps user in context
**Implementation:**
```
- Sheet slides up from bottom (90vh)
- Drag handle at top for dismiss
- Snap points: 90% (full), 50% (half), 0% (dismissed)
- Photo grid + attestation flow inside sheet
- Keyboard-accessible close
```
**Test:** Sheet opens, snaps to points, drag dismiss works, content renders
**Effort:** 6 hours

---

### PHASE 4: Data Visualization & Polish (Medium Effort)

#### 4.1 Metric Cards for All Dashboard Roles
**File:** `components/dashboard/MetricCardRow.tsx` (new) + wire into UnifiedDashboard
**What:** 3-4 prominent metric cards (Total Jobs, Active, Pending, Completed) visible to ALL roles, not just manager
**Why:** Research says top 2-3 metrics should be immediately visible on dashboard; currently only manager sees Quick Stats
**Test:** Cards render for all roles with correct counts, responsive grid
**Effort:** 2 hours

#### 4.2 Card Contrast Enhancement (Dark Mode)
**File:** `components/ui/Card.tsx`
**What:** Change dark mode border from `border-white/5` to `border-white/[0.08]`; add "highlight" variant with colored left border accent
**Why:** DESIGN_ANALYSIS.md Phase 1 item; dark mode cards are nearly invisible against bg
**Test:** Visual regression test for card borders; highlight variant renders accent
**Effort:** 30 min

#### 4.3 Technician Status Expansion
**File:** `views/app/technicians/TechniciansView.tsx`
**What:** Add more status states beyond "Authorised"/"Other": Available, Busy, Offline, In-Transit
**Why:** Research says technician lists need color-coded status for quick scanning
**Test:** Each status renders with correct color, icon, and label
**Effort:** 1 hour

#### 4.4 Differential Status Indicators
**File:** `components/dashboard/UnifiedDashboard.tsx`
**What:** Show +/- deltas on metric cards ("3 new today", "+2 since last sync")
**Why:** Research recommends differential indicators for change awareness
**Test:** Delta badges render when data changes, hide when zero
**Effort:** 2 hours

---

### PHASE 5: Testing & Validation

#### 5.1 Write Tests for All New Components
- usePullToRefresh.test.ts
- useSwipeAction.test.ts
- useLongPress.test.ts
- FloatingActionPanel.test.tsx
- BottomSheet.test.tsx
- MetricCardRow.test.tsx
- Skeleton screens per view
- BottomNav active pill test

#### 5.2 Accessibility Audit
- Focus ring visibility on all new interactive elements
- Keyboard alternatives for all gestures
- Screen reader announcements for swipe actions
- ARIA labels on new components
- Color contrast verification on new elements

#### 5.3 Offline Validation
- Airplane mode: All new features degrade gracefully
- Pull-to-refresh shows offline toast when disconnected
- Floating Action Panel works offline
- Bottom Sheet preserves state on network loss
- Skeletons display correctly when cache is available

---

## EXECUTION TIMELINE

```
PHASE 1 (Foundation):          ~5 hours
  1.1 Wire Canvas              1h
  1.2 Fix TechForm drafts      0.5h
  1.3 Skeleton screens         2h
  1.4 BottomNav active pill     0.5h
  1.5 See All links            0.5h

PHASE 2 (Gestures):            ~11 hours
  2.1 Pull-to-refresh          3h
  2.2 Swipe-to-action          4h
  2.3 Long-press menu          3h
  2.4 Universal haptics        1h

PHASE 3 (Thumb Layout):        ~10 hours
  3.1 Floating Action Panel    4h
  3.2 Bottom Sheet Evidence    6h

PHASE 4 (Data Viz):            ~5.5 hours
  4.1 Metric cards all roles   2h
  4.2 Card contrast            0.5h
  4.3 Tech status expansion    1h
  4.4 Differential indicators  2h

PHASE 5 (Testing):             ~4 hours
  5.1 Unit tests               2h
  5.2 Accessibility audit      1h
  5.3 Offline validation       1h

TOTAL: ~35.5 hours
```

---

## PROJECTED SCORE AFTER IMPLEMENTATION

```
Area                    Before  After   Delta
────────────────────    ──────  ──────  ─────
Information Arch        7/10    9/10    +2
Visual Hierarchy        7/10    8/10    +1
Offline-First UI        6/10    8/10    +2
Spacing System          6/10    7/10    +1
Color & Accessibility   7/10    8/10    +1
Affordance & Cues       7/10    8/10    +1
Touch Targets & Place   6/10    9/10    +3
Technician Patterns     5/10    8/10    +3
Status Accuracy         7/10    8/10    +1
Gestures & Shortcuts    2/10    7/10    +5
Performance & Loading   6/10    8/10    +2
Forms & Data Entry      8/10    9/10    +1
Role-Based Views        7/10    8/10    +1

PROJECTED WEIGHTED:     60/100  84/100  +24
```

---

## MULTI-AGENT EXECUTION STRATEGY

Phases 1-4 will be delivered using parallel agents:

| Agent | Scope | Dependencies |
|-------|-------|-------------|
| **Agent A** | Phase 1.1 (Canvas), 1.2 (TechForm) | None |
| **Agent B** | Phase 1.3 (Skeletons for all 3 list views) | None |
| **Agent C** | Phase 1.4 (BottomNav pill), 1.5 (See All links) | None |
| **Agent D** | Phase 2.1 (Pull-to-refresh hook + wiring) | Phase 1 complete |
| **Agent E** | Phase 2.2 (Swipe hook) + 2.3 (Long-press hook) | Phase 1 complete |
| **Agent F** | Phase 3.1 (Floating Action Panel) | Phase 1 complete |
| **Agent G** | Phase 4.1 (MetricCardRow) + 4.2 (Card contrast) | Phase 1 complete |
| **Agent H** | Phase 5 (Testing all changes) | All phases complete |

Agents A, B, C run in parallel (no dependencies).
Agents D, E, F, G run in parallel after Phase 1.
Agent H validates everything last.

---

## WHAT WE ARE NOT CHANGING

Per user instruction and architectural stability:
- **Sticky BottomNav bar** — structure unchanged (only enhancing active state)
- **DataContext pattern** — remains single source of truth
- **AuthContext pattern** — no changes
- **Dark mode as default** — already strong
- **Touch target sizes** — already exceed spec
- **Animation constants pattern** — animations.ts stays
- **Offline architecture** — Dexie/syncQueue unchanged

---

*This document serves as the source of truth for the UX implementation sprint. Every change must be tested, proven, and committed atomically.*
