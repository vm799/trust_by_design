# Claude Operating Constraints — JobProof

You are working on JobProof, an offline-first, mobile-first, trust-critical construction field application.

## Non-Negotiable Rules

1. **Silent failure is forbidden.**
   - Every error must be visible to the user or block progression.
   - console.log is not an acceptable error handling strategy.

2. **Offline safety beats elegance.**
   - Prefer synchronous persistence over async elegance.
   - Assume the app can be killed after any line of code.

3. **Deletion is preferred to abstraction.**
   - Remove dead code, legacy paths, and future placeholders.
   - Do not retain code "for later use".

4. **Do not redesign unless explicitly instructed.**
   - Fix only what is requested.
   - Avoid introducing new patterns unless required for safety.

5. **Field reality overrides best practice.**
   - Assume wet gloves, poor signal, old Android devices, and time pressure.

If a suggestion violates these rules, do not propose it.

---

## Core Architecture (Mandatory)

### Data Pattern
```tsx
// ALWAYS use DataContext - the single source of truth
import { useData } from '../lib/DataContext';
const { jobs, clients, technicians, updateJob, refresh } = useData();

// NEVER use standalone state for jobs/clients/technicians
// NEVER use deprecated hooks from useWorkspaceData
```

### Auth Pattern
```tsx
// ALWAYS use AuthContext
import { useAuth } from '../lib/AuthContext';
const { isAuthenticated, userId, session } = useAuth();

// NEVER call supabase.auth.getUser() directly (causes 877 req/hr loop)
```

### Offline-First Mandates
- Every form saves drafts to IndexedDB (every keystroke)
- All submits queue via `lib/syncQueue.ts` when offline
- Network status awareness via `navigator.onLine`
- Airplane mode → app restart → data survives

---

## Security Requirements

- **RLS Required:** Every Supabase table MUST have Row-Level Security
- **auth.uid() Only:** User isolation via `auth.uid()`, never trust client
- **No service_role:** Never use `service_role` keys in frontend code
- **Sealed Evidence:** Jobs with `sealedAt` cannot be modified or deleted

---

## Verification Commands

```bash
# Before ANY commit (MANDATORY):
npm test -- --run && npm run lint && npm run type-check && npm run build
```

---

## Related Documentation

- `AGENTIC_CRITIQUE.md` — Evaluation mode (run after refactors)
- `AGENTIC_EXECUTION.md` — Fix mode (run after critique)
- `AGENTIC_PRE_COMMIT.md` — Daily guardrail (run before merge)
- `AGENTIC_SHIP_GATE.md` — Release blocker (run before production)
- `docs/ux-flow-contract.md` — **UX Flow Contract** (core laws, canonical flows)
- `docs/ux-route-contract.md` — **Route-Level Enforcement** (per-route checklist)

---

## UX Flow Contract (Mandatory)

Before any navigation or auth change, consult the UX contracts. Key laws:

### Law 1: Intent Is Sacred
```tsx
// Navigation intent must survive auth, offline, and restarts
import { captureNavigationIntentFromUrl, resumeIntentAndGetPath } from '../lib/navigationIntent';

// Capture BEFORE auth checks (in App.tsx)
captureNavigationIntentFromUrl();

// Resume AFTER auth succeeds (in AuthCallback.tsx)
const targetPath = resumeIntentAndGetPath();
navigate(targetPath, { replace: true });
```

### Law 2: Auth Never Owns Navigation
- Auth screens only answer: `AUTHENTICATED | NOT_AUTHENTICATED | EXPIRED`
- Auth NEVER decides destination
- Original intent always resumes post-auth

### Law 3: No Dead Ends
Every screen must declare:
- Previous context (back target)
- Failure path (offline, expired link, quota exceeded)
- Success path (action complete → next screen)

### PR Rejection Criteria (Auto-Fail)
- [ ] Intent lost during auth flow
- [ ] Dead-end screen with no recovery
- [ ] Auth-driven navigation (auth decides destination)
- [ ] Touch targets < 44px

---

## UX Contract Enforcement Prompt (Agentic Audit)

Use this prompt to audit any branch or PR for UX compliance. Start a Claude session and run this when reviewing changes.

### Context
- **UX Laws**: Intent Is Sacred, Auth Never Owns Navigation, No Dead Ends
- **Route Contracts**: See `docs/ux-route-contract.md` for per-route expectations
- **Offline Rules**: IndexedDB never silently fails, SW caches versioned, retries show status
- **Dev Escape Hatch**: `/dev/reset` clears all caches, IndexedDB, sessionStorage, Supabase session

### Audit Checklist

**1. Navigation & Intent**
- [ ] Magic links, email links, deep links resume intended route post-auth
- [ ] Offline, auth resolution, app restart does not break navigation
- [ ] `lib/navigationIntent.ts` correctly captures and resumes intent

**2. Route-Level UX**
- [ ] `/dashboard`: Hierarchy (Attention → Active → Idle), virtualized lists, sync badges
- [ ] `/job/:id`: Deep-link intent resume, offline drafts, retryable captures, 3-tap evidence
- [ ] `/report/:jobId`: Offline cached, dark mode, GPS/W3W/timestamp on photos
- [ ] `/auth/*`: Expired link handling, 44px touch targets, single-use enforced
- [ ] `/settings`: Read-only offline, synced session, no stale data

**3. Offline Persistence**
- [ ] IndexedDB: No silent failures, quota warnings shown
- [ ] Service Worker: Versioned caches, update triggers rebuild
- [ ] Schema version incremented if persistence changes

**4. Retry & Resilience**
- [ ] All writes retry with exponential backoff
- [ ] Errors surfaced to user (no silent console.logs)
- [ ] Force-sync buttons present where appropriate

**5. Dark Mode & Accessibility**
- [ ] Cards, modals, headers, buttons respect dark mode
- [ ] Touch targets >= 44px
- [ ] Navigation clear and consistent

**6. Technical Debt**
- [ ] No race conditions or legacy hooks
- [ ] No duplicated logic or unhandled promise rejections
- [ ] No dead/legacy code blocks

### Output Format

For each route, report:

| Route | UX Laws | Offline | Retry | A11y | Critical Failures | Warnings | Recommendations |
|-------|---------|---------|-------|------|-------------------|----------|-----------------|
| `/dashboard` | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | List | List | List |

**Only routes that pass all P0 critical UX laws are "ready for merge."**

---

*This file contains permanent operating constraints. For playbooks and protocols, see the AGENTIC_*.md files.*
