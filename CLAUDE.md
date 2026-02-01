# 🏛️ PROJECT CONSTITUTION: JobProof
**Offline-First Field Service Evidence Platform**
**Last Updated:** February 2026 | **Status:** ENFORCE ALL RULES | **Tests:** 367+

### Encryption Standards

- **At Rest:** AES-256-GCM for sensitive fields
- **In Transit:** TLS 1.3 (Supabase default)
- **Evidence Sealing:** RSA-2048 + SHA-256 signatures
- **Keys:** In-memory only, NON-EXTRACTABLE

---

## Absolute Rules (Break = IMMEDIATE REJECT)

```
1. NO CODE CHANGES WITHOUT TESTS FIRST
2. SHOW BEFORE/AFTER CONTEXT (20 lines each)
3. MAXIMUM 1 FILE CHANGED PER FIX
4. DELETE LEGACY CODE (NEVER COMMENT OUT)
5. PROVE IT WORKS (test command output REQUIRED)
6. ONE-CLICK DEPLOY COMMANDS
7. NO "THIS SHOULD WORK" - ONLY PROOF
8. JSON OUTPUT FORMAT FOR FIXES
9. UAT SCRIPT REQUIRED FOR EVERY FIX
```

---

## Offline-First Mandates

Every form and data operation MUST have:

```
- Dexie/IndexedDB draft saving (every keystroke)
- Offline submit queue via lib/syncQueue.ts
- Network status awareness (navigator.onLine)
- Optimistic UI updates with status indicators
- Airplane mode -> app restart -> data survives
- Form drafts auto-load on screen mount
```

---

## Mandatory JSON Output Format (For Fixes)

```json
{
  "issue": "descriptive_snake_case_name",
  "rootCause": "exact cause from code analysis",
  "files": {
    "before": "file:line - 20 lines context",
    "after": "file:line - 20 lines context",
    "changed": ["path/to/file.tsx"]
  },
  "tests": {
    "added": ["tests/unit/newTest.test.ts"],
    "commands_run": ["npm test -- --run"],
    "results": "357 tests passed"
  },
  "cleanup": {
    "deleted_files": [],
    "removed_imports": [],
    "legacy_code_gone": true
  },
  "deploy": {
    "preview": "vercel deploy",
    "prod": "vercel --prod"
  },
  "uat_script": "1. Open incognito\n2. Navigate to X\n3. Expect Y",
  "status": "TestsPassed_UATPending",
  "risk_level": "LOW|MEDIUM|HIGH"
}
```

---

## Quick Reference Commands

```bash
# Daily workflow
npm run dev              # Start dev server (port 3000)
npm test                 # Run unit tests (watch mode)
npm test -- --run        # Run tests once
npm run lint             # ESLint check
npm run type-check       # TypeScript validation
npm run build            # Production build

# Full verification (run before every commit)
npm test -- --run && npm run lint && npm run type-check && npm run build

# Deployment
vercel deploy            # Preview deployment
vercel --prod            # Production deployment
## 🎯 CORE MISSION

Build bulletproof **offline-first web app** for field workers in poor service areas.
- **NO REGRESSIONS ALLOWED**
- **PROVE IT WORKS** (test output required)
- **DELETE, DON'T COMMENT** (no legacy code)

---

## 🧬 Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Frontend | React | 18.x | UI Components |
| Build | Vite | 6.x | Fast builds, code splitting |
| Language | TypeScript | 5.8 (strict) | Type safety |
| Styling | Tailwind CSS | 3.4 | Utility-first |
| Routing | React Router | 6.x | Hash-based (`/#/...`) |
| Animation | Framer Motion | 12.x | Declarative motion |
| Auth | Supabase Auth | - | Magic links, OAuth |
| Database | Supabase (PostgreSQL) | 17 | Cloud + RLS |
| Offline | Dexie (IndexedDB) | - | Local-first storage |
| Testing | Vitest + Playwright | - | Unit + E2E |

---

## 🚨 ABSOLUTE RULES (Break = REJECT)

```
1. READ FILES BEFORE MODIFYING - Always understand existing code first
2. USE DATACONTEXT - Never useState for jobs/clients/technicians
3. DELETE LEGACY CODE - Never comment out, always delete
4. PROVE IT WORKS - npm test && npm run build must pass
5. ONE CONCERN PER FIX - Keep changes focused and atomic
6. MEMOIZE DERIVATIONS - useMemo for computed values from DataContext
7. 44px TOUCH TARGETS - WCAG accessibility minimum
8. ERROR STATES WITH RETRY - Every data fetch needs ErrorState component
```

---

## 🔴 CRITICAL ARCHITECTURE PATTERNS

### Pattern 1: DataContext is the ONLY Source of Truth

```tsx
// ✅ CORRECT - Use DataContext
import { useData } from '../lib/DataContext';
const {
  jobs, clients, technicians,
  updateJob, deleteJob, addJob,
  isLoading, error, refresh
} = useData();

// ❌ WRONG - Creates duplicate state, breaks reactivity
import { getJobs, updateJob } from '../hooks/useWorkspaceData';
const [jobs, setJobs] = useState<Job[]>([]);
```

### 2. Authentication - Use AuthContext

```tsx
// CORRECT
import { useAuth } from '../lib/AuthContext';
const { isAuthenticated, userId, session } = useAuth();

// WRONG - Causes excessive API calls (877 req/hr bug)
const { data } = await supabase.auth.getUser();
```

### 3. Protected Routes - Use RouteErrorBoundary

```tsx
// CORRECT
<RouteErrorBoundary sectionName="Dashboard" fallbackRoute="/home">
  <Dashboard />
</RouteErrorBoundary>
### Pattern 2: DataContext Function Signatures (CRITICAL)

```tsx
// updateJob takes FULL Job object, not partial updates
const updatedJob: Job = { ...job, status: 'Complete', technicianId: techId };
contextUpdateJob(updatedJob);  // ✅ CORRECT

updateJob(job.id, { status: 'Complete' });  // ❌ WRONG - deprecated signature

// deleteJob takes just the ID
contextDeleteJob(job.id);  // ✅ CORRECT
```

### Pattern 3: Memoize Derived State

```tsx
// ✅ CORRECT - Memoized derivation from DataContext
const job = useMemo(() => jobs.find(j => j.id === id) || null, [jobs, id]);
const client = useMemo(() =>
  job ? clients.find(c => c.id === job.clientId) || null : null,
  [clients, job]
);

// ❌ WRONG - Recomputes every render
const job = jobs.find(j => j.id === id);
```

### Pattern 4: AuthContext for Authentication

```tsx
// ✅ CORRECT - Use AuthContext
import { useAuth } from '../lib/AuthContext';
const { isAuthenticated, userId, session, userEmail } = useAuth();

// ❌ WRONG - Causes 877 req/hr auth loop bug
const { data } = await supabase.auth.getUser();
```

### Pattern 5: Error States with Retry

```tsx
// ✅ CORRECT - Show error with retry using DataContext refresh
if (error) {
  return <ErrorState message={error} onRetry={refresh} />;
}

// ❌ WRONG - No recovery option
if (error) return <div>Error: {error}</div>;
```

### Pattern 6: Stable React Keys

```tsx
// ✅ CORRECT - Use stable IDs
{photos.map(photo => <img key={photo.id} src={photo.url} />)}

// ❌ WRONG - Causes re-render issues
{photos.map((photo, index) => <img key={index} src={photo.url} />)}
```

### Pattern 7: Animation Constants

```tsx
// ✅ CORRECT - Use shared constants from animations.ts
import { fadeInUp, hoverLiftQuick } from '../lib/animations';
<motion.div variants={fadeInUp} whileHover={hoverLiftQuick}>

// ❌ WRONG - Creates new object every render
<motion.div animate={{ opacity: 1 }} whileHover={{ y: -5 }}>
```

---

## File Structure

```
/home/user/trust_by_design/
├── components/
│   ├── ui/                    # Reusable UI (ActionButton, Card, Modal, Tooltip)
│   ├── layout/                # AppShell, BottomNav, PageHeader, Sidebar
│   ├── branding/              # Logo & brand assets
│   ├── ProtectedRoute.tsx     # Auth error boundary wrapper
│   └── RouteErrorBoundary.tsx # Route-level error boundary
│
├── views/                     # Page-level components
│   ├── app/                   # Admin routes (Dashboard, clients/, jobs/, technicians/)
│   ├── tech/                  # Technician portal (TechPortal, TechJobDetail, EvidenceCapture)
│   ├── AuthView.tsx           # Email + magic link auth
│   ├── AuthCallback.tsx       # Magic link handler
│   ├── OAuthSetup.tsx         # New user account setup + persona selection
│   └── LandingPage.tsx        # Public landing
│
├── lib/                       # Core business logic
│   ├── AuthContext.tsx        # Auth state (session memoization)
│   ├── DataContext.tsx        # Centralized data state
│   ├── auth.ts                # Supabase auth helpers
│   ├── supabase.ts            # Supabase client config
│   ├── db.ts                  # Dexie IndexedDB schema
│   ├── syncQueue.ts           # Offline sync queue
│   ├── encryption.ts          # AES-256-GCM encryption
│   ├── sealing.ts             # RSA-2048 evidence sealing
│   └── animations.ts          # Shared Framer Motion constants
│
├── hooks/                     # Custom React hooks
│   ├── useJobGuard.ts         # Client-first validation
│   ├── useAuthFlow.ts         # Auth state machine
│   └── useWorkspaceData.ts    # Workspace data fetching
│
├── tests/
│   ├── unit/                  # Vitest unit tests
│   └── e2e/                   # Playwright E2E tests
│
├── supabase/
│   ├── migrations/            # SQL migrations (RLS policies here!)
│   └── functions/             # Edge Functions (seal-evidence, verify-evidence)
│
├── types.ts                   # TypeScript type definitions
├── App.tsx                    # Root app with lazy routes
└── vite.config.ts             # Build config with code splitting
```
## 🚫 FORBIDDEN PATTERNS

| Pattern | Why Forbidden | Correct Alternative |
|---------|--------------|---------------------|
| `useState` for jobs/clients/techs | Breaks reactivity | `useData()` |
| `getJobs()` from useWorkspaceData | Deprecated, localStorage only | `useData().jobs` |
| `updateJob(id, partial)` | Wrong signature | `contextUpdateJob(fullJob)` |
| `supabase.auth.getUser()` | Auth loop bug (877 req/hr) | `useAuth()` |
| `key={index}` in lists | Re-render issues | Use stable IDs |
| Inline animation objects | Performance | `animations.ts` constants |
| `console.log` in production | Debug artifacts | Remove before commit |
| `// TODO` or `// FIXME` | Tech debt | Fix immediately |
| Commenting out code | Tech debt | Delete completely |
| Touch targets < 44px | Accessibility | `min-h-[44px]` |

---

## 🔒 OFFLINE-FIRST MANDATES

Every form and data operation MUST have:

| Requirement | Implementation |
|-------------|----------------|
| Draft saving | Dexie/IndexedDB, every keystroke |
| Offline queue | `lib/syncQueue.ts` |
| Network awareness | `navigator.onLine` checks |
| Optimistic UI | Update DataContext before server confirms |
| Data survival | Airplane mode → app restart → data persists |

### Sync Queue Retry Strategy
```typescript
const RETRY_DELAYS = [2000, 5000, 15000, 30000, 60000, 120000, 180000, 300000];
const MAX_RETRIES = 8;
```

---

## 🏕️ BUNKER FIRST: Universal Offline Permissions

**Core Principle:** In no-service scenarios, ALL roles can perform ALL actions locally.

Field workers often operate in:
- Remote sites with zero connectivity
- Underground/bunker environments
- Areas with intermittent service
- Emergency situations

### Permission Model

| Action | Online | Offline (Bunker Mode) |
|--------|--------|----------------------|
| Create jobs | Admin/Manager | **ALL ROLES** |
| Create clients | Admin/Manager | **ALL ROLES** |
| Assign technicians | Admin/Manager | **ALL ROLES** |
| Capture evidence | Technician | **ALL ROLES** |
| Complete jobs | Technician | **ALL ROLES** |
| View all data | Role-based | **ALL ROLES** |

### Implementation Rules

1. **Local-first creation:** Jobs/clients created offline get `origin: 'offline'` flag
2. **Sync reconciliation:** On reconnect, server validates and may flag conflicts
3. **No blocking:** Never prevent local work due to "insufficient permissions"
4. **Audit trail:** All offline actions logged with timestamp + user for later review
5. **Conflict resolution:** Server-side rules determine merge strategy on sync

### UI Indicators

```tsx
// Show bunker mode indicator when offline
{!navigator.onLine && (
  <BunkerModeIndicator message="Full access - changes sync when online" />
)}
```

### Rationale

> "A technician stuck in a basement with no signal MUST be able to log a new
> emergency job, create an ad-hoc client, and capture evidence. The alternative
> is lost work and safety risks. Sync conflicts are preferable to blocked workers."

---

## 📱 Accessibility Requirements

| Element | Minimum Size | CSS Class |
|---------|-------------|-----------|
| All touch targets | 44x44px | `min-h-[44px]` |
| Field worker buttons | 56x56px | `min-h-[56px]` |
| Date/time inputs | 56px height | `py-4 min-h-[56px]` |
| StatusBadge compact | 44px height | `min-h-[44px] px-3 py-2` |

---

## ✅ VERIFICATION COMMANDS

```bash
# Before ANY commit (MANDATORY):
npm test -- --run              # All 367+ tests must pass
npm run build                  # Build must succeed

# Full verification:
npm test && npm run build && echo "✅ READY TO COMMIT"
```

---

## 📁 Critical Files

```
lib/
├── DataContext.tsx     # 🔴 CRITICAL: Centralized state (use this!)
├── AuthContext.tsx     # 🔴 CRITICAL: Auth state (use this!)
├── animations.ts       # Animation constants (use this!)
├── db.ts               # Dexie + Supabase operations
└── syncQueue.ts        # Offline sync

hooks/
├── useWorkspaceData.ts # ⚠️ DEPRECATED: Do NOT use standalone functions
└── useJobGuard.ts      # Client-first validation

views/
├── app/                # Admin views (jobs/, clients/, technicians/)
└── tech/               # Technician portal views
```

---

## 🔐 Security Rules

1. **RLS Required:** Every Supabase table MUST have Row-Level Security
2. **auth.uid() Only:** User isolation via `auth.uid()`, never trust client
3. **No service_role:** Never use `service_role` keys in frontend code
4. **Sealed Evidence:** RSA-2048 signing, jobs with `sealedAt` cannot be deleted
5. **Invoiced Jobs:** Jobs with `invoiceId` cannot be deleted

---

## 🔄 Job Status Lifecycle

```
Draft → Dispatched → In Progress → Complete → Submitted → Sealed → Invoiced
         ↓              ↓            ↓          ↓           ↓
    (needs tech)   (tech working)  (evidence)  (review)   (locked)
```

**Deletion Rules:**
- `sealedAt` present → Cannot delete (evidence preserved)
- `invoiceId` present → Cannot delete (delete invoice first)
- Hide delete button for non-deletable jobs

---

## 🧪 Test Requirements

**367+ tests must pass. Coverage thresholds:**
- Lines: 80%
- Functions: 75%
- Branches: 75%

**Architecture tests enforce:**
- No `supabase.auth.getUser()` in components
- No `useState` for jobs/clients/technicians
- All routes lazy-loaded
- Animation constants used

---

## 🚀 Deployment

```bash
# Preview
vercel deploy

# Find broken patterns
grep -r "service_role" components/ views/ lib/ # MUST be 0 (security)

# Production readiness check
npm test -- --run && npm run lint && npm run type-check && npm run build
```

---

## Emergency Procedures

### When Tests Fail

```bash
git stash push -m "work in progress"
npm test -- --run           # Verify baseline passes
git stash pop               # Restore changes if baseline passes
# Fix the specific failing test
```

### When Build Fails
# Production
vercel --prod

# Required env vars:
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
VITE_APP_URL=https://jobproof.pro
```

---

## 🔧 Emergency Procedures

### Tests Fail After Changes
```bash
rm -rf node_modules/.cache
npm ci                      # Clean install
npm run build               # Retry build
```

### When Auth Loop Detected

Check `lib/AuthContext.tsx`:
- Token refresh updates ref, not state
- Only user ID changes trigger component re-renders
- Session memoization prevents 877 req/hr bug

### Nuclear Reset

```bash
git stash push -m "claude broke it"
rm -rf node_modules/.cache
npm ci
npm run build
# Only pop stash if build passes
```

---

## PR Checklist

Before merging any PR, verify:

- [ ] `npm test -- --run` passes (all tests green)
- [ ] `npm run lint` passes (no errors)
- [ ] `npm run type-check` passes (no type errors)
- [ ] `npm run build` succeeds
- [ ] No direct `supabase.auth.getUser()` calls in components
- [ ] No `useState` for jobs/clients/technicians (use DataContext)
- [ ] All route components lazy-loaded
- [ ] All protected routes wrapped with RouteErrorBoundary
- [ ] No inline animation objects in Framer Motion
- [ ] No array index as React key
- [ ] New views added to vite.config.ts manualChunks
- [ ] Navigation components wrapped with React.memo
- [ ] Expensive list operations use useMemo
- [ ] Failed operations have ErrorState with retry
- [ ] Offline functionality verified (airplane mode test)
- [ ] No `service_role` keys in frontend code

---

## Environment Variables

```bash
# Required (.env)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
VITE_APP_URL=https://yourapp.vercel.app

# Optional
VITE_W3W_API_KEY=xxx                    # What3Words
VITE_GOOGLE_CLIENT_ID=xxx               # Google OAuth

# Supabase Secrets (Server-side only - NEVER in frontend)
SEAL_PRIVATE_KEY=base64...              # RSA-2048 private key
SEAL_PUBLIC_KEY=base64...               # RSA-2048 public key
SUPABASE_SERVICE_ROLE_KEY=xxx           # NEVER expose in src/
```

---

## Key Type Definitions

```typescript
// Job status lifecycle
type JobStatus = 'Pending' | 'In Progress' | 'Complete' | 'Submitted'
               | 'Archived' | 'Paused' | 'Cancelled' | 'Draft';

// Persona types (user roles)
type PersonaType = 'solo_contractor' | 'agency_owner' | 'compliance_officer'
                 | 'safety_manager' | 'site_supervisor';

// Job creation origin
type JobCreationOrigin = 'manager' | 'technician' | 'self_employed';

// Technician work mode
type TechnicianWorkMode = 'employed' | 'self_employed';
```

---

## Claude Behavior Constraints

```
NEVER ALLOW:
- "This should fix it" (no proof)
- Rewrite working code without reason
- Leave TODO/FIXME comments
- Suggest multiple approaches (pick ONE)
- Change core architecture mid-fix
- More than 1 file per atomic fix
- Use service_role keys in frontend

MANDATORY:
- Tests run BEFORE declaring success
- Before/after context shown (20 lines)
- Legacy code DELETED (not commented)
- Deploy commands that work copy/paste
- UAT script human can execute
- Risk assessment per fix
- Use Task tool for exploration (not manual grep)
```

---

*This document is the source of truth for JobProof development. Every Claude response must obey these rules.*
git stash push -m "work in progress"
npm test -- --run    # Verify baseline
git stash pop        # Restore and fix
```

### Build Fails
```bash
rm -rf node_modules/.cache
npm ci
npm run build
```

### Auth Loop (877 req/hr)
Check `AuthContext.tsx` - token refresh should update ref, not state.

---

## 📋 PR Checklist

```
□ npm test -- --run passes (367+ tests)
□ npm run build succeeds
□ All views use useData() from DataContext
□ No deprecated hooks (getJobs, updateJob from useWorkspaceData)
□ updateJob uses FULL job object, not partial
□ No supabase.auth.getUser() in components
□ No useState for jobs/clients/technicians
□ Memoized derivations (useMemo for computed values)
□ Error states have retry via DataContext.refresh()
□ Touch targets ≥ 44px
□ No inline animation objects
□ No array index as React key
□ Sealed/invoiced jobs cannot be deleted
□ Offline mode tested
```

---

## 🎯 Known Patterns That Cause Bugs

| Bug | Root Cause | Prevention |
|-----|-----------|------------|
| Changes lost on refresh | Using deprecated hooks | Use DataContext |
| Assign technician fails | Wrong updateJob signature | Use full Job object |
| Can't delete some jobs | Sealed/invoiced check missing | Check sealedAt, invoiceId |
| Auth loop (877 req/hr) | Direct supabase.auth calls | Use AuthContext |
| Touch too small for gloves | < 44px targets | min-h-[44px] |
| Actions don't navigate | Missing `to` prop | Add route navigation |

---

## 📊 Current Status

**Fixed (Feb 2026):**
- ✅ Job deletion with DataContext
- ✅ Technician assignment persistence
- ✅ JobList quick action buttons
- ✅ StatusBadge 44px touch targets
- ✅ Network error states with retry
- ✅ Magic link expiry countdown
- ✅ Dashboard incomplete filter
- ✅ TechPortal DataContext migration
- ✅ TechJobDetail DataContext migration
- ✅ ClientList/ClientDetail DataContext migration
- ✅ TechnicianList DataContext migration

**Remaining Tech Debt:**
- `views/tech/EvidenceCapture.tsx`
- `views/app/jobs/JobForm.tsx`
- `views/app/jobs/EvidenceReview.tsx`
- `views/app/invoices/InvoiceList.tsx`
- `views/app/invoices/InvoiceDetail.tsx`
- `hooks/useJobGuard.ts`

---

## 🏆 Success Metrics

```
□ npm test = 367+ tests green
□ npm run build = SUCCESS
□ Airplane mode: forms persist + sync
□ "Job not found" errors = 0
□ Auth loop (877 req/hr) = NEVER
□ Touch targets = ALL ≥ 44px
□ Deprecated hook usage = 0 in fixed views
```

---

*This constitution is the source of truth. Every code change must follow these patterns. Violations cause regressions.*
