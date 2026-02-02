# Enterprise UX Flow Contract (Mobile-First, Offline-Resilient)

**Status:** ENFORCED | **Version:** 1.0 | **Last Updated:** February 2026

---

## Purpose

This document is a **binding UX contract** for the JobProof app. Its role is to stop circular flows, auth dead-ends, and regression churn by defining **non-negotiable rules** for navigation, authentication, deep-link handling, and state recovery.

**If a future change violates this contract, the change is wrong — not the user, not QA.**

---

## 1. Root Cause (What Was Actually Broken)

The app had **three competing sources of truth**:

1. **Auth state** (Supabase session / magic link)
2. **Navigation intent** (email link → job → action)
3. **App readiness state** (cold start, offline, partial sync)

When these were not sequenced deterministically, users looped:

* Email link → landing page
* Session invalidated → forced re-auth
* Original intent lost
* User re-requests link → repeat

This is not a UX problem alone. It is **flow orchestration failure**.

---

## 2. Absolute UX Laws (Non-Negotiable)

### Law 1: Intent Is Sacred

If a user arrives with intent (email link, notification, QR):

* That intent **must survive auth, reloads, offline, and app restarts**.

**Implementation rule**:

* Persist intent immediately (`sessionStorage / IndexedDB`) BEFORE auth resolution.
* Use `lib/navigationIntent.ts` for all intent operations.

---

### Law 2: Auth Never Owns Navigation

Authentication may block access, but it must **never decide destination**.

**Auth can only answer**:

* `AUTHENTICATED | NOT_AUTHENTICATED | EXPIRED`

Navigation decides *where*, not auth.

---

### Law 3: No Dead Ends

Every screen must answer:

* Where did I come from?
* Where do I go if:
  * offline
  * session expires
  * sync fails

If any answer is missing → screen is invalid.

---

## 3. Canonical App Entry Flow (Fixes Email Loop)

### Step 0: Capture Intent (FIRST LINE OF CODE)

When app opens via link:

```typescript
// lib/navigationIntent.ts
const intent = {
  type: 'JOB_LINK' | 'GENERAL' | 'NOTIFICATION',
  path: '/admin/jobs/123',
  action: 'VIEW' | 'COMPLETE' | 'UPLOAD',
  timestamp: Date.now()
};
captureNavigationIntent(intent);
```

This happens **before** auth checks.

---

### Step 1: Resolve Auth (No Redirects Yet)

```typescript
if (hasValidSession) → AUTHENTICATED
else → NOT_AUTHENTICATED
```

DO NOT navigate based on auth state.

---

### Step 2: Resume Intent

```typescript
if (AUTHENTICATED && hasStoredIntent()) {
  const intent = getNavigationIntent();
  clearNavigationIntent();
  navigate(intent.path);
} else if (NOT_AUTHENTICATED) {
  // Show Login Gate (blocking, minimal UI)
  navigate('/auth');
}
```

---

### Step 3: Post-Login Resume (CRITICAL)

After magic-link verification:

```typescript
// In AuthCallback.tsx
const intent = getNavigationIntent();
if (intent && !isExpired(intent)) {
  clearNavigationIntent();
  navigate(intent.path, { replace: true });
} else {
  navigate('/', { replace: true });
}
```

**NEVER send user to landing page if intent exists.**
**NEVER require a second email.**

---

## 4. Magic Link Rules (Supabase-Specific)

Magic links are **single-use by design**. Fighting this causes loops.

### Required Pattern

* Magic link → establishes session
* Session persists via Supabase
* Intent resumes from sessionStorage

### Forbidden Pattern

* Magic link = navigation token
* Landing page redirects after auth
* Session check AFTER navigation decision

### Link Expiry Handling

If link expires, show **one screen only** (`LinkExpiredView.tsx`):

> "Link expired. Resend to continue Job #123."

* One button: "Resend Link"
* Pre-filled email if available
* Job context preserved in display
* No landing page. No dashboard detour.

---

## 5. Team / Job Dashboard UX Contract

### Problem Pattern (What We Fixed)

* Mixed hierarchy
* Repeated sections
* No dominant primary action

### Correct Structure

**Dashboard has ONE job:**

> Surface exceptions and next actions

#### Fixed Order (Priority Hierarchy)

1. **Attention Needed** (blocking items requiring action)
2. **Active Jobs** (in-field work)
3. **Idle Technicians** (collapsed by default)

---

### Attention Needed Rules

* Must be actionable (each item → exact resolution path)
* No duplicates across sections
* If it can't be resolved → it doesn't belong here

---

## 6. Offline UX Contract

### Allowed States

| State | Behavior |
|-------|----------|
| `ONLINE` | Full functionality |
| `OFFLINE` | Read cached data + queue writes |
| `DEGRADED` | Sync pending, show indicator |

### UX Rules

* **NEVER** block viewing cached jobs
* **NEVER** hide retry button
* **NEVER** silently fail writes

### Bunker Mode (from CLAUDE.md)

In no-service scenarios, ALL roles can perform ALL actions locally:
* Jobs/clients created offline get `origin: 'offline'` flag
* Sync reconciliation happens on reconnect
* No blocking due to "insufficient permissions"

---

## 7. Intent Persistence API

### Storage: `lib/navigationIntent.ts`

```typescript
interface NavigationIntent {
  type: 'JOB_LINK' | 'GENERAL' | 'NOTIFICATION' | 'QR_CODE';
  path: string;
  action?: 'VIEW' | 'COMPLETE' | 'UPLOAD' | 'EDIT';
  jobId?: string;
  timestamp: number;
  email?: string;  // For re-auth context
}

// Core functions
captureNavigationIntent(intent: NavigationIntent): void
getNavigationIntent(): NavigationIntent | null
clearNavigationIntent(): void
hasValidIntent(): boolean
isIntentExpired(intent: NavigationIntent): boolean
```

### Expiration

* Intent expires after **30 minutes** of inactivity
* Cleared on successful navigation to target
* Cleared on explicit logout

---

## 8. Route-Level Contract Compliance

### Every Route Must Declare

```typescript
interface RouteContract {
  path: string;
  requiresAuth: boolean;
  offlineBehavior: 'full' | 'read-only' | 'blocked';
  fallbackRoute: string;
  deadEndRecovery: string;
}
```

### Current Route Contracts

| Route | Auth | Offline | Fallback | Recovery |
|-------|------|---------|----------|----------|
| `/` | No | full | N/A | `/auth` |
| `/auth` | No | full | N/A | N/A |
| `/auth/callback` | No | blocked | `/auth` | `/auth` |
| `/admin/*` | Yes | read-only | `/auth` | `/admin` |
| `/contractor/*` | Yes | read-only | `/auth` | `/contractor` |
| `/tech/*` | Yes | full | `/auth` | `/tech` |

---

## 9. Implementation Checklist

### Phase 1: Intent Persistence (CRITICAL PATH)

- [x] Create `lib/navigationIntent.ts` with capture/get/clear
- [x] Update `App.tsx` PersonaRedirect to capture intent before auth redirect
- [x] Update `AuthCallback.tsx` to resume intent after session established
- [x] Create `LinkExpiredView.tsx` for expired magic links

### Phase 2: Dashboard Hierarchy

- [x] Refactor dashboard to single-purpose sections
- [x] Implement collapsible idle technicians section
- [ ] Remove duplicate items across sections

### Phase 3: Offline Resilience

- [ ] Audit all routes for offline behavior declaration
- [ ] Add sync status indicators to all write operations
- [ ] Implement retry UI for failed operations

---

## 10. Agent Workflow (For Claude)

### When Implementing Flow Changes

1. **Flow Orchestrator (Lead)** - Validates intent → auth → navigation chain
2. **UX Judge** - Flags loops, dead ends, hierarchy violations
3. **Solution Architect** - Ensures state ownership is correct
4. **Debugger** - Finds hidden redirects, race conditions

**Only one agent edits code at a time.**

### Enforcement Rules

* Any PR that introduces auth-driven navigation → REJECT
* Any PR that loses intent during auth flow → REJECT
* Any PR that creates a dead-end screen → REJECT
* Any PR that blocks offline viewing of cached data → REJECT

---

## 11. Final Rule

If a user ever says:

> "I keep going round in circles"

The system is guilty.

This contract exists to prevent that — permanently.

---

## Related Documents

* `/CLAUDE.md` - Core development rules
* `/docs/AUTH_FLOW_INTEGRATION_GUIDE.md` - Supabase auth details
* `/docs/UX_ARCHITECTURE_V2.md` - UI component guidelines
