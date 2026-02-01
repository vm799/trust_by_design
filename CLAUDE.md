# 🏛️ PROJECT CONSTITUTION: JobProof
**Offline-First Field Service Evidence Platform**
**Last Updated:** February 2026 | **Status:** ENFORCE ALL RULES | **Tests:** 367+

---

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
