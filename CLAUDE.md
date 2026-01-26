# PRODUCTION AI BUILDER CONSTITUTION
**Date: Jan 26, 2026** | **Status: ENFORCE ALL RULES** | **Creator: Solo AI Builder**

## CORE MISSION
Build bulletproof **offline-first mobile app** for poor service areas. **NO REGRESSIONS ALLOWED**. **MARKETABLE BY 12PM**.

## ABSOLUTE RULES (Break = IMMEDIATE REJECT)

```
1. NO CODE CHANGES WITHOUT TESTS FIRST
2. SHOW BEFORE/AFTER SCREENSHOTS (20 lines context each)
3. MAXIMUM 1 FILE CHANGED PER FIX
4. DELETE LEGACY CODE (NEVER COMMENT OUT)
5. PROVE IT WORKS (test command output REQUIRED)
6. ONE-CLICK DEPLOY COMMANDS
7. NO "THIS SHOULD WORK" - ONLY PROOF
8. JSON OUTPUT FORMAT ONLY (no prose explanations)
9. UAT SCRIPT REQUIRED FOR EVERY FIX
```

## OFFLINE-FIRST MANDATES (Every Form MUST Have)
```
AsyncStorage draft saving (every keystroke)
Offline submit queue ('pendingSync' in AsyncStorage)
Background sync worker (NetInfo listener)
Optimistic UI updates with status indicators
Airplane mode -> app restart -> data survives
Form drafts auto-load on screen mount
```

## MANDATORY JSON OUTPUT FORMAT

```json
{
  "issue": "job_not_found",
  "rootCause": "exact cause from code analysis",
  "files": {
    "before": "exact screenshot path or 20 lines",
    "after": "exact screenshot path or 20 lines",
    "changed": ["src/components/JobInvite.tsx"]
  },
  "tests": {
    "added": ["tests/integration/jobInvite.spec.ts"],
    "commands_run": ["npm test", "npm run test:offline"],
    "results": "paste COMPLETE test output here"
  },
  "cleanup": {
    "deleted_files": ["old-broken-file.tsx"],
    "removed_imports": ["list them"],
    "legacy_code_gone": true
  },
  "deploy": {
    "preview": "vercel deploy --previews",
    "prod": "vercel --prod",
    "env_vars": ["NEXT_PUBLIC_APP_URL=https://yourapp.vercel.app"]
  },
  "uat_script": "1. Admin creates job invite\n2. Copy link -> incognito\n3. Click -> expect onboarding\n4. Submit -> expect job assigned",
  "status": "TestsPassed_UATPending",
  "risk_level": "LOW|MEDIUM|HIGH",
  "next_fix": "offline_forms|navigation|ci_cd"
}
```

## DAILY PREVENTION RITUAL (30 mins REQUIRED)

```
MORNING (before Claude work):
$ npm run lint -- --fix
$ npm test
$ npx depcheck | grep "Unused" || echo "CLEAN"
$ git status | grep -v "claude\|temp" || echo "CLEANUP"

AFTER EVERY CLAUDE FIX:
$ npm test && echo "TESTS PASS" || echo "TESTS FAIL"
$ npm run dev
$ Toggle airplane -> test forms -> toggle back -> verify sync
$ vercel deploy -> test preview URL

WEEKLY CLEANUP:
$ find . -name "*.bak" -delete
$ find . -name "claude-*" -delete
$ grep -r "// TODO\|FIXME" src/ | wc -l  # MUST = 0
```

## EMERGENCY RESET COMMANDS

```
# When Claude breaks everything:
$ git stash push -m "claude broke it"
$ npm test  # diagnose failures
$ git stash pop  # only if tests pass

# Nuclear cleanup:
$ rm -rf node_modules/.cache
$ npm ci
$ npm run build
```

## SUCCESS METRICS (12PM TARGETS)

```
CRITICAL (MUST BE BY NOON):
[ ] npm test = 100% green
[ ] Airplane mode: ALL forms persist + sync
[ ] 10x technician invites = 10/10 success (incognito)
[ ] "Job not found" errors = 0
[ ] Preview deploy passes all flows

NICE TO HAVE:
[ ] Legacy files = 0 (grep -r "// TODO" src/ = 0)
[ ] Sentry monitoring active
[ ] E2E tests passing
```

## STANDARD DIAGNOSTIC COMMANDS

```
# Find broken patterns:
grep -r "supabase.*insert.*onSubmit" src/  # direct API calls
grep -r "job.*not.*found" src/            # error messages
grep -r "router.push.*operations" src/    # broken nav
grep -r "AsyncStorage\|NetInfo" src/ | wc -l  # offline support (should > 50)

# Verify clean state:
npm test && npm run lint && echo "PRODUCTION READY"
```

## ATOMIC FIX SEQUENCE (Execute This Order)

```
1. FIX #1: "Job not found" -> technician invite flow
2. FIX #2: Offline form persistence -> ALL forms
3. FIX #3: Navigation back buttons
4. FIX #4: CI/CD test cleanup
5. FIX #5: Production deploy + monitoring
```

## CLAUDE BEHAVIOR CONSTRAINTS

```
NEVER ALLOW:
- "This should fix it" (no proof)
- Rewrite working code
- Leave TODO/FIXME comments
- Suggest multiple approaches (pick ONE)
- Change core architecture mid-project
- More than 1 file per fix

MANDATORY:
- Tests written BEFORE code changes
- Before/after screenshots (20 lines context)
- Legacy code DELETED (not commented)
- Deploy commands that work copy/paste
- UAT script human can execute
- Risk assessment per fix
```

---

# ALL RESPONSES MUST FOLLOW JSON FORMAT OR REJECTED

*This is your project constitution. Every Claude response must obey these rules.*

---
---

# CLAUDE.md - JobProof Production AI Builder Guide

**Last Updated:** January 26, 2026
**Status:** Production-Ready
**Stack:** Vite + React 18 + TypeScript + Supabase + Dexie

---

## Quick Reference

```bash
# Daily workflow
npm run dev              # Start dev server (port 3000)
npm test                 # Run unit tests (watch mode)
npm run lint             # ESLint check
npm run type-check       # TypeScript validation
npm run build            # Production build

# Full verification
npm test && npm run lint && npm run type-check && npm run build
```

---

## Project Overview

JobProof is an **offline-first field service evidence management platform** built for:
- Contractors managing field technicians
- Technicians capturing job evidence with GPS/W3W verification
- Clients reviewing sealed, tamper-proof job reports

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Vite + React 18 | Fast dev, optimized builds |
| Language | TypeScript 5.8 (strict) | Type safety |
| Styling | Tailwind CSS 3.4 | Utility-first responsive design |
| Routing | React Router 6 | Hash-based routing (`/#/...`) |
| Animations | Framer Motion 12 | Declarative motion |
| Auth | Supabase Auth | Email + magic links + OAuth |
| Database | Supabase (PostgreSQL) | Cloud storage + RLS |
| Offline | Dexie (IndexedDB) | Local-first storage |
| Testing | Vitest + Playwright | Unit + E2E |

---

## Quality Standards

### Before Every Commit

```bash
npm test                 # All tests pass
npm run lint             # No lint errors
npm run type-check       # No type errors
npm run build            # Build succeeds
```

### Code Change Rules

1. **Read before modifying** - Always read files before changing them
2. **One concern per fix** - Keep changes focused and atomic
3. **Delete, don't comment** - Remove unused code completely
4. **Test first** - Write/update tests before implementation when possible
5. **Prove it works** - Verify changes with test output

### Offline-First Mandates

Every form and data operation MUST have:
- Dexie/IndexedDB draft saving
- Offline submit queue via sync system
- Network status awareness (navigator.onLine)
- Optimistic UI updates with status indicators
- Data survives app restart in offline mode

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

### 3. Protected Routes - Use ProtectedRoute Wrapper

```tsx
// CORRECT
<ProtectedRoute sectionName="Dashboard" fallbackRoute="/home">
  <Dashboard />
</ProtectedRoute>

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
│   ├── ui/                    # Reusable UI components
│   │   ├── ActionButton.tsx   # Primary buttons with press-spring
│   │   ├── Card.tsx           # Container with glassmorphism
│   │   ├── Modal.tsx          # Dialog overlay
│   │   ├── Tooltip.tsx        # Radix UI tooltips
│   │   ├── InfoBox.tsx        # Dismissible callout boxes
│   │   ├── StatusBadge.tsx    # Status indicators
│   │   ├── ErrorState.tsx     # Error display with retry
│   │   ├── Breadcrumbs.tsx    # Navigation breadcrumbs
│   │   └── ConfirmDialog.tsx  # Confirmation dialogs
│   ├── layout/                # Layout components
│   │   ├── AppShell.tsx       # Main app container
│   │   ├── BottomNav.tsx      # Mobile bottom navigation
│   │   ├── PageHeader.tsx     # Page header with actions
│   │   └── Sidebar.tsx        # Desktop sidebar
│   ├── branding/              # Logo & brand assets
│   ├── ProtectedRoute.tsx     # Auth error boundary wrapper
│   ├── RouteErrorBoundary.tsx # Route-level error boundary
│   └── *.tsx                  # Feature components
│
├── views/                     # Page-level components
│   ├── app/                   # Modern nested route structure
│   │   ├── Dashboard.tsx
│   │   ├── clients/           # Client CRUD views
│   │   ├── jobs/              # Job management views
│   │   ├── technicians/       # Technician management
│   │   └── settings/          # Settings views
│   ├── tech/                  # Technician portal views
│   │   ├── TechPortal.tsx
│   │   ├── TechJobDetail.tsx
│   │   └── EvidenceCapture.tsx
│   ├── AuthView.tsx           # Email + magic link auth
│   ├── AuthCallback.tsx       # Magic link handler
│   ├── LandingPage.tsx        # Public landing
│   └── *.tsx                  # Other views
│
├── lib/                       # Core business logic
│   ├── AuthContext.tsx        # Auth state (session memoization)
│   ├── DataContext.tsx        # Centralized data state
│   ├── auth.ts                # Supabase auth helpers
│   ├── supabase.ts            # Supabase client config
│   ├── db.ts                  # Dexie IndexedDB schema
│   ├── theme.tsx              # Theme provider
│   ├── animations.ts          # Shared Framer Motion constants
│   ├── syncQueue.ts           # Offline sync queue
│   ├── syncRecovery.ts        # Conflict resolution
│   ├── encryption.ts          # AES-256-GCM encryption
│   ├── sealing.ts             # RSA-2048 evidence sealing
│   ├── magicLinkService.ts    # Multi-channel magic links
│   ├── audit.ts               # Audit trail logging
│   ├── validation.ts          # Input validation
│   └── redirects.ts           # Safe redirect allowlist
│
├── hooks/                     # Custom React hooks
│   ├── useJobGuard.ts         # Client-first validation
│   ├── useAuthFlow.ts         # Auth state machine
│   ├── useNavigation.ts       # Navigation helpers
│   └── useWorkspaceData.ts    # Workspace data fetching
│
├── tests/
│   ├── unit/                  # Vitest unit tests
│   │   ├── architecture.test.ts  # Pattern enforcement
│   │   ├── components/        # Component tests
│   │   ├── lib/               # Library tests
│   │   └── hooks/             # Hook tests
│   ├── e2e/                   # Playwright E2E tests
│   │   ├── auth-flows.spec.ts
│   │   └── critical-path.spec.ts
│   ├── mocks/                 # MSW mock handlers
│   └── setup.ts               # Test setup
│
├── supabase/
│   ├── migrations/            # SQL migrations (20+)
│   └── functions/             # Edge Functions
│       ├── seal-evidence/     # RSA signing
│       └── verify-evidence/   # Signature verification
│
├── src/styles/
│   └── theme.css              # CSS variables & utilities
│
├── types.ts                   # TypeScript type definitions (400+ lines)
├── App.tsx                    # Root app with lazy routes
├── vite.config.ts             # Build config with code splitting
├── tailwind.config.js         # Tailwind configuration
├── vitest.config.ts           # Unit test config
└── playwright.config.ts       # E2E test config
```

---

## Theme System

### Theme Provider (`lib/theme.tsx`)

```tsx
import { useTheme } from '../lib/theme';

const {
  theme,           // 'light' | 'dark' | 'auto' | 'system'
  setTheme,        // Set theme mode
  resolvedTheme,   // Actual applied: 'light' | 'dark'
  isEvening,       // Boolean: is it evening (6PM-6AM)?
  toggleDayNight   // Quick toggle
} = useTheme();
```

### Theme-Aware Components

```tsx
const { resolvedTheme } = useTheme();
const isDark = resolvedTheme === 'dark';

<div className={`
  ${isDark
    ? 'bg-slate-900 text-white'
    : 'bg-white text-slate-900'
  }
`}>
```

### CSS Variables (`src/styles/theme.css`)

```css
:root {
  --background: 0 0% 98%;
  --foreground: 222.2 84% 4.9%;
  --primary: 221 83% 53%;        /* Industrial Blue */
  --accent: 14 91% 60%;          /* Safety Orange */
  --success: 142 76% 36%;
  --warning: 38 92% 50%;
  --danger: 0 84.2% 60.2%;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --primary: 217.2 91.2% 59.8%;
  --accent: 14 91% 65%;
}
```

---

## Component Patterns

### Tooltip System (Radix UI)

```tsx
import { Tooltip, SimpleTooltip, InfoTooltip, HelpTooltip } from '../components/ui';

// Basic tooltip (300ms delay, high-contrast)
<Tooltip content="Helpful hint" position="top">
  <button>Hover me</button>
</Tooltip>

// Form field with auto-dismiss (60s)
<InfoTooltip content="This field is required">
  <input type="text" />
</InfoTooltip>

// Standalone help icon
<HelpTooltip content="Click here for more info" />
```

### InfoBox Component

```tsx
import { InfoBox } from '../components/ui';

// Persistent dismissal (saved to localStorage)
<InfoBox
  icon="lightbulb"
  title="Pro Tip"
  variant="tip"
  persistKey="feature_tip_shown"
>
  Once dismissed, this won't show again.
</InfoBox>
```

### Glassmorphism Pattern

```tsx
<div className={`
  backdrop-blur-xl rounded-2xl border transition-all
  ${isDark
    ? 'bg-slate-900/50 border-white/10'
    : 'bg-white/50 border-slate-200/50'
  }
`}>
```

### Job Creation Guards

```tsx
import { useJobGuard } from '../hooks/useJobGuard';

const {
  hasClients,
  hasTechnicians,
  canCreateJob,
  checkAndRedirect,
} = useJobGuard(redirectOnFail);

// Validates client-first flow before job creation
const handleCreateJob = async () => {
  const canProceed = await checkAndRedirect();
  if (canProceed) {
    // Proceed with job creation
  }
};
```

---

## Offline Sync System

### Sync Queue (`lib/syncQueue.ts`)

```typescript
// Retry strategy: exponential backoff
const RETRY_DELAYS = [2000, 5000, 15000, 30000, 60000, 120000, 180000, 300000];
const MAX_RETRIES = 8;

// Operations
pullJobs()              // Fetch from Supabase
syncJobToSupabase()     // Upload job + photos + signature
```

### Dexie Database (`lib/db.ts`)

```typescript
// IndexedDB stores for offline data
const db = new Dexie('JobProofDB');
db.version(1).stores({
  media: 'id, jobId, type, timestamp',
  syncQueue: 'id, operation, status, retries',
});
```

### Conflict Resolution

- Last-write-wins with timestamp comparison
- Audit logging for all conflicts
- Manual resolution UI for critical data

---

## Security Features

### Encryption (`lib/encryption.ts`)

- **Algorithm:** AES-256-GCM
- **Key Derivation:** PBKDF2 (32-byte entropy)
- **Storage:** In-memory, NON-EXTRACTABLE keys

### Evidence Sealing (`lib/sealing.ts`)

- **Algorithm:** RSA-2048 + SHA-256
- **Server-Side:** Edge Function signs with private key
- **Verification:** Detects tampering in sealed jobs

### Magic Link Service (`lib/magicLinkService.ts`)

- Multi-channel delivery: Email, SMS, QR, Copy
- 7-day expiry with rate limiting detection
- Cross-browser validation (HashRouter compatible)

### Row-Level Security (RLS)

- All 14+ tables have RLS policies
- Workspace isolation enforced at DB level
- Role-based permissions: Admin, Member, Token

---

## Testing Infrastructure

### Unit Tests (Vitest)

```bash
npm test                 # Watch mode
npm run test:unit        # Single run
npm run test:coverage    # With coverage report
```

Coverage thresholds: Lines 80%, Functions 75%, Branches 75%

### E2E Tests (Playwright)

```bash
npm run test:e2e         # Headless
npm run test:e2e:ui      # Interactive UI mode
```

Browsers: Chrome, Firefox, Safari, Mobile Chrome, Mobile Safari, iPad Pro

### Architecture Tests

```bash
# tests/unit/architecture.test.ts enforces:
# - No direct supabase.auth.getUser() in components
# - No useState for jobs/clients/technicians
# - All routes lazy-loaded
# - Animation constants used
```

---

## Accessibility (WCAG AAA)

### Touch Targets

- Minimum 44x44px for interactive elements
- 56x56px for field worker buttons (gloved hands)

### Focus Indicators

```css
:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}
```

### Icon System

```tsx
<span className="material-symbols-outlined">icon_name</span>

// Filled variant
<span
  className="material-symbols-outlined"
  style={{ fontVariationSettings: "'FILL' 1" }}
>
  icon_name
</span>
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

# Production readiness
npm test && npm run lint && npm run type-check && npm run build
```

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
```

### Supabase Secrets (Server-side)

```bash
SEAL_PRIVATE_KEY=base64...              # RSA-2048 private key
SEAL_PUBLIC_KEY=base64...               # RSA-2048 public key
SUPABASE_SERVICE_ROLE_KEY=auto          # Auto-configured
```

---

## Deployment

### Vercel Deployment

```bash
vercel deploy            # Preview deployment
vercel --prod            # Production deployment
```

### Build Verification

```bash
npm run build            # Must complete without errors
npm run preview          # Test production build locally
```

### Database Migrations

```bash
# Migrations are in supabase/migrations/
# Apply via Supabase Dashboard or CLI
supabase db push
```

---

## PR Checklist

Before merging any PR, verify:

- [ ] `npm test` passes (all tests green)
- [ ] `npm run lint` passes (no errors)
- [ ] `npm run type-check` passes (no type errors)
- [ ] `npm run build` succeeds
- [ ] No direct `supabase.auth.getUser()` calls in components
- [ ] No `useState` for jobs/clients/technicians (use DataContext)
- [ ] All route components lazy-loaded
- [ ] All protected routes wrapped with ProtectedRoute
- [ ] No inline animation objects in Framer Motion
- [ ] No array index as React key
- [ ] New views added to vite.config.ts manualChunks
- [ ] Navigation components wrapped with React.memo
- [ ] Expensive list operations use useMemo
- [ ] Failed operations have ErrorState with retry
- [ ] Offline functionality verified (airplane mode test)

---

## Phase Implementation Status

### Completed Phases

- **Phase 1:** Core UI Foundation (glassmorphism, dark mode, theme)
- **Phase 2:** Tooltip UX Polish (Radix UI, 300ms delay, auto-dismiss)
- **Phase 3:** Job Creation Guards (client-first flow, breadcrumbs)
- **Phase 15:** TechProofScreen (field evidence capture)
- **Phase 23:** Technician-Initiated Jobs (self-employed mode)
- **Phase C.3:** Cryptographic Evidence Sealing (RSA-2048)

### Recent Updates (January 2026)

- Magic link cross-browser validation fixes
- Form auto-draft persistence
- Navigation consistency improvements
- Session memoization (fixed 877 req/hr auth loop)
- Comprehensive RLS security hardening

### Pending Phases

- Phase 4: Job Flexibility
- Phase 5: Job Lifecycle + Navbar
- Phase 6: Polish + Integrations

---

## Key Type Definitions

```typescript
// Job status lifecycle
type JobStatus = 'Pending' | 'In Progress' | 'Complete' | 'Submitted'
               | 'Archived' | 'Paused' | 'Cancelled' | 'Draft';

// Job creation origin (Phase 23)
type JobCreationOrigin = 'manager' | 'technician' | 'self_employed';

// Technician work mode
type TechnicianWorkMode = 'employed' | 'self_employed';

// Photo metadata
interface PhotoMetadata {
  id: string;
  url: string;
  gps?: { lat: number; lng: number; accuracy?: number };
  w3w?: string;
  timestamp: string;
  type: 'before' | 'during' | 'after';
}
```

---

## Emergency Procedures

### If Tests Fail After Changes

```bash
git stash push -m "work in progress"
npm test                 # Verify baseline passes
git stash pop            # Restore changes
# Fix the specific failing test
```

### If Build Fails

```bash
rm -rf node_modules/.cache
npm ci                   # Clean install
npm run build            # Retry build
```

### If Auth Loop Detected

Check AuthContext.tsx - session memoization should prevent re-renders:
- Token refresh updates ref, not state
- Only user ID changes trigger component re-renders

---

*This document is the source of truth for JobProof development patterns. All AI-assisted development must follow these guidelines.*
