# PROJECT CONSTITUTION: JobProof

**Date:** February 1, 2026 | **Status:** ENFORCE ALL RULES | **Creator:** Solo AI Builder

---

## Tech Stack (2026 Standard)

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + Vite 6 | Fast dev, optimized builds |
| **Language** | TypeScript 5.8 (strict) | Type safety |
| **Styling** | Tailwind CSS 3.4 | Utility-first responsive design |
| **Routing** | React Router 6 | Hash-based routing (`/#/...`) |
| **Animations** | Framer Motion 12 | Declarative motion |
| **Auth** | Supabase Auth | Email + magic links + OAuth |
| **Database** | Supabase (PostgreSQL 17, RLS, PostgREST) | Cloud storage + RLS |
| **Offline** | Dexie (IndexedDB) | Local-first storage |
| **Testing** | Vitest + Playwright | Unit + E2E |
| **Deployment** | Vercel (Edge Runtime) | CDN + serverless |

---

## Core Mission

Build bulletproof **offline-first field service evidence platform** for poor service areas.

- Contractors managing field technicians
- Technicians capturing job evidence with GPS/W3W verification
- Clients reviewing sealed, tamper-proof job reports

**NO REGRESSIONS ALLOWED.**

---

## Cognitive Workflow (Orchestration)

### 1. PONDERING
Before coding complex features, create a `thinking.md` in `.claude/`:

```markdown
# Thinking: [Feature Name]

## Problem Statement
What exactly are we solving?

## Current State
How does it work now?

## Proposed Solution
What's the plan?

## Risks
What could go wrong?

## Test Plan
How will we verify?
```

### 2. SUB-AGENTING
For any task > 100 lines of changes, use specialized exploration:
- Use `Task` tool with `subagent_type=Explore` for codebase research
- Use `Task` tool with `subagent_type=Plan` for architecture decisions
- Keep fixes atomic: **MAXIMUM 1 FILE CHANGED PER FIX**

### 3. RALPH LOOP (Loop-to-Success Debugging)
```
1. READ the error/bug description completely
2. ANALYZE root cause with grep/read tools
3. LOCATE the exact file:line causing the issue
4. PATCH with minimal, targeted fix
5. HAMMER the tests until green (npm test)
```

---

## RLS & Security (Zero-Trust)

### Mandatory Rules

```
1. Every table MUST have RLS policies in supabase/migrations/
2. auth.uid() is the ONLY valid primary identifier for user-data isolation
3. NO service_role keys allowed in components/, views/, or lib/
4. All 14+ tables have RLS policies enforced
5. Workspace isolation at DB level - users see only their data
```

### Security Patterns

```tsx
// CORRECT - Uses session from AuthContext
const { userId, session } = useAuth();
const supabase = getSupabase();
const { data } = await supabase.from('jobs').select('*');
// RLS automatically filters by auth.uid()

// WRONG - Bypasses RLS
const { data } = await supabase.from('jobs').select('*').eq('user_id', someId);
// Manual filtering = security hole
```

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
```

---

## Architecture Guidelines (CRITICAL)

These patterns prevent regressions. **All code MUST follow these.**

### 1. State Management - Use DataContext

```tsx
// CORRECT
import { useData } from '../lib/DataContext';
const { jobs, clients, addJob, updateJob } = useData();

// WRONG - Creates duplicate state
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

// WRONG - No error isolation
<Route element={isAuthenticated ? <Dashboard /> : <Navigate to="/auth" />} />
```

### 4. Animation Objects - Use Shared Constants

```tsx
// CORRECT
import { fadeInUp, hoverLiftQuick } from '../lib/animations';
<motion.div variants={fadeInUp} whileHover={hoverLiftQuick}>

// WRONG - Creates new object every render
<motion.div animate={{ opacity: 1 }} whileHover={{ y: -5 }}>
```

### 5. List Keys - Use Stable IDs

```tsx
// CORRECT
{photos.map(photo => <img key={photo.id} src={photo.url} />)}

// WRONG - Causes re-render issues
{photos.map((photo, index) => <img key={index} src={photo.url} />)}
```

### 6. Expensive Computations - Use useMemo

```tsx
// CORRECT
const clientsById = useMemo(() =>
  new Map(clients.map(c => [c.id, c])),
  [clients]
);

// WRONG - Recomputes every render
const clientsById = new Map(clients.map(c => [c.id, c]));
```

### 7. Navigation Components - Use React.memo

```tsx
// CORRECT
export const Sidebar = memo(function Sidebar({ ... }) { ... });

// WRONG - Re-renders on every parent update
export const Sidebar = ({ ... }) => { ... };
```

### 8. Lazy Loading - Use Dynamic Imports

```tsx
// CORRECT - Route components
const Dashboard = lazy(() => import('./views/Dashboard'));

// CORRECT - Heavy libraries
const auth = await import('../lib/auth');

// WRONG - Increases initial bundle
import { Dashboard } from './views/Dashboard';
```

### 9. Error Handling - Use ErrorState Component

```tsx
// CORRECT
import { ErrorState } from '../components/ui/ErrorState';
if (error) return <ErrorState message={error} onRetry={loadData} />;

// WRONG - No recovery option
if (error) return <div>Error: {error}</div>;
```

### 10. Supabase Access - Through Auth Module

```tsx
// CORRECT
const auth = await import('../lib/auth');
const supabase = auth.getSupabaseClient();

// WRONG - Breaks code splitting
import { getSupabase } from '../lib/supabase';
```

### 11. Magic Link Auth - Use Callback Route

```tsx
// CORRECT (in lib/auth.ts)
emailRedirectTo: getAuthRedirectUrl('/#/auth/callback')

// WRONG - Race condition with auth state
emailRedirectTo: getAuthRedirectUrl('/#/')
```

### 12. Code Splitting - Update vite.config.ts

When adding new views, add them to appropriate chunk in `manualChunks`:

```js
// vite.config.ts
'admin-routes': ['./views/NewAdminView.tsx', ...],
'public-routes': ['./views/NewPublicView.tsx', ...],
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

---

## Diagnostic Commands

```bash
# Find architecture violations
grep -r "supabase.auth.getUser" components/    # Should be 0
grep -r "useState.*Job\[\]" components/        # Should be 0
grep -r "key={index}" components/              # Should be 0

# Verify offline support
grep -r "Dexie\|IndexedDB" lib/ | wc -l        # Should be > 10

# Check for debug artifacts
grep -r "console.log\|debugger" src/ | wc -l   # Should be 0 in prod

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
