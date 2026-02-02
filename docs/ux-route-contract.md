# JobProof UX Contract Enforcement Checklist (Route-Level)

**Status:** ENFORCED | **Version:** 1.0 | **Last Updated:** February 2026

---

## Purpose

Every route must pass these checks before merging. Failure = automatic red flag.

---

## 1. Global Navigation Laws

### Intent is Sacred

Any navigation initiated by email link, notification, QR, or deep link must survive:

- Auth resolution
- Offline mode
- App restart

**Verify:** `lib/navigationIntent.ts` correctly captures and resumes intent.

### Auth Never Owns Destination

- Auth screens must not redirect except to login.
- Original intent must always resume post-auth.

### No Dead Ends

Every screen must declare:

- **Previous context** (back target)
- **Failure path** (offline, expired link, quota exceeded)
- **Success path** (action complete → next logical screen)

---

## 2. Route Checklist

### `/dashboard` (Manager / Solo Contractor / Technician)

| Check | Expected Behavior |
|-------|-------------------|
| Primary Purpose | Exactly one: Attention Needed → Active Jobs → Idle Technicians |
| Attention Needed | Actionable, non-duplicated, highlights urgent jobs |
| Job Volume | Supports 10 jobs/tech, 50 jobs/manager with virtualized list |
| Offline | Cached jobs readable, writes queued |
| Sync Status | Per-job badge visible (pending / synced / failed) |
| UX | No walls of text, 1 tap per primary action, collapsed idle sections |
| Dark Mode | Applies consistently to cards, headers, modals |

### `/job/:id` (Technician / Contractor)

| Check | Expected Behavior |
|-------|-------------------|
| Primary Purpose | Single job focus |
| Intent Resume | Deep-link must land here if clicked from email |
| Photo / Signature Capture | GPS + W3W + timestamp stored offline |
| Retry | All writes (photo/signature) have visible retry options |
| Offline | Drafts persist; sync attempted when online |
| UX | 3 taps max to capture all evidence; clear "Saved / Synced" indicators |
| Dark Mode | Applies to all fields, buttons, modals |

### `/report/:jobId` (Generated after completion)

| Check | Expected Behavior |
|-------|-------------------|
| Intent | Opens correct job report regardless of auth history |
| Offline | Cached reports readable |
| Photos | GPS + W3W + timestamp visible; photos loaded from cache if offline |
| Dark Mode | Report layout respects dark mode consistently |
| Download / Email | One-click, persists offline until network resumes |

### `/auth/magic-link` and `/auth/callback`

| Check | Expected Behavior |
|-------|-------------------|
| Expired Link | Shows `LinkExpiredView` with job context & resend |
| Single-Use Link | After first use, cannot navigate elsewhere with same token |
| Intent | Always resumes after login |
| Offline | Shows clear instructions if network unavailable |
| Touch Targets | 44px minimum on all buttons/links |

### `/settings` and other utility routes

| Check | Expected Behavior |
|-------|-------------------|
| Offline | Read-only access allowed |
| User / Profile | Session correctly synced with Supabase; no stale data visible |
| UX | Minimal, no distraction from primary flow |

---

## 3. Offline / Persistence Rules

- **Local DB (IndexedDB)** must never silently fail; show quota warnings.
- **Service Worker caches** must be versioned; updates trigger rebuild/fresh load.
- Any change to local persistence or schema must increment `LOCAL_SCHEMA_VERSION`.
- All retries must show per-item status (photo/signature/job).

---

## 4. Dev / Test Escape Hatch

Implement `/dev/reset` or long-press debug mode to:

- Unregister SW
- Clear IndexedDB & sessionStorage
- Clear Supabase session

**Must not ship to production.**

Current implementation: `views/DevReset.tsx` at route `/dev/reset`

---

## 5. Agentic Enforcement Flow

### Flow Orchestrator
- Validates intent capture/resume on all routes
- Verifies offline persistence

### UX Judge
- Checks dashboard hierarchy, job focus, primary actions
- Ensures no dead ends, no unnecessary redirects

### Solution Architect
- Confirms state ownership and retry mechanisms

### Tech-Debt Auditor
- Flags race conditions, legacy hooks, duplicate logic, or unhandled failures

**Only one agent modifies code; others audit and approve.**

---

## 6. Implementation Status

### ✅ Implemented

| Component | Status | Notes |
|-----------|--------|-------|
| `lib/navigationIntent.ts` | ✅ Complete | Intent capture/resume with 30min TTL |
| `views/AuthCallback.tsx` | ✅ Complete | Resumes intent after magic link auth |
| `views/LinkExpiredView.tsx` | ✅ Complete | UX-compliant expired link screen |
| `App.tsx` intent capture | ✅ Complete | Captures intent before auth checks |
| `/dev/reset` route | ✅ Complete | Developer reset utility |

### 🔄 Pending

| Component | Status | Notes |
|-----------|--------|-------|
| Dashboard hierarchy | ✅ Complete | Active/Idle technicians split with collapsible idle section |
| Per-job sync badges | ✅ Complete | JobCard and TechPortal display sync status per job |
| Virtualized job lists | 🔄 Pending | Performance for 50+ jobs |

---

## 7. How to Use

### Before merging any PR:

1. Run unit & integration tests: `npm test -- --run`
2. Verify all route-specific checks pass (use checklist above)
3. Use agentic flow for approval

### PR Rejection Criteria

- [ ] Intent lost during auth flow
- [ ] Dead-end screen with no recovery
- [ ] Auth-driven navigation (auth decides destination)
- [ ] Missing offline behavior declaration
- [ ] Touch targets < 44px
- [ ] Silent failures without retry UI

---

## Related Documents

- `/docs/ux-flow-contract.md` - Core UX Flow Contract
- `/CLAUDE.md` - Development rules and patterns
- `/docs/AUTH_FLOW_INTEGRATION_GUIDE.md` - Supabase auth details
